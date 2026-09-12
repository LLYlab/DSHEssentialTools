# DET 适配 DSH 0.1.5（0.1.1-rc.2 → 0.1.5-rc.1）

本机 DET 源码对新版 DSH 宿主的兼容迁移记录。

- 宿主走廊：`dsh 0.1.1-rc.2` → `dsh 0.1.5-rc.1`（npm `latest`/`next`）
- DET 版本：2.4.1（仅改本机源码，未发版）
- 改前基线：git `a08613e`（工作区干净，可直接 `git checkout .` 回滚）
- 验证日期：2026-09-10

## 一、结论

宿主侧有 **3 处**真实破坏，客户端侧 **0 处**。全部通过新增的「宿主版本兼容层」修复，
DET 现在在新旧两种宿主上都能工作（旧宿主行为完全不变）。

## 二、宿主侧破坏点与修复

### 1. `Session.events` 被移除（DSH 0.1.2-alpha.4 起）

`Session` 不再有 `events` getter，改为按需读取：

| 旧写法 | 新写法 |
|---|---|
| `session.events.length` | `session.seq` |
| `session.events[i]` | `session.eventAt(SessionSeq(i))` |
| `session.events`（整表） | `session.snapshotEvents()` |
| `session.events.slice(a,b)` | `session.snapshotEvents(SessionLogOffset(a), SessionLogOffset(b))` |

DET 有 12 处直接读 `session.events`（VTD 派生树、分叉边界、live/冷读事件列等），
任一处在 0.1.5 上都会得到 `undefined` 并抛异常 → **VTD 整条链路失效**。

修复：引入 `sessionEvents()` / `sessionEventsOrEmpty()` / `sessionEventCount()`，
旧宿主走 `.events`（getter 抛错也能兜住），新宿主走 `snapshotEvents()`，条数优先用 O(1) 的 `seq`。
12 处调用点全部改为经兼容层访问。

### 2. 持久化改为 `SessionHandle`（DSH 0.1.3-alpha.1 起）

`sessionPersistence` 的 `create(meta)` / `append(id, events)` / `load(id)` 已移除；
`create/open` 现在返回生命周期持有的 `SessionHandle`（`read` / `append` / `flush` / `close`），
头字段 `seedLength` 变为 `isSeeded` + `inheritedEventCount`。

修复：`loadPersistedEvents()`（新宿主 `open(id,'read')` → `read()` → `close()`；旧宿主 `load(id)`）
与 `createSeededSession()`（新宿主 `create(header,{inheritedEventCount})` → `append` → `flush` → `close`；
旧宿主原样 `create(meta)` + `append(id,seed)`）。

### 3. `SessionHeader.origin` 只接受 `'subagent'`（新校验）

`dsh-session-persistence-jsonl` 的 `isHeaderLine` 要求
`origin === undefined || origin === 'subagent'`，且未知键一律拒绝。
DET 原本用 `origin: 'vtd-fork'` 标记隐藏叉子会话——**在新宿主上该头无法通过校验，
叉子会话将无法被读回**（fail-closed，原始文件不损坏，但会话被永久挡住）。

修复两层：

- `createSeededSession()` 在新宿主只透传 `origin: 'subagent'`，`'vtd-fork'` 不进 header；
- 隐藏语义改由本地登记簿承载：在 `createBranchChild()` 源头写入 `hidden: true`，
  并把登记簿同步改为「隐藏只增不减」，同时新增 `applyLocalForkHidden()` 供 debug 列表补齐。

> 备选方案（未采用）：把叉子标记为 `origin: 'subagent'`。该校验通过，且能借助 DSH 原生的
> 子会话归组达到「不占侧栏」的效果，但会改变这些会话在 DSH 侧的呈现语义，属产品决策，留待作者定夺。

## 三、客户端侧：一处真实破坏（先前判断有误，已更正）

初版记录写的是「客户端无需改动」——**那是错的**。复核 DET 实际注册的 5 个 slot 后
发现一个漏网断点：

| DET 使用的 slot | 0.1.5 是否存在 |
|---|---|
| `shell.overlay` | ✅ `dsh-client-ui-layout` 仍渲染 |
| `conversation.input.left` | ✅ `dsh-client-ui-conversation` 仍渲染 |
| `conversation.view` | ✅ |
| `settings.section` | ✅ 4 个包在用 |
| `conversation.chat.user-actions` | ❌ **已被移除** |

新版 `conversation.chat.*` 只剩四个：`assistant-actions` / `commandview` / `node` / `turnTail`。

**影响**：DET 的「消息操作条」（编辑 / 重试 / `<N>` 分叉选择）会**静默不渲染**——
不报错，只是看不见，属最难发现的那类回归。

**修复**：新增 `conversation.chat.assistant-actions`
（`renderSlot(..., { messageId })`，并被原样传进原生 `MessageIconActions` 的 `extraActions`）。
挂载期无法先问宿主版本（注入发生在 apply 阶段，早于 `detFeatureGet` 返回），
故**两个槽都注入**：本宿主不认识的那个要么被槽注册器拒绝（已 catch），要么永不被渲染。
另补：新槽只传 `{ messageId }`，而 `UserActions` 依赖 `props.sessionId`，已在回调里用
`getSessionId()` 兜底。

> 这一处正是「新版本缺少部分的，DET 在 DSH 原生进行改进」的入口：
> 新槽与原生 branch 按钮同在 `MessageIconActions` 的 `extraActions` 位上，
> 后续可直接接管/联动原生分叉入口。

### 连带修掉的两个隐患

**① `refreshNav` 的硬门闩（新槽上会让 `<N>` 分支选择器永不显示）**

原实现：`if (!sessionId || seq === undefined) return;`

而新槽 `assistant-actions` **只传 `{ messageId }`，没有 `seq`** —— 于是即便槽挂上了，
分支选择器也会静默消失（不报错）。下面那句 `find` 本来就有 `m.messageId === messageId`
的兜底匹配，门闩却先把路堵死了。已放宽为「seq 与 messageId 任一存在即可」。

**② 助手侧不应出现「编辑」**

`编辑并重发`是**用户消息**的动作；挂在 `assistant-actions` 上语义不对。
与其复制一份组件，给 `UserActions` 加了 `mode`（`'user'` / `'assistant'`）单一代码路径：
助手侧只给 `<N>` 分支导航 + 重试（在此处建新叉）——恰好补上原生分叉按钮在
`branchUnavailable`（非最新轮次）时禁用所缺的能力。

> 实现细节：`for (var si ...)` 是函数级作用域，直接在槽回调里读
> `MSG_ACTION_SLOTS[si]` 会让所有槽都拿到最后一次循环的值（`mode` 接线错误的经典成因），
> 故用 IIFE 捕获每个槽的 descriptor。

### 原生分叉的能力边界（DET 补齐的部分）

`dsh-client-ui-chat` 的 `TurnTailNodeView` 里：

```js
onBranch: () => { forkAt(closing.finalNode.seq); },
branchUnavailable: data.branchUnavailable || hasLaterChatNode,
```

**原生只允许在最新轮次分叉**（存在更后的 chat node 即 `branchUnavailable`），
历史消息一律无法分叉。DET 侧 `editMessage` / `retryMessage` 本就等价于「在此处创建新叉」，
且不受该限制 —— 这正是「原生不完善处由 DET 改进」的落点。

## 三之二、客户端入口不变的部分

DET 的 client 是自包含的 `window.__ModuleLoader__.load` bundle，除 `react`/`react-dom`
外无外部 import——已被移除的 `dsh-client-runtime`（alpha.2 API-10）不影响它。
`ctx.slots` / `ctx.sessions`（`fork({increaseTitle})`、`binding()`、`open()`）/
`ctx.workspaces` / `ctx.remote` / `ctx.on` / `ctx.effect` 在 0.1.5 上均在。

## 三之三、版本感知能力层（lib/host.js）

DET 现在是**版本感知**插件：同一份源码在旧宿主（0.1.1-rc.2）与新宿主（0.1.5-rc.1）上
都能跑，并按宿主实际能力分流：

- 新宿主已原生**完善**支持的功能 → DET 卸载自己的实现
- 新宿主原生**不完善**处 → DET 改进/接管
- 旧宿主 → 保留 DET 全部既有能力

**判定原则**：一律做能力探测，不硬编码版本号。0.1.1→0.1.5 跨三条线
（0.1.2 / 0.1.3 / 0.1.5），任何中间版本都可能落在任意组合上，只有
「这个 API 现在在不在」是可靠判据；版本号仅用于诊断展示。

探测分三层，任一层失败不影响其余层：

1. **模块面** —— 动态 `import @deepseek-ai/dsh-session`，直接看 `Session.prototype`
   上有没有 `snapshotEvents` / `ownEvents` / `eventAt` / `seq` / `events` 访问器。
   不依赖任何服务就绪，最可靠。
2. **服务面** —— 经 ctx 取 `sessionPersistence` / `sessions` 看实例方法。
3. **派生** —— `modern` / `legacy` 归类 + 功能归属表。

**回归陷阱（已填）**：`apply()` 阶段 `sessionPersistence` 常常尚未就绪，
此时能力层无权对「持久化形态」下结论。加了 `serviceFaceProbed` 门闩：
未就绪时回落到实例鸭子类型，否则会把新版宿主误判成旧版并走错分支。

**功能归属登记表** `FEATURE_REGISTRY`：每个 DET 功能键（对齐管理器的
`det.features`）标注 `keep` / `enhance-native` / `uninstall-on-modern`。
⚠ 其中「新宿主已完善支持」属**产品推断**而非宿主事实，集中在
`lib/host.js` 一处，作者改这里即可整体调整。

**门禁落地方式**：`detFeatureGet` / `detFeatureSet` 返回时经 `applyHostGating()`
叠加能力层结论，**不写回存储** —— 用户原本的开关值原样保留，于是降级回旧宿主时
这些功能自动恢复（即「旧版本启动则保留」）。`detFeatureSet` 同时拒绝重新打开
已被卸载的功能。前端把这类键渲染成只读的「原生已提供」行，而非可切开关。

## 三之四、播种会话必须带 `session/end-seed` 标记（端到端验证抓到的真实 bug）

单元测试只验证了 `createSeededSession` 的**调用次序**，跑不出格式语义。改用**真实的
0.1.5 后端**跑一遍再读回，立刻暴露一个会破坏功能的问题：

```
released v2 seeded Session lacks an inherited end-seed marker
```

**根因**：新版要求播种会话在切点投影出一个 `session/end-seed` 标记事件。
`Session` 构造函数会自己做这件事，但 DET 是直接经 `SessionHandle.append()` 写日志的，
**绕过了构造函数** —— 标记从未被写入，于是**建出来的 VTD 分叉会话根本读不回来**。

**修复**：`createSeededSession()` 在写完种子后追加标记：

```js
await handle.append([{
  type: "session/end-seed",
  seq: events.length,          // 切点 = 继承前缀长度
  time: Date.now(),
  data: { inherited: true },   // ← 必须是这个形状
}]);
```

`data` 的形状不是猜的，来自 `dsh-session-format-v1-to-v2` 的 `finish()`：

```js
if (event.type === "session/end-seed") {
  if (jsonRecord(event.data, ...)["inherited"] === true) inheritedEventCount = event.seq;
}
```

只有 `data.inherited === true` 才会把该事件的 `seq` 记作 `inheritedEventCount`；
写成 `{}` 会继续报「lacks ... marker」。

**端到端验证结果（18 项全通过）**：用真实后端 `createSeededSession()` 建会话 → 读回
→ `isSeeded=true`、`inheritedEventCount=种子长度`、`parentSession`/`delegationDepth`/
`agentPreset`/`cwd` 均保留、`vtd-fork` 与 `seedLength` **未**进 header、seq 连续、
内容保留、空种子路径亦正确（`isSeeded=false`）。

> 顺带确认的另一条新版硬约束：**产生消息的事件必须带 `surfaceOp` 标记**
> （缺它报 `user/message at seq 1 requires a surfaceOp marker`）。真实场景下种子取自
> 父会话的 `snapshotEvents()`（已是当前格式、自带该标记），故 DET 无需特殊处理；
> 但这条约束意味着**不能把旧格式事件直接塞进新宿主的新会话**。

## 三之五、主界面 UI 适配（0.1.5 布局变动）

### 1. 右侧 Sidebar 与 DET 浮动控件重叠（布局冲突）

0.1.5 新增的右侧 Sidebar 是 **push 模式的布局列**：

```js
<div className={panel}
     style={{ width: fullscreen ? "100%" : width }}
     data-sidebar-right-panel={fullscreen ? "fullscreen" : "push"}
     data-sidebar-right-open={expanded || undefined}>
```

```css
.P3OORG_panel{z-index:10;position:absolute;top:0;bottom:0;right:0;transform:translate(100%)}
.P3OORG_panel[data-sidebar-right-open]{transform:none}
.P3OORG_panel[data-sidebar-right-panel=fullscreen]{z-index:40;position:fixed;inset:0}
```

展开时它占据右边缘并**挤压对话区**。而 DET 的三个浮动层原本一律贴右边缘
（工具栏 `right:10px`、面板 `right:64px`、状态框 `right:14px`），且 DET 的
z-index 是 9990+，远高于 Sidebar 的 10 —— **会直接盖在它上面**。

**修复**（纯客户端自适应，不改宿主）：`mountLayoutSync()` 测量已展开面板的宽度，
写入 CSS 变量 `--dset-inset-right`，三个浮动层改用
`right:calc(<原值> + var(--dset-inset-right,0px))`；面板全屏时整体让位
（`html[data-dset-sidebar-fullscreen="1"] .dset-toolbar,...{display:none}`）。

两个实现要点：

- **只在该面板确实贴住右边缘时才算占位**（`|innerWidth - rect.right| <= 2`），
  否则动画中途/浮层宿主会被误判，把 DET 无谓推开；
- 用 `MutationObserver` 观察 `data-sidebar-right-open` / `data-sidebar-right-panel`
  两个属性（面板常驻挂载、靠属性切换显隐），**刻意不监听 `style`/`childList`** ——
  本页流式渲染频繁，那些会过于嘈杂；面板宽度另用 `ResizeObserver` 单独盯住。
  变量缺省值 `0px` 保证未设置时与原行为逐像素一致。

### 2. 消息操作行（DET 注入 `assistant-actions` 处）

原生行规格：`height:calc(28px + var(--dsh-content-font-delta,0px)); gap:8px`，
且非最新轮次默认 `opacity:0`、悬停才显示。

DET 原按钮为 26×26、容器 `min-height:26px` —— 差 2px，视觉上就是「没对齐」。
已改为 **28×28**，容器 `min-height` 跟随原生的 `--dsh-content-font-delta`
（0.1.2 起支持会话流字号调节，DET 控件应一起缩放），并去掉多余的 `padding:0 4px`
（原生行已有 `gap:8px`，额外的内边距会让基线错位）。

### 3. `conversation.view` 不再传 `sessionId`（**功能性断裂**，伪装成 UI 变动）

0.1.5 的 view 槽只传三个属性：

```js
renderSlot("conversation.view", {
  viewRequest,                 // { view, focus } —— 不含会话身份
  openView,
  completeViewRequest,
}, { only: active.id })
```

而 DET 的 VTD 树视图靠 `props.sessionId` 加载数据 —— **缺它就是 undefined，
树视图拿不到会话**。这是本次 UI 排查里唯一真正的功能性问题。

**修复**：改用 DET 自己的 `getSessionId()` 兜底（读客户端
`ctx.sessions.list.getSnapshot().current`，与工具栏同源）。注意兜底必须写在
`Object.assign(target, props)` **之后** —— 若 `props` 里存在同名键且值为 undefined，
先放进 target 再赋才不会被覆盖回去。

同批核查：`conversation.input.left` 在新版是**空 props** 渲染、`settings.section`
只传 `{ close }`（均不含 `getSessionId`）。逐一确认 `WebPermInline` 与
`DetManagerSection` 都**不依赖**会话身份；`GlobalPluginsSection` 确实需要，而它的注册
本就显式传了 `getSessionId`，无需改动。

### 4. 主题变量：全部健在

DET 使用 27 个 `--dsw-*` 变量，逐一比对 0.1.5 客户端包（可见变量 367 个）——
**27/27 仍被定义**，0 缺失。故配色/边框/阴影无需任何改动，问题纯属布局。

### 5. 视觉语言对齐（作者反馈「不够美观」后的整改）

布局修好后作者反馈「不够美观」——即功能没问题，但**风格与新版主界面不搭**。
根因与整改：

| 项 | 改前 | 改后 |
|---|---|---|
| **字体** | `ui-monospace, Consolas, "Courier New", monospace`（整个界面等宽） | `var(--dsw-font-family)`（与主界面同源无衬线）+ `font-variant-numeric:tabular-nums` 保证数字列对齐 |
| **代码类元素** | `font-family:inherit`（原本靠根字体恰好是等宽） | `var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)` —— ⚠ 改根字体后**必须**补这一步，否则代码块会变成比例字体 |
| **工具栏** | 5 个 48px 宽、带边框、图标+11px 常驻文案的独立按钮 | 胶囊容器（`border-radius:999px` + `--dsw-shadow-lv2`）内嵌 36px 圆形无边框按钮，悬停才显 `--dsw-alias-interactive-bg-hover`；文案改由按钮**已有**的 `title`/`aria-label` 承担（可发现性不受影响） |
| **面板** | `border-radius:10px` + 硬编码 `0 8px 30px rgba(0,0,0,.35)` | `12px` + `var(--dsw-shadow-lv3)` |
| **过渡** | 硬编码 `.24s cubic-bezier(.4,0,.2,1)` | `var(--ds-transition-duration-slow) var(--ds-ease-in-out)` 等令牌 |

这些令牌都来自 `dsh-client-ui-theme`（`--dsw-font-family` / `--dsw-shadow-lv1..3` /
`--ds-transition-duration{,-fast,-slow}` / `--ds-ease-in-out`），故会随主题（含深浅色切换）
自动跟随，而非写死颜色。

**未做**：工具栏图标目前仍是 emoji（🧩 ▶ 🗎 🕘 🛡），新版原生用的是单色 SVG 线性图标
（如 `IconBranchOutline16`）。换 SVG 需手写 5 条路径，路径写错会比 emoji 更难看，
故留待作者确认后再动。

### 6. 依据真实截图的整改（本机浏览器扩展无法截图时的取证办法）

浏览器扩展的 `screenshot` / `run` 在本机会话中持续超时（档位不允许执行脚本），
故改为**让作者贴图 + 用 sharp 裁剪放大局部**来取证 —— 这是我第一次真正看到界面。
`_archive/det-verify/crop-ui.mjs` 用一个 `extract` + `resize(kernel:nearest)` 的小脚本
把截图按区域切开放大。

看到的问题与整改：

| 现象 | 整改 |
|---|---|
| 工具栏三个图标**风格完全不同**：彩色拼贴画（🧩）、深灰实心（🕘）、细线框（🛡） | 全部换成**单色线性 SVG**（描边式，`stroke:currentColor`），因此会随深浅色主题自动变色 |
| **状态框压住输入框的发送按钮**（蓝色圆被盖住一半） | 用新版提供的 composer 锚点 `[data-composer-card]` / `[data-composer-seat]` 量出底部占位，写入 `--dset-inset-bottom`，状态框改为 `bottom:calc(14px + var(--dset-inset-bottom,0px))` 悬在输入框**上方** |
| 状态框子元素是 `pointer-events:auto` | 同上 —— 这不只是难看，**还会挡住发送按钮的点击**，属功能问题 |

SVG 路径**不是凭记忆写的**：先用 sharp 把 5 个候选图标渲染成一行 PNG、深浅两种底色各来一遍，
确认路径正确且风格统一后才写进插件（`_archive/det-verify/icon-probe.mjs`）。

**仍未做**（都已定位，待作者定夺）：

- 面板内部的装饰性 emoji 仍不统一（文件树的 📂/📁/🗎、MDA 的 🏠/🗂/🤝/🤖、按钮的 ➕/🗑/✎/🔍）。
  状态符号（✓ ✗ ⚠）属约定俗成，建议保留。
- **DBS 音乐播放器浮在正文之上**（截图中遮住了表格文字）—— 属 `dbs` 插件，不在本次 DET 范围。

### 7. 第二轮截图整改：与新版「回合导航轨」的冲突

作者反馈「有恶心的 UI 重叠」后拿到第二张截图。这一次不再靠眼估 ——
**直接对截图做像素扫描**（`_archive/det-verify/measure-edge.mjs`：`sharp().raw()` 逐像素找深/浅色区段），
量出各元素距右边缘的真实距离（设备像素比由「旧胶囊 46 CSS px ↔ 实测中心距 43.5 设备 px」反推 ≈1.318）：

| 元素 | 距右边缘（CSS px） |
|---|---|
| 正文右缘 | ≈104 |
| **新版「回合导航轨」** | **19.7 – 32.6** |
| 旧 DET 胶囊（46px 宽，`right:10px`） | 10 – 56 ← **横跨在轨道上** |

**根因是算术，不是手感**：旧胶囊宽 46px（36px 按钮 + 5px 内边距×2），
而正文右缘到导航轨之间只有约 71px（104 − 32.6），扣掉轨道本身后留给浮动控件的
**净空隙只有约 52px** —— 46px 塞进去只剩 3px 边距，怎么摆都会压住一边。

**整改**：

| 项 | 改前 | 改后 |
|---|---|---|
| 工具栏按钮 | 36×36 | **28×28** —— 与原生 `.P3OORG_iconButton{width:28px;height:28px}` 完全一致 |
| 胶囊内边距 | 5px | 4px（胶囊总宽 46 → **36px**） |
| 工具栏右偏移 | `10px` | **`38px`**（胶囊落在 38–74px：左边离正文 30px、右边离导航轨 5.4px，**两边都不压**） |
| 面板右偏移 | `64px` | `86px`（开在工具栏左侧 12px 处） |
| 图标尺寸 | 19px | 16px（适配 28px 按钮） |

### 8. 右下角：topo 的「偷跑」胶囊压在 DET 状态卡上

DET 状态框子元素是 `pointer-events:auto`，被压住的不只是观感 —— **还会挡住点击**。

根因在 **topo** 侧：它把锚点选成了状态卡**内部**的 MMS 开关

```js
var anchor = document.querySelector(".dset-statusbox .dset-switch") || ...;
```

于是把自己贴到了卡片**里面**（白底压白底）。改为锚定整张卡片：

```js
var anchor = document.querySelector(".dset-statusbox");   // 贴卡片左外侧,不再落进卡内
```

> ⚠ 这处改的是 `C:\Users\L2959\Desktop\项目\TOPO\lib\client.js`（另一个插件），不在 DET 仓库内。

## 四、验证

已验证（10 层 / 145 项断言，全部对**真实**包运行）：

| # | 层 | 断言 | 覆盖内容 |
|---|---|---|---|
| 1 | 语法 | 9/9 文件 | `node --check` 全部 host/client 模块 |
| 2 | 兼容层 | 25 | 旧/新事件读取、getter 抛错回退、`SessionHandle` 调用次序、header 形状、`vtd-fork` 不进 header、旧路径原样透传 |
| 3 | 树边存储 | 21 | 边读写/同 branchId 去重/跨会话隔离/合成事件被 `deriveTree` 消费/取边抛错安全退化/**新宿主不写会话日志、旧宿主仍写** |
| 4 | client bundle | 17 | 桩化 `window.__ModuleLoader__` 真跑 factory 与 `apply()`：注册 10 个槽、新老消息操作槽 id 不冲突、**`conversation.view` 缺 `sessionId` 时的兜底**（空 props 填上 / props 自带时优先） |
| 5 | 分叉端到端 | 18 | 用真实后端建播种会话→读回：`isSeeded`/`inheritedEventCount`/header 字段/vtd-fork 排除/seq 连续/空种子路径 |
| 6 | host 激活路径 | 13 | 真实 Cordis Context 下调 `apply(ctx, config)`：**75 个端点 + 24 个工具**注册成功，每项都能定位到真实服务方法 |
| 7 | 功能门禁（指令 2 出口） | 15 | 真调 `detFeatureGet`/`detFeatureSet`：新宿主 `file=false` + `nativeProvided={file:true}`、`host` 走廊诊断、**重新开启被拒**、其它开关不受影响、**门禁不写回存储**（降级回旧版自动恢复） |
| 8 | 端点行为（`treeView`） | 11 | 真调 `treeView`：存储的树边出现在 `forks`、`activeBranchId` 由 `state` 正确派生、字段透传、`messages` 从会话日志派生、错误路径 |
| 9 | 旧宿主回归（指令 2 的「旧版保留」要求） | 14 | 在**旧包集**下真跑 `apply` + 端点：走廊判为 `legacy`、`nativeProvided={}`（不卸载任何功能）、`file` 保持 `true`、`appendLink` **仍写 `conversation/link` 且不碰自有存储**、`treeView` 正常派生 |
| 10 | **右侧 Sidebar 自适应** | 11 | 桩化 DOM 跑 `apply()`：收起→`0px`、展开 push→让出实际宽度、**未贴右边缘时不误推**、全屏→标记让位；并核对三处 CSS 确实消费该变量 |

另有宿主侧能力探测的双宿主实测（旧/新包集下判别正确）与升级脚本守卫实测（会话内运行被拒）。

> ⚠ 第 9 层依赖一份 0.1.1-rc.2 的包集。升级会覆盖全局安装，届时该层需指向独立保留的旧包目录
> （`_archive/dsh-old-011rc2`），否则会退化成「用新包跑旧断言」而误报失败 —— 这是环境问题，非代码回归。

> 方法论教训：前两层用桩即可，但第 4/5/6/7 层必须跑真实对象才有效。
> 其中第 5 层（分叉端到端）抓到过「播种会话缺 `session/end-seed` 标记」这一
> 会静默破坏功能的 bug —— 桩测试当时是全绿的。

尚未验证（需升级宿主后补）：

- 真实宿主冷启动、entry activate、VTD 分叉端到端
- 会话日志 v0→v3 迁移（**升级前务必备份 `~/.dsh/sessions`**；升级后的会话不支持降级读取）

## 五、升级与回滚

宿主升级必须由**外部终端**执行（会话即宿主进程，在会话内升级会中途打断安装）。
脚本：`C:\Users\L2959\.dsh\upgrade-dsh.ps1`（含 DSH_* 守卫、进程停机、会话备份、重启与核验清单）。

```powershell
# 外部终端
powershell -ExecutionPolicy Bypass -File C:\Users\L2959\.dsh\upgrade-dsh.ps1 -CheckOnly
powershell -ExecutionPolicy Bypass -File C:\Users\L2959\.dsh\upgrade-dsh.ps1
```

回滚：

```powershell
npm install -g @deepseek-ai/dsh@0.1.1-rc.2     # 宿主
git -C C:\Users\L2959\.dsh\.agent-presets\dsh-essential-tools\upstream checkout .   # DET 源码
```

## 六、`conversation/link` 与 v0→v3 迁移：一次真实的数据可用性事故

更新到 0.1.5 前，用**新版真实持久化后端**逐个读本机会话：**64 成功 / 7 失败**。
其中**因 `conversation/link` 失败的是 5 个**（不是 4 个 —— 先前统计有误，见下方「统计修正」）：

```
session-065c424a…  format v0 contains unknown historical event type "conversation/link"
session-7a5dba57…  … at seq 66044
session-1cbbb743…  … at seq 341865
session-3abfbfda…  … at seq 341865
                   migration refuses unknown historical events even when ignorable
```

### 统计修正

最初用后端 `list()` 扫描时，我把 7 个失败归为「4 个是本插件造成的 + 3 个是宿主问题」。
改用**帧级扫描**（逐帧解压找 `conversation/link`）后修正：**含该事件的是 5 个**。
被漏掉的是 `session-d27f7cc5` —— 它**同时**有 `conversation/link` 和
`unclassified message source`，迁移器先报后者，把前者盖住了。

教训：按「错误信息」分类会漏掉多重归因的样本；要按「特征是否存在」独立扫描。

### 根因

`conversation/link` 在 0.1.1-rc.2 自己的 `KNOWN_SESSION_EVENT_TYPES` 里**是合法类型**，
插件当时写它没有任何问题。但 0.1.5 的 v0→v1 迁移器不认识它，且**明确拒绝**：

> The persistence read path refuses to interpret a log containing a type outside this set
> **unless the event carries the envelope's `ignorable` marker** …
> Downstream (out-of-repo) **plugin events are outside this list by construction**.

而 v0 迁移路径更进一步：**即使带 `ignorable` 也拒绝**（"even when ignorable"）。
更棘手的是，新版 `Session.append(type, data, ...opts)` 只从 opts 读
`sourceEventSeqs` / `surfaceOp` 两个键，**根本没有传 `ignorable` 的入口**。

**结论**：在新宿主上继续写 `conversation/link`，会让父会话变成读不回来的会话。

### 已实施的修复（前向）

树边改为存进**本插件自己的存储域**（复用已有的 `settings` 表，键
`det.branchEdges.<sessionId>`，刻意不动域 schema 以免引入迁移风险）：

- `appendLink()` 按宿主分流：新宿主写自有存储、**绝不写会话日志**；旧宿主行为不变
- 读取侧把自有树边**合成为等价的 `conversation/link` 事件**注入事件列尾部，
  使 `deriveTree` 与全部 7 个调用点零改动、对树边的两种来源透明

判据用「会话是否仍暴露旧式 `events` 数组」（`hasLegacyEvents()`），**不能**用
`sessionEvents() === null` —— 新宿主会话有可用的 `snapshotEvents()`，会返回正常数组，
用它判会得出相反结论并去调并不存在的 `session.append`。

### 未解决：既有 4 个会话的抢救

原始 v0 文件**未被破坏**（fail-closed，源件保持原样），备份也在，但暂时打不开。
已排除的路径：

| 尝试 | 结果 |
|---|---|
| 逐行剥离 `conversation/link`（纯文本） | ✗ `seq gap (expected 118168, got 118169)` |
| 剥离 + 按行重编号（正则） | ✗ 键序不固定时正则失配，空洞依旧 |
| 剥离 + JSON 解析后重编号 | ✗ 给**不带 seq 的附属行**（`reasoning-chunks` / `tool-call-chunks` / `text-chunks`）硬加了 seq |
| 只重编号带 seq 的行 | ✗ `expected 297, got 18` —— **`seq` 根本不是行号** |
| 旧后端读 → 旧写入器写干净 v0 → 新迁移器读 | 读成功（4/4，seq 重建后**完全连续**），写失败（落盘 0 文件） |

关键发现：**文件里的行会被读取器展开**——12,526 行里有 9,017 行是不带 `seq` 的
附属行（`reasoning-chunks` 等），它们在校验时被展开成大量事件；文件里显式 `seq`
指向的是**重建后的流**（读到 229,489 个事件、seq 0…229488、**0 处不连续**），
不是行号。所以按原始行重编号从根上就是错的。

旧写入器这条路也不通：`create`/`append` 只进 `PersistenceCoordinator` 缓冲，
落盘依赖活会话树（`ctx.sessions.prepare`），独立驱动不成立。

**可行的方向**（未实施）：

1. 用**旧宿主进程本身**（0.1.1-rc.2）把会话另存为不含 `conversation/link` 的新会话
   —— 让官方写入器负责全部 seq 语义；
2. 或把该迁移缺口作为上游 issue 报出（`conversation/link` 曾是**已发布版本**的合法类型，
   却让日志在新版永久不可迁移，看起来是上游迁移器的缺口而非纯插件问题）。

### 已实现并验证的抢救方案：帧边界截断

思路与前面全部失败路径的区别：**不做任何行级改写，只在 zstd 帧边界截断**。
截断后仍是原文件的**字节前缀** → 重建出的流是原流的合法前缀 → seq 天然连续，
因而绕开了「重编号语义」「chunk provenance」「附属行展开」等所有不变量问题。

脚本：`~/.dsh/rescue-sessions.mjs`（默认 dry-run，`--apply` 才写入且先自动备份）。
实测结果（对副本运行，用 0.1.5 后端复验可读性）：

| 会话 | 截断点帧数 | 保留内容 | 截断后可读 |
|---|---|---|---|
| `065c424a` | 10046 | 57% | ✓ 795 事件 |
| `7a5dba57` | 3532 | 92% | ✓ 523 事件 |
| `1cbbb743` | 16659 | 98% | ✓ 1713 事件 |
| `3abfbfda` | 3 | 0% | ✗ link 在唯一的内容帧里，截断等于清空 |
| `d27f7cc5` | 17262 | 99% | ✗ 仍有独立的 `unclassified message source` 阻断 |

**3 / 5 可救，且是有损的**（`065c424a` 会丢 43%）。因此脚本默认只体检不写入，
取舍留给作者决定 —— 若更看重完整内容，替代做法是保留一份 0.1.1-rc.2 安装专门回读。

> 也试过把截断点从**帧**边界推进到帧内的**行**边界（保留内容更多，理论上更通用），
> 但对本机这组数据**没有增加覆盖**：仍然 3/5，且读出的事件数完全相同
> （795 / 523 / 1713）。原因是两个失败样本的问题都不在截断粒度上 ——
> `3abfbfda` 的 link 就落在其唯一内容帧的**第一行**（截断等于清空），
> `d27f7cc5` 另有独立的 `unclassified message source` 阻断。负结果，记录以免重复尝试。

### 读取真实日志的两个陷阱（工具链教训）

排查中连续两次因**探测器本身失效**而得出错误的「无风险」结论：

1. 明文 grep —— 会话是 `.jsonl.zstd` **压缩**的；
2. 以为修好了 —— 但 **Node 的 zstd 只解第一帧**，某文件单个压缩包里其实有
   35,913 个帧。

最终按 RFC 8878 自写帧解析（magic → Frame_Header → Block 链 → 可选 checksum），
在真实文件上验证到 **帧数 10,046 / 解压失败 0 / 字节 100% 覆盖**。

**教训**：阴性结论必须建立在「探测方法本身已被验证有效」之上——当真实事件类型
连 `turn/start`、`user/message` 都统计为 0 时，那不是「没有风险」，而是探测器没在工作。

## 七、残留风险 / 待确认

1. `package.json` 声明的 DSH cohort 仍是 `^0.1.1-rc.2`。因 npm 的 prerelease 区间语义，
   它并不匹配 `0.1.5-rc.1`；但该包实际由宿主自身解析（`upstream/node_modules` 为指向全局
   安装的 junction），故不影响运行，仅属声明面待整理。
2. DET 自身 SemVer 未动。发版时应随兼容改动单独升版（建议 2.5.0）。
3. 若 DET 的本地登记簿被清空，新版宿主上叉子会话会恢复为「可见」（header 已无法承载标记）。
4. `applyLocalForkHidden()` 仅覆盖 debug 列表；用户可见的侧栏/CDM 走登记簿同步路径，已由
   「隐藏只增不减」覆盖。

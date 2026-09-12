# DET 修改指导 (dsh-essential-tools)

> 面向 **AI / 开发者**：改哪个文件、按什么顺序改、改完怎么验。
> 配套阅读：`AI_GUIDE.md`（现状 + 契约清单 + 安全不变量）、`DET功能.md`（功能清单）、`DET运行思路.md`（数据流）。
> 永久插件：**宿主改动需重启 DSH；客户端改动需重建/强刷**。

---

## 0. 三条铁律

1. **改前先读 `AI_GUIDE.md` §4**：那里列了 5 个"看起来像 bug 其实是对的"的契约，照着"修"会把好代码改坏。
2. **端点必须进 `METHOD_NAMES`**；模型工具必须 `defineTool` + `tools.register`。两者独立。
3. **不要用 PowerShell 改这些文件**（本机是 PS 5.1，默认 ANSI 读写，会破坏 UTF-8 中文）。用编辑工具。

---

## 1. 本机路径与生效方式

```
包根   C:\Users\L2959\.dsh\.agent-presets\dsh-essential-tools\upstream
junction C:\Users\L2959\.dsh\profiles\node_modules\dsh-essential-tools → 上面的 upstream
注册   C:\Users\L2959\.dsh\profiles\web\cordis.yml   (id: dsh-essential-tools)
配置   C:\Users\L2959\.dsh\profiles\web\cordis.patch.yml
```

| 改了 | 生效方式 |
| --- | --- |
| `lib/index.js`、`lib/*.js`（宿主） | **重启 DSH** |
| `lib/client.js`（浏览器） | 重建 / 强刷（`pnpm run dev:web` 开着才 HMR） |
| `browser-extension/*` | 在 Edge/Chrome 里重新加载扩展 |
| `plugin/*.js` | 该会话重新 `cordis_define` + `cordis_run` |

> `profiles/web/cordis.patch.yml` 属于**用户 profile**，不在仓库内，改它不算改插件。

---

## 2. 加一个宿主端点

```js
// lib/index.js — EssentialToolsService 内
async myEndpoint(args) {
  const sessionId = args && args.sessionId ? String(args.sessionId) : "";
  if (sessionId === "") return { ok: false, error: "缺少 sessionId" };
  // 可选服务一律 ctx.get() + 缺失安全降级
  const fsSvc = this.ctx.get("fs");
  if (!fsSvc) return { ok: false, error: "fs 服务不可用" };
  return { ok: true, ... };
}
```

1. 方法体如上。
2. **把 `"myEndpoint"` 加进底部 `METHOD_NAMES`**。
3. 客户端 `call("myEndpoint", { sessionId })`（`makeCaller` 已处理双重 `args`，**你只管传 payload**）。

返回约定：成功 `{ ok: true, ... }`；失败 `{ ok: false, error: "可读中文" }`。**不要在失败时返回 `ok:true`**。

---

## 3. 加一个模型工具

```js
const tool = defineTool({
  name: "det_my_tool",
  description: "给模型看的一句话说明（写清副作用与风险）。",
  parameters: { q: { type: "string", required: true } },
  output: { schema: { type: "string" }, render(_a, v) { return [{ type: "text", text: v }]; } },
  async execute(args) { return await this.myEndpoint(args); },
});
tools.register(tool);
```

要点：
- 工具名唯一（先看现有 25 个 `defineTool`）。
- 需要让模型"知道有这功能"时，用 `sp.section()` 注入系统提示（参考 `registerWebPermPrompt`）。
- 开关关闭时要**彻底隐藏**工具与提示（参考 MMS 的装载/卸载）。

---

## 4. 加一个功能开关（`det.features`）

1. 宿主 `normalizeFeatures` 加字段，默认 `false`。
2. `detFeatureSet` 的 `keys` 数组加该字段。
3. 客户端：模块级 `detFeatures` 默认值 + `DetManagerSection` 的 `toggleRow` 各加一行。
4. 需要运行时装载/卸载：挂进 `setDet` 的副作用（`_syncDetRuntimeFeatures` 是范例）。

> **总开关（`master`）是这些分项之上的总闸**，不是普通开关：
> - 宿主：`_syncMasterFeatures()`（读持久化开关）→ `_loadExtension()` / `_unloadExtension()`；
>   所有扩展注册都必须登记 disposer 并**由 `_loadExtension` 统一 push 进 `_extDisposers`**
>   （三个 `register*` 函数内部用 `const reg = (t) => dis.push(tools.register(t))` 收集），
>   否则总开关关闭时会残留。新的运行时副作用同样要在 `_syncDetRuntimeFeatures` 里带 `masterOn` 判断。
> - 客户端：任何界面注入都要经 `extReg(key, register)` 登记（`wireExtension()` 里统一装配），
>   定时器/订阅放进 `startRuntime()` 的 `runtimeStops`；`setDet` 会调用 `masterWiring()` 按总开关装卸。
> - 加了新的注入点却忘了登记，就等于「总开关关不干净」——这是该功能唯一的红线。

---

## 5. 加 UI

| 位置 | 插槽 | 备注 |
| --- | --- | --- |
| 输入框左侧/右侧 | `conversation.input.left` / `conversation.input.right` | 用 `order` 定位 |
| 设置独立页 | `settings.section` | `id` / `order` / `label` |
| 设置单行偏好 | `settings.general.item` | 只放一行；网络权限已不用此位 |
| 浮动层（工具栏/状态框/MDA 侧栏） | `shell.overlay` | 容器 `pointer-events:none`，按钮上 `auto` |
| 消息操作条 | `conversation.chat.user-actions` | |
| 对话视图页签 | `conversation.view` | |

硬约束：
- **`React.createElement`**，不能用 JSX。
- **hook 只能在组件体内**调用。事件处理函数里调 hook 会抛 `Invalid hook call`（`VerPanel.restore` 曾如此，已修）。
- 颜色优先用主题变量：`--dsw-alias-bg-base` / `bg-layer-1` / `bg-layer-2` / `bg-overlay` / `border-l1` / `border-l2` / `brand-primary` / `label-primary` / `label-secondary` / `state-error-primary` / `state-success-primary` / `state-warn-primary` / `specific-sidebar-fill`。**不要硬编码色值**（明暗主题会失配）。
- 图标按钮要有 `title` + `aria-label`；展开类按钮加 `aria-expanded`。
- 破坏性操作（回退/删除/卸载/清空）必须 `window.confirm`。

---

## 6. 加/改存储域

```js
const DOMAIN_SPEC = defineDomain({
  name: "dsh_my_domain",
  version: 1,
  tables: { things: domainTable(z.object({ id: z.string(), at: z.number() })) },
});
```

- 读：`await domain.table("things").get(id)`（**同步返回**）、`domain.table("things").entries()`（迭代器，**没有 `.all()`**）。
- 写：`await domain.table("things").put(id, record)`；删：`await ...delete(id)`。
- 新增表无需迁移；域打开失败要 `openError` 安全降级。

---

## 7. 改完的验证清单

```powershell
cd C:\Users\L2959\.dsh\.agent-presets\dsh-essential-tools\upstream
node --check lib/index.js
node --check lib/client.js
node --check lib/global.js
node --check lib/ds.js
node --check lib/store.js
node --check lib/browser.js
node --check lib/mda.js
node --check lib/vtd/index.js
node --check browser-extension/background.js
```

1. 语法全过。
2. 宿主模块能加载（顶层无引用错误）。
3. 客户端 bundle 能完整执行（factory 冒烟）。
4. 重启 DSH / 强刷后按功能点实测。
5. `det_global_plugin_scan_installed` 确认插件仍 `active`。
6. 检查 `~/.dsh/storages/` 三个 json 是否正常写入。

---

## 8. 本轮审计已做的修复（v2.4.0 → 未发布）

**功能缺陷**
- `client.js` `VerPanel.restore`：`useDetFeatures()` 从事件处理函数提到组件体（**点「回退」不再抛 `Invalid hook call`**）。
- `index.js` `_defineForSession`：`row.packages` 缺失时不再抛 `TypeError`。

**安全加固**
- `_fetch`：加 `AbortSignal.timeout(15000)`（原先无超时可挂死）。
- `_fetch`：新增 `_hostResolvesPublic`——DNS 解析后再判私网，**补上 DNS rebinding 缺口**。
- `_fetch`：先看 `Content-Length` 再读 body。
- `ds.js`：余额/单价请求加超时。
- `verProgDelete` / `ensureDir`：`cmd.exe /c` 的路径**整体加引号**（原先含空格会拆参、含 `& | ^` 可注入）。

**清理**
- 删除死代码：`_webAllows`、`_isFullAccess`、`import { normalizeMode }`、`import { installRepoOf }`、客户端 `NL`、CSS `.dset-gp-badge-lock`。

**UI**
- 主题色令牌化：会话高亮 `#d4a017` → `var(--dsw-alias-state-warn-primary)`；状态框峰/谷色改用 `state-warn-primary` / `state-success-primary`。
- 全部图标按钮补 `title` + `aria-label`，展开按钮补 `aria-expanded`；`运行` 按钮在运行中 `disabled`。
- 新增 `:focus-visible` 焦点环。
- **Esc 关闭任意已打开面板**（监听器随组件卸载移除）。
- **MDA 伪侧边栏与原生 `SidebarRoot` 逐一对齐**（原生的真实标记见 `@deepseek-ai/dsh-client-ui-sidebar/lib/client.js` 的 `SidebarRoot`）：
  - 根元素 `className = hHd-Xa_root + [!wide && hHd-Xa_collapsed] + [!pointerInside && hHd-Xa_quietBars] + [wide && hHd-Xa_wide]`；
    **`hHd-Xa_quietBars` 靠 `onPointerEnter/Leave` + 2s 停留延时**驱动（指针不在栏内就不画滚动条）。
  - **宽度对齐原生**：展开 **280**（原生默认；`clampWidth(264,420)`）、收起 **56**（`sidebar === 0 ? 56`，= 10px×2 内边距 + 36px 按钮）。
  - **品牌行**：品牌按钮 = **新建会话**（不是折叠）+ `hHd-Xa_brandIdentity/brandMark/brandName`；折叠/展开按钮**常驻**（`hHd-Xa_iconButton hHd-Xa_toggle`，收起时先显示 `hHd-Xa_railMark`，悬停换成 `hHd-Xa_panelIcon`，由原生 CSS 切换）。
  - **新会话按钮**：展开/收起都渲染（收起时是 36px 图标按钮），标签用 `hHd-Xa_newSessionLabel hHd-Xa_wide`。
  - **底部**：`hHd-Xa_footArea > hHd-Xa_settingsArea >` 设置按钮（原生里 settingsArea 是容器）。
  - **列表区**：`hHd-Xa_regionArea > qDHVXG_list`（原生滚动条槽/边缘内缩/底部留白）；区头标签在原生模式显示「工作区」（与原生一致），分组模式显示「会话」。
  - 额外功能的位置：DET 自己的「分组模式切换」与「关闭 MDA 分组视图」**收进 logoRow 的「…」菜单**（原生 logoRow 只有品牌按钮 + 折叠按钮，这样外壳与原生完全一致）。「…」**仅展开态渲染**（56px rail 只放得下一个 36px 按钮）。
  - ⚠️ **菜单必须 portal 到 `document.body`**：`.hHd-Xa_logoRow` 带 `overflow:hidden`，就地 `position:absolute` 渲染会被**裁掉**（点了什么都看不见）。用 `ReactDOM.createPortal` + `position:fixed`（坐标由按钮 `getBoundingClientRect()` 算出）。
  - 菜单视觉照原生下拉菜单：背景 `var(--dsw-specific-menu)`、选项行 `min-height:38px / border-radius:10px / padding:6px 8px / gap:8px / font-size:14px`、分组标题 `padding:5px 8px 3px / 12px / label-tertiary`、勾选位 `flex:0 0 18px`；点外部或 Esc 关闭（监听器随 effect 卸载）。
  - **会话行动作对齐原生**：原生每个会话行在 `.YDXeBa_rowActions` 里只放**一个** `YDXeBa_iconButton`（`IconEllipsisOutline16`，悬停时替换 `YDXeBa_time`），动作走原生 `Menu` 组件（items = rename / fork / archive）。DET 照此把原来的 4 个并排按钮改成 **★ 高亮（独立、金色 `#d4a017`，`aria-pressed` 标记状态）+ 「…」菜单（重命名 / 分叉 / 归档）**——高亮是状态开关，需要一眼可见，所以不塞进菜单。
  - **底部设置按钮直接用原生类**：`VOzbGW_trigger`（+ 收起态 `VOzbGW_rail`），结构同原生 `TriggerContent`（图标 + `VOzbGW_triggerLabel`），不再自绘；点击委托给原生触发器（选择器用 `.VOzbGW_trigger:not(.dset-mda-foot)` 排除自己，否则会点到自己递归）。原生 `footArea` 常驻，所以收起态也渲染。

**浏览器扩展（实机验证时发现并修复）**
- **档位改动传不到宿主**：`popup.js` / `options.js` 原先**直接写 `chrome.storage.local`**，绕过了 `background.setMode`，而 background 没有 `storage.onChanged` 监听 → 宿主 `this.mode` 一直停在旧档。症状：**在弹窗里选了「启用」，`det_browser` 仍报 `ext-mode-off`**（只有 WS 重连才会带上新档位）。修复三处：
  1. `popup.js` / `options.js` 改为 `chrome.runtime.sendMessage({ type: "setMode" })`（走 background 的持久化 + 徽标 + `notify` 通知宿主）。
  2. `background.js` 增加 `chrome.storage.onChanged` 兜底：任何页面直接写 storage 也会同步模块级 `mode` 并 `notify` 给宿主。
  3. `background.js` 的 `ws.onopen` 改为 `loadMode().then(...)` 后再发 `hello`——原先发的是模块级 `mode`，service worker 冷启动时可能仍是默认 `"off"`。
- ⚠️ 改完扩展必须在 `edge://extensions` **重新加载**（或重启浏览器）才生效。
- **窗口被强制还原 + 抢焦点（用户实测反馈）**：`doFocusTab` 与 `readWithActivation` 都用 `chrome.windows.update(wid, { focused: true, state: "normal" })`。对**已最大化**的窗口，`state: "normal"` 会把它**还原成普通大小**（观感：页面突然缩小），`focused: true` 则让它**跳到前台**（观感：莫名置顶）。修复：
  1. 新增 `focusWindowPreservingState(windowId)`：**只有窗口是 `minimized` 时才补 `state:"normal"`**，否则只发 `{ focused: true }`。
  2. `doFocusTab` 与 `readWithActivation` 的 `doFocus` 改用它；`readWithActivation` 的 `restore()` 先记住原窗口 `state`，还原时按原状态还原（不再一律 `"normal"`）。
  3. `screenshot` 原先用 `captureVisibleTab(null)`，**只截当前可见窗口的活动页，与传入的 tabId 无关**——为了让截图落到目标页，调用方被迫先 `focus_tab`，于是触发上面的缩小/置顶。改为：优先 `chrome.tabs.captureTab(tabId)`（不激活、不动窗口）→ 目标页已是其窗口活动页则 `captureVisibleTab(windowId)` → 兜底只在该页所属窗口内切换活动页、截完切回，**全程不改窗口焦点/尺寸**。
- 核查结论：扩展内**没有任何 `tabs.remove` / `windows.remove` / `window.close`**，不会主动关闭标签页或窗口。若仍出现"意外关闭"，需要记录复现时的具体动作再定位。

---

## 9. 发布

见 `DET发布.md`。要点：
- `publish.ps1`（升版本 → 清备份 → commit/tag → push → npm publish → gh release）。
- **`browser-extension/` 不进 npm**（`.npmignore` 排除），需从仓库本机装载。
- 当前 `main` 领先 origin 4 提交、`v2.4.0` 未推未发。
- 发布前跑 §7 的 `node --check` 全套。

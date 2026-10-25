# Changelog

## v2.12.0 — 自愈式按需装载：工具不会再「自己没了」

用户反馈三条：「旧对话会自动卸载已经用过的工具」「有时 DSH 不会启用 ADU」「adu 下一轮才生效」。

### 根因（第一条是真 bug，不是错觉）

`_syncDetRuntimeFeatures()` 在按需模式下有一段**隐式卸载**：

```js
if (lazy && !mounted("alv")) this.alv.dispose();   // ← 旧实现
```

而这个函数会被**每一次 feature 变更、master 同步、模块装载之后**调用。叠加 v2.11.0 的
"恢复静默失效"（`aduModule` 忘了 import）：重启后 `_aduGroups` 是空的 → 之后任何一次同步
都会把 dlt/alv 卸掉 → 用户看到的就是"我用过的工具自己没了"。

### 修法：把"装着"变成**期望集合**，并让它自愈

| 机制 | 做法 |
| --- | --- |
| **期望集合** | `_aduWanted`（内存）+ `det.adu.mounted`（落盘）。装载=加入、卸载=移除，两者始终一致 |
| **不再隐式卸载** | 按需模式下 `_syncDetRuntimeFeatures` **只自愈、不 dispose**；装与卸只归 ADU 管 |
| **每步自愈** | 挂 `agent/pre-step`：每一步请求前比对 wanted 与已装，缺了就补。重启竞态、热重载、误卸都靠它兜回来 |
| **用过即钉住** | 挂 `tools/pre-execute`：某模块的工具被真正调用过一次 → 加入 wanted 并落盘。用过的工具从此参与自愈 |
| **面板自愈** | 打开 ADU 面板（`aduStatus`）也会顺手对齐一次，并回传 `wanted` / `drift` |
| **模式可查** | `detFeatureGet` 新增 `aduMode`（lazy / atLoad / boot / wanted / loaded），"有时不启用"不再靠猜 |

### 关于「下一轮才生效」

装配顺序是 `systemPrompt.assemble()`（**先**取工具快照）→ `agent/pre-step` → 建请求，
所以本步内挂载不可能改本步的工具表 —— 这是宿主结构，不是 DET 能绕的。但：

- 它**不是"下一轮"而是"下一步"**：同一轮里如果还有后续步骤（工具调用循环），新工具就会出现；
- `adu_load` 的说明已改成准确表述；
- 自愈保证"装过的东西"永远在下一次装配里，而不是等用户再问一遍。

### 测试

- `tests/alv-adu.test.mjs` 130 → **145**：源码守卫（不得隐式 dispose、必须有 pre-step 自愈 /
  pre-execute 钉住 / aduMode）+ 行为（wanted 记账、**清空 `_aduGroups` 后自愈补装**、
  调用一次工具即钉住并落盘）。
- 全量：128 + 60 + 23 + 47 + 17 + 37 + 22 + 40 + 71 + 10 + 145 = **600** 断言全绿。

## v2.11.1 — 修「粘性装载其实没生效」+「卸载是假卸载」；ALV 边线标签改画在边栏

两条都是 v2.11.0 里**静默失效**的缺陷，靠新加的行为测试（真服务实例 + 会回收的假 tools.register）抓出来的：

### 1) 粘性恢复：`aduModule` 忘了 import，ReferenceError 被吞

`_aduMountedSetting()` 用 `aduModule()` 过滤已装模块，但 `lib/index.js` 没有导入它。
于是每次读 `det.adu.mounted` 都在 `catch {}` 里炸掉、返回空数组 —— **重启后永远不会装回任何模块**，
而界面上一切正常（这正是最坏的一种坏）。修：补 import；并且 catch 现在写进失败账本
（`_diagPush("adu", "read det.adu.mounted", …)`），不再静默。

### 2) 卸载是假卸载：`dlt` / `alv` 只清了账本，工具还在

这两个模块的工具注册在各自 bridge 内部，`_aduGroups[id]` 存的是**空数组**（truthy），
旧代码判断 `if (!disposers)` 才 dispose —— 空数组绕过了这个分支，于是 `adu_unload alv`
删了账本、写了持久化，8 个 `alv_*` 工具却仍然可用。修：卸载时**先按 key dispose bridge**，再跑 disposer。

### 3) ALV `alv_edges` 的标签不再压正文

原来 `y=81(4)` 这类标签直接画在线上，实测会盖住表格末尾几行（尤其最后一条线）。
现在标签画在**左侧 72px 边栏**里（`gutter` 可调、`labels:false` 可关），输出图比原图宽
`gutter` 像素，回传 `toSource.x = -gutter` 与一句换算说明。

### 测试

- `tests/alv-adu.test.mjs` 118 → **130**：新增「粘性装载（行为）」段 —— 用 `apply()` 造真服务实例 +
  会回收的 `tools.register`，断言：按 `det.adu.mounted` 恢复、幂等、**卸载后工具真的消失**、
  持久化写回 `[]`、卸载后可重新装载。
- 全量：128 + 60 + 23 + 47 + 17 + 37 + 22 + 40 + 71 + 10 + 130 = **585** 断言全绿。
- 文档：`docs/DET功能.md` 补 DLT / ALV / ADU 三节并修正工具总数（45）；`docs/GUIDE.md` 新增
  「12. ADU 按需装载 与 ALV 辅助线视觉」；`ARCHITECTURE.md` 新增 §11.7（粘性装载不变量 + 两个缺陷的教训）。

## v2.11.0 — ADU 改成「只装不卸」：粘性装载 + adu_rememory 重新注入工具记忆

一句需求：「ADU 不主动卸载工具（agent 仍可卸，虽然那多少是'何意味'），但要提供 rememory tool list 重新增强局部记忆。」

上一版把 ADU 当**预算工具**（用完就卸载，让下一轮 schema 变轻）。这一版按用户口径改成**记忆工具**：
装载是持久的，真正稀缺的不是 schema 预算，而是**模型对"我手里有什么"的局部记忆** —— 尤其是长对话被压缩之后。

### 1) 粘性装载：ADU 不再主动卸载

- 装载落盘到 `det.adu.mounted`；宿主启动时 `_aduRestoreMounts()` 自动装回。**重启后工具还在**，这是"不主动卸载"的一半。
- 另一半：ADU 自身没有任何"空闲/切会话/到点"的自动卸载路径。只有三种情况会让模块消失：
  agent 显式 `adu_unload`、总开关关闭、插件被卸载。
- `adu_unload` 保留（能力还在），但描述改成「大多数时候不需要」：卸载只会让后续轮次少工具，并不会帮你记住什么。

### 2) `adu_rememory`：重新注入工具索引（新增第 6 个元工具）

- 新增静态索引 `ADU_TOOL_INDEX`（**45 条**：39 个模块工具 + 6 个元工具），每条 = 关键参数摘要 + 一句话用途。
- `adu_rememory`（可带 `id` 只看某模块，`full` 附带代价/风险）把索引压成一张表返回：
  ```
  工具记忆（ADU 按需模式 · 2 组 · 14 个工具）
  ## alv · ALV 辅助线视觉
     alv_grid(path, cell?, majorEvery?, guides?, out?) — 加栅格+标尺+辅助线，建立像素坐标系
  ```
- 它**不重新装载**（本来就没卸），也不占工具 schema 的预算 —— 这正是压缩之后需要的东西。
- `aduToolIndex()` 是索引的唯一装配点，rememory 与测试共用，避免"文档写一套、实现另一套"。

### 3) 顺手修掉两个真问题

- **模式切换此前要重启才生效**：`_loadExtension()` 有 `_extLoaded` 守卫，而它不区分"按需 / 全装"。于是在设置里开关 ADU，
  重启前完全无效，且 `_aduGroups` 会与全装模式重复注册同一批工具。新增 `_applyLoadMode()`：模式变化时整体
  `_unloadExtension()` → `_loadExtension()`，并重跑运行时特性同步。
- **ALV 的系统提示段一直缺席**：`lib/alv.js` 用了不存在的 `sp.register({id,role,content})`，静默失败（返回 null 不报错）。
  改成宿主真正的 `systemPrompt.section({name, order, text})`（与 DLT 集成同一个 API）。按需模式另加一段
  `tool:det-adu` 提示：按需 + 粘性 + 忘了就 rememory。

### 4) 管理器面板

- ADU 面板文案改为「6 个元工具 / 装载是粘性的 / 重启后自动装回」，并提示 `adu_rememory` 的用途。
- 「全部卸下」标注为「(不常用)」——不再鼓励用户把已装模块卸掉。

### 测试

- `tests/alv-adu.test.mjs` 96 → **118** 条：索引覆盖率（模块表里每个工具都必须有索引条目，且索引里不得有已不存在的工具）、
  参数/说明非空、按模块筛选、rememory 端到端（无损 JSON）、以及粘性装载的源码守卫（持久化键、恢复路径、模式重装）。
- 全量：128 + 60 + 23 + 47 + 17 + 37 + 22 + 40 + 71 + 10 + 118 = **573** 断言全绿。

## v2.10.1 — 修 `adu_load` 被宿主的「无损 JSON」校验拒收（装载成功却报 invalid output）

真实故障：`adu_load id=alv` 明明把 8 个工具全装上了（`adu_status` 显示已装），调用本身却返回
`tool "adu_load" returned invalid output: value is not lossless JSON`。

真因：宿主会拿 `JSON.parse(JSON.stringify(out))` 与 `out` 做深比较来校验工具输出；**任何值为
`undefined` 的字段**都会在序列化时被丢掉，于是"成功装载"被判成非法输出。`adu_load` 的结果行里
`error: res.error` 在成功路径上正是 `undefined`。

- **修**：结果行只放**有定义**的字段（`error` 仅在失败时出现）。
- **守卫**：新增 16 条断言 —— 用假桥真跑 5 个元工具的 `execute`，逐条校验输出「无损 JSON」，
  并钉住「成功结果不得携带 error 键」。这类缺陷以后会在测试里先炸，而不是在用户手里。
- 同一轮自检顺带确认：ALV 引擎（Pillow/numpy/OpenCV + Windows OCR）在升级后的宿主上可用，
  `alv` 八件套装卸正常；DSH 侧 junction 仍指向 0.2.0-rc.2（本次 DSH 升级未生效，见下条）。
- 断言总数：535 → **551**。

> ⚠ 本次自检还发现：上一轮的 DSH 升级器在「停掉宿主」之后被宿主进程树一并杀掉（Windows job
> object 语义），所以 DSH 仍是 0.2.0-rc.2；已改用 WMI 脱离创建进程的方式重跑升级。
## v2.10.0 — ALV 辅助线视觉 · ADU 按需装载 · 失败账本 · 工具预算

这一版回答三个一直存在的问题：

1. **模型说"我看不清这张图"时，它其实缺的是坐标系。**（→ ALV）
2. **每一轮只用到一两个工具，却要为三十多个工具的 schema 付预算。**（→ ADU）
3. **失败了只有一句 `browser-timeout`，攒不下能用来优化的记录。**（→ 失败账本 + 按命令预算）

### 1) ALV — Aided Line Vision（辅助线视觉，8 个 `alv_*` 工具）

视觉模型看到的是"一张图"，不是"一个坐标系"。当任务变成"这张表第 3 行错了没""这条线在哪一列结束""(1130,740) 印的料号是什么"，需要的不是更聪明的模型，而是**脚手架**。ALV 用纯几何把这些脚手架造出来 —— 无 ML、无网络、无 API Key。

| 工具 | 干什么 |
| --- | --- |
| `alv_info` | 尺寸/模式/DPI/亮度/暗像素比例/16 段直方图（可选噪声估计）。据此决定要不要裁剪放大或二值化。 |
| `alv_grid` | **坐标系本体**：栅格 + 四周坐标标尺 + 任意位置的**辅助线**（`guides:{horizontal:[470],vertical:[430]}`），返回整张新图与换算说明。 |
| `alv_crop` | 按 box 精确裁剪、放大（小字必须先放大再 OCR）；不给 box 就自动裁掉四周均匀空白。返回 `toSource` 换算。 |
| `alv_edges` | **硬编码边缘位置提取**：Canny + 概率霍夫 → 线段坐标 + **合并后的行/列边线位置**（`horizontalPositions:[{y,votes}]`），并输出标好 `y=` / `x=` 的副本。 |
| `alv_ocr` | **硬编码 OCR**：走 Windows 本机 OCR（离线、带逐词包围盒）。`mode=lines` 按视觉行合并并自动去掉中文词间空格；`mode=cells` 逐格识别直接产出**表格矩阵**。 |
| `alv_tile` | 带重叠切块 + 放大，一张大字图分块喂给模型。 |
| `alv_annotate` | 按坐标画 box/line/arrow/cross/circle/text —— 把"我算出来的位置"精确画给用户看。 |
| `alv_enhance` | 灰度/自动对比度/自适应二值化/锐化/放大（`mode=auto` 全上）。 |

引擎随包：`py/alv.py`（Pillow + numpy + OpenCV，跑在 python312 环境）+ `py/alv_ocr.ps1`（Windows.Media.Ocr 的 WinRT 桥，纯 ASCII 源文件，输出 UTF-8 JSON）。**全程离线**，OCR 语言跟随系统（本机 zh-Hans-CN）。

一个真实回合长这样：

```
info  → 900×600, 暗像素 3.9%
edges → horizontalPositions: y=81(4) y=141(4) y=201(4) y=261(4) y=321(4) y=381(4)
ocr   → 型号数量 / ALV-100 12 18.50 222.00 / … / TOTAL 471.00
```

ALV 同时注入一段系统提示，告诉模型"别猜坐标，先造脚手架，再 read_image 亲眼看"。

### 2) ADU — AutoDETUsage（按需装载，5 个 `adu_*` 工具）

旧行为是**一次性**把 30+ 个模型工具塞进上下文：每次请求都要携带全部 schema，工具越多模型越容易挑错，而绝大多数回合只用得到一两个。

ADU 把"装载"变成显式协议：

```
启动   → 只注册 adu_list / adu_describe / adu_load / adu_unload / adu_status
adu_list          → 模块表：每个模块会带来哪些工具、代价多少、风险是什么、装没装
adu_describe id=… → 深查：逐个子能力、每个工具的用途、副作用、建议
adu_load id=…     → 真正装载（等价于打开对应功能开关，下一轮生效）
adu_unload id=…   → 卸下，让后面的上下文重新变轻
```

模块（装载单元）：`plugins`（全局插件库 + CDM + TCT + MDA + MMS，19 个工具）、`browser`、`web`、`dlt`、`alv`；`security` / `project` 标为**常驻**（纯监听 / 端点，不在装载清单里）。

三条纪律：

- **模块表是唯一事实源**（`lib/adu.js`），元工具只做校验与转述，不自己持有状态。
- **装卸走同一根 disposer 管线**：与总开关、与 UI 上点开关完全一致，不会出现"两套状态各说各话"。状态记账在 `_aduGroups`（`id → [disposer]`）。
- **关掉即回到全装**：`adu` 开关或配置 `aduBoot: "eager"` 是最快的退路；总开关关闭时 ADU 一起撤走（完全原生）。

设置页新增「ADU · 按需装载(模块表)」：逐模块「装载/卸下」+「全部装载/全部卸下」，并显示当前模式与已装模块。

### 3) 失败账本 + 按命令超时（修 `browser-timeout` 只能盲重试）

数据来自一次真实失败：对一个 5000+ 节点的重页面调 `screenshot`，旧实现所有命令共用 **15s** 常数 → 必然超时，而错误只有一句 `browser-timeout`：

- **按命令给预算**（`lib/browser.js` 的 `CMD_TIMEOUTS`）：`screenshot` / `run` 45s、读类 25s、`click`/`fill` 20s、`list_tabs` 10s；调用方仍可传 `timeoutMs` 覆盖（`det_browser` 新增该参数）。
- **结构化失败**：超时结果带上 `cmd` / `waitedMs` / `tabId` / `hint`，其中 `hint` 直接给下一步（换 `read_text`、先 `web_focus`、重启扩展…）。
- **断连即刻结算**：扩展 socket 关闭时把在途命令立刻判为 `browser-disconnected`，不再静默等满 45s。
- **失败账本 `_diagPush`**：最近 200 条（kind/what/message/at），由 ALV/ADU/浏览器失败路径写入；新增端点 `detHealth` 汇总**已有事实**（启动健康、插件库「意图↔事实」一致性、DLT/ALV/ADU 装载事实、失败账本），设置页新增「健康与失败诊断」面板。

### 4) 前端：信息架构与可用性

- 新增分组「识图与工具预算」（`alv` / `adu` 两个开关），分组样式改为左侧 2px 强调条 + 轻底色，长列表里能一眼收拢（仍只用宿主 `--dsw-alias-*` token，架构守卫会拦硬编码色值）。
- 每个分项开关现在是真正的 **`role="switch"` + `aria-checked` + Tab/Space/Enter**：原先只有 `onClick`，键盘用户走不到这些开关。
- 新增三块面板：ADU 模块表、ALV 状态（引擎/OCR 桥是否在位 + 工具胶囊）、健康与失败诊断。
- ADU 模块行给"已装/未装/常驻"三色徽标、代价与风险一行说明，装/卸按钮就地生效。

### 5) 清洁与测试

- 清掉仓库里 **28 个 `.bak-*` 备份 + 1 份过期发布说明**（10.31 MB → 6.38 MB）；`.npm-cache/` 与 `*.bak*` 本来就在 `.gitignore` 里，这次是物理删除。
- 新增 `tests/alv-adu.test.mjs`（**79 条断言**）：模块表契约、开关语义、源码守卫（ALV/ADU 必须真的被 `index.js` 导入并走 `_aduGroups` 记账、`_loadExtension` 在按需模式下必须提前返回）、客户端面板与归组、**真跑引擎**（info/grid/edges/annotate/crop/未知 op/缺图）。
- 测试产物改写临时目录（测试不再往仓库里留图）。
- 全量：unit 128 · host 60 · adapt 23 · client-structure 47 · client-load 17 · dlt-host 37 · dlt-integration 22 · draft 40 · gp-state 71 · pause 10 · **alv-adu 79** = **534** 断言全绿。
- 依赖区间抬到 `^0.2.1-rc.3`（DSH 0.2.1 起预发布版才算在区间内；此前 `^0.2.0-rc.2` 按 semver 预发布规则并不匹配 0.2.1-rc.x）。仍未声明 `engines.dsh`，但 `^0.2.1-rc.3` 已让声明层与实测宿主一致。

## v2.9.4 — 修好「DET 与它管理的插件」的联动；草图判定改成真·实时；草图拆成独立包

- **依赖对齐 DSH 0.2**：`@deepseek-ai/dsh-typert-protocol` 由 `^0.1.7-rc.2` 抬到 `^0.2.0-rc.2`，并补齐此前**漏声明**的运行时依赖 `@deepseek-ai/dsh-tools` / `dsh-llm` / `dsh-credentials` / `dsh-storage-domain` / `dsh-session`（统一 `^0.2.0-rc.2`）—— 这五个此前只靠在运行时从宿主树里解析（junction + 运行时解析模式），声明层是缺的。代码本身无需适配 —— 0.2.0-rc.2 下 10 个测试文件全绿（约 449 条断言），升级后的真实宿主里 DET 工具、端点与 `.dset-*` 客户端界面均已实测渲染。

三处都是用户实测反馈：「关掉一些插件反而影响了 DET 的自带功能/UI」、
「总开关关闭后该停的没停（或该恢复的没恢复）」、「在 DET 里禁用/启用常驻插件不生效或重启后回弹」，
以及「自动切换视觉模型居然不是实时检查模型表判定的」。

### 1) 联动：意图与事实**彻底**分开（修「重启后回弹」）

根因是**一个字段被当成两个东西用**：`globallyEnabled` 既是「用户的启用意图」，
又是「总开关/兜底的记账」，还被 `gpList` 拿 loader 的**实际状态**回写。
三条路径互相覆盖，于是「在 DET 里禁用常驻插件 → 重启后又活了」反复出现。

- 新增权威字段 **`enabledIntent`**（`global.js` 域里是可选字段 → 旧记录照样能读，
  读到旧记录时由 `permanentIntent` 推断一次并**自动迁移**）。
- `permanentIntent()` 的优先级重写：**档位「全局禁用」= 硬否决**（按定义「拒绝任何启用」）
  → 其次 `enabledIntent` → 最后才是旧记录的兼容推断（`level` 优先于会被记账污染的 `globallyEnabled`）。
- `gpList` **不再**把 loader 的事实回写进意图字段（旧代码那句
  `updateMeta(p.id, { globallyEnabled: actualEnabled })` 正是抹掉意图的凶手，
  而它上面的注释还写着「不再用事实覆盖意图」—— 注释与代码相反）。现在事实只以
  `actualEnabled` / `fiberPhase` / `stateMismatch` 的形式**如实报告**，一个字都不落回存储。
- `gpSetPermanentEnabled` **不再改档位**。旧实现把用户的五档改写成
  `always` / `disabled`，`ai-approve` / `frozen` 就这么被永久销毁了。二分开关表达的是
  「装不装」，与「允许谁启用」是两个维度，现在分开存（档位原样保留，界面也据此提示
  「五档档位保持「x」不变」）。
- 档位改动也立刻落到 loader：改成「全局禁用」= 卸下条目；从「全局禁用」改回别的档位
  则按 `enabledIntent` 重新装回（顺手给旧记录补上意图字段，否则「本来想开着」会被推断丢掉）。
- 兜底不再被自己撤销：总开关暂停 / 启动连续失败兜底都写 `enabledIntent=false`
  （这是**有意的**停用），于是重启后 `_applyPersistentPermanentStates` 不会又把它装回来。
- 暂停快照的 `kind` 如实标注（`permanent` / `library`）。旧代码一律写 `library`，
  导致 `_resumeManagedPlugins` 里判 `kind === "installed"` 的那条分支**永远不命中**（死代码）。

### 2) 联动：不再强迫整页刷新（修「关掉插件反而影响 DET 自带功能/UI」）

- 旧实现在常驻插件启停后无条件 `window.location.reload()` ——
  **即使宿主回了 `applyError`（什么都没生效）也照刷**。一次整页刷新会把 DET 自己的
  界面、设置页位置、未保存的输入一起重置；这就是「关掉一个插件却把 DET 自己的功能和
  界面也搅了」。
- 现在：**只在你真的改了 loader 状态时**提示，并把「刷新前端」做成**你点才刷**的按钮。
  回报以宿主给的 `actualEnabled` 为准（`loader 已实时禁用` / `实时未生效：<原因>`），
  不再「说成功了但其实没生效」。
- 常驻插件不再被误当成动态 Cordis 插件：`_stopSession` 以前会拿占位 `pluginId`
  `"permanent"` 去问动态运行器「停掉一个叫 permanent 的插件」（空转的误调用），现在挡掉。
- 顺带确认并**保留**平台已有的正确行为：动态插件的浏览器半区由平台在宿主停用广播
  `cordis/dynamic-retract` 时自行 retract，DET 不需要（也不该）再维护一条手动卸载旁路。

### 3) 草图：判定改成**真·实时**（用户口径：「不是实时检查模型表判定的」）

两处陈旧，一起修：

- **Host 侧拿的是历史模型**：`sessionModelRoute` 只读会话日志里最后一条
  `request/header` —— 那是**已经跑过**的那一轮。用户在模型选择器里换了模型后，会话先落一条
  `model/selection`、投影里出现 `pending`，要等下一轮请求才会被消费；只看 `request/header`
  就永远慢一拍，于是「当前模型能收图」判断错误，发送时才被宿主以
  `MODEL_DOES_NOT_SUPPORT_IMAGES` 顶回来。
  → 新增 `liveModelSelection()`：优先读会话投影 `modelSelection` 的 **`pending ?? lastUsed`**，
  再退事件日志（最后一条 `model/selection` 若晚于最后一条 `request/header` 就采信它），
  最后才退宿主默认模型；返回里带 `source` / `live` 如实标注来源。
- **Client 侧复用了挂载那一刻的结论**：`doImport` 拿 `support` 状态当缓存，
  画布开着时换模型完全被忽略。→ 每次点「导入」都重新问一遍宿主。
- 判据收口到一处 `modelAcceptsImages()`：**只认宿主模型表的 `inputModalities`**，
  `draftSupport` 与 `dltVisionRoutes` 共用，两处判定不会漂移；拿不到就按「收不了」处理。
- 附件白名单也参与判定（`attachments.imageLimits` 不收 `image/png` 时不当图片）。

### 4) 草图：其余可复现缺陷

- **撤销真的能撤**：历史栈改为在**落笔之前**抓快照（并记住当时的「画布是否为空」）。
  旧实现在落笔**之后**才入栈，于是第一次「撤销」拿回的是刚画完的那张 —— 看起来毫无反应，
  而且第一笔永远撤不掉。
- **交付不撒谎**：`allowImage` 为真却挂不上附件（客户端服务缺失 / `addAttachments` 拒绝）时
  如实回报 `imageFailure` / `delivered`，按钮上显示「⚠ 已存成 PNG：…（作为图片附件失败：…）」，
  不再谎报「已作为图片注入」。
- **落盘收窄 + 同名不覆盖**：`dir` 只接受本会话工作区（其余忽略并如实回报
  `dirIgnored`）；同秒连画两张自动加 `-2` / `-3`，不再覆盖第一张。

### 5) 草图拆成独立包发布：`dsh-sketch-draft`

草图这块**不需要 DET 的任何东西**（只依赖宿主的 `llm` / `sessions` / `sessionProjections` /
`attachments`），所以拆成独立可安装、可发布的包：`C:\Users\L2959\.dsh\plugins\dsh-sketch-draft`
（npm 名 `dsh-sketch-draft`，**已发布 `dsh-sketch-draft@1.0.0`**（dist-tag `latest`），自带 `cordis.patch.yml` / README / CHANGELOG / install.ps1 / publish.ps1 /
85 项断言的测试）。拆出来之后：不想装 DET 的人也能用；DET 可以卸掉自己那份；
这条链上的修复能独立发版。

**单拥有者约定**（拆包后「同一个功能有两个实现」的唯一协调点）：新增
`subordinateGrants().grants.sketchDraft`。DET 在场且「草图导入」开着 →
独立包读到这个声明后**主动让位**（一个插槽都不注册），所以输入框旁永远只有一个铅笔；
DET 关掉 `dltDraft`（或总开关关闭）→ 独立包自动接手，反之 DET 不需要知道独立包存在。
让位方向只有一条，不会互相抢。

### 测试

- 新增 `tests/draft.test.mjs`（**40 条**）：`liveModelSelection` 的四种来源与优先级、
  `modelAcceptsImages` 的保守语义、`draftSupport` 的合成结论与原因、附件白名单、
  `draftSave` 的路径收窄 / 魔数 / 同名不覆盖，以及「客户端不得复用旧结论」的源码守卫。
- `tests/gp-state.test.mjs` 从 35 条扩到 **71 条**：意图模型重写后的优先级、硬否决、
  「只改装不装、不销毁档位」、被否决时一个 loader 改动都不发，并新增「`subordinateGrants().grants.sketchDraft` 与 dltDraft 开关联动」的断言与**源码守卫**
  （拦住「事实覆盖意图」与「强制整页刷新」回流）。
- 新增独立包 `dsh-sketch-draft/tests/sketch-draft.test.mjs`（**85 条**）：包身份与 `apply`
  装载契约、四个端点、让位矩阵（含 DET 抛错时不失效）、client bundle 真执行
  （含「被让位时不注册按钮」）。
- 全量：DET unit **128** · host **60** · adapt **23** · client-structure **47** ·
  client-load **17** · pause **10** · gp-state **71** · dlt-host **37** · dlt-integration **22** ·
  draft **40**；独立包 sketch-draft **85**。合计 **540**。

## v2.9.3 — 真正修好「右下角看不见单价了」（真因：状态框拿不到当前会话）

v2.9.2 只治了「模型目录服务取太早」，用户复测**依旧失败**。这次不再靠猜：给单价那一格加了**自报状态**（class 上带 `dset-sb-price-*` / `dset-sb-diag-*`，可从 DOM 直接读），于是从**运行中的页面**上一格一格定位到了真因链：

1. `dset-sb-diag-nosid` → **状态框拿不到当前会话 id**。它读的是 `sessions.list.getSnapshot().current`，而这个宿主版本的会话列表快照**只有 `byId`**：「当前会话」由 ui-session 自己的绑定源持有，于是这里长期返回 undefined，凡是依赖它的都静默失效（单价、本对话花费…）。
   → 改为：**优先槽位给的 `props.sessionId`**（DET 自己的工具栏一直是这么用的）+ 旧字段 `current` + 「会话列表里被主视图持有的那个」三级兜底。
2. `dset-sb-diag-nomodel` → 客户端**拿不到跨插件的 `modelDirectories`**，所以算不出「当前模型」。
   → 改为**直接问宿主**：新增端点 `dltSessionRoute`（读会话最近一次 `request/header`，退回宿主默认模型），这才是「谁在跑」的事实源；modelDirectories 只当切模型时的可选加速。
3. `dset-sb-diag-routefail` → 宿主端那份新代码**还没装载**（客户端 bundle 会热更新，宿主半区必须重启 DSH）。这也说明 v2.9.1/v2.9.2 那批**宿主侧**修复（插件管理、`dltVisionRoutes`）此前根本没生效。
   → 顺手把单价做成**不依赖重启也一定显示**：只要有单价数据，就算拿不准当前模型也按表内第一条显示（tooltip 里注明「未匹配到当前模型，按表内第一条显示」），**绝不再因为模型是 null 把整格变成「—」**。

实测（页面上直接读 DOM class）：修复前 `…price-nomodel…diag-nosid`（空）→ 中途 `…nomodel…diag-routefail` → 现在 **`…price-ok_guess…diag-routefail`，单价已显示**；等 DSH 重启后宿主路由生效，会变成 `price-ok`（精确匹配当前模型）。

## v2.9.2 — 修「右下角看不见单价了」

用户反馈：v2.9.1 把状态框改成两列网格后，右下角的**单价**看不见了。查下来是**取数链路**两处老毛病被新样式放大暴露（宿主侧官网抓取本身没问题 —— 直接跑 `fetchDsPrice()` 198ms 就拿到 CNY 单价表）：

- **模型目录服务抓得太早**：`DshStatusBox` 在**挂载那一刻**把 `props.modelDirectories` 抓进闭包，而 DET 的状态框往往比 model-selection 半区先挂载 → 拿到 `undefined` → `curModel` 永远是 null → 算不出单价 → 那一格只剩一个「—」（旧版是「价格 —」，看着像"没这一项"，新版标签写着「单价」就显得是"单价没了"）。改成**惰性解析 + 每秒重试（最多 30 次）**，服务晚到也能接上（拿到就退化成订阅）。
- **单价只在启动那一刻取一次**：那一刻网络抖一下/端点没就绪，整局都不会再取。改成**未取到时每 15 秒自动重试（上限 8 次）**，并支持点那一格手动重取。
- 顺便把单价格式改回一眼能认的写法：`命中 ¥0.02 · 未命中 ¥0.04 · 输出 ¥1`（v2.9.1 的紧凑写法 `¥0.02 / ¥0.04 / ¥1` 丢了字段名），取不到时显示「载入中…」/「未取到 · 点我重试」而不是光秃秃一个「—」。
- 单价那一格额外**自报状态**：class 上带 `dset-sb-price-ok / -pending / -err / -noprice / -nomodel`，于是「到底是没取到数据、还是没拿到当前模型、还是这一半根本没换新代码」可以从 DOM 一眼读出（排查用；旧版没有这个 class）。

## v2.9.1 — 右下状态框重排 / 草图改为「作为图片注入」/ 修好常驻插件禁用不生效

三处都是用户实测反馈（「排版不美观（尤其是右下）」「不能在对话中直接注入 draft（作为图像）」「插件管理有问题」）。

### 1) 右下角状态框重做
- 收起态从「三行各自 flex 右对齐」改成**两列网格**：左列是右对齐的灰字标签（单价 / 余额 / MMS），右列是数值（`tabular-nums`），行宽由 grid 自动对齐，不再一行宽一行窄、左缘犬牙交错。
- MMS 那行的长句收进 `title`，值只留「省钱中 / 关闭」；峰/谷徽标并入「单价」标签；余额与「本对话 ¥」同格呈现。
- 展开卡片（`.dset-statusbox-line` 那一套）保持不变。

### 2) 草图：从「让模型自己读文件」改成「直接作为图片注入」
- **旧行为**：当前模型不支持图片时，草图落盘成 PNG 并把**路径**插进输入框 —— 模型得自己调 `read_image` 去读（用户明确不接受：「这玩意居然需要模型自己调工具从文件夹读」）。
- **新行为**：点「导入」时
  1. 当前模型就收图 → 直接作为**图片附件**放进输入框；
  2. 不收图但有视觉模型 → 先**自动切到**一个可用的视觉模型（新端点 `dltVisionRoutes`：Host 逐个 `resolveModelInfo` 筛 `inputModalities` 含 `image` 的，同 provider + 名字带 vision 的优先），再作为图片附件注入；导入后在按钮旁给一个「**切回 <原模型>**」（改的是会话路由，不动档位/偏好）；
  3. 一个视觉模型都没有 → 才退回「存 PNG + 插路径」，并如实说明原因。
- 主按钮**如实写明这次要做什么**：「导入为图片」/「切到视觉模型并导入」/「存 PNG 并插入路径」；切模型失败就报错，不再偷偷降级成插路径（旧代码的失败分支还会谎报「路径已插进输入框」）。

### 3) 插件管理：修「在 DET 里禁用常驻插件，重启后又活了」
三个真实缺陷一起修，并新增一个不用重启的「立即应用」入口：
1. **名字对不上（禁用永远落不到条目上）**：profile 的 `insert` 行有两套名字 —— `id: dbs` / `name: 'dsh-bgm-service'`（包名）。旧代码只按 `entry.options.name` 匹配，于是库里 `moduleName: 'dbs'` 的记录**永远找不到** loader 条目，`_applyPersistentPermanentStates` 直接 `continue`。新增 `matchLoaderEntry()` 按 `options.name → options.id → options.module → entry.id → id 末段` 依次匹配（外加大小写不敏感兜底），并把记录里的 `moduleName` 就地修成 loader 那一套。
2. **意图被事实覆盖（档位说禁用、却永远不会禁）**：`gpList` 以前拿 loader 的实际状态回写 `globallyEnabled`，把用户「禁用」的意图抹平。现在 `permanentIntent()` 让**档位**成为唯一意图来源 —— `level=disabled` 要停、`level=always` 要开（`_disableAllGlobalPlugins` 因总开关/兜底写下的 `globallyEnabled=false` 只是记账，不再被当成意图）、其余档位才看 `globallyEnabled`；`gpSetPermanentEnabled()` 改为**同时写档位**，二分开关照样表达意图。
3. **启动时应用从未执行（死锁）**：`loader.await()` 会等 loader 树里**所有**条目的 init/inertia 任务，其中就包括 DET 自己这一条 —— 从一个插件的 `apply()` 里 await 自己必然永不返回。实测后果：`tables.boot.lastBootAt` 停在 9 天前，禁用状态一次都没应用上。改成「**延迟 3 秒** + **首个会话出现**」两脚触发，并在总开关重新打开时再应用一次（总开关关闭期间一件不碰，保持「完全原生」口径）。
- **新增端点 `gpApplyPermanentStates`** + 插件管理页右上角「**立即应用禁用状态**」按钮：不必重启 DSH 就能把「档位=禁用」的常驻插件当场卸下，逐条回报「已应用 / 修正记录 / 失败 / 跳过 / 总开关关闭」。
- **列表更诚实**：新增「意图与事实相反」提示（档位说禁用但仍在运行 → 明确指出点哪个按钮），启用/禁用两个快捷档位按**意图**高亮而不是按当前装载状态。

### 测试
- 新增 `tests/gp-state.test.mjs`（**35 条**）：四种名字的匹配（含 dbs 的 `dbs` vs `dsh-bgm-service` 别名）、容器/分组条目不参与、意图推导（档位优先 + 记账值不算数）、应用函数把意图落到 loader、幂等、总开关关闭时一件不碰、`loader.update` 失败如实进 failed、容器条目永不碰、记录自愈（moduleName + globallyEnabled）。
- 全量：unit **128** · host **60** · adapt **23** · client-structure **47** · client-load **17** · pause **10** · dlt-host **37** · dlt-integration **22** · gp-state **35**。

## v2.9.0 — DLT 集成:把 DLT 的全部功能搬进 DET(DLT 本体整体停摆)

一个插件干完两个插件的事:DLT(`dsh-light-tool`)的全部能力现在由 DET 自己提供,DET 总开关打开时 **DLT 整体停摆**。

### 自带引擎,不靠 DLT 在场
- 新增 `lib/dlt-engine.js`(DLT 纯逻辑层 `lib/core.js` 的副本:环境表 / 进程执行 / Python 文档引擎 / Office COM / Edge 无头 / 官网定价解析)与随包资产 `py/dlt_docs.py`、`py/dlt_office.ps1`。**DLT 卸载后 DET 依旧完整可用** —— 这是「DLT 可彻底停摆甚至卸载」的前提。
- `package.json` 的 `files` 补上 `py`,并把 `dsh-typert-protocol`/`schemastery` 之外的依赖按现状(经 profile 解析的 `@deepseek-ai/dsh-tools`)沿用。

### 六个模型工具 + 系统提示(**同名**)
- 新增 `lib/dlt-tools.js`,注册与 DLT **完全相同**的六个工具:`dlt_env` / `dlt_run` / `dlt_build` / `dlt_doc_read` / `dlt_doc_write` / `dlt_doc_convert`,并注入同名的 `tool:dlt` 系统提示段落。模型侧的习惯、提示词、既有文档与测试都不用改 —— 变的只是「谁提供」。
- 六个 DET 功能键逐个开关:`dltDocs` / `dltPreview` / `dltEnv` / `dltRun` / `dltCost` / `dltDraft`(默认全开),归在管理器新增的 **「DLT 集成」** 分组里,改完即时装卸。
- **撞名自愈**:启动瞬间 DLT 可能还没来得及让位,`tools.register` 会抛「已被注册」。此时**只跳过那一件并登记冲突**,2.5 秒后重试(最多 4 次)—— 不让一个撞名把整个插件带崩。

### 三个界面也搬了进来
- **每轮成本小签**(`conversation.chat.turnTail` → 新端点 `dltCost` / `dltPricingInfo`):移植 DLT 的「本轮 ¥x.xx」+ 展开 token 明细;余额与单价仍由 DET 自己的状态框呈现(那是 DLT 余额卡的重复实现,故不再单挂一张卡)。
- **右栏文档预览**(`documentPreviews` + `sidebar.right.tab.document` → 新端点 `dltOffice`):docx / xlsx / csv 的只读渲染器,并沿用「产品自带实现(priority `builtin`)认领该后缀就让位」的判定。
- **草图导入**(`conversation.input.left` → 新端点 `dltDraftSupport` / `dltDraftSave`):输入框「+」旁的小铅笔按钮,现画一张。模型声明了图片输入(`inputModalities` 含 `image`)就作为**图片附件**挂进输入框;否则存成 `<工作区>/.dsh-drafts/sketch-*.png`,并把**工作区相对路径**插进输入框文字。两条路都先落盘(Host 端 PNG 魔数校验),草图因此总有一份实体文件。判据由 Host 回答,客户端不猜 —— 免得「挂上去了、发送时才被宿主以 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拒绝」。

### 「DET 启用时完全抑制 DLT」
- `subordinateGrants().grants` 新增 `dlt` / `dltTools` / `dltUi` / `dltSettings`(总开关打开 + `det.subordinate` 未关时为 true);DLT 侧据此**整体停摆**:六个工具与系统提示都不注册,成本小签 / 余额卡 / 草图按钮 / 右栏预览连同**它自己的设置页入口**一起撤下。想让 DLT 自己回来,关掉 DET 总开关或 `det.subordinate` 即可(DLT 每 5 秒复核一次,无需重启也不需要刷新页面)。
- `detFeatureGet` 现在一并回传 `dltMeta` / `dltKeys` / `dltStatus`(工具清单 / 提示段落 / 引擎路径 / 定价来源),`detFeatureSet` 接受这六个键。
- **这不是 loader 级停用**:DLT 不在 DET 的全局插件库里,`pause` 那套逻辑依旧一根手指都不碰它(见 v2.6.0);接管走的是 `ctx.get('dshEssentialTools').subordinateGrants()` 这条既有约定面。

### 测试
- 新增 `tests/dlt-host.test.mjs`(**37 条**):六个同名工具注册、分项开关只装卸对应块、总开关关掉一件不留、**撞名只跳那一件且可重试补齐**、`dltDraftSave` 真落合法 PNG(非法数据拒绝且不留坏文件)、`dltDraftSupport` 无 LLM 时如实回答不支持图片。
- 新增 `tests/dlt-integration.test.mjs`(**22 条**):用会答 `detFeatureGet` 的假 connection 真跑客户端 `apply()`,并在四种开关组合下核对在册登记(含 dispose 回收)。
- `tests/client-structure.test.mjs` 的权威功能键表补上六个 DLT 键(新增开关必须归组才有 UI);全量:unit **128** · host **60** · adapt **23** · client-structure **47** · client-load **17** · pause **10** · dlt-host **37** · dlt-integration **22**。

## v2.7.0 — 可安装的 bundle(manifest 完整化)

- **新增 `dsh.bundle.patch`**:`package.json` 的 `dsh` 节除 `client` 外,现在声明 `bundle.patch → ./cordis.patch.yml`,并在仓库根补上了对应的 `cordis.patch.yml`。在此之前 DET 只声明 `dsh.client`,而**单有 `dsh.client` 并不构成可安装的 bundle**:`dsh plugin add` 装不上,各插件收录库的静态校验会直接判 `invalid` —— 中心 Registry 的 `rejected.json` 里 DET 的理由正是 `package.json does not declare a safe dsh.bundle.patch`。
- **一条命令安装**:`dsh plugin --profile web add dsh-essential-tools` 或 `dsh plugin --profile web add github:LLYlab/DSHEssentialTools`。装完自动并入当前 profile 的 bundle 层,**不再需要手工往 `cordis.patch.yml` 里插 `insert` 块**(从源码挂载仍然可以那样做)。
- `cordis.patch.yml` **故意不写 `config`**:所有键都有中性默认值(路径为空串 / Debug / x64 / bootFailLimit=2),所以干净 profile 装上去就能直接启动,不带入任何个人或机器路径;要接自己的工程,在自己的 patch 层里按 `id` 覆盖(`config` 是整块替换,不是逐字段深合并)。
- **README**:Quick start 增加 Option C(GitHub 安装),并说明 bundle patch 会自动注册。
- **功能无变化**:未改动任何 `lib/` 代码,本次是打包／安装契约的修复。

## v2.6.0 — 停用范围收窄到「DET 全局插件库」;DLT 这类插件不再被误伤

> v2.5.2 为了让 `topo` 也能被停用,把范围扩大成「loader 里所有非框架、非 DET 自身的常驻插件」。这个**盲扫**踩了两个坑:①`cordis:include` —— 它是持有整份 `cordis.yml` 子树的**容器**(`dbs`/`dlt`/`topo` 的 loader id 都是它的孩子 `include:xxx`),停它等于去拆整棵 profile 插件树,include 那侧随后按配置重建孩子,刚停掉的插件又被拉起来 —— 实测就是「关了 DET,dbs / topo 照旧在跑」;②把**不属于 DET 的插件**(如 `dlt` —— 它有自己的「DLT 管理器」总开关)也一起停了。本版把范围收回到 DET 自己的库,并把「停没停」变成可核对的事实。

### 停用范围 = DET 全局插件库(不再盲扫 loader)
- 只遍历 `global.list()`(即「全局插件管理」里那份库)。**不在库里的常驻插件(如 `dlt`)永不碰** —— 它们各有自己的开关。
- 库里一条记录要能被停,必须**绑定到 loader 条目**(记录里有 `moduleName`,由「全局插件管理 → 扫描已安装插件 → 纳入」写入)。
- **容器/内置永不入列**:拥有子树(`entry.subtree`)或名字以 `cordis:` 开头的条目(如 `cordis:include`)在停用与恢复两条路径上都被跳过 —— 既修掉「停不干净」,也排除拆整棵插件树的风险。
- 库里声称常驻、但绑定不上的记录,不再靠猜名字去停别人的插件:写进 `det.master.unmanaged`,设置页如实列「没被停用 + 原因(去『纳入』绑定)」。`gpMasterState` 新增 `unmanaged` / `unmanagedCount`。

### 停用后核对,不再「写下就算停」
- `_verifyPause`:逐条回读 loader 的**真实**状态(`entry.disabled`),没停的补一次(250ms 后重试),仍没停就记 `applied: false` + 可读原因。快照 `det.master.paused` 现在带 `applied`,页面区分「已确认停用 N / ⚠ 未能停用 M(+原因)」,并提供一键**刷新页面** —— 入口被停用后该插件的 client 包不再下发,刷新即彻底干净。
- 恢复侧同样只认快照:`_resumeManagedPlugins` 跳过旧快照里残留的容器条目(`skipped`),不会去替 loader 开关容器。

### 修复
- `global.upsert`:「纳入」(code 传空)不再用空值覆盖库里记录原有的 `host` / `client` 动态代码。
- `_pauseItemState`:只要记录绑定了 loader 条目就以 loader 为准 —— 此前非 `permanent` 的绑定记录会被错判成「会话实例已停」。

### 测试
- 新增 `tests/pause.test.mjs`(假 loader / 假存储驱动**真实**方法,10 条):容器不入列、**DLT 全程不被 update**、绑定不上的进 unmanaged、停不下来的补刀并如实上报、旧快照恢复不碰容器。跑法见 `docs/DET发布.md`。

## v2.5.2 — 总开关的停用范围补全:随 DSH 常驻、但未纳入库的插件(dbs / topo)

> 2.5.1 的总开关只停了「全局插件库里有记录」的插件。本机实测发现:真正在跑的 `topo` 是**随 DSH 常驻装载、未纳入库**的插件(loader 里是 `include:topo`),库中只有一个动态副本 `gp-topo` —— 于是关掉总开关后 `topo` 仍在跑(`topo_ds_ask` 仍可用)。本版把这类插件也纳入停用范围。

- **停用范围 = DET 管理范围内的全部插件**:
  - 全局插件库里**当时真的开着**的插件(常驻按 loader 实际状态判断,动态看会话实例);
  - 外加 loader 里所有**非框架**(`@deepseek-ai/*` 除外)、非 DET 自身、且当前未禁用的常驻插件 —— 也就是 DET「已安装插件」里能看到的那些(如 `topo`)。
- **恢复不变**:两类都写进快照 `det.master.paused`(库外常驻记录 `kind: "installed"` + `moduleName`),重新打开总开关时按快照重新装载 / 还原会话记录;本来就没开的插件不进快照。重复关闭(含关着总开关重启)不会覆盖已有快照;DET 自己与框架组件永不被动。
- **关闭态可核对**:DET 管理器列出的清单会区分「常驻已安装 · 已卸载」与「常驻 · 已卸载 / 会话实例已停」。
- 提醒:被 loader 卸载的常驻插件,其**前端界面**要等一次页面刷新(强刷)才会消失;后端能力(如 `topo_ds_ask`)立即失效。

## v2.5.1 — 指示状态=实际状态;总开关关闭时一并停用 DET 管控的插件

> 2.5.0 的总开关只卸下了 DET **自己**的注入,DET **管控**的插件(dbs / topo 等)仍在跑;全局插件管理的指示也仍以「记录」为准。本版把这两件事补全。

### 总开关关闭 = 真的完全原生
- **一并停用 DET 管控的插件**:常驻插件经 `loader.update(disabled:true)` 实时卸载(其界面/扩展通道随之失效),动态插件停掉各会话实例并清空启用映射。
- **可逆**:关闭前把「当时真正开着的」记成快照(`det.master.paused`),重新打开时按快照恢复 —— 常驻插件重新装载、会话启用记录还原(客户端 `gpSync` 据此在对应会话重新启用)。本来就没开的插件不进快照,避免恢复时凭空打开。
- **快照不会被清空**:重复关闭(含「关着总开关重启」)时,新结果为空就保留上一份,恢复信息不丢。
- **绝不碰自己**:`_disableAllGlobalPlugins` 明确跳过 DET 管理器自身。
- **可核对**:DET 管理器在关闭态会列出「已随总开关停用的 DET 管控插件」(常驻已卸载 / 保留的会话记录数);新增端点 `gpMasterState`。

### 指示状态 = 实际状态(全局插件管理)
- **常驻插件以 loader 为唯一事实源**:记录里的 `globallyEnabled` 只是 DET 的期望值,真正决定「装没装」的是宿主 loader 的 `entry.disabled`。`gpList` 现在按 loader 核对,不一致时**自动回写纠正**并在卡片上标注;同时显示 `fiber` 阶段(装载失败 / 进行中)。
- **会话状态区分「记录」与「在跑」**:徽标改为按实际 `running` 渲染 —— 「本会话运行中」/「已启用记录 · 未运行」/「本会话未打开 · 打开后恢复」;记录与运行清单不符且超过 15 秒才标 `stale`,避免刚启用的一瞬间误报。
- **对话内一致**:`det_global_plugin_list` 的工具文本同样报告实际状态(常驻按 loader、动态按是否有活跃运行),不再只报「档位 + 记录」。

### 修复
- 会话登记簿自检会登记一条 `id=""` 的幽灵会话(自检报告里出现 `added: [""]`,下一轮又被当失联删除,来回抖动)。原因是个别 `SessionHeader` 缺 `id`;现在无 id 的头一律跳过,`reconcileRegistry` 再做一层防御。

## v2.5.0 — 总开关:一键「完全原生」

> DET 管理器顶部新增**总开关**（`det.features.master`，默认**开**）。它是「DET 扩展 ↔ 完全原生 DSH」的唯一开关：**关闭后，DET 对 DSH 的全部改动只剩「设置 → DET 管理器」这一页与其中的这个总开关本身**，其余一律卸下且可随时恢复。

- **关闭总开关时（宿主侧）**：释放全部 DET 注入 —— `det_*` / `web_*` 模型工具（全局插件管理、TCT、CDM、MDA、浏览器、网络工具共 24 个）、系统提示注入（全局插件说明 / 网络权限档位 / MMS）、`tools/pre-execute` 安全审计监听、本地浏览器桥（WS server，已连接的扩展会断开）、会话侧边栏登记簿的自动登记与节流自检，以及启动健康兜底（不再自动禁用其它插件）；MDA 分组模式复位为 `native`。
- **关闭总开关时（客户端侧）**：撤销全部界面注入 —— 右侧 ▶🗎🕘🧩🛡 工具栏、右下角余额/花费/MMS 状态框、输入框网络权限控件、VTD 对话标签与消息操作、MDA 侧栏浮层、设置页的「全局插件管理」与「MDA 分组」两个条目；同时停止余额轮询、全局插件自动启用同步与 `ai-auto` 自动批准，并清掉写在 `<html>` 上的定位/占位 CSS 变量与属性。
- **保留**：typert 管理端点与「设置 → DET 管理器」设置页（总开关关闭后它是重新打开 DET 的唯一切入点），总开关在页面上始终可见。
- **可逆且即时**：开关持久化在 `det.features`，改动即刻生效、无需重启；关闭时的操作全部登记在 disposer 表里，重新打开会**完整恢复**（分项开关的持久化取值原样保留）。宿主侧自检：24 个工具 + 2 段系统提示 → 0 → 24/2。
- **默认值**：沿用升级前的状态（`master` 默认 `true`），不会改变现有用户的用法。

## v2.4.1 — 浏览器桥稳定性 + 安全加固 + README / 用户指导手册

- **浏览器桥只保留最新连接**：扩展重载 / MV3 Service Worker 重启后旧 socket 可能残留（`close` 未触发），此时命令会发到死连接上，表现为**间歇性 `browser-timeout`**（实测见过 6 条残留）。新连接建立时清掉更早的连接，`_firstSocket` 改为取**最后加入**的一条。
- **扩展档位切换经 background RPC**：弹窗 / 选项页不再直接写 `chrome.storage`，而是 `chrome.runtime.sendMessage({type:'setMode'})` → 同时**持久化 + 更新徽标 + 通知宿主**。修掉「改成『启用』后 `det_browser` 仍报 `ext-mode-off`」（宿主收不到通知，继续按旧档位拒绝）。
- **安全**：`_fetch` 在 DNS 解析后再判一次私网（**防 DNS rebinding**）；`_fetch` / 余额 / 单价统一 15s 超时（此前一个不响应的主机能把端点挂死）；读到响应体前先看 `Content-Length`，避免超大响应整体进内存。
- **加固**：`cmd.exe` 调用的 `mkdir` / `rmdir` 路径整体**加引号**——未加引号时空格会被拆成多参数，`& | ^` 等元字符会被解释执行（命令注入）。id 已白名单化，仍补引号保护。
- **扫描器误报**：`exec(` / `child_process` 规则加词边界（`\b`），`browserExec(` 不再被误报为进程执行。
- **修复**：inventory 行的 `packages` 可能缺失（不同 DSH 版本），复用动态插件时加容错，避免 TypeError；GitHub 商店搜索结果的 `name` / `verificationStatus` 归一化，否则模型工具的 output schema 会拿到 `undefined` 被判为非法 JSON。
- **余额刷新更跟手**：TTL 8s → 4s，配合前端 5s 轮询。
- **文档**：重写 `README.md`（价值主张 / 亮点 / 快速开始 / 文档索引），新增面向使用者的 **[docs/GUIDE.md](docs/GUIDE.md) 用户指导手册**（安装、上手、逐功能详解、权限模型、扩展装载、FAQ、故障排查、卸载回滚、速查表）。
- **发布**：GitHub `main` = tag `v2.4.1`（Release 资产 `install.ps1` / `README.md` / `GUIDE.md`）+ npm `dsh-essential-tools@2.4.1`（latest）。新增 `publish-otp.ps1`（非交互环境用 OTP 一次完成发布 + 校验）。

## v2.4.0 — 浏览器控制(DET → 你已登录的浏览器,扩展方案)

- **DSH 控制扩展**(`browser-extension/`):MV3 浏览器扩展(Chrome/Edge),通过本地 WebSocket 与 DSH 宿主通信;四档开关(关闭/只读/只写/启用)由用户在扩展弹窗控制;DSH 只读、可调用。
- **本地 WebSocket 桥**(`lib/browser.js`):DSH 宿主启动仅绑 `127.0.0.1:9123` 的 WS server,路由扩展命令;握手校验 Origin,防跨源。
- **det_browser 模型工具**:read_text / read_dom / screenshot / get_url / get_title / navigate / click / fill / run。只读/只写模式门禁在扩展端强制;「只写」不回传页面内容。
- **网络权限第4档(使用用户浏览器)= 启用浏览器控制**:低于该档 DET 拦截;扩展未连接/未开启时报错。
- **高危审批**:非 Full access 模式下,浏览器动作(读写)经 `tools/pre-execute` `{kind:'ask'}` 走产品审批;Full access 免审。
- **客户端**:DET 管理器新增「浏览器控制」状态块(Web权限档位/桥运行/扩展连接/模式)。

## v2.3.4 — VTD 分叉流式 + 对话对齐产品样式

- **分叉也要流式**:VTD 对话页签不再固定 4s 轮询。宿主 `treeView` 新增 `generating`(open-turn)信号;客户端据此在**生成中高频刷新(≈700ms)、空闲低频**(≈2.5s),并带生长检测兜底(宿主未更新时仍能流式)。生成中自动滚到底部、显示「正在生成…」提示。
- **更像标准对话**:去掉普通用户/助手消息上的「用户 #seq / 助手 #seq」噪音标签,渲染与产品聊天更一致;保留分叉 `<N>` 选择器与编辑/重试等 VTD 特有能力。

## v2.3.3 — 关闭开关的副作用:插件管理关=自动禁用所有插件;MDA 关=回到原生

- 在 DET 管理器关闭「插件管理」时,自动禁用**所有全局插件**(停各会话实例;常驻插件置为禁用并实时卸载)。
- 关闭「MDA 分组」时,自动把 MDA 分组模式**重置为原生(native)**(不再残留 workspace/model),让 DET 近乎完全关闭、回到净版 DSH。

## v2.3.1 — DET 功能开关新增「MDA 分组 / 插件管理」,可近乎完全关闭

> DET 管理器新增两个开关键,把「插件管理」与「MDA 分组」也纳入开关——关掉后对应 UI 不再渲染,让 DET 几乎完全关闭。开关即时生效并持久化。

- **新开关**:插件管理(工具栏「🧩插件」按钮/当前对话插件控制 + 全局插件管理)、MDA 分组(左侧栏分组入口 + 分组树/模型合作)。
- 关闭后:工具栏「插件」按钮消失、左侧栏「MDA 分组」入口消失、设置里对应区块显示"已关闭";DET 管理器始终保留以便重新开启。

## v2.3.0 — MDA(混合同对话)分层 · CDM 跨对话记忆 · TCT 临时对话

> DET 第二轮重大优化:MDA(Mixing Dialogue Agent)旨在**更好地管理对话、降低成本**。新增设置「MDA 分组」(仿「外观」三选一:原生/工作区组/模型组)、跨对话记忆 CDM、一次性临时对话 TCT,以及插件管理 UI 精简。

### ✨ 新增
- **MDA 分层**:设置新增「MDA 分组」(仿「外观」,三选一单选 + 图标):
  - 原生分组(默认,行为与现在一致);工作区组(按 工作区→分支模型区域→会话 分组,区域内共享 CDM 记忆 + 插件清单);模型组(同工作区组,并允许模型合作)。
  - 主视图左侧栏底部「🔀 MDA 分组」入口:工作区/区域/会话分组树(**可折叠**),工作区「+」建分组+新对话,区域「+」组内新对话。
- **CDM(CrossDialogueMemory)**:跨对话读取/搜索对话段——`cdm_list` / `cdm_search`(默认限定当前工作区;`cross` 提权可跨工作区)/ `cdm_read`。
- **TCT(Temp Chat Tool)**:一次性临时对话——`det_tct`(简短 prompt + 可选 preset + 权限控制 → 单段 feedback → 会话即焚、无持久化);DET 设置内可选 TCT 模型。
- **模型合作/介绍**:`mda_card`(用 TCT 生成模型介绍)、`mda_activate`(激活其它模型;⚠ 耗提示词,不鼓励)、`mda_list_areas`。

### 🧹 UI 精简
- 插件卡片底部改为**小图标(✎ 编辑打开内联代码工作区 / 🔍 AI 安全审查 / 🗑 删除)**,删除「本会话停用」;设置页 DET 区块可折叠;新增高性能安全审查提示词。

### 🐛 修复 / 加固
- 全局插件库读取崩溃(存储域读表 `entries()`)、并发首开竞态(`opening` 防重入)。
- 常驻插件(如 DBS)全局「启用/禁用」二分开关(经 `loader.update` 实时卸载/装载、跨重启持久化、切换后自动刷新前端)。
- 工具栏面板渲染改为兄弟节点(fragment),修复挤压/闪动;分组树支持折叠;移除与原生的单插槽冲突。

## v2.2.0 — 更贴合原生 DSH 风格 + 简洁界面 · 全局插件管理强化

> 主打「**更贴近原生 DSH 的观感与交互**」与「**更简洁的界面**」：面板、标签、工具栏对齐 DSH 原生设计语言，常用操作收拢到一处。

### ✨ 改进与亮点
- **更贴合原生 DSH 风格**
  - 全局插件管理面板、VTD 对话页签、右侧工具栏统一对齐 DSH 原生层级/色彩变量/折叠与卡片语言，观感一致。
- **更简洁的界面**
  - 面板去重、操作收拢；常驻插件改为「启用/禁用」二分开关，替代繁琐五档；
  - 扫描 / 纳入 / 刷新在各自标签内一键完成，减少跳转。
- **全局插件管理强化**
  - 修复全局插件库读取崩溃（`dsh_global_plugins` 域读表由 `.all()` 改为 `entries()`）与并发首开竞态（`opening` 防重入）；
  - **扫描已安装插件**：列出随 DSH 常驻的永久宿主插件（自动排除 DET 管理器本身），可一键纳入全局插件库（`gpScanInstalled` / `gpImportInstalled` / `det_global_plugin_scan_installed` / `det_global_plugin_import_installed`）；
  - **常驻插件二分开关**：对 DBS 这类跨会话插件做「启用/禁用」，实时经 Loader 卸载/装载、`globallyEnabled` 持久化、重启后再应用；切换后自动刷新前端让插件 UI 消失/重现（`gpSetPermanentEnabled` / `det_global_plugin_set_enabled`）；
  - **两种从 GitHub 安装插件的方式**：
    1. **直接下载**（`det_global_plugin_github_direct` / `gpGithubDirect`）：按约定格式（`dsh-plugin.json` 或 `plugin/host.js` + `plugin/client.js`）拉取并入库，返回可疑代码扫描警告；
    2. **AI 读取源码自行编写**（`det_global_plugin_github_rebuild` → `det_global_plugin_github_save`）：拉取 README 与源码、注入「病毒/漏洞检查上下文」供 AI 审查后自行编写等价版本入库——**不直接执行第三方代码**。

### 🐛 修复
- 全局插件库列表读取崩溃（`.all is not a function`）。
- 全局插件库并发首次打开时的 `already-open` 竞态。

### 🔒 安全
- 全链路 SSRF 防护 + 可疑代码静态扫描（`scanCodeWarnings`）+ commit 溯源；方式二不直接执行第三方代码。

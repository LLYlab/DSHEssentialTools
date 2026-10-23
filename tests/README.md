# DET 测试

DET 有 8400+ 行、16 项能力、**76 个 typert 端点**。历史教训（见 CHANGELOG v2.6.0：
"关了 DET，dbs / topo 照旧在跑"、"误伤 dlt"）说明：**没有可重复运行的断言，
缺陷只能靠用户撞上来发现**。本目录把"能装载、能注册、能探测"变成可重复的事实。

## 怎么跑

两套都**不需要 profile、不联网、不起服务、不写盘**，任何机器都能跑：

```powershell
cd <repo>
node tests\unit.test.mjs              # 纯函数 + Config 校验            —— 128 项断言
node tests\host.test.mjs              # 真装载宿主半区（假 Cordis ctx） —— 60 项断言
node tests\adapt.test.mjs             # 服务接入层 + 架构守卫           —— 23 项断言
node tests\client-structure.test.mjs  # 客户端信息架构 + 服务名收敛     —— 47 项断言
node tests\client-load.test.mjs       # 真执行客户端 bundle 并挂载      —— 17 项断言
node tests\pause.test.mjs             # 总开关停用/恢复的真实范围       —— 10 项检查
node tests\gp-state.test.mjs          # 常驻插件意图模型 + 联动源码守卫  —— 71 项断言
node tests\dlt-host.test.mjs          # DLT 集成：工具/提示/端点/容错    —— 37 项断言
node tests\dlt-integration.test.mjs   # DLT 集成：客户端按开关装配      —— 22 项断言
node tests\draft.test.mjs             # 草图：实时模型表判定 + 落盘收窄  —— 40 项断言
node tests\alv-adu.test.mjs           # ALV 八件套 + ADU 模块表 + 真跑引擎  —— 80 项断言
```

与草图相关的那个**独立包**（`dsh-sketch-draft`，见 CHANGELOG v2.9.4 第 5 节）
自带一套测试，在它自己的目录里跑：

```powershell
cd C:\Users\L2959\.dsh\plugins\dsh-sketch-draft
node tests\sketch-draft.test.mjs      # 端点 + client bundle 真装载 + 让位矩阵 —— 85 项断言
```

必须在**插件包内**运行：ESM 按导入方的 realpath 解析裸包名
（`@deepseek-ai/dsh-tools` / `dsh-typert-protocol` 等），从别处跑会解析失败。

退出码：全绿 `0`，有失败 `1`（失败项与期望/实际值都会打印）。

## 两套分别管什么

### `unit.test.mjs` —— 纯函数与契约（零依赖）
| 组 | 覆盖 |
|---|---|
| 包身份 | `name` / `inject` / `apply` 可调用 / `Config` 是 schema |
| `safeVersionId` | 版本与快照 id 白名单：`..`、`/`、`\`、空格、65 字符、非字符串一律拒绝（防目录穿越） |
| `isPrivateHostname` | SSRF 主机判定：172.16/12 **边界两侧**、`::ffff:7f00:1` 十六进制 v4-mapped、`169.254.169.254`、组播/广播、非字符串保守判定 |
| `safeHttpUrl` | 仅 http/https、禁内嵌凭据、禁内网/环回、非法 URL；失败必带人类可读文案 |
| `Config` | 默认值必须**中性**：`msbuild`/`lvalRoot`/`srcDir`/`solution`/`dsApiKey` 默认空串——开源分发不得带入个人机器路径或密钥 |

### `host.test.mjs` —— 宿主半区真装载（假 Cordis 上下文）
| 组 | 覆盖 |
|---|---|
| 宿主能力探测 | `probeHost` 不抛错且幂等（同一对象引用）；`legacy === !modern`；`headerIsSeeded`/`headerOriginSubagentOnly` 跟随 `snapshotEvents` 信号 |
| 功能归属表 | `featuresFor` 覆盖 `FEATURE_REGISTRY` 每个键、取值合法；**旧宿主上必须全部 `active`（不得卸载任何实现）** |
| `apply()` 装载契约 | 不抛错、返回 `EssentialToolsService`、子存储齐全、总开关默认开、扩展不阻塞挂载、至少登记 2 个 `ctx.effect` 清理器 |
| typert 注册表 | 恰好注册一次、`package`/`face` 正确、**invocation id 唯一且非空**（重复 id 会被注册表拒绝） |
| 原生接管门控 | `applyHostGating` 的**不变量**：返回新对象、**绝不修改调用方传入的对象**（用户开关值必须原样保留，降级回旧宿主时功能自动恢复） |
| MSBuild 解析 | **目标 (1) 的钉子**：配置为空 → 自动探测且结果必须是真实存在的文件；同配置命中缓存；**配置指向不存在的路径时必须回退探测**（不得把坏路径交给调用方）；配置指向真实文件时原样优先 |

### `adapt.test.mjs` —— 宿主服务接入层 + 架构守卫
| 组 | 覆盖 |
|---|---|
| `SERVICE` 表 | 被冻结、值均为非空字符串、`serviceNames()` 去重 |
| `svc()` | 上下文非法 / 服务缺失 / 服务为 `null` → `undefined`；**服务取值抛错必须被吞掉**（"单一子能力失败不拖垮整体"的基础）；服务存在时原样返回**同一引用**（不包壳） |
| `svcWith()` | 能力式分流：缺少所需方法 → `undefined`；同名属性不是函数 → `undefined` |
| **架构守卫** | ① `lib/index.js` 里**不得再出现裸的 `ctx.get("字面量")`**；② 接入层调用点数量下限；③ `ctx.get(name)` 只允许出现在 `adapt.js` |

> 服务名从此唯一归属 `lib/adapt.js` 的 `SERVICE` 表：宿主改名只改一处，
> 架构守卫会在下次跑测试时拦住任何"又写回字面量"的改动。

### `client-structure.test.mjs` —— 客户端信息架构 + 原生视觉
`lib/client.js` 是浏览器 bundle（靠宿主提供的 `require("react")`，**无 ESM 相对导入**），
无法直接 import，因此改为**源码扫描**：

| 组 | 覆盖 |
|---|---|
| 可解析性 | `new Function(src)` 编译整个 bundle（等价于对该文件跑一次 `node --check`）；确认走 `require("react")` |
| 分组表 | 能配平截取 `DET_FEATURE_GROUPS`；分组 id 唯一非空、每组有 title/desc、每个开关的显示名与说明非空 |
| **架构守卫** | ① 每个功能键**恰好归组一次**；② 分组表键集与宿主 `normalizeFeatures` 声明的键**完全一致**（跨文件不变量）；③ 不得再出现扁平列表 `toggleRow("字面量")`；④ 分组表必须真的被渲染 |
| 原生视觉 | 分组样式行不得出现硬编码色值（`#rrggbb` / `rgb()`）；承载文字颜色的规则必须引用 `var(--dsw-alias-*)` |
| 服务名收敛 | 不得再出现裸的 `ctx.get("字面量")`；`exports.inject` 必须来自 `CLIENT_INJECT` 表；**双向不变量**——以 `ctx.<name>` 直接访问的服务必须在 `inject` 里声明，声明了的也必须真被用到（Cordis 上下文 API 如 `get`/`effect`/`on` 已排除，不误报） |

> 为什么值得扫源码：信息架构最容易"悄悄退化"——新增一个开关却忘了归组、
> 或者某次改动把分组渲染换回扁平列表，都不报错、只是变难看。把它们变成断言后，
> 退化会在跑测试时立刻失败。

### `client-load.test.mjs` —— 真执行客户端半区
`client.js` 是 `window.__ModuleLoader__.load({factory})` 形式的预打包 bundle。
`new Function(src)` 只能证明**编译得过**，证明不了 factory 能跑、`apply(ctx)` 能挂载。
本套在假 ModuleLoader + 假 `require` + 假 ctx 下**真执行**：

| 组 | 覆盖 |
|---|---|
| bundle 顶层 | 顶层可执行；恰好向 `__ModuleLoader__` 注册一次；注册 id 等于包名且提供 `factory` |
| factory 契约 | factory 可执行；只 `require("react")` / `require("react-dom")`（**bundle purity**，出现别的外部依赖即失败）；`exports.inject` 是数组且含 `slots`；`exports.apply` 是函数 |
| `apply(ctx)` 挂载 | 假上下文下**不得抛错**；必须向 `settings.section`（DET 管理器页）与 `shell.overlay`（工具栏/浮层）注入；插槽与注册计数 |

> 实测快照：apply 注入 **10 个插槽**，覆盖 6 种插槽名
> （`conversation.view` / `conversation.chat.assistant-actions` / `conversation.chat.user-actions` /
> `settings.section` / `shell.overlay` / `conversation.input.left`）。
> 注意：这套的假 connection 对**所有** RPC 都答 `{ok:false}`，因此功能开关永远读不到、
> `masterWiring` 从不执行 —— DLT 集成那三块界面由下面 `dlt-integration` 单独覆盖。

### `gp-state.test.mjs` —— 常驻插件「意图 / 事实」单一真相
钉的是用户实测的缺陷（「在 DET 里禁用常驻插件，重启后又活了」、
「关掉 DET 总开关后该停的没停/该恢复的没恢复」、「关掉插件反而影响了 DET 自己的功能/UI」）：

| 组 | 覆盖 |
|---|---|
| `matchLoaderEntry` | profile 的两套名字都要认得：`options.name` / `options.id` / `options.module` / `entry.id` / id 末段（`include:xxx`）+ 大小写不敏感兜底；分组条目（`options.group`）与空名不参与；找不到返回 `null` |
| `permanentIntent` | **意图的唯一权威是 `enabledIntent`**；档位「全局禁用」是**硬否决**（按定义拒绝任何启用）；旧记录（无 `enabledIntent`）按 `level` 优先于会被记账污染的 `globallyEnabled` 推断 |
| `_applyPersistentPermanentStates` | 意图真的落到 loader（`include:topo` 收到 `disabled:true`）；顺手把 `moduleName` 修成 loader 那套名字、把意图**迁移**进 `enabledIntent`；幂等；**总开关关闭时一件不碰**；`loader.update` 失败如实进 `failed`；容器条目（有子树）永不碰 |
| `gpSetPermanentEnabled` | 只写 `enabledIntent`（+ 影子 `globallyEnabled`），**不销毁五档档位**；如实回报 `actualEnabled` / `levelUntouched`；档位=全局禁用时「启用」被拒绝且一个 loader 改动都不发 |
| **源码守卫** | 拦住三类回流：`gpList` 拿事实回写意图字段、`gpSetPermanentEnabled` 改写档位、客户端常驻插件启停时自动整页刷新 |

### `draft.test.mjs` —— 草图（实时判定 / 不撒谎 / 落盘收窄）
用户原话：「自动切换视觉模型居然不是实时检查模型表判定的」。本套钉住那条链：

| 组 | 覆盖 |
|---|---|
| `liveModelSelection` | 投影 `pending`（用户刚选、还没跑）优先于 `lastUsed`；投影缺失时退事件日志，**晚于最后一条 `request/header` 的 `model/selection` 要采信**；再退宿主默认模型；全空返回空路由且不抛错 |
| `modelAcceptsImages` | 只认模型表 `inputModalities` 含 `image`；llm 缺失 / 模型表读失败 → `images:false` 且 `known:false`（宁可退回存 PNG，也不要发送时才被拒） |
| `draftSupport` | 实时路由 + 模型表 + 附件白名单合成结论；原因里带真实模态表 / 白名单问题 |
| `draftSave` | 合法 PNG 落盘、相对路径正确；非 PNG / 缺数据被拒；**外部 `dir` 被忽略并如实回报**；同名不覆盖 |
| **源码守卫** | 客户端不得复用挂载那一刻的 `support`（否则画布开着时换模型看不到） |

### `dlt-host.test.mjs` —— DLT 集成的宿主侧
`lib/dlt-tools.js`（`DltBridge`）把 DLT 的全部宿主侧能力搬进 DET。本套用假宿主
（`tools` 注册表**同名抛错**、`systemPrompt` 段落表）真跑它的 `sync()`：

| 组 | 覆盖 |
|---|---|
| 功能键语义 | 六个键固定有序；总开关关闭时一律不生效 |
| 同名工具 | 全开注册 **dlt_env / dlt_run / dlt_build / dlt_doc_read / dlt_doc_write / dlt_doc_convert** 六个原名；分项开关只装卸对应块（关 `dltRun` → 4 件，关 `dltDocs` → 剩环境表 + 执行/编译） |
| 系统提示 | 段落名 `tool:dlt`；环境表清单只在 `dltEnv` 开着时出现；关 `dltRun` 后提示里不再教模型用它 |
| 总开关 | 关闭后工具与提示**一件不留**，重新打开可原样恢复（可逆） |
| **撞名容错** | 名字被占 → 如实回报 `conflict`、只跳过那一件、其余照常注册；对手让位后重试补齐六件 |
| 草图端点 | `dltDraftSave` 真写出合法 PNG（相对路径落在 `<工作区>/.dsh-drafts`）、非 PNG 数据被拒且不留坏文件；`dltDraftSupport` 在没有 LLM 服务时如实回答「不支持图片」 |
| 回收 | `dispose()` 后宿主注册表里一个不剩 |

### `dlt-integration.test.mjs` —— DLT 集成的客户端装配
用一个**会答 `detFeatureGet`** 的假 connection 真跑 `apply(ctx)`，并把
`inject`/`register` 的 disposer 也模拟出来（撤销后从在册集合移除），于是能核对
「此刻到底挂着什么」：

| 场景 | 期望 |
|---|---|
| 全开 | 成本小签（`conversation.chat.turnTail`）、草图按钮（`conversation.input.left`，与 DET 自己的网络权限控件并存 → 该槽 2 个）、右栏预览（`sidebar.right.tab.document` + `documentPreviews` 三个后缀）都在 |
| 关 `dltCost` | 只少成本小签 |
| 关 `dltPreview` / `dltDocs` | `documentPreviews.register` 一次都不调 |
| 关 `dltDraft` | 输入框左行只剩 DET 自己的控件 |
| 总开关关闭 | DLT 集成登记一个不留（DET 管理器页与 VTD 视图片段按设计保留） |

## 假 Cordis 上下文的边界（改测试前必读）

`host.test.mjs` 里的 `makeCtx()` **不提供任何真实服务**（`get()` 一律返回 `undefined`）。
这不是偷懒，而是一次**降级验证**：宿主服务全缺失时 DET 仍必须能装载。

必须实现的 Cordis 面（少一个就会在装载期断）：

- `ctx.effect(fn)` —— 回调返回值当作 disposer
- `ctx.on(event, handler)` —— 返回 disposer
- **`ctx.reflect.provide(name, value)`** —— Cordis `Service` 基类构造函数
  （`cordis/lib/index.js`）真正调用的入口；只给 `ctx.provide` 不够
- `ctx.typert.register(descriptor)` —— 收集注册描述符
- `ctx.tools.register` / `ctx.systemPrompt.section` —— 返回 disposer

## 当前已知的宿主事实（本机实测，随宿主版本变化）

跑 `host.test.mjs` 会打印，可用于对比升级前后：

- 宿主走廊：**modern (≥0.1.7)**，`formatVersion=4`
- typert 端点数量：**83**（其中 7 个是 DLT 集成：`dltOffice` / `dltCost` / `dltPricingInfo` / `dltEnvs` / `dltDraftSupport` / `dltDraftSave` / `dltStatus`）
- 被原生接管（新宿主上 DET 卸载自身实现）的功能键：**`file`**（原生 0.1.7 的右侧文件树 + 多类型预览已覆盖）

## 还没覆盖的（下一步）

- `lib/client.js` 已覆盖**可装载性 + 信息架构 + 服务名收敛 + DLT 集成装配**；仍缺**交互行为**
  （点击开关的乐观更新与回滚、分组渲染顺序、余额轮询、草图画的指针事件与画布导出）——需要更完整的 React 桩与 DOM。
- `lib/global.js`（全局插件库五档门禁，安全相关）、`lib/mda.js`、`lib/vtd/index.js`、
  `lib/ds.js`（定价页解析）尚无直接断言。
- `lib/dlt-engine.js`（DLT 引擎副本）的文档/执行路径尚无独立断言：它由 `dlt-host.test.mjs`
  覆盖注册与端点壳，真实读写仍靠 DSH 运行期验证（`dlt_doc_read` 等模型工具）。
- 客户端服务名必须收敛到 `CLIENT_SERVICE` / `CLIENT_INJECT` 两张表，**不能**改用
  共享模块：宿主 `dsh-client-modules` 用 lazy CJS 模型 + bundle purity gate 装载，
  相对导入不会被解析（已在宿主源码中确认）。

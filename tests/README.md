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
node tests\client-structure.test.mjs  # 客户端信息架构 + 服务名收敛     —— 45 项断言
node tests\client-load.test.mjs       # 真执行客户端 bundle 并挂载      —— 17 项断言
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

- 宿主走廊：**modern (≥0.1.5)**，`formatVersion=3`
- typert 端点数量：**76**
- 被原生接管（新宿主上 DET 卸载自身实现）的功能键：**`file`**（原生 0.1.5 的右侧文件树 + 多类型预览已覆盖）

## 还没覆盖的（下一步）

- `lib/client.js` 已覆盖**可装载性 + 信息架构 + 服务名收敛**；仍缺**交互行为**
  （点击开关的乐观更新与回滚、分组渲染顺序、余额轮询）——需要更完整的 React 桩。
- `lib/global.js`（全局插件库五档门禁，安全相关）、`lib/mda.js`、`lib/vtd/index.js`、
  `lib/ds.js`（定价页解析）尚无直接断言。
- 客户端服务名必须收敛到 `CLIENT_SERVICE` / `CLIENT_INJECT` 两张表，**不能**改用
  共享模块：宿主 `dsh-client-modules` 用 lazy CJS 模型 + bundle purity gate 装载，
  相对导入不会被解析（已在宿主源码中确认）。

# DET 测试

DET 有 8400+ 行、16 项能力、**76 个 typert 端点**。历史教训（见 CHANGELOG v2.6.0：
"关了 DET，dbs / topo 照旧在跑"、"误伤 dlt"）说明：**没有可重复运行的断言，
缺陷只能靠用户撞上来发现**。本目录把"能装载、能注册、能探测"变成可重复的事实。

## 怎么跑

两套都**不需要 profile、不联网、不起服务、不写盘**，任何机器都能跑：

```powershell
cd <repo>
node tests\unit.test.mjs     # 纯函数 + Config 校验          —— 85 项断言
node tests\host.test.mjs     # 真装载宿主半区（假 Cordis ctx）—— 60 项断言
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

- `lib/client.js`（3615 行）的客户端半区目前**完全没有测试**——需要 DOM/React 桩。
- `lib/global.js`（全局插件库五档门禁）、`lib/mda.js`、`lib/vtd/index.js`、`lib/ds.js`（定价解析）尚无直接断言。
- 具名导出以外的纯函数（`isDsPeakNowHost` / `textContent` / `hasOpenTurn` / `ipv4Private`）
  **尚未导出**，因此测不到；补导出后可并入 `unit.test.mjs`。

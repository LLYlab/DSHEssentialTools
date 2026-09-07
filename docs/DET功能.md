# DET 功能说明 (dsh-essential-tools)

> 面向 **AI / 模型** 的功能速览。DET(DSH Essential Tools)是 DSH 的永久宿主插件(`dsh-essential-tools`),随 web profile 常驻;宿主 = `lib/index.js`,浏览器 = `lib/client.js`。

## 一、三大工具栏(右侧竖排)
- ▶ 运行:工作区含可运行入口时出现,按入口类型运行。
- 🗎 文件:浏览当前会话工作区文件(文件夹折叠树/预览)。
- 🕘 版本:程序版本快照 / 回退 / 删除(只动代码文件)。
- 🧩 插件:当前对话插件控制。
- 🛡 安全:代码审批 / AI 命令审计 / Prompt 攻击防御。

## 二、会话 / 对话树(VTD)
- VTD 对话标签 + 消息操作(编辑/重试/`<N>` 分叉选择)。
- 侧边栏登记簿:只存对话元数据(id/标题/血缘/时间/激活分支),不存消息本体。

## 三、DET 管理器(设置页)
- 功能开关:文件视图 / 运行按钮 / 版本控制 / VTD / 插件管理 / MDA 分组 / 代码修改审批 / MMS / AI 命令审计 / Prompt 攻击防御。
- 会话侧边栏数据自检。VTD 调试。

## 四、网络调用权限(5 档,`det.webperm`)
| 档 | 含义 |
|---|---|
| 禁用网络 | 禁止一切网络访问 |
| 官方API搜索 | AI 用 DeepSeek 官方搜索 API(按 API 计费);禁其它抓取 |
| 搜索API搜索 | 允许搜索类 API;禁通用抓取/浏览器 |
| 静默浏览器仿真 | 允许无头浏览器仿真(读网页) |
| 使用用户浏览器 | **允许驱动用户浏览器**(最高) |

- 模型侧通过系统提示感知当前档位;DET 对自身网络请求按档位拦截。
- **浏览器控制**:档位=使用用户浏览器 且扩展已开时,可用 `det_browser`。

## 五、浏览器控制(`det_browser`,扩展方案)
- 扩展(Edge/Chrome MV3,`browser-extension/`)通过本地 WebSocket(`127.0.0.1:9123`)连接 DSH 宿主。
- 模型工具 `det_browser`:read_text / read_dom / screenshot / get_url / get_title / navigate / click / fill / run。
- 扩展有四档开关(关闭/只读/只写/启用),**由用户控制,DSH 只读**。
- **高危**:非 Full access 权限模式下,浏览器动作经 DSH 审批。

## 六、MMS(混合模型系统)
- 开关(独立于 DET 管理器,余额栏开关)。
- 模型可用 `det_mms` 把低难度子问题委派给便宜/本地模型省 token。
- 关闭时该工具与提示**彻底隐藏**(模型不感知)。

## 七、安全审计
- `prompt攻击防御` / `AI命令审计`:宿主 `tools/pre-execute` 瀑布对工具/命令做独立模型审计,高风险**拦截止付**并写审计日志。

## 八、全局插件管理 + 商店标准化
- 全局插件库:五档(全局启用/对话AI可自启/对话内AI需审批/不再有新启用/全局禁用)。
- 商店搜索 `det_global_plugin_store_search` 支持多源:
  - `github`(GitHub 搜索)
  - `marketplace`(YELEBAI 中心 Registry plugins.json)
  - `leaderboard`(dshpluginleaderboard.com catalog + detail)
  - `radar`(dsh-plugin-radar 快照)

## 九、余额 / 单价 / 本对话花费
- 右下角状态小方块:价格(峰/谷 + 输入命中/未命中/输出)/ 余额+本对话 / MMS 开关。
- 每 10 秒自动刷新余额(`dsBalance`,宿主 TTL 8s)。

## 十、宿主端点(核心)
`webPermGet/Set`、`mmsModels/SetModel/Run`、`secAuditLog/Clear`、`browserStart/Status/Exec`、`dsBalance/dsPrice/dsSessionCost`、`gpStoreSearch/Sources/Install`、`detFeatureGet/Set` 等(见 `lib/index.js` 的 `METHOD_NAMES`)。

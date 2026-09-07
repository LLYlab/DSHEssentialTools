# DET 运行思路 (dsh-essential-tools)

> 面向 **AI / 开发者**:插件如何运行、数据流、关键机制。帮助读者理解后正确修改。

## 1. 定位与装载
- DET 是 **DSH 永久宿主插件**,随 web profile 常驻(`profiles/web/cordis.yml` 的 `dsh-essential-tools` 行)。`profiles/node_modules/dsh-essential-tools` 是到 `~/.dsh/.agent-presets/dsh-essential-tools/upstream/` 的 junction,因此改 `upstream/lib/*.js` 即改装载内容(**需重启 DSH 生效**)。
- 宿主半区:`lib/index.js`(Node ESM)。浏览器半区:`lib/client.js`(模块加载器 bundle,强刷生效)。

## 2. 宿主↔浏览器通信(RPC)
- 宿主:`class EssentialToolsService extends TypertRemoteService`,`ctx.typert.register({package, face:'host', invocations: buildInvocations()})` 注册 strict 描述符。`METHOD_NAMES` 数组决定暴露哪些端点(前缀 `et-`)。
- 浏览器:`makeCaller(getConnection)` 生成 `call(method, args)` → `connection.rpc.call('/api', 'dshEssentialTools/<method>', {args})`。
- 通过网关返回,**只传 JSON 标量**。

## 3. 状态持久化
- 用 `@deepseek-ai/dsh-storage-domain` 的 domain(见 `lib/global.js`、`lib/vtd/index.js`)。
- 关键 key:`det.features`(功能开关)、`det.webperm`(网络权限档)、`mms.model`、`det.secAudit.log`、`tct.model` 等。
- 网络权限档位、MMS、安全审计、浏览器控制都从这里读取/写入。

## 4. 功能开关的装载/卸载(`det.features`)
- 客户端模块级 `detFeatures` + `setDet`/`useDetFeatures`(响应式)。
- 开关变化 → 主机 `detFeatureSet({patch})` → 持久化 → `_syncDetRuntimeFeatures()` 按开关注册/注销动态工具与系统提示(参考 MMS:开启才注册 `det_mms` + 提示;关闭彻底隐藏)。

## 5. 网络权限门禁(框架)
- `_webPerm()` 读 `det.webperm`;`_webAllows(minRank)` 判断。
- 应用到 DET 自身网络请求:`_fetch`(需 rank≥2)、`dsBalance`/`dsPrice`(需 rank≥1)。
- 系统提示按当前档位注入(见 `registerWebPermPrompt`),模型感知自身网络受限。

## 6. 浏览器控制(扩展方案)
- 宿主 `BrowserBridge`(`lib/browser.js`)启动本地 HTTP+WS server(仅绑 `127.0.0.1:9123`)。
- 浏览器装载 `browser-extension/`,后台 `background.js` 连上 WS;用户在弹窗切四档(关闭/只读/只写/启用),模式存 `chrome.storage.local`。
- 模型 `det_browser` → 宿主 `browserExec` → `browser.run(tabId, cmd, args)` → 扩展 `execute` 对指定 tab 执行 → 回执。
- 门禁:扩展端(模式)+ 宿主(web 权限第4档)+ **高危审批**(非 Full access 经 `tools/pre-execute` `{kind:'ask'}`)。

## 7. 安全审计
- `det.features.secCmdAudit` / `secPromptDefense` 开启时,宿主注册全局 `tools/pre-execute` 瀑布监听,对工具调用做**一次独立模型审计**(`SEC_CMD_AUDIT_PROMPT`/`SEC_PROMPT_DEFENSE_PROMPT`),高风险 `deny` 并记录 `det.secAudit.log`。

## 8. 商店标准化爬取器
- `lib/store.js`:定义 `STORE_SOURCES`(github/marketplace/leaderboard/radar)+ 各源爬取函数(`crawlMarketplace`/`crawlLeaderboard`/`crawlRadar`),统一归一化 item,10 分钟快照缓存。
- `gpStoreSearch({source,q})` 用 `_fetch`(受网络权限门禁)拉市场数据,本地过滤。

## 9. 关键事件/钩子
- `ctx.effect(() => () => {...})` 卸载清理(如 `browser.stop()`、disposer)。
- `ctx.on("tools/pre-execute", ...)`:安全审计 + 浏览器审批的门禁点(全局、prepend)。
- `ctx.slots.inject`(浏览器):注册输入区/设置区 UI;`shell.overlay` 注册右下角状态框/工具栏。

## 10. 峰值/错峰
- 客户端 `isDsPeakNow()` 与宿主 `isDsPeakNowHost()` 一致:北京时间(UTC+8)周一~五 9:00-12:00、14:00-18:00 = 峰;其余 = 错峰。
- 用于右下角价格档位、本对话花费估算。

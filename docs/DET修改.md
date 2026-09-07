# DET 修改记录 (dsh-essential-tools)

> 面向 **AI / 开发者**:最近改动 + 如何改。宿主 `lib/index.js`、`lib/*.js`;浏览器 `lib/client.js`;扩展 `browser-extension/`。永久插件,改后需 **重启 DSH + 强刷**。

## 最近版本
- **v2.4.0**:浏览器控制(扩展方案);新增 `lib/browser.js` + `browser-extension/` + `det_browser` 工具 + 网络权限第4档门禁 + 高危审批。
- **v2.3.5**:插件市场标准化(`lib/store.js`,github/marketplace/leaderboard/radar 多源爬取器)+ `det_global_plugin_store_search` 工具。
- **v2.3.4**:VTD 分叉流式、对话对齐、文件预览、代码审批开关、余额刷新。

## 本轮针对性修改(网络权限清理)
- **删除**了「通用设置(设置→常规 / `settings.general.item` 的 `dsh-web-permission`)」里的网络权限遗留入口 —— 之前为满足"放 Full access 旁"而加,现用户确认不再需要,改保留**输入框内联**(`conversation.input.left`)+ **DET 管理器「网络调用权限」块**。
- 随之删除 `WebPermissionRow` 组件(不再被任何槽引用)。
- 删除死 CSS:`.dset-ds-bal*`、`.dset-ds-price-*`(右下角重构后被取代)、`.dset-mms-chip*`、`.dset-statusbox-sep`;仅保留仍在用的 `.dset-ds-bal-chip-err`。
- 网络权限 UI 的共享 store(`useWp`/`setWpState`)仍保留,供输入框内联 + DET 管理器共用。

## 如何加一个功能开关(det.features)
1. 宿主 `lib/index.js`:`normalizeFeatures` 加字段(默认 false)。
2. `detFeatureSet` 的 `keys` 数组加入该字段。
3. 客户端 `lib/client.js`:模块级 `detFeatures` 默认值加入;`DetManagerSection` 的 `toggleRow` 列表加一行;必要时在 `setDet` 副作用里按开关装载/卸载(参考 MMS `_syncDetRuntimeFeatures`)。

## 如何加一个宿主端点
1. `lib/index.js` 的 `EssentialToolsService` 加 `async xxx(args)`。
2. 加入 `METHOD_NAMES` 数组。
3. 客户端通过 `call("xxx", args)` 调用(见 `makeCaller`)。

## 如何加一个模型工具
- 在宿主 `registerGlobalPluginTools` / `registerBrowserTools` 用 `defineTool({name, description, parameters, output:{schema,render}, async execute})`,再 `tools.register(...)`;可用 `ctx.get("tools")` 注入,`sp.section()` 注入系统提示。

## 如何加一个输入区/设置区 UI
- 输入区:`ctx.slots.inject("conversation.input.right"/"input.left", ...)`,用 `order` 定位(参考 `det_browser`/`dsh-model-price`)。
- 设置页:`ctx.slots.inject("settings.section", ...)` 加一个独立页;或 `settings.general.item` 加单行(注意:网络权限已不用此位)。

## 构建/发布注意
- 发布 `publish.ps1`(升版本 → 清备份 → commit/tag → push → npm publish → gh release)。**浏览器扩展不随 npm**(`.npmignore` 排除),需从仓库本机装载。
- `publish.ps1` 里的 `2>$null` 重定向在嵌套 PowerShell 会失败,已改为 `2>&1 | Out-Null`。

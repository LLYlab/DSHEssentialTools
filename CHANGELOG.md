# Changelog

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

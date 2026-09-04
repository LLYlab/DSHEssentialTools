# DSH 浏览器控制扩展 (browser-extension)

一个 **Microsoft Edge / Chrome(Chromium)浏览器扩展**,让 DeepSeek Harness (DET) 通过本机 WebSocket 控制**你已登录的浏览器**。

> ⚠ 这是**浏览器扩展**,不是把 DSH 变成应用。DSH 是宿主进程,本扩展是它控制你浏览器的"手"。

## 功能
- 让模型用 `det_browser` 工具操作你当前/指定的标签页:
  - 读:`read_text` / `read_dom` / `screenshot` / `get_url` / `get_title`
  - 写:`navigate` / `click` / `fill` / `run`
- **四档开关**(由你在扩展弹窗控制;DSH 只读不可改):
  - `关闭 off`  — 拒绝一切
  - `只读 read` — 仅读网页(文本/DOM/URL/截图),不可执行写
  - `只写 write` — 可导航/点击/填表/执行,**但不回传页面内容**
  - `启用 on`   — 读写完整能力(高危)
- 仅连接本机 `127.0.0.1:9123`;仅操作 DET 显式给出的 `tabId`;不访问第三方站点。

## 在 Edge 装载
1. 打开 `edge://extensions`(Chrome 用 `chrome://extensions`)。
2. 打开右上角 **开发人员模式**。
3. 点击 **加载解压缩的扩展** → 选择本目录 `browser-extension/`。
4. 扩展图标出现在工具栏;点击弹窗即可切换 `关闭/只读/只写/启用`。

## 安全前提
- 网络权限第4档(**使用用户浏览器**)才能启用 DET 的浏览器控制。
- 非 **Full access** 权限模式下,DET 的浏览器动作(`det_browser`)会经 DSH 审批;Full access 免审。
- 本扩展需 `<all_urls>` 主机权限才能在任意页面注入脚本(因为 DSH 可能指令操作你登录的任意页面,如 chat.deepseek.com)。

## 与宿主配合
- DSH 宿主启动本地 WS server(`127.0.0.1:9123`),见 `lib/browser.js`。
- 模型工具 `det_browser`,见 `lib/index.js`。
- 宿主只在网络权限=使用用户浏览器 时才启动/放行浏览器桥。

## 说明
- 扩展侧模式是权威,DSH 只读取(显示在 DET 管理器 → 浏览器控制 状态块)。
- 本扩展不随 npm 包分发(`.npmignore`),需从仓库本机装载。

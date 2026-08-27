<p align="center">
  <img src="docs/banner.svg" alt="DSHEssentialTools" width="100%">
</p>

<p align="center">
  <b>A permanent DeepSeek Harness (DSH) plugin</b><br>
  Project run &amp; code viewer · Program snapshots · VTD conversation tree (edit / retry / branches) · Message micro-versioning · DET manager
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <img src="https://img.shields.io/badge/DSH-0.1.1--rc.2-blue?style=flat-square" alt="DSH">
  <img src="https://img.shields.io/badge/type-permanent%20plugin-8c9eff?style=flat-square" alt="type">
  <img src="https://img.shields.io/badge/language-JavaScript-F7DF1E?style=flat-square" alt="JS">
</p>

---

**DSH（DeepSeek Harness）永久插件** —— 面向 C/C++ 桌面工程（Visual Studio / MSBuild）的一站式开发助手工具栏 + **VTD 虚拟对话树与版本管理**。随 DSH 常驻、重启不丢，自动出现在 Settings → Plugin inventory。

> v2 起为**永久插件**（npm 包）；v1（动态插件，`plugin/` 目录）保留作开发/快速装载用途。

## ✨ Features

### 🖥 右侧工具栏
| 图标 | 名称 | 功能 |
| --- | --- | --- |
| ▶ | 运行 | 自动识别工作区可运行入口（`main/entry/run` 的 py / cpp，或 `.sln/.slnx`），MSBuild 编译并启动程序 |
| 🗎 | 文件 | 浏览当前会话工作区文件（文件夹折叠树），点击预览 |
| 🕘 | 版本 | 程序大版本：手动快照 / 回退（回退前自动备份）/ 删除，**只动代码文件** |

### 🌲 VTD 虚拟对话树
- **编辑 / 重试**用户消息 → 创建真实分支子会话（`origin: vtd-fork`，侧边栏隐藏）让模型重答，原对话保留
- **`<N>` 分叉选择器**：分支间切换，自动**快照当前工作区并按目标分支恢复代码**（消息小版本机制）
- **VTD 对话标签**：分支感知消息流 + 精细 Markdown、推理折叠、工具调用/结果卡片
- **消息小版本**：`baseline` / `edit` / `retry` / `auto-switch` 自动记录，可回退

### 🛠 DET 管理器（Settings 页面）
- 四个功能开关（文件 / 运行 / 版本 / VTD）：即时装载/卸载 UI，持久化于 `~/.dsh/storages/dsh_versions.json`
- **会话侧边栏登记簿**：只存“存在的对话”元数据，**不存对话本体**；`session/created` 即时登记 + 60s 节流自检 + 手动“自检并修复”
- **VTD 调试**：查看被隐藏的真实对话（根会话 + 全部 fork 子会话）与自动版本控制记录

### 📋 消息分类
真实用户输入（`source.kind === 'user'`）才作为用户气泡；系统代提（上下文注入 / 审批提示 / 技能目录等）与空消息渲染为折叠的“上下文注入”行；工具结果按卡片渲染——不会混在用户气泡里。

## 🚀 Quick start

1. 安装包：

   ```powershell
   dsh plugin --profile web add dsh-essential-tools
   ```

2. 在 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` 追加注册行：

   ```yaml
   - id: dsh-essential-tools
     name: 'dsh-essential-tools'
     config:
       lvalRoot: 'C:\path\to\your\project'
       srcDir: 'C:\path\to\your\project\src'
       solution: 'C:\path\to\your\project\YourApp.slnx'
       msbuild: 'C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe'
       configuration: 'Debug'
       platform: 'x64'
   ```

3. 重启 DSH → 插件常驻（永久），Settings → Plugin inventory 可见。

> v1 动态装载（仅开发用）：`cordis_define` 创建并粘贴 `plugin/host.js` / `plugin/client.js`，`cordis_run` 激活。

## 🧩 Capabilities & compatibility

<details>
<summary>端点清单（dshEssentialTools/*）与技术细节</summary>

**Host 半区**（`lib/index.js`）：`TypertRemoteService` 子类 + `ctx.typert.register`（src-json codec）；依赖服务经 `ctx.get` 读取，缺失安全降级。
**VTD 存储域**（`lib/vtd/index.js`）：`dsh_versions` 域（version 2，无迁移）：`minor_versions` / `sessions`（登记簿）/ `settings`（开关与自检报告）。
**Client 半区**（`lib/client.js`）：`window.__ModuleLoader__.load` bundle，插槽 `shell.overlay` / `conversation.view` / `conversation.chat.user-actions` / `settings.section`。

端点：`lvalInfo` `lvalListFiles` `lvalReadFile` `lvalRun` `workspaceDetectEndpoint` `verProgCreate` `verProgList` `verProgRestore` `verProgDelete` `treeView` `editMessage` `retryMessage` `switchFork` `newMessage` `debugSessions` `debugMinor` `registryList` `registrySelfCheck` `detFeatureGet` `detFeatureSet`

</details>

> ⚠️ 需要 DSH 0.1.1-rc.2+；`session.list` 的浏览器端 schema 需接受 `origin: 'vtd-fork'`（会话层 `dsh-session` 已支持；API/UI 层若缺失会导致会话列表解析失败——确认上游修复或按 `ARCHITECTURE.md` 说明打本地补丁）。

## License
[MIT](LICENSE) © 2026 L2959159224

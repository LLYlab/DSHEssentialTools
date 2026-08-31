<p align="center">
  <img src="docs/banner.svg" alt="DSHEssentialTools" width="100%">
</p>

<p align="center">
  <b>A permanent DeepSeek Harness (DSH) plugin</b><br>
  Project run &amp; code viewer · Program snapshots · VTD conversation tree (edit / retry / branches) · Message micro-versioning · DET manager · Global plugin control · MDA layering
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <img src="https://img.shields.io/badge/DSH-0.1.1--rc.2-blue?style=flat-square" alt="DSH">
  <img src="https://img.shields.io/badge/type-permanent%20plugin-8c9eff?style=flat-square" alt="type">
  <img src="https://img.shields.io/badge/version-2.3.4-8c9eff?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/language-JavaScript-F7DF1E?style=flat-square" alt="JS">
</p>

---

**DSH（DeepSeek Harness）永久插件** —— 与原生 DSH 风格高度一体、界面简洁的工程开发助手工具栏 + **VTD 虚拟对话树与版本管理**。随 DSH 常驻、重启不丢，自动出现在 **Settings → Plugin inventory**。

> v2 起为**永久插件**（npm 包）；v1（动态插件，`plugin/` 目录）保留作开发/快速装载用途。

---

### 💡 给谁用 · 解决什么

| 给谁用 | 解决什么 |
| --- | --- |
| 用 VS / MSBuild 做 **C/C++ 桌面工程**、又常驻 DSH 的开发者 | 一键编译运行、代码速览、程序版本快照回退、对话分支管理 |
| 重度使用 DSH 会话、想更好管理对话与跨会话记忆的开发者 | VTD 对话树（编辑 / 重试 / 分支）、消息小版本、CDM 跨对话记忆、TCT 临时对话、MDA 分层 |

**为什么选它**：与原生 DSH 风格高度一体、界面简洁；随 DSH 常驻、重启不丢，自动出现在 Settings → Plugin inventory；内置 VTD 虚拟对话树（编辑 / 重试 / 分支）、消息小版本，以及全球插件管理与跨对话记忆体系。

> 🚀 **快速安装**：见下方「Quick start」—— 通用安装器可一条命令完成（含 Register 进 DSH profile）。

---

<details>
  <summary>🆕 更新亮点（点击展开）</summary>

## 🎉 更新亮点

### v2.3.4 — VTD 分叉流式 + 对话对齐产品样式
- **分叉也流式**：VTD 对话页签不再固定 4s 轮询。宿主 `treeView` 新增 `generating`（open-turn）信号，客户端依此在**生成中高频刷新（≈700ms）、空闲低频（≈2.5s）**，并带生长检测兜底。生成中自动滚到底、显示「正在生成…」提示。
- **更像标准对话**：去掉普通用户 / 助手消息上的「用户 #seq / 助手 #seq」噪音标签，渲染与产品聊天更一致；保留分叉 `<N>` 选择器与编辑 / 重试等 VTD 特有能力。

### v2.3.1–v2.3.3 — 功能开关、MDA 分层、CDM、TCT
- **可近乎完全关闭**：DET 管理器新增「插件管理 / MDA 分组」开关键，关掉对应 UI 不再渲染；插件管理关闭时自动禁用所有全局插件，MDA 关闭时自动回到原生分组——让 DET 几乎完全关闭、回到净版 DSH。
- **MDA（Mixing Dialogue Agent）分层**：设置新增「MDA 分组」（原生 / 工作区组 / 模型组、可折叠分组树）。
- **CDM（CrossDialogueMemory）跨对话记忆**：`cdm_list` / `cdm_search`（可跨工作区）/ `cdm_read`。
- **TCT（Temp Chat Tool）临时对话**：`det_tct` 一次性、低成本、用完即焚。

### v2.2.0 — 更贴合原生 DSH 风格 + 简洁界面
- 全局插件管理面板、VTD 对话页签、右侧工具栏统一对齐 DSH 原生层级 / 色彩 / 折叠与卡片语言。
- 常驻插件「启用 / 禁用」二分开关；扫描已安装插件（`det_global_plugin_scan_installed`）；两种从 GitHub 安装插件的方式（直接下载 / AI 重写）。

### v2.1.0 — 全局插件控制 + DeepSeek 余额/单价 + 安全加固
- 进程级全局插件库（五档位）、一键从对话拉取插件、应用商店 / URL 下载安装、对话内 AI 工具。
- 右下角 DeepSeek 余额悬浮卡、模型单价芯片、耗尽时间估算。

</details>

## ✨ Features

### 🖥 右侧工具栏
| 图标 | 名称 | 功能 |
| --- | --- | --- |
| ▶ | 运行 | 自动识别工作区可运行入口（`main/entry/run` 的 py / cpp，或 `.sln/.slnx`），MSBuild 编译并启动程序 |
| 🗎 | 文件 | 浏览当前会话工作区文件（文件夹折叠树），点击预览 / 编辑 |
| 🕘 | 版本 | 程序大版本：手动快照 / 回退（回退前自动备份）/ 删除，**只动代码文件** |

> 这三项为「工程」功能，需在 DSH profile 的插件配置里填 `lvalRoot` / `srcDir` / `solution` / `msbuild`（可选）；不填时其余功能（对话树 / DET 管理器 / 全局插件 / MDA / 余额）照常可用。

### 🌲 VTD 虚拟对话树
- **编辑 / 重试**用户消息 → 创建真实分支子会话（`origin: vtd-fork`，侧边栏隐藏）让模型重答，原对话保留。
- **`<N>` 分叉选择器**：分支间切换，自动**快照当前工作区并按目标分支恢复代码**（消息小版本机制）。
- **VTD 对话标签**：分支感知消息流 + 精细 Markdown、推理折叠、工具调用 / 结果卡片；**生成中流式刷新**。
- **消息小版本**：`baseline` / `edit` / `retry` / `auto-switch` 自动记录，可回退。

### 🛠 DET 管理器（Settings 页面）
- 四个功能开关（文件 / 运行 / 版本 / VTD）+ **插件管理 / MDA 分组**开关键：即时装载 / 卸载 UI，持久化于 `~/.dsh/storages/dsh_versions.json`。
- **会话侧边栏登记簿**：只存“存在的对话”元数据，**不存对话本体**；`session/created` 即时登记 + 60s 节流自检 + 手动“自检并修复”。
- **VTD 调试**：查看被隐藏的真实对话（根会话 + 全部 fork 子会话）与自动版本控制记录。

### 🧩 全局插件控制（Settings 独立条目「全局插件管理」）
- **全局插件库**：进程级、跨重启持久化插件清单（存储域 `dsh_global_plugins`），每个插件有名称、描述、来源与**五个档位**（`always` / `ai-auto` / `ai-approve` / `frozen` / `disabled`）。
- **来源一·从对话拉取**：列出所有运行中会话的动态 Cordis 插件（跨会话选择），一键晋升为全局插件。
- **来源二·应用商店 / URL 下载**：GitHub 搜索 DSH 插件 → 结果窗口 + **AI 摘要**（本地存档缓存，不重复耗 token）→ 安装；或直接粘贴 JSON 清单 URL 下载。
- **两种从 GitHub 获取插件的方式**：① 直接下载（`det_global_plugin_github_direct`）；② **AI 读取源码自行编写**（`det_global_plugin_github_rebuild` → `det_global_plugin_github_save`），注入「病毒 / 漏洞检查上下文」，**不直接执行第三方代码**。
- **对话内 AI 工具**：`det_global_plugin_list/enable/disable`、`det_global_plugin_scan_installed`、`det_global_plugin_import_installed`、`det_global_plugin_set_enabled`。
- **扫描已安装插件 + 常驻插件二分开关**：对 DBS 这类跨会话常驻插件做「启用 / 禁用」，实时经 Loader 卸载 / 装载、跨重启持久化、切换后自动刷新前端。
- ⚠ 安全口径：全局插件代码与动态 Cordis 插件一致，以当前进程真实权限运行；安装 / 下载前有明确提示。

### 🧭 MDA 分层（Mixing Dialogue Agent）· CDM · TCT
- **「MDA 分组」设置区（仿「外观」三选一 + 图标）**：原生 / 工作区组 / 模型组；左侧栏底部「🔀 MDA 分组」入口，分组树可折叠。
- **CDM（CrossDialogueMemory）**：跨对话读取 / 搜索对话段——`cdm_list` / `cdm_search`（默认限定当前工作区，`cross` 提权可跨工作区）/ `cdm_read`。
- **TCT（Temp Chat Tool）**：一次性临时对话——`det_tct`（简短 prompt + 可选 preset + 权限控制 → 单段 feedback → 会话即焚、无持久化）；DET 设置内可选 TCT 模型。
- **模型合作 / 介绍（仅模型组）**：`mda_card`（用 TCT 生成模型介绍）、`mda_activate`（⚠ 耗提示词、不鼓励）、`mda_list_areas`。

### 💰 DeepSeek 余额 · 模型单价
- **右下角余额悬浮卡**：官方接口 `GET https://api.deepseek.com/user/balance`，60s 自动刷新 + 手动刷新；点击展开多币种明细与**预计耗尽天数**。
- **模型选择旁的单价芯片**：从 DeepSeek **官网定价页（中文页优先 CNY，英文页 USB 兜底）**解析每模型单价，按**峰值 / 错峰时段**动态显示（峰值 = 北京时间周一至五 9:00-12:00 / 14:00-18:00）；6 小时缓存、解析失败回退上次成功值。
- **API key 来源（宿主解析，绝不落盘 / 日志 / 回传）**：DET 配置 `dsApiKey` → DSH 凭据缝 → 启动环境变量；与模型设置共用一把 key。
- **安全剔除**：明确未采用 MITM 本地代理、key 哈希台账、明文 key 配置文件、任何遥测 / 统计 / 上报；网络仅访问 `api.deepseek.com` 与 `api-docs.deepseek.com`。

### 📋 消息分类
真实用户输入（`source.kind === 'user'`）才作为用户气泡；系统代提（上下文注入 / 审批提示 / 技能目录等）与空消息渲染为折叠的“上下文注入”行；工具结果按卡片渲染——不会混在用户气泡里。

## 🚀 Quick start

> 通用安装器（推荐）：安装 npm 包并把插件注册进 DSH profile，**不含任何工程专属路径**。

```powershell
# 1) 克隆 / 进入仓库后运行通用安装器（默认 profile=web，可 -Profile 指定）
.\install.ps1 -Profile web

# 2) 重启 DSH → 插件常驻（永久），Settings → Plugin inventory 可见
```

手动安装（等价）：
```powershell
dsh plugin --profile web add dsh-essential-tools
```

然后在 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` 末尾注册（id / name 必填，`config` 可选——**工程路径为空时，工程类功能不启用，其余功能照常**）：

```yaml
- insert:
    - id: dsh-essential-tools
      name: 'dsh-essential-tools'
      # config:                     # 可选：要为「工程」功能填上项目路径才需要
      #   lvalRoot: 'C:\path\to\project'
      #   srcDir: 'C:\path\to\project\src'
      #   solution: 'C:\path\to\project\App.slnx'
      #   msbuild: 'C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe'
      #   configuration: 'Debug'
      #   platform: 'x64'
      #   rollbackTargetDefault: 'minor'
```

> v1 动态装载（仅开发用）：`cordis_define` 创建并粘贴 `plugin/host.js` / `plugin/client.js`，`cordis_run` 激活。

## 🧩 Capabilities & compatibility

<details>
<summary>端点清单（dshEssentialTools/*）与技术细节</summary>

**Host 半区**（`lib/index.js`）：`TypertRemoteService` 子类 + `ctx.typert.register`（src-json codec）；依赖服务经 `ctx.get` 读取，缺失安全降级。
**VTD 存储域**（`lib/vtd/index.js`）：`dsh_versions` 域（version 2，无迁移）：`minor_versions` / `sessions`（登记簿）/ `settings`（开关与自检报告）。
**Client 半区**（`lib/client.js`）：`window.__ModuleLoader__.load` bundle，插槽 `shell.overlay` / `conversation.view` / `conversation.chat.user-actions` / `settings.section`。

端点：`lvalInfo` `lvalListFiles` `lvalReadFile` `lvalRun` `workspaceDetectEndpoint` `verProgCreate` `verProgList` `verProgRestore` `verProgDelete` `treeView` `editMessage` `retryMessage` `switchFork` `newMessage` `debugSessions` `debugMinor` `registryList` `registrySelfCheck` `detFeatureGet` `detFeatureSet` `gpList` `gpCordisInventory` `gpPull` `gpDownload` `gpStoreSearch` `gpStoreInspect` `gpStoreSummarize` `gpInstall` `gpGithubDirect` `gpGithubRebuild` `gpGithubSave` `gpScanInstalled` `gpImportInstalled` `gpSetPermanentEnabled` `gpSetLevel` `gpSetMeta` `gpDelete` `gpSessionEnable` `gpSessionDisable` `gpCheckApproval` `gpCode` `gpUpdateCode` `gpSecurityReview` `tctRun` `tctModels` `tctSetModel` `cdmList` `cdmSearch` `cdmRead` `mdaGet` `mdaSetMode` `mdaAreaList` `mdaAreaCreate` `mdaAreaRemove` `mdaAreaAddSession` `mdaAreaRemoveSession` `mdaNewConversation` `mdaCard` `mdaActivate` `dsBalance` `dsPrice`

模型工具（对话内 AI）：**`det_global_plugin_list` `det_global_plugin_enable` `det_global_plugin_disable` `det_global_plugin_scan_installed` `det_global_plugin_import_installed` `det_global_plugin_set_enabled` `det_global_plugin_github_direct` `det_global_plugin_github_rebuild` `det_global_plugin_github_save` `det_tct` `cdm_list` `cdm_search` `cdm_read` `mda_list_areas` `mda_card` `mda_activate`**

</details>

> ⚠️ 需要 DSH 0.1.1-rc.2+；`session.list` 的浏览器端 schema 需接受 `origin: 'vtd-fork'`（会话层 `dsh-session` 已支持；API/UI 层若缺失会导致会话列表解析失败——确认上游修复或按 `ARCHITECTURE.md` 说明打本地补丁）。

## 🔒 安全
安全设计、五维审查结论（插件越权 / 恶意代码 / 易错点 / 外部攻击面 / 开源泄露）与已落实修复清单见 [`docs/SECURITY.md`](docs/SECURITY.md)。要点：插件代码 = 当前进程真实权限（非安全边界，请只启用信任的代码）；下载 / 安装全链路 SSRF 防护 + 可疑代码扫描 + commit 溯源；API key 仅宿主解析、绝不落盘 / 回传。

## License
[MIT](LICENSE) © 2026 L2959159224

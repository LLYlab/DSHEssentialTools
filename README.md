# DSHEssentialTools

**A permanent DeepSeek Harness (DSH) plugin: project run & code viewer, program snapshots, an in-session conversation tree (edit / retry / branches), message micro-versioning, and a feature manager.**
DSH（DeepSeek Harness）**永久插件** —— 面向 C/C++ 桌面工程（Visual Studio / MSBuild）的一站式开发助手工具栏 + **VTD 虚拟对话树与版本管理**。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform: DSH Web](https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web-blue)
![Type](https://img.shields.io/badge/type-permanent%20plugin-8c9eff)

> v2 起为**永久插件**：以 npm 包形式装入 web profile，随 DSH 常驻、重启不丢，自动出现在 Settings → Plugin inventory。
> v1（动态插件，`plugin/` 目录）保留作开发/快速装载用途。

---

## Features / 功能

### 🖥 右侧工具栏（跟随系统/应用明暗主题）
| 图标 | 名称 | 功能 |
| --- | --- | --- |
| ▶ | 运行 | 一键识别工作区可运行入口（`main/entry/run` 的 py / cpp，或 `.sln/.slnx`），MSBuild 编译解决方案并启动程序 |
| 🗎 | 文件 | 浏览当前会话工作区文件（文件夹折叠树），点击预览 |
| 🕘 | 版本 | 程序大版本：手动快照 / 回退（回退前自动备份）/ 删除，**只动代码文件** |

### 🌲 VTD 虚拟对话树（会话内分支）
- **编辑 / 重试**用户消息 → 创建真实分支子会话（`origin: vtd-fork`，侧边栏隐藏）并让模型重答，原对话保留。
- **`<N>` 分叉选择器**：在多个分支间切换；切换时自动**快照当前工作区并按目标分支恢复代码**（小版本机制）。
- **VTD 对话标签**：分支感知的消息流（用户/助手/工具结果/系统注入分类渲染），精细 Markdown、推理折叠、工具调用与结果卡片。
- **消息小版本**：`baseline`（首次使用）/ `edit` / `retry` / `auto-switch` 自动记录到工作区 `.lval-versions\.minor\`，可回退。

### 🛠 DET 管理器（Settings 页面）
- **四个功能开关**（文件视图 / 运行按钮 / 版本控制 / VTD）：即时装载/卸载 UI，持久化于 `~/.dsh/storages/dsh_versions.json`。
- **会话侧边栏登记簿**：只存“存在的对话”元数据（id / 标题 / 工作区 / 血缘 / 时间 / 激活分支），**不存对话本体**（消息永远留在 DSH 会话日志）。自动维护：`session/created` 即时登记；列表访问 60s 节流自检；手动“自检并修复”对照真实会话全集自动 增/修/删 并给出报告。
- **VTD 调试**：查看被隐藏的真实对话（根会话 + 全部 fork 子会话）与自动版本控制记录。

### 📋 消息分类（与产品一致）
真实用户输入（`source.kind === 'user'`）才作为用户气泡（含编辑/重试）；系统代提（上下文注入 / 审批提示 / 技能目录 / 目标注入等）与空内容消息渲染为折叠的“上下文注入”行；工具结果按卡片渲染——不会混在用户气泡里。

---

## Install / 安装

### 永久安装（v2）

1. 安装包（npm 或本地路径，二选一）：

   ```powershell
   dsh plugin --profile web add dsh-essential-tools
   # 或本地路径（开发验证）：
   dsh plugin --profile web add C:\path\to\dsh-essential-tools
   ```

2. 在 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` 追加一行注册：

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

### 动态装载（v1，仅开发用）
在 DSH 对话中用 `cordis_define`（`kind: new`）创建，把 `plugin/host.js` / `plugin/client.js` 的函数体粘入 `code.host` / `code.client`，`cordis_run` 激活并批准客户端；服务器重启后需重新装载。

## Configuration / 配置
v2 路径全部走 `cordis.patch.yml` 的 `config`（见上），不再硬编码；v1 的常量位于 `plugin/host.js` 顶部。

## 兼容性（已知限制）
- 需要 DSH 0.1.1-rc.2 及以上；`session.list` 的浏览器端 schema 需接受 `origin: 'vtd-fork'`（会话层 `dsh-session` 校验已支持；API/UI 层若缺失会使会话列表解析失败——建议确认上游已修复，或按 `ARCHITECTURE.md` 的说明打本地补丁）。

## 技术细节（v2）
- **Host 半区**（`lib/index.js`）：`TypertRemoteService` 子类 + `ctx.typert.register` 注册 typert Remote 端点（src-json codec，免生成器）。依赖服务经 `ctx.get` 读取（`fs`/`subprocess`/`sessions`/`sessionPersistence`/`agents`/`agentLoop`/`agentDefaultModel`），缺失安全降级。
- **VTD 存储域**（`lib/vtd/index.js`）：`dsh_versions` 域（version 2，无迁移），`minor_versions` / `sessions`（侧边栏登记簿）/ `settings`（DET 开关与自检报告）三张表。
- **Client 半区**（`lib/client.js`）：`window.__ModuleLoader__.load` bundle（`dsh-client-modules` 契约），`React.createElement` 渲染，插槽 `shell.overlay` / `conversation.view` / `conversation.chat.user-actions` / `settings.section`；RPC 走 `ctx.connection.rpc.call('/api', 'dshEssentialTools/<method>', {args})`。
- 详细设计见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## License
[MIT](LICENSE)

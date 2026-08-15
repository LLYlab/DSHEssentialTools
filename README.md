# DSHEssentialTools

DSH（DeepSeek Harness）动态插件 —— 面向 C/C++ 桌面工程（Visual Studio / MSBuild）的一站式开发助手工具栏。

在 DSH Web 界面的右侧渲染一个**跟随系统主题的图标工具栏**，提供：代码查看器、VS2026 编译运行、项目代码版本快照/回退、历史对话会话管理。

> 本插件为 DSH 动态 Cordis 插件：Host 端运行在 DSH Node 进程中，Client 端运行在浏览器页面中，两者通过 Package 私有 JSON-RPC 通信。

---

## 功能

### 🖥 右侧工具栏（跟随系统/应用明暗主题）

| 图标 | 名称 | 功能 |
| --- | --- | --- |
| ▶ | 运行 | 一键调用 VS2026（MSBuild）编译解决方案并启动主程序，弹出运行日志弹框 |
| 🗎 | 文件 | 浏览工程源码文件，**双击文件**弹出大尺寸代码查看弹框（行号 + C/C++ 语法高亮） |
| 🕘 | 版本 | 版本管理面板（代码版本 + 对话版本两个页签） |

### 📦 代码版本管理（回退代码，对话/聊天记录完全不受影响）

- **创建快照**：备份 `LVAL\` 目录下全部源码（`.h/.cpp/.rc/.json/.vcxproj` 等）与解决方案文件到 `.lval-versions/<id>/`，可附加标签。
- **回退**：把工作区文件恢复到某个历史版本；**回退前自动先创建一份"回退前自动备份"**，防止误操作丢失当前代码；按钮需要二次确认。
- **删除**：删除某个历史版本（需要二次确认）。

### 💬 对话版本管理（会话管理）

- **打开**：重新启用（重新打开）之前的历史会话。
- **重命名**：更改之前对话的标题（会话需处于运行中，未运行的先"打开"）。
- **复制**：通过 `fork` 复制出该会话的新副本并自动打开。
- 会话列表来自 DSH `sessionQuery` 服务（按创建时间倒序，含标题/运行状态）。

### ⌨️ 运行按钮（VS2026 编译并运行）

- Host 端调用 VS2026 MSBuild：`MSBuild.exe LVAL.slnx -p:Configuration=Debug -p:Platform=x64 -m -v:m`。
- 编译成功（退出码 0）后自动启动 `x64\Debug\LVAL.exe`，返回 PID；日志弹框内还可单独"编译"或"编译并运行"。

---

## 安装

1. 在 DSH 对话中，使用动态插件工具创建插件（`cordis_define`，类型 `new`）。
2. 把 [`plugin/host.js`](plugin/host.js) 的**函数体**粘贴为 `code.host`，把 [`plugin/client.js`](plugin/client.js) 的**函数体**粘贴为 `code.client`（两个文件均以 `export default function () { ... }` 包裹，粘贴时去掉外层 `export default function () {` 与结尾 `}`，保留内部的 `return { apply(ctx) { ... } }`）。
3. `cordis_run` 激活并**批准**客户端授权。
4. 若工具栏未出现，刷新页面（F5）。

## 配置

以下常量位于 `plugin/host.js` 顶部，按你的工程调整：

| 常量 | 说明 | 默认值 |
| --- | --- | --- |
| `ROOT` | 解决方案根目录 | `C:\Users\L2959\Desktop\项目\LVAL` |
| `SRC_DIR` | 源码目录 | `<ROOT>\LVAL` |
| `SOLUTION` | 解决方案文件 | `<ROOT>\LVAL.slnx` |
| `MSBUILD` | VS2026 MSBuild 路径 | `C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe` |
| `CONFIG` / `PLATFORM` | 编译配置 | `Debug` / `x64` |
| `EXE` | 主程序输出 | `<ROOT>\x64\Debug\LVAL.exe` |

## 技术细节

- **Host 端依赖**（通过 `ctx.get` 读取，缺失时安全降级）：`fs`（文件读取/快照）、`subprocess`（MSBuild/启动程序）、`sessionQuery`（会话列表）、`sessions` + `sessionTitle`（会话重命名）。
- **Client 端插槽**：`shell.overlay`（全屏浮动层，注册 id `lval-toolbar`）；主题使用 DSH 令牌 `--dsw-alias-*`，自动跟随明暗主题。
- **通信**：Package 私有 JSON-RPC（`harness.handle` ↔ `host.call`），方法：`lval-info / lval-list-files / lval-read-file / lval-build / lval-run / lval-build-run / lval-ver-snapshot / lval-ver-list / lval-ver-restore / lval-ver-delete / lval-sessions / lval-session-rename`。

## License

[MIT](LICENSE)

# DSHEssentialTools

DSH（DeepSeek Harness）**永久插件** —— 面向 C/C++ 桌面工程（Visual Studio / MSBuild）的一站式开发助手工具栏 + **对话树与版本管理**。

在 DSH Web 界面渲染一个**跟随系统主题的右侧工具栏**，提供：代码查看器、VS2026 编译运行、程序版本快照/回退、历史会话管理；并持续扩展 **会话血缘树 / 会话内分支 / 对话消息版本（小版本）** 能力。

> v2 起为**永久插件**：以 npm 包形式装入 web profile，随 DSH 常驻、重启不丢，并自动出现在 Settings → Plugin inventory。
> v1（动态插件，`plugin/` 目录）保留作开发/快速装载用途。

---

## 功能

### 🖥 右侧工具栏（跟随系统/应用明暗主题）

| 图标 | 名称 | 功能 |
| --- | --- | --- |
| ▶ | 运行 | 一键调用 VS2026（MSBuild）编译解决方案并启动主程序，弹出运行日志弹框 |
| 🗎 | 文件 | 浏览工程源码文件，**双击文件**弹出大尺寸代码查看弹框（行号 + C/C++ 语法高亮） |
| 🕘 | 版本 | 版本管理面板（程序版本 + 对话版本两个页签，含回退开关） |

### 📦 程序版本管理（大版本：回退代码，对话/聊天记录完全不受影响）

- **创建快照**：手动创建代码快照到 `.lval-versions/<id>/`，可附加标签（人认定的里程碑，非自动保存）。
- **回退**：恢复代码文件到某个历史版本；**回退前自动先创建"回退前自动备份"**；二次确认。
- **删除**：删除某个历史版本（二次确认）。

### 💬 对话版本管理（小版本：编辑/重新生成/回退 自动留痕）

- 消息被**编辑 / 重新生成 / 回退**时，旧内容自动保存为**小版本**。
- **回退消息**：按版本面板开关（默认开）自动回到最近小版本；关闭后回到原始版本。
- 版本历史可查看、对比（diff）、恢复。

### 🌳 对话树

- **会话间树**：侧边栏按 fork 血缘渲染会话树（祖先/后代），点击切换会话。
- **会话内分支**：消息处分叉（fork 子会话 / 虚拟分支），分支图可视化，可切换查看。

### 🛠 DET 管理器(设置页)

- **设置 → DET 管理器**：四个实时开关——**文件视图 / 运行按钮 / 版本控制 / VTD**——装载/卸载对应 UI（工具栏按钮渲染门控；VTD 对话标签与消息操作按开关注册/注销），持久化于 `~/.dsh/storages/dsh_versions.json`。
- **会话侧边栏数据(登记簿)**：只存"存在的对话"元数据（id/标题/工作区/血缘/时间/激活分支），**不存对话本体**（消息永远在 DSH 会话日志）。自动维护：`session/created` 即时登记；树/列表访问节流自检(60 秒)；**自检并修复**（对照真实会话全集）自动 增/修/删，并显示自检报告。

### ⌨️ 运行按钮（VS2026 编译并运行）

- Host 端调用 VS2026 MSBuild：`MSBuild.exe LVAL.slnx -p:Configuration=Debug -p:Platform=x64 -m -v:m`。
- 编译成功（退出码 0）后自动启动 `x64\Debug\LVAL.exe`，返回 PID。

---

## 安装（永久，v2）

1. **安装包**（npm 或本地路径，二选一）：

   ```powershell
   dsh plugin --profile web add dsh-essential-tools          # npm 发布后
   # 或本地路径（开发验证）：
   dsh plugin --profile web add C:\path\to\dsh-essential-tools
   ```

2. **注册行**：在 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` 追加：

   ```yaml
   - id: dsh-essential-tools
     name: 'dsh-essential-tools'
     config:
       lvalRoot: 'C:\Users\L2959\Desktop\项目\LVAL'
       srcDir: 'C:\Users\L2959\Desktop\项目\LVAL\LVAL'
       solution: 'C:\Users\L2959\Desktop\项目\LVAL\LVAL.slnx'
       msbuild: 'C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe'
       configuration: 'Debug'
       platform: 'x64'
       rollbackTargetDefault: 'minor'    # 回退目标开关默认值：minor=最近小版本 / original=原始
   ```

3. **重启 DSH** → 插件常驻（永久），Settings → Plugin inventory 可见。

## 安装（动态，v1，仅开发用）

1. 在 DSH 对话中用动态插件工具创建（`cordis_define`，类型 `new`）。
2. 把 [`plugin/host.js`](plugin/host.js) / [`plugin/client.js`](plugin/client.js) 的函数体粘贴为 `code.host` / `code.client`。
3. `cordis_run` 激活并批准客户端授权；刷新页面。
4. 服务器重启后需重新装载（v1 是进程级插件）。

## 配置

v2 路径全部走 `cordis.patch.yml` 的 `config`（见上），不再硬编码。v1 的常量位于 `plugin/host.js` 顶部。

## 技术细节（v2）

- **Host 半区**（`lib/index.js`）：`TypertRemoteService` 子类 + `ctx.typert.register` 注册 typert Remote 端点（src-json codec，免生成器）。依赖服务经 `ctx.get` 读取（`fs`/`subprocess`/`sessionQuery`/`sessions`/`sessionTitle`/`sessionPersistence`），缺失安全降级。
- **Client 半区**（`lib/client.js`）：`window.__ModuleLoader__.load` bundle（`dsh-client-modules` 契约），`React.createElement` 渲染，插槽 `shell.overlay`；RPC 走 `ctx.connection.rpc.call('/api', 'dshEssentialTools/<method>', {args})`。
- **端点**（20 个）：`dshEssentialTools/{lvalInfo,lvalListFiles,lvalReadFile,lvalRun,workspaceDetectEndpoint,verProgCreate,verProgList,verProgRestore,verProgDelete,treeView,editMessage,retryMessage,switchFork,newMessage,debugSessions,debugMinor,registryList,registrySelfCheck,detFeatureGet,detFeatureSet}`。
- 详细设计见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 发布

`.\publish.ps1`（GitHub 推送 + npm publish；需在你自己终端运行，沙箱无外网）。

## License

[MIT](LICENSE)

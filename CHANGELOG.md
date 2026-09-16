# Changelog

## v2.7.0 — 可安装的 bundle(manifest 完整化)

- **新增 `dsh.bundle.patch`**:`package.json` 的 `dsh` 节除 `client` 外,现在声明 `bundle.patch → ./cordis.patch.yml`,并在仓库根补上了对应的 `cordis.patch.yml`。在此之前 DET 只声明 `dsh.client`,而**单有 `dsh.client` 并不构成可安装的 bundle**:`dsh plugin add` 装不上,各插件收录库的静态校验会直接判 `invalid` —— 中心 Registry 的 `rejected.json` 里 DET 的理由正是 `package.json does not declare a safe dsh.bundle.patch`。
- **一条命令安装**:`dsh plugin --profile web add dsh-essential-tools` 或 `dsh plugin --profile web add github:LLYlab/DSHEssentialTools`。装完自动并入当前 profile 的 bundle 层,**不再需要手工往 `cordis.patch.yml` 里插 `insert` 块**(从源码挂载仍然可以那样做)。
- `cordis.patch.yml` **故意不写 `config`**:所有键都有中性默认值(路径为空串 / Debug / x64 / bootFailLimit=2),所以干净 profile 装上去就能直接启动,不带入任何个人或机器路径;要接自己的工程,在自己的 patch 层里按 `id` 覆盖(`config` 是整块替换,不是逐字段深合并)。
- **README**:Quick start 增加 Option C(GitHub 安装),并说明 bundle patch 会自动注册。
- **功能无变化**:未改动任何 `lib/` 代码,本次是打包／安装契约的修复。

## v2.6.0 — 停用范围收窄到「DET 全局插件库」;DLT 这类插件不再被误伤

> v2.5.2 为了让 `topo` 也能被停用,把范围扩大成「loader 里所有非框架、非 DET 自身的常驻插件」。这个**盲扫**踩了两个坑:①`cordis:include` —— 它是持有整份 `cordis.yml` 子树的**容器**(`dbs`/`dlt`/`topo` 的 loader id 都是它的孩子 `include:xxx`),停它等于去拆整棵 profile 插件树,include 那侧随后按配置重建孩子,刚停掉的插件又被拉起来 —— 实测就是「关了 DET,dbs / topo 照旧在跑」;②把**不属于 DET 的插件**(如 `dlt` —— 它有自己的「DLT 管理器」总开关)也一起停了。本版把范围收回到 DET 自己的库,并把「停没停」变成可核对的事实。

### 停用范围 = DET 全局插件库(不再盲扫 loader)
- 只遍历 `global.list()`(即「全局插件管理」里那份库)。**不在库里的常驻插件(如 `dlt`)永不碰** —— 它们各有自己的开关。
- 库里一条记录要能被停,必须**绑定到 loader 条目**(记录里有 `moduleName`,由「全局插件管理 → 扫描已安装插件 → 纳入」写入)。
- **容器/内置永不入列**:拥有子树(`entry.subtree`)或名字以 `cordis:` 开头的条目(如 `cordis:include`)在停用与恢复两条路径上都被跳过 —— 既修掉「停不干净」,也排除拆整棵插件树的风险。
- 库里声称常驻、但绑定不上的记录,不再靠猜名字去停别人的插件:写进 `det.master.unmanaged`,设置页如实列「没被停用 + 原因(去『纳入』绑定)」。`gpMasterState` 新增 `unmanaged` / `unmanagedCount`。

### 停用后核对,不再「写下就算停」
- `_verifyPause`:逐条回读 loader 的**真实**状态(`entry.disabled`),没停的补一次(250ms 后重试),仍没停就记 `applied: false` + 可读原因。快照 `det.master.paused` 现在带 `applied`,页面区分「已确认停用 N / ⚠ 未能停用 M(+原因)」,并提供一键**刷新页面** —— 入口被停用后该插件的 client 包不再下发,刷新即彻底干净。
- 恢复侧同样只认快照:`_resumeManagedPlugins` 跳过旧快照里残留的容器条目(`skipped`),不会去替 loader 开关容器。

### 修复
- `global.upsert`:「纳入」(code 传空)不再用空值覆盖库里记录原有的 `host` / `client` 动态代码。
- `_pauseItemState`:只要记录绑定了 loader 条目就以 loader 为准 —— 此前非 `permanent` 的绑定记录会被错判成「会话实例已停」。

### 测试
- 新增 `tests/pause.test.mjs`(假 loader / 假存储驱动**真实**方法,10 条):容器不入列、**DLT 全程不被 update**、绑定不上的进 unmanaged、停不下来的补刀并如实上报、旧快照恢复不碰容器。跑法见 `docs/DET发布.md`。

## v2.5.2 — 总开关的停用范围补全:随 DSH 常驻、但未纳入库的插件(dbs / topo)

> 2.5.1 的总开关只停了「全局插件库里有记录」的插件。本机实测发现:真正在跑的 `topo` 是**随 DSH 常驻装载、未纳入库**的插件(loader 里是 `include:topo`),库中只有一个动态副本 `gp-topo` —— 于是关掉总开关后 `topo` 仍在跑(`topo_ds_ask` 仍可用)。本版把这类插件也纳入停用范围。

- **停用范围 = DET 管理范围内的全部插件**:
  - 全局插件库里**当时真的开着**的插件(常驻按 loader 实际状态判断,动态看会话实例);
  - 外加 loader 里所有**非框架**(`@deepseek-ai/*` 除外)、非 DET 自身、且当前未禁用的常驻插件 —— 也就是 DET「已安装插件」里能看到的那些(如 `topo`)。
- **恢复不变**:两类都写进快照 `det.master.paused`(库外常驻记录 `kind: "installed"` + `moduleName`),重新打开总开关时按快照重新装载 / 还原会话记录;本来就没开的插件不进快照。重复关闭(含关着总开关重启)不会覆盖已有快照;DET 自己与框架组件永不被动。
- **关闭态可核对**:DET 管理器列出的清单会区分「常驻已安装 · 已卸载」与「常驻 · 已卸载 / 会话实例已停」。
- 提醒:被 loader 卸载的常驻插件,其**前端界面**要等一次页面刷新(强刷)才会消失;后端能力(如 `topo_ds_ask`)立即失效。

## v2.5.1 — 指示状态=实际状态;总开关关闭时一并停用 DET 管控的插件

> 2.5.0 的总开关只卸下了 DET **自己**的注入,DET **管控**的插件(dbs / topo 等)仍在跑;全局插件管理的指示也仍以「记录」为准。本版把这两件事补全。

### 总开关关闭 = 真的完全原生
- **一并停用 DET 管控的插件**:常驻插件经 `loader.update(disabled:true)` 实时卸载(其界面/扩展通道随之失效),动态插件停掉各会话实例并清空启用映射。
- **可逆**:关闭前把「当时真正开着的」记成快照(`det.master.paused`),重新打开时按快照恢复 —— 常驻插件重新装载、会话启用记录还原(客户端 `gpSync` 据此在对应会话重新启用)。本来就没开的插件不进快照,避免恢复时凭空打开。
- **快照不会被清空**:重复关闭(含「关着总开关重启」)时,新结果为空就保留上一份,恢复信息不丢。
- **绝不碰自己**:`_disableAllGlobalPlugins` 明确跳过 DET 管理器自身。
- **可核对**:DET 管理器在关闭态会列出「已随总开关停用的 DET 管控插件」(常驻已卸载 / 保留的会话记录数);新增端点 `gpMasterState`。

### 指示状态 = 实际状态(全局插件管理)
- **常驻插件以 loader 为唯一事实源**:记录里的 `globallyEnabled` 只是 DET 的期望值,真正决定「装没装」的是宿主 loader 的 `entry.disabled`。`gpList` 现在按 loader 核对,不一致时**自动回写纠正**并在卡片上标注;同时显示 `fiber` 阶段(装载失败 / 进行中)。
- **会话状态区分「记录」与「在跑」**:徽标改为按实际 `running` 渲染 —— 「本会话运行中」/「已启用记录 · 未运行」/「本会话未打开 · 打开后恢复」;记录与运行清单不符且超过 15 秒才标 `stale`,避免刚启用的一瞬间误报。
- **对话内一致**:`det_global_plugin_list` 的工具文本同样报告实际状态(常驻按 loader、动态按是否有活跃运行),不再只报「档位 + 记录」。

### 修复
- 会话登记簿自检会登记一条 `id=""` 的幽灵会话(自检报告里出现 `added: [""]`,下一轮又被当失联删除,来回抖动)。原因是个别 `SessionHeader` 缺 `id`;现在无 id 的头一律跳过,`reconcileRegistry` 再做一层防御。

## v2.5.0 — 总开关:一键「完全原生」

> DET 管理器顶部新增**总开关**（`det.features.master`，默认**开**）。它是「DET 扩展 ↔ 完全原生 DSH」的唯一开关：**关闭后，DET 对 DSH 的全部改动只剩「设置 → DET 管理器」这一页与其中的这个总开关本身**，其余一律卸下且可随时恢复。

- **关闭总开关时（宿主侧）**：释放全部 DET 注入 —— `det_*` / `web_*` 模型工具（全局插件管理、TCT、CDM、MDA、浏览器、网络工具共 24 个）、系统提示注入（全局插件说明 / 网络权限档位 / MMS）、`tools/pre-execute` 安全审计监听、本地浏览器桥（WS server，已连接的扩展会断开）、会话侧边栏登记簿的自动登记与节流自检，以及启动健康兜底（不再自动禁用其它插件）；MDA 分组模式复位为 `native`。
- **关闭总开关时（客户端侧）**：撤销全部界面注入 —— 右侧 ▶🗎🕘🧩🛡 工具栏、右下角余额/花费/MMS 状态框、输入框网络权限控件、VTD 对话标签与消息操作、MDA 侧栏浮层、设置页的「全局插件管理」与「MDA 分组」两个条目；同时停止余额轮询、全局插件自动启用同步与 `ai-auto` 自动批准，并清掉写在 `<html>` 上的定位/占位 CSS 变量与属性。
- **保留**：typert 管理端点与「设置 → DET 管理器」设置页（总开关关闭后它是重新打开 DET 的唯一切入点），总开关在页面上始终可见。
- **可逆且即时**：开关持久化在 `det.features`，改动即刻生效、无需重启；关闭时的操作全部登记在 disposer 表里，重新打开会**完整恢复**（分项开关的持久化取值原样保留）。宿主侧自检：24 个工具 + 2 段系统提示 → 0 → 24/2。
- **默认值**：沿用升级前的状态（`master` 默认 `true`），不会改变现有用户的用法。

## v2.4.1 — 浏览器桥稳定性 + 安全加固 + README / 用户指导手册

- **浏览器桥只保留最新连接**：扩展重载 / MV3 Service Worker 重启后旧 socket 可能残留（`close` 未触发），此时命令会发到死连接上，表现为**间歇性 `browser-timeout`**（实测见过 6 条残留）。新连接建立时清掉更早的连接，`_firstSocket` 改为取**最后加入**的一条。
- **扩展档位切换经 background RPC**：弹窗 / 选项页不再直接写 `chrome.storage`，而是 `chrome.runtime.sendMessage({type:'setMode'})` → 同时**持久化 + 更新徽标 + 通知宿主**。修掉「改成『启用』后 `det_browser` 仍报 `ext-mode-off`」（宿主收不到通知，继续按旧档位拒绝）。
- **安全**：`_fetch` 在 DNS 解析后再判一次私网（**防 DNS rebinding**）；`_fetch` / 余额 / 单价统一 15s 超时（此前一个不响应的主机能把端点挂死）；读到响应体前先看 `Content-Length`，避免超大响应整体进内存。
- **加固**：`cmd.exe` 调用的 `mkdir` / `rmdir` 路径整体**加引号**——未加引号时空格会被拆成多参数，`& | ^` 等元字符会被解释执行（命令注入）。id 已白名单化，仍补引号保护。
- **扫描器误报**：`exec(` / `child_process` 规则加词边界（`\b`），`browserExec(` 不再被误报为进程执行。
- **修复**：inventory 行的 `packages` 可能缺失（不同 DSH 版本），复用动态插件时加容错，避免 TypeError；GitHub 商店搜索结果的 `name` / `verificationStatus` 归一化，否则模型工具的 output schema 会拿到 `undefined` 被判为非法 JSON。
- **余额刷新更跟手**：TTL 8s → 4s，配合前端 5s 轮询。
- **文档**：重写 `README.md`（价值主张 / 亮点 / 快速开始 / 文档索引），新增面向使用者的 **[docs/GUIDE.md](docs/GUIDE.md) 用户指导手册**（安装、上手、逐功能详解、权限模型、扩展装载、FAQ、故障排查、卸载回滚、速查表）。
- **发布**：GitHub `main` = tag `v2.4.1`（Release 资产 `install.ps1` / `README.md` / `GUIDE.md`）+ npm `dsh-essential-tools@2.4.1`（latest）。新增 `publish-otp.ps1`（非交互环境用 OTP 一次完成发布 + 校验）。

## v2.4.0 — 浏览器控制(DET → 你已登录的浏览器,扩展方案)

- **DSH 控制扩展**(`browser-extension/`):MV3 浏览器扩展(Chrome/Edge),通过本地 WebSocket 与 DSH 宿主通信;四档开关(关闭/只读/只写/启用)由用户在扩展弹窗控制;DSH 只读、可调用。
- **本地 WebSocket 桥**(`lib/browser.js`):DSH 宿主启动仅绑 `127.0.0.1:9123` 的 WS server,路由扩展命令;握手校验 Origin,防跨源。
- **det_browser 模型工具**:read_text / read_dom / screenshot / get_url / get_title / navigate / click / fill / run。只读/只写模式门禁在扩展端强制;「只写」不回传页面内容。
- **网络权限第4档(使用用户浏览器)= 启用浏览器控制**:低于该档 DET 拦截;扩展未连接/未开启时报错。
- **高危审批**:非 Full access 模式下,浏览器动作(读写)经 `tools/pre-execute` `{kind:'ask'}` 走产品审批;Full access 免审。
- **客户端**:DET 管理器新增「浏览器控制」状态块(Web权限档位/桥运行/扩展连接/模式)。

## v2.3.4 — VTD 分叉流式 + 对话对齐产品样式

- **分叉也要流式**:VTD 对话页签不再固定 4s 轮询。宿主 `treeView` 新增 `generating`(open-turn)信号;客户端据此在**生成中高频刷新(≈700ms)、空闲低频**(≈2.5s),并带生长检测兜底(宿主未更新时仍能流式)。生成中自动滚到底部、显示「正在生成…」提示。
- **更像标准对话**:去掉普通用户/助手消息上的「用户 #seq / 助手 #seq」噪音标签,渲染与产品聊天更一致;保留分叉 `<N>` 选择器与编辑/重试等 VTD 特有能力。

## v2.3.3 — 关闭开关的副作用:插件管理关=自动禁用所有插件;MDA 关=回到原生

- 在 DET 管理器关闭「插件管理」时,自动禁用**所有全局插件**(停各会话实例;常驻插件置为禁用并实时卸载)。
- 关闭「MDA 分组」时,自动把 MDA 分组模式**重置为原生(native)**(不再残留 workspace/model),让 DET 近乎完全关闭、回到净版 DSH。

## v2.3.1 — DET 功能开关新增「MDA 分组 / 插件管理」,可近乎完全关闭

> DET 管理器新增两个开关键,把「插件管理」与「MDA 分组」也纳入开关——关掉后对应 UI 不再渲染,让 DET 几乎完全关闭。开关即时生效并持久化。

- **新开关**:插件管理(工具栏「🧩插件」按钮/当前对话插件控制 + 全局插件管理)、MDA 分组(左侧栏分组入口 + 分组树/模型合作)。
- 关闭后:工具栏「插件」按钮消失、左侧栏「MDA 分组」入口消失、设置里对应区块显示"已关闭";DET 管理器始终保留以便重新开启。

## v2.3.0 — MDA(混合同对话)分层 · CDM 跨对话记忆 · TCT 临时对话

> DET 第二轮重大优化:MDA(Mixing Dialogue Agent)旨在**更好地管理对话、降低成本**。新增设置「MDA 分组」(仿「外观」三选一:原生/工作区组/模型组)、跨对话记忆 CDM、一次性临时对话 TCT,以及插件管理 UI 精简。

### ✨ 新增
- **MDA 分层**:设置新增「MDA 分组」(仿「外观」,三选一单选 + 图标):
  - 原生分组(默认,行为与现在一致);工作区组(按 工作区→分支模型区域→会话 分组,区域内共享 CDM 记忆 + 插件清单);模型组(同工作区组,并允许模型合作)。
  - 主视图左侧栏底部「🔀 MDA 分组」入口:工作区/区域/会话分组树(**可折叠**),工作区「+」建分组+新对话,区域「+」组内新对话。
- **CDM(CrossDialogueMemory)**:跨对话读取/搜索对话段——`cdm_list` / `cdm_search`(默认限定当前工作区;`cross` 提权可跨工作区)/ `cdm_read`。
- **TCT(Temp Chat Tool)**:一次性临时对话——`det_tct`(简短 prompt + 可选 preset + 权限控制 → 单段 feedback → 会话即焚、无持久化);DET 设置内可选 TCT 模型。
- **模型合作/介绍**:`mda_card`(用 TCT 生成模型介绍)、`mda_activate`(激活其它模型;⚠ 耗提示词,不鼓励)、`mda_list_areas`。

### 🧹 UI 精简
- 插件卡片底部改为**小图标(✎ 编辑打开内联代码工作区 / 🔍 AI 安全审查 / 🗑 删除)**,删除「本会话停用」;设置页 DET 区块可折叠;新增高性能安全审查提示词。

### 🐛 修复 / 加固
- 全局插件库读取崩溃(存储域读表 `entries()`)、并发首开竞态(`opening` 防重入)。
- 常驻插件(如 DBS)全局「启用/禁用」二分开关(经 `loader.update` 实时卸载/装载、跨重启持久化、切换后自动刷新前端)。
- 工具栏面板渲染改为兄弟节点(fragment),修复挤压/闪动;分组树支持折叠;移除与原生的单插槽冲突。

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

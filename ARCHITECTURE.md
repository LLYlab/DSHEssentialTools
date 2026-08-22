# dsh-essential-tools — 架构与编码规范（v2 永久插件）

> 目标：把现有"动态插件"升级为 **DSH 永久插件**（随 web profile 常驻、重启不丢），
> 并新增两大能力：**对话树**（会话间血缘树 + 会话内分支图）与**版本管理**
> （程序大版本 + 对话消息小版本）。最终发布到 npm 与 GitHub。

---

## 0. 技术底座实证（已在本机运行时核实）

以下 API 均从已安装包源码核实，是实现的硬依据。

### 0.1 关键结论：永久包的 RPC 机制 ≠ 动态插件的 RPC 机制

| | 动态插件（cordis_define） | **永久 npm 包（本插件采用）** |
|---|---|---|
| Host 注册处理器 | `harness.handle(method, fn)`（仅 vm 沙箱提供，见 `dsh-cordis-host-runner`） | **`TypertRemoteService` 子类**（纯 JS，构造时自动建立 `typertRemote` 绑定）+ **`ctx.typert.register({package, face:'host', invocations})`** 注册 strict 描述符 |
| Client 调用 | `host.call(method, args)`（仅动态 runner 提供） | **`ctx.connection.rpc.call('/api', 'namespace/method', {args})`**（或 `ctx.remote.$mount` 后 `ctx.remote.<ns>.<method>(...)`） |
| 网关 | 动态 runner 专用通道 | `dsh-api-gateway` 的 `typertGateway` 拦截 `/api`：`ctx.typert.local` 命中 → `receiver = ctx.get(service)` → 调 `implementation ?? method` |
| codec | JSON 直通 | 描述符 `codec: {mode:'src-json'}` 免 schema；client 侧 strict codec 可手写 `{mode:'strict', typeSymbol:'json', schema:{parse:(v)=>v}}`（网关只调 `.parse`） |
| 生成器 | 不需要 | **不需要**：`src-json` codec + strict 描述符全部手写可行（`@Remote` 装饰器是 TS 生成器路径，纯 JS 走 strict 注册） |

**实证文件**：`dsh-cordis-host-runner/lib/index.js`（harness 沙箱）、`dsh-api-gateway/lib/index.js`（typertGateway：`resolveDescriptor`→`resolveReceiverContext`→`validateBinding`→`Reflect.apply(method, receiver, args)`）、`dsh-api-gateway/lib/client.js`（`$mount` + `connection.rpc.call`）、`dsh-typert-protocol/lib/index.js`（`TypertRemoteService`/`bindTypertRemote`/`remoteMethods`）、`dsh-typert-registry`（`ctx.typert.register`/`remotes`）。

### 0.2 其它能力实证

| 能力 | 实证 API | 出处 |
|---|---|---|
| 存储域 | `ctx.storageDomain.open(spec)` → `domain.table(name).put/get/delete/update`、`domain.global`、`domain/changed`；调用方持有句柄并 `close()`（挂 `ctx.effect` disposer） | `@deepseek-ai/dsh-storage-domain`（web profile 已装，backend `json` → `~/.dsh/storages`） |
| 重新生成注入 | `ctx.agents.get(sessionId)` → `agent.followup(msg)`（排队 next-turn 并唤醒 driver）/ `agent.inject(msg)` / `agent.inbox.splice(...)` / `agent.cancel(...)` | `@deepseek-ai/dsh-agent` README（`ctx.agents` 注册表 + `Agent` 公开方法） |
| 血缘查询 | `sessionQuery.traceSession()`（祖先+后代树）、`listSessions()`、`readTitleSnapshots()` | `@deepseek-ai/dsh-session-query` |
| fork | `sessions.fork(source, boundary?, childId?)` → header 记 `parentSession/seedLength/delegationDepth` | `@deepseek-ai/dsh-session` |
| 会话日志 | 追加式事件 + `surfaceOp: replace` 遮蔽旧面；小版本存内容快照即可，不依赖回放 | `@deepseek-ai/dsh-session` |
| 插件配置 | 简单对象形式 `apply(ctx, config)`；包形式 `static Config = z.object({...})` + `constructor(ctx, config)`（schemastery 校验） | `@deepseek-ai/dsh-session-persistence-jsonl` |
| client 半区注册 | package.json `"dsh": {"client": {"platform": "web"}}` **且** exports 必须提供 `"./client"`（→ `lib/client.js`）；由 `dsh-client-modules` 扫描并服务 `/plugins/<id>/client.js` | `@deepseek-ai/dsh-client-modules` + `dsh-client-ui-conversation/package.json` |
| UI 插槽 | sidebar：`sidebar.brand.mark/name`、`sidebar.workspaces`（列表）、`sidebar.settings`、`sidebar.footer.action`；会话视图环：`conversation.view`（ui-trajectory 同机制注册标签）；消息操作：`conversation.chat.turnTail` 链（IconActions 前）；全屏浮层：`shell.overlay`（现工具栏已用） | `@deepseek-ai/dsh-client-ui-sidebar`、`dsh-client-ui-conversation` README |

---

## 1. 需求决策记录（已与用户确认）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 对话树范围 | 会话间树（fork 血缘）+ 会话内分支（消息处分叉）**都要** |
| 2 | 大版本 | **手动**创建的程序版本（LVAL 代码快照）；回退**只恢复代码文件，绝不动会话** |
| 3 | 小版本 | 消息被编辑/重新生成/回退时**自动**产生；回退消息自动回到最近小版本 |
| 4 | 开关 | 版本面板一个开关（**默认开**）控制回退目标：开=最近小版本，关=原始版本 |
| 5 | 消息操作 | 插件自行添加"编辑 / 重新生成 / 回退"动作（产品原生无此能力） |
| 6 | 分支模型 | **两种都支持**：fork 子会话（原生机制）+ 同会话虚拟分支 |
| 7 | 重新生成 | **虚拟分支重答**：在目标消息处建虚拟分支，原问题重新投入该分支让模型重答 |
| 8 | 包身份 | 沿用 `dsh-essential-tools`；LVAL 路径全部配置化（不再硬编码） |
| 9 | UI 形态 | 侧边栏会话树 + 会话内分支图 + 版本面板 + 复用现有右侧工具栏 |
| 10 | 发布 | npm publish + GitHub 仓库 + 插件清单页可见（Settings → Plugin inventory） |

---

## 2. 交付形态

### 2.1 包结构（upstream 仓库 = 源码唯一事实来源）

```
dsh-essential-tools/
├── package.json          # dsh.client 注册 + exports "./client" + 依赖 @deepseek-ai/dsh-typert-protocol
├── lib/
│   ├── index.js          # Host 半区：TypertRemoteService 子类 + ctx.typert.register + 存储域
│   └── client.js         # Client 半区：React UI（React.createElement，无 JSX/TS）+ connection.rpc.call
├── README.md             # 功能/安装/配置/发布说明
├── LICENSE
├── ARCHITECTURE.md       # 本文档
└── publish.ps1           # GitHub 推送 + npm publish
```

`package.json` 关键字段（已按 dsh-client-modules 契约核实）：

```jsonc
{
  "name": "dsh-essential-tools",
  "version": "2.0.0",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js"          // ← client 半区必需，缺了浏览器 404
  },
  "files": ["lib", "README.md", "LICENSE"],
  "dsh": { "client": { "platform": "web" } },  // ← 被 dsh-client-modules 扫描
  "dependencies": {
    "@deepseek-ai/dsh-typert-protocol": "^0.1.1-rc.2"   // Host RPC 基座
  },
  "keywords": ["dsh", "cordis", "plugin", "conversation-tree", "version-management", "deepseek-harness"]
}
```

### 2.2 永久化安装（三步）

1. 打包后 `dsh plugin --profile web add dsh-essential-tools`（本地路径或 npm 包）
2. `~/.dsh/profiles/web/cordis.patch.yml` 追加一行：

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
       rollbackTargetDefault: 'minor'   # 开关默认值：minor=最近小版本 / original=原始
   ```

3. 重启 DSH → 插件常驻（**永久**），并自动出现在 Settings → Plugin inventory。

> 单行注册即满足 Host+Client 双半区：与 `@deepseek-ai/dsh-client-ui-*` 同构（双面包）。

---

## 3. VTD 分层与数据模型（虚拟覆盖层）

**VTD（虚拟对话存储系统）** 是插件的核心引擎，位于 DSH 前端与 DSH 后端之间，作为
插件 Host 半区内的**显式模块**（进程内，不单独起服务；经 typert Remote 对外暴露，
对内经 `storageDomain`/`sessionQuery`/`agents` 等 DSH 服务取数）。三条纪律：

1. **VTD 不存对话本体**——只存虚拟层元数据（分支、消息版本、开关）；消息永远从
   DSH 会话日志读取（唯一事实源），VTD 只做**投影**。
2. **VTD 是插件内一个显式模块**（计划落为 `lib/vtd/` 目录，独立 API 面），不重复造
   DSH 已有的轮子（存储域、会话查询、fork、typert Remote）。
3. **前端"适配"= 插槽适配**：不改产品 bundle，UI 全部注册进产品插槽；客户端只经
   `connection.rpc.call('/api', 'dshEssentialTools/<method>')` 与 VTD 通信。

```
DSH 前端（产品插槽 UI：工具栏/会话树/分支图/版本面板）
        │  connection.rpc.call('/api', 'dshEssentialTools/*')
        ▼
VTD（lib/vtd/，插件 Host 半区内的虚拟覆盖层）
        │  storageDomain / sessionQuery / agents / sessions / fs / subprocess
        ▼
DSH 后端（会话日志=唯一事实源；~/.dsh/storages 落旁路元数据）
```

### 3.1 会话树（无新存储）

- 由 `SessionHeader.parentSession`（fork 血缘）+ `sessionQuery.traceSession()`（祖先+后代）推导。
- 树节点 = 会话；边 = fork 关系；可在节点上显示分支标签与大版本标记。
- 只读派生，不落盘。

### 3.2 VTD 元数据（新 storage-domain 域 `dshVersions`，旁路存储）

| 表 | 记录 | 说明 |
|---|---|---|
| `messageVersions` | `{id, sessionId, messageId, branchId?, versionIndex, cause, content, replacedSeqs[], time}` | `versionIndex: 0`=原始，`1..n`=每次变更；`cause: 'edit'\|'regenerate'\|'rollback'` |
| `branches` | `{branchId, sessionId, parentBranchId?, anchorSeq, label, ranges[{from,to}], createdAt, active}` | 虚拟分支；`ranges` 随分支活跃期追加增长 |
| `settings` | `{sessionId?, key, value}` | 回退目标开关（默认 `minor`） |

- 域声明用 `defineDomain`（带版本号，升级有机制）；经 `ctx.storageDomain.open(spec)` 打开，生命周期挂 `ctx.effect`。
- 小版本内容**直接快照存内容**（不依赖日志回放，compaction 后仍可读）。

### 3.3 程序大版本（沿用现有机制）

- `.lval-versions/<id>/` 文件快照 + `versions.json` 清单；**只动代码文件**。
- 由 config 的 `lvalRoot` 定位，不硬编码。

### 3.4 虚拟分支语义（关键设计，注入路径已实证）

- 会话日志仍是**线性追加**；分支 = 锚点 seq + 消息 seq 区间集合（`ranges`）。
- 切换分支 = 切换 `active` 标记；分支视图只渲染 `前缀(<=anchorSeq) + 本分支 ranges`。
- **重新生成**（实证路径）：`ctx.agents.get(sessionId)` → `agent.followup(reaskMessage)`；
  reask 消息带 `source: {kind:'branch-reask', branchId}` 标记（复用 UserMessage.source 溯源通道），
  分支视图隐藏该副本、直接展示原问题气泡 + 新回答。
- 分支区间增长：插件监听 `session/event`，当会话处于某分支活跃期时把新消息 seq 并入该分支 `ranges`。
- fork 子会话与虚拟分支并存：两种创建入口，统一在会话树/分支图上呈现。

---

## 4. VTD 对外 API（typert Remote，Host↔Client）

VTD 对外即 `dshEssentialTools` 服务（`TypertRemoteService` 子类，VTD 的宿主门面）。
统一返回 `{ok, error?, ...}`；client 经 `ctx.connection.rpc.call('/api', 'dshEssentialTools/<method>', {args})` 调用：

| 域 | 端点（namespace/method） | 说明 |
|---|---|---|
| tree | `dshEssentialTools/treeList` | 会话 + 血缘 + 分支摘要（一次拉全量，树在客户端渲染） |
| branch | `dshEssentialTools/branchCreate` | `{sessionId, anchorSeq, kind: 'fork-child'\|'virtual', label?}` |
| | `dshEssentialTools/branchSwitch` | `{sessionId, branchId}` |
| | `dshEssentialTools/branchList` / `branchRename` / `branchDelete` | 分支管理 |
| msg | `dshEssentialTools/msgEdit` | `{sessionId, messageId, newText}` → 追加消息 + surface replace + 记小版本 |
| | `dshEssentialTools/msgRegenerate` | `{sessionId, messageId}` → 建虚拟分支（锚定上方问题）+ `agent.followup` 注入 branch-reask 重答 |
| | `dshEssentialTools/msgRollback` | `{sessionId, messageId}` → 按开关回退（开=最近小版本，关=原始版） |
| ver | `dshEssentialTools/verMinorList` / `verMinorCompare` / `verMinorRestore` / `verMinorMessages` | 消息版本历史/diff/恢复/汇总（版本面板） |
| | `dshEssentialTools/verProgList` / `verProgCreate` / `verProgRestore` / `verProgDelete` | 程序版本（沿用 lval-ver-* 逻辑） |
| | `dshEssentialTools/verToggleGet` / `verToggleSet` | 开关读写（settings 表 + 面板 UI） |
| view | `dshEssentialTools/branchView` | `{sessionId}` → 分支列表 + 每分支消息流（前缀 + ranges，跳过 branch-reask 副本） |
| lval | `lvalInfo` / `lvalListFiles` / `lvalReadFile` / `lvalBuild` / `lvalRun` / `lvalBuildRun` | 原 LVAL 工具，保留不动 |

**Host 注册骨架（纯 JS，已实证）**：

```js
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");   // 自动注册服务 + typertRemote 绑定
    this.config = config;
  }
  async treeList(args) { /* ... */ return { ok: true, ... }; }
}

function apply(ctx, config) {
  new EssentialToolsService(ctx, config);
  ctx.typert.register({
    package: "dsh-essential-tools", face: "host", model: {}, schemas: [],
    invocations: [{
      id: "et-tree-list",
      service: "dshEssentialTools", namespace: "dshEssentialTools", method: "treeList",
      parameters: [{ name: "args", wire: "args", source: "json", codec: { mode: "src-json" } }],
      result: { mode: "src-json" },
      invocation: { kind: "direct" },
    }, /* ...每个端点一条... */],
  });
}
```

**Client 调用骨架**：

```js
// ctx.get("connection") → connection.rpc.call("/api", "dshEssentialTools/treeList", { args: {...} })
```

---

## 5. UI 布局（复用已核实的插槽）

| 能力 | 落点 |
|---|---|
| 侧边栏会话树 | 注册进 `sidebar.workspaces` 区（列表插槽，新增树形条目） |
| 会话内分支图 | 注册 `conversation.view` 视图标签"分支"（ui-trajectory 同机制），渲染分支树 + 分支感知聊天流 |
| 版本面板 | 现有右侧工具栏"🕘 版本"面板扩展：**程序版本** 页签 + **消息版本** 页签 + 回退目标开关 |
| 消息操作 | 消息行 action 链：编辑 / 重新生成 / 回退（`conversation.chat.turnTail` 链 IconActions 前；用户气泡另加） |

---

## 6. 编码规范

1. **纯 ESM JavaScript**；Client 一律 `React.createElement`，禁用 JSX/TS/import 变换。
2. **服务访问**：可选服务 `ctx.get()` 并处理 undefined；硬依赖才 `inject`。
3. **生命周期**：所有副作用（监听、定时器、插槽、样式、打开的 domain、typert 注册）挂 `ctx.effect()` / `ctx.on()`，可逆。
4. **配置**：`apply(ctx, config)` 读校验后的 config；包级 schema 用 schemastery `z.object`；所有路径/常量走 config，禁硬编码。
5. **RPC**：Host 用 `TypertRemoteService` 子类 + `ctx.typert.register`（src-json codec）；Client 用 `ctx.connection.rpc.call('/api', ...)`；返回 `{ok, error, ...}`；参数校验失败返回 error 而非抛异常。**不要用 `harness.handle`/`host.call`（那是动态插件沙箱专属，永久包没有）。**
6. **存储**：`defineDomain` 声明带版本号的域；写失败不改内存（域层保证）；只经 domain 句柄读写，不直碰后端文件。
7. **错误**：宿主错误消息用中文，携带稳定 code（如 `SESSION_NOT_LOADED`）。
8. **风格**：沿用现有 host.js/client.js 的写法（小函数、纯逻辑、一次性创建 React 元素树）。
9. **安全**：路径白名单校验（沿用 `safeRel`）；删除类操作二次确认；回退程序版本前自动备份。
10. **兼容**：会话日志格式版本不变更（小版本/分支都是旁路数据，不写进 SessionEventMap 核心语义）。

---

## 7. 发布流程（publish.ps1 扩展）

1. `npm login` + `npm version patch` + `npm publish`（npm 包可被 `dsh plugin add` 安装）
2. `gh repo create DSHEssentialTools --public --source . --remote origin --push`（现有逻辑）
3. 公众关注度：npm keywords + GitHub topics（`dsh`、`deepseek-harness`、`plugin`、`conversation-tree`、`version-management`）+ README 展示截图/功能表；插件自动出现在 DSH Plugin inventory 页。

---

## 8. 实现阶段划分

| 阶段 | 内容 | 验收 |
|---|---|---|
| M0 | 包结构重构：host/client 拆入 lib/、package.json `dsh.client`+exports、路径配置化、typert RPC 骨架 | 本地装入 web profile，重启常驻，工具栏可用 |
| M1 | 会话树：host 推导 + 侧边栏树 UI（VTD 只读投影） | 侧边栏显示 fork 血缘树，点击切换会话 |
| M2 | VTD 元数据域 `dshVersions`：`messageVersions`/`branches`/`settings` 表 + 编辑/回退 + 开关 | 编辑后旧版可查可回退，开关生效 |
| M3 | 虚拟分支：分支表 + 重新生成（`agent.followup`）+ 分支图视图 + 切换 | 重新生成产生新分支，分支图可切换查看 |
| M4 | 版本面板整合：程序+消息+开关+diff | 面板完整可用 |
| M5 | 发布：npm + GitHub + README/关键词 | `dsh plugin add` 可装，仓库公开 |

---

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| **harness.handle 在永久包中不可用** | **已实证并修正**：改用 typert Remote（§0.1/§4），M0 起按此实现 |
| 虚拟分支与产品聊天视图的渲染集成复杂 | 分支图作为独立 `conversation.view` 标签渲染，不改产品默认视图 |
| 重新生成驱动 agent 循环 | **已实证**：`ctx.agents.get(id)` + `agent.followup()` 公开 API，不深入 agent 内部 |
| replace 语义（compaction 交互） | 小版本存内容快照，回退走 replace 追加，与 compaction 机制一致 |
| client 半区 404（exports 缺失） | M0 起就按 `dsh-client-modules` 契约提供 `./client` export，先本地验证再发布 |
| 产品升级覆盖 | 插件是独立 npm 包 + profile patch 行，升级产品不影响 |

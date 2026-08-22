# dsh-essential-tools — 架构与编码规范（v2 永久插件）

> 目标：把现有"动态插件"升级为 **DSH 永久插件**（随 web profile 常驻、重启不丢），
> 并新增两大能力：**对话树**（会话间血缘树 + 会话内分支图）与**版本管理**
> （程序大版本 + 对话消息小版本）。最终发布到 npm 与 GitHub。

---

## 0. 技术底座实证（已在本机运行时核实）

以下 API 均从已安装包源码核实，是实现的硬依据：

| 能力 | 实证 API | 出处 |
|---|---|---|
| 存储域 | `ctx.storageDomain.open(spec)` → `domain.table(name).put/get/delete/update`、`domain.global`、`domain/changed` 事件；调用方持有句柄并 `close()`（挂 `ctx.effect` disposer） | `@deepseek-ai/dsh-storage-domain`（web profile 已装，backend `json` → `~/.dsh/storages`） |
| 重新生成注入 | `ctx.agents.get(sessionId)` → `agent.followup(msg)`（排队 next-turn 并唤醒 driver）/ `agent.inject(msg)`（next-step 不唤醒）/ `agent.inbox.splice(...)` / `agent.cancel(...)` | `@deepseek-ai/dsh-agent` README（`ctx.agents` 注册表 + `Agent` 公开方法） |
| 血缘查询 | `sessionQuery.traceSession()`（祖先+后代树）、`listSessions()`、`readTitleSnapshots()` | `@deepseek-ai/dsh-session-query` |
| fork | `sessions.fork(source, boundary?, childId?)` → header 记 `parentSession/seedLength/delegationDepth` | `@deepseek-ai/dsh-session` |
| 会话日志 | 追加式事件 + `surfaceOp: replace` 遮蔽旧面；小版本存内容快照即可，不依赖回放 | `@deepseek-ai/dsh-session` |
| 插件配置 | 简单对象形式 `apply(ctx, config)`；包形式 `static Config = z.object({...})` + `constructor(ctx, config)`（schemastery 校验） | `@deepseek-ai/dsh-session-persistence-jsonl` |
| client 半区注册 | package.json `"dsh": {"client": {"platform": "web", "inject": [...]}}` **且** exports 必须提供 `"./client"`（→ `lib/client.js`）；由 `dsh-client-modules` 扫描并服务 `/plugins/<id>/client.js` | `@deepseek-ai/dsh-client-modules` + `dsh-client-ui-conversation/package.json` |
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
├── package.json          # dsh.client 注册 + exports "./client"
├── lib/
│   ├── index.js          # Host 半区：服务、RPC、存储域
│   └── client.js         # Client 半区：React UI（React.createElement，无 JSX/TS）
├── README.md             # 功能/安装/配置/发布说明
├── LICENSE
├── ARCHITECTURE.md       # 本文档
└── publish.ps1           # GitHub 推送 + npm publish
```

`package.json` 关键字段（已按 dsh-client-modules 契约核实）：

```jsonc
{
  "name": "dsh-essential-tools",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js"          // ← client 半区必需，缺了浏览器 404
  },
  "files": ["lib", "README.md", "LICENSE"],
  "dsh": { "client": { "platform": "web" } },  // ← 被 dsh-client-modules 扫描
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

## 3. 数据模型

### 3.1 会话树（无新存储）

- 由 `SessionHeader.parentSession`（fork 血缘）+ `sessionQuery.traceSession()`（祖先+后代）推导。
- 树节点 = 会话；边 = fork 关系；可在节点上显示分支标签与大版本标记。
- 只读派生，不落盘。

### 3.2 消息小版本（新 storage-domain 域 `dshVersions`）

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

## 4. RPC API（Host ↔ Client，harness.handle / host.call）

统一返回 `{ok, error?, ...}`；方法名 `dsh-<域>-<动作>`：

| 域 | 方法 | 说明 |
|---|---|---|
| tree | `dsh-tree-list` | 会话 + 血缘 + 分支摘要（一次拉全量，树在客户端渲染） |
| branch | `dsh-branch-create` | `{sessionId, anchorSeq, kind: 'fork-child'\|'virtual', label?}` |
| | `dsh-branch-switch` | `{sessionId, branchId}` |
| | `dsh-branch-list` / `dsh-branch-rename` / `dsh-branch-delete` | 分支管理 |
| msg | `dsh-msg-edit` | `{sessionId, messageId, newText}` → 追加消息 + surface replace + 记小版本 |
| | `dsh-msg-regenerate` | `{sessionId, messageId}` → 建虚拟分支 + `agent.followup` 重答 |
| | `dsh-msg-rollback` | `{sessionId, messageId}` → 按开关回退（开=最近小版本，关=原始版） |
| ver | `dsh-ver-minor-list` / `dsh-ver-minor-compare` / `dsh-ver-minor-restore` | 消息版本历史/diff/恢复 |
| | `dsh-ver-prog-*` | 程序版本（沿用 lval-ver-* 逻辑） |
| | `dsh-ver-toggle-get` / `dsh-ver-toggle-set` | 开关读写（settings 表 + 面板 UI） |
| lval | `lval-info/list-files/read-file/build/run/build-run` | 原 LVAL 工具，保留不动 |

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
3. **生命周期**：所有副作用（监听、定时器、插槽、样式、打开的 domain）挂 `ctx.effect()` / `ctx.on()`，可逆。
4. **配置**：`apply(ctx, config)` 读校验后的 config；包级 schema 用 schemastery `z.object`；所有路径/常量走 config，禁硬编码。
5. **RPC**：`harness.handle('dsh-<域>-<动作>', ...)`；返回 `{ok, error, ...}`；参数校验失败返回 error 而非抛异常。
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
| M0 | 包结构重构：host/client 拆入 lib/、package.json `dsh.client`+exports、路径配置化 | 本地装入 web profile，重启常驻，工具栏可用 |
| M1 | 会话树：host 推导 + 侧边栏树 UI | 侧边栏显示 fork 血缘树，点击切换会话 |
| M2 | 消息小版本：域表 + 编辑/回退 + 开关 | 编辑后旧版可查可回退，开关生效 |
| M3 | 虚拟分支：分支表 + 重新生成（`agent.followup`）+ 分支图视图 + 切换 | 重新生成产生新分支，分支图可切换查看 |
| M4 | 版本面板整合：程序+消息+开关+diff | 面板完整可用 |
| M5 | 发布：npm + GitHub + README/关键词 | `dsh plugin add` 可装，仓库公开 |

---

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 虚拟分支与产品聊天视图的渲染集成复杂 | 分支图作为独立 `conversation.view` 标签渲染，不改产品默认视图 |
| 重新生成驱动 agent 循环 | **已实证**：`ctx.agents.get(id)` + `agent.followup()` 公开 API，不深入 agent 内部 |
| replace 语义（compaction 交互） | 小版本存内容快照，回退走 replace 追加，与 compaction 机制一致 |
| client 半区 404（exports 缺失） | M0 起就按 `dsh-client-modules` 契约提供 `./client` export，先本地验证再发布 |
| 产品升级覆盖 | 插件是独立 npm 包 + profile patch 行，升级产品不影响 |

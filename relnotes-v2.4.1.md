# DSHEssentialTools v2.4.1 — 浏览器桥稳定性 + 安全加固 + 全新 README / 用户指导手册

> 一次「把 v2.4.0 的浏览器控制真正跑稳」的补丁版，外加安全加固与两份文档。
> **npm 已上线**：`dsh-essential-tools@2.4.1`（`latest`）。

## 📦 安装 / 升级

```powershell
# 安装器（推荐：装包 + 幂等注册进 DSH profile）
.\install.ps1 -Profile web

# 或手动
dsh plugin --profile web add dsh-essential-tools
```

- npm：**`dsh-essential-tools@2.4.1`**（dist-tag `latest`）→ https://www.npmjs.com/package/dsh-essential-tools
- 浏览器扩展**不随 npm 包发布**，请从本仓库 `browser-extension/` 目录本机装载（`edge://extensions` → 开发人员模式 → 加载解压缩的扩展）。
- 升级后请**重启 DSH + 强刷**（Ctrl+F5）。

## 🌐 浏览器控制：两个真机才会暴露的坑，修了

- **桥只保留最新一条扩展连接**
  MV3 Service Worker 重启 / 扩展重载后，旧 socket 可能残留（`close` 事件没触发）。此时命令会发到**死连接**上，表现为**间歇性 `browser-timeout`**（实测见过 6 条残留）。现在：新连接建立时清掉更早的连接，取连接时取**最后加入**的一条。
- **档位切换改为经 background 的 `setMode` RPC**
  弹窗 / 选项页不再直接写 `chrome.storage`，而是 `chrome.runtime.sendMessage({type:'setMode'})` → 同时**持久化 + 更新徽标 + 通知宿主**。修掉「我把扩展改成『启用』了，`det_browser` 还是报 `ext-mode-off`」（旧写法下宿主收不到通知，继续按旧档位拒绝）。
- 扩展版本 `1.0.2`；新增 `alarms` 权限与 `file:///*` 主机权限。

## 🔒 安全加固

- **DNS rebinding 防护**：`_fetch` 在 DNS 解析**之后**再看真实地址（`dns.lookup(host,{all:true})` → 逐个判私网/保留段），命中即拒——纯主机名黑名单挡不住「公网域名解析到内网」。
- **超时与响应体上限**：`_fetch` / 余额 / 单价统一 **15s 超时**（此前一个不响应的主机能把端点挂死）；读响应体**之前**先校验 `Content-Length`，避免超大响应整体进内存。
- **命令注入加固**：所有 `cmd.exe` 调用（`mkdir` / `rmdir`）路径整体加引号——未加引号时空格会被 `cmd /c` 拆成多个参数，`& | ^` 等元字符会被解释执行；版本 id 另有白名单校验。
- **扫描器去误报**：`exec(` / `child_process` 规则加词边界，`browserExec(` 不再被误报为进程执行。

## 🐛 修复

- inventory 行的 `packages` 可能缺失（不同 DSH 版本）→ 复用动态插件时加容错，避免 TypeError。
- GitHub 商店搜索结果补齐 `name` / `verificationStatus`，否则模型工具的 output schema 会拿到 `undefined` 而被判为非法 JSON。
- 余额缓存 TTL 8s → 4s，配合前端 5s 轮询更跟手。

## 📚 文档

- **重写 [`README.md`](https://github.com/LLYlab/DSHEssentialTools#readme)**：痛点表 → 亮点巡礼（浏览器控制 / VTD / 工程工具 / 插件管理 / MDA·CDM·TCT / 成本与权限）→ 60 秒快速开始 → 文档索引 → 安全一句话。
- **新增面向使用者的 [`docs/GUIDE.md` 用户指导手册](https://github.com/LLYlab/DSHEssentialTools/blob/main/docs/GUIDE.md)**：安装与验证、五分钟上手、逐功能详解、权限模型（网络五档 / 审批 / 插件代码不是沙箱）、浏览器扩展装载与四档开关、配置与数据位置、FAQ、故障排查、卸载与回滚、速查表。
- `CHANGELOG.md` 与 `docs/SECURITY.md` 同步更新；`docs/banner.svg` 换了新版标语与 `v2.4.1` 徽标。
- 维护者向：`docs/DET发布.md` 记录了 npm 2FA / 凭据的正确姿势；新增 `publish-otp.ps1`（非交互环境用一次性口令完成发布 + 校验）。

## ✅ 发布前自检

- `node --check` 全部 `lib/*.js` 与扩展 `background.js` / `options.js` / `popup.js` 通过；`manifest.json` 可解析（v1.0.2）。
- npm 包 19 个文件 / 182.3 kB（含 GUIDE 与 SECURITY，**不含** `browser-extension/` 与 `*.ps1`），shasum `00c1263…`，`_npmUser = llylab`。
- 本机 / 远程 `main` == tag `v2.4.1`，工作区干净。

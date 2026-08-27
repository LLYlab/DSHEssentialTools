# Security

本文件记录 dsh-essential-tools 的安全设计、已落实的缓解措施与已知边界（面向开源发布与使用者）。

## 五维审查结论（2026 年审查版）

### 1) 插件越权
- 模型工具（`det_global_plugin_*`）只能作用于**当前会话**（工具执行上下文 `exec.agent` 即调用会话），档位（全局启用/可自行启用/需审批/不再会有新启用/全局禁用）在宿主侧强制执行，客户端不可绕过；审批路径复用 DSH 动态 Cordis 审批，`awaiting-approval` 后模型侧被禁止重试。
- 设置页（typert 端点）为**本机单用户 GUI** 能力面：接受任意 sessionId 是产品语义（用户手动在任意会话启用/停用），无多用户/多租户概念；所有写操作（档位/删除/启用）均有确认与可读错误。
- 已修复：`verProgDelete` / `verProgRestore` 的版本 id 现在经过白名单校验（`^[A-Za-z0-9_-]{1,64}$`）**且必须存在于清单**，杜绝 `rmdir /s /q ..\..\X` 式目录穿越删除/任意目录读取回写。
- 已知边界：全局插件代码与动态 Cordis 插件一致，以**当前进程真实权限**运行；DSH 官方对动态代码的沙箱仅防误用，**不是安全边界**（官方文档口径）。设置页/工具均明示此口径。

### 2) 混入恶意代码
- 引入通道：① 从对话 Cordis 拉取（代码本就在本进程执行过，无新增暴露面）② URL 下载 ③ GitHub 商店安装。所有通道均：
  - 大小上限（host/client ≤ 512KB 字符）、名称/描述长度限制、非 JSON 单文件滚动告警；
  - 安装/下载前安全提示 + 确认（明文说明"以当前进程权限运行"）；
  - `dsh-plugin.json` 清单 / `plugin/host.js`+`plugin/client.js` 约定格式；商店安装记录 **commit sha**（`originRef = repo@branch@sha`）供溯源；
  - **可疑特征扫描**（`scanCodeWarnings`，黑名单启发式：eval/new Function、child_process、exec、process.env、require 逃逸、原始 socket/http.request、fetch、Cookie/localStorage、base64 混淆、遥测上报、疑似硬编码密钥 `sk-`、超长单行混淆）——结果在 **安装/下载返回提示** 与 **设置页「预览代码」** 展示。
- 已知边界：黑名单启发式**不是安全边界**（无法证明无恶意行为）；真正边界 = 用户审批 + 信任来源 + 官方沙箱不可靠假设。不提供任何"加白/签名"升级前，请只启用你审查过/信任的代码。

### 3) 容易出 bug（本次修复）
- 重复「拉取/下载/安装」同一插件不再清空既有档位与各会话启用映射（`upsert` 保留 `level`/`sessions`，仅更新代码与元数据；兼容早期 `gp-gp-*` 前缀数据）。
- 版本快照 id 统一白名单；未配置工作区（默认值中性化后）各端点返回明确错误而非落到进程 CWD。
- 其余已知薄弱点（已记录、供后续改进）：启停后再启会产生新 Cordis 插件实例（旧的停止的残留在会话清单，属噪音）、`gpSync` 恢复依赖会话打开时机、设置页"本会话启用"状态在会话切换间可能短暂滞后。

### 4) 外部攻击面
- **SSRF 防护**（新增）：所有宿主网络抓取（下载 URL、清单 `hostUrl/clientUrl`、GitHub 内容 API）经 `safeHttpUrl`：仅 http/https、拒绝 URL 内嵌凭据、**拒绝私网/环回/链路本地/云元数据**（含 IPv4 保留段、IPv6 `::1`/ULA/link-local、`::ffff:` 映射的点分与十六进制形式、`localhost`/`.local`/`.internal`/`.localhost`）；重定向**手动跟随、每一跳复验**、最多 5 跳。
- 余额/定价只访问官方主机（`api.deepseek.com` / `api-docs.deepseek.com`），并校验**最终响应主机仍为官方**（防重定向劫持）。
- **凭据**：API key 仅由宿主解析（配置 → DSH 凭据缝 → 环境变量），只存在于请求头；不落盘、不进日志、不返回浏览器/客户端；错误提示只含引用名（如 `DEEPSEEK_API_KEY`）。
- **XSS**：客户端全部经 React 渲染（无 `innerHTML`/`dangerouslySetInnerHTML`/jQuery），插件名/描述/摘要/README/官网 note 均为文本节点。
- **DoS**：fetch 响应大小上限（下载 ≤1MB、GitHub 内容 ≤3MB 传输）、横幅上限、清单/代码上限、搜索结果 ≤15 条、余额 60s / 价格 6h 缓存节流。
- 已知边界：DSH 核心（Web 服务绑定地址、`/api` 的 Origin/跨域策略、Typert 网关鉴权）不属于本插件——若你的 DSH 暴露到公网/局域网，请另行评估；本机使用模型下插件按"单用户自用"设计。

### 5) 开源时个人信息与 API 泄露
- 已扫描全仓库（含 git 历史）与机密模式（`sk-…`、内嵌 Bearer、`api_key=` 等）：**未发现任何真实密钥**。
- 已**中性化**：宿主配置默认值中的个人路径（`C:\Users\<用户名>\Desktop\项目\LVAL` 等）→ 空/占位默认，配合会话 cwd 或 `cordis.patch.yml` 显式配置；README 示例本来就用占位路径。
- 凭据实际存放于 DSH 域（`~/.dsh/credentials*.yaml` / 模型设置），**不在本仓库**；`cordis.patch.yml` 属于用户 profile（`~/.dsh/profiles/...`），不在仓库内。
- 保留标注：LICENSE 版权行为作者公开署名（`L2959159224`，与 npm `author` 一致）——属作者有意披露；若不想保留可自行修改。
- 开源前建议（发布侧）：发布前 `git log -p | grep -i "sk-"` 复核、启用 GitHub secret scanning、`.gitignore` 已含 `node_modules`/本地数据目录。

## 已落实修复清单（本次审查）
1. `verProgDelete`/`verProgRestore`/`_restoreVersionById`：**版本 id 白名单 + 清单存在性校验**（路径穿越/任意目录删除-读取）。
2. 宿主网络抓取：**SSRF 防护**（私网/环回/元数据/IPv6 映射拒绝、重定向逐跳复验、内嵌凭据拒绝）。
3. 全局插件 `upsert`：重复导入**保留档位与会话启用映射**；id 规范化兼容旧数据。
4. 商店安装记录 **commit sha**、返回并展示**可疑代码扫描结果**；新增 `gpCode`（代码预览 + 扫描）端点与设置页「预览代码」。
5. 余额/定价：校验**最终官方主机**（防重定向劫持）。
6. 配置默认值**去个人化**（中性占位）；未配置时端点明确报错，不再落到进程 CWD。
7. 客户端 `DsModelPrice` 等仅 React 文本渲染复核（无 unsafe HTML）。

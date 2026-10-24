# DET 功能说明 (dsh-essential-tools)

> 面向 **AI / 模型**的功能速览。DET = DSH 永久宿主插件（`dsh-essential-tools`），随 web profile 常驻。
> 宿主 = `lib/index.js`（75 个端点，其中 25 个注册为模型工具）；浏览器 = `lib/client.js`。

---

## 一、能力总览（按"谁看得见"分类）

| 类别 | 模型可见？ | 入口 |
| --- | --- | --- |
| LVAL 运行 / 文件 / 版本 | ✗（仅 GUI） | 右侧工具栏 ▶ 🗎 🕘 |
| VTD 对话树（编辑/重试/分叉） | ✗（仅 GUI） | 对话页签 + 消息操作条 |
| 全局插件管理 | ✓ 10 个工具 | `det_global_plugin_*` |
| 网络权限（5 档） | ✗（仅 GUI） | 输入框内联 + DET 管理器 |
| 浏览器控制 | ✓ 6 个工具 | `det_browser`、`web_*` |
| MMS 混合模型 | ✓（开关开时才注册） | `det_mms` |
| TCT 临时对话 | ✓ | `det_tct` |
| CDM 跨对话记忆 | ✓ | `cdm_list` / `cdm_search` / `cdm_read` |
| MDA 分层 / 模型合作 | ✓ | `mda_list_areas` / `mda_card` / `mda_activate` / `mda_create_no_workspace_agent` |
| 安全审计 | ✗（仅 GUI） | 工具栏 🛡 + 设置页 |
| 余额 / 单价 / 本对话花费 | ✗（仅 GUI） | 右下角状态框 |
| DET 管理器（总开关 + 功能开关） | ✗（仅 GUI） | 设置 → DET 管理器 |
| DLT 集成（文档 / 执行 / 环境） | ✓ 6 个工具 | `dlt_env` / `dlt_run` / `dlt_build` / `dlt_doc_*` |
| **ALV 辅助线视觉** | ✓ 8 个工具 | `alv_info` / `grid` / `crop` / `edges` / `ocr` / `tile` / `annotate` / `enhance` |
| **ADU 按需装载** | ✓ 6 个元工具 | `adu_list` / `describe` / `load` / `unload` / `status` / `rememory` |

---

## 二、模型工具（45 个，名称即调用名）

> **ADU 按需模式下，启动时只注册 6 个 `adu_*` 元工具**；下表其余工具由 `adu_load` 按模块现装，
> 装载是**粘性**的（重启后自动装回）。完整模块划分见「十三、ADU 按需装载」。

**全局插件库（10）**：`det_global_plugin_list` / `_enable` / `_disable` / `_scan_installed` / `_import_installed` / `_set_enabled` / `_store_search` / `_github_direct` / `_github_rebuild` / `_github_save`

**记忆与模型（9）**：`det_tct`、`cdm_list` / `cdm_search` / `cdm_read`、`mda_list_areas` / `mda_card` / `mda_activate` / `mda_create_no_workspace_agent`、`det_mms`（开关开启才注册）

**浏览器（1 + 5）**：`det_browser`（list_tabs / read_text / read_dom / screenshot / get_url / get_title / navigate / click / fill / run）、`web_inspect` / `web_act` / `web_focus` / `web_human_search` / `web_insite_search`

**DLT（6）**：`dlt_env` / `dlt_run` / `dlt_build` / `dlt_doc_read` / `dlt_doc_write` / `dlt_doc_convert`

**ALV（8）**：`alv_info` / `alv_grid` / `alv_crop` / `alv_edges` / `alv_ocr` / `alv_tile` / `alv_annotate` / `alv_enhance`

**ADU（6）**：`adu_list` / `adu_describe` / `adu_load` / `adu_unload` / `adu_status` / `adu_rememory`

---

## 三、GUI 界面（5 个原生插槽）

| 界面 | 插槽 | 内容 |
| --- | --- | --- |
| 右侧竖排工具栏 | `shell.overlay` | 🧩插件 / ▶运行 / 🗎文件 / 🕘版本 / 🛡安全 |
| 右下角状态框 | `shell.overlay` | 价格（峰/谷 + 命中/未命中/输出）+ 余额 + 本对话花费 + MMS 开关（旁带一句话说明），**5s 轮询**；点击展开详情卡（层级 9998，高于所有 DET 面板） |
| 网络权限内联 | `conversation.input.left` | 5 档下拉 |
| VTD 对话树 | `conversation.view` | 完整树视图 + 生成中流式刷新 |
| 消息操作条 | `conversation.chat.user-actions` | 编辑 / 重试 / `<N>` 分叉选择 |
| DET 管理器 | `settings.section` | **总开关（完全原生 ↔ 扩展）** + 功能装载/卸载 + 自检/调试 |
| 全局插件管理 | `settings.section` | 五档控制 / 会话启停 / 代码预览 / 商店（总开关关闭时不注册） |
| MDA 分组 | `settings.section` | 分组模式 + 分组树（总开关关闭时不注册） |

> 快捷键：**Esc** 关闭任意已打开面板。
>
> **总开关（`det.features.master`，默认开）**：关闭时上表除「DET 管理器」外全部不注册，同时宿主侧卸下全部 `det_*` / `web_*` 工具、系统提示注入、安全审计监听、浏览器桥与会话登记自检，并**一并停用 DET 管控的插件**（范围只限「全局插件库」里绑定过 loader 条目的记录;停用后回读 loader 核对，停不下来的如实标「未能停用」；不在库里的常驻插件如 `dlt` 各有自己的开关，本开关不碰；快照 `det.master.paused` 带 `applied`，重新打开自动恢复，关闭态页面会列出清单与未绑定项）—— DET 对 DSH 的改动只剩设置页里的这个开关。
>
> **全局插件管理的指示 = 实际**：常驻插件按宿主 loader 的 `entry.disabled` 显示（记录不一致时自动回写纠正并标注,附 `fiber` 阶段）；会话状态区分「运行中 / 已启用记录·未运行 / 未打开·打开后恢复」。端点 `gpList` 返回 `globallyEnabled`(已按实际)、`actualEnabled`、`fiberPhase`、`stateMismatch`、`sessions[sid].{running,recordEnabled,stale}`；`gpMasterState` 返回总开关与被停用插件清单。

---

## 四、网络调用权限（5 档，持久化键 `det.webperm`）

| 档 | key | rank | 含义 |
| --- | --- | --- | --- |
| 禁用网络 | `off` | 0 | 禁止一切网络访问 |
| 官方API搜索 | `api` | 1 | 仅 DeepSeek 官方搜索 API（余额/单价也需要 ≥1） |
| 搜索API搜索 | `search` | 2 | 允许搜索类 API；通用抓取需 ≥2 |
| 静默浏览器仿真 | `silent` | 3 | 允许无头浏览器仿真（读网页） |
| 使用用户浏览器 | `browser` | 4 | **驱动用户浏览器**（`det_browser` 需 =4） |

- 模型通过系统提示感知当前档位；DET 对自身请求按档位拦截（`_webPerm` / `WEB_FETCH_MIN`）。
- 浏览器控制还需扩展已连接且处于开启档位。

---

## 五、浏览器控制（扩展方案）

- 扩展（Edge/Chrome MV3，`browser-extension/`）经本地 WS（`127.0.0.1:9123`）连宿主 `lib/browser.js`。
- 扩展四档（关闭/只读/只写/启用）**由用户在扩展弹窗控制，DSH 只读**。
- 门禁：扩展档位 + 宿主网络权限第 4 档。
- ⚠️ 已知边界：桥无共享密钥，本机任意进程均可连接；`write` 档允许 `run`（页面任意 JS），能力强于"不回传内容"的表述。

---

## 六、全局插件库（5 档）

| 档 | key | 行为 |
| --- | --- | --- |
| 全局启用 | `always` | 每个会话自动挂载 |
| 对话AI可自行决定启用 | `ai-auto` | AI 可自行启用，无需审批 |
| 对话内AI需审批启用 | `ai-approve` | 默认；须用户批准 |
| 不再会有新启用 | `frozen` | 拒绝新启用，已启用会话保持 |
| 全局禁用 | `disabled` | 立即停所有实例并拒绝启用 |

- 常驻插件（如 dbs）走**二分「启用/禁用」**（`det_global_plugin_set_enabled`，实时经 loader 卸载/装载，跨重启持久化）。
- 商店搜索支持 4 源：`github` / `marketplace` / `leaderboard` / `radar`。
- ⚠️ 全局插件代码以**当前进程真实权限**运行；`scanCodeWarnings` 只是提示性启发式，**不是安全边界**。

---

## 七、MMS / TCT / CDM / MDA

- **MMS（混合模型）**：开关独立于 DET 管理器（余额栏）。开启才注册 `det_mms` 与提示；关闭彻底隐藏。
- **TCT（临时对话）**：`det_tct`，一次性 prompt + 可选 preset（review/summary/format/brainstorm）+ 权限白名单 → 单段 feedback，会话即焚、无持久化。模型可在 DET 设置内选。
- **CDM（跨对话记忆）**：`cdm_list` / `cdm_search`（默认限当前工作区，`cross=true` 提权）/ `cdm_read`。
- **MDA（分层）**：模式 `native` / `workspace` / `model`；`mda_list_areas` 看分组，`mda_card` 生成模型介绍（用 TCT），`mda_activate` 激活其它模型（⚠ 耗提示词，不鼓励），`mda_create_no_workspace_agent` 建无工作区 Agent（cwd = `DSH_HOME\MDAtemp\<名>`）。

---

## 八、安全审计

- 开关：`secCmdAudit`（AI 命令审计）/ `secPromptDefense`（Prompt 攻击防御）。
- 开启时宿主注册 `tools/pre-execute` 瀑布，对工具调用做**一次独立模型审计**，高风险 `deny` 并写 `det.secAudit.log`。
- ⚠️ 成本：审计在**每次工具调用**前串行跑 LLM，开启后延迟明显。

---

## 九、存储域

| 域 | 版本 | 表 | 文件 |
| --- | --- | --- | --- |
| `dsh_versions` | 2 | minor_versions / sessions / settings | `~/.dsh/storages/dsh_versions.json` |
| `dsh_global_plugins` | 1 | plugins / store_cache / boot | `~/.dsh/storages/dsh_global_plugins.json` |
| `dsh_mda` | 1 | mode / areas / model_cards | `~/.dsh/storages/dsh_mda.json` |

关键键：`det.features`、`det.webperm`、`mms.model`、`det.secAudit.log`、`tct.model`、`det.registry.check`。

---

## 十、峰值时段

北京时间（UTC+8）周一至周五 **9:00–12:00、14:00–18:00** = 峰；其余 = 错峰。宿主 `isDsPeakNowHost()` 与前端 `isDsPeakNow()` 一致，用于状态框价格档位与本对话花费估算。

---

## 十一、DLT 集成（DET 自带引擎，DLT 本体停摆）

DET 总开关打开时，DLT（`dsh-light-tool`）的宿主侧能力由 DET 自己提供，DLT 本体整体停摆（工具/提示/界面/设置页都不再出现）。

| 功能键 | 内容 |
| --- | --- |
| `dltEnv` | `dlt_env` + 系统提示里的本机工具链清单（MSVC/MSBuild/cmake/ninja/Python/Node/git/dotnet/Office COM/Edge） |
| `dltRun` | `dlt_run` 直接跑程序、`dlt_build` 编 MSBuild 工程 |
| `dltDocs` | `dlt_doc_read` / `dlt_doc_write` / `dlt_doc_convert`（PDF/Word/Excel/CSV，py312 引擎） |
| `dltPreview` | 右栏 docx/xlsx/csv 预览（依赖文档工具） |
| `dltCost` | 每条回答尾部的「本轮 ¥x.xx」小签 |
| `dltDraft` | 输入框「+」旁的草图按钮（关掉则由独立包 `dsh-sketch-draft` 接手） |

---

## 十二、ALV 辅助线视觉（图片精确识别）

视觉模型看的是「一张图」，不是「一个坐标系」。ALV 用纯几何（无 ML、无网络、无 API Key）把脚手架造出来，
再让模型亲自 `read_image` 看。引擎随包：`py/alv.py`（Pillow + numpy + OpenCV，python312 环境）
与 `py/alv_ocr.ps1`（Windows.Media.Ocr 的 WinRT 桥，离线、带逐词包围盒）。

| 工具 | 作用 |
| --- | --- |
| `alv_info` | 尺寸/模式/DPI/亮度/暗像素比例/16 段直方图（可选噪声）→ 决定要不要裁剪放大或二值化 |
| `alv_grid` | 栅格 + 四周坐标标尺 + **任意位置辅助线**（`guides:{horizontal:[470],vertical:[430]}`），回传 `toSource` |
| `alv_crop` | 精确裁剪 / 自动裁空白 / 放大（小字先放大再 OCR） |
| `alv_edges` | Canny + 概率霍夫 → 线段 + **合并后的行/列边线位置**（`{y,votes}`）；标签画在左侧边栏里，不压正文 |
| `alv_ocr` | 本机离线 OCR；`mode=lines` 自动合并中文词间空格，`mode=cells` 逐格出**表格矩阵** |
| `alv_tile` | 带重叠切块 + 放大，大字图分块看 |
| `alv_annotate` | 按坐标画 box/line/arrow/cross/circle/text（把「我算出来的位置」画给人看） |
| `alv_enhance` | 灰度/自动对比度/自适应二值化/锐化/放大（`auto` 全上） |

**坐标约定**：一律是**原图左上角为原点**的像素坐标；任何改变画布的工具都回传 `toSource`。

---

## 十三、ADU 按需装载（AutoDETUsage）

启动只装 6 个元工具，其余按需装载；**装载粘性**（重启后仍在），ADU 不会主动卸载。

| 模块 | 工具数 | 说明 |
| --- | --- | --- |
| `plugins` | 19 | 全局插件库 + CDM + TCT + MDA + MMS（权限面最大的一块） |
| `browser` | 1 | `det_browser` |
| `web` | 5 | `web_inspect` / `web_act` / `web_focus` / `web_human_search` / `web_insite_search` |
| `dlt` | 6 | 文档 / 执行 / 环境 |
| `alv` | 8 | 辅助线视觉八件套 |
| `security` / `project` | — | 常驻（纯监听 / 端点），不是装载单元 |

- 装载落盘在 `det.adu.mounted`，宿主启动时自动恢复。
- **`adu_rememory`**：长对话被压缩后，工具 schema 还在但用法常被摘要掉 —— 它把「有哪些工具、怎么调、干什么」
  压成一张索引表重新注入（45 条），**不重新装载、也不占工具 schema 预算**。
- 关掉「ADU 按需装载」或设 `aduBoot: "eager"` 即回到一上来全装（即时生效，无需重启）。

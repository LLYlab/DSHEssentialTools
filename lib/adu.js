// dsh-essential-tools — ADU（AutoDETUsage）Host 半区
//
// 问题：DET 的宿主半区一次性把 30+ 个模型工具塞进上下文。工具越多，
//   每一次请求的 schema 预算越大、模型挑错的概率越高，而绝大多数回合
//   只用到其中一两个（比如只读文档时，浏览器/插件库/图像工具全是噪音）。
//
// ADU 的做法：**先给一张表，再按需装载**。
//   · 启动时 DET 只注册 5 个 adu_* 元工具（+ 始终在线的管理器端点）；
//   · adu_list   → 拿到模块表（每个模块多少工具、干什么、值不值得装）
//   · adu_describe → 深入查一个模块：逐个工具的用途/参数/风险/端点/界面
//   · adu_load   → 真正装载该模块（等价于打开对应功能开关，即时生效）
//   · adu_unload → 卸下（回到轻装状态）
//
// 这不是"另一个开关面板"，而是**装载协议**：模块表是唯一事实源，
// 装载动作走的是 DET 既有那套 disposer 装卸管线（与总开关同一根管道），
// 所以 ADU 装/卸与 UI 上点开关的结果完全一致，不会出现两套状态。
//
// 与总开关的关系：总开关关掉 = 完全原生，ADU 也一起停；
// ADU 关掉（adu.enabled=false）= 回到"一上来全装"的老行为。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { svc, SERVICE } from "./adapt.js";

export const ADU_FEATURE_KEYS = ["adu"];

export const ADU_FEATURE_META = {
  adu: {
    label: "ADU 按需装载",
    desc: "启动时只装 adu_* 元工具：adu_list 拿模块表 → adu_describe 深查 → adu_load 才真正装载。"
      + "目的是让每次请求的工具 schema 只包含这一轮真正用得上的部分。关掉则回到一上来就全装。",
  },
};

export function aduFeatureOn(features) {
  const f = features || {};
  return f.master !== false && f.adu !== false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 模块表：唯一事实源
// ═══════════════════════════════════════════════════════════════════════════
//
// id      装载单元（adu_load 的取值；与 index.js 的注册组一一对应）
// title   人话名字
// summary 一句话价值
// tools   这个模块会凭空出现的模型工具名
// facets  模块内的子能力（深查用；不单独可装卸）
// cost    粗算的 schema 负担（工具数 × 大致参数密度），用于"值不值得装"的判断
// risk    装载它的副作用提示

export const ADU_MODULES = [
  {
    id: "plugins",
    title: "全局插件库 · 记忆 · 模型合作",
    summary: "DET 的「插件管到底」那一摊：全局插件五档管理、GitHub 两种安装、TCT 临时对话、CDM 跨对话记忆、MDA 模型合作、MMS 混合模型。",
    tools: [
      "det_global_plugin_list", "det_global_plugin_enable", "det_global_plugin_disable",
      "det_global_plugin_scan_installed", "det_global_plugin_import_installed", "det_global_plugin_set_enabled",
      "det_global_plugin_store_search", "det_global_plugin_github_direct",
      "det_global_plugin_github_rebuild", "det_global_plugin_github_save",
      "det_tct", "cdm_list", "cdm_search", "cdm_read",
      "mda_list_areas", "mda_card", "mda_activate", "mda_create_no_workspace_agent",
      "det_mms",
    ],
    facets: [
      { name: "全局插件库", tools: ["det_global_plugin_*"], desc: "五档（always / ai-auto / ai-approve / frozen / disabled）+ 常驻插件二分启停。" },
      { name: "两种安装路径", tools: ["det_global_plugin_github_direct", "det_global_plugin_github_rebuild", "det_global_plugin_github_save"], desc: "直接下载，或由 AI 读源码后自行重写（不执行第三方代码）。" },
      { name: "CDM 跨对话记忆", tools: ["cdm_list", "cdm_search", "cdm_read"], desc: "默认只搜当前工作区，cross=true 提权跨工作区。" },
      { name: "TCT 临时对话", tools: ["det_tct"], desc: "一次性问答，返回单段 feedback 后即焚，不落库。" },
      { name: "MDA 模型合作", tools: ["mda_list_areas", "mda_card", "mda_activate", "mda_create_no_workspace_agent"], desc: "分组树 + 让另一个模型代答（耗提示词）。" },
      { name: "MMS 混合模型", tools: ["det_mms"], desc: "低难度子问题转便宜模型，省 token。" },
    ],
    cost: "高（19 个工具，参数面最宽）",
    risk: "装载后模型能改别的插件的启用状态、能跨对话读历史 —— 权限面最大的一块。",
    note: "只在需要「管插件 / 查旧对话 / 问一句就忘」时装它，纯写代码的回合完全用不上。",
  },
  {
    id: "browser",
    title: "浏览器控制",
    summary: "det_browser：读页面文字/DOM、截图、导航、点击、填表、执行脚本（需浏览器扩展连上且档位够）。",
    tools: ["det_browser"],
    facets: [
      { name: "只读动作", tools: ["read_text", "read_dom", "screenshot", "get_url", "get_title"], desc: "扩展档位「只读」即可。" },
      { name: "写动作", tools: ["navigate", "click", "fill"], desc: "需要扩展档位「只写」或「启用」。" },
      { name: "执行脚本", tools: ["run"], desc: "仅扩展档位「启用」可用；高危。" },
    ],
    cost: "中（1 个工具但 action 面很宽）",
    risk: "动作用户已登录的真实浏览器：写动作会改变页面状态，run 等于在用户会话里跑 JS。",
    note: "网络权限落在「使用用户浏览器」档位时才有意义。",
  },
  {
    id: "web",
    title: "网络取页 / 搜索",
    summary: "web_inspect / web_act / web_focus / web_human_search / web_insite_search：走用户浏览器做搜索与页面操作。",
    tools: ["web_inspect", "web_act", "web_focus", "web_human_search", "web_insite_search"],
    facets: [
      { name: "读页面", tools: ["web_inspect", "web_focus"], desc: "文本/DOM/元素/指标/URL/标题。" },
      { name: "像人一样搜", tools: ["web_human_search", "web_insite_search"], desc: "在浏览器里真的打字搜索，返回结果页文本。" },
      { name: "操作", tools: ["web_act"], desc: "click / type / scroll / press / hover / focus / clear / select。" },
    ],
    cost: "中（5 个工具）",
    risk: "同样操作真实浏览器；与 det_browser 能力重叠，通常装一个就够。",
    note: "只要「搜一下」时装 web；要「读那个标签页的 DOM」时装 browser。",
  },
  {
    id: "dlt",
    title: "DLT 集成（文档 / 执行 / 环境）",
    summary: "六个 dlt_* 工具：本机环境表、直接跑程序、MSBuild 编译、PDF/Word/Excel/CSV 读写与格式转换。",
    tools: ["dlt_env", "dlt_run", "dlt_build", "dlt_doc_read", "dlt_doc_write", "dlt_doc_convert"],
    facets: [
      { name: "环境与执行", tools: ["dlt_env", "dlt_run", "dlt_build"], desc: "MSVC/MSBuild/cmake/ninja/Python/Node/git/dotnet/Office COM/Edge 全在表里。" },
      { name: "文档", tools: ["dlt_doc_read", "dlt_doc_write", "dlt_doc_convert"], desc: "读 PDF/Word/Excel/CSV，写与改，Office COM 导出 PDF。" },
    ],
    cost: "中高（6 个工具，文档三种模式参数多）",
    risk: "dlt_run 直接在开发机上执行任意程序；dlt_doc_write 默认先备份。",
    note: "纯聊天/写代码的回合不需要；一旦碰到 .docx/.pdf/编译就该装。",
  },
  {
    id: "alv",
    title: "ALV 辅助线视觉",
    summary: "八个 alv_* 工具：加栅格标尺辅助线、裁切放大、边线坐标提取、本机 OCR、切块、按坐标标注、预处理增强。",
    tools: ["alv_info", "alv_grid", "alv_crop", "alv_edges", "alv_ocr", "alv_tile", "alv_annotate", "alv_enhance"],
    facets: [
      { name: "造坐标系", tools: ["alv_grid", "alv_info"], desc: "栅格 + 标尺 + 指定位置的辅助线。" },
      { name: "看清细节", tools: ["alv_crop", "alv_tile", "alv_enhance"], desc: "裁剪/放大/切块/去噪二值化。" },
      { name: "量出来", tools: ["alv_edges", "alv_ocr"], desc: "线段与行列边线坐标；离线 OCR 带逐词包围盒，可逐格出表格。" },
      { name: "指给人看", tools: ["alv_annotate"], desc: "按坐标画框/线/箭头/十字/圈/文字。" },
    ],
    cost: "中高（8 个工具）",
    risk: "只读写本地图片文件；会在 <DSH_HOME>/det/alv 下产生副本。",
    note: "只要这轮不碰图片就别装 —— 图片工具的 schema 很占预算。",
  },
  {
    id: "security",
    title: "安全审计与审批",
    summary: "代码修改审批、AI 命令审计、提示词攻击防御三个开关背后的宿主监听（tools/pre-execute）。",
    tools: [],
    facets: [
      { name: "代码修改审批", desc: "文件保存/快照回退前先预览差异并等批准。" },
      { name: "命令审计", desc: "对工具调用做一次独立模型审计，高风险拦截。" },
      { name: "Prompt 防御", desc: "输入（含命令输出）里的注入尝试拦截。" },
    ],
    cost: "无工具面（纯监听）",
    risk: "每次触发会多一次模型调用（有 token 开销）。",
    note: "默认随总开关一起同步，不入 ADU 的按需清单；在这里列出只为可查。",
    always: true,
  },
  {
    id: "project",
    title: "工程工具（LVAL）",
    summary: "右栏工具栏的文件树/预览、运行、代码快照与回退 —— 走 typert 端点与客户端界面，不是模型工具。",
    tools: [],
    facets: [
      { name: "文件视图", desc: "工作区文件树与预览端点。" },
      { name: "运行", desc: "检测工作区并跑构建。" },
      { name: "版本控制", desc: "代码快照创建/列表/回退/删除。" },
    ],
    cost: "无工具面（端点 + UI）",
    risk: "回退会改磁盘上的源码（有快照可再回退）。",
    note: "端点始终注册（UI 依赖它们），因此不在 ADU 的装载清单里。",
    always: true,
  },
];

export const ADU_MODULE_IDS = ADU_MODULES.map((m) => m.id);

/** 可装载模块（排除 always）。 */
export function aduLoadableIds() {
  return ADU_MODULES.filter((m) => m.always !== true).map((m) => m.id);
}

export function aduModule(id) {
  const key = String(id || "").trim();
  return ADU_MODULES.find((m) => m.id === key) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 桥
// ═══════════════════════════════════════════════════════════════════════════

export class AduBridge {
  /**
   * @param service - EssentialToolsService（提供 config / ctx）。
   * @param runtime - { mount(id) => Promise<{ok,tools,error}>, unmount(id) => Promise<{ok,error}>,
   *                    status() => object }（由 index.js 注入，避免 ADU 自己持有装卸管线）。
   */
  constructor(service, runtime) {
    this.service = service;
    this.ctx = service.ctx;
    this.runtime = runtime || {};
    this._toolDisposers = [];
    this._toolNames = [];
    this._features = null;
  }

  get config() { return this.service.config || {}; }

  /** ADU 是否处于"按需装载"模式（总开关 + adu 开关都开）。 */
  get lazy() { return aduFeatureOn(this._features); }

  sync(features) {
    this._features = features || { master: false };
    this._disposeRuntime();
    if (!aduFeatureOn(this._features)) return { tools: [] };
    const tools = svc(this.ctx, SERVICE.tools);
    if (!tools || typeof tools.register !== "function") return { tools: [] };
    for (const definition of buildAduTools(this)) {
      try {
        const disposer = tools.register(definition);
        this._toolDisposers.push(typeof disposer === "function" ? disposer : () => {});
        this._toolNames.push(definition.name);
      } catch (error) { /* 名字被占：跳过这一件 */ }
    }
    return { tools: this._toolNames.slice() };
  }

  _disposeRuntime() {
    for (let i = this._toolDisposers.length - 1; i >= 0; i--) {
      try { this._toolDisposers[i](); } catch (error) { /* ignore */ }
    }
    this._toolDisposers = [];
    this._toolNames = [];
  }

  dispose() { this._disposeRuntime(); }

  info() {
    return {
      tools: this._toolNames.slice(),
      lazy: this.lazy,
      modules: ADU_MODULES.map((m) => ({ id: m.id, title: m.title, tools: m.tools.length, always: m.always === true })),
      mounted: this.statusSafe(),
    };
  }

  statusSafe() {
    try {
      const s = this.runtime.status ? this.runtime.status() : {};
      return s || {};
    } catch (error) {
      return { error: String(error && error.message ? error.message : error) };
    }
  }

  async mount(id) {
    if (!this.runtime.mount) return { ok: false, error: "装载管线未接入（ADU 未启用）" };
    return await this.runtime.mount(String(id));
  }

  async unmount(id) {
    if (!this.runtime.unmount) return { ok: false, error: "卸载管线未接入（ADU 未启用）" };
    return await this.runtime.unmount(String(id));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 五个元工具
// ═══════════════════════════════════════════════════════════════════════════

const text = (value) => [{ type: "text", text: String(value) }];

function table(rows) {
  return rows.join("\n");
}

function statusOf(bridge, id) {
  const st = bridge.statusSafe();
  const loaded = st && st.loaded && typeof st.loaded === "object" ? st.loaded : {};
  return loaded[id] === true;
}

function listTool(bridge) {
  return defineTool({
    name: "adu_list",
    description: "ADU · 拿到 DET 模块表：每个模块叫什么、一键装载后会多出哪些工具、值不值得装、当前装没装。"
      + "先看这张表，再决定 adu_load 谁 —— 不要盲目把全部模块装上。",
    parameters: {
      verbose: { type: "boolean", description: "true 时附带每个模块的工具名清单。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true }, modules: { type: "array", items: { type: "json" } } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 模块表：${v.error}`);
        const lines = [];
        lines.push(`ADU 模式：${v.lazy ? "按需装载（当前只装了元工具 + 已装载模块）" : "关闭（一上来就全装）"}`);
        lines.push("");
        for (const m of v.modules) {
          const flag = m.always ? "[常驻]" : (m.loaded ? "[已装]" : "[未装]");
          lines.push(`${flag} ${m.id.padEnd(9)} ${m.title}`);
          lines.push(`        ${m.summary}`);
          lines.push(`        工具 ${m.tools.length} 个 · ${m.cost}`);
          if (v.verbose && m.tools.length) lines.push(`        ${m.tools.join(" ")}`);
        }
        lines.push("");
        lines.push("用法：adu_describe id=<模块> 深查 → adu_load id=<模块> 装载（或 id=all 全装）。");
        return text(table(lines));
      },
    },
    async execute(args) {
      const verbose = args && args.verbose === true;
      const modules = ADU_MODULES.map((m) => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        tools: verbose ? m.tools : m.tools,
        toolCount: m.tools.length,
        cost: m.cost,
        risk: m.risk,
        note: m.note,
        always: m.always === true,
        loaded: m.always === true ? true : statusOf(bridge, m.id),
      }));
      return { ok: true, lazy: bridge.lazy, modules, status: bridge.statusSafe() };
    },
  });
}

function describeTool(bridge) {
  return defineTool({
    name: "adu_describe",
    description: "ADU · 深入查一个模块（或全部）：逐个子能力、每个工具干什么、风险与副作用、以及现在装没装。"
      + "确定要用了再 adu_load。",
    parameters: {
      id: { type: "string", description: "模块 id（见 adu_list）；省略则列出全部模块的子能力。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true }, modules: { type: "array", items: { type: "json" } } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 深查：${v.error}`);
        const out = [];
        for (const m of v.modules) {
          out.push(`## ${m.id} —— ${m.title}  ${m.always ? "[常驻]" : (m.loaded ? "[已装]" : "[未装]")}`);
          out.push(m.summary);
          if (m.facets && m.facets.length) {
            out.push("子能力：");
            for (const f of m.facets) out.push(`  · ${f.name}${f.tools && f.tools.length ? `（${f.tools.join(", ")}）` : ""} —— ${f.desc}`);
          }
          if (m.tools && m.tools.length) out.push(`工具（${m.tools.length}）：${m.tools.join(" ")}`);
          out.push(`代价：${m.cost}`);
          out.push(`风险：${m.risk}`);
          if (m.note) out.push(`建议：${m.note}`);
          out.push("");
        }
        out.push("→ 需要哪个就 adu_load id=<id>；用完 adu_unload 卸掉，让下一轮的上下文重新变轻。");
        return text(out.join("\n"));
      },
    },
    async execute(args) {
      const wanted = String((args && args.id) || "").trim();
      const list = wanted ? ADU_MODULES.filter((m) => m.id === wanted) : ADU_MODULES;
      if (wanted && list.length === 0) {
        return { ok: false, error: `没有模块 ${wanted}；可选：${ADU_MODULE_IDS.join(", ")}` };
      }
      return {
        ok: true,
        modules: list.map((m) => ({
          ...m,
          always: m.always === true,
          loaded: m.always === true ? true : statusOf(bridge, m.id),
        })),
        status: bridge.statusSafe(),
      };
    },
  });
}

function loadTool(bridge) {
  return defineTool({
    name: "adu_load",
    description: "ADU · 装载模块：装完之后该模块的模型工具**立刻**出现在后续回合里（等价于打开对应功能开关）。"
      + "id 可给单个模块、逗号分隔多个、或 all 全装。",
    parameters: {
      id: { type: "string", required: true, description: "模块 id（plugins / browser / web / dlt / alv），逗号分隔多个，或 all。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true }, loaded: { type: "array", items: { type: "string" } } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 装载：${v.error}`);
        const lines = v.results.map((r) => `${r.ok ? "✓" : "✗"} ${r.id}${r.tools && r.tools.length ? ` → ${r.tools.length} 个工具：${r.tools.join(" ")}` : ""}${r.error ? `（${r.error}）` : ""}`);
        return text([
          `已装载 ${v.loaded.length} 个模块：`,
          ...lines,
          "",
          v.loaded.length ? "→ 工具从**下一轮**开始可用（本轮的工具有效集合在请求发出时就定了）。" : "没有模块被装载。",
        ].join("\n"));
      },
    },
    async execute(args) {
      const raw = String((args && args.id) || "").trim();
      if (!raw) return { ok: false, error: "缺少 id" };
      let ids;
      if (raw.toLowerCase() === "all") ids = aduLoadableIds();
      else ids = raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      const unknown = ids.filter((id) => !aduModule(id) || aduModule(id).always === true);
      if (unknown.length) {
        return { ok: false, error: `不可装载的模块：${unknown.join(", ")}；可选：${aduLoadableIds().join(", ")} 或 all` };
      }
      const results = [];
      const loaded = [];
      for (const id of ids) {
        let res;
        try {
          res = await bridge.mount(id);
        } catch (error) {
          res = { ok: false, error: String(error && error.message ? error.message : error) };
        }
        // ⚠ 只放**有定义**的字段：宿主对工具输出做无损 JSON 校验
        //   （JSON.parse(JSON.stringify(v)) 深比较），一个 undefined 值就会让整个
        //   调用被判定为 invalid output —— 而装载其实已经成功了。
        const row = { id, ok: res.ok !== false, tools: Array.isArray(res.tools) ? res.tools : [] };
        if (res.error) row.error = String(res.error);
        results.push(row);
        if (res.ok !== false) loaded.push(id);
      }
      return { ok: loaded.length > 0, loaded, results, status: bridge.statusSafe() };
    },
  });
}

function unloadTool(bridge) {
  return defineTool({
    name: "adu_unload",
    description: "ADU · 卸下模块（**大多数时候不需要**）：装载是粘性的 —— 一旦装上就一直在，直到你显式卸下或重启前都不会自动消失。"
      + "卸下只会让后续轮次少这些工具，并不会帮你「记住」什么。真要腾 schema 预算时才用；忘了有哪些工具请用 adu_rememory。",
    parameters: {
      id: { type: "string", required: true, description: "模块 id，逗号分隔多个，或 all。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true }, unloaded: { type: "array", items: { type: "string" } } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 卸载：${v.error}`);
        return text([
          `已卸下：${v.unloaded.join(" ") || "（无）"}`,
          ...v.results.filter((r) => r.error).map((r) => `  ${r.id}：${r.error}`),
          "→ 下一轮起这些工具不再出现在工具列表里；想装回来用 adu_load。",
        ].join("\n"));
      },
    },
    async execute(args) {
      const raw = String((args && args.id) || "").trim();
      if (!raw) return { ok: false, error: "缺少 id" };
      let ids;
      if (raw.toLowerCase() === "all") ids = aduLoadableIds();
      else ids = raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      const results = [];
      const unloaded = [];
      for (const id of ids) {
        if (!aduModule(id) || aduModule(id).always === true) {
          results.push({ id, error: "常驻模块不可卸载" });
          continue;
        }
        let res;
        try {
          res = await bridge.unmount(id);
        } catch (error) {
          res = { ok: false, error: String(error && error.message ? error.message : error) };
        }
        results.push({ id, error: res.ok === false ? res.error : null });
        if (res.ok !== false) unloaded.push(id);
      }
      return { ok: unloaded.length > 0 || results.every((r) => !r.error), unloaded, results, status: bridge.statusSafe() };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 工具索引：给 adu_rememory 用的「一句话 + 关键参数」字典
// ═══════════════════════════════════════════════════════════════════════════
//
// 为什么需要它：长对话被压缩（compaction）之后，模型的「局部记忆」会退化 ——
// 工具 schema 还在，但"这个工具到底怎么用、参数叫什么"被摘要掉了。重新装载
// 一遍是浪费（装载是粘性的，本来就没卸），真正缺的是**一张索引**。
// 这份表就是那张索引的数据源：短到可以整段塞回上下文，又足够让模型直接下手。

export const ADU_TOOL_INDEX = {
  // ── 全局插件库 · 记忆 · 模型合作（plugins）─────────────────────────────
  det_global_plugin_list: { p: "—", d: "列出全局插件库：五档档位、实际装载状态、各会话启用情况" },
  det_global_plugin_enable: { p: "id, sessionId?", d: "在（默认当前）会话启用某个全局插件，受档位强制" },
  det_global_plugin_disable: { p: "id, sessionId?", d: "停用某插件在会话里的实例" },
  det_global_plugin_scan_installed: { p: "—", d: "扫描随 DSH 常驻的永久插件（排除 DET 自己）" },
  det_global_plugin_import_installed: { p: "moduleName", d: "把扫到的常驻插件纳入 DET 插件库（之后可档位管理）" },
  det_global_plugin_set_enabled: { p: "id, enabled", d: "常驻插件的全局启用/禁用二分开关（实时经 loader 装卸）" },
  det_global_plugin_store_search: { p: "query, branch?", d: "在插件商店（GitHub）搜索候选插件" },
  det_global_plugin_github_direct: { p: "repo, branch?, path?", d: "按约定格式直接拉取插件入库（附可疑代码扫描）" },
  det_global_plugin_github_rebuild: { p: "repo, branch?", d: "拉 README+源码，供 AI 审查后自行重写（不执行第三方代码）" },
  det_global_plugin_github_save: { p: "name, host, client, …", d: "保存上一步重写出的插件入库" },
  det_tct: { p: "prompt, preset?, model?", d: "一次性临时对话：返回单段反馈后即焚，不落库" },
  cdm_list: { p: "workspace?, cross?", d: "列出可检索的对话（默认当前工作区）" },
  cdm_search: { p: "query, workspace?, cross?, limit?", d: "跨对话搜索片段" },
  cdm_read: { p: "sessionId, seq?/messageId?, limit?", d: "读某对话在指定位置附近的片段" },
  mda_list_areas: { p: "—", d: "列出 MDA 分组模式与分支模型区域" },
  mda_card: { p: "model, style?", d: "用 TCT 生成一个模型的介绍卡片" },
  mda_activate: { p: "model, prompt", d: "让另一个模型代答（⚠ 耗提示词）" },
  mda_create_no_workspace_agent: { p: "name?, model?", d: "创建一个无工作区的临时 agent" },
  det_mms: { p: "prompt, model?", d: "把低难度子问题委派给便宜/本地模型" },

  // ── 浏览器（browser）───────────────────────────────────────────────────
  det_browser: { p: "action, url?/selector?/value?/code?, tabId?, maxLen?, timeoutMs?", d: "操作用户已登录浏览器：list_tabs/read_text/read_dom/screenshot/get_url/get_title/navigate/click/fill/run" },

  // ── 网络取页 / 搜索（web）──────────────────────────────────────────────
  web_inspect: { p: "what, selector?, tabId?", d: "只读检查：text/dom/html/links/images/elements/metrics/url/title" },
  web_act: { p: "do, selector?, text?, …", d: "页面动作：click/type/scroll/press/hover/focus/clear/select" },
  web_focus: { p: "tabId?", d: "把某标签页切到前台并读回标题/地址" },
  web_human_search: { p: "query, engine?, tabId?", d: "在浏览器里真的打字搜索，返回结果页文本" },
  web_insite_search: { p: "query", d: "在所有标签页里找关键词，返回命中页与上下文" },

  // ── DLT（dlt）──────────────────────────────────────────────────────────
  dlt_env: { p: "env?", d: "本机硬编码工具链表（MSVC/MSBuild/cmake/ninja/Python/Node/git/dotnet/Office COM/Edge）" },
  dlt_run: { p: "env, program?, args?, cwd?, timeoutMs?", d: "在指定环境里直接跑程序" },
  dlt_build: { p: "target?/solution?, configuration?, platform?", d: "用 MSBuild 编译工程" },
  dlt_doc_read: { p: "path, mode?, range?", d: "读 PDF/Word/Excel/CSV 内容与结构" },
  dlt_doc_write: { p: "path, ops/chain?, out?", d: "写/改文档（默认先备份）" },
  dlt_doc_convert: { p: "path, to, out?", d: "格式转换；扫描 PDF 可 to=png 再 read_image" },

  // ── ALV（alv）──────────────────────────────────────────────────────────
  alv_info: { p: "path, noise?", d: "图片体检：尺寸/亮度/暗像素比例/直方图，决定要不要裁剪放大" },
  alv_grid: { p: "path, cell?, majorEvery?, guides?, out?", d: "加栅格+标尺+辅助线，建立像素坐标系" },
  alv_crop: { p: "path, box?, pad?, scale?, out?", d: "精确裁剪/自动裁空白/放大（小字先放大再 OCR）" },
  alv_edges: { p: "path, box?, low?, high?, minLineLen?, mergeTol?, scale?", d: "边缘/边线提取：线段 + 合并后的行/列位置（hardcoded）" },
  alv_ocr: { p: "path, box?, mode=lines|cells, cells?, cols?, rows?, lang?, annotate?", d: "本机离线 OCR（逐词包围盒）；cells 模式直接出表格矩阵" },
  alv_tile: { p: "path, cols?, rows?, overlap?, scale?", d: "带重叠切块，大字图分块看" },
  alv_annotate: { p: "path, ops[], color?, width?", d: "按坐标画 box/line/arrow/cross/circle/text" },
  alv_enhance: { p: "path, box?, mode?, scale?", d: "灰度/对比度/二值化/锐化/放大" },
};

const ADU_SELF_INDEX = {
  adu_list: { p: "verbose?", d: "模块表：每模块会带哪些工具、代价、风险、装没装" },
  adu_describe: { p: "id?", d: "深查模块：子能力/每个工具用途/副作用/建议" },
  adu_load: { p: "id（或 all）", d: "装载模块（粘性：装上就一直在）" },
  adu_unload: { p: "id（或 all）", d: "卸下模块（大多数时候不必）" },
  adu_status: { p: "—", d: "当前装载事实：哪些模块装着、各带哪些工具" },
  adu_rememory: { p: "id?, full?", d: "重新注入工具记忆：压成索引表塞回上下文（本工具）" },
};

/**
 * 生成工具索引（rememory 与实际列表共用一份数据）。
 * @param {{modules?: string[], includeAdu?: boolean}} options
 * @returns {Array<{id:string,title:string,tools:Array<{name:string,params:string,desc:string}>}>}
 */
export function aduToolIndex(options) {
  const opts = options || {};
  const only = Array.isArray(opts.modules) ? opts.modules : null;
  const out = [];
  for (const m of ADU_MODULES) {
    if (only && only.indexOf(m.id) === -1) continue;
    if (m.always === true && !only) continue; // 常驻模块没有模型工具
    const tools = (m.tools || []).map((name) => {
      const meta = ADU_TOOL_INDEX[name];
      return { name, params: meta ? meta.p : "?", desc: meta ? meta.d : "（索引未收录）" };
    });
    if (tools.length === 0 && !opts.includeEmpty) continue;
    out.push({ id: m.id, title: m.title, tools });
  }
  if (opts.includeAdu !== undefined ? opts.includeAdu : !only) {
    out.push({
      id: "adu",
      title: "ADU 元工具",
      tools: ADU_TOOL_NAMES.slice().map((name) => {
        const meta = ADU_SELF_INDEX[name];
        return { name, params: meta ? meta.p : "?", desc: meta ? meta.d : "（索引未收录）" };
      }),
    });
  }
  return out;
}

function rememoryTool(bridge) {
  return defineTool({
    name: "adu_rememory",
    description: "ADU · 重新注入「工具记忆」：把**现在到底有哪些工具、怎么调、干什么**压成一张索引表重新给你。"
      + "长对话被自动压缩后，工具 schema 还在但用法常被摘要掉 —— 这时调它即可恢复局部记忆，"
      + "不必重新装载（装载本来就是粘性的），也不额外占工具 schema 的预算。",
    parameters: {
      id: { type: "string", description: "只看某个模块 id；省略或 all = 全部已装载模块 + 常驻模块 + ADU 元工具。" },
      full: { type: "boolean", description: "true 时附上每个模块的代价/风险说明（默认只给工具索引）。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true }, total: { type: "number" }, modules: { type: "array", items: { type: "json" } } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 工具记忆：${v.error}`);
        const lines = [
          `工具记忆（${v.lazy ? "ADU 按需模式" : "全装模式"} · ${v.modules.length} 组 · ${v.total} 个工具）`,
        ];
        for (const mod of v.modules) {
          lines.push("");
          lines.push(`## ${mod.id} · ${mod.title}`);
          if (mod.note) lines.push(`   ${mod.note}`);
          for (const t of mod.tools) {
            lines.push(`   ${t.name}(${t.params}) — ${t.desc}`);
          }
        }
        lines.push("");
        lines.push("装载是粘性的：这些工具会一直在，不必反复 adu_load。若某轮真的不需要它们，才考虑 adu_unload。");
        return text(lines.join("\n"));
      },
    },
    async execute(args) {
      const st = bridge.statusSafe();
      const loadedMap = (st && st.loaded) || {};
      const raw = String((args && args.id) || "").trim();
      const wantAll = raw === "" || raw.toLowerCase() === "all";
      const ids = wantAll
        ? ADU_MODULES.filter((m) => m.always === true || loadedMap[m.id] === true).map((m) => m.id)
        : raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      const unknown = ids.filter((id) => !aduModule(id));
      if (unknown.length) {
        return { ok: false, error: `没有模块 ${unknown.join(", ")}；可选：${ADU_MODULE_IDS.join(", ")}` };
      }
      const index = aduToolIndex({ modules: ids, includeAdu: wantAll });
      const full = args && args.full === true;
      const modules = index.map((group) => {
        const mod = aduModule(group.id);
        const row = { id: group.id, title: group.title, tools: group.tools };
        if (full && mod) {
          row.cost = mod.cost;
          row.risk = mod.risk;
          row.note = mod.note;
        }
        return row;
      });
      // 只放有定义的字段：宿主对工具输出做无损 JSON 校验（见 v2.10.1）。
      const total = modules.reduce((n, m) => n + m.tools.length, 0);
      return { ok: true, lazy: bridge.lazy, total, modules, status: st };
    },
  });
}


function statusTool(bridge) {
  return defineTool({
    name: "adu_status",
    description: "ADU · 当前装载事实：哪些模块装着、每个模块实际注册了哪些工具、ADU 是否在按需模式。"
      + "怀疑「工具怎么没了」时跑它。",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: { ok: { type: "boolean", required: true } },
      },
      render: (_a, v) => {
        if (v.ok === false) return text(`✗ 状态：${v.error}`);
        const lines = [`ADU 模式：${v.lazy ? "按需装载" : "关闭（全装）"}`];
        for (const row of v.rows) {
          lines.push(`${row.loaded ? "✓" : "·"} ${row.id.padEnd(9)} ${row.tools.length ? row.tools.join(" ") : "（无模型工具）"}`);
        }
        if (v.error) lines.push(`警告：${v.error}`);
        return text(lines.join("\n"));
      },
    },
    async execute() {
      const st = bridge.statusSafe();
      const loaded = (st && st.loaded) || {};
      const toolsByModule = (st && st.toolsByModule) || {};
      const rows = ADU_MODULES.map((m) => ({
        id: m.id,
        loaded: m.always === true || loaded[m.id] === true,
        tools: toolsByModule[m.id] || (m.always === true ? [] : []),
      }));
      return { ok: true, lazy: bridge.lazy, rows, error: st && st.error ? st.error : null, raw: st };
    },
  });
}

/**
 * 构造五个元工具。抽成函数是为了**可测试**：测试可以直接拿到 execute 去跑，
 * 而不必先挂一个假 Cordis。sync() 也走这里，保证"装的就是测的"。
 */
export function buildAduTools(bridge) {
  return [
    listTool(bridge), describeTool(bridge), loadTool(bridge),
    unloadTool(bridge), statusTool(bridge), rememoryTool(bridge),
  ];
}

/** ADU 元工具名清单（诊断 / 模块表用）。 */
export const ADU_TOOL_NAMES = ["adu_list", "adu_describe", "adu_load", "adu_unload", "adu_status", "adu_rememory"];

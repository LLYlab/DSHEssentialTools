// dsh-essential-tools — ALV（Aided Line Vision，辅助线视觉）Host 半区
//
// 为什么要有 ALV：
//   视觉模型看的是"一张图"，不是"一个坐标系"。当任务变成
//     · 这张表的第 3 行是不是错了？
//     · 这条线到底在哪一列结束？
//     · (1130, 740) 那里印的料号是什么？
//   模型需要的是**脚手架**：裁剪、栅格、标尺、辅助线、边线坐标。
//
//   ALV 用纯几何（无 ML、无网络、无 API Key）把这些脚手架造出来，
//   交给模型两样东西：
//     1) 可以推理的 JSON 几何（行线在 y=112/168/224…、这条边 784px 长…）
//     2) 一张带着脚手架渲染结果的新图（模型再 read_image 亲眼看）
//
//   「硬编码」是刻意的：坐标由调用方给定，阈值由调用方给定，ALV 只精确执行。
//   唯一的"智能"步骤是 OCR，而且交给操作系统引擎（Windows.Media.Ocr），
//   离线、可复现、带逐词包围盒。
//
// 引擎：py/alv.py（python312 环境，Pillow + numpy + OpenCV）
// OCR 桥：py/alv_ocr.ps1（Windows.Media.Ocr，纯 ASCII 源文件）

import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { svc, SERVICE } from "./adapt.js";
import { PACKAGE_ROOT, dshHome, runInEnvironment } from "./dlt-engine.js";

export const ALV_ENGINE = join(PACKAGE_ROOT, "py", "alv.py");
export const ALV_OCR_BRIDGE = join(PACKAGE_ROOT, "py", "alv_ocr.ps1");

// ── 功能开关（与 client.js 的分组表一一对应）────────────────────────────────
export const ALV_FEATURE_KEYS = ["alv"];

export const ALV_FEATURE_META = {
  alv: {
    label: "ALV 辅助线视觉",
    desc: "八件套：info / grid / crop / edges / ocr / tile / annotate / enhance。给图片加栅格·标尺·辅助线，"
      + "提取边线坐标与硬编码 OCR，把看不清的地方裁出来放大再看。",
  },
};

export function alvFeatureOn(features) {
  const f = features || {};
  return f.master !== false && f.alv !== false;
}

// ── 小工具 ─────────────────────────────────────────────────────────────────

const text = (value) => [{ type: "text", text: String(value) }];
const failText = (label, error) => text(`✗ ${label}：${error && error.message ? error.message : error}`);
const JSON_PARAM = (description, required = false) => ({ type: "json", description, ...(required ? { required: true } : {}) });

function outputSchema(extra = {}) {
  return {
    type: "object",
    additionalProperties: true,
    properties: { ok: { type: "boolean", required: true }, error: { type: "string" }, ...extra },
  };
}

/** 当前会话工作区（模型给相对路径时按它解析）。 */
function sessionCwdOf(exec) {
  try {
    const session = exec && exec.agent && exec.agent.session;
    if (!session) return null;
    const cwd = (session.meta && session.meta.cwd) || (session.header && session.header.cwd) || session.cwd;
    return cwd ? String(cwd) : null;
  } catch (e) {
    return null;
  }
}

function absolutePath(raw, exec) {
  const value = String(raw === undefined || raw === null ? "" : raw).trim();
  if (!value) throw new Error("缺少图片路径");
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\")) return value;
  if (value.startsWith("/")) return value;
  const cwd = sessionCwdOf(exec);
  if (!cwd) throw new Error(`相对路径需要会话工作区：${value}`);
  return join(cwd, value);
}

function shortJson(value, limit = 1800) {
  try {
    const s = JSON.stringify(value);
    return s.length > limit ? `${s.slice(0, limit)}…` : s;
  } catch (e) {
    return String(value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 桥：引擎调用 + 装卸
// ═══════════════════════════════════════════════════════════════════════════

export class AlvBridge {
  constructor(service) {
    this.service = service;
    this.ctx = service.ctx;
    this._toolDisposers = [];
    this._toolNames = [];
    this._features = null;
    this._promptDisposer = null;
  }

  get config() { return this.service.config; }

  /** 输出目录：默认 <DSH_HOME>/det/alv（与 DLT 的缓存目录分开）。 */
  get cacheDir() {
    const c = this.config && this.config.alvCacheDir;
    return c && String(c).trim() !== "" ? String(c) : join(dshHome(), "det", "alv");
  }

  /** 调用引擎：op + args → 解析后的对象（永不抛错，失败返回 {ok:false,error}）。 */
  async call(op, args, options = {}) {
    if (!existsSync(ALV_ENGINE)) return { ok: false, error: `ALV 引擎不存在: ${ALV_ENGINE}` };
    const payload = { op: String(op), args: { cacheDir: this.cacheDir, ...(args || {}) } };
    let res;
    try {
      res = await runInEnvironment({
        env: (this.config && this.config.alvPythonEnv) || "python312",
        args: [ALV_ENGINE],
        stdin: JSON.stringify(payload),
        timeoutMs: options.timeoutMs ?? 180000,
        cwd: PACKAGE_ROOT,
        maxOutput: 8 * 1024 * 1024,
      });
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
    const line = String(res.stdout || "").trim().split("\n").filter(Boolean).pop();
    if (!line) {
      const msg = `ALV 引擎无输出（退出码 ${res.exitCode}）：${String(res.stderr || "").slice(0, 500)}`;
      try { this.service._diagPush("alv", op, msg); } catch (e) { /* ignore */ }
      return { ok: false, error: msg };
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed && parsed.ok === false) {
        try { this.service._diagPush("alv", op, parsed.error); } catch (e) { /* ignore */ }
        return { ok: false, error: String(parsed.error || "未知错误") };
      }
      return parsed;
    } catch (error) {
      const msg = `ALV 引擎输出无法解析：${line.slice(0, 400)}`;
      try { this.service._diagPush("alv", op, msg); } catch (e) { /* ignore */ }
      return { ok: false, error: msg };
    }
  }

  /** 装/卸 ALV 工具（幂等）。features 为 null 表示总开关关闭。 */
  sync(features) {
    this._features = features || { master: false };
    this._disposeRuntime();
    if (!alvFeatureOn(this._features)) return { tools: [] };
    const tools = svc(this.ctx, SERVICE.tools);
    if (!tools || typeof tools.register !== "function") return { tools: [] };
    for (const factory of ALV_TOOL_FACTORIES) {
      let definition;
      try {
        definition = factory(this);
      } catch (error) {
        continue;
      }
      try {
        const disposer = tools.register(definition);
        this._toolDisposers.push(typeof disposer === "function" ? disposer : () => {});
        this._toolNames.push(definition.name);
      } catch (error) {
        // 名字被占（理论上不会发生）：跳过这一件，不影响其余。
      }
    }
    try {
      this._promptDisposer = this._registerPrompt() || null;
    } catch (error) {
      this._promptDisposer = null;
    }
    return { tools: this._toolNames.slice() };
  }

  _registerPrompt() {
    const sp = svc(this.ctx, SERVICE.systemPrompt);
    // systemPrompt 的正式入口是「段落」(section)，与 DLT 集成用的是同一个 API；
    // 早期这里写成了 sp.register(...)（不存在的方法），于是提示段一直静默缺席。
    if (!sp || typeof sp.section !== "function") return null;
    const body = [
      "# ALV 辅助线视觉（图片精确识别）",
      "看到图里需要定位/读数/量尺寸时，别靠猜坐标：先用 ALV 造脚手架，再 read_image 亲眼看。",
      "- `alv_info` 先摸清尺寸/曝光；`alv_grid` 加栅格+标尺+辅助线，回来就知道每个坐标在哪。",
      "- 要「行线在哪一根」就 `alv_edges`：它给出 horizontalPositions/verticalPositions（合并后的边线坐标）。",
      "- 要读某块文字就 `alv_crop` 裁出来 `alv_enhance` 放大，再 `alv_ocr`；表格用 `mode:\"cells\"`（cells 建议直接喂 alv_edges 得到的行/列位置）。",
      "- 要指给用户看就 `alv_annotate`（box/line/arrow/cross/circle/text），坐标就是你算出来的原图坐标。",
      "- 所有工具返回 `out` 指向一张新图：用 read_image 打开它，别只看 JSON 就下结论。",
      "- 坐标约定：都是**原图左上角为原点**的像素坐标；工具返回的 toSource 说明怎么换算回原图。",
    ].join("\n");
    try {
      const disposer = sp.section({
        name: "tool:det-alv",
        order: Number((this.config && this.config.alvPromptOrder) || 142),
        text: body,
      });
      return typeof disposer === "function" ? disposer : null;
    } catch (error) {
      return null;
    }
  }

  _disposeRuntime() {
    for (let i = this._toolDisposers.length - 1; i >= 0; i--) {
      try { this._toolDisposers[i](); } catch (error) { /* 单个失败不影响其余 */ }
    }
    this._toolDisposers = [];
    this._toolNames = [];
    if (this._promptDisposer) {
      try { this._promptDisposer(); } catch (error) { /* ignore */ }
      this._promptDisposer = null;
    }
  }

  dispose() { this._disposeRuntime(); }

  info() {
    return {
      tools: this._toolNames.slice(),
      promptSection: this._promptDisposer !== null,
      enabled: alvFeatureOn(this._features),
      paths: {
        packageRoot: PACKAGE_ROOT,
        engine: ALV_ENGINE,
        engineExists: existsSync(ALV_ENGINE),
        ocrBridge: ALV_OCR_BRIDGE,
        ocrBridgeExists: existsSync(ALV_OCR_BRIDGE),
        cacheDir: this.cacheDir,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 八件套
// ═══════════════════════════════════════════════════════════════════════════

/** 1 · alv_info */
function infoTool(bridge) {
  return defineTool({
    name: "alv_info",
    description: "ALV · 图片体检：尺寸/模式/DPI/亮度/暗像素比例/16 段直方图（可选噪声估计）。"
      + "拿到图先跑它，据此决定要不要裁剪放大、要不要二值化。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径（绝对，或相对当前会话工作区）。" },
      noise: { type: "boolean", description: "设为 true 时额外估计噪声（laplacian 中位数）。" },
    },
    output: {
      schema: outputSchema({ width: { type: "number" }, height: { type: "number" }, darkRatio: { type: "number" } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("图片体检", v.error);
        return text([
          `${v.path}`,
          `尺寸 ${v.width}×${v.height}  模式 ${v.mode}  格式 ${v.format}${v.dpi ? `  DPI ${v.dpi.slice(0, 2).join("×")}` : ""}`,
          `亮度均值 ${v.mean}  标准差 ${v.std}  暗像素 ${(Number(v.darkRatio || 0) * 100).toFixed(1)}%`,
          v.noise !== undefined ? `噪声估计 ${v.noise}` : null,
          Number(v.darkRatio || 0) > 0.35 ? "→ 偏暗/重墨：可 alv_enhance mode=auto 提亮后再看。" : null,
          Number(v.width || 0) < 700 ? "→ 图偏小：alv_crop scale=2~3 放大后再 OCR。" : null,
        ].filter(Boolean).join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("info", { path: absolutePath(args.path, exec), noise: args.noise === true });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 2 · alv_grid —— 坐标系本体 */
function gridTool(bridge) {
  return defineTool({
    name: "alv_grid",
    description: "ALV · 加栅格与标尺（坐标系本体）：在图上画 cell 像素的栅格，每 majorEvery 根加粗一次，"
      + "四周留白标注坐标；可用 guides 画指定位置的辅助线（如对齐试验：{{horizontal:[470],vertical:[430]}}）。"
      + "返回整张图的新副本，回来 read_image 看它，就知道任意像素落在哪。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      cell: { type: "number", description: "栅格步长（像素），默认 64。" },
      majorEvery: { type: "number", description: "每几根加粗一次，默认 5。" },
      guides: JSON_PARAM("辅助线：{horizontal:[y...], vertical:[x...]}（原图像素坐标）。"),
      color: { type: "string", description: "细线颜色，默认 #ff3b30。" },
      majorColor: { type: "string", description: "粗线/标签颜色，默认 #0a84ff。" },
      labels: { type: "boolean", description: "是否画坐标标签，默认 true（关掉则不占边距）。" },
      out: { type: "string", description: "输出路径；省略则写到 <DSH_HOME>/det/alv。" },
    },
    output: {
      schema: outputSchema({ out: { type: "string" } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("加栅格", v.error);
        const g = v.guidesDrawn || {};
        return text([
          `已生成带栅格的副本：${v.out}`,
          `栅格 ${v.cell}px · 列 ${v.count.cols} · 行 ${v.count.rows} · 边距 ${v.margin}px`,
          (g.horizontal && g.horizontal.length) || (g.vertical && g.vertical.length)
            ? `辅助线已画：水平 y=${(g.horizontal || []).join(",")}  垂直 x=${(g.vertical || []).join(",")}` : null,
          "→ 下一步 read_image 打开它；换算回原图：原图坐标 = 栅格图坐标 − " + v.margin,
        ].filter(Boolean).join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("grid", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 3 · alv_crop */
function cropTool(bridge) {
  return defineTool({
    name: "alv_crop",
    description: "ALV · 裁剪/放大：给 box=[x,y,w,h] 就精确裁；给 scale 顺带放大（小字必须先放大再 OCR）。"
      + "不给 box 就自动裁掉四周均匀空白（对话框截图/白纸扫描）。返回 toSource 说明怎么换算回原图。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      box: JSON_PARAM("[x,y,w,h] 或 [x0,y0,x1,y1]（后者加第 5 项 true）；省略则自动裁空白。"),
      pad: { type: "number", description: "四周额外留白像素，默认 0。" },
      scale: { type: "number", description: "放大倍数（1–4），默认 1。" },
      out: { type: "string", description: "输出路径。" },
    },
    output: {
      schema: outputSchema({ out: { type: "string" }, box: { type: "json" } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("裁剪", v.error);
        return text([
          `已裁剪：${v.out}`,
          `原图 ${v.sourceSize.join("×")} → 输出 ${v.outSize.join("×")}（box ${v.box.join(",")}，缩放 ${v.scale}×）`,
          `换算回原图：x_src = ${v.toSource.x} + x_crop/${v.toSource.scale}`,
          "→ read_image 看结果；小字建议 scale≥2 再送 alv_ocr。",
        ].join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("crop", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 4 · alv_edges —— 硬编码边缘位置提取 */
function edgesTool(bridge) {
  return defineTool({
    name: "alv_edges",
    description: "ALV · 硬编码边缘/边线提取：Canny + 概率霍夫，返回线段坐标与**合并后的行/列边线位置**"
      + "（horizontalPositions / verticalPositions，带 votes 支持数），并输出一张标好 y=/x= 的副本。"
      + "想知道「表格的行线在哪、这条边到哪结束」就用它，别目测。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      box: JSON_PARAM("只分析某区域：[x,y,w,h]；省略=整图。"),
      low: { type: "number", description: "Canny 低阈值，默认 60。" },
      high: { type: "number", description: "Canny 高阈值，默认 180。" },
      minLineLen: { type: "number", description: "最短线段（像素），默认 60。" },
      angleTol: { type: "number", description: "判为水平/垂直的角度容差（度），默认 2.5。" },
      mergeTol: { type: "number", description: "合并同一根边线的位置容差（像素），默认 4。" },
      scale: { type: "number", description: "检测前先放大（小图建议 2），返回坐标会自动换算回原图。" },
      out: { type: "string", description: "标注图输出路径。" },
    },
    output: {
      schema: outputSchema({
        out: { type: "string" },
        horizontalPositions: { type: "array", items: { type: "json" } },
        verticalPositions: { type: "array", items: { type: "json" } },
      }),
      render: (_a, v) => {
        if (v.ok === false) return failText("边缘提取", v.error);
        const h = (v.horizontalPositions || []).slice(0, 24).map((p) => `y=${p.y}(${p.votes})`).join(" ");
        const vv = (v.verticalPositions || []).slice(0, 24).map((p) => `x=${p.x}(${p.votes})`).join(" ");
        return text([
          `已标出边线：${v.out}`,
          `线段 ${v.counts.lines} 根（水平 ${v.counts.h} / 垂直 ${v.counts.v}）`,
          h ? `水平边线位置 ${v.counts.hPositions} 组：${h}` : "没有检出水平边线",
          vv ? `垂直边线位置 ${v.counts.vPositions} 组：${vv}` : "没有检出垂直边线",
          "→ 想看线段细节就读 JSON；read_image 打开标注图核对。",
        ].join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("edges", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 5 · alv_ocr —— 硬编码 OCR（OS 引擎，带包围盒） */
function ocrTool(bridge) {
  return defineTool({
    name: "alv_ocr",
    description: "ALV · 硬编码 OCR：走 Windows 本机 OCR 引擎（离线、带逐词包围盒），支持两种模式 ——"
      + "mode=lines 整图/区域识别并按视觉行合并（中文会自动去掉字间空格）；"
      + "mode=cells 逐格识别（给 cells=[x,y,w,h...]，或给 box+cols+rows 均分），直接产出表格矩阵。"
      + "表格建议先用 alv_edges 拿到行/列位置再喂 cells。annotate=true 会输出带框的可视化副本。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      box: JSON_PARAM("只识别某个区域：[x,y,w,h]；省略=整图。"),
      mode: { type: "string", description: "lines（默认）或 cells。" },
      cells: JSON_PARAM("cells 模式：每格的 [x,y,w,h] 数组（强烈建议用 alv_edges 的行列位置）。"),
      cols: { type: "number", description: "cells 模式均分时的列数。" },
      rows: { type: "number", description: "cells 模式均分时的行数。" },
      pad: { type: "number", description: "每格向外扩几像素（防止切字），默认 4。" },
      lang: { type: "string", description: "OCR 语言标签，默认用系统语言（本机 zh-Hans-CN）。" },
      scale: { type: "number", description: "识别前放大倍数；省略按宽度自适应（最多 3×）。" },
      annotate: { type: "boolean", description: "是否输出带文字框的副本。" },
      out: { type: "string", description: "标注图输出路径。" },
    },
    output: {
      schema: outputSchema({
        text: { type: "string" },
        lines: { type: "array", items: { type: "json" } },
        matrix: { type: "array", items: { type: "array" } },
      }),
      render: (_a, v) => {
        if (v.ok === false) return failText("OCR", v.error);
        if (v.mode === "cells") {
          const rows = (v.matrix || []).map((r) => "| " + r.map((c) => (c === "" ? "　" : c)).join(" | ") + " |");
          return text([`逐格 OCR（${v.cols} 列 × ${Math.max(1, (v.matrix || []).length)} 行）：`, ...rows,
            v.out ? `可视化：${v.out}` : null,
            "空串=该格没识别到文字（可 alv_crop 放大后单格重试）。"].filter(Boolean).join("\n"));
        }
        const body = String(v.text || "").trim() || "（没识别到文字）";
        const head = `OCR（${v.lang || "系统语言"}，缩放 ${Number(v.scale || 1).toFixed(2)}×，${v.wordCount} 个词）`;
        return text([head, body, v.out ? `可视化：${v.out}` : null,
          v.lines && v.lines.length ? `行框：${shortJson((v.lines || []).slice(0, 12).map((l) => ({ t: l.text.slice(0, 18), box: l.box })), 900)}` : null,
        ].filter(Boolean).join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("ocr", { ...args, path: absolutePath(args.path, exec) }, { timeoutMs: 240000 });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 6 · alv_tile */
function tileTool(bridge) {
  return defineTool({
    name: "alv_tile",
    description: "ALV · 切块：把大图按 cols×rows 切成**带重叠**的小块（可放大），返回每块的路径与在原图里的位置。"
      + "适合「一张图里字太多，一次看不清」：逐块 read_image，再按 box 拼回整体结论。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      cols: { type: "number", description: "列数，默认 2。" },
      rows: { type: "number", description: "行数，默认 2。" },
      overlap: { type: "number", description: "相邻块重叠像素，默认 24。" },
      scale: { type: "number", description: "每块放大倍数，默认 1。" },
    },
    output: {
      schema: outputSchema({ tiles: { type: "array", items: { type: "json" } } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("切块", v.error);
        const rows = (v.tiles || []).map((t) => `r${t.row}c${t.col}  [${t.box.join(",")}]  ${t.out}`);
        return text([`已切成 ${v.cols}×${v.rows}（重叠 ${v.overlap}px，缩放 ${v.scale}×）：`, ...rows,
          "→ 逐块 read_image；坐标拼回原图用 box 的 x/y 偏移。"].join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("tile", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 7 · alv_annotate */
function annotateTool(bridge) {
  return defineTool({
    name: "alv_annotate",
    description: "ALV · 按坐标画标注（硬编码）：ops 里逐条给 box / line / arrow / cross / circle / text，"
      + "ALV 精确画在原图上。用途：把「我算出来的位置」画给用户看，或画十字/辅助线验证对齐是否真的对齐。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      ops: JSON_PARAM("标注数组，每项 {kind:\"box|line|arrow|cross|circle|text\", ...}："
        + "box:{box:[x,y,w,h],label?,color?,width?} line:{x1,y1,x2,y2,label?} arrow:{x1,y1,x2,y2} "
        + "cross:{x,y,r?,label?} circle:{x,y,r} text:{x,y,text}", true),
      color: { type: "string", description: "默认颜色，默认 #ff3b30。" },
      width: { type: "number", description: "默认线宽，默认 2。" },
      fontSize: { type: "number", description: "文字字号，默认 14。" },
      out: { type: "string", description: "输出路径。" },
    },
    output: {
      schema: outputSchema({ out: { type: "string" }, drawn: { type: "number" } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("标注", v.error);
        return text([`已标注 ${v.drawn} 项：${v.out}`, "→ read_image 确认标注是否落在你以为的位置。"].join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("annotate", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

/** 8 · alv_enhance */
function enhanceTool(bridge) {
  return defineTool({
    name: "alv_enhance",
    description: "ALV · 预处理增强：灰度 / 自动对比度 / 自适应二值化 / 锐化 / 放大（mode=auto 全上，或指定单个）。"
      + "扫描件发灰、拍照反光、截图抗锯齿发虚——先 enhance 再 OCR，命中率会明显不同。",
    parameters: {
      path: { type: "string", required: true, description: "图片路径。" },
      box: JSON_PARAM("只处理某区域：[x,y,w,h]。"),
      mode: { type: "string", description: "auto（默认）| gray | contrast | binarize | sharpen。" },
      scale: { type: "number", description: "放大倍数，默认 2。" },
      block: { type: "number", description: "自适应二值化窗口（奇数），默认 31。" },
      out: { type: "string", description: "输出路径。" },
    },
    output: {
      schema: outputSchema({ out: { type: "string" }, steps: { type: "array", items: { type: "string" } } }),
      render: (_a, v) => {
        if (v.ok === false) return failText("增强", v.error);
        return text([
          `已增强（${v.mode}）：${v.out}`,
          `处理步骤：${(v.steps || []).join(" → ")}  输出 ${v.size.join("×")}`,
          "→ read_image 看清晰度，满意再 alv_ocr / alv_edges。",
        ].join("\n"));
      },
    },
    async execute(args, exec) {
      try {
        return await bridge.call("enhance", { ...args, path: absolutePath(args.path, exec) });
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
}

const ALV_TOOL_FACTORIES = [
  infoTool,
  gridTool,
  cropTool,
  edgesTool,
  ocrTool,
  tileTool,
  annotateTool,
  enhanceTool,
];

/** 工具名清单（诊断 / ADU 模块表用）。 */
export const ALV_TOOL_NAMES = [
  "alv_info", "alv_grid", "alv_crop", "alv_edges",
  "alv_ocr", "alv_tile", "alv_annotate", "alv_enhance",
];

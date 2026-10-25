// dsh-essential-tools — DLT 集成（Host 半区）
//
// 把 DLT（dsh-light-tool）的全部**宿主侧**能力搬进 DET：
//   · 六个模型工具：dlt_env / dlt_run / dlt_build / dlt_doc_read / dlt_doc_write / dlt_doc_convert
//   · 系统提示里的环境表与文档工具说明
//   · 给客户端用的端点：dltOffice（右栏预览数据）、dltCost（每轮成本）、
//     dltDraftSupport / dltDraftSave（草图）、dltStatus / dltEnvs（诊断）
//
// 为什么是「搬进」而不是「调用 DLT」：用户口径是「DET 启用时完全抑制 DLT」，
// 也就是 DLT 本体必须整体停摆（连工具都不注册），功能得由 DET 自己提供。
// 引擎（环境表 / 进程执行 / 文档引擎 / 定价）原样复用 DLT 的纯逻辑层
// （lib/dlt-engine.js = DLT lib/core.js 的副本，py/ 引擎也随包自带），
// 于是两台插件不会各写一份实现，DLT 卸载后 DET 依旧完整可用。
//
// 工具名保持 dlt_*：模型侧的习惯、系统提示、既有测试与文档都不用改，
// 只是「谁提供」从 DLT 变成了 DET。

import { existsSync, promises as fsp } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { svc, SERVICE } from "./adapt.js";
import {
  OFFICE_BRIDGE,
  PY_ENGINE,
  PACKAGE_ROOT,
  configureEnvironments,
  describeEnvironments,
  docKindOf,
  dshHome,
  htmlToPdf,
  isAbsolutePath,
  loadPricing,
  officeConvert,
  parseResourceAddress,
  peakBand,
  priceUsage,
  runDocumentOp,
  runInEnvironment,
} from "./dlt-engine.js";

// ── DET 功能开关里的 DLT 集成键（与 lib/client.js 的分组表一一对应）──────────
//
// 默认全开；总开关关闭时一律不生效（与 DET 其余扩展同一口径）。
export const DLT_FEATURE_KEYS = ["dltDocs", "dltPreview", "dltEnv", "dltRun", "dltCost", "dltDraft"];

/** 功能键 → 人话（管理器里显示；客户端另有一份分组表，文案以那一份为准）。 */
export const DLT_FEATURE_META = {
  dltDocs: { label: "文档工具", desc: "dlt_doc_read / dlt_doc_write / dlt_doc_convert 与 Python 文档引擎。" },
  dltPreview: { label: "右栏预览", desc: "给右栏的 docx / xlsx / csv 注册 DET 渲染器（依赖文档工具）。" },
  dltEnv: { label: "环境表", desc: "dlt_env 工具 + 系统提示里的硬编码工具链清单。" },
  dltRun: { label: "执行与编译", desc: "dlt_run / dlt_build：直接跑程序、编译工程。" },
  dltCost: { label: "每轮成本", desc: "每轮对话尾部的「本轮人民币成本」小签。" },
  dltDraft: { label: "草图导入", desc: "输入框「+」旁的草图按钮：现画一张并导入。判定实时读当前会话的模型表（会话投影的 pending 模型 + 模型表的 inputModalities）；关掉它则由独立包 dsh-sketch-draft 接手（若已安装）。" },
};

/** 某个 DLT 集成功能此刻是否生效（总开关关闭时一律 false）。 */
export function dltFeatureOn(features, key) {
  const f = features || {};
  return f.master !== false && f[key] !== false;
}

// ── 小工具（与 DLT 侧同款，保持输出格式一致）───────────────────────────────

const text = (value) => [{ type: "text", text: String(value) }];
const fail = (label, error) => text(`✗ ${label}：${error && error.message ? error.message : error}`);
const okText = (value) => text(value);
const JSON_PARAM = (description, required = false) => ({ type: "json", description, ...(required ? { required: true } : {}) });

function stamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function outputSchema(extra = {}) {
  return {
    type: "object",
    additionalProperties: true,
    properties: { ok: { type: "boolean", required: true }, error: { type: "string" }, ...extra },
  };
}

/** 当前工具调用的会话工作区（模型给相对路径时按它解析）。 */
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

/** 把模型/UI 给的路径变成绝对路径（绝对路径原样；相对路径优先按会话工作区解析）。 */
function resolveInputPath(raw, exec) {
  const value = String(raw === undefined || raw === null ? "" : raw);
  if (value === "") throw new Error("缺少文件路径");
  if (parseResourceAddress(value).fromAddress) {
    const parsed = parseResourceAddress(value);
    const cwd = sessionCwdOf(exec);
    return isAbsolutePath(parsed.path) ? resolve(parsed.path) : (cwd ? resolve(cwd, parsed.path) : resolve(parsed.path));
  }
  if (isAbsolutePath(value)) return resolve(value);
  const cwd = sessionCwdOf(exec);
  return cwd ? resolve(cwd, value) : resolve(value);
}

function summariseInfo(kind, path, data) {
  if (kind === "pdf") return `${path}\nPDF：${data.pages} 页，${data.bytes} 字节${data.metadata && data.metadata.title ? `，标题「${data.metadata.title}」` : ""}`;
  if (kind === "docx") return `${path}\nWord：段落 ${data.paragraphs}（非空 ${data.nonEmptyParagraphs}），表格 ${data.tables}，${data.bytes} 字节`;
  if (kind === "xlsx") return `${path}\nExcel：${data.sheets.length} 个工作表（${data.sheets.map((s) => `${s.name} ${s.rows}×${s.cols}`).join("；")}）`;
  return `${path}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 模型工具（与 DLT 同名同款）
// ═══════════════════════════════════════════════════════════════════════════

/** dlt_env：环境表。 */
function envTool(bridge) {
  return defineTool({
    name: "dlt_env",
    description: "查看本机硬编码的编译/运行环境表（MSVC、MSBuild、VS 自带 cmake/ninja、Python 3.12/3.9、Node、git、dotnet、Office COM、Edge）。" +
      "这些路径已写死，直接按 id 用 dlt_run / dlt_build 执行即可，不要再自己去探测工具链位置、也不要自己拼 vcvarsall 命令。",
    parameters: {
      env: { type: "string", description: "可选：只看某一个环境 id（如 msvc-x64、python312、msbuild）的详细信息。" },
    },
    output: {
      schema: outputSchema({ environments: { type: "array", items: { type: "json" } } }),
      render: (_a, v) => {
        if (v.ok === false) return fail("环境表", v.error);
        if (v.detail) {
          const d = v.detail;
          return okText([
            `环境 ${d.id}：${d.label}`,
            `  类型: ${d.kind}${d.arch ? `  架构: ${d.arch}` : ""}${d.version ? `  版本: ${d.version}` : ""}`,
            `  可执行: ${d.program || "(由 vcvars 提供)"}`,
            d.vcvars ? `  vcvars: ${d.vcvars}` : null,
            d.tools && d.tools.length ? `  工具: ${d.tools.join(", ")}` : null,
            `  可用: ${d.available ? "是" : "否 缺失=" + (d.missing || []).join(", ")}`,
            d.note ? `  说明: ${d.note}` : null,
          ].filter(Boolean).join("\n"));
        }
        const rows = (v.environments || []).map((e) => `· ${e.id.padEnd(18)} ${e.available ? "✓" : "✗"}  ${e.label}`);
        return okText(`本机环境表（用 dlt_env env=<id> 看细节，用 dlt_run env=<id> 直接执行）：\n${rows.join("\n")}`);
      },
    },
    async execute(args) {
      const wanted = args && args.env ? String(args.env) : "";
      if (wanted) {
        const found = describeEnvironments().find((e) => e.id === wanted);
        if (!found) {
          const ids = describeEnvironments().map((e) => e.id).join(", ");
          return { ok: false, error: `未知环境 "${wanted}"。可用: ${ids}` };
        }
        return { ok: true, detail: found };
      }
      return { ok: true, environments: describeEnvironments() };
    },
  });
}

/**
 * 把 runInEnvironment 的结果归一化成**可校验**的工具输出。
 *
 * 为什么需要：超时/启动失败时 exitCode 是 null，而输出 schema 要 number ——
 * 宿主会因此把整次调用判成 invalid output。模型撞过一次就会绕开这个工具
 * （v2.12.0 之前模型"疯狂 pwsh"的直接诱因之一）。
 */
function normalizedRun(res) {
  const raw = res && typeof res === "object" ? res : {};
  const timedOut = raw.exitCode === null || raw.exitCode === undefined;
  return {
    ...raw,
    ok: raw.ok === true,
    exitCode: typeof raw.exitCode === "number" ? raw.exitCode : -1,
    timedOut,
    stdout: String(raw.stdout || ""),
    stderr: String(raw.stderr || ""),
    ms: typeof raw.ms === "number" ? raw.ms : 0,
    command: String(raw.command || ""),
  };
}

/** dlt_run：在指定环境里直接执行程序。 */
function runTool(bridge) {
  return defineTool({
    name: "dlt_run",
    description: "**首选**执行入口：在指定环境里直接跑程序并拿回 stdout/stderr/退出码。"
      + "凡是有环境（vcvars/python312/node/git/dotnet/Office COM）能满足的，就该用 dlt_run，而不是 pwsh 里拼命令行 —— " +
      "env 取自 dlt_env 的环境 id（如 msvc-x64 会自动先注入 vcvarsall，于是 cl.exe/link.exe 直接可用；python312 直接用钉死的解释器）。" +
      "program 可给绝对路径或环境内可见的命令名（msbuild / cmake / ninja 会映射到 VS 自带的那份）。",
    parameters: {
      env: { type: "string", description: "环境 id，例如 msvc-x64 / python312 / node / git / dotnet / cmd。默认 cmd。" },
      program: { type: "string", required: true, description: "要执行的程序：绝对路径，或环境内可见的命令名（cl、link、msbuild、cmake、ninja、python 等）。" },
      args: { type: "array", items: { type: "string" }, description: "参数数组（逐项传递，不需要自己加引号）。" },
      cwd: { type: "string", description: "工作目录，默认当前工作区。" },
      timeoutMs: { type: "number", description: "超时毫秒（默认 120000，超时会杀掉整个进程树）。" },
      stdin: { type: "string", description: "可选：写入标准输入的内容（例如 python 脚本源码）。" },
    },
    output: {
      schema: outputSchema({
        // 超时/启动失败时真实退出码是 null：由 normalizedRun() 归一化成 -1 并标 timedOut，
        // 否则宿主会把整次调用判成 invalid output（模型撞一次就会绕开这个工具）。
        exitCode: { type: "number" },
        stdout: { type: "string" }, stderr: { type: "string" },
        ms: { type: "number" }, command: { type: "string" },
        timedOut: { type: "boolean" },
      }),
      render: (_a, v) => {
        if (v.ok === false && v.error) return fail("执行", v.error);
        const parts = [`$ ${v.command}`, `退出码 ${v.exitCode}  用时 ${v.ms}ms`];
        if (v.stdout && v.stdout.trim()) parts.push(`--- stdout ---\n${v.stdout.trimEnd()}`);
        if (v.stderr && v.stderr.trim()) parts.push(`--- stderr ---\n${v.stderr.trimEnd()}`);
        if (!(v.stdout && v.stdout.trim()) && !(v.stderr && v.stderr.trim())) parts.push("（无输出）");
        return okText(parts.join("\n"));
      },
    },
    async execute(args) {
      const program = args && args.program;
      if (!program) return { ok: false, error: "需要 program" };
      return normalizedRun(await runInEnvironment({
        env: (args && args.env) || "cmd",
        program,
        args: Array.isArray(args.args) ? args.args.map(String) : [],
        cwd: args.cwd ? resolve(String(args.cwd)) : process.cwd(),
        timeoutMs: Number(args.timeoutMs) > 0 ? Number(args.timeoutMs) : bridge.config.dltRunTimeoutMs,
        stdin: typeof args.stdin === "string" ? args.stdin : null,
        maxOutput: bridge.config.dltMaxOutputBytes,
      }));
    },
  });
}

/** dlt_build：MSBuild 一条龙。 */
function buildTool(bridge) {
  return defineTool({
    name: "dlt_build",
    description: "用 MSBuild（在 MSVC x64 环境里）编译解决方案或工程。不传 target 时用配置里配置的默认解决方案。" +
      "这是「直接编译」的入口，不需要你自己写 vcvarsall + MSBuild 的命令行。",
    parameters: {
      target: { type: "string", description: "要编译的 .sln / .vcxproj / .csproj 路径；留空用默认解决方案。" },
      configuration: { type: "string", description: "Configuration，默认 Debug。" },
      platform: { type: "string", description: "Platform，默认 x64。" },
      env: { type: "string", description: "环境 id，默认 msbuild（= MSVC x64 + VS18 MSBuild）。" },
      extraArgs: { type: "array", items: { type: "string" }, description: "附加 MSBuild 参数。" },
      rebuild: { type: "boolean", description: "true 时用 /t:Rebuild 完整重编。" },
    },
    output: {
      schema: outputSchema({
        exitCode: { type: "number" },
        stdout: { type: "string" }, stderr: { type: "string" },
        ms: { type: "number" }, command: { type: "string" },
        timedOut: { type: "boolean" },
      }),
      render: (_a, v) => {
        if (v.ok === false && v.error) return fail("编译", v.error);
        const head = v.ok ? `✓ 编译成功（用时 ${v.ms}ms）` : `✗ 编译失败（退出码 ${v.exitCode}，用时 ${v.ms}ms）`;
        const body = [v.stdout, v.stderr].filter((s) => s && s.trim()).join("\n");
        return okText(body ? `${head}\n$ ${v.command}\n${body.trimEnd()}` : head);
      },
    },
    async execute(args) {
      const cfg = bridge.config;
      const target = (args && args.target) || cfg.dltDefaultSolution;
      if (!target) {
        return { ok: false, error: "没有给 target，且配置里的 dltDefaultSolution 为空。请传 target=.sln/.vcxproj 路径，或先在 cordis.patch.yml 里设置 dltDefaultSolution。" };
      }
      const configuration = (args && args.configuration) || cfg.dltDefaultConfiguration;
      const platform = (args && args.platform) || cfg.dltDefaultPlatform;
      const msbuildArgs = [
        resolve(String(target)),
        `/p:Configuration=${configuration}`,
        `/p:Platform=${platform}`,
        "/nologo",
        "/v:minimal",
        ...(args && args.rebuild ? ["/t:Rebuild"] : []),
        ...(Array.isArray(args && args.extraArgs) ? args.extraArgs.map(String) : []),
      ];
      return normalizedRun(await runInEnvironment({
        env: (args && args.env) || "msbuild",
        program: "msbuild",
        args: msbuildArgs,
        cwd: dirname(resolve(String(target))),
        timeoutMs: Number(args && args.timeoutMs) > 0 ? Number(args.timeoutMs) : 900000,
        maxOutput: cfg.dltMaxOutputBytes,
      }));
    },
  });
}

/** dlt_doc_read：PDF / Word / Excel / CSV 直接读。 */
function docReadTool(bridge) {
  return defineTool({
    name: "dlt_doc_read",
    description: "直接读 PDF / Word(.docx) / Excel(.xlsx) / CSV，返回结构化内容 —— 不要为了读这些文件去写 Python/Node 脚本。" +
      "mode=auto 时：PDF 返回逐页文本，Word 返回段落与表格，Excel 返回各表行列（默认显示公式文本），CSV 返回行。" +
      "mode=info 只看元信息（页数/段落数/工作表数）。",
    parameters: {
      path: { type: "string", required: true, description: "文件绝对路径或相对当前工作区的路径。" },
      mode: { type: "string", enum: ["auto", "info"], description: "auto（默认，读内容）或 info（只看元信息）。" },
      pages: { type: "array", items: { type: "json" }, description: "PDF 页码（1 基），如 [1,2] 或 [\"1-3\"]；省略为全部。" },
      sheets: { type: "array", items: { type: "string" }, description: "Excel 工作表名；省略为全部。" },
      range: { type: "string", description: "Excel 单元格区域，如 B2:D10。" },
      formulas: { type: "boolean", description: "Excel 是否显示公式（默认 true）。false 时读缓存值。" },
      maxRows: { type: "number", description: "Excel/CSV 最多返回多少行（默认 500）。" },
    },
    output: {
      schema: outputSchema({ kind: { type: "string" }, data: { type: "json" } }),
      render: (_a, v) => {
        if (v.ok === false) return fail("读取", v.error);
        return okText(v.summary || "（已读取）");
      },
    },
    async execute(args, exec) {
      const cfg = bridge.config;
      const path = resolveInputPath(args.path, exec);
      if (!existsSync(path)) return { ok: false, error: `文件不存在: ${path}` };
      const kind = docKindOf(path);
      const timeoutMs = cfg.dltDocTimeoutMs;

      if ((args.mode || "auto") === "info") {
        const data = await runDocumentOp("info", { path }, { pythonEnv: cfg.dltPythonEnv, timeoutMs });
        return { ok: true, kind, path, data, summary: summariseInfo(kind, path, data) };
      }

      if (kind === "pdf") {
        const data = await runDocumentOp("read", { path, pages: args.pages, mode: "text" }, { pythonEnv: cfg.dltPythonEnv, timeoutMs });
        const body = data.content.map((p) => `── 第 ${p.page} 页（${p.chars} 字${p.truncated ? "，已截断" : ""}）──\n${p.text.trimEnd() || "（本页无可提取文本，可能是扫描件；用 dlt_doc_convert to=png 渲染成图后再用 read_image 看）"}`).join("\n\n");
        return {
          ok: true, kind, path, data,
          summary: summariseInfo(kind, path, data) + `\n共 ${data.pages} 页，返回 ${data.returned} 页\n\n${body}`,
        };
      }
      if (kind === "docx") {
        const data = await runDocumentOp("read", { path }, { pythonEnv: cfg.dltPythonEnv, timeoutMs });
        const body = data.blocks.map((b) => (b.type === "p" ? b.text : `【${b.type}】${b.text}`)).join("\n");
        const tables = (data.tables || []).map((t) => `表 ${t.index + 1}（${t.rows}×${t.cols}）:\n` + t.data.map((r) => "  | " + r.join(" | ")).join("\n")).join("\n");
        return {
          ok: true, kind, path, data,
          summary: `${path}\n段落 ${data.paragraphs} 个（非空 ${data.blocks.length}），表格 ${(data.tables || []).length} 个\n\n${body}${tables ? "\n\n" + tables : ""}`,
        };
      }
      if (kind === "xlsx") {
        const data = await runDocumentOp("read", {
          path,
          sheets: args.sheets,
          range: args.range,
          formulas: args.formulas !== false,
          maxRows: Number(args.maxRows) > 0 ? Number(args.maxRows) : 500,
        }, { pythonEnv: cfg.dltPythonEnv, timeoutMs });
        const body = data.sheets.map((s) => {
          const rows = s.rows.map((r, i) => `${String(i + 1).padStart(3)} | ` + r.map((c) => (c === null || c === undefined ? "" : String(c))).join(" | ")).join("\n");
          return `── 表「${s.name}」${s.totalRows ? `（共 ${s.totalRows} 行 × ${s.totalCols} 列${s.truncated ? "，已截断" : ""}）` : s.range ? `（区域 ${s.range}）` : ""} ──\n${rows}`;
        }).join("\n\n");
        return {
          ok: true, kind, path, data,
          summary: `${path}\n工作表: ${data.sheets.map((s) => s.name).join(", ")}\n\n${body}`,
        };
      }
      const data = await runDocumentOp("read", { path, maxRows: Number(args.maxRows) > 0 ? Number(args.maxRows) : 500 }, { pythonEnv: cfg.dltPythonEnv, timeoutMs });
      const body = data.data.map((r, i) => `${String(i + 1).padStart(3)} | ` + r.join(" | ")).join("\n");
      return {
        ok: true, kind, path, data,
        summary: `${path}\n共 ${data.rows} 行${data.truncated ? "（已截断）" : ""}\n\n${body}`,
      };
    },
  });
}

/** dlt_doc_write：PDF / Word / Excel / CSV 直接写（默认先备份）。 */
function docWriteTool(bridge) {
  return defineTool({
    name: "dlt_doc_write",
    description: "直接修改 PDF / Word(.docx) / Excel(.xlsx) / CSV，或新建它们 —— 不要为了改这些文件去写脚本。" +
      "每次写操作默认先备份（同目录 .bak-时间戳 文件），写前会校验、写后回报实际生效的 operation 列表。" +
      "PDF 也可以用 chain=word|html 走「转成 Word/HTML → 编辑 → 转回 PDF」的往返链（复杂版面改动推荐）。",
    parameters: {
      path: { type: "string", required: true, description: "目标文件路径（新建时也要给）。" },
      action: { type: "string", enum: ["edit", "create"], description: "edit（默认，改现有文件）或 create（新建）。" },
      ops: JSON_PARAM("edit 的改动列表（数组）。各类型可用 op 见工具说明末尾。"),
      spec: JSON_PARAM("create 的规格：create 时用。PDF={pages:[{text,width,height,image}]}；Word={title,blocks:[{type:\"h1|p|table|pagebreak\",text,data,style}]}；Excel={sheets:[{name,rows:[[..]]}]}；CSV={rows:[[..]]}。"),
      kind: { type: "string", enum: ["pdf", "docx", "xlsx", "csv"], description: "create 时的目标类型；省略则按 path 扩展名推断。" },
      out: { type: "string", description: "另存到别的路径（edit 时）；省略则就地写。" },
      backup: { type: "boolean", description: "是否备份，默认 true。" },
      chain: { type: "string", enum: ["word", "html"], description: "仅 PDF：走转换链编辑。word=PDF→docx 编辑→Word 导出 PDF；html=PDF→HTML→Edge 打印回 PDF。" },
      replacements: JSON_PARAM("chain=html 时的文本替换列表：[{find, replace}]（对中间 HTML 做替换）。"),
      keepIntermediate: { type: "boolean", description: "chain 编辑时是否保留中间文件（默认 false）。" },
    },
    output: {
      schema: outputSchema({ kind: { type: "string" }, data: { type: "json" } }),
      render: (_a, v) => {
        if (v.ok === false) return fail("写入", v.error);
        return okText(v.summary || "（已写入）");
      },
    },
    async execute(args, exec) {
      const cfg = bridge.config;
      const path = resolveInputPath(args.path, exec);
      const action = args.action || "edit";
      const pythonEnv = cfg.dltPythonEnv;
      const timeoutMs = cfg.dltDocTimeoutMs;
      const backup = args.backup !== false;

      if (action === "create") {
        const kind = args.kind || docKindOf(path);
        const spec = args.spec || {};
        const data = await runDocumentOp("create", { path, kind, backup, ...spec }, { pythonEnv, timeoutMs });
        return { ok: true, kind, path: data.path, data, summary: `✓ 已新建 ${kind}: ${data.path}（${data.bytes} 字节）` };
      }

      const kind = docKindOf(path);
      if (!existsSync(path)) return { ok: false, error: `文件不存在: ${path}（新建请用 action=create）` };

      if (kind === "pdf" && (args.chain === "word" || args.chain === "html")) {
        return await pdfRoundTrip({ path, args, chain: args.chain, pythonEnv, timeoutMs, backup });
      }

      const ops = Array.isArray(args.ops) ? args.ops : (args.ops ? [args.ops] : []);
      if (ops.length === 0) return { ok: false, error: "edit 需要 ops（改动列表）" };
      const data = await runDocumentOp("edit", { path, ops, out: args.out, backup }, { pythonEnv, timeoutMs });
      const lines = (data.applied || []).map((a) => "  · " + JSON.stringify(a, null, 0));
      return {
        ok: true, kind, path: data.path, data,
        summary: [
          `✓ 已写入 ${data.path}（${data.bytes} 字节）`,
          data.backup ? `  备份: ${data.backup}` : "  （未备份）",
          `  生效 ${(data.applied || []).length} 项:`,
          ...lines,
        ].join("\n"),
      };
    },
  });
}

/** PDF → 中间格式 → 编辑 → 转回 PDF（word 链 / html 链）。 */
async function pdfRoundTrip(context) {
  const { path, args, chain, pythonEnv, timeoutMs, backup } = context;
  const stem = path.slice(0, path.length - extname(path).length);
  const steps = [];
  let backupPath = null;
  if (backup) {
    backupPath = `${path}.bak-${stamp()}`;
    await fsp.copyFile(path, backupPath);
    steps.push(`原文件已备份: ${backupPath}`);
  }

  if (chain === "word") {
    const intermediate = `${stem}.det-dlt-edit.docx`;
    await runDocumentOp("convert", { path, to: "docx", out: intermediate, backup: false }, { pythonEnv, timeoutMs });
    steps.push(`PDF → Word: ${intermediate}`);

    const ops = Array.isArray(args.ops) ? args.ops : [];
    if (ops.length > 0) {
      const edited = await runDocumentOp("edit", { path: intermediate, ops, backup: false }, { pythonEnv, timeoutMs });
      steps.push(`Word 编辑生效 ${(edited.applied || []).length} 项`);
    }
    const rendered = await officeConvert({ kind: "docx", source: intermediate, target: path });
    steps.push(`Word → PDF: ${path}（${rendered.bytes} 字节${rendered.attached ? "，复用了已开的 Word" : ""}）`);
    if (!args.keepIntermediate) await fsp.rm(intermediate, { force: true });
    return {
      ok: true, kind: "pdf", path, chain,
      data: { steps, bytes: rendered.bytes, backup: backupPath },
      summary: [`✓ PDF 往返编辑完成（Word 链）: ${path}`, ...steps.map((s) => "  · " + s)].join("\n"),
    };
  }

  const intermediate = `${stem}.det-dlt-edit.html`;
  await runDocumentOp("convert", { path, to: "html", out: intermediate, backup: false }, { pythonEnv, timeoutMs });
  steps.push(`PDF → HTML: ${intermediate}`);

  const replacements = Array.isArray(args.replacements) ? args.replacements : [];
  if (replacements.length > 0) {
    let html = await fsp.readFile(intermediate, "utf8");
    let hits = 0;
    for (const item of replacements) {
      const find = String(item && item.find !== undefined ? item.find : "");
      if (find === "") continue;
      const replace = String((item && item.replace) || "");
      const parts = html.split(find);
      hits += parts.length - 1;
      html = parts.join(replace);
    }
    await fsp.writeFile(intermediate, html, "utf8");
    steps.push(`HTML 文本替换 ${replacements.length} 条规则，命中 ${hits} 处`);
  }
  const printed = await htmlToPdf({ source: intermediate, target: path });
  steps.push(`HTML → PDF: ${path}（${printed.bytes} 字节，Edge 无头打印）`);
  if (!args.keepIntermediate) await fsp.rm(intermediate, { force: true });
  return {
    ok: true, kind: "pdf", path, chain,
    data: { steps, bytes: printed.bytes, backup: backupPath },
    summary: [`✓ PDF 往返编辑完成（HTML 链）: ${path}`, ...steps.map((s) => "  · " + s)].join("\n"),
  };
}

/** dlt_doc_convert：格式转换与页面栅格化。 */
function docConvertTool(bridge) {
  return defineTool({
    name: "dlt_doc_convert",
    description: "文档格式转换与页面栅格化：PDF→Word/HTML（可编辑中间格式）、Word/Excel→PDF（Office COM，保真最高）、HTML→PDF（Edge 无头）。" +
      "to=png 把 PDF 某一页渲染成 PNG 图片文件；扫描件 PDF 没有文本层时，先用它出图，再用 read_image 亲眼看这一页。",
    parameters: {
      path: { type: "string", required: true, description: "源文件路径。" },
      to: { type: "string", required: true, enum: ["docx", "html", "pdf", "png"], description: "目标格式。" },
      out: { type: "string", description: "输出路径；省略时按源文件同名推断。" },
      page: { type: "number", description: "to=png 时的页码（1 基，默认 1）。" },
      dpi: { type: "number", description: "to=png 的分辨率，默认 150。" },
      firstPage: { type: "number", description: "PDF→Word 的起始页（0 基，可选）。" },
      lastPage: { type: "number", description: "PDF→Word 的结束页（0 基，可选）。" },
      range: { type: "string", description: "Excel→PDF 时只导出该区域（如 A1:F40）。" },
      backup: { type: "boolean", description: "是否备份被覆盖的输出，默认 true。" },
    },
    output: {
      schema: outputSchema({ kind: { type: "string" }, out: { type: "string" }, data: { type: "json" } }),
      render: (_a, v) => {
        if (v.ok === false) return fail("转换", v.error);
        return okText(v.summary);
      },
    },
    async execute(args, exec) {
      const cfg = bridge.config;
      const path = resolveInputPath(args.path, exec);
      if (!existsSync(path)) return { ok: false, error: `文件不存在: ${path}` };
      const from = docKindOf(path);
      const to = String(args.to || "");
      const pythonEnv = cfg.dltPythonEnv;
      const timeoutMs = cfg.dltDocTimeoutMs;

      if (to === "png") {
        const data = await runDocumentOp("render", {
          path, page: Number(args.page) || 1, dpi: Number(args.dpi) || 150, out: args.out,
        }, { pythonEnv, timeoutMs });
        return {
          ok: true, kind: "png", out: data.image, data,
          summary: `✓ 已渲染第 ${data.page} 页 → ${data.image}（${data.width}×${data.height}，${data.bytes} 字节，dpi ${data.dpi}）\n接着用 read_image 传这个路径就能看到这一页。`,
        };
      }
      if (to === "pdf") {
        if (from === "docx" || from === "xlsx") {
          const out = resolve(String(args.out || `${path.slice(0, path.length - extname(path).length)}.pdf`));
          if (existsSync(out) && args.backup !== false) await fsp.copyFile(out, `${out}.bak-${Date.now()}`);
          const data = await officeConvert({ kind: from, source: path, target: out, range: args.range || "" });
          return { ok: true, kind: "pdf", out, data, summary: `✓ ${from} → PDF（Office COM）: ${out}（${data.bytes} 字节，用时 ${data.ms}ms${data.attached ? "，复用了已开的 Office" : ""}）` };
        }
        if (from === "html") {
          const out = resolve(String(args.out || `${path.slice(0, path.length - extname(path).length)}.pdf`));
          const data = await htmlToPdf({ source: path, target: out });
          return { ok: true, kind: "pdf", out, data, summary: `✓ HTML → PDF（Edge 无头）: ${out}（${data.bytes} 字节）` };
        }
        return { ok: false, error: `不支持 ${from} → pdf` };
      }
      if (to === "docx" || to === "html") {
        if (from !== "pdf") return { ok: false, error: `不支持 ${from} → ${to}（目前只支持 PDF → ${to}）` };
        const data = await runDocumentOp("convert", {
          path, to, out: args.out, firstPage: args.firstPage, lastPage: args.lastPage,
          backup: args.backup !== false,
        }, { pythonEnv, timeoutMs });
        return { ok: true, kind: to, out: data.path, data, summary: `✓ PDF → ${to.toUpperCase()}: ${data.path}（${data.bytes} 字节）` };
      }
      return { ok: false, error: `不支持的转换目标: ${to}` };
    },
  });
}

/**
 * 系统提示注入：只写「当前真的开着」的那几块，避免关掉 dlt_run 后提示里还在教模型用它。
 * @returns {Function|null} disposer；无可写内容时返回 null。
 */
function registerDltPromptSection(bridge) {
  if (!bridge.service.config.dltPromptSection) return null;
  const prompt = svc(bridge.ctx, SERVICE.systemPrompt);
  if (!prompt || typeof prompt.section !== "function") return null;

  const wantEnv = dltFeatureOn(bridge.features, "dltEnv");
  const wantRun = dltFeatureOn(bridge.features, "dltRun");
  const wantDocs = dltFeatureOn(bridge.features, "dltDocs");
  if (!wantEnv && !wantRun && !wantDocs) return null;

  const lines = ["# DLT 运行环境与执行工具"];
  if (wantEnv || wantRun) {
    lines.push("本机工具链路径已硬编码在 DLT 里（cl / msbuild / cmake / ninja 都不在 PATH 上，必须靠环境注入）。");
    const howTo = [];
    if (wantEnv) howTo.push("要看详细清单用 dlt_env");
    if (wantRun) howTo.push("要执行程序用 dlt_run（env 名 + program + args），不要在 pwsh 里自己拼 vcvarsall/命令字符串；要编译用 dlt_build");
    lines.push(howTo.join("；") + "。");
  }
  if (wantEnv) {
    lines.push(wantRun ? "可用环境（dlt_run/dlt_build 的 env 参数）：" : "可用环境：");
    for (const e of describeEnvironments().filter((x) => x.available)) lines.push(`  · ${e.id} — ${e.label}`);
  }
  if (wantDocs) {
    lines.push(
      "",
      "# DLT 文档工具",
      "读/写 PDF、Word、Excel、CSV 一律用 dlt_doc_read / dlt_doc_write / dlt_doc_convert，不要为了这些文件去写 Python 或 Node 脚本、也不要用 bash/pwsh 拼命令行。",
      "扫描件 PDF 没有文本层时：dlt_doc_convert to=png 渲染该页，再用 read_image 看它。改动复杂版面时可用 dlt_doc_write 的 chain=word（PDF→Word→编辑→Word 导出 PDF）。",
      "所有写操作默认先备份。",
      "（这几个工具由 DET 提供；DLT 本体在 DET 开启期间已整体停摆。）",
    );
  }

  return prompt.section({
    name: "tool:dlt",
    order: bridge.service.config.dltPromptOrder,
    text: lines.join("\n"),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 桥：把「功能开关装卸」与「客户端端点实现」收到一个对象里
// ═══════════════════════════════════════════════════════════════════════════

export class DltBridge {
  /** @param service - EssentialToolsService（提供 config / ctx / sessionEventsOf / workspaceRoot）。 */
  constructor(service) {
    this.service = service;
    this.ctx = service.ctx;
    this._pricing = null;
    this._pricingAt = 0;
    this._deriveTurnUsage = undefined;
    this._toolDisposers = [];
    this._toolNames = [];
    this._promptDisposer = null;
    this._features = null;
    this._retryTimer = null;
    this._retryLeft = 0;
    // 环境表的路径覆盖必须在任何 dlt_env / dlt_run / dlt_build / 文档调用之前生效。
    configureEnvironments(service.config.dltEnvironments);
  }

  get config() { return this.service.config; }

  /** createRequire 惰性构造（只在需要按另一个解析根找 dsh-token-meter 时才用）。 */
  _require() {
    if (!this._req) this._req = createRequire(import.meta.url);
    return this._req;
  }

  /** 当前生效的功能开关（由 _syncDetRuntimeFeatures 写入）。 */
  get features() { return this._features || { master: true }; }

  /** 定价/缓存目录：默认 <DSH_HOME>/det/dlt（与 DLT 的 <DSH_HOME>/dlt 分开，互不干扰）。 */
  get cacheDir() {
    const c = this.config.dltCacheDir;
    return c && String(c).trim() !== "" ? String(c) : join(dshHome(), "det", "dlt");
  }

  /** 装/卸 DLT 工具集（幂等）。features 为 null 时表示总开关关闭。 */
  sync(features) {
    this._features = features || { master: false };
    this._disposeRuntime();
    const on = (key) => dltFeatureOn(this._features, key);
    if (!on("dltEnv") && !on("dltRun") && !on("dltDocs")) return { tools: [], conflict: false };

    const tools = svc(this.ctx, SERVICE.tools);
    let conflict = false;
    if (tools && typeof tools.register === "function") {
      const wanted = [];
      if (on("dltEnv")) wanted.push(envTool(this));
      if (on("dltRun")) wanted.push(runTool(this), buildTool(this));
      if (on("dltDocs")) wanted.push(docReadTool(this), docWriteTool(this), docConvertTool(this));
      for (const definition of wanted) {
        try {
          const disposer = tools.register(definition);
          this._toolDisposers.push(typeof disposer === "function" ? disposer : () => {});
          this._toolNames.push(definition.name);
        } catch (error) {
          // 名字被占（典型场景：启动瞬间 DLT 还没收到「已接管」声明）→ 稍后重试。
          conflict = true;
        }
      }
    }
    try {
      this._promptDisposer = registerDltPromptSection(this) || null;
    } catch (error) {
      this._promptDisposer = null;
    }
    if (conflict && this._retryLeft > 0 && this._retryTimer === null) {
      this._retryLeft -= 1;
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        try { this.sync(this._features); } catch (error) { /* 尽力而为 */ }
      }, 2500);
      if (typeof this._retryTimer.unref === "function") this._retryTimer.unref();
    }
    return { tools: this._toolNames.slice(), conflict };
  }

  /** 撤下全部宿主注入（工具 + 系统提示）。可重入。 */
  _disposeRuntime() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
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

  /** 每次开关变化时重置重试预算（连续几次重试足够等到 DLT 让位）。 */
  resetRetry() { this._retryLeft = 4; }

  dispose() { this._disposeRuntime(); }

  /** 当前装载事实（给 DET 管理器/诊断用）。 */
  info() {
    return {
      tools: this._toolNames.slice(),
      promptSection: this._promptDisposer !== null,
      features: { ...(this._features || {}) },
      paths: {
        packageRoot: PACKAGE_ROOT,
        pythonEngine: PY_ENGINE,
        pythonEngineExists: existsSync(PY_ENGINE),
        officeBridge: OFFICE_BRIDGE,
        officeBridgeExists: existsSync(OFFICE_BRIDGE),
        cacheDir: this.cacheDir,
        pricingCache: join(this.cacheDir, "pricing.json"),
      },
    };
  }

  // ── 定价（成本小签用）────────────────────────────────────────────────────

  async pricing(force = false) {
    const fresh = this._pricing && !force && Date.now() - this._pricingAt < this.config.dltPricingMaxAgeMs;
    if (fresh) return this._pricing;
    const table = await loadPricing({ cacheDir: this.cacheDir, maxAgeMs: this.config.dltPricingMaxAgeMs, force });
    this._pricing = table;
    this._pricingAt = Date.now();
    return table;
  }

  async pricingInfo(args = {}) {
    const table = await this.pricing(args && args.force === true);
    return { ok: true, ...table };
  }

  async envs() {
    return { ok: true, environments: describeEnvironments() };
  }

  /**
   * 逐轮用量折叠：复用 dsh-token-meter 自己的 turn-usage 模块，
   * 保证这里算出的 token 与 UI 用量胶囊、DET 状态框完全一致。
   */
  async deriveTurnUsage() {
    if (this._deriveTurnUsage !== undefined) return this._deriveTurnUsage;
    const candidates = [];
    const push = (url) => { if (url && !candidates.includes(url)) candidates.push(url); };
    try {
      push(new URL("lib/types/turn-usage.js", import.meta.resolve("@deepseek-ai/dsh-token-meter/package.json")).href);
    } catch (error) { /* 试下一条 */ }
    try {
      const cordisPkg = this._require().resolve("@deepseek-ai/cordis/package.json");
      const sibling = join(dirname(dirname(cordisPkg)), "dsh-token-meter", "lib", "types", "turn-usage.js");
      if (existsSync(sibling)) push(pathToFileURL(sibling).href);
    } catch (error) { /* 试下一条 */ }
    for (const url of candidates) {
      try {
        const mod = await import(url);
        if (typeof mod.deriveTurnTokenUsage === "function") {
          this._deriveTurnUsage = mod.deriveTurnTokenUsage;
          return this._deriveTurnUsage;
        }
      } catch (error) { /* 试下一条 */ }
    }
    this._deriveTurnUsage = null;
    return null;
  }

  /** 把事件流切成若干轮（turn/start … turn/end）。 */
  static groupTurns(events) {
    const turns = [];
    let current = null;
    for (const event of events) {
      const type = event && event.type;
      if (type === "turn/start") {
        current = { turn: event.data ? event.data.turn : undefined, startTime: event.time ?? null, events: [event] };
        continue;
      }
      if (!current) continue;
      current.events.push(event);
      if (type === "turn/end") {
        current.endTime = event.time ?? null;
        current.open = false;
        turns.push(current);
        current = null;
      }
    }
    if (current) turns.push({ ...current, open: true });
    return turns;
  }

  /** 端点：某个会话每轮的人民币成本（客户端「本轮 ¥x.xx」小签用）。 */
  async cost(args = {}) {
    const sessionId = args.sessionId || args.session;
    if (!sessionId) throw new Error("cost 需要 sessionId");
    const table = await this.pricing(false);
    const events = await this.service.sessionEventsOf(sessionId);
    if (!Array.isArray(events)) throw new Error(`取不到会话 ${sessionId} 的事件日志`);
    const groups = DltBridge.groupTurns(events);
    const derive = await this.deriveTurnUsage();

    const turns = [];
    const warnings = [];
    let sessionTotal = 0;
    let priced = 0;

    for (const group of groups) {
      const entry = { turn: group.turn, open: !!group.open, at: group.endTime || group.startTime || null, usage: null, cost: null };
      if (!group.open && derive) {
        let usage = null;
        try {
          usage = derive(group.events);
        } catch (error) {
          warnings.push(`第 ${group.turn} 轮用量折叠失败：${error.message}`);
        }
        if (usage) {
          entry.usage = usage;
          const priced2 = priceUsage(usage, { routes: usage.routes, at: entry.at }, table);
          entry.cost = priced2.cost;
          entry.band = priced2.band;
          entry.bandLabel = priced2.bandLabel;
          entry.billingModel = priced2.billingModel;
          entry.model = priced2.model;
          entry.routes = usage.routes || null;
          entry.lines = priced2.lines;
          entry.warnings = priced2.warnings;
          if (typeof priced2.cost === "number") {
            sessionTotal += priced2.cost;
            priced++;
          }
        }
      }
      turns.push(entry);
    }

    if (!derive) warnings.push("未能加载 dsh-token-meter 的 turn-usage 模块，无法得到逐轮精确用量。");

    return {
      ok: true,
      currency: table.currency || "CNY",
      sessionId,
      turns,
      turnCount: turns.length,
      pricedTurns: priced,
      sessionTotal,
      peakNow: peakBand(Date.now()),
      pricing: {
        source: table.source,
        fetchedAt: table.fetchedAt,
        stale: !!table.stale,
        fromCache: !!table.fromCache,
        modelIds: table.modelIds,
        models: table.models,
        peakRule: table.peakRule,
        note: table.note,
      },
      warnings: [...warnings, ...(table.warning ? [table.warning] : [])],
    };
  }

  // ── 右栏预览数据 ─────────────────────────────────────────────────────────

  /** 把预览传来的地址/路径还原成磁盘上的绝对路径。 */
  async resolvePreviewPath(args) {
    const raw = args.path || args.address || "";
    const parsed = parseResourceAddress(raw);
    const sessionId = args.sessionId || parsed.sessionId || null;
    const candidate = parsed.path || String(raw);
    if (isAbsolutePath(candidate)) return { path: resolve(candidate), sessionId };
    const cwd = sessionId ? await this.service.workspaceRoot(sessionId) : "";
    const joined = cwd ? resolve(cwd, candidate) : resolve(candidate);
    if (existsSync(joined)) return { path: joined, sessionId, resolvedFrom: cwd ? "session-cwd" : "process-cwd" };
    const fallback = resolve(candidate);
    if (existsSync(fallback)) return { path: fallback, sessionId, resolvedFrom: "process-cwd" };
    return {
      path: joined,
      sessionId,
      resolvedFrom: null,
      error: `文件不存在: ${joined}${cwd ? "" : "（没有会话工作区信息，相对路径无法补全，请传绝对路径）"}`,
    };
  }

  /** 端点：给右栏预览返回结构化的 Word / Excel / CSV 内容（不返回原始二进制）。 */
  async office(args = {}) {
    const resolved = await this.resolvePreviewPath(args);
    const path = resolved.path;
    if (resolved.error) throw new Error(resolved.error);
    if (!existsSync(path)) throw new Error(`文件不存在: ${path}`);
    const kind = docKindOf(path);
    if (kind === "pdf" || kind === "html") {
      return { ok: true, kind, path, handled: false, reason: `${kind} 由产品自带渲染器处理` };
    }
    if (kind === "docx") {
      const data = await runDocumentOp("read", { path }, { pythonEnv: this.config.dltPythonEnv, timeoutMs: this.config.dltDocTimeoutMs });
      return { ok: true, kind, path, handled: true, document: data, bytes: (await fsp.stat(path)).size };
    }
    if (kind === "xlsx") {
      const data = await runDocumentOp("read", {
        path,
        formulas: args.formulas === true,
        maxRows: Math.min(Number(args.maxRows || this.config.dltPreviewMaxRows), 2000),
        maxCols: Math.min(Number(args.maxCols || this.config.dltPreviewMaxCols), 200),
      }, { pythonEnv: this.config.dltPythonEnv, timeoutMs: this.config.dltDocTimeoutMs });
      return { ok: true, kind, path, handled: true, workbook: data, bytes: (await fsp.stat(path)).size };
    }
    if (kind === "csv") {
      const data = await runDocumentOp("read", { path, maxRows: 2000 }, { pythonEnv: this.config.dltPythonEnv, timeoutMs: this.config.dltDocTimeoutMs });
      return { ok: true, kind, path, handled: true, csv: data, bytes: (await fsp.stat(path)).size };
    }
    return { ok: false, kind, path, error: `不支持的预览类型 ${kind}` };
  }

  // ── 草图（draft）─────────────────────────────────────────────────────────

  /**
   * 「这个会话下一次请求会用哪个模型」——**实时**事实源，不是上一轮的历史。
   *
   * 为什么要单列一个方法：`request/header` 记的是**已经跑过**的那一轮的模型
   * （投影里的 `lastUsed`）。用户在模型选择器里换了模型之后，会话里会先落一条
   * `model/selection`、投影里出现 `pending`，要等下一轮请求才会被「consumed」。
   * 只看 `request/header` 就会拿旧模型做判断：草图明明该走「切到视觉模型再注入」，
   * 却按旧模型说「当前模型能收图」——发送时才被宿主以
   * `MODEL_DOES_NOT_SUPPORT_IMAGES` 顶回来。所以这里优先读投影的
   * `pending ?? lastUsed`，其次才退到 `request/header`，最后退到宿主默认模型。
   *
   * @returns {Promise<{provider:string, model:string, source:(string|null), live:boolean}>}
   */
  async liveModelSelection(sessionId) {
    // 1) 会话投影 modelSelection：pending（用户刚选、还没跑）优先，其次 lastUsed。
    try {
      const projections = svc(this.ctx, SERVICE.sessionProjections);
      const sessions = svc(this.ctx, SERVICE.sessions);
      const session = sessions && typeof sessions.get === "function" && sessionId ? sessions.get(sessionId) : null;
      if (projections && typeof projections.stateOf === "function" && session) {
        const state = projections.stateOf(session, "modelSelection");
        const pending = state && state.pending;
        if (pending && pending.provider && pending.model) {
          return { provider: String(pending.provider), model: String(pending.model), source: "projection-pending", live: true };
        }
        const lastUsed = state && state.lastUsed;
        if (lastUsed && lastUsed.provider && lastUsed.model) {
          return { provider: String(lastUsed.provider), model: String(lastUsed.model), source: "projection-lastUsed", live: true };
        }
      }
    } catch (error) { /* 投影服务缺失/未注册该单元 → 退到事件日志 */ }

    // 2) 事件日志：最后一条 model/selection（用户最近一次切换）优先于最后一条 request/header。
    try {
      const events = await this.service.sessionEventsOf(sessionId);
      if (Array.isArray(events)) {
        let selected = null;
        let ran = null;
        for (let i = events.length - 1; i >= 0; i--) {
          const ev = events[i];
          if (!ev) continue;
          if (!selected && ev.type === "model/selection") {
            const d = ev.data || {};
            if (d.provider && d.model) selected = { provider: String(d.provider), model: String(d.model), seq: Number(ev.seq) || 0 };
          }
          if (!ran && ev.type === "request/header") {
            const cfg = ev.data && ev.data.header && ev.data.header.config;
            if (cfg && cfg.provider && cfg.model) ran = { provider: String(cfg.provider), model: String(cfg.model), seq: Number(ev.seq) || 0 };
          }
          if (selected && ran) break;
        }
        // 切换发生在「最后一次真正跑过的请求」之后 → 它才是下一次要用的模型。
        if (selected && (!ran || selected.seq > ran.seq)) {
          return { provider: selected.provider, model: selected.model, source: "event-model-selection", live: true };
        }
        if (ran) return { provider: ran.provider, model: ran.model, source: "request/header", live: false };
        if (selected) return { provider: selected.provider, model: selected.model, source: "event-model-selection", live: true };
      }
    } catch (error) { /* 尽力而为 */ }

    // 3) 宿主默认模型。
    const def = svc(this.ctx, SERVICE.agentDefaultModel);
    if (def && typeof def.currentSelection === "function") {
      try {
        const sel = def.currentSelection();
        if (sel && sel.provider && sel.model) {
          return { provider: String(sel.provider), model: String(sel.model), source: "default", live: false };
        }
      } catch (error) { /* 尽力而为 */ }
    }
    return { provider: "", model: "", source: null, live: false };
  }

  /**
   * 某个会话此刻实际生效的模型路由（兼容旧调用方；等价于 liveModelSelection）。
   * @returns {Promise<{provider:string, model:string, source:(string|null), live:boolean}>}
   */
  async sessionModelRoute(sessionId) {
    return this.liveModelSelection(sessionId);
  }

  /**
   * **实时**问模型表：这条路由收不收图片。
   * 判据只有一条：宿主 `llm.resolveModelInfo()` 给的 `inputModalities` 里含 `image`。
   * 拿不到模型信息时返回 `{ images:false, known:false }` —— 宁可按「收不了图」处理
   * （退回存 PNG），也不要在发送时才被宿主拒绝。
   * @returns {Promise<{images:boolean, known:boolean, modalities:string[], error:string}>}
   */
  async modelAcceptsImages(provider, model) {
    const llm = svc(this.ctx, SERVICE.llm);
    if (!provider || !model) return { images: false, known: false, modalities: [], error: "没有可判定的模型路由" };
    if (!llm || typeof llm.resolveModelInfo !== "function") {
      return { images: false, known: false, modalities: [], error: "宿主 llm 服务不可用（无法读模型表）" };
    }
    try {
      const info = await llm.resolveModelInfo(provider, model);
      const modalities = info && info.inputModalities ? Array.from(info.inputModalities).map(String) : [];
      return { images: modalities.indexOf("image") !== -1, known: true, modalities, error: "" };
    } catch (error) {
      return { images: false, known: false, modalities: [], error: String(error && error.message ? error.message : error) };
    }
  }

  /** 部署侧附件白名单里是否收 image/png（拿不到就按「收」处理，交给宿主最终裁决）。 */
  attachmentAllowsPng() {
    try {
      const attachments = svc(this.ctx, SERVICE.attachments);
      const limits = attachments && attachments.imageLimits;
      if (limits && Array.isArray(limits.mediaTypes)) {
        const list = limits.mediaTypes.map(String);
        if (list.length > 0) return list.some((t) => t === "image/png" || t === "image/*");
      }
    } catch (error) { /* 没有 attachment 服务 → 不拦 */ }
    return true;
  }

  /**
   * 端点：这个会话当前的模型是否接受图片输入（决定草图怎么导入）。
   *
   * 判据全部**实时**取：模型来自会话投影的 `pending ?? lastUsed`（不是上一轮的历史），
   * 「收不收图」来自宿主模型表的 `inputModalities`。客户端每次点「导入」都会重新问，
   * 所以画布开着的时候换了模型也立刻按新模型判断。
   */
  async draftSupport(args = {}) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const route = await this.liveModelSelection(sessionId);
    const mediaTypes = [];
    try {
      const attachments = svc(this.ctx, SERVICE.attachments);
      const limits = attachments && attachments.imageLimits;
      if (limits && Array.isArray(limits.mediaTypes)) for (const t of limits.mediaTypes) mediaTypes.push(String(t));
    } catch (error) { /* 部署没有 attachment 服务时按空表处理 */ }

    const probe = await this.modelAcceptsImages(route.provider, route.model);
    const pngOk = this.attachmentAllowsPng();
    const images = probe.images && pngOk;
    let reason = "";
    if (!probe.images) {
      reason = probe.error
        ? `模型信息读取失败（${probe.error}）：按不支持图片处理（存 PNG + 路径）`
        : (route.provider && route.model
          ? `当前模型 ${route.model} 未声明图片输入（inputModalities=${probe.modalities.length ? probe.modalities.join("/") : "未声明"}）：草图会存成 PNG 并把路径插进输入框`
          : "取不到当前会话的模型路由：按不支持图片处理（存 PNG + 路径）");
    } else if (!pngOk) {
      reason = "本部署的附件服务不收 image/png：草图会存成 PNG 并把路径插进输入框";
    }
    return {
      ok: true,
      sessionId,
      images,
      mediaTypes,
      provider: route.provider,
      model: route.model,
      routeSource: route.source,
      routeLive: route.live === true,
      modalities: probe.modalities,
      modelKnown: probe.known,
      pngAllowed: pngOk,
      reason,
    };
  }

  /**
   * 端点：草图落盘（PNG）。默认目录 = <会话工作区>/.dsh-drafts。
   *
   * 落点是被**收窄**的：只接受「本会话的工作区」或「本会话工作区之下的目录」，
   * 其余 `dir` 一律忽略（防止调用方把 PNG 写到任意位置）；没有会话工作区时
   * 落到 DET 自己的 drafts 缓存目录。
   */
  async draftSave(args = {}) {
    const raw = String((args && (args.dataUrl || args.data)) || "");
    if (raw === "") return { ok: false, error: "缺少草图数据（dataUrl / base64）" };
    const comma = raw.indexOf(",");
    const base64 = /^data:/i.test(raw) ? raw.slice(comma + 1) : raw;
    let bytes;
    try {
      bytes = Buffer.from(base64, "base64");
    } catch (error) {
      return { ok: false, error: `草图 base64 解析失败：${error && error.message ? error.message : error}` };
    }
    if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) {
      return { ok: false, error: "草图数据不是合法 PNG（只接受画布导出的 PNG）" };
    }
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    let workspace = "";
    if (sessionId !== "") {
      try { workspace = (await this.service.workspaceRoot(sessionId)) || ""; } catch (error) { workspace = ""; }
    }
    const rootResolved = workspace ? resolve(workspace) : "";
    // args.dir：只有当它就是本会话工作区（或其中子目录）时才认；否则忽略并如实记录。
    let rejectedDir = "";
    let base = rootResolved;
    if (args && args.dir) {
      const wanted = resolve(String(args.dir));
      const inside = rootResolved !== "" &&
        (wanted.toLowerCase() === rootResolved.toLowerCase() ||
          wanted.toLowerCase().startsWith((rootResolved + "\\").toLowerCase()));
      if (inside) base = wanted;
      else rejectedDir = wanted;
    }
    const dir = base ? join(base, ".dsh-drafts") : join(this.cacheDir, "drafts");
    let name = String((args && args.name) || `sketch-${stamp()}.png`).replace(/[\\/:*?"<>|]+/g, "_");
    if (!/\.png$/i.test(name)) name += ".png";
    // 同名不覆盖：同秒内连画两张时补 -2 / -3 …
    let path = join(dir, name);
    try {
      await fsp.mkdir(dir, { recursive: true });
      if (existsSync(path)) {
        const stem = name.replace(/\.png$/i, "");
        for (let i = 2; i < 100; i++) {
          const candidate = join(dir, `${stem}-${i}.png`);
          if (!existsSync(candidate)) { path = candidate; name = `${stem}-${i}.png`; break; }
        }
      }
      await fsp.writeFile(path, bytes);
    } catch (error) {
      return { ok: false, error: `草图写入失败：${error && error.message ? error.message : error}` };
    }
    const rel = base && path.toLowerCase().startsWith((base + "\\").toLowerCase())
      ? path.slice(base.length + 1).replace(/\\/g, "/")
      : null;
    return {
      ok: true, dir, path, rel, name, bytes: bytes.length, sessionId, cwd: base || null,
      ...rejectedDir ? { dirIgnored: rejectedDir, dirIgnoredReason: "不在本会话工作区内，已改用默认目录" } : {},
    };
  }

  // ── 诊断 ────────────────────────────────────────────────────────────────

  async status() {
    const table = await this.pricing(false).catch((error) => ({ error: error.message }));
    const derive = await this.deriveTurnUsage();
    return {
      ok: true,
      owner: "dsh-essential-tools",
      ...this.info(),
      pythonEnv: this.config.dltPythonEnv,
      turnUsageFold: derive ? "dsh-token-meter/turn-usage" : null,
      pricing: table && table.error ? { error: table.error } : {
        source: table && table.source,
        fetchedAt: table && table.fetchedAt,
        stale: !!(table && table.stale),
        modelIds: table && table.modelIds,
      },
      environments: describeEnvironments().map((e) => ({ id: e.id, available: e.available, label: e.label })),
      peakNow: peakBand(Date.now()),
    };
  }
}

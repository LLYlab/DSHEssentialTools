// dsh-essential-tools — Host 半区（永久 npm 包，精简版）
// 只保留三大能力：
//   运行  —— 工作区含可运行入口（独立/入口 py/cpp，或 sln）时出现；按入口类型运行
//   文件  —— 浏览当前会话工作区文件（文件夹折叠树）
//   版本  —— 程序版本快照/回退/删除（只动代码文件）
// 已移除：VTD 分支、会话树、会话管理、消息小版本、回退开关。
//
// 通信：typert Remote（永久包标准机制）。Host = TypertRemoteService 子类 + ctx.typert.register。

import z from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

/** Cordis 插件名。 */
const name = "dsh-essential-tools";
/** 硬依赖：typert 注册表。其余服务 ctx.get() 可选读取。 */
const inject = ["typert"];

/** 插件配置（路径 默认值 = 用户当前工程；实际工作区优先用会话 cwd）。 */
const Config = z.object({
  lvalRoot: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL"),
  srcDir: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL\\LVAL"),
  solution: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL\\LVAL.slnx"),
  msbuild: z.string().default("C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe"),
  configuration: z.string().default("Debug"),
  platform: z.string().default("x64"),
});

const NL = String.fromCharCode(10);

/** 源码扩展名白名单（文件预览 + 程序版本快照用）。 */
const SOURCE_EXT = { ".h": 1, ".hpp": 1, ".hh": 1, ".hxx": 1, ".inl": 1, ".c": 1, ".cpp": 1, ".cc": 1, ".cxx": 1, ".rc": 1, ".json": 1, ".slnx": 1, ".sln": 1, ".vcxproj": 1, ".md": 1, ".txt": 1, ".py": 1, ".cs": 1, ".js": 1, ".ts": 1, ".yaml": 1, ".yml": 1, ".xml": 1, ".props": 1, ".targets": 1 };
/** 快照/预览跳过的目录。 */
const SKIP_DIRS = { "x64": 1, "debug": 1, "release": 1, ".vs": 1, ".git": 1, "microsoft": 1, "vcpkg_installed": 1, "out": 1, ".lval-versions": 1, "node_modules": 1, "bin": 1, ".venv": 1 };
/** 运行入口文件名（常见 main/entry/run）。 */
const ENTRY_NAMES = { "main": 1, "entry": 1, "run": 1, "app": 1 };

/** 路径白名单校验（防目录穿越）。 */
function safeRel(rel) {
  if (typeof rel !== "string") return null;
  const r = rel.replace(/\\/g, "/");
  if (r === "" || r.charAt(0) === "/") return null;
  if (r.indexOf("..") !== -1) return null;
  if (/^[A-Za-z]:/.test(r)) return null;
  return r;
}

class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");
    this.config = config;
  }

  // ── 工具函数 ────────────────────────────────────────────────────────────

  fs() { return this.ctx.get("fs"); }
  subprocess() { return this.ctx.get("subprocess"); }
  sessions() { return this.ctx.get("sessions"); }

  /** 当前会话工作区根目录：优先会话 cwd，否则回退到 config.srcDir。 */
  async workspaceRoot(sessionId) {
    const sessions = this.sessions();
    if (sessions && typeof sessionId === "string" && sessionId !== "") {
      const s = sessions.get(sessionId);
      if (s && s.header && typeof s.header.cwd === "string" && s.header.cwd !== "") return s.header.cwd;
    }
    return this.config.srcDir;
  }

  async versionsDir(sessionId) {
    const root = await this.workspaceRoot(sessionId);
    return root + "\\.lval-versions";
  }

  /** 遍历工作区源码文件（含 target 供读取）。 */
  async collectSourceFiles(sessionId) {
    const fs = this.fs();
    if (!fs) return [];
    const root = await this.workspaceRoot(sessionId);
    const out = [];
    const seen = {};
    const walk = async (target, rel) => {
      if (out.length >= 400) return;
      let entries;
      try { entries = await fs.listDir(target); } catch (e) { return; }
      for (const entry of entries) {
        if (entry.type === "directory") {
          const n = entry.name.toLowerCase();
          if (SKIP_DIRS[n]) continue;
          await walk(entry.target, rel + "/" + entry.name);
        } else {
          const dot = entry.name.lastIndexOf(".");
          if (dot < 0) continue;
          const ext = entry.name.slice(dot).toLowerCase();
          if (!SOURCE_EXT[ext]) continue;
          const p = (rel + "/" + entry.name).slice(1);
          if (seen[p]) continue;
          seen[p] = 1;
          out.push({ rel: p, size: entry.size || 0, target: entry.target });
        }
      }
    };
    try {
      const rootTarget = await fs.resolve(root);
      await walk(rootTarget, "");
    } catch (e) { /* ignore */ }
    return out;
  }

  /** 工作区运行入口探测。 */
  async workspaceDetect(sessionId) {
    const fs = this.fs();
    if (!fs) return { ok: true, runable: false };
    const root = await this.workspaceRoot(sessionId);
    let entries = [];
    try { entries = await fs.listDir(await fs.resolve(root)); } catch (e) { return { ok: true, runable: false, root }; }
    let solution = null, pyEntry = null, cppEntry = null, pyAny = null, cppAny = null;
    for (const en of entries) {
      if (en.type !== "file") continue;
      const name = en.name;
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
      if (ext === ".sln" || ext === ".slnx") { if (!solution) solution = name; continue; }
      if (ext === ".py") { if (!pyAny) pyAny = name; if (ENTRY_NAMES[base.toLowerCase()] && !pyEntry) pyEntry = name; }
      if (ext === ".cpp" || ext === ".c" || ext === ".cc" || ext === ".cxx") { if (!cppAny) cppAny = name; if (ENTRY_NAMES[base.toLowerCase()] && !cppEntry) cppEntry = name; }
    }
    // 优先级：入口 py > 入口 cpp > sln > 任意 py/cpp
    let kind = null, file = null;
    if (pyEntry) { kind = "python"; file = pyEntry; }
    else if (cppEntry) { kind = "cpp"; file = cppEntry; }
    else if (solution) { kind = "sln"; file = solution; }
    else if (pyAny) { kind = "python"; file = pyAny; }
    else if (cppAny) { kind = "cpp"; file = cppAny; }
    return { ok: true, root, runable: kind !== null, kind, entry: file, solution };
  }

  async readManifest(sessionId) {
    const fs = this.fs();
    if (!fs) return [];
    try {
      const target = await fs.resolve((await this.versionsDir(sessionId)) + "\\versions.json");
      const stat = await fs.stat(target);
      if (!stat || stat.type !== "file") return [];
      const text = await fs.readText(target);
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  async writeManifest(sessionId, list) {
    const fs = this.fs();
    if (!fs) return;
    try {
      const target = await fs.resolve((await this.versionsDir(sessionId)) + "\\versions.json");
      await fs.writeText(target, JSON.stringify(list, null, 2));
    } catch (e) { /* ignore */ }
  }

  // ── 端点：信息 / 探测 / 文件 ─────────────────────────────────────────────

  async lvalInfo(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const root = await this.workspaceRoot(sessionId);
    const detect = await this.workspaceDetect(sessionId);
    return { ok: true, root, msbuild: this.config.msbuild, configuration: this.config.configuration, platform: this.config.platform, runable: detect.runable, runKind: detect.kind, runEntry: detect.entry, solution: detect.solution };
  }

  async workspaceDetectEndpoint(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    return this.workspaceDetect(sessionId);
  }

  /** 文件树（文件夹折叠）。返回嵌套树：目录 children，文件 size。 */
  async lvalListFiles(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const fs = this.fs();
    if (!fs) return { ok: false, error: "fs 服务不可用" };
    const root = await this.workspaceRoot(sessionId);
    let rootTarget;
    try { rootTarget = await fs.resolve(root); } catch (e) { return { ok: false, error: "工作区不存在" }; }
    const buildTree = async (target, rel) => {
      let entries;
      try { entries = await fs.listDir(target); } catch (e) { return []; }
      const nodes = [];
      for (const en of entries) {
        if (en.type === "directory") {
          const n = en.name.toLowerCase();
          if (SKIP_DIRS[n]) continue;
          const children = await buildTree(en.target, rel + "/" + en.name);
          nodes.push({ name: en.name, type: "dir", path: (rel + "/" + en.name).slice(1) || en.name, children });
        } else {
          const dot = en.name.lastIndexOf(".");
          if (dot < 0) continue;
          const ext = en.name.slice(dot).toLowerCase();
          if (!SOURCE_EXT[ext]) continue;
          nodes.push({ name: en.name, type: "file", path: (rel + "/" + en.name).slice(1), size: en.size || 0 });
        }
      }
      nodes.sort((a, b) => (a.type === b.type ? (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : (a.type === "dir" ? -1 : 1)));
      return nodes;
    };
    try {
      const tree = await buildTree(rootTarget, "");
      return { ok: true, root, tree };
    } catch (e) {
      return { ok: false, error: "读取失败: " + String(e && e.message ? e.message : e) };
    }
  }

  async lvalReadFile(args) {
    const fs = this.fs();
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const rel = safeRel(args && args.path);
    if (rel === null) return { ok: false, error: "非法路径" };
    const root = await this.workspaceRoot(sessionId);
    const full = root + "\\" + rel.replace(/\//g, "\\");
    try {
      const target = await fs.resolve(full);
      const stat = await fs.stat(target);
      if (!stat || stat.type !== "file") return { ok: false, error: "文件不存在: " + rel };
      if (stat.size !== undefined && stat.size > 2 * 1024 * 1024) return { ok: false, error: "文件过大(>2MB): " + rel };
      const content = await fs.readText(target);
      return { ok: true, content, path: rel };
    } catch (e) {
      return { ok: false, error: "读取失败: " + String(e && e.message ? e.message : e) };
    }
  }

  // ── 运行：按入口类型 ────────────────────────────────────────────────────

  async buildOnce(solution, root) {
    const subprocess = this.subprocess();
    if (!subprocess) return { ok: false, exitCode: -1, output: "subprocess 服务不可用" };
    let handle;
    try {
      handle = subprocess.spawn({
        argv: [this.config.msbuild, solution, "-p:Configuration=" + this.config.configuration, "-p:Platform=" + this.config.platform, "-m", "-v:m", "-nologo"],
        cwd: root,
        stdio: { stdin: "ignore", stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } }, stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } } },
        graceMs: 30000,
      });
    } catch (e) {
      return { ok: false, exitCode: -1, output: "启动 MSBuild 失败: " + String(e && e.message ? e.message : e) };
    }
    let outcome;
    try { outcome = await handle.done; } catch (e) { return { ok: false, exitCode: -1, output: "MSBuild 运行失败: " + String(e && e.message ? e.message : e) }; }
    let out = "", err = "";
    try { out = handle.collected.stdout.readFrom(0).text || ""; } catch (e) { /* ignore */ }
    try { err = handle.collected.stderr.readFrom(0).text || ""; } catch (e) { /* ignore */ }
    const text = (out + NL + err).replace(/\n{3,}/g, NL + NL).trim();
    return { ok: outcome.exitCode === 0, exitCode: outcome.exitCode, output: text };
  }

  /** 运行（按检测到的入口）。 */
  async lvalRun(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const detect = await this.workspaceDetect(sessionId);
    if (!detect.runable) return { ok: false, error: "工作区没有可运行入口（py/cpp 或 sln）" };
    const subprocess = this.subprocess();
    if (!subprocess) return { ok: false, error: "subprocess 服务不可用" };
    const root = detect.root;
    if (detect.kind === "python") {
      const py = detect.entry;
      try {
        const handle = subprocess.spawn({
          argv: ["python", py],
          cwd: root,
          stdio: { stdin: "ignore", stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } }, stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } } },
          graceMs: 5000,
        });
        return { ok: true, kind: "python", entry: py, pid: handle.pid, message: "已启动 python " + py };
      } catch (e) {
        return { ok: false, error: "启动失败: " + String(e && e.message ? e.message : e) };
      }
    }
    if (detect.kind === "sln") {
      const solution = detect.solution;
      const build = await this.buildOnce(solution, root);
      if (!build.ok) return { ok: false, kind: "sln", output: build.output, error: "编译失败" };
      const slnBase = solution.replace(/\.(slnx|sln)$/i, "");
      const exe = root + "\\x64\\" + this.config.configuration + "\\" + slnBase + ".exe";
      const fs = this.fs();
      try {
        const target = await fs.resolve(exe);
        const stat = await fs.stat(target);
        if (!stat || stat.type !== "file") return { ok: true, kind: "sln", output: build.output, run: { ok: false, error: "编译成功，但未找到 exe: " + exe } };
      } catch (e) {
        return { ok: true, kind: "sln", output: build.output, run: { ok: false, error: "编译成功，但未找到 exe: " + exe } };
      }
      try {
        const h = subprocess.spawn({ argv: [exe], cwd: root, stdio: { stdin: "ignore", stdout: "ignore", stderr: "ignore" }, graceMs: 5000 });
        return { ok: true, kind: "sln", output: build.output, run: { ok: true, pid: h.pid } };
      } catch (e) {
        return { ok: false, kind: "sln", output: build.output, error: "启动 exe 失败: " + String(e && e.message ? e.message : e) };
      }
    }
    if (detect.kind === "cpp") {
      return { ok: false, error: "检测到独立 C++ 入口 " + detect.entry + "，但无 sln 可编译。请通过 .sln/x 接入（或配置 MSBuild 工具链）后，从解决方案配置运行。" };
    }
    return { ok: false, error: "未知运行类型" };
  }

  // ── 程序版本（大版本）：快照/列表/回退/删除，只动代码文件 ───────────────

  async snapshotOnce(sessionId, label) {
    const fs = this.fs();
    const id = "v" + String(Date.now());
    const vdir = (await this.versionsDir(sessionId)) + "\\" + id;
    let count = 0;
    try {
      const files = await this.collectSourceFiles(sessionId);
      for (const f of files) {
        const content = await fs.readText(f.target);
        const dst = await fs.resolve(vdir + "\\" + f.rel);
        await fs.writeText(dst, content);
        count++;
      }
    } catch (e) {
      return { ok: false, error: "快照写入失败: " + String(e && e.message ? e.message : e), id };
    }
    const list = await this.readManifest(sessionId);
    list.push({ id, label: label || "", time: Date.now(), fileCount: count });
    await this.writeManifest(sessionId, list);
    return { ok: true, id, fileCount: count };
  }

  async verProgCreate(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const label = args && args.label ? String(args.label).slice(0, 60) : "";
    return this.snapshotOnce(sessionId, label);
  }

  async verProgList(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const list = await this.readManifest(sessionId);
    list.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    return { ok: true, versions: list };
  }

  async _restoreVersionById(sessionId, id) {
    const fs = this.fs();
    if (!fs) return { ok: false, error: "fs 服务不可用" };
    let backup;
    try { backup = await this.snapshotOnce(sessionId, "回退前自动备份 " + id); } catch (e) { backup = null; }
    const root = await this.workspaceRoot(sessionId);
    const dir = (await this.versionsDir(sessionId)) + "\\" + id;
    let dirTarget;
    try { dirTarget = await fs.resolve(dir); } catch (e) { return { ok: false, error: "版本目录不存在" }; }
    const st = await fs.stat(dirTarget);
    if (!st || st.type !== "directory") return { ok: false, error: "版本 " + id + " 不存在" };
    let restored = 0;
    const walkRestore = async (target, rel) => {
      let entries;
      try { entries = await fs.listDir(target); } catch (e) { return; }
      for (const entry of entries) {
        if (entry.type === "directory") {
          await walkRestore(entry.target, rel + "/" + entry.name);
        } else {
          const content = await fs.readText(entry.target);
          const dst = await fs.resolve(root + "\\" + (rel + "/" + entry.name).slice(1).replace(/\//g, "\\"));
          await fs.writeText(dst, content);
          restored++;
        }
      }
    };
    try { await walkRestore(dirTarget, ""); } catch (e) { return { ok: false, error: "回退失败: " + String(e && e.message ? e.message : e) }; }
    return { ok: true, restored, backupId: backup ? backup.id : null };
  }

  async verProgRestore(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少版本 id" };
    return this._restoreVersionById(sessionId, id);
  }

  async verProgDelete(args) {
    const subprocess = this.subprocess();
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少版本 id" };
    try {
      const handle = subprocess.spawn({
        argv: ["cmd.exe", "/c", "rmdir", "/s", "/q", (await this.versionsDir(sessionId)) + "\\" + id],
        cwd: await this.workspaceRoot(sessionId),
        stdio: { stdin: "ignore", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
        graceMs: 10000,
      });
      await handle.done;
    } catch (e) {
      return { ok: false, error: "删除失败: " + String(e && e.message ? e.message : e) };
    }
    const list = await this.readManifest(sessionId);
    const next = list.filter(function (v) { return v.id !== id; });
    await this.writeManifest(sessionId, next);
    return { ok: true };
  }
}

/** 端点清单（精简版）。 */
const METHOD_NAMES = [
  "lvalInfo", "lvalListFiles", "lvalReadFile", "lvalRun", "workspaceDetectEndpoint",
  "verProgCreate", "verProgList", "verProgRestore", "verProgDelete",
];

/** 构造 typert strict 描述符（src-json codec，免 schema）。 */
function buildInvocations() {
  return METHOD_NAMES.map((method) => ({
    id: "et-" + method,
    service: "dshEssentialTools",
    namespace: "dshEssentialTools",
    method,
    parameters: [{ name: "args", wire: "args", source: "json", codec: { mode: "src-json" } }],
    result: { mode: "src-json" },
    invocation: { kind: "direct" },
  }));
}

/**
 * 插件主体：构造 Remote 服务并注册全部端点。
 * @param ctx - 插件上下文（typert 已注入）。
 * @param config - 校验后的配置。
 */
function apply(ctx, config) {
  const service = new EssentialToolsService(ctx, config);
  ctx.typert.register({
    package: "dsh-essential-tools",
    face: "host",
    model: {},
    schemas: [],
    invocations: buildInvocations(),
  });
  return service;
}

export { Config, EssentialToolsService, apply, inject, name };
export default { name, inject, Config, apply };

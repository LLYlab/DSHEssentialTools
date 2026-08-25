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
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { VtdStore, MINOR_PREFIX, mintMinorId } from "./vtd/index.js";

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

/** 从内容块提取纯文本。 */
function textContent(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
}

/** 按消息 id 找事件。 */
function findMessageEvent(session, messageId) {
  if (!session || typeof messageId !== "string" || messageId === "") return null;
  let events;
  try { events = session.events; } catch (e) { return null; }
  if (!Array.isArray(events)) return null;
  for (const ev of events) {
    if (!ev || typeof ev.seq !== "number" || !ev.data || typeof ev.data !== "object") continue;
    if (ev.data.id === messageId) return ev;
    if (ev.data.message && typeof ev.data.message === "object" && ev.data.message.id === messageId) return ev;
  }
  return null;
}

/** 分支视图筛选:可展示的消息事件。 */
function isViewMessage(ev) {
  return ev.type === "user/message" || ev.type === "assistant/message" || ev.type === "tool/result";
}

/** 消息条目(供 VTD 视图)。 */
function viewMessage(ev) {
  const role = ev.type === "user/message" || ev.type === "tool/result" ? "user" : "assistant";
  const id = ev.data && ev.data.message ? ev.data.message.id : (ev.data && ev.data.id) || "";
  const reask = !!(ev.data && ev.data.source && ev.data.source.kind === "branch-reask");
  const blocks = ev.type === "assistant/message" ? (ev.data.message && ev.data.message.content) : ev.data.content;
  return {
    seq: ev.seq,
    role,
    text: textContent(blocks).slice(0, 800),
    messageId: id,
    reask,
  };
}

class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");
    this.config = config;
    // VTD(虚拟对话存储系统):虚拟对话树 + 小版本(自动版本控制)。
    this.vtd = new VtdStore(ctx, config);
    // 叉子会话的 agent 句柄(childId -> AgentHandle),插件卸载时统一释放。
    this.childAgents = new Map();
    ctx.effect(() => () => {
      for (const handle of this.childAgents.values()) {
        if (handle && typeof handle.dispose === "function") handle.dispose().catch(() => {});
      }
      this.childAgents.clear();
    }, "dsh-essential-tools: dispose branch agents");
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

  // ── VTD:虚拟对话树(treefork;树边 = conversation/link 事件)─────────────

  /** 分叉边界:目标消息之前最近的轮次结束 seq;无闭合轮次则取首个轮次前的事件(或前一条)。 */
  forkBoundaryFor(session, targetSeq) {
    const events = Array.isArray(session && session.events) ? session.events : [];
    let lastEnd = -1;
    for (let i = 0; i < targetSeq; i++) { const ev = events[i]; if (ev && ev.type === "turn/end") lastEnd = i; }
    if (lastEnd >= 0) return lastEnd;
    let firstStart = -1;
    for (let i = 0; i < events.length; i++) { if (events[i] && events[i].type === "turn/start") { firstStart = i; break; } }
    if (firstStart < 0) return targetSeq - 1;
    if (targetSeq <= firstStart) return targetSeq - 1;
    return firstStart - 1;
  }

  /** 会话事件列(live 优先,否则冷读)。 */
  async sessionEventsOf(sessionId) {
    const sessions = this.sessions();
    const live = sessions && sessions.get(sessionId);
    if (live && Array.isArray(live.events)) return live.events;
    const persistence = this.ctx.get("sessionPersistence");
    if (!persistence) return null;
    try { const loaded = await persistence.load(sessionId); return loaded && loaded.events ? loaded.events : null; } catch (e) { return null; }
  }

  /** 冷建叉子会话(隐藏真实对话):origin 'vtd-fork',日志 = 父会话 0..boundary 种子。 */
  async createBranchChild(parentSession, boundary) {
    const persistence = this.ctx.get("sessionPersistence");
    if (!persistence) return { ok: false, error: "sessionPersistence 服务不可用" };
    const seed = JSON.parse(JSON.stringify(parentSession.events.slice(0, boundary + 1)));
    const childId = "session-vtd-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
    const meta = {
      version: 0,
      id: childId,
      createdAt: Date.now(),
      cwd: parentSession.header.cwd,
      parentSession: parentSession.id,
      seedLength: seed.length,
      origin: "vtd-fork",
      delegationDepth: (parentSession.header.delegationDepth || 0) + 1,
    };
    if (parentSession.header.agentPreset) meta.agentPreset = parentSession.header.agentPreset;
    try {
      await persistence.create(meta);
      await persistence.append(childId, seed);
    } catch (e) {
      return { ok: false, error: "创建分支会话失败: " + String(e && e.message ? e.message : e) };
    }
    return { ok: true, childId, seedLength: seed.length };
  }

  /** 在父会话追加 conversation/link(树边)并 flush。 */
  async appendLink(session, data) {
    session.append("conversation/link", data);
    const sessions = this.sessions();
    if (sessions && typeof sessions.flush === "function") {
      try { await sessions.flush(session); } catch (e) { /* 尽力 */ }
    }
  }

  /** 子会话 agent 运行并提交一条消息(resume + followup)。 */
  async resumeAndSubmit(childId, message) {
    const agentLoop = this.ctx.get("agentLoop");
    const agents = this.ctx.get("agents");
    if (!agentLoop || !agents) return { ok: false, error: "agent 服务不可用" };
    if (!this.childAgents.has(childId)) {
      try {
        const handle = await agentLoop.resume(this.ctx, { resumeSessionId: childId });
        this.childAgents.set(childId, handle);
      } catch (e) {
        return { ok: false, error: "恢复分支会话失败: " + String(e && e.message ? e.message : e) };
      }
    }
    const agent = agents.get(childId);
    if (!agent || typeof agent.followup !== "function") return { ok: false, error: "子会话 agent 不可用" };
    try { agent.followup(message); } catch (e) { return { ok: false, error: "提交失败: " + String(e && e.message ? e.message : e) }; }
    return { ok: true };
  }

  /** 全量快照工作区 → <工作区>\.lval-versions\.minor\<id>\,记录小版本。 */
  async snapshotWorkspace(sessionId, forkId, kind, note) {
    const fs = this.fs();
    const root = await this.workspaceRoot(sessionId);
    const id = mintMinorId();
    const relDir = MINOR_PREFIX + "\\" + id;
    const dir = root + "\\" + relDir;
    let count = 0;
    try {
      const files = await this.collectSourceFiles(sessionId);
      for (const f of files) {
        const content = await fs.readText(f.target);
        await fs.writeText(await fs.resolve(dir + "\\" + f.rel), content);
        count++;
      }
    } catch (e) {
      return { ok: false, error: "快照失败: " + String(e && e.message ? e.message : e) };
    }
    const rec = await this.vtd.recordMinor(sessionId, forkId, kind, relDir, count, note);
    if (!rec.ok) return rec;
    return { ok: true, id: rec.id, relDir, fileCount: count };
  }

  /** 从快照目录恢复工作区。 */
  async restoreWorkspace(sessionId, relDir) {
    const fs = this.fs();
    const root = await this.workspaceRoot(sessionId);
    let dirTarget;
    try { dirTarget = await fs.resolve(root + "\\" + relDir); } catch (e) { return { ok: false, error: "快照目录不存在" }; }
    const st = await fs.stat(dirTarget);
    if (!st || st.type !== "directory") return { ok: false, error: "快照目录不存在: " + relDir };
    let restored = 0;
    const walkRestore = async (target, rel) => {
      let entries;
      try { entries = await fs.listDir(target); } catch (e) { return; }
      for (const entry of entries) {
        if (entry.type === "directory") { await walkRestore(entry.target, rel + "/" + entry.name); }
        else {
          const content = await fs.readText(entry.target);
          const dst = root + "\\" + (rel + "/" + entry.name).slice(1).replace(/\//g, "\\");
          await fs.writeText(await fs.resolve(dst), content);
          restored++;
        }
      }
    };
    try { await walkRestore(dirTarget, ""); } catch (e) { return { ok: false, error: "恢复失败: " + String(e && e.message ? e.message : e) }; }
    return { ok: true, restored };
  }

  /** 递归构建激活路径消息流。skipLeq: 子会话中已经在前缀显示的种子上限。 */
  async buildStream(sessionId, skipLeq) {
    const events = await this.sessionEventsOf(sessionId);
    if (!events) return [];
    const { forks, activeBranchId } = VtdStore.deriveTree(events);
    const msgs = events.filter(isViewMessage).map(viewMessage);
    const out = [];
    for (const m of msgs) {
      if (m.seq <= skipLeq) continue;
      const pivotForks = forks.filter((f) => f.pivotSeq === m.seq).sort((a, b) => a.createdAt - b.createdAt);
      const children = [{ branchId: "trunk", index: 1, childSessionId: null }].concat(pivotForks.map((f, i) => ({ branchId: f.branchId, index: i + 2, childSessionId: f.childSessionId })));
      const chosen = pivotForks.find((f) => f.branchId === activeBranchId) || null;
      const nav = {
        childBranches: children,
        branchIndex: chosen ? children.findIndex((c) => c.branchId === chosen.branchId) + 1 : 1,
        selector: children.length > 1,
      };
      if (chosen && chosen.childSessionId) {
        const childSkip = typeof chosen.forkBoundary === "number" ? chosen.forkBoundary : m.seq;
        const childStream = await this.buildStream(chosen.childSessionId, childSkip);
        if (chosen.kind === "edit") {
          if (childStream.length === 0) { out.push(Object.assign({}, m, { pivotSeq: m.seq }, nav)); }
          else {
            out.push(Object.assign({}, childStream[0], { pivotSeq: m.seq }, nav));
            out.push(...childStream.slice(1).filter((c) => !c.reask));
          }
        } else {
          out.push(Object.assign({}, m, { pivotSeq: m.seq }, nav));
          out.push(...childStream.filter((c) => !c.reask));
        }
        return out;
      }
      out.push(Object.assign({}, m, { pivotSeq: m.seq }, nav));
    }
    return out;
  }

  /**
   * treefork(借鉴原生 fork):冷建隐藏子会话 + 父日志链接 + 小版本 + 提交消息。
   * @param makeMessage - (branchId) => 用户消息对象(编辑内容或 reask)。
   */
  async treefork(session, pivotSeq, kind, branchId, makeMessage) {
    const boundary = this.forkBoundaryFor(session, pivotSeq);
    if (boundary < 0) return { ok: false, error: "该位置无法分叉(位于未闭合轮次内)" };
    const created = await this.createBranchChild(session, boundary);
    if (!created.ok) return created;
    const now = Date.now();
    const tree = VtdStore.deriveTree(session.events);
    // 旧激活叉 -> superseded
    if (tree.activeBranchId !== "trunk" && tree.activeBranchId !== branchId) {
      const oldFork = tree.forks.find((f) => f.branchId === tree.activeBranchId);
      if (oldFork) {
        await this.appendLink(session, { branchId: oldFork.branchId, pivotSeq: oldFork.pivotSeq, forkBoundary: oldFork.forkBoundary, childSessionId: oldFork.childSessionId, kind: oldFork.kind, state: "superseded", createdAt: now, label: oldFork.label });
      }
    }
    // 新叉 -> active
    await this.appendLink(session, { branchId, pivotSeq, forkBoundary: boundary, childSessionId: created.childId, kind, state: "active", createdAt: now });
    // 小版本(自动)
    const snap = await this.snapshotWorkspace(session.id, branchId, kind, "treefork " + kind);
    if (!snap.ok) return { ok: false, error: snap.error || "小版本快照失败", branchId, childSessionId: created.childId };
    const message = makeMessage(branchId);
    const submitted = await this.resumeAndSubmit(created.childId, message);
    return { ok: true, branchId, childSessionId: created.childId, pivotSeq, boundary, minorVersionId: snap.id, submitted: submitted.ok === true };
  }

  // ── VTD 端点 ────────────────────────────────────────────────────────────

  async treeView(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    const events = await this.sessionEventsOf(sessionId);
    if (!events) return { ok: false, error: "会话不存在或无法读取" };
    const { forks, activeBranchId } = VtdStore.deriveTree(events);
    const messages = await this.buildStream(sessionId, -1);
    const forkInfos = forks.map((f) => ({ branchId: f.branchId, pivotSeq: f.pivotSeq, forkBoundary: f.forkBoundary, childSessionId: f.childSessionId, kind: f.kind, state: f.state, createdAt: f.createdAt, label: f.label || "" }));
    const mini = await this.vtd.listMinor(sessionId);
    // 自动:首次使用(VTD 基线小版本)
    let baseline = mini.ok ? mini.versions.find((v) => v.kind === "baseline") : null;
    if (!baseline) {
      const snap = await this.snapshotWorkspace(sessionId, null, "baseline", "first VTD use");
      baseline = snap.ok ? { id: snap.id, kind: "baseline", fileCount: snap.fileCount } : null;
    }
    return { ok: true, sessionId, activeBranchId, forks: forkInfos, messages, baselineId: baseline ? baseline.id : null };
  }

  /** 编辑用户消息 → 树叉(编辑) + 子会话重答。 */
  async editMessage(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    const newText = args && typeof args.newText === "string" ? args.newText.trim() : "";
    if (sessionId === "" || messageId === "" || newText === "") return { ok: false, error: "缺少会话/消息 id 或新文本" };
    const sessions = this.sessions();
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中,请先打开再编辑" };
    const ev = findMessageEvent(session, messageId);
    if (!ev) return { ok: false, error: "消息不存在" };
    if (ev.type !== "user/message") return { ok: false, error: "仅支持编辑用户消息" };
    const branchId = "br-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
    return this.treefork(session, ev.seq, "edit", branchId, function () {
      return createUserMessage({ source: ev.data.source, content: [{ type: "text", text: newText }] });
    });
  }

  /** 重试用户消息 → 树叉(retry) + 子会话重答。 */
  async retryMessage(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    const sessions = this.sessions();
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中,请先打开再重试" };
    const ev = findMessageEvent(session, messageId);
    if (!ev) return { ok: false, error: "消息不存在" };
    if (ev.type !== "user/message") return { ok: false, error: "仅支持重试用户消息" };
    const text = textContent(ev.data.content);
    if (text === "") return { ok: false, error: "该消息无文本内容" };
    const branchId = "br-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
    return this.treefork(session, ev.seq, "retry", branchId, function (bid) {
      return createUserMessage({ source: { kind: "branch-reask", branchId: bid }, content: [{ type: "text", text: text }] });
    });
  }

  /** 切叉:旧叉 superseded + 新叉 active + 小版本自动恢复工作区(先快照当前状态)。 */
  async switchFork(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const branchId = args && args.branchId ? String(args.branchId) : "";
    if (sessionId === "" || branchId === "") return { ok: false, error: "缺少会话或分支 id" };
    const sessions = this.sessions();
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中" };
    const tree = VtdStore.deriveTree(session.events);
    if (tree.activeBranchId === branchId) return { ok: true };
    const target = branchId === "trunk" ? null : tree.forks.find((f) => f.branchId === branchId);
    if (branchId !== "trunk" && !target) return { ok: false, error: "分支不存在" };
    // 安全:先快照当前工作区,再恢复目标叉
    await this.snapshotWorkspace(sessionId, tree.activeBranchId === "trunk" ? null : tree.activeBranchId, "auto-switch", "switch from " + tree.activeBranchId);
    const now = Date.now();
    if (tree.activeBranchId !== "trunk") {
      const oldFork = tree.forks.find((f) => f.branchId === tree.activeBranchId);
      if (oldFork) await this.appendLink(session, { branchId: oldFork.branchId, pivotSeq: oldFork.pivotSeq, forkBoundary: oldFork.forkBoundary, childSessionId: oldFork.childSessionId, kind: oldFork.kind, state: "superseded", createdAt: now, label: oldFork.label });
    }
    if (target && target.childSessionId) {
      await this.appendLink(session, { branchId: target.branchId, pivotSeq: target.pivotSeq, forkBoundary: target.forkBoundary, childSessionId: target.childSessionId, kind: target.kind, state: "active", createdAt: now, label: target.label });
      const minor = await this.vtd.minorOfFork(target.branchId);
      if (minor.ok && minor.rec) {
        const restored = await this.restoreWorkspace(sessionId, minor.rec.snapshotDir);
        if (!restored.ok) return { ok: false, error: restored.error || "工作区恢复失败" };
      }
    } else {
      const list = await this.vtd.listMinor(sessionId);
      const baseline = list.ok ? list.versions.find((v) => v.kind === "baseline") : null;
      if (baseline) {
        const restored = await this.restoreWorkspace(sessionId, baseline.snapshotDir);
        if (!restored.ok) return { ok: false, error: restored.error || "工作区恢复失败" };
      }
    }
    return { ok: true, activeBranchId: branchId };
  }

  /** 激活叉内(或主线)发送新消息。 */
  async newMessage(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const text = args && typeof args.text === "string" ? args.text.trim() : "";
    if (sessionId === "" || text === "") return { ok: false, error: "缺少会话 id 或消息内容" };
    const agents = this.ctx.get("agents");
    if (!agents) return { ok: false, error: "agent 服务不可用" };
    const events = await this.sessionEventsOf(sessionId);
    if (!events) return { ok: false, error: "会话不存在或无法读取" };
    const tree = VtdStore.deriveTree(events);
    let targetId = sessionId;
    if (tree.activeBranchId !== "trunk") {
      const af = tree.forks.find((f) => f.branchId === tree.activeBranchId);
      if (af && af.childSessionId) {
        const resumed = await this.resumeAndSubmit(af.childSessionId, createUserMessage({ source: { kind: "user" }, content: [{ type: "text", text: text }] }));
        return resumed.ok ? { ok: true, targetId: af.childSessionId } : resumed;
      }
    }
    const agent = agents.get(sessionId);
    if (!agent || typeof agent.followup !== "function") return { ok: false, error: "会话 agent 不可用(请先打开会话)" };
    try { agent.followup(createUserMessage({ source: { kind: "user" }, content: [{ type: "text", text: text }] })); } catch (e) { return { ok: false, error: "发送失败: " + String(e && e.message ? e.message : e) }; }
    return { ok: true, targetId };
  }

  /** VTD debug:全部真实会话(含隐藏的叉子会话)。 */
  async debugSessions(args) {
    const persistence = this.ctx.get("sessionPersistence");
    const sessions = this.sessions();
    const out = [];
    const seen = new Set();
    if (persistence && typeof persistence.list === "function") {
      try {
        const headers = await persistence.list();
        for (const h of headers) {
          if (seen.has(h.id)) continue;
          seen.add(h.id);
          out.push({ id: h.id, cwd: h.cwd || "", parentSession: h.parentSession || null, origin: h.origin || null, hidden: h.origin === "vtd-fork", createdAt: h.createdAt });
        }
      } catch (e) { /* ignore */ }
    }
    for (const s of sessions.list()) {
      if (seen.has(s.id)) continue;
      out.push({ id: s.id, cwd: s.header.cwd || "", parentSession: s.header.parentSession || null, origin: s.header.origin || null, hidden: s.header.origin === "vtd-fork", createdAt: s.header.createdAt });
    }
    return { ok: true, sessions: out.sort((a, b) => b.createdAt - a.createdAt) };
  }

  /** 自动版本控制 debug:全部小版本。 */
  async debugMinor(args) {
    return this.vtd.listMinor();
  }
}

/** 端点清单。 */
const METHOD_NAMES = [
  "lvalInfo", "lvalListFiles", "lvalReadFile", "lvalRun", "workspaceDetectEndpoint",
  "verProgCreate", "verProgList", "verProgRestore", "verProgDelete",
  "treeView", "editMessage", "retryMessage", "switchFork", "newMessage",
  "debugSessions", "debugMinor",
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

// dsh-essential-tools — Host 半区（永久 npm 包）
// DSH 永久插件：随 web profile 常驻（cordis.patch.yml 一行注册），重启不丢。
// 功能：
//   - LVAL 工程：编译/运行/文件查看/程序版本快照回退（大版本，只动代码不动会话）
//   - 会话管理：列表/重命名/彻底删除
//   - 会话树：会话血缘（fork 祖先/后代）汇总（M1 起由客户端渲染树）
//   - 版本开关：回退目标（minor=最近小版本 / original=原始；持久化在 M2 落 storage 域）
//
// 通信：typert Remote（永久包标准机制，非动态插件的 harness.handle/host.call）。
//   Host 半区 = TypertRemoteService 子类（构造自动注册服务 + typertRemote 绑定），
//   端点经 ctx.typert.register({face:'host', invocations}) 注册（src-json codec，免 schema）。
//   Client 半区经 ctx.connection.rpc.call('/api', 'dshEssentialTools/<method>', {args}) 调用。

import z from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

/** Cordis 插件名。 */
const name = "dsh-essential-tools";
/** 硬依赖：typert 注册表（端点注册必需）。其余服务用 ctx.get() 可选读取。 */
const inject = ["typert"];

/** 插件配置（cordis.yml 行 config；路径默认值 = 用户当前工程，可覆盖）。 */
const Config = z.object({
  lvalRoot: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL"),
  srcDir: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL\\LVAL"),
  solution: z.string().default("C:\\Users\\L2959\\Desktop\\项目\\LVAL\\LVAL.slnx"),
  msbuild: z.string().default("C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe"),
  configuration: z.string().default("Debug"),
  platform: z.string().default("x64"),
  rollbackTargetDefault: z.string().default("minor"),
});

const NL = String.fromCharCode(10);

/** 源码扩展名白名单（程序版本快照收集用）。 */
const SOURCE_EXT = { ".h": 1, ".hpp": 1, ".hh": 1, ".hxx": 1, ".inl": 1, ".c": 1, ".cpp": 1, ".cc": 1, ".cxx": 1, ".rc": 1, ".json": 1, ".slnx": 1, ".sln": 1, ".vcxproj": 1, ".md": 1, ".txt": 1, ".py": 1, ".cs": 1, ".js": 1, ".ts": 1, ".yaml": 1, ".yml": 1, ".xml": 1, ".props": 1, ".targets": 1 };
/** 快照跳过的目录。 */
const SKIP_DIRS = { "x64": 1, "debug": 1, "release": 1, ".vs": 1, ".git": 1, "microsoft": 1, "vcpkg_installed": 1, "out": 1, ".lval-versions": 1 };

/** 路径白名单校验（防目录穿越）。 */
function safeRel(rel) {
  if (typeof rel !== "string") return null;
  const r = rel.replace(/\\/g, "/");
  if (r === "" || r.charAt(0) === "/") return null;
  if (r.indexOf("..") !== -1) return null;
  if (/^[A-Za-z]:/.test(r)) return null;
  return r;
}

/**
 * Remote 服务：所有客户端可调用方法集中于此。
 * 方法签名统一 (args) → {ok, error?, ...}；src-json 直通，结果必须为 JSON。
 */
class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");
    this.config = config;
  }

  // ── 工具函数 ────────────────────────────────────────────────────────────

  fs() {
    return this.ctx.get("fs");
  }

  subprocess() {
    return this.ctx.get("subprocess");
  }

  versionsDir() {
    return this.config.lvalRoot + "\\.lval-versions";
  }

  async collectSourceFiles() {
    const fs = this.fs();
    const out = [];
    const seen = {};
    const walk = async (target, rel) => {
      if (out.length >= 400) return;
      let entries;
      try {
        entries = await fs.listDir(target);
      } catch (e) {
        return;
      }
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
      const srcTarget = await fs.resolve(this.config.srcDir);
      await walk(srcTarget, "");
    } catch (e) { /* ignore */ }
    return out;
  }

  async readManifest() {
    const fs = this.fs();
    if (!fs) return [];
    try {
      const target = await fs.resolve(this.versionsDir() + "\\versions.json");
      const stat = await fs.stat(target);
      if (!stat || stat.type !== "file") return [];
      const text = await fs.readText(target);
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  async writeManifest(list) {
    const fs = this.fs();
    if (!fs) return;
    try {
      const target = await fs.resolve(this.versionsDir() + "\\versions.json");
      await fs.writeText(target, JSON.stringify(list, null, 2));
    } catch (e) { /* ignore */ }
  }

  // ── LVAL 信息/文件 ───────────────────────────────────────────────────────

  async lvalInfo(args) {
    return {
      root: this.config.lvalRoot,
      sourceDir: this.config.srcDir,
      solution: this.config.solution,
      msbuild: this.config.msbuild,
      configuration: this.config.configuration,
      platform: this.config.platform,
      exe: this.config.lvalRoot + "\\x64\\" + this.config.configuration + "\\LVAL.exe",
    };
  }

  async lvalListFiles(args) {
    const files = await this.collectSourceFiles();
    files.sort(function (a, b) { return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0; });
    return { files: files.map(function (f) { return { path: f.rel, name: f.rel.split("/").pop(), size: f.size }; }) };
  }

  async lvalReadFile(args) {
    const fs = this.fs();
    const rel = safeRel(args && args.path);
    if (rel === null) return { error: "非法路径" };
    const full = this.config.srcDir + "\\" + rel.replace(/\//g, "\\");
    try {
      const target = await fs.resolve(full);
      const stat = await fs.stat(target);
      if (!stat || stat.type !== "file") return { error: "文件不存在: " + rel };
      if (stat.size !== undefined && stat.size > 2 * 1024 * 1024) return { error: "文件过大(>2MB): " + rel };
      const content = await fs.readText(target);
      return { content: content, path: rel };
    } catch (e) {
      return { error: "读取失败: " + String(e && e.message ? e.message : e) };
    }
  }

  // ── 编译/运行 ────────────────────────────────────────────────────────────

  async buildOnce() {
    const subprocess = this.subprocess();
    if (!subprocess) return { ok: false, exitCode: -1, output: "subprocess 服务不可用" };
    let handle;
    try {
      handle = subprocess.spawn({
        argv: [this.config.msbuild, this.config.solution, "-p:Configuration=" + this.config.configuration, "-p:Platform=" + this.config.platform, "-m", "-v:m", "-nologo"],
        cwd: this.config.lvalRoot,
        stdio: {
          stdin: "ignore",
          stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
          stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
        },
        graceMs: 30000,
      });
    } catch (e) {
      return { ok: false, exitCode: -1, output: "启动 MSBuild 失败: " + String(e && e.message ? e.message : e) };
    }
    let outcome;
    try {
      outcome = await handle.done;
    } catch (e) {
      return { ok: false, exitCode: -1, output: "MSBuild 运行失败: " + String(e && e.message ? e.message : e) };
    }
    let out = "";
    let err = "";
    try { out = handle.collected.stdout.readFrom(0).text || ""; } catch (e) { /* ignore */ }
    try { err = handle.collected.stderr.readFrom(0).text || ""; } catch (e) { /* ignore */ }
    const text = (out + NL + err).replace(/\n{3,}/g, NL + NL).trim();
    return { ok: outcome.exitCode === 0, exitCode: outcome.exitCode, output: text };
  }

  async runExe() {
    const fs = this.fs();
    const subprocess = this.subprocess();
    const exe = this.config.lvalRoot + "\\x64\\" + this.config.configuration + "\\LVAL.exe";
    try {
      const target = await fs.resolve(exe);
      const stat = await fs.stat(target);
      if (!stat || stat.type !== "file") return { ok: false, error: "未找到 " + exe + "，请先编译" };
    } catch (e) {
      return { ok: false, error: "未找到 " + exe + "，请先编译" };
    }
    try {
      const handle = subprocess.spawn({
        argv: [exe],
        cwd: this.config.lvalRoot,
        stdio: { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
        graceMs: 5000,
      });
      return { ok: true, pid: handle.pid };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  async lvalBuild(args) {
    return this.buildOnce();
  }

  async lvalRun(args) {
    return this.runExe();
  }

  async lvalBuildRun(args) {
    const build = await this.buildOnce();
    if (!build.ok) return { ok: build.ok, exitCode: build.exitCode, output: build.output, run: null };
    const run = await this.runExe();
    return { ok: build.ok, exitCode: build.exitCode, output: build.output, run: run };
  }

  // ── 程序版本（大版本）：快照/列表/回退/删除，只动代码文件 ───────────────

  async snapshotOnce(label) {
    const fs = this.fs();
    const id = "v" + String(Date.now());
    const dir = this.versionsDir() + "\\" + id;
    let count = 0;
    try {
      const files = await this.collectSourceFiles();
      for (const f of files) {
        const content = await fs.readText(f.target);
        const dst = await fs.resolve(dir + "\\" + f.rel);
        await fs.writeText(dst, content);
        count++;
      }
      const slnTarget = await fs.resolve(this.config.solution);
      const slnStat = await fs.stat(slnTarget);
      if (slnStat && slnStat.type === "file") {
        const content = await fs.readText(slnTarget);
        const dst = await fs.resolve(dir + "\\LVAL.slnx");
        await fs.writeText(dst, content);
        count++;
      }
    } catch (e) {
      return { ok: false, error: "快照写入失败: " + String(e && e.message ? e.message : e), id: id };
    }
    const list = await this.readManifest();
    list.push({ id: id, label: label || "", time: Date.now(), fileCount: count });
    await this.writeManifest(list);
    return { ok: true, id: id, fileCount: count };
  }

  async verProgCreate(args) {
    const label = args && args.label ? String(args.label).slice(0, 60) : "";
    return this.snapshotOnce(label);
  }

  async verProgList(args) {
    const list = await this.readManifest();
    list.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    return { versions: list };
  }

  async verProgRestore(args) {
    const fs = this.fs();
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少版本 id" };
    let backup;
    try {
      backup = await this.snapshotOnce("回退前自动备份 " + id);
    } catch (e) {
      backup = null;
    }
    const dir = this.versionsDir() + "\\" + id;
    let dirTarget;
    try {
      dirTarget = await fs.resolve(dir);
    } catch (e) {
      return { ok: false, error: "版本目录不存在" };
    }
    const st = await fs.stat(dirTarget);
    if (!st || st.type !== "directory") return { ok: false, error: "版本 " + id + " 不存在" };
    let restored = 0;
    const walkRestore = async (target, rel) => {
      let entries;
      try {
        entries = await fs.listDir(target);
      } catch (e) {
        return;
      }
      for (const entry of entries) {
        if (entry.type === "directory") {
          await walkRestore(entry.target, rel + "/" + entry.name);
        } else {
          const content = await fs.readText(entry.target);
          const dst = await fs.resolve(this.config.lvalRoot + "\\" + (rel + "/" + entry.name).slice(1).replace(/\//g, "\\"));
          await fs.writeText(dst, content);
          restored++;
        }
      }
    };
    try {
      await walkRestore(dirTarget, "");
    } catch (e) {
      return { ok: false, error: "回退失败: " + String(e && e.message ? e.message : e) };
    }
    return { ok: true, restored: restored, backupId: backup ? backup.id : null };
  }

  async verProgDelete(args) {
    const subprocess = this.subprocess();
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少版本 id" };
    try {
      const handle = subprocess.spawn({
        argv: ["cmd.exe", "/c", "rmdir", "/s", "/q", this.versionsDir() + "\\" + id],
        cwd: this.config.lvalRoot,
        stdio: { stdin: "ignore", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
        graceMs: 10000,
      });
      await handle.done;
    } catch (e) {
      return { ok: false, error: "删除失败: " + String(e && e.message ? e.message : e) };
    }
    const list = await this.readManifest();
    const next = list.filter(function (v) { return v.id !== id; });
    await this.writeManifest(next);
    return { ok: true };
  }

  // ── 会话管理：列表（含血缘，供会话树）/重命名/彻底删除 ──────────────────

  async sessionsList(args) {
    const sessionQuery = this.ctx.get("sessionQuery");
    if (sessionQuery === undefined) return { ok: false, error: "sessionQuery 服务不可用", sessions: [] };
    let records;
    try {
      records = await sessionQuery.listSessions();
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e), sessions: [] };
    }
    const ids = records.map(function (r) { return r.header && r.header.id ? r.header.id : ""; });
    const titles = {};
    try {
      const obs = await sessionQuery.readTitleSnapshots(ids);
      for (const o of obs) {
        if (o.status === "fulfilled" && o.value && o.value.title && o.value.title.text) titles[o.sessionId] = o.value.title.text;
      }
    } catch (e) { /* ignore */ }
    const out = records.map(function (r) {
      const h = r.header || {};
      return {
        id: h.id || "",
        title: titles[h.id] || h.id || "",
        createdAt: h.createdAt || 0,
        cwd: h.cwd || "",
        live: !!r.live,
        persisted: !!r.persisted,
        parent: h.parentSession || "",
      };
    });
    out.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return { ok: true, sessions: out };
  }

  async sessionRename(args) {
    const sessions = this.ctx.get("sessions");
    const sessionTitle = this.ctx.get("sessionTitle");
    const id = args && args.id ? String(args.id) : "";
    const title = args && args.title ? String(args.title).trim() : "";
    if (id === "" || title === "") return { ok: false, error: "缺少会话 id 或标题" };
    if (sessions === undefined || sessionTitle === undefined) return { ok: false, error: "会话服务不可用" };
    const session = sessions.get(id);
    if (!session) return { ok: false, error: "会话未在运行中，请先打开再重命名" };
    try {
      sessionTitle.rename(session, title);
      return { ok: true, title: title };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  async sessionDelete(args) {
    const sessions = this.ctx.get("sessions");
    const sessionQuery = this.ctx.get("sessionQuery");
    const sessionPersistence = this.ctx.get("sessionPersistence");
    const subprocess = this.subprocess();
    const fs = this.fs();
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少会话 id" };
    if (sessions !== undefined && sessions.get(id)) {
      return { ok: false, error: "该会话正在运行中，请先在其它标签页关闭该会话，再执行删除" };
    }
    if (sessionQuery === undefined || sessionPersistence === undefined) {
      return { ok: false, error: "会话服务不可用" };
    }
    const dirOf = (p) => {
      const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
      return i > 0 ? p.slice(0, i) : p;
    };
    let header = null;
    try {
      const records = await sessionQuery.listSessions();
      for (const r of records) {
        if (r.header && r.header.id === id) { header = r.header; break; }
      }
    } catch (e) {
      return { ok: false, error: "查询会话失败: " + String(e && e.message ? e.message : e) };
    }
    if (!header) return { ok: false, error: "会话不存在: " + id };
    let dir = null;
    try {
      const loc = sessionPersistence.locate(header);
      if (loc && loc.kind === "jsonl" && loc.path) dir = dirOf(loc.path);
    } catch (e) { /* ignore */ }
    if (!dir) return { ok: false, error: "无法定位会话存储目录" };
    try {
      const handle = subprocess.spawn({
        argv: ["cmd.exe", "/c", "rmdir", "/s", "/q", dir],
        cwd: this.config.lvalRoot,
        stdio: { stdin: "ignore", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
        graceMs: 15000,
      });
      await handle.done;
    } catch (e) {
      return { ok: false, error: "删除会话文件失败: " + String(e && e.message ? e.message : e) };
    }
    let stillThere = true;
    try {
      const t = await fs.resolve(dir);
      const st = await fs.stat(t);
      stillThere = !!(st && st.type === "directory");
    } catch (e) {
      stillThere = false;
    }
    if (stillThere) return { ok: false, error: "会话目录删除后仍然存在，请重试" };
    const stripCacheRow = async (file, sid) => {
      try {
        const target = await fs.resolve(file);
        const st = await fs.stat(target);
        if (!st || st.type !== "file") return;
        const text = await fs.readText(target);
        const data = JSON.parse(text);
        if (data && data.tables && data.tables.sessions && data.tables.sessions[sid]) {
          delete data.tables.sessions[sid];
          await fs.writeText(target, JSON.stringify(data));
        }
      } catch (e) { /* 尽力而为 */ }
    };
    const stripWorkspaceRows = async (file, sid) => {
      try {
        const target = await fs.resolve(file);
        const st = await fs.stat(target);
        if (!st || st.type !== "file") return;
        const text = await fs.readText(target);
        const data = JSON.parse(text);
        let changed = false;
        if (data && data.tables && data.tables.workspaces) {
          for (const k of Object.keys(data.tables.workspaces)) {
            const ws = data.tables.workspaces[k];
            if (ws && Array.isArray(ws.sessionIds)) {
              const next = ws.sessionIds.filter((s) => s !== sid);
              if (next.length !== ws.sessionIds.length) { ws.sessionIds = next; changed = true; }
            }
          }
        }
        if (data && data.global && Array.isArray(data.global.archivedSessionIds)) {
          const next = data.global.archivedSessionIds.filter((s) => s !== sid);
          if (next.length !== data.global.archivedSessionIds.length) { data.global.archivedSessionIds = next; changed = true; }
        }
        if (changed) await fs.writeText(target, JSON.stringify(data));
      } catch (e) { /* 尽力而为 */ }
    };
    const home = dirOf(dirOf(dirOf(dirOf(dir))));
    const storages = home + "\\storages";
    await stripCacheRow(storages + "\\session_projcache.json", id);
    await stripWorkspaceRows(storages + "\\workspace.json", id);
    return { ok: true };
  }

  // ── 会话树（M1 起客户端渲染；这里先提供血缘汇总）────────────────────────

  async treeList(args) {
    const base = await this.sessionsList(args);
    if (!base.ok) return base;
    const sessions = base.sessions;
    const byId = {};
    for (const s of sessions) byId[s.id] = s;
    const roots = [];
    const childrenOf = {};
    for (const s of sessions) {
      if (s.parent && byId[s.parent]) {
        (childrenOf[s.parent] = childrenOf[s.parent] || []).push(s);
      } else {
        roots.push(s);
      }
    }
    const attach = (node) => {
      const kids = (childrenOf[node.id] || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      node.children = kids;
      for (const k of kids) attach(k);
      return node;
    };
    return { ok: true, trees: roots.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(attach) };
  }

  // ── 版本开关（M2 落 storage 域持久化；当前为内存 + config 默认值）────────

  async verToggleGet(args) {
    const store = this.toggleStore;
    return { ok: true, target: (store && store.target) || this.config.rollbackTargetDefault || "minor" };
  }

  async verToggleSet(args) {
    const target = args && args.target;
    if (target !== "minor" && target !== "original") return { ok: false, error: "target 必须是 minor 或 original" };
    this.toggleStore = { target: target };
    return { ok: true, target: target };
  }
}

/** 端点清单（M0 已实现）；M2/M3 新增能力时在此追加。 */
const METHOD_NAMES = [
  "lvalInfo", "lvalListFiles", "lvalReadFile",
  "lvalBuild", "lvalRun", "lvalBuildRun",
  "verProgCreate", "verProgList", "verProgRestore", "verProgDelete",
  "sessionsList", "sessionRename", "sessionDelete",
  "treeList", "verToggleGet", "verToggleSet",
];

/** 构造 typert strict 描述符（src-json codec，免 schema；纯 JS 手写可行）。 */
function buildInvocations() {
  return METHOD_NAMES.map((method) => ({
    id: "et-" + method,
    service: "dshEssentialTools",
    namespace: "dshEssentialTools",
    method: method,
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
  // 构造即注册服务（TypertRemoteService 经 super(ctx, key) 提供为 ctx 服务）与 typertRemote 绑定。
  const service = new EssentialToolsService(ctx, config);
  // 注册全部 Remote 端点（strict 描述符，src-json codec）。
  ctx.typert.register({
    package: "dsh-essential-tools",
    face: "host",
    model: {},
    schemas: [],
    invocations: buildInvocations(),
  });
  // 供本包内诊断使用（服务本体经 ctx.get('dshEssentialTools') 可取）。
  return service;
}

export { Config, EssentialToolsService, apply, inject, name };
export default { name, inject, Config, apply };

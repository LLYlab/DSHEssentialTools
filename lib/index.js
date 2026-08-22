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
import { createAssistantMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import { VtdStore, findMessageSeq } from "./vtd/index.js";

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

/** 按消息 id 找事件（含 seq 与 data）。 */
function findMessageEvent(session, messageId) {
  if (!session || typeof messageId !== "string" || messageId === "") return null;
  let events;
  try {
    events = session.events;
  } catch (e) {
    return null;
  }
  if (!Array.isArray(events)) return null;
  for (const ev of events) {
    if (!ev || typeof ev.seq !== "number" || !ev.data || typeof ev.data !== "object") continue;
    if (ev.data.id === messageId) return ev;
    if (ev.data.message && typeof ev.data.message === "object" && ev.data.message.id === messageId) return ev;
  }
  return null;
}

/** 从内容块提取纯文本。 */
function textContent(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
}

/** 从纯文本构造内容块。 */
function contentFromText(text) {
  return [{ type: "text", text: String(text) }];
}

/** 追加一条"替换旧消息"的 surface 事件（与 compaction 同机制：replace 的 start/end 是事件 seq）。 */
function appendReplacement(session, oldSeq, type, newData, sourceSeqs) {
  return session.append(type, newData, {
    surfaceOp: { op: "replace", start: oldSeq, end: oldSeq },
    sourceEventSeqs: sourceSeqs && sourceSeqs.length ? sourceSeqs : [oldSeq],
  });
}

/** 分支视图筛选：可展示的消息事件（用户/助手/工具结果）。 */
function isViewMessage(ev) {
  return ev.type === "user/message" || ev.type === "assistant/message" || ev.type === "tool/result";
}

/** 分支视图消息条目。 */
function viewMessage(ev) {
  const role = ev.type === "user/message" || ev.type === "tool/result" ? "user" : "assistant";
  const id = ev.data && ev.data.message ? ev.data.message.id : (ev.data && ev.data.id) || "";
  const reask = !!(ev.data && ev.data.source && ev.data.source.kind === "branch-reask");
  return {
    seq: ev.seq,
    role: role,
    text: textContent(ev.type === "assistant/message" ? (ev.data.message && ev.data.message.content) : ev.data.content).slice(0, 500),
    messageId: id,
    reask: reask,
  };
}

/**
 * Remote 服务：所有客户端可调用方法集中于此。
 * 方法签名统一 (args) → {ok, error?, ...}；src-json 直通，结果必须为 JSON。
 */
class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");
    this.config = config;
    // VTD（虚拟对话存储系统）：分支/开关/消息版本的旁路元数据层。
    this.vtd = new VtdStore(ctx, config);
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

  // ── VTD：消息小版本（编辑/回退/恢复）────────────────────────────────────

  /** 消息当前 surface 内容块（user: data.content；assistant: data.message.content）。 */
  currentBlocks(ev) {
    if (!ev || !ev.data) return null;
    if (ev.type === "user/message" || ev.type === "tool/result") return ev.data.content;
    if (ev.type === "assistant/message") return ev.data.message && ev.data.message.content;
    return null;
  }

  /** 可编辑性检查：仅纯文本消息（含 tool-call 块的消息拒绝编辑）。 */
  editableBlocks(ev) {
    const blocks = this.currentBlocks(ev);
    if (!Array.isArray(blocks) || blocks.length === 0) return { ok: false, error: "该消息无文本内容" };
    for (const b of blocks) {
      if (b && b.type !== "text") return { ok: false, error: "含非文本块（工具调用等）的消息暂不支持编辑" };
    }
    return { ok: true, blocks };
  }

  /** 追加替换事件前，把当前内容快照成小版本（首个快照记 cause 'original'）。 */
  async snapshotBefore(sessionId, messageId, cause, ev, branchId) {
    const blocks = this.currentBlocks(ev);
    const content = blocks === null ? [] : blocks;
    const existing = await this.vtd.listVersions(sessionId, messageId);
    const effectiveCause = existing.ok && existing.versions.length === 0 ? "original" : cause;
    return this.vtd.recordVersion(sessionId, messageId, effectiveCause, content, [ev.seq], branchId);
  }

  async msgEdit(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    const newText = args && typeof args.newText === "string" ? args.newText : "";
    if (sessionId === "" || messageId === "" || newText.trim() === "") return { ok: false, error: "缺少会话/消息 id 或新文本" };
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中，请先打开再编辑" };
    const ev = findMessageEvent(session, messageId);
    if (!ev) return { ok: false, error: "消息不存在" };
    const check = this.editableBlocks(ev);
    if (!check.ok) return check;
    const snap = await this.snapshotBefore(sessionId, messageId, "edit", ev);
    if (!snap.ok) return snap;
    try {
      if (ev.type === "user/message") {
        const old = ev.data;
        const updated = createUserMessage({
          source: old.source,
          content: contentFromText(newText),
        });
        appendReplacement(session, ev.seq, "user/message", updated);
      } else if (ev.type === "assistant/message") {
        const old = ev.data;
        const updatedMessage = createAssistantMessage({
          content: contentFromText(newText),
          source: old.message && old.message.source,
        });
        appendReplacement(session, ev.seq, "assistant/message", {
          turn: old.turn,
          step: old.step,
          message: updatedMessage,
          ...old.interrupted === true ? { interrupted: true } : {},
        });
      } else {
        return { ok: false, error: "仅支持编辑用户或助手消息" };
      }
      if (typeof sessions.flush === "function") {
        try { await sessions.flush(session); } catch (e) { /* 尽力 */ }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "编辑失败: " + String(e && e.message ? e.message : e) };
    }
  }

  /** 恢复指定版本内容（回退/恢复共用）。 */
  async restoreContent(sessionId, messageId, targetContent, cause) {
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中" };
    const ev = findMessageEvent(session, messageId);
    if (!ev) return { ok: false, error: "消息不存在" };
    const check = this.editableBlocks(ev);
    if (!check.ok) return check;
    const snap = await this.snapshotBefore(sessionId, messageId, cause, ev);
    if (!snap.ok) return snap;
    try {
      if (ev.type === "user/message") {
        const old = ev.data;
        appendReplacement(session, ev.seq, "user/message", createUserMessage({ source: old.source, content: targetContent }));
      } else if (ev.type === "assistant/message") {
        const old = ev.data;
        appendReplacement(session, ev.seq, "assistant/message", {
          turn: old.turn,
          step: old.step,
          message: createAssistantMessage({ content: targetContent, source: old.message && old.message.source }),
        });
      } else {
        return { ok: false, error: "仅支持用户或助手消息" };
      }
      if (typeof sessions.flush === "function") {
        try { await sessions.flush(session); } catch (e) { /* 尽力 */ }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "恢复失败: " + String(e && e.message ? e.message : e) };
    }
  }

  async msgRollback(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    const list = await this.vtd.listVersions(sessionId, messageId);
    if (!list.ok || list.versions.length === 0) return { ok: false, error: "没有可回退的版本（该消息从未编辑过）" };
    const toggle = await this.vtd.getToggle();
    const target = toggle.target === "original" ? list.versions[0] : list.versions[list.versions.length - 1];
    if (!target) return { ok: false, error: "回退目标不存在" };
    const result = await this.restoreContent(sessionId, messageId, target.content, "rollback");
    if (!result.ok) return result;
    return { ok: true, restoredVersion: target.versionIndex, target: toggle.target };
  }

  async verMinorList(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    return this.vtd.listVersions(sessionId, messageId);
  }

  async verMinorMessages(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    const result = await this.vtd.listMessagesWithVersions(sessionId);
    if (!result.ok) return result;
    // 附上每条消息的文本预览
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    for (const m of result.messages) {
      m.textPreview = "";
      if (session) {
        const ev = findMessageEvent(session, m.messageId);
        if (ev) m.textPreview = textContent(this.currentBlocks(ev)).slice(0, 80);
      }
      if (!m.textPreview) m.textPreview = textContent(m.latest.content).slice(0, 80);
    }
    return result;
  }

  async verMinorCompare(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    const a = await this.vtd.getVersion(sessionId, messageId, Number(args.a));
    const b = await this.vtd.getVersion(sessionId, messageId, Number(args.b));
    if (!a.ok || !b.ok) return { ok: false, error: "版本不存在" };
    return { ok: true, a: { versionIndex: a.version.versionIndex, cause: a.version.cause, text: textContent(a.version.content), time: a.version.time }, b: { versionIndex: b.version.versionIndex, cause: b.version.cause, text: textContent(b.version.content), time: b.version.time } };
  }

  async verMinorRestore(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    const versionIndex = Number(args && args.versionIndex);
    if (sessionId === "" || messageId === "" || !Number.isInteger(versionIndex)) return { ok: false, error: "参数不完整" };
    const v = await this.vtd.getVersion(sessionId, messageId, versionIndex);
    if (!v.ok) return v;
    return this.restoreContent(sessionId, messageId, v.version.content, "rollback");
  }

  // ── VTD：重新生成（虚拟分支重答）────────────────────────────────────────

  async msgRegenerate(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中" };
    const ev = findMessageEvent(session, messageId);
    if (!ev) return { ok: false, error: "消息不存在" };
    if (ev.type !== "assistant/message") return { ok: false, error: "重新生成仅支持助手消息" };
    // 找其上方的直接用户问题（source.kind === 'user'，排除注入/检查点）
    let q = null;
    for (const cand of session.events) {
      if (cand.seq >= ev.seq) break;
      if (cand.type === "user/message" && cand.data && cand.data.source && cand.data.source.kind === "user") q = cand;
    }
    if (!q) return { ok: false, error: "未找到该回答对应的问题（可能由工具/注入产生）" };
    // 建分支：锚点 = 问题消息 seq；分支视图 = 前缀(<=问题) + 重答区间
    const created = await this.vtd.branchCreate(sessionId, "", "重新生成 @" + ev.seq, function () { return q.seq; });
    if (!created.ok) return created;
    const branchId = created.branchId;
    const switched = await this.vtd.branchSwitch(sessionId, branchId);
    if (!switched.ok) return switched;
    // 重答副本：原问题内容 + branch-reask 标记（分支视图隐藏它，展示原问题气泡）
    const reask = createUserMessage({
      source: { kind: "branch-reask", branchId: branchId },
      content: q.data.content,
    });
    const agents = this.ctx.get("agents");
    const agent = agents && agents.get(sessionId);
    if (!agent || typeof agent.followup !== "function") {
      return { ok: false, error: "agent 服务不可用，无法重新生成（分支已创建）", branchId: branchId };
    }
    try {
      agent.followup(reask);
    } catch (e) {
      return { ok: false, error: "重新生成注入失败: " + String(e && e.message ? e.message : e), branchId: branchId };
    }
    return { ok: true, branchId: branchId, anchorSeq: q.seq };
  }

  // ── VTD：分支视图（分支图 + 每分支消息流）───────────────────────────────

  async branchView(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中" };
    const list = await this.vtd.branchList(sessionId);
    if (!list.ok) return list;
    const events = Array.isArray(session.events) ? session.events : [];
    const views = {};
    const PREFIX_LIMIT = 60;
    for (const branch of list.branches) {
      const msgs = [];
      // 前缀：seq <= anchorSeq 的 surface 消息（取最近 PREFIX_LIMIT 条）
      const prefix = events.filter((ev) => ev.seq <= branch.anchorSeq && isViewMessage(ev));
      for (const ev of prefix.slice(-PREFIX_LIMIT)) msgs.push(viewMessage(ev));
      // 区间：本分支 ranges 内的 surface 消息（跳过 branch-reask 副本）
      let covered = 0;
      for (const range of branch.ranges) {
        for (const ev of events) {
          if (ev.seq < range.from || ev.seq > range.to) continue;
          if (!isViewMessage(ev)) continue;
          if (ev.data && ev.data.source && ev.data.source.kind === "branch-reask") continue;
          msgs.push(viewMessage(ev));
          covered += 1;
        }
      }
      views[branch.branchId] = { messages: msgs, coveredEvents: covered };
    }
    return { ok: true, branches: list.branches, views: views };
  }

  // ── VTD：会话内分支（虚拟分支）───────────────────────────────────────────

  async branchList(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    return this.vtd.branchList(sessionId);
  }

  async branchCreate(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const messageId = args && args.messageId ? String(args.messageId) : "";
    const label = args && args.label ? String(args.label) : "";
    if (sessionId === "" || messageId === "") return { ok: false, error: "缺少会话或消息 id" };
    const sessions = this.ctx.get("sessions");
    const session = sessions && sessions.get(sessionId);
    if (!session) return { ok: false, error: "会话未在运行中，请先打开再分叉" };
    return this.vtd.branchCreate(sessionId, messageId, label, (mid) => findMessageSeq(session, mid));
  }

  async branchSwitch(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const branchId = args && args.branchId ? String(args.branchId) : "";
    return this.vtd.branchSwitch(sessionId, branchId);
  }

  async branchDelete(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const branchId = args && args.branchId ? String(args.branchId) : "";
    return this.vtd.branchDelete(sessionId, branchId);
  }

  // ── VTD：版本开关（回退目标；域 settings 表持久化，域不可用时内存降级）────

  async verToggleGet(args) {
    return this.vtd.getToggle();
  }

  async verToggleSet(args) {
    const target = args && args.target;
    return this.vtd.setToggle(target);
  }
}

/** 端点清单（M0–M4 已实现）。 */
const METHOD_NAMES = [
  "lvalInfo", "lvalListFiles", "lvalReadFile",
  "lvalBuild", "lvalRun", "lvalBuildRun",
  "verProgCreate", "verProgList", "verProgRestore", "verProgDelete",
  "sessionsList", "sessionRename", "sessionDelete",
  "treeList", "verToggleGet", "verToggleSet",
  "branchList", "branchCreate", "branchSwitch", "branchDelete",
  "msgEdit", "msgRollback", "msgRegenerate",
  "verMinorList", "verMinorMessages", "verMinorCompare", "verMinorRestore",
  "branchView",
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
  // VTD 分支区间追踪：分支活跃期间新追加的事件并入该分支 ranges。
  ctx.on("session/event", (session, event) => {
    service.vtd.onSessionEvent(session, event);
  });
  // 供本包内诊断使用（服务本体经 ctx.get('dshEssentialTools') 可取）。
  return service;
}

export { Config, EssentialToolsService, apply, inject, name };
export default { name, inject, Config, apply };

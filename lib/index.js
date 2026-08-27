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
import { defineTool } from "@deepseek-ai/dsh-tools";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { VtdStore, MINOR_PREFIX, mintMinorId } from "./vtd/index.js";
import { GlobalPluginStore, LEVEL_LABELS, idPrefixOf, scanCodeWarnings } from "./global.js";
import { MdaStore, MODES, normalizeMode } from "./mda.js";
import { fetchDsBalance, fetchDsPrice, BALANCE_TTL, PRICE_TTL } from "./ds.js";

/** Cordis 插件名。 */
const name = "dsh-essential-tools";
/** 硬依赖：typert 注册表。其余服务 ctx.get() 可选读取。 */
const inject = ["typert"];

/** 插件配置（路径 默认值 = 用户当前工程；实际工作区优先用会话 cwd）。 */
const Config = z.object({
  // 默认值保持"中性占位"(不含个人/机器信息,便于开源分发);实际使用请通过
  // cordis.patch.yml 配置,或依赖会话 cwd(优先)。
  lvalRoot: z.string().default(""),
  srcDir: z.string().default(""),
  solution: z.string().default(""),
  msbuild: z.string().default(""),
  configuration: z.string().default("Debug"),
  platform: z.string().default("x64"),
  // 余额查询用 DeepSeek API key(优先级:dsApiKey > 凭据缝(llm-deepseek 记录/引用) > 环境变量)。
  dsApiKey: z.string().default(""),
  dsApiKeyEnv: z.string().default("DEEPSEEK_API_KEY"),
});

const NL = String.fromCharCode(10);

/** 与 dsh-host-plugin-inventory 一致的 Fiber 状态 → 阶段映射(用于「已安装插件」装载状态展示)。 */
const FIBER_PHASE = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };
/** 框架包前缀:扫描「已安装插件」时排除的内置 @deepseek-ai/dsh-* 组件。 */
const FRAMEWORK_PREFIX = "@deepseek-ai/";
/** DET 全局插件库管理器自身(扫描时排除;用户可 includeDet 显式列出)。 */
const DET_PLUGIN_NAME = "dsh-essential-tools";
/** TCT 内置预设 TCT 专用 system prompt(name -> 追加的 person 描述)。 */
const TCT_PRESETS = {
  "": "",
  review: "你是一名严格的代码评审者:指出问题、风险与改进建议,单段给出结论;不要改写代码。",
  summary: "你是文本归纳助手:把输入压缩为要点列表,单段输出;保留关键事实,去掉客套。",
  format: "你是格式转换助手:按要求的格式输出结果,单段输出;只改格式,不改变语义。",
  brainstorm: "你是头脑风暴助手:围绕主题给出若干条清晰、可执行的点子,单段输出。",
};

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

/** 程序版本 id 白名单(防 rmdir/路径穿越)。 */
function safeVersionId(id) {
  if (typeof id !== "string" || id === "") return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/** 私网/环回/链路本地 IPv6/IPv4 判定(SSRF 防护)。 */
function isPrivateHostname(host) {
  if (typeof host !== "string") return true;
  let h = host.toLowerCase().replace(/\.$/, "");
  // URL.hostname 对 IPv6 带方括号,先剥掉。
  if (h.charAt(0) === "[" && h.charAt(h.length - 1) === "]") h = h.slice(1, -1);
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  // IPv6 文字形式
  if (h.indexOf(":") !== -1) {
    if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
    if (h.startsWith("::ffff:")) {
      const tail = h.slice("::ffff:".length);
      // 点分形式(::ffff:127.0.0.1)或十六进制形式(::ffff:7f00:1)
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return ipv4Private(tail);
      const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
      if (hex) {
        const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
        return ipv4Private(Math.floor(a / 256) + "." + (a % 256) + "." + Math.floor(b / 256) + "." + (b % 256));
      }
      return true; // 无法判定的 v4-mapped 一律拒绝
    }
    return false; // 其它 IPv6 视为公网(尽力而为)
  }
  return ipv4Private(h);
}
function ipv4Private(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 169 && b === 254) return true; // 链路本地(含云元数据 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
/** 外部可达性校验:仅 http/https、无 URL 内嵌凭据、主机不在私网/环回。 */
function safeHttpUrl(rawUrl) {
  let u = null;
  try { u = new URL(String(rawUrl)); } catch (e) { return { ok: false, error: "非法 URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "仅允许 http/https" };
  if (u.username !== "" || u.password !== "") return { ok: false, error: "URL 不允许内嵌凭据" };
  if (isPrivateHostname(u.hostname)) return { ok: false, error: "不允许访问内网/本机地址(SSRF 防护)" };
  return { ok: true, url: u.toString() };
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

/** 消息条目(供 VTD 视图;携带完整内容块以便前端精细渲染)。
 * 角色按消息来源判定,与产品渲染一致:
 *   - user/message + source.kind === 'user'  → user(真实用户输入)
 *   - user/message + 其它 kind(plugin/skill-catalog/goal/branch-reask 等)或空内容 → context(系统代提,非用户气泡)
 *   - tool/result → tool(工具结果,展示在助手侧)
 *   - assistant/message → assistant
 */
function viewMessage(ev) {
  const src = ev.data && ev.data.source && typeof ev.data.source === "object" ? ev.data.source : null;
  const srcKind = src && typeof src.kind === "string" ? src.kind : "";
  const isUser = ev.type === "user/message";
  let role = isUser ? (srcKind === "user" ? "user" : "context") : (ev.type === "tool/result" ? "tool" : "assistant");
  const id = ev.data && ev.data.message ? ev.data.message.id : (ev.data && ev.data.id) || "";
  const reask = srcKind === "branch-reask";
  const raw = Array.isArray(ev.type === "assistant/message" ? (ev.data.message && ev.data.message.content) : ev.data.content)
    ? (ev.type === "assistant/message" ? (ev.data.message && ev.data.message.content) : ev.data.content)
    : [];
  const blocks = raw.map((b) => {
    if (!b || typeof b !== "object") return { type: "unsupported", text: "" };
    if (b.type === "text") return { type: "text", text: typeof b.text === "string" ? b.text : "" };
    if (b.type === "reasoning") return { type: "reasoning", text: typeof b.text === "string" ? b.text : "" };
    if (b.type === "tool-call") return { type: "tool-call", id: b.id || "", name: b.name || "", arguments: b.arguments || "" };
    if (b.type === "tool-result") {
      const inner = Array.isArray(b.content) ? textContent(b.content) : (typeof b.content === "string" ? b.content : "");
      return { type: "tool-result", toolCallId: b.toolCallId || "", error: b.isError === true, text: inner };
    }
    return { type: "unsupported", text: "" };
  });
  const text = textContent(raw).slice(0, 800);
  const hasContent = raw.some((b) => b && typeof b === "object" && (b.type === "text" ? String(b.text || "").trim() !== "" : true));
  if (role === "user" && !hasContent) role = "context"; // 无内容用户消息 → 系统提示,不算用户
  const srcLabel = isUser
    ? (src && (String(src.plugin || "") || (typeof src.form === "string" ? src.form : ""))) || srcKind || ""
    : "";
  return {
    seq: ev.seq,
    role,
    text,
    blocks,
    messageId: id,
    reask,
    srcKind,
    srcLabel,
    form: src && typeof src.form === "string" ? src.form : "",
  };
}

class EssentialToolsService extends TypertRemoteService {
  constructor(ctx, config) {
    super(ctx, "dshEssentialTools");
    this.config = config;
    // VTD(虚拟对话存储系统):虚拟对话树 + 小版本(自动版本控制)。
    this.vtd = new VtdStore(ctx, config);
    // 全局插件控制(设置页「全局插件管理」+ 对话内 AI 工具)。
    this.global = new GlobalPluginStore(ctx);
    // MDA 分层(分组模式/分支模型区域/模型合作)。
    this.mda = new MdaStore(ctx);
    // 余额/官网单价的内存缓存(key 永不落盘)。
    this.dsCache = { balance: null, balanceAt: 0, price: null, priceAt: 0 };
    // 叉子会话的 agent 句柄(childId -> AgentHandle),插件卸载时统一释放。
    this.childAgents = new Map();
    // 会话侧边栏登记簿的自动同步(自检)状态。
    this._registrySyncing = null;   // 进行中的一次 reconcile(防重入)
    this._registrySyncedAt = 0;     // 上次自动同步完成时间
    this._registryCooldown = 60000; // 自动同步节流(60s);手动自检 force 绕过
    ctx.effect(() => () => {
      for (const handle of this.childAgents.values()) {
        if (handle && typeof handle.dispose === "function") handle.dispose().catch(() => {});
      }
      this.childAgents.clear();
    }, "dsh-essential-tools: dispose branch agents");
    // 自动:新会话发布即登记(纯增量,无全量扫描)。
    ctx.effect(() => ctx.on("session/created", (session) => {
      if (!session || !session.header || !session.header.id) return;
      this.upsertLiveSessionRecord(session).catch(() => { /* 尽力而为 */ });
    }), "dsh-essential-tools: session/created -> sidebar registry");
    // 全局插件:宿主 Cordis 运行成功事件 → 将该会话标记置为 enabled(覆盖 AI 审批完成)。
    ctx.effect(() => ctx.on("cordis/dynamic-package", (ev) => {
      if (!ev || !ev.pluginId) return;
      this._gpOnPackage(ev).catch(() => { /* 尽力而为 */ });
    }), "dsh-essential-tools: global plugin state sync");
    // 重启后应用持久化的常驻插件全局禁用状态(如 DBS 被禁用)→ 等 loader 树稳定后尽力应用。
    const loader = ctx.get("loader");
    if (loader && typeof loader.await === "function") {
      loader.await().then(() => this._applyPersistentPermanentStates()).catch(() => { /* 尽力而为 */ });
    }
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
    return this.config.srcDir || "";
  }

  async versionsDir(sessionId) {
    const root = await this.workspaceRoot(sessionId);
    return root === "" ? null : root + "\\.lval-versions";
  }

  // ── 会话侧边栏登记簿(存在的对话数据;自检 + 自动)──────────────────────

  /** SessionHeader -> 登记行(只取存在性数据,不取对话本体)。 */
  headerToRow(h) {
    return {
      id: h.id || "",
      cwd: h.cwd || "",
      parentSession: h.parentSession || null,
      origin: h.origin || "",
      hidden: h.origin === "vtd-fork",
      createdAt: h.createdAt || 0,
    };
  }

  /** 真实会话全集:durable 头(全部会话,含隐藏叉子) ∪ live 会话。 */
  async realSessionRows() {
    const persistence = this.ctx.get("sessionPersistence");
    const sessions = this.sessions();
    const out = [];
    const seen = new Set();
    if (persistence && typeof persistence.list === "function") {
      try {
        const headers = await persistence.list();
        for (const h of headers || []) {
          if (!h || seen.has(h.id)) continue;
          seen.add(h.id);
          out.push(this.headerToRow(h));
        }
      } catch (e) { /* ignore */ }
    }
    try {
      for (const s of sessions && typeof sessions.list === "function" ? sessions.list() : []) {
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        out.push(this.headerToRow(s.header || { id: s.id }));
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  /** 从 live 会话取增量字段(title/lastSeq/activeBranchId);未在运行返回 null。 */
  async enrichLive(id) {
    const sessions = this.sessions();
    const s = sessions && sessions.get(id);
    if (!s) return null;
    let title = "";
    const st = this.ctx.get("sessionTitle");
    if (st && typeof st.get === "function") {
      try {
        const snap = st.get(s);
        if (snap && typeof snap.title === "string") title = snap.title;
      } catch (e) { /* ignore */ }
    }
    let lastSeq = -1;
    let activeBranchId = "trunk";
    try {
      const events = Array.isArray(s.events) ? s.events : [];
      if (events.length > 0 && events[events.length - 1] && typeof events[events.length - 1].seq === "number") lastSeq = events[events.length - 1].seq;
      activeBranchId = (VtdStore.deriveTree(events).activeBranchId) || "trunk";
    } catch (e) { /* ignore */ }
    return { title, lastSeq, activeBranchId, updatedAt: Date.now() };
  }

  /** 增量登记一个 live 会话(不触发全量扫描)。 */
  async upsertLiveSessionRecord(session) {
    const header = session.header || {};
    const id = header.id || session.id;
    if (!id) return null;
    const row = this.headerToRow(header);
    const prev = await this.vtd.getSession(id);
    if (!prev.ok) return null;
    const rec = Object.assign({
      id, title: "", cwd: row.cwd, parentSession: row.parentSession,
      origin: row.origin, hidden: row.hidden, createdAt: row.createdAt,
      updatedAt: Date.now(), lastSeq: -1, activeBranchId: "trunk",
    }, prev.record || {});
    const live = await this.enrichLive(id);
    if (live) {
      if (live.title !== "") rec.title = live.title;
      rec.lastSeq = Math.max(rec.lastSeq, live.lastSeq);
      rec.activeBranchId = live.activeBranchId;
      rec.updatedAt = live.updatedAt;
    }
    await this.vtd.upsertSession(rec);
    return rec;
  }

  /**
   * 自检 + 自动修复:登记簿 ↔ 真实会话全集逐项对照。
   * @param force - true 时忽略节流(手动自检);false 为自动同步(60s 节流)。
   * @returns {ok, checkedAt, stored, real, added[], removed[], updated[], throttled?}
   */
  async reconcileRegistry(force) {
    if (this._registrySyncing) return this._registrySyncing;
    const now = Date.now();
    if (!force && now - this._registrySyncedAt < this._registryCooldown) {
      return { ok: true, throttled: true, checkedAt: this._registrySyncedAt };
    }
    this._registrySyncing = (async () => {
      const storedRes = await this.vtd.listSessions();
      if (!storedRes.ok) return storedRes;
      const storedMap = new Map(storedRes.sessions.map((r) => [r.id, r]));
      const rows = await this.realSessionRows();
      const realMap = new Map(rows.map((r) => [r.id, r]));
      const added = [];
      const updated = [];
      const removed = [];
      // 1) 登记簿存在但现实已无 → 清除(会话被删除/归档彻底清除)。
      for (const [id] of storedMap) {
        if (!realMap.has(id)) {
          await this.vtd.deleteSession(id);
          removed.push(id);
        }
      }
      // 2) 现实存在但登记簿缺失 → 新增;字段漂移 → 修正。
      for (const row of rows) {
        const prev = storedMap.get(row.id);
        if (!prev) {
          await this.vtd.upsertSession({
            id: row.id, title: "", cwd: row.cwd, parentSession: row.parentSession,
            origin: row.origin, hidden: row.hidden, createdAt: row.createdAt,
            updatedAt: now, lastSeq: -1, activeBranchId: "trunk",
          });
          added.push(row.id);
          continue;
        }
        let changed = false;
        const next = Object.assign({}, prev);
        if ((next.cwd || "") !== row.cwd) { next.cwd = row.cwd; changed = true; }
        if ((next.parentSession || null) !== row.parentSession) { next.parentSession = row.parentSession; changed = true; }
        if ((next.origin || "") !== row.origin) { next.origin = row.origin; next.hidden = row.hidden; changed = true; }
        if (next.hidden !== row.hidden) { next.hidden = row.hidden; changed = true; }
        if (next.createdAt !== row.createdAt) { next.createdAt = row.createdAt; changed = true; }
        const live = await this.enrichLive(row.id);
        if (live) {
          if (live.title !== "" && (next.title || "") !== live.title) { next.title = live.title; changed = true; }
          if (live.lastSeq > (next.lastSeq || -1)) { next.lastSeq = live.lastSeq; changed = true; }
          if ((next.activeBranchId || "trunk") !== live.activeBranchId) { next.activeBranchId = live.activeBranchId; changed = true; }
          // 在运行即活跃:刷新 updatedAt,让侧边栏按"最近活跃"排序。
          next.updatedAt = live.updatedAt;
          changed = true;
        }
        if (changed) {
          next.updatedAt = now;
          await this.vtd.upsertSession(next);
          updated.push(row.id);
        }
      }
      const report = {
        checkedAt: now,
        stored: storedMap.size,
        real: rows.length,
        added,
        removed,
        updated,
      };
      await this.vtd.setSetting("det.registry.check", report);
      this._registrySyncedAt = now;
      return Object.assign({ ok: true }, report);
    })();
    try {
      return await this._registrySyncing;
    } finally {
      this._registrySyncing = null;
    }
  }

  /** DET 功能开关归一化(缺省全开)。 */
  static normalizeFeatures(value) {
    const v = (value && typeof value === "object") ? value : {};
    return {
      file: v.file !== false,
      run: v.run !== false,
      ver: v.ver !== false,
      vtd: v.vtd !== false,
    };
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
    if (root === "") return { ok: true, runable: false, root: "" };
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
      const vd = await this.versionsDir(sessionId);
      if (!vd) return [];
      const target = await fs.resolve(vd + "\\versions.json");
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
    if (root === "") return { ok: false, error: "未配置工作区(srcDir 为空且会话无 cwd)" };
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
    if (typeof this.config.msbuild !== "string" || this.config.msbuild.trim() === "") {
      return { ok: false, exitCode: -1, output: "未配置 MSBuild 路径(请在 DET 配置中设置 msbuild)" };
    }
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
    const vd = await this.versionsDir(sessionId);
    if (!vd) return { ok: false, error: "未配置工作区(srcDir 为空且会话无 cwd)" };
    const vdir = vd + "\\" + id;
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
    if (!safeVersionId(id)) return { ok: false, error: "版本 id 非法" };
    // 仅当清单中存在该版本才允许恢复(防任意目录读取/回写)。
    const list = await this.readManifest(sessionId);
    if (!list.some(function (v) { return v && v.id === id; })) return { ok: false, error: "版本 " + id + " 不在清单中" };
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
    const id = safeVersionId(args && args.id);
    if (!id) return { ok: false, error: "版本 id 非法(仅允许字母/数字/_-)" };
    return this._restoreVersionById(sessionId, id);
  }

  async verProgDelete(args) {
    const subprocess = this.subprocess();
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const id = safeVersionId(args && args.id);
    if (!id) return { ok: false, error: "版本 id 非法(仅允许字母/数字/_-)" };
    // 只允许删除"清单中真实存在的版本"对应的目录(防 rmdir 任意目录穿越)。
    const list = await this.readManifest(sessionId);
    if (!list.some(function (v) { return v && v.id === id; })) return { ok: false, error: "版本 " + id + " 不在清单中" };
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

  /**
   * 子会话 agent 的模型路由(provider/model)。
   * 与 api-proxy 的 selectionFor 语义一致:优先子会话日志自带的最近 request/header
   * (即父会话当时的模型路由),否则回落到宿主默认模型选择。
   * 缺省时返回空路由,由调用方显式失败,避免 agent 以空 options 恢复后
   * 在系统提示词装配处死于 `{{model}}`/`{{provider}}` 无值(整轮秒败、无流式、无回答)。
   */
  async childModelRoute(childId) {
    try {
      const persistence = this.ctx.get("sessionPersistence");
      if (persistence && typeof persistence.load === "function") {
        const loaded = await persistence.load(childId);
        const events = loaded && Array.isArray(loaded.events) ? loaded.events : null;
        if (events) {
          for (let i = events.length - 1; i >= 0; i--) {
            const ev = events[i];
            if (!ev || ev.type !== "request/header") continue;
            const cfg = ev.data && ev.data.header && ev.data.header.config;
            if (cfg && cfg.provider && cfg.model) return { provider: cfg.provider, model: cfg.model };
          }
        }
      }
    } catch (e) { /* 尽力而为 */ }
    const def = this.ctx.get("agentDefaultModel");
    if (def && typeof def.currentSelection === "function") {
      try {
        const s = def.currentSelection();
        if (s && s.provider && s.model) return { provider: s.provider, model: s.model };
      } catch (e) { /* 尽力而为 */ }
    }
    return { provider: "", model: "" };
  }

  /** 子会话 agent 运行并提交一条消息(resume + followup)。 */
  async resumeAndSubmit(childId, message) {
    const agentLoop = this.ctx.get("agentLoop");
    const agents = this.ctx.get("agents");
    if (!agentLoop || !agents) return { ok: false, error: "agent 服务不可用" };
    if (!this.childAgents.has(childId)) {
      const route = await this.childModelRoute(childId);
      if (!route.provider || !route.model) return { ok: false, error: "无法确定分支会话的模型路由(provider/model 均缺省)" };
      try {
        const handle = await agentLoop.resume(this.ctx, {
          resumeSessionId: childId,
          agentOptions: route
        });
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
    // 自动:把新叉子会话立刻登记进侧边栏登记簿(存在性数据)。
    await this.vtd.upsertSession({
      id: created.childId,
      title: "",
      cwd: (session.header && session.header.cwd) || "",
      parentSession: session.id,
      origin: "vtd-fork",
      hidden: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSeq: -1,
      activeBranchId: "trunk",
    });
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
    // 自动:会话登记簿节流自检(与真实会话全集对齐,不阻塞响应)。
    this.reconcileRegistry(false).catch(() => { /* 尽力而为 */ });
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

  // ── 侧边栏登记簿端点 + DET 管理器开关 ──────────────────────────────────

  /** 侧边栏登记簿:存在的对话列表(自动同步后返回;供侧边栏/调试展示)。 */
  async registryList(args) {
    const auto = await this.reconcileRegistry(false);
    if (!auto.ok && !auto.throttled) return auto;
    const res = await this.vtd.listSessions();
    if (!res.ok) return res;
    const check = await this.vtd.getSetting("det.registry.check");
    return {
      ok: true,
      sessions: res.sessions,
      lastCheck: (check.ok && check.value) || null,
      throttled: auto.throttled === true,
    };
  }

  /** 手动自检(force):对照真实会话全集,自动增删改,返回报告。 */
  async registrySelfCheck(args) {
    return this.reconcileRegistry(true);
  }

  /** DET 管理器:读取功能开关(文件视图/运行按钮/版本控制/VTD)。 */
  async detFeatureGet(args) {
    const res = await this.vtd.getSetting("det.features");
    if (!res.ok) return res;
    return { ok: true, features: EssentialToolsService.normalizeFeatures(res.value) };
  }

  /** DET 管理器:更新一个或多个开关(局部合并)。 */
  async detFeatureSet(args) {
    const patch = args && args.patch ? args.patch : null;
    if (!patch || typeof patch !== "object") return { ok: false, error: "缺少 patch" };
    const keys = ["file", "run", "ver", "vtd"];
    const clean = {};
    for (const k of keys) {
      if (typeof patch[k] === "boolean") clean[k] = patch[k];
    }
    if (Object.keys(clean).length === 0) return { ok: false, error: "无有效开关字段(仅接受 file/run/ver/vtd 布尔值)" };
    const cur = await this.vtd.getSetting("det.features");
    if (!cur.ok) return cur;
    const next = Object.assign(EssentialToolsService.normalizeFeatures(cur.value), clean);
    const saved = await this.vtd.setSetting("det.features", next);
    if (!saved.ok) return saved;
    return { ok: true, features: next };
  }

  // ── 全局插件控制(设置页「全局插件管理」+ 对话内 AI 工具)──────────────────

  /** 动态 Cordis 运行器服务(可选)。 */
  runner() { return this.ctx.get("dynamicCordisRunner"); }

  /** 按 sessionId 解析实时 Agent(可选,会话未运行时为 null)。 */
  agentFor(sessionId) {
    if (typeof sessionId !== "string" || sessionId === "") return null;
    const agents = this.ctx.get("agents");
    if (!agents || typeof agents.get !== "function") return null;
    try {
      const a = agents.get(sessionId);
      return a && a.id ? a : null;
    } catch (e) { return null; }
  }

  /** 从进程级清单找一条全局插件在某会话的运行行。 */
  _invRow(rec, sessionId) {
    const mapped = rec && rec.sessions && rec.sessions[sessionId];
    if (!mapped) return null;
    const runner = this.runner();
    if (!runner || typeof runner.inventory !== "function") return null;
    try {
      const rows = runner.inventory();
      for (const row of rows) {
        if (row.agentId === sessionId && String(row.pluginId) === String(mapped.pluginId)) return row;
      }
    } catch (e) { /* 运行器不可用 */ }
    return null;
  }

  /** 宿主 Cordis 运行成功事件 → 标记该插件在某会话为 enabled。 */
  async _gpOnPackage(ev) {
    const runner = this.runner();
    if (!runner || typeof runner.inventory !== "function") return;
    let rows = [];
    try { rows = runner.inventory(); } catch (e) { return; }
    const row = rows.find((r) => String(r.pluginId) === String(ev.pluginId));
    if (!row || !row.agentId) return;
    const res = await this.global.list();
    if (!res.ok) return;
    for (const p of res.plugins) {
      const m = p.sessions && p.sessions[row.agentId];
      if (m && String(m.pluginId) === String(ev.pluginId)) {
        await this.global.setSessionState(p.id, row.agentId, "enabled");
        break;
      }
    }
  }

  /** 确保插件已定义到某会话,返回 {pluginId, packageId, reused}。 */
  async _defineForSession(rec, sessionId, by) {
    const runner = this.runner();
    if (!runner || typeof runner.define !== "function") return { ok: false, error: "动态 Cordis 运行器不可用" };
    const row = this._invRow(rec, sessionId);
    if (row) {
      const packageId = row.nextPackageId || row.currentPackageId || (row.packages.length ? row.packages[row.packages.length - 1].packageId : undefined);
      if (packageId) return { ok: true, pluginId: row.pluginId, packageId, reused: true };
    }
    // 未定义(或进程重启后清单为空)→ 新定义。
    const code = {};
    if (rec.host) code.host = rec.host;
    if (rec.client) code.client = rec.client;
    try {
      const receipt = runner.define({
        sessionId,
        plugin: { kind: "new", idPrefix: idPrefixOf(rec.id, rec.name) },
        name: rec.name.slice(0, 80),
        purpose: (rec.description || rec.name).slice(0, 200),
        code,
      });
      if (!receipt || !receipt.pluginId) return { ok: false, error: "定义失败(无返回值)" };
      const marked = await this.global.markSession(rec.id, sessionId, receipt.pluginId, receipt.packageId, by || "user", "pending");
      if (!marked.ok) return marked;
      return { ok: true, pluginId: receipt.pluginId, packageId: receipt.packageId, reused: false };
    } catch (e) {
      return { ok: false, error: "定义失败: " + String(e && e.message ? e.message : e) };
    }
  }

  /** 直接执行(免审批;调用方负责档位政策)。 */
  async _runDirect(agent, rec, sessionId, by) {
    const def = await this._defineForSession(rec, sessionId, by || "user");
    if (!def.ok) return def;
    const runner = this.runner();
    if (!runner || typeof runner.runHostHalf !== "function") return { ok: false, error: "动态 Cordis 运行器不可用" };
    try {
      const res = await runner.runHostHalf(agent, def.pluginId, def.packageId, "run", null, false);
      if (!res || res.ok !== true) return { ok: false, error: (res && res.message) || "启动失败" };
      await this.global.setSessionState(rec.id, sessionId, "enabled");
      return {
        ok: true,
        pluginId: def.pluginId,
        packageId: def.packageId,
        pluginRunId: res.pluginRunId,
        waitingFor: res.waitingFor || [],
      };
    } catch (e) {
      return { ok: false, error: "启动失败: " + String(e && e.message ? e.message : e) };
    }
  }

  /** AI 路径:定义后走动态 Cordis run()(未授权客户端包将进入审批)。 */
  async _runApproval(agent, rec, sessionId) {
    const def = await this._defineForSession(rec, sessionId, "ai");
    if (!def.ok) return def;
    const runner = this.runner();
    if (!runner || typeof runner.run !== "function") return { ok: false, error: "动态 Cordis 运行器不可用" };
    try {
      const res = await runner.run(agent, def.pluginId, def.packageId, "run");
      if (!res || res.ok !== true) return { ok: false, error: (res && res.message) || "运行请求失败" };
      if (res.status !== "awaiting-approval") {
        await this.global.setSessionState(rec.id, sessionId, "enabled");
      }
      return {
        ok: true,
        status: res.status,
        pluginId: def.pluginId,
        packageId: def.packageId,
        pluginRunId: res.pluginRunId,
        message: res.status === "awaiting-approval"
          ? "等待用户批准(或自动批准)"
          : res.status === "starting" ? "正在启动" : "运行中",
      };
    } catch (e) {
      return { ok: false, error: "运行请求失败: " + String(e && e.message ? e.message : e) };
    }
  }

  /** 停止某会话中的实例(尽力而为)。 */
  async _stopSession(rec, sessionId) {
    const mapped = rec && rec.sessions && rec.sessions[sessionId];
    if (!mapped) return { ok: true };
    const agent = this.agentFor(sessionId);
    const runner = this.runner();
    if (agent && runner && typeof runner.stopFromPanel === "function") {
      try { await runner.stopFromPanel(agent, mapped.pluginId); } catch (e) { /* 尽力 */ }
    }
    return this.global.unmarkSession(rec.id, sessionId);
  }

  /** 全局插件列表(无代码,含各会话状态;客户端展示 + AI 工具共用数据源)。 */
  async gpList(args) {
    const res = await this.global.list();
    if (!res.ok) return res;
    const llm = this.ctx.get("llm");
    const llmAvailable = !!(llm && typeof llm.listProviders === "function" && llm.listProviders().length > 0);
    // pending 状态核对:若宿主清单显示该插件已在运行(如 AI 审批已完成,事件未达 DET),
    // 就地纠正为 enabled(否则设置页将展示为未启用)。
    const runner = this.runner();
    let inv = [];
    if (runner && typeof runner.inventory === "function") {
      try { inv = runner.inventory(); } catch (e) { /* ignore */ }
    }
    for (const p of res.plugins) {
      const sessions = p.sessions || {};
      const fixedSids = [];
      for (const sid of Object.keys(sessions)) {
        const m = sessions[sid];
        if (m.state === "pending") {
          const row = inv.find((r) => r.agentId === sid && String(r.pluginId) === String(m.pluginId));
          if (row && row.activeRun) {
            m.state = "enabled";
            fixedSids.push(sid);
          }
        }
      }
      for (const sid of fixedSids) {
        const fixed = await this.global.setSessionState(p.id, sid, "enabled");
        if (fixed.ok && fixed.plugin && fixed.plugin.sessions) p.sessions = fixed.plugin.sessions;
      }
    }
    return {
      ok: true,
      plugins: res.plugins.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        level: p.level,
        levelLabel: LEVEL_LABELS[p.level] || p.level,
        originKind: p.originKind,
        originRef: p.originRef || "",
        permanent: p.permanent === true,
        moduleName: p.moduleName || "",
        globallyEnabled: p.globallyEnabled !== false,
        summary: p.summary || "",
        summaryAt: p.summaryAt || 0,
        hasHostHalf: typeof p.host === "string",
        hasClientHalf: typeof p.client === "string",
        sessions: p.sessions || {},
      })),
      llmAvailable,
    };
  }

  /** 实时会话列表 + 各会话的动态 Cordis 插件(设置页「从对话拉取」数据源)。 */
  async gpCordisInventory(args) {
    const sessionsSvc = this.sessions();
    if (!sessionsSvc || typeof sessionsSvc.list !== "function") return { ok: false, error: "sessions 服务不可用" };
    const runner = this.runner();
    if (!runner || typeof runner.listPlugins !== "function") return { ok: false, error: "动态 Cordis 运行器不可用" };
    const out = [];
    for (const s of sessionsSvc.list()) {
      if (!s || !s.id) continue;
      const agent = this.agentFor(s.id);
      if (!agent) continue;
      let plugins = [];
      try { plugins = runner.listPlugins(agent); } catch (e) { continue; }
      if (!plugins.length) continue;
      out.push({
        id: s.id,
        title: (s.header && (s.header.title || s.header.cwd)) || s.id,
        plugins: plugins.map((pl) => ({
          pluginId: String(pl.pluginId),
          name: pl.name || String(pl.pluginId),
          purpose: pl.purpose || "",
          currentPackageId: pl.currentPackageId || "",
          nextPackageId: pl.nextPackageId || "",
          packageCount: pl.packages ? pl.packages.length : 0,
          hasHostHalf: !!(pl.packages && pl.packages.some((p) => p.hasHostHalf)),
          hasClientHalf: !!(pl.packages && pl.packages.some((p) => p.hasClientHalf)),
          running: !!pl.activeRun,
        })),
      });
    }
    return { ok: true, sessions: out };
  }

  /** 从对话 Cordis 拉取为全局插件(默认档位:对话内AI需审批启用)。 */
  async gpPull(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const pluginId = args && args.pluginId ? String(args.pluginId) : "";
    if (!sessionId || !pluginId) return { ok: false, error: "缺少 sessionId 或 pluginId" };
    const agent = this.agentFor(sessionId);
    const runner = this.runner();
    if (!agent || !runner || typeof runner.inspectPackage !== "function") {
      return { ok: false, error: "会话未在运行或动态 Cordis 运行器不可用" };
    }
    let plugin = null;
    try {
      const list = runner.listPlugins(agent);
      plugin = list.find((p) => String(p.pluginId) === pluginId) || null;
    } catch (e) { return { ok: false, error: "读取插件失败: " + String(e && e.message ? e.message : e) }; }
    if (!plugin) return { ok: false, error: "该会话中没有插件 " + pluginId };
    const packageId = (args && args.packageId ? String(args.packageId) : "") ||
      plugin.nextPackageId || plugin.currentPackageId ||
      (plugin.packages && plugin.packages.length ? plugin.packages[plugin.packages.length - 1].packageId : "");
    let insp = null;
    try { insp = runner.inspectPackage(agent, pluginId, packageId); }
    catch (e) { return { ok: false, error: "读取包源码失败: " + String(e && e.message ? e.message : e) }; }
    const code = (insp && insp.code) || {};
    // upsert:重复拉取(例如插件代码更新后再次晋升)保留既有档位与各会话启用映射。
    const upserted = await this.global.upsert({
      id: pluginId,
      name: (insp && insp.name) || plugin.name || pluginId,
      description: (insp && insp.purpose) || plugin.purpose || "",
      code: { host: code.host, client: code.client },
      originKind: "cordis",
      originRef: sessionId + "::" + pluginId + "::" + packageId,
    });
    if (!upserted.ok) return upserted;
    return { ok: true, plugin: upserted.plugin, warnings: scanCodeWarnings(code) };
  }

  /** 从网上下载(JSON 清单或单文件 JS;SSRF 防护:仅公网 http/https,禁私网/环回)。 */
  async gpDownload(args) {
    const url = args && args.url ? String(args.url).trim() : "";
    const safe = safeHttpUrl(url);
    if (!safe.ok) return { ok: false, error: safe.error };
    const fetched = await this._fetchText(url, 1024 * 1024);
    if (!fetched.ok) return fetched;
    const text = fetched.text;
    let manifest = null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && (parsed.name || parsed.host || parsed.client || parsed.hostUrl || parsed.clientUrl)) manifest = parsed;
    } catch (e) { /* 非 JSON → 视为单文件 host 代码 */ }
    let name = "";
    let description = "";
    let code = {};
    if (manifest) {
      name = typeof manifest.name === "string" ? manifest.name : "";
      description = typeof manifest.description === "string" ? manifest.description : "";
      code = manifest;
      // hostUrl/clientUrl 指向独立文件(同样经 SSRF 校验)。
      if (typeof manifest.hostUrl === "string") {
        const hf = await this._fetchText(this._abs(url, manifest.hostUrl), 1024 * 1024);
        if (!hf.ok) return hf;
        code.host = hf.text;
      }
      if (typeof manifest.clientUrl === "string") {
        const cf = await this._fetchText(this._abs(url, manifest.clientUrl), 1024 * 1024);
        if (!cf.ok) return cf;
        code.client = cf.text;
      }
    } else {
      name = decodeURIComponent(url.split("/").pop() || "plugin").replace(/\.js$/i, "");
      code = { host: text };
    }
    const upserted = await this.global.upsert({
      id: String(name || url).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40),
      name,
      description,
      code,
      originKind: "url",
      originRef: fetched.finalUrl || url,
    });
    if (!upserted.ok) return upserted;
    return { ok: true, plugin: upserted.plugin, warnings: scanCodeWarnings(code) };
  }

  /** GitHub 搜索(商店)。 */
  async gpStoreSearch(args) {
    const q = args && typeof args.q === "string" && args.q.trim() !== "" ? args.q.trim() : "dsh plugin";
    const url = "https://api.github.com/search/repositories?q=" + encodeURIComponent(q) + "&sort=stars&order=desc&per_page=15";
    const fetched = await this._fetch(url, 210 * 1024);
    if (!fetched.ok) return fetched;
    let data = null;
    try { data = JSON.parse(fetched.text); } catch (e) { return { ok: false, error: "搜索结果解析失败" }; }
    const items = Array.isArray(data.items) ? data.items.slice(0, 15).map((it) => ({
      fullName: it.full_name || "",
      description: it.description || "",
      stars: typeof it.stargazers_count === "number" ? it.stargazers_count : 0,
      updatedAt: it.updated_at || "",
      defaultBranch: it.default_branch || "main",
      htmlUrl: it.html_url || "",
    })) : [];
    return { ok: true, q, items };
  }

  /** 商店:检查一个仓库的清单(名称/描述/README 片段,不下载代码)。 */
  async gpStoreInspect(args) {
    const repo = args && args.repo ? String(args.repo) : "";
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return { ok: false, error: "非法仓库名(格式 owner/repo)" };
    const repoInfo = await this._fetch("https://api.github.com/repos/" + repo, 210 * 1024);
    if (!repoInfo.ok) return repoInfo;
    let meta = null;
    try { meta = JSON.parse(repoInfo.text); } catch (e) { /* ignore */ }
    const branch = (args && args.branch ? String(args.branch) : "") || (meta && meta.default_branch) || "main";
    const rm = await this._fetchRaw(repo, branch, ["README.md", "README.zh.md", "readme.md"]);
    const readme = rm.ok ? (rm.text || "").slice(0, 6000) : "";
    const mf = await this._fetchRaw(repo, branch, ["dsh-plugin.json"]);
    let manifest = null;
    if (mf.ok) { try { manifest = JSON.parse(mf.text); } catch (e) { /* ignore */ } }
    const name = (manifest && typeof manifest.name === "string" && manifest.name) || (meta && meta.name) || repo.split("/")[1] || repo;
    const firstLine = readme.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).filter((l) => l.length > 0)[0] || "";
    const description = (manifest && manifest.description) || (meta && meta.description) || firstLine || "";
    return {
      ok: true,
      candidate: { name: String(name).slice(0, 200), description: String(description).slice(0, 2000), readme },
      repo: {
        fullName: repo,
        defaultBranch: branch,
        htmlUrl: (meta && meta.html_url) || ("https://github.com/" + repo),
        stars: typeof (meta && meta.stargazers_count) === "number" ? meta.stargazers_count : 0,
        updatedAt: (meta && meta.updated_at) || "",
      },
    };
  }

  /** 商店:AI 摘要(本地存档,避免重复 token)。 */
  async gpStoreSummarize(args) {
    const repo = args && args.repo ? String(args.repo) : "";
    const key = repo + "@" + (args && args.branch ? String(args.branch) : "default");
    const force = args && args.force === true;
    if (!force) {
      const cached = await this.global.cacheGet(key);
      if (cached.ok && cached.entry) return { ok: true, summary: cached.entry.summary, cached: true, at: cached.entry.at };
    }
    const insp = await this.gpStoreInspect({ repo, branch: args && args.branch });
    if (!insp.ok) return insp;
    const llm = this.ctx.get("llm");
    if (!llm || typeof llm.listProviders !== "function" || !llm.listProviders().length) {
      return { ok: false, llmAvailable: false, error: "未配置 LLM 适配器(设置 → 模型),无法生成 AI 摘要;可先在设置中配置提供商。" };
    }
    let provider = null;
    let model = null;
    try {
      const providers = llm.listProviders();
      provider = providers[0];
      if (!provider) throw new Error("无提供商");
      const models = await llm.listModels(provider.id);
      if (!models || !models.length) throw new Error("无模型");
      model = models[0].id;
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "无法选择模型: " + String(e && e.message ? e.message : e) };
    }
    const readmeText = (insp.candidate.readme || "").slice(0, 6000);
    const sys = "你是 DSH(DeepSeek Harness)插件商店的摘要助手。用 120 字以内的中文总结给定 README 对应的插件:它在 DSH 里做什么、有哪些能力、是否需要用户配置。只输出摘要正文,不要客套。";
    const userText = "仓库: " + repo + "\n名称: " + insp.candidate.name + "\n描述: " + insp.candidate.description + "\n\nREADME:\n" + readmeText;
    let summary = "";
    try {
      const msg = createUserMessage({
        content: [{ type: "text", text: userText }],
        source: { kind: "user" },
      });
      const stream = llm.stream({ provider: provider.id, model, system: sys, messages: [msg] });
      for await (const chunk of stream) {
        if (chunk && chunk.type === "text-delta" && typeof chunk.text === "string") summary += chunk.text;
        if (chunk && (chunk.type === "error" || chunk.type === "aborted")) break;
      }
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "摘要生成失败: " + String(e && e.message ? e.message : e) };
    }
    summary = summary.trim();
    if (summary === "") return { ok: false, llmAvailable: true, error: "摘要为空(模型未返回内容)" };
    const saved = await this.global.cachePut(key, summary);
    if (!saved.ok) return saved;
    return { ok: true, summary, cached: false };
  }

  /** 商店:安装(下载代码并按清单/README 描述入库,默认档位 ai-approve)。 */
  async gpInstall(args) {
    const repo = args && args.repo ? String(args.repo) : "";
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return { ok: false, error: "非法仓库名(格式 owner/repo)" };
    const insp = await this.gpStoreInspect({ repo, branch: args && args.branch });
    if (!insp.ok) return insp;
    const branch = insp.repo.defaultBranch;
    let host = "";
    let client = "";
    let sha = "";
    // 清单优先;其次约定路径 plugin/host.js + plugin/client.js。
    const mf = await this._fetchRaw(repo, branch, ["dsh-plugin.json"]);
    let manifest = null;
    if (mf.ok) { try { manifest = JSON.parse(mf.text); } catch (e) { /* ignore */ } }
    if (manifest && typeof manifest === "object") {
      const h = typeof manifest.host === "string" ? manifest.host : "";
      const c = typeof manifest.client === "string" ? manifest.client : "";
      if (h) {
        const hf = await this._fetchRaw(repo, branch, [h]);
        if (!hf.ok) return { ok: false, error: "清单指向的 host 文件读取失败: " + h };
        host = hf.text;
        if (hf.sha) sha = hf.sha;
      }
      if (c) {
        const cf = await this._fetchRaw(repo, branch, [c]);
        if (!cf.ok) return { ok: false, error: "清单指向的 client 文件读取失败: " + c };
        client = cf.text;
        if (cf.sha) sha = cf.sha;
      }
    } else {
      const hf = await this._fetchRaw(repo, branch, ["plugin/host.js"]);
      const cf = await this._fetchRaw(repo, branch, ["plugin/client.js"]);
      if (hf.ok) { host = hf.text; if (hf.sha) sha = hf.sha; }
      if (cf.ok) { client = cf.text; if (!sha && cf.sha) sha = cf.sha; }
      if (!host && !client) return { ok: false, error: "仓库中未找到 dsh-plugin.json 或 plugin/host.js / plugin/client.js(当前约定格式),无法安装。" };
    }
    const summaryKey = repo + "@" + branch;
    const cached = await this.global.cacheGet(summaryKey);
    const code = { host, client };
    // upsert:重复安装保留档位与启用映射;originRef 记录 commit sha 便于溯源。
    const upserted = await this.global.upsert({
      id: repo.split("/")[1].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40),
      name: (args && args.name ? String(args.name) : "") || insp.candidate.name,
      description: (args && args.description ? String(args.description) : "") || insp.candidate.description,
      code,
      originKind: "github",
      originRef: repo + "@" + branch + (sha ? "@" + sha : ""),
      summary: cached.ok && cached.entry ? cached.entry.summary : undefined,
    });
    if (!upserted.ok) return upserted;
    // 可疑代码扫描结果随安装返回,客户端展示提醒(不为硬性阻断)。
    return { ok: true, plugin: upserted.plugin, warnings: scanCodeWarnings(code) };
  }

  /** 设置页:查看插件代码与可疑特征扫描结果(仅为预览,不含密钥等敏感信息)。 */
  async gpCode(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    return {
      ok: true,
      id: rec.id,
      name: rec.name,
      originKind: rec.originKind,
      originRef: rec.originRef || "",
      host: typeof rec.host === "string" ? rec.host : "",
      client: typeof rec.client === "string" ? rec.client : "",
      warnings: scanCodeWarnings({ host: rec.host, client: rec.client }),
    };
  }

  /**
   * 方式一·直接下载:从 GitHub 仓库/URL 直接把插件代码拉入库。
   * 接受 `https://github.com/owner/repo`、`owner/repo`、或某个插件文件/清单 URL;
   * 按约定格式(dsh-plugin.json 或 plugin/host.js + plugin/client.js)下载并 upsert,
   * 返回安装结果与可疑代码扫描警告(与商店安装一致,非硬性阻断)。
   */
  async gpGithubDirect(args) {
    const raw = args && (args.url || args.repo) ? String(args.url || args.repo).trim() : "";
    const nameArg = args && args.name ? String(args.name) : "";
    const descArg = args && args.description ? String(args.description) : "";
    const parsed = this._parseGithubRef(raw);
    if (!parsed.ok) return parsed;
    if (parsed.directUrl) {
      // 直接文件 URL:复用 gpDownload(JSON 清单或单文件 JS)。
      return this.gpDownload({
        url: parsed.directUrl,
        ...nameArg ? { name: nameArg } : {},
        ...descArg ? { description: descArg } : {},
      });
    }
    // 仓库:复用 gpInstall(清单优先,其次约定路径 plugin/host.js + plugin/client.js)。
    return this.gpInstall({
      repo: parsed.repo,
      ...parsed.branch ? { branch: parsed.branch } : {},
      ...nameArg ? { name: nameArg } : {},
      ...descArg ? { description: descArg } : {},
    });
  }

  /**
   * 方式二·AI 读取源码自行编写:拉取仓库 README、清单与 host/client 源码,
   * 并注入「病毒/漏洞检查上下文」供 AI 审查。不直接执行下载的代码;
   * 由调用方(对话内 AI)对照源码自行编写等价实现后,经 gpGithubSave 入库。
   */
  async gpGithubRebuild(args) {
    const raw = args && (args.url || args.repo) ? String(args.url || args.repo).trim() : "";
    const parsed = this._parseGithubRef(raw);
    if (!parsed.ok) return parsed;
    if (parsed.directUrl) {
      const fetched = await this._fetchText(parsed.directUrl, 1024 * 1024);
      if (!fetched.ok) return fetched;
      return {
        ok: true,
        method: "rebuild",
        url: fetched.finalUrl || parsed.directUrl,
        repo: { fullName: "", defaultBranch: "", htmlUrl: parsed.directUrl },
        name: decodeURIComponent(parsed.directUrl.split("/").pop() || "plugin").replace(/\.js$/i, ""),
        description: "",
        readme: "",
        files: [{ path: "plugin/remote.js", content: fetched.text }],
        securityContext: this._securityContext(fetched.text, "", ""),
      };
    }
    const branch = (args && args.branch ? String(args.branch) : "") || parsed.branch || "";
    const insp = await this.gpStoreInspect({ repo: parsed.repo, ...branch ? { branch } : {} });
    if (!insp.ok) return insp;
    const effBranch = insp.repo.defaultBranch;
    const mf = await this._fetchRaw(parsed.repo, effBranch, ["dsh-plugin.json"]);
    let manifest = null;
    if (mf.ok) { try { manifest = JSON.parse(mf.text); } catch (e) { /* ignore */ } }
    let host = "", client = "";
    if (manifest && typeof manifest === "object") {
      const h = typeof manifest.host === "string" ? manifest.host : "";
      const c = typeof manifest.client === "string" ? manifest.client : "";
      if (h) { const hf = await this._fetchRaw(parsed.repo, effBranch, [h]); if (hf.ok) host = hf.text; }
      if (c) { const cf = await this._fetchRaw(parsed.repo, effBranch, [c]); if (cf.ok) client = cf.text; }
    } else {
      const hf = await this._fetchRaw(parsed.repo, effBranch, ["plugin/host.js"]);
      const cf = await this._fetchRaw(parsed.repo, effBranch, ["plugin/client.js"]);
      if (hf.ok) host = hf.text;
      if (cf.ok) client = cf.text;
    }
    if (!host.trim() && !client.trim()) {
      return { ok: false, error: "仓库中未找到可读取的插件源码(plugin/host.js / plugin/client.js 或 dsh-plugin.json)" };
    }
    const files = [];
    if (host.trim()) files.push({ path: "plugin/host.js", content: host });
    if (client.trim()) files.push({ path: "plugin/client.js", content: client });
    return {
      ok: true,
      method: "rebuild",
      repo: insp.repo,
      name: insp.candidate.name || "",
      description: insp.candidate.description || "",
      readme: (insp.candidate.readme || "").slice(0, 6000),
      files,
      securityContext: this._securityContext(host, client, insp.candidate.readme),
    };
  }

  /** 入库 AI(或任意调用方)自行编写的全局插件代码。 */
  async gpGithubSave(args) {
    const host = args && typeof args.host === "string" ? args.host : "";
    const client = args && typeof args.client === "string" ? args.client : "";
    if (!host.trim() && !client.trim()) return { ok: false, error: "缺少代码(host/client 至少其一)" };
    const name = args && typeof args.name === "string" && args.name.trim() ? args.name.trim() : "github-rebuild";
    const code = { host, client };
    const upserted = await this.global.upsert({
      id: args && args.id ? String(args.id) : name.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "github-rebuild",
      name,
      description: args && typeof args.description === "string" ? args.description.trim() : "",
      code,
      originKind: "github",
      originRef: (args && typeof args.originRef === "string" && args.originRef) || "rebuild",
      ...args && typeof args.summary === "string" ? { summary: args.summary } : {},
    });
    if (!upserted.ok) return upserted;
    return { ok: true, plugin: upserted.plugin, warnings: scanCodeWarnings(code) };
  }

  /**
   * 扫描「已安装的永久宿主插件」:枚举 cordis Loader 中非 group 的条目,
   * 排除框架组件(@deepseek-ai/dsh-*)与 DET 管理器本身(dsh-essential-tools),
   * 让像 DBS 这样的已常驻插件也能在全局插件管理里被看到/管理。
   * includeDet 为 true 时也把 DET 管理器本身列出来。
   */
  async gpScanInstalled(args) {
    const loader = this.ctx.get("loader");
    if (!loader || typeof loader.entries !== "function") {
      return { ok: false, error: "loader 服务不可用,无法枚举已安装插件" };
    }
    const includeDet = !!(args && args.includeDet === true);
    const out = [];
    try {
      for (const entry of loader.entries()) {
        if (entry && entry.options && entry.options.group) continue;
        const moduleName = entry && entry.options && typeof entry.options.name === "string" ? entry.options.name : "";
        if (moduleName === "") continue;
        if (moduleName.indexOf(FRAMEWORK_PREFIX) === 0) continue; // 框架内置组件
        if (moduleName === DET_PLUGIN_NAME && !includeDet) continue; // 排除 DET 管理器本身
        out.push(this._installedRow(entry, moduleName));
      }
    } catch (e) {
      return { ok: false, error: "枚举失败: " + String(e && e.message ? e.message : e) };
    }
    out.sort((a, b) => (a.moduleName < b.moduleName ? -1 : a.moduleName > b.moduleName ? 1 : 0));
    // 标记哪些已纳入全局插件库(便于 UI 隐藏/禁用「纳入」按钮)。
    const lib = await this.global.list();
    const libModules = new Set();
    if (lib.ok) {
      for (const p of lib.plugins) {
        if (p && p.moduleName) libModules.add(p.moduleName);
        if (p && p.originRef) libModules.add(p.originRef);
      }
    }
    for (const row of out) row.inLibrary = libModules.has(row.moduleName);
    return { ok: true, plugins: out, excludeDet: !includeDet };
  }

  /** Loader 条目 → 已安装插件行(与 dsh-host-plugin-inventory 的字段一致)。 */
  _installedRow(entry, moduleName) {
    const id = entry && typeof entry.id === "string" && entry.id !== "" ? entry.id : moduleName;
    const fiber = entry && entry.fiber;
    return {
      id,
      moduleName,
      name: moduleName.split("/").pop() || moduleName,
      enabled: !!(entry && !entry.disabled),
      fiberPhase: fiber ? (FIBER_PHASE[fiber.state] ?? null) : null,
    };
  }

  /**
   * 把扫出的「已安装永久插件」一键纳入全局插件库(常驻型:permanent=true)。
   * 入库后出现在「插件列表」;enable 走常驻路径不重复 spawn,避免与 boot 实例冲突。
   */
  async gpImportInstalled(args) {
    const moduleName = args && args.moduleName ? String(args.moduleName) : "";
    if (moduleName === "") return { ok: false, error: "缺少 moduleName" };
    const loader = this.ctx.get("loader");
    if (!loader || typeof loader.entries !== "function") return { ok: false, error: "loader 服务不可用" };
    let entry = null;
    try {
      for (const e of loader.entries()) {
        if (e && e.options && e.options.group) continue;
        if (e && e.options && e.options.name === moduleName) { entry = e; break; }
      }
    } catch (e) {
      return { ok: false, error: "枚举失败: " + String(e && e.message ? e.message : e) };
    }
    if (!entry) return { ok: false, error: "未找到已安装插件: " + moduleName };
    const name = moduleName.split("/").pop() || moduleName;
    const fiber = entry && entry.fiber;
    const phase = fiber ? (FIBER_PHASE[fiber.state] ?? null) : null;
    const saved = await this.global.upsert({
      id: moduleName,
      name,
      description: "(常驻永久插件)已随 DSH 常驻装载: " + moduleName + (phase ? " [" + phase + "]" : ""),
      code: {},
      originKind: "installed",
      originRef: moduleName,
      permanent: true,
      moduleName,
      level: "always",
    });
    if (!saved.ok) return saved;
    return { ok: true, plugin: saved.plugin, permanent: true, moduleName };
  }

  /** 按 moduleName 找到 loader 条目(返回 {entry, entryId};entryId 供 loader.update 使用)。 */
  _loaderEntryByModule(moduleName) {
    const loader = this.ctx.get("loader");
    if (!loader || typeof loader.entries !== "function") return null;
    for (const entry of loader.entries()) {
      if (entry.options && entry.options.group) continue;
      if (entry.options && entry.options.name === moduleName) return { entry, entryId: entry.id };
    }
    return null;
  }

  /**
   * 常驻永久插件全局二分开关(启/禁)。实时通过 loader.update(entryId,{disabled}) 卸载/装载,
   * 并把 globallyEnabled 持久化(重启后由宿主再次应用)。
   */
  async gpSetPermanentEnabled(args) {
    const id = args && args.id ? String(args.id) : "";
    const enabled = !!(args && args.enabled === true);
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    if (rec.permanent !== true) return { ok: false, error: "仅常驻永久插件支持全局启用/禁用" };
    const moduleName = rec.moduleName || "";
    // 1) 持久化期望状态。
    const patched = await this.global.updateMeta(id, { globallyEnabled: enabled });
    if (!patched.ok) return patched;
    // 2) 实时应用(loader update;若 loader 不可用则仅持久化,返回 applyError 提示)。
    let applyError = "";
    const loader = this.ctx.get("loader");
    if (loader && typeof loader.update === "function" && moduleName) {
      const found = this._loaderEntryByModule(moduleName);
      if (found) {
        try { await loader.update(found.entryId, { disabled: !enabled }); }
        catch (e) { applyError = String(e && e.message ? e.message : e); }
      } else {
        applyError = "未找到 loader 条目: " + moduleName;
      }
    } else {
      applyError = "loader 服务不可用(实时开关未生效,已持久化)";
    }
    return { ok: true, id, enabled, moduleName, ...applyError ? { applyError } : {} };
  }

  /** 重启后应用持久化的常驻插件全局禁用状态(尽力而为;失败静默,不影响启动)。 */
  async _applyPersistentPermanentStates() {
    const res = await this.global.list();
    if (!res.ok) return;
    const loader = this.ctx.get("loader");
    if (!loader || typeof loader.update !== "function") return;
    for (const p of res.plugins) {
      if (p.permanent !== true || !p.moduleName) continue;
      const wantDisabled = p.globallyEnabled === false;
      const found = this._loaderEntryByModule(p.moduleName);
      if (!found) continue;
      if (found.entry.disabled === wantDisabled) continue; // 已是期望状态
      try { await loader.update(found.entryId, { disabled: wantDisabled }); } catch (e) { /* 尽力 */ }
    }
  }

  /** 设置页:内联编辑保存插件 host/client 代码(仅非永久插件)。 */
  async gpUpdateCode(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const host = args && typeof args.host === "string" ? args.host : "";
    const client = args && typeof args.client === "string" ? args.client : "";
    if (!host.trim() && !client.trim()) return { ok: false, error: "缺少代码(host/client 至少其一)" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    if (rec.permanent === true) return { ok: false, error: "常驻永久插件由宿主装载,不能通过编辑改码(只能全局启用/禁用)" };
    if (host.length > 512 * 1024 || client.length > 512 * 1024) return { ok: false, error: "代码超过大小上限(512KB)" };
    const upserted = await this.global.upsert({
      id: rec.id,
      name: rec.name,
      description: rec.description || "",
      code: { host, client },
      originKind: rec.originKind,
      originRef: rec.originRef || "",
      ...typeof rec.summary === "string" ? { summary: rec.summary } : {},
    });
    if (!upserted.ok) return upserted;
    return { ok: true, plugin: upserted.plugin, warnings: scanCodeWarnings({ host, client }) };
  }

  /** 设置页:把插件代码交给 AI 做安全审查(高性能提示词;只出报告,不改码)。 */
  async gpSecurityReview(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    const host = typeof rec.host === "string" ? rec.host : "";
    const client = typeof rec.client === "string" ? rec.client : "";
    if (!host.trim() && !client.trim()) return { ok: false, error: "该插件无代码可审查" };
    const llm = this.ctx.get("llm");
    if (!llm || typeof llm.listProviders !== "function" || !llm.listProviders().length) {
      return { ok: false, llmAvailable: false, error: "未配置 LLM 适配器(设置 → 模型),无法做 AI 安全审查" };
    }
    let provider = null, model = null;
    try {
      const providers = llm.listProviders();
      provider = providers[0];
      if (!provider) throw new Error("无提供商");
      const models = await llm.listModels(provider.id);
      if (!models || !models.length) throw new Error("无模型");
      model = models[0].id;
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "无法选择模型: " + String(e && e.message ? e.message : e) };
    }
    const sys = this._securityReviewPrompt();
    const userText = "插件: " + rec.name + " (" + rec.id + ")\n来源: " + rec.originKind + " " + (rec.originRef || "") + "\n\n--- host 半区 ---\n" + host + "\n\n--- client 半区 ---\n" + client;
    let text = "";
    try {
      const msg = createUserMessage({ content: [{ type: "text", text: userText }], source: { kind: "user" } });
      const stream = llm.stream({ provider: provider.id, model, system: sys, messages: [msg] });
      for await (const chunk of stream) {
        if (chunk && chunk.type === "text-delta" && typeof chunk.text === "string") text += chunk.text;
        if (chunk && (chunk.type === "error" || chunk.type === "aborted")) break;
      }
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "安全审查失败: " + String(e && e.message ? e.message : e) };
    }
    text = text.trim();
    if (text === "") return { ok: false, llmAvailable: true, error: "审查为空(模型未返回内容)" };
    return { ok: true, id, name: rec.name, review: text, staticWarnings: scanCodeWarnings({ host, client }) };
  }

  /** 高性能安全审查提示词:分层威胁模型 + 具体发现 + 修复建议;只审查不改码。 */
  _securityReviewPrompt() {
    return [
      "你是一名 DeepSeek Harness(DSH)插件安全审查专家。下方给出一个 DSH 永久/动态插件的 host 与 client 两半区代码;它们会以当前 DSH 进程/浏览器页面 的真实权限运行。",
      "请按以下维度逐项审查,并在每个发现处给出:严重级别(致命/高危/中危/低危/提示)、涉及的具体行或片段、为什么危险、如何修复。",
      "审查维度:",
      "1. 动态求值与代码注入:new Function/eval/setTimeout(String)/Function 构造器;拼接后执行的用户可控内容。",
      "2. 进程与命令注入:child_process/exec/execFile/spawn/PowerShell/cmd;把用户可控参数拼进命令行;未固定版本的依赖下载。",
      "3. 信息外泄与网络回传:fetch/http/https/WebSocket/raw socket/udp;把会话、环境变量、文件内容、API Key、Cookie 发往外部主机;硬编码 secret/token/内网地址。",
      "4. 持久化与驻留:写启动目录/注册表/计划任务/系统路径;无限后台循环;订阅后不清理的副作用;写任意路径(目录穿越 ../)。",
      "5. 浏览器存储与隐私:Cookie/localStorage/sessionStorage 读取与上传;document.domain 篡改;跨域嵌入;权限放大。",
      "6. 混淆与隐藏:base64 解码后执行;极长单行;编码后字符串;反序列化即执行;隐藏的遥测/统计上报。",
      "7. 越权与滥用:读写任意文件(穿越);删除/覆盖非工作区文件;提权到宿主进程;调用未授权宿主服务。",
      "8. 供应链与依赖:下载并 eval 第三方脚本;require 未固定版本;引入超出声明用途的能力。",
      "最后给出总结判定:ALLOWED(可运行,谨慎) / CAUTION(有可疑点,建议修复后运行) / RISKY(高风险,建议不运行),并用 3-5 条列出最重要的修复建议(若安全则写明依据)。",
      "只输出审查报告本身,不要客套;不要修改代码。",
    ].join("\n");
  }

  // ── TCT(Temp Chat Tool):一次性临时对话(低成本),可选模型/预设/权限 ──

  /** 读取已设置的 TCT 模型(缺省空 → 用宿主默认第一个模型)。 */
  async _tctModel() {
    const s = await this.vtd.getSetting("tct.model");
    return s && s.ok && s.value ? String(s.value) : "";
  }

  /** TCT 专用 system prompt:基础人格 + 预设 person + 权限约束。 */
  _tctSystemPrompt(preset, permissions) {
    const presetPart = TCT_PRESETS[preset] || "";
    const permPart = (permissions && String(permissions).trim())
      ? "本次一次性对话允许使用的工具: " + String(permissions).trim() + "。只能调用这些工具;没有工具时只做纯文本推理,不要声称调用了工具。"
      : "本次一次性对话不允许调用任何工具,只做纯文本推理。";
    return [
      "你是 DSH 的临时对话助手(TCT,Temp Chat Tool)。你只被用来完成一次性的、轻量的任务:给定一段简短提示词,给出单段、直接、可用的回复。",
      "规则:①本次对话是一次性、无持久化,不要请求创建/保存/注册任何会话或长期状态,不要请求跨对话记忆;②只做提示词要求的事,不要编造上下文;③若超出能力范围,明确说明;④回复保持简短(默认 ≤ 300 字),除非被要求更详细。",
      presetPart ? ("预设角色/风格: " + presetPart) : "",
      permPart,
    ].filter(Boolean).join("\n");
  }

  /** TCT 运行:prompt +(可选)预设 + 权限约束 → 单段 feedback;临时对话即焚,无持久化。 */
  async tctRun(args) {
    const prompt = args && typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (prompt === "") return { ok: false, error: "缺少提示词(prompt)" };
    const preset = args && args.preset ? String(args.preset) : "";
    const permissions = args && typeof args.permissions === "string" ? args.permissions : "";
    const model = args && args.model ? String(args.model) : "";
    const llm = this.ctx.get("llm");
    if (!llm || typeof llm.listProviders !== "function" || !llm.listProviders().length) {
      return { ok: false, llmAvailable: false, error: "未配置 LLM 适配器(设置 → 模型),无法使用 TCT" };
    }
    let provider = null, modelId = null;
    try {
      const providers = llm.listProviders();
      provider = providers[0];
      if (!provider) throw new Error("无提供商");
      const models = await llm.listModels(provider.id);
      modelId = model || (await this._tctModel()) || (models[0] && models[0].id) || "";
      if (!modelId) throw new Error("无模型");
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "无法选择模型: " + String(e && e.message ? e.message : e) };
    }
    const sys = this._tctSystemPrompt(preset, permissions);
    let text = "";
    try {
      const msg = createUserMessage({ content: [{ type: "text", text: prompt }], source: { kind: "user" } });
      const stream = llm.stream({ provider: provider.id, model: modelId, system: sys, messages: [msg] });
      for await (const chunk of stream) {
        if (chunk && chunk.type === "text-delta" && typeof chunk.text === "string") text += chunk.text;
        if (chunk && (chunk.type === "error" || chunk.type === "aborted")) break;
      }
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "TCT 调用失败: " + String(e && e.message ? e.message : e) };
    }
    text = text.trim();
    if (text === "") return { ok: false, llmAvailable: true, error: "TCT 返回为空" };
    return { ok: true, feedback: text, model: modelId, preset };
  }

  /** 列出可用模型 + 当前 TCT 模型(供设置页选择)。 */
  async tctModels(args) {
    const llm = this.ctx.get("llm");
    if (!llm || typeof llm.listProviders !== "function" || !llm.listProviders().length) {
      return { ok: false, llmAvailable: false, error: "未配置 LLM 适配器(设置 → 模型)" };
    }
    const current = await this._tctModel();
    const out = [];
    let providers = [];
    try {
      providers = llm.listProviders();
      for (const prov of providers) {
        const models = await llm.listModels(prov.id);
        for (const m of models || []) out.push({ provider: prov.id, id: m.id, label: (m.name || m.id) });
      }
    } catch (e) {
      return { ok: false, llmAvailable: true, error: "读取模型失败: " + String(e && e.message ? e.message : e) };
    }
    return { ok: true, current, models: out };
  }

  /** 设置 TCT 模型。 */
  async tctSetModel(args) {
    const model = args && args.model ? String(args.model) : "";
    const saved = await this.vtd.setSetting("tct.model", model);
    if (!saved.ok) return saved;
    return { ok: true, model };
  }

  // ── CDM(CrossDialogueMemory):跨对话读取/搜索对话段 ──

  /** 取某会话的可展示消息段(用户/助手/工具结果,含文本)。 */
  async _segmentsOf(sessionId) {
    const events = await this.sessionEventsOf(sessionId);
    if (!events) return [];
    return events.filter(isViewMessage).map(viewMessage).filter((m) => m && m.text && m.text.trim() !== "");
  }

  /** 列出可读取的对话(侧边栏登记簿,含标题/工作区/最近活跃)。 */
  async cdmList(args) {
    const res = await this.vtd.listSessions();
    if (!res.ok) return res;
    const out = (res.sessions || []).map((s) => ({
      id: s.id,
      title: s.title || "",
      cwd: s.cwd || "",
      parentSession: s.parentSession || null,
      hidden: !!s.hidden,
      lastSeq: typeof s.lastSeq === "number" ? s.lastSeq : -1,
      updatedAt: s.updatedAt || 0,
    }));
    out.sort((a, b) => ((b.updatedAt || 0) - (a.updatedAt || 0)));
    return { ok: true, sessions: out.slice(0, 50) };
  }

  /**
   * 搜索与内容有关的对话段(跨对话;按内容匹配,返回命中段 + 会话上下文)。
   * 默认(非提权)只搜索「当前工作区」内的会话;cross=true 提权可跨工作区。
   * currentSessionId 由调用方(模型工具 exec)传入,用于确定当前工作区。
   */
  async cdmSearch(args) {
    const query = args && typeof args.query === "string" ? args.query.trim() : "";
    if (query === "") return { ok: false, error: "缺少搜索内容(query)" };
    const limit = Math.max(1, Math.min(20, Number((args && args.limit) || 8)));
    const sessionIds = args && Array.isArray(args.sessionIds) && args.sessionIds.length ? args.sessionIds : null;
    const currentSessionId = args && args.currentSessionId ? String(args.currentSessionId) : "";
    const cross = !!(args && args.cross === true);
    const q = query.toLowerCase();
    // 当前工作区(调用方会话的 cwd);用于默认限定作用范围。
    let currentWorkspace = "";
    if (currentSessionId) {
      try {
        const sessionsSvc = this.sessions();
        const s = sessionsSvc && sessionsSvc.get(currentSessionId);
        if (s && s.header && typeof s.header.cwd === "string") currentWorkspace = s.header.cwd;
      } catch (e) { /* ignore */ }
    }
    // 候选会话(登记簿)。只查最近 40 个,避免全量加载。
    const reg = await this.vtd.listSessions();
    if (!reg.ok) return reg;
    let rows = (reg.sessions || []).filter((s) => s && s.id).slice(0, 40);
    if (sessionIds) rows = rows.filter((r) => sessionIds.indexOf(r.id) >= 0);
    else if (!cross && currentWorkspace) rows = rows.filter((r) => r.cwd === currentWorkspace);
    const hits = [];
    for (const row of rows) {
      let segs = [];
      try { segs = await this._segmentsOf(row.id); } catch (e) { /* 尽力 */ }
      for (const seg of segs) {
        if (seg.text && seg.text.toLowerCase().indexOf(q) >= 0) {
          hits.push({
            sessionId: row.id,
            title: row.title || row.cwd || row.id,
            seq: seg.seq,
            role: seg.role,
            text: seg.text.slice(0, 700),
            messageId: seg.messageId || "",
          });
          if (hits.length >= limit * 4) break;
        }
      }
      if (hits.length >= limit * 4) break;
    }
    hits.sort((a, b) => (b.seq - a.seq));
    return { ok: true, query, total: hits.length, segments: hits.slice(0, limit), scope: cross ? "all" : (currentWorkspace || "all") };
  }

  /** 读取某对话的片段(按 seq/messageId 定位置,默认取最近)。 */
  async cdmRead(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    const seq = args && typeof args.seq === "number" ? args.seq : undefined;
    const messageId = args && args.messageId ? String(args.messageId) : "";
    const limit = Math.max(1, Math.min(40, Number((args && args.limit) || 12)));
    let segs = [];
    try { segs = await this._segmentsOf(sessionId); } catch (e) { return { ok: false, error: "会话无法读取" }; }
    if (!segs.length) return { ok: true, sessionId, segments: [] };
    let start = 0;
    if (typeof seq === "number") {
      const i = segs.findIndex((s) => s.seq === seq);
      start = i < 0 ? Math.max(0, segs.length - limit) : Math.max(0, i - Math.floor(limit / 2));
    } else if (messageId) {
      const i = segs.findIndex((s) => s.messageId === messageId);
      start = i < 0 ? Math.max(0, segs.length - limit) : Math.max(0, i - Math.floor(limit / 2));
    } else {
      start = Math.max(0, segs.length - limit);
    }
    const win = segs.slice(start, start + limit).map((s) => ({
      seq: s.seq, role: s.role, text: s.text.slice(0, 1600), messageId: s.messageId || "",
    }));
    return { ok: true, sessionId, segments: win };
  }

  // ── MDA 分层:分组模式 / 分支模型区域 / 模型介绍与合作 ──

  /** 当前 MDA 分组模式。 */
  async mdaGet(args) {
    const modeRes = await this.mda.getMode();
    if (!modeRes.ok) return modeRes;
    const areasRes = await this.mda.listAreas();
    return { ok: true, mode: modeRes.mode, mods: MODES, areas: areasRes.ok ? areasRes.areas : [] };
  }

  /** 设置 MDA 分组模式(原生/工作区/模型)。 */
  async mdaSetMode(args) {
    const mode = args && args.mode ? String(args.mode) : "";
    return this.mda.setMode(mode);
  }

  /** 分支模型区域列表。 */
  async mdaAreaList(args) {
    return this.mda.listAreas();
  }

  /** 新建分支模型区域。 */
  async mdaAreaCreate(args) {
    const name = args && args.name ? String(args.name).trim().slice(0, 60) : "";
    if (name === "") return { ok: false, error: "缺少区域名称" };
    const workspace = args && args.workspace ? String(args.workspace) : "";
    const pluginSet = args && Array.isArray(args.pluginSet) ? args.pluginSet.map(String) : [];
    const id = "area-" + Date.now().toString(36) + Math.random().toString(16).slice(2, 6);
    const now = Date.now();
    const rec = { id, name, workspace, pluginSet, memberSessions: [], createdAt: now, updatedAt: now };
    return this.mda.putArea(rec);
  }

  /** 删除分支模型区域。 */
  async mdaAreaRemove(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少区域 id" };
    return this.mda.delArea(id);
  }

  /** 把某会话加入区域。 */
  async mdaAreaAddSession(args) {
    const areaId = args && args.areaId ? String(args.areaId) : "";
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (!areaId || !sessionId) return { ok: false, error: "缺少 areaId 或 sessionId" };
    const list = await this.mda.listAreas();
    if (!list.ok) return list;
    const rec = list.areas.find((a) => a.id === areaId);
    if (!rec) return { ok: false, error: "区域不存在: " + areaId };
    if (rec.memberSessions.indexOf(sessionId) < 0) rec.memberSessions = rec.memberSessions.concat([sessionId]);
    rec.updatedAt = Date.now();
    return this.mda.putArea(rec);
  }

  /** 从区域移除某会话。 */
  async mdaAreaRemoveSession(args) {
    const areaId = args && args.areaId ? String(args.areaId) : "";
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (!areaId || !sessionId) return { ok: false, error: "缺少 areaId 或 sessionId" };
    const list = await this.mda.listAreas();
    if (!list.ok) return list;
    const rec = list.areas.find((a) => a.id === areaId);
    if (!rec) return { ok: false, error: "区域不存在: " + areaId };
    rec.memberSessions = (rec.memberSessions || []).filter((s) => s !== sessionId);
    rec.updatedAt = Date.now();
    return this.mda.putArea(rec);
  }

  /**
   * 在区域内创建一个「新对话」(隐藏子会话,复用目标/同工作区某会话为上下文种子,类似 VTD 分叉),
   * 并自动纳入该区域。供分组视图的「+」使用。
   */
  async mdaNewConversation(args) {
    const areaId = args && args.areaId ? String(args.areaId) : "";
    const workspace = args && args.workspace ? String(args.workspace) : "";
    const sourceSessionId = args && args.sourceSessionId ? String(args.sourceSessionId) : "";
    let parentId = sourceSessionId;
    if (!parentId) {
      const reg = await this.vtd.listSessions();
      if (reg.ok) {
        let area = null;
        if (areaId) { const al = await this.mda.listAreas(); area = al.ok ? al.areas.find((a) => a.id === areaId) : null; }
        const members = area ? (area.memberSessions || []) : [];
        const pool = (reg.sessions || []).filter((s) => s && s.id);
        const byMember = pool.filter((s) => members.indexOf(s.id) >= 0);
        const byWs = pool.filter((s) => !workspace || s.cwd === workspace);
        const pick = byMember[0] || byWs[0] || pool[0];
        parentId = pick && pick.id;
      }
    }
    if (!parentId) return { ok: false, error: "没有可用会话作为新对话的上下文种子" };
    const sessionsSvc = this.sessions();
    const liveParent = sessionsSvc && sessionsSvc.get(parentId);
    if (!liveParent) return { ok: false, error: "种子会话未在运行" };
    const events = Array.isArray(liveParent.events) ? liveParent.events : [];
    const boundary = Math.max(0, events.length - 8);
    const created = await this.createBranchChild(liveParent, boundary);
    if (!created.ok) return created;
    if (areaId) await this.mdaAreaAddSession({ areaId, sessionId: created.childId });
    return { ok: true, childSessionId: created.childId, areaId, sourceSessionId: parentId };
  }

  /** 为该模型(会话)生成/更新「模型介绍」(TCT),存 model_cards。 */
  async mdaCard(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    if (sessionId === "") return { ok: false, error: "缺少会话 id" };
    const segs = await this._segmentsOf(sessionId);
    if (!segs.length) return { ok: false, error: "该会话暂无可总结内容" };
    const recent = segs.slice(-12).map((s) => (s.role === "user" ? "U: " : s.role === "assistant" ? "A: " : "T: ") + s.text.replace(/\n+/g, " ").slice(0, 240)).join("\n");
    const prompt = "请用一段简短中文介绍下面这段对话所代表的模型:一句话说用途/定位,一句话说它最近主要在做什么。对话= " + sessionId + "。最近内容:\n" + recent + "\n只输出介绍正文,不要客套。";
    const tct = await this.tctRun({ prompt });
    if (!tct.ok) return tct;
    const saved = await this.mda.putCard(sessionId, tct.feedback);
    if (!saved.ok) return saved;
    return { ok: true, sessionId, intro: tct.feedback, model: tct.model };
  }

  /**
   * 激活其它模型(模型组合作):读取目标模型介绍,再用目标模型的模型路由
   * 复用一个隐藏子会话(类似 VTD 分叉)并提交提示词。提醒:耗提示词,**不鼓励**常规使用。
   */
  async mdaActivate(args) {
    const targetSessionId = args && args.targetSessionId ? String(args.targetSessionId) : "";
    const prompt = args && typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (!targetSessionId || prompt === "") return { ok: false, error: "缺少目标会话或提示词" };
    const modeRes = await this.mda.getMode();
    const mode = modeRes.ok ? modeRes.mode : "native";
    if (mode !== "model") return { ok: false, error: "模型合作(mda_activate)仅在「模型组」模式下可用;当前 MDA 模式: " + mode + "(设置页 MDA 分层可切换)" };
    const card = await this.mda.getCard(targetSessionId);
    const intro = card.ok && card.card ? card.card.intro : "";
    const sessionsSvc = this.sessions();
    const target = sessionsSvc && sessionsSvc.get(targetSessionId);
    if (!target) return { ok: false, error: "目标会话未在运行" };
    const route = await this.childModelRoute(targetSessionId);
    if (!route.provider || !route.model) return { ok: false, error: "无法确定目标模型路由" };
    const events = Array.isArray(target.events) ? target.events : [];
    const boundary = Math.max(0, events.length - 30); // 以目标最近 30 条为种子
    const created = await this.createBranchChild(target, boundary);
    if (!created.ok) return created;
    const submitted = await this.resumeAndSubmit(created.childId, createUserMessage({
      content: [{ type: "text", text: prompt }],
      source: { kind: "user", form: "mda-activate" },
    }));
    return { ok: true, targetSessionId, childSessionId: created.childId, intro, submitted: submitted.ok === true, note: "已按目标模型路由复用一个隐藏子会话并提交提示词(类似 VTD 分叉)。不鼓励频繁使用(耗提示词)。" };
  }

  /** 设置页:改档位(disabled → 立即停止所有实例;frozen → 存量保持)。 */
  async gpSetLevel(args) {
    const id = args && args.id ? String(args.id) : "";    const level = args && args.level ? String(args.level) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    const before = rec.level;
    const updated = await this.global.updateMeta(id, { level });
    if (!updated.ok) return updated;
    if (level === "disabled" && before !== "disabled") {
      // 立即停止所有会话中的实例并清空启用映射。
      const sessions = Object.keys(rec.sessions || {});
      for (const sid of sessions) await this._stopSession(rec, sid);
      const cleared = await this.global.get(id);
      if (cleared.ok && cleared.plugin && cleared.plugin.sessions && Object.keys(cleared.plugin.sessions).length) {
        const rec2 = cleared.plugin;
        rec2.sessions = {};
        rec2.updatedAt = Date.now();
        await this.global.put(rec2);
      }
    }
    return { ok: true, plugin: updated.plugin, stoppedOnDisable: before !== "disabled" && level === "disabled" };
  }

  /** 设置页:改名称/描述/摘要。 */
  async gpSetMeta(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    return this.global.updateMeta(id, {
      ...args && typeof args.name === "string" ? { name: args.name } : {},
      ...args && typeof args.description === "string" ? { description: args.description } : {},
      ...args && typeof args.summary === "string" ? { summary: args.summary } : {},
    });
  }

  /** 设置页:删除(先停止所有实例)。 */
  async gpDelete(args) {
    const id = args && args.id ? String(args.id) : "";
    if (id === "") return { ok: false, error: "缺少插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    for (const sid of Object.keys(rec.sessions || {})) await this._stopSession(rec, sid);
    return this.global.del(id);
  }

  /** 设置页(用户/自动):在指定会话启用。 */
  async gpSessionEnable(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const id = args && args.id ? String(args.id) : "";
    const by = args && args.by === "auto" ? "auto" : "user";
    if (!sessionId || !id) return { ok: false, error: "缺少 sessionId 或插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    const mapped = rec.sessions[sessionId];
    const policy = GlobalPluginStore.policy(rec.level, by);
    let verb = policy.verb;
    if (verb === "refuse") {
      // 恢复豁免:auto 且已有启用记录(仅恢复,不新增)。
      if (by === "auto" && !!(mapped)) verb = "run";
      else return { ok: false, error: GlobalPluginStore.refuseText(policy.reason, rec.level) };
    }
    // 待审批中的插件不自动恢复(避免静默重启被拒绝的启用;由用户手动处理)。
    if (by === "auto" && mapped && mapped.state === "pending") {
      return { ok: false, error: "该插件在此会话仍有待审批的启用请求;请先完成审批或停用后再试。" };
    }
    const agent = this.agentFor(sessionId);
    if (!agent) return { ok: false, error: "会话未在运行(请先打开该对话再启用)" };
    // 常驻永久插件:宿主已装载,不重复 spawn(避免与 boot 实例冲突);仅记录该会话已启用。
    if (rec.permanent === true) {
      if (rec.globallyEnabled === false) return { ok: false, error: "常驻插件 " + id + " 已被全局禁用,请先「启用」" };
      await this.global.markSession(id, sessionId, "permanent", "", by || "user", "enabled");
      return { ok: true, pluginId: "", packageId: "", hasClientHalf: false, permanent: true, status: "running" };
    }
    const res = verb === "run" ? await this._runDirect(agent, rec, sessionId, by) : await this._runApproval(agent, rec, sessionId);
    if (!res.ok) return res;
    // hasClientHalf:客户端据此再走 startUserRun 完成 client 半区加载。
    return { ok: true, pluginId: res.pluginId, packageId: res.packageId, hasClientHalf: typeof rec.client === "string", status: verb === "run" ? "running" : (res.status || "starting") };
  }

  /** 设置页/工具:在指定会话停用。 */
  async gpSessionDisable(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const id = args && args.id ? String(args.id) : "";
    if (!sessionId || !id) return { ok: false, error: "缺少 sessionId 或插件 id" };
    const got = await this.global.get(id);
    if (!got.ok) return got;
    return this._stopSession(got.plugin, sessionId);
  }

  /** 客户端自动批准查询:该插件是否 DET 全局插件且处于「AI 可自行启用」档位。 */
  async gpCheckApproval(args) {
    const sessionId = args && args.sessionId ? String(args.sessionId) : "";
    const pluginId = args && args.pluginId ? String(args.pluginId) : "";
    if (!sessionId || !pluginId) return { ok: true, autoApprove: false };
    const res = await this.global.list();
    if (!res.ok) return { ok: true, autoApprove: false };
    for (const p of res.plugins) {
      const m = p.sessions && p.sessions[sessionId];
      if (m && String(m.pluginId) === pluginId && p.level === "ai-auto") {
        return { ok: true, autoApprove: true, id: p.id };
      }
    }
    return { ok: true, autoApprove: false };
  }

  // ── DeepSeek 余额 / 官网单价(参考开源做法,见 lib/ds.js 头注释)──────────

  /**
   * 解析 DeepSeek API key(绝不落盘、不进日志、只用于余额请求头)。
   * 优先级:配置 dsApiKey → 凭据缝(llm-deepseek 记录 / DEEPSEEK_API_KEY 引用)→ 启动环境变量。
   */
  async _dsApiKey() {
    const cfg = this.config || {};
    if (typeof cfg.dsApiKey === "string" && cfg.dsApiKey.trim() !== "") return { ok: true, key: cfg.dsApiKey.trim() };
    const credentials = this.ctx.get("credentials");
    if (credentials) {
      // 1) llm-deepseek 已存的关键字记录(scope = llm-deepseek)。
      try {
        if (typeof credentials.listRecords === "function") {
          const entries = await credentials.listRecords();
          for (const entry of entries || []) {
            const key = entry && entry.key ? String(entry.key) : "";
            if (key.indexOf("llm-deepseek/") === 0) {
              const rec = await credentials.readRecord(entry.key);
              if (rec && rec.kind === "api-key" && typeof rec.key === "string" && rec.key.trim() !== "") {
                return { ok: true, key: rec.key.trim(), via: "credentials-record" };
              }
            }
          }
        }
      } catch (e) { /* 继续走引用/环境变量 */ }
      // 2) 引用(默认 DEEPSEEK_API_KEY)。
      try {
        const refName = typeof cfg.dsApiKeyEnv === "string" && cfg.dsApiKeyEnv.trim() !== "" ? cfg.dsApiKeyEnv.trim() : "DEEPSEEK_API_KEY";
        const ref = credentialRef(refName);
        if (typeof credentials.resolve === "function") {
          const hit = await credentials.resolve(ref);
          const value = hit && hit.value;
          if (typeof value === "string" && value.trim() !== "") return { ok: true, key: value.trim(), via: "credentials-ref" };
        }
      } catch (e) { /* 忽略 */ }
    }
    const envName = typeof cfg.dsApiKeyEnv === "string" && cfg.dsApiKeyEnv.trim() !== "" ? cfg.dsApiKeyEnv.trim() : "DEEPSEEK_API_KEY";
    const ambient = process.env[envName];
    if (typeof ambient === "string" && ambient.trim() !== "") return { ok: true, key: ambient.trim(), via: "env" };
    return { ok: false, via: "none" };
  }

  /** 余额查询(内存缓存 60s;key 仅存在于本机请求头)。 */
  async dsBalance(args) {
    const force = args && args.force === true;
    const now = Date.now();
    if (!force && this.dsCache.balance !== null && now - this.dsCache.balanceAt < BALANCE_TTL) {
      return { ok: true, cached: true, ...this.dsCache.balance };
    }
    const keyRes = await this._dsApiKey();
    if (!keyRes.ok) {
      const out = {
        ok: false,
        code: "NO_KEY",
        error: "未配置 DeepSeek API Key",
        hint: "在 设置 → 模型 → DeepSeek 配置 API Key(凭据),或为 DET 设置 dsApiKey / 环境变量 " + (this.config && this.config.dsApiKeyEnv ? this.config.dsApiKeyEnv : "DEEPSEEK_API_KEY"),
      };
      return out;
    }
    const res = await fetchDsBalance(keyRes.key);
    if (!res.ok) {
      return {
        ok: false,
        code: res.code || "UNKNOWN",
        error: res.error || "余额查询失败",
        hint: res.code === "KEY_INVALID" ? "API Key 无效或已欠费;请核对 设置 → 模型 → DeepSeek 的 API Key。" : undefined,
      };
    }
    // 依据用量历史估算"耗尽时间"(与价格币种匹配的余额桶才估算)。
    let estimate = null;
    try {
      const usage = await this._dsUsageEstimate();
      if (usage) {
        const match = (res.balances || []).find((b) => String(b.currency).toUpperCase() === String(usage.currency).toUpperCase());
        if (match) {
          const total = Number(match.total) || 0;
          estimate = {
            daily: usage.daily,
            currency: usage.currency,
            windowDays: usage.windowDays,
            sessions: usage.sessions,
            modelId: usage.modelId,
            ...total > 0 && usage.daily > 0 ? { daysLeft: Math.floor((total / usage.daily) * 10) / 10 } : {},
          };
        } else {
          estimate = { mismatch: true, currency: usage.currency, daily: usage.daily };
        }
      }
    } catch (e) { /* 估算失败不影响余额展示 */ }
    this.dsCache.balance = Object.assign({}, res, estimate ? { estimate } : {});
    this.dsCache.balanceAt = Date.now();
    return { ok: true, cached: false, ...this.dsCache.balance };
  }

  /**
   * 用量历史估算:从会话日志取 provider 用量(token-meter 同源字段:assistant/message 的 data.usage),
   * 近 7 天优先、近 30 天兜底,按"默认模型(deepseek-official)+ 错峰单价"折算日均费用。
   * 返回 {daily, currency, windowDays, sessions, modelId};无用量/无价格时返回 null。
   * 结果缓存 10 分钟(在 dsCache.usage)。
   */
  async _dsUsageEstimate() {
    const now = Date.now();
    if (this.dsCache.usage !== null && now - (this.dsCache.usageAt || 0) < 10 * 60 * 1000) {
      return this.dsCache.usage && this.dsCache.usage.none !== true ? this.dsCache.usage : null;
    }
    let price = this.dsCache.price;
    if (!price) {
      // 价格尚未加载(客户端先触发了余额):懒加载一次(6h 缓存)。
      try { const p = await this.dsPrice({}); if (p.ok) price = this.dsCache.price; } catch (e) { /* 忽略 */ }
    }
    if (!price || !price.models || !price.models.length) {
      this.dsCache.usage = { none: true };
      this.dsCache.usageAt = now;
      return null;
    }
    const byId = {};
    for (const m of price.models) byId[m.id] = m;
    let modelId = null;
    try {
      const def = this.ctx.get("agentDefaultModel");
      if (def && typeof def.get === "function") {
        const sel = def.get();
        if (sel && sel.provider === "deepseek-official" && sel.model && byId[sel.model]) modelId = sel.model;
      }
    } catch (e) { /* 忽略 */ }
    const pricing = modelId ? byId[modelId] : price.models[0];
    if (!pricing) return null;
    // 会话清单(durable ∪ live)
    const sessionsSvc = this.sessions();
    const persistence = this.ctx.get("sessionPersistence");
    const rows = [];
    const seenIds = new Set();
    if (persistence && typeof persistence.list === "function") {
      try {
        for (const h of await persistence.list()) {
          if (h && h.id && !seenIds.has(h.id)) { seenIds.add(h.id); rows.push({ id: h.id, updatedAt: h.updatedAt || 0, createdAt: h.createdAt || 0 }); }
        }
      } catch (e) { /* 忽略 */ }
    }
    try {
      for (const s of sessionsSvc.list()) {
        if (s && s.id && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          rows.push({ id: s.id, updatedAt: (s.header && s.header.updatedAt) || 0, createdAt: (s.header && s.header.createdAt) || 0, live: true });
        }
      }
    } catch (e) { /* 忽略 */ }
    rows.sort((a, b) => ((b.updatedAt || 0) - (a.updatedAt || 0)));
    // 窗口尝试:7 天 → 30 天(窗口内无有效用量则继续)
    let result = null;
    for (const winDays of [7, 30]) {
      const win = winDays * 86400000;
      const inWin = rows.filter((r) => (r.updatedAt || 0) > now - win).slice(0, 20);
      if (inWin.length === 0) continue;
      let miss = 0, hit = 0, out = 0, counted = 0;
      for (const r of inWin) {
        const agg = await this._sessionUsageTokens(r.id);
        if (agg) { miss += agg.miss; hit += agg.hit; out += agg.out; counted++; }
      }
      if (miss + hit + out > 0) {
        const cost = (miss / 1e6) * pricing.inputMissOffPeak + (hit / 1e6) * pricing.inputHitOffPeak + (out / 1e6) * pricing.outputOffPeak;
        if (cost > 0) {
          result = { daily: Math.round((cost / winDays) * 100) / 100, currency: price.currency || "CNY", windowDays: winDays, sessions: inWin.length, modelId: modelId || pricing.id };
          break;
        }
      }
    }
    this.dsCache.usage = result || { none: true };
    this.dsCache.usageAt = Date.now();
    return result;
  }

  /** 单会话 provider 用量(assistant/message 的 data.usage;与 token-meter 同一次采样,避免重复计数)。 */
  async _sessionUsageTokens(sessionId) {
    const events = await this.sessionEventsOf(sessionId);
    if (!events || !events.length) return null;
    let miss = 0, hit = 0, out = 0, found = false;
    for (const ev of events) {
      if (!ev || !ev.data || typeof ev.data !== "object") continue;
      if (ev.type !== "assistant/message") continue;
      const u = ev.data.usage;
      if (!u || typeof u !== "object") continue;
      const input = Number(u.inputTokens) || 0;
      const cacheRead = Number(u.cacheReadTokens) || 0;
      const cacheWrite = Number(u.cacheWriteTokens) || 0;
      const output = Number(u.outputTokens) || 0;
      if (input + cacheRead + cacheWrite + output <= 0) continue;
      miss += input + cacheWrite;
      hit += cacheRead;
      out += output;
      found = true;
    }
    return found ? { miss, hit, out } : null;
  }

  /** 官网单价(内存缓存 6h;解析失败回退上次成功值)。 */
  async dsPrice(args) {
    const force = args && args.force === true;
    const now = Date.now();
    if (!force && this.dsCache.price !== null && now - this.dsCache.priceAt < PRICE_TTL) {
      const cached = this.dsCache.price;
      return { ok: true, cached: true, models: cached.models, note: cached.note, currency: cached.currency || "USD", fetchedAt: cached.fetchedAt, source: cached.source };
    }
    const res = await fetchDsPrice(this.dsCache.price);
    if (!res.ok) {
      if (res.lastGood) {
        return { ok: false, error: res.error, lastGood: true, models: res.lastGood.models, note: res.lastGood.note, currency: res.lastGood.currency || "USD", fetchedAt: res.lastGood.fetchedAt, source: res.lastGood.source };
      }
      return { ok: false, error: res.error, hint: "官网定价页解析失败;仍可使用缓存(手动刷新前需要网络可达 api-docs.deepseek.com)" };
    }
    this.dsCache.price = res;
    this.dsCache.priceAt = Date.now();
    return { ok: true, cached: false, models: res.models, note: res.note, currency: res.currency || "USD", fetchedAt: res.fetchedAt, source: res.source };
  }

  // ── 内部:HTTP 小工具 ────────────────────────────────────────────────

  /** fetch 文本(限制大小;手动跟随重定向,每一跳都做 SSRF/私网校验;至多 5 跳)。 */
  async _fetch(url, maxLen) {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const safe = safeHttpUrl(current);
      if (!safe.ok) return { ok: false, error: safe.error + " (" + String(current).slice(0, 120) + ")" };
      let resp = null;
      try { resp = await fetch(safe.url, { headers: { "User-Agent": "dsh-essential-tools", Accept: "application/vnd.github+json,text/plain,*/*" }, redirect: "manual" }); }
      catch (e) { return { ok: false, error: "网络请求失败: " + String(e && e.message ? e.message : e) }; }
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) return { ok: false, error: "HTTP " + resp.status + " 重定向无 location" };
        current = new URL(loc, current).toString();
        continue;
      }
      if (!resp.ok) return { ok: false, error: "HTTP " + resp.status + " (" + String(current).slice(0, 120) + ")" };
      const text = await resp.text();
      if (text.length > maxLen) return { ok: false, error: "响应过大(> " + Math.floor(maxLen / 1024) + "KB)" };
      return { ok: true, text, finalUrl: current };
    }
    return { ok: false, error: "重定向超过 5 跳" };
  }

  async _fetchText(url, maxLen) { return this._fetch(url, maxLen); }

  /**
   * GitHub Contents API 取文件(多候选名,取第一个成功;base64 解码;返回 sha 供溯源)。
   * 注:不用 raw.githubusercontent.com —— 部分网络环境其解析被拦截,而 api.github.com 稳定。
   */
  async _fetchRaw(repo, branch, paths) {
    const enc = (s) => encodeURIComponent(s);
    for (const p of paths) {
      const url = "https://api.github.com/repos/" + repo + "/contents/" + p.split("/").map(enc).join("/") + "?ref=" + enc(branch);
      const got = await this._fetch(url, 3 * 1024 * 1024);
      if (!got.ok) continue;
      try {
        const j = JSON.parse(got.text);
        if (j && typeof j.content === "string" && j.encoding === "base64") {
          const text = Buffer.from(j.content.replace(/\s/g, ""), "base64").toString("utf8");
          if (text.length <= 1024 * 1024 && text.trim() !== "") return { ok: true, text, sha: typeof j.sha === "string" ? j.sha : "", path: p };
        }
      } catch (e) { /* 继续下一个候选 */ }
    }
    return { ok: false, error: "未找到文件: " + paths.join(" / ") };
  }

  /** 相对 URL 解析(用于清单内 hostUrl/clientUrl)。 */
  _abs(base, rel) {
    try { return new URL(rel, base).toString(); } catch (e) { return rel; }
  }

  /**
   * 统一解析 GitHub 输入 → { repo, branch, directUrl? }。
   * 支持:https://github.com/owner/repo、owner/repo、纯文件/清单 URL(经 SSRF 校验)。
   */
  _parseGithubRef(raw) {
    const s = String(raw || "").trim();
    if (s === "") return { ok: false, error: "缺少 GitHub 仓库/URL" };
    let m = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/tree\/([A-Za-z0-9_.\/-]+))?/i.exec(s);
    if (m) return { ok: true, repo: m[1], branch: (m[2] && String(m[2]).split("/")[0]) || "" };
    m = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.exec(s);
    if (m) return { ok: true, repo: m[1], branch: "" };
    const safe = safeHttpUrl(s);
    if (safe.ok) return { ok: true, repo: "", branch: "", directUrl: safe.url };
    return { ok: false, error: "无法识别的 GitHub 输入: " + String(s).slice(0, 80) };
  }

  /**
   * 方式二的安全上下文:把病毒/漏洞检查提示注入给 AI,供其对照源码审查并自行编写。
   * 不构成安全边界——真正的边界是白名单与运行沙箱(见 SECURITY 说明),但足以引导 AI 剔除可疑片段。
   */
  _securityContext(host, client, readme) {
    const warnings = scanCodeWarnings({ host, client });
    const lines = [
      "# 安全(病毒/漏洞)检查上下文 —— 逐项对照下方源码审查",
      "目标:阅读给出的第三方插件源码后,你『自行编写』等价版本时,要确保不引入以下威胁,并主动剔除/重写可疑片段。",
      "威胁清单:",
      "1. 动态求值与代码注入:new Function / eval / setTimeout(String) / Function 构造器,以及字符串拼接后执行。",
      "2. 进程执行与命令注入:child_process / exec / execFile / spawn / PowerShell / cmd;拼接用户可控参数到命令行。",
      "3. 信息外泄与网络回传:fetch / http.request / WebSocket / raw socket;把会话、环境变量、文件内容发往外部主机;硬编码 API Key / token / 内网地址。",
      "4. 持久化与驻留:写启动目录、注册表、计划任务;无限后台循环;订阅后不清理的副作用。",
      "5. 浏览器存储与隐私:Cookie / localStorage / sessionStorage;读取并外传;document.domain 篡改;跨域嵌入。",
      "6. 混淆与隐藏:base64 解码后执行;极长单行;编码后字符串;反序列化即执行。",
      "7. 供应链:下载并 eval 第三方脚本;require 未固定版本;引入超出声明用途的依赖。",
      "8. 越权与滥用:读写任意路径(目录穿越 ../);删除/覆盖非工作区文件;提升权限到宿主进程。",
      "静态扫描命中的可疑特征(尽力而为):",
    ];
    if (warnings.length === 0) lines.push("  (无单一特征命中,仍需人工语义审查)");
    for (const w of warnings) lines.push("  - [" + w.half + "] " + w.label);
    if (readme && String(readme).trim() !== "") {
      lines.push("");
      lines.push("README 摘录(了解目的与配置):\n" + String(readme).slice(0, 2000));
    }
    return lines.join("\n");
  }
}

/** 端点清单。 */
const METHOD_NAMES = [
  "lvalInfo", "lvalListFiles", "lvalReadFile", "lvalRun", "workspaceDetectEndpoint",
  "verProgCreate", "verProgList", "verProgRestore", "verProgDelete",
  "treeView", "editMessage", "retryMessage", "switchFork", "newMessage",
  "debugSessions", "debugMinor",
  "registryList", "registrySelfCheck", "detFeatureGet", "detFeatureSet",
  "gpList", "gpCordisInventory", "gpPull", "gpDownload", "gpStoreSearch",
  "gpStoreInspect", "gpStoreSummarize", "gpInstall", "gpGithubDirect", "gpGithubRebuild", "gpGithubSave", "gpScanInstalled", "gpImportInstalled", "gpSetPermanentEnabled",
  "gpSetLevel", "gpSetMeta",
  "gpDelete", "gpSessionEnable", "gpSessionDisable", "gpCheckApproval",
  "gpCode", "gpUpdateCode", "gpSecurityReview",
  "tctRun", "tctModels", "tctSetModel",
  "cdmList", "cdmSearch", "cdmRead",
  "mdaGet", "mdaSetMode", "mdaAreaList", "mdaAreaCreate", "mdaAreaRemove", "mdaAreaAddSession", "mdaAreaRemoveSession", "mdaNewConversation", "mdaCard", "mdaActivate",
  "dsBalance", "dsPrice",
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
 * 全局插件 AI 工具:对话内查看/启用/停用 DET 管理的全局插件。
 * 档位强制执行:always 直跑;ai-auto 自动批准;ai-approve 审批;frozen/disabled 拒绝。
 */
function registerGlobalPluginTools(ctx, service) {
  const tools = ctx.get("tools");
  if (!tools || typeof tools.register !== "function") return;

  const requireAgent = function (exec) {
    if (!exec || !exec.agent || !exec.agent.id) throw new Error("该工具需要对话会话上下文");
    return exec.agent;
  };
  const pluginText = function (p, sessionId) {
    const m = p.sessions && p.sessions[sessionId];
    return "插件 " + p.id + "「" + p.name + "」档位=" + (p.levelLabel || p.level) +
      (m ? " · 本会话已注册(" + m.pluginId + ")" : " · 本会话未启用") +
      (p.description ? "\n描述: " + p.description : "");
  };

  // 清单
  tools.register(defineTool({
    name: "det_global_plugin_list",
    description: "列出 DET 全局插件库(简称全局插件)中全部插件及其档位(全局启用/对话AI可自行决定启用/对话内AI需审批启用/不再会有新启用/全局禁用)与当前会话启用状态。启用某个插件前先调用本工具查看其档位。",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { plugins: {
          type: "array",
          required: true,
          items: { type: "string" }
        } }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value.plugins, null, 2) }]
    },
    async execute(_args, exec) {
      const agent = requireAgent(exec);
      const res = await service.gpList({});
      if (!res.ok) throw new Error(res.error || "全局插件库不可用");
      return { plugins: res.plugins.map((p) => pluginText(p, agent.id)) };
    },
  }));

  // 启用
  tools.register(defineTool({
    name: "det_global_plugin_enable",
    description: "在【当前对话会话】中启用一个 DET 全局插件(按 id)。档位决定结果:全局启用→已自动生效;对话AI可自行决定启用→自动启用;对话内AI需审批启用→进入审批等待用户批准(返回 awaiting-approval,不要重试);不再会有新启用/全局禁用→拒绝。启用后该插件的 host/client 代码在会话内运行,与动态 Cordis 插件一样拥有当前进程权限。",
    parameters: { id: {
      type: "string",
      required: true,
      description: "全局插件 id(形如 gp-xxx,来自 det_global_plugin_list)。"
    } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          status: { type: "string", required: true },
          pluginId: { type: "string" },
          packageId: { type: "string" },
          message: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.message }]
    },
    async execute(args, exec) {
      const agent = requireAgent(exec);
      const id = String(args.id || "");
      const got = await service.global.get(id);
      if (!got.ok) throw new Error(got.error || "插件不存在");
      const rec = got.plugin;
      const policy = GlobalPluginStore.policy(rec.level, "ai");
      if (policy.verb === "refuse") throw new Error(GlobalPluginStore.refuseText(policy.reason, rec.level));
      // 常驻永久插件:宿主已装载,不重复 spawn;仅记录该会话启用。
      if (rec.permanent === true) {
        if (rec.globallyEnabled === false) throw new Error("常驻插件 " + id + " 已被全局禁用,请先用 det_global_plugin_set_enabled 启用");
        await service.global.markSession(id, agent.id, "permanent", "", "ai", "enabled");
        return { id, status: "running", message: "全局插件 " + id + "(常驻永久插件)已在当前会话记录为启用;因宿主已常驻装载,跳过重复加载。" };
      }
      const res = policy.verb === "run"
        ? await service._runDirect(agent, rec, agent.id, "ai")
        : await service._runApproval(agent, rec, agent.id);
      if (!res.ok) throw new Error(res.error || "启用失败");
      return {
        id,
        status: res.status || (policy.verb === "run" ? "running" : "starting"),
        ...res.pluginId ? { pluginId: res.pluginId } : {},
        ...res.packageId ? { packageId: res.packageId } : {},
        message: (res.status === "awaiting-approval"
          ? "全局插件 " + id + " 正在等待审批" + (rec.level === "ai-auto" ? "(将自动批准)" : ",请在 Cordis 面板批准或拒绝") + "。"
          : "全局插件 " + id + " 已启用(" + (res.status || "running") + ")。"),
      };
    },
  }));

  // 停用
  tools.register(defineTool({
    name: "det_global_plugin_disable",
    description: "在【当前对话会话】中停用一个 DET 全局插件(按 id,见 det_global_plugin_list)。停用后该会话中的插件实例停止运行,但插件库记录与档位保留;重新启用须按档位规则(「不再会有新启用」/「全局禁用」档位可能拒绝)。",
    parameters: { id: {
      type: "string",
      required: true,
      description: "全局插件 id(形如 gp-xxx)。"
    } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string", required: true }, message: { type: "string", required: true } }
      },
      render: (_args, value) => [{ type: "text", text: value.message }]
    },
    async execute(args, exec) {
      const agent = requireAgent(exec);
      const id = String(args.id || "");
      const res = await service.gpSessionDisable({ sessionId: agent.id, id });
      if (!res.ok) throw new Error(res.error || "停用失败");
      return { id, message: "全局插件 " + id + " 已在当前会话停用。" };
    },
  }));

  // 方式一·直接下载(对话内 AI 可从 GitHub 直接下载全局插件入库)
  tools.register(defineTool({
    name: "det_global_plugin_github_direct",
    description: "从 GitHub 直接下载并入库一个 DET 全局插件(方式一·直接下载)。传入仓库 URL(如 https://github.com/owner/repo)、owner/repo,或某个插件文件/清单 URL;按约定格式(dsh-plugin.json 或 plugin/host.js + plugin/client.js)拉取代码并入库。返回安装结果与可疑代码扫描警告。安装后可用 det_global_plugin_list 查看、det_global_plugin_enable 启用。注意:下载的是第三方代码,与动态 Cordis 插件一样以当前进程真实权限运行,请先核对警告。",
    parameters: {
      url: { type: "string", required: true, description: "GitHub 仓库 URL、owner/repo,或插件文件/清单 URL。" },
      name: { type: "string", description: "可选:覆盖插件名称。" },
      description: { type: "string", description: "可选:覆盖插件描述。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          name: { type: "string", required: true },
          originRef: { type: "string", required: true },
          warnings: { type: "array", required: true, items: { type: "string" } },
          message: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.message + (value.warnings && value.warnings.length ? "\n可疑特征:\n- " + value.warnings.join("\n- ") : "") }],
    },
    async execute(args) {
      const res = await service.gpGithubDirect({
        url: String(args.url || ""),
        ...args.name ? { name: String(args.name) } : {},
        ...args.description ? { description: String(args.description) } : {},
      });
      if (!res.ok) throw new Error(res.error || "直接下载失败");
      const warnings = (res.warnings || []).map((w) => w.half + ": " + w.label);
      return {
        id: res.plugin.id,
        name: res.plugin.name,
        originRef: res.plugin.originRef || "",
        warnings,
        message: "已从 GitHub 直接下载并入库全局插件 " + res.plugin.id + "「" + res.plugin.name + "」。来源=" + (res.plugin.originRef || "") + "。可先用 det_global_plugin_list 查看档位再启用。",
      };
    },
  }));

  // 方式二·AI 读取源码自行编写(拉取源码 + 注入安全检查上下文)
  tools.register(defineTool({
    name: "det_global_plugin_github_rebuild",
    description: "由 AI 读取 GitHub 插件源码并自行编写等价插件(方式二·AI 重写)。传入仓库 URL 或 owner/repo,拉取其 README、清单与 host/client 源码,并注入「病毒/漏洞检查上下文」供你审查。你需对照源码、按该上下文查漏,自行实现一份等价(且更安全)的 host/client 代码,再用 det_global_plugin_github_save 入库。此方式不直接执行第三方代码。",
    parameters: {
      url: { type: "string", required: true, description: "GitHub 仓库 URL 或 owner/repo。" },
      branch: { type: "string", description: "可选:分支;缺省用仓库默认分支。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", required: true },
          name: { type: "string", required: true },
          description: { type: "string", required: true },
          readme: { type: "string", required: true },
          files: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: { path: { type: "string" }, content: { type: "string" } } } },
          securityContext: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: "仓库 " + value.repo + "「" + value.name + "」源码已读取。\n\n" + value.securityContext }],
    },
    async execute(args) {
      const res = await service.gpGithubRebuild({
        url: String(args.url || ""),
        ...args.branch ? { branch: String(args.branch) } : {},
      });
      if (!res.ok) throw new Error(res.error || "读取源码失败");
      return {
        repo: res.repo ? (res.repo.fullName || res.repo.htmlUrl || "") : (res.url || ""),
        name: res.name || "",
        description: res.description || "",
        readme: res.readme || "",
        files: res.files || [],
        securityContext: res.securityContext || "",
      };
    },
  }));

  // 方式二·入库 AI(或调用方)自行编写的等价实现
  tools.register(defineTool({
    name: "det_global_plugin_github_save",
    description: "把你(经由 det_global_plugin_github_rebuild 读取源码后)自行编写的等价全局插件代码入库。提供 name/description 与 host/client 代码;originRef 建议填来源仓库名。返回入库结果与可疑代码扫描警告。",
    parameters: {
      name: { type: "string", required: true, description: "插件名称。" },
      description: { type: "string", description: "插件描述。" },
      host: { type: "string", description: "host 半区代码(由你依据源码重写后的等价实现)。" },
      client: { type: "string", description: "client 半区代码(由你依据源码重写后的等价实现)。" },
      originRef: { type: "string", description: "来源,建议填仓库全名(owner/repo)。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          name: { type: "string", required: true },
          warnings: { type: "array", required: true, items: { type: "string" } },
          message: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.message + (value.warnings && value.warnings.length ? "\n可疑特征:\n- " + value.warnings.join("\n- ") : "") }],
    },
    async execute(args) {
      const res = await service.gpGithubSave({
        name: String(args.name || ""),
        ...args.description ? { description: String(args.description) } : {},
        ...args.host ? { host: String(args.host) } : {},
        ...args.client ? { client: String(args.client) } : {},
        ...args.originRef ? { originRef: String(args.originRef) } : {},
      });
      if (!res.ok) throw new Error(res.error || "入库失败");
      const warnings = (res.warnings || []).map((w) => w.half + ": " + w.label);
      return {
        id: res.plugin.id,
        name: res.plugin.name,
        warnings,
        message: "已把 AI 重写版全局插件 " + res.plugin.id + "「" + res.plugin.name + "」入库。来源=" + (res.plugin.originRef || "") + "。可先 det_global_plugin_list 查看档位再启用。",
      };
    },
  }));

  // 扫描已安装的永久宿主插件(排除 DET 管理器本身;让 DBS 这类常驻插件可被看到/管理)
  tools.register(defineTool({
    name: "det_global_plugin_scan_installed",
    description: "扫描并列出当前 DSH 中「已安装的永久宿主插件」——即在 cordis 组合里常驻装载的插件(如 dbs 背景音乐等),自动排除 DET 全局插件库管理器本身(dsh-essential-tools)。用于确认有哪些插件已随 DSH 常驻及其装载状态(enabled / phase)。",
    parameters: {
      includeDet: { type: "boolean", description: "可选:设为 true 时把 DET 管理器本身也列出来。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          count: { type: "number", required: true },
          plugins: { type: "array", required: true, items: { type: "string" } },
        },
      },
      render: (_args, value) => [{ type: "text", text: "已扫描到 " + value.count + " 个已安装常驻插件(DET 管理器已排除):\n" + value.plugins.join("\n") }],
    },
    async execute(args) {
      const res = await service.gpScanInstalled({ includeDet: !!(args && args.includeDet) });
      if (!res.ok) throw new Error(res.error || "扫描失败");
      const lines = res.plugins.map((p) => "• " + p.moduleName + "  [id=" + p.id + "]  enabled=" + p.enabled + "  phase=" + (p.fiberPhase || "null"));
      return { count: res.plugins.length, plugins: lines };
    },
  }));

  // 把扫出的已安装永久插件一键纳入全局插件库(常驻型;enable 不重复 spawn)
  tools.register(defineTool({
    name: "det_global_plugin_import_installed",
    description: "把「det_global_plugin_scan_installed」扫出的已安装永久宿主插件(如 dbs)一键纳入全局插件库。传入 moduleName;入库后出现在 det_global_plugin_list,可按五档/会话启停管理。该插件标记为常驻型——宿主已装载,启用时不重复加载,避免与 boot 实例冲突。",
    parameters: {
      moduleName: { type: "string", required: true, description: "插件的 moduleName(来自 det_global_plugin_scan_installed)。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          name: { type: "string", required: true },
          permanent: { type: "boolean", required: true },
          message: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.message }],
    },
    async execute(args) {
      const res = await service.gpImportInstalled({ moduleName: String(args.moduleName || "") });
      if (!res.ok) throw new Error(res.error || "纳入失败");
      return {
        id: res.plugin.id,
        name: res.plugin.name,
        permanent: res.plugin.permanent === true,
        message: "已把「" + res.plugin.name + "」纳入全局插件库(常驻型)。可用 det_global_plugin_list 查看、det_global_plugin_enable 在会话启用(不重复加载)。",
      };
    },
  }));

  // 常驻永久插件全局二分开关(启用/禁用;借助 loader.update 实时生效)
  tools.register(defineTool({
    name: "det_global_plugin_set_enabled",
    description: "对常驻永久插件(如 dbs,经 det_global_plugin_import_installed 纳入库后)做全局二分「启用/禁用」。传入 id 与 enabled;禁用时实时卸载该插件的宿主实例(不再提供其功能),启用时重新加载。该开关跨会话、跨重启持久化(重启后再次应用)。",
    parameters: {
      id: { type: "string", required: true, description: "常驻插件 id(形如 gp-xxx,来自 det_global_plugin_list)。" },
      enabled: { type: "boolean", required: true, description: "true=启用;false=禁用。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          enabled: { type: "boolean", required: true },
          applyError: { type: "string" },
          message: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.message + (value.applyError ? "\n⚠ 实时应用未生效: " + value.applyError : "") }],
    },
    async execute(args) {
      const id = String(args.id || "");
      const enabled = !!(args && args.enabled === true);
      const res = await service.gpSetPermanentEnabled({ id, enabled });
      if (!res.ok) throw new Error(res.error || "设置失败");
      return {
        id,
        enabled: res.enabled,
        ...res.applyError ? { applyError: res.applyError } : {},
        message: "常驻插件 " + id + " 已" + (res.enabled ? "启用" : "禁用") + (res.applyError ? "(仅持久化,未实时生效)" : "(已实时应用)") + "。",
      };
    },
  }));

  // TCT(Temp Chat Tool):一次性临时对话,单段反馈;可选预设/权限;调用后即焚
  tools.register(defineTool({
    name: "det_tct",
    description: "调用 TCT(Temp Chat Tool)做一次性的临时对话:输入一段简短提示词、可选预设 TCT system prompt 名称(如 review/summary/format/brainstorm)与权限控制指令(允许的工具)。TCT 专用 system prompt 会与提示词拼接后交给所选模型(可在 DET 设置内选 TCT 模型),返回单段 feedback;调用结束后该临时对话即销毁,无持久化。适合轻量/一次性/低成本的辅助问答。",
    parameters: {
      prompt: { type: "string", required: true, description: "简短的提示词(本次临时对话要做的事)。" },
      preset: { type: "string", description: "可选:预设名 review/summary/format/brainstorm;缺省通用。" },
      permissions: { type: "string", description: "可选:允许使用的工具(白名单指令);缺省不调用工具。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          feedback: { type: "string", required: true },
          model: { type: "string", required: true },
          message: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.message + "\n" + value.feedback }],
    },
    async execute(args) {
      const res = await service.tctRun({
        prompt: String((args && args.prompt) || ""),
        ...args && args.preset ? { preset: String(args.preset) } : {},
        ...args && args.permissions ? { permissions: String(args.permissions) } : {},
      });
      if (!res.ok) throw new Error(res.error || "TCT 调用失败");
      return { feedback: res.feedback, model: res.model, message: "TCT 反馈(模型 " + res.model + ",临时对话已销毁):" };
    },
  }));

  // CDM(CrossDialogueMemory):跨对话读取/搜索对话段
  tools.register(defineTool({
    name: "cdm_list",
    description: "列出可读取的对话(侧边栏登记簿):id/标题/工作区/是否隐藏/最近活跃。用于在跨对话读取或搜索前了解有哪些对话可选。",
    parameters: {},
    output: { schema: { type: "object", additionalProperties: false, properties: {
      count: { type: "number", required: true },
      sessions: { type: "array", required: true, items: { type: "string" } },
    } }, render: (_a, v) => [{ type: "text", text: "可读取对话 " + v.count + " 个(按最近活跃):\n" + v.sessions.join("\n") }] },
    async execute() {
      const res = await service.cdmList({});
      if (!res.ok) throw new Error(res.error || "读取失败");
      const lines = res.sessions.map((s) => "• " + (s.title || "(无标题)") + "  [" + s.id + (s.hidden ? " · 隐藏" : "") + "]  " + new Date(s.updatedAt).toLocaleString());
      return { count: res.sessions.length, sessions: lines };
    },
  }));

  tools.register(defineTool({
    name: "cdm_search",
    description: "跨对话搜索与某些内容有关的对话段(CrossDialogueMemory)。传入 query(要匹配的内容/关键词)。默认(非提权)只搜索【当前工作区】内的会话;cross=true 为提权,可跨工作区搜索;也可传 sessionIds 精确限定范围。返回命中的对话段(sessionId/seq/role/text)。用于在合适时机获取相关记忆/上下文。",
    parameters: {
      query: { type: "string", required: true, description: "要匹配的内容或关键词。" },
      limit: { type: "number", description: "可选:返回条数上限(默认 8,≤20)。" },
      cross: { type: "boolean", description: "可选:提权跨工作区搜索(true 时忽略当前工作区限制;优先级低于 sessionIds)。" },
      sessionIds: { type: "array", items: { type: "string" }, description: "可选:精确限定搜索的会话 id 列表(最高优先级)。" },
    },
    output: { schema: { type: "object", additionalProperties: false, properties: {
      total: { type: "number", required: true },
      segments: { type: "array", required: true, items: { type: "string" } },
    } }, render: (_a, v) => [{ type: "text", text: "命中 " + v.total + " 段:\n" + v.segments.join("\n") }] },
    async execute(args, exec) {
      const agent = exec && exec.agent;
      const currentSessionId = agent && agent.id ? String(agent.id) : "";
      const res = await service.cdmSearch({
        query: String((args && args.query) || ""),
        ...args && typeof args.limit === "number" ? { limit: args.limit } : {},
        ...args && Array.isArray(args.sessionIds) ? { sessionIds: args.sessionIds } : {},
        ...args && args.cross === true ? { cross: true } : {},
        ...currentSessionId ? { currentSessionId } : {},
      });
      if (!res.ok) throw new Error(res.error || "搜索失败");
      const lines = res.segments.map((s) => "[" + s.sessionId + " · #" + s.seq + " · " + s.role + "] " + s.text.replace(/\n+/g, " ").slice(0, 300));
      return { total: res.total, segments: lines };
    },
  }));

  tools.register(defineTool({
    name: "cdm_read",
    description: "读取某对话的片段(CrossDialogueMemory)。传入 sessionId(来自 cdm_list / cdm_search),可选 seq 或 messageId 定位,limit 控制窗口大小;返回该位置的对话段(seq/role/text)。",
    parameters: {
      sessionId: { type: "string", required: true, description: "对话(会话)id。" },
      seq: { type: "number", description: "可选:定位到该 seq 附近。" },
      messageId: { type: "string", description: "可选:定位到该消息附近。" },
      limit: { type: "number", description: "可选:返回段数(默认 12,≤40)。" },
    },
    output: { schema: { type: "object", additionalProperties: false, properties: {
      sessionId: { type: "string", required: true },
      segments: { type: "array", required: true, items: { type: "string" } },
    } }, render: (_a, v) => [{ type: "text", text: "会话 " + v.sessionId + " 片段:\n" + v.segments.join("\n") }] },
    async execute(args) {
      const res = await service.cdmRead({
        sessionId: String((args && args.sessionId) || ""),
        ...args && typeof args.seq === "number" ? { seq: args.seq } : {},
        ...args && args.messageId ? { messageId: String(args.messageId) } : {},
        ...args && typeof args.limit === "number" ? { limit: args.limit } : {},
      });
      if (!res.ok) throw new Error(res.error || "读取失败");
      const lines = res.segments.map((s) => "[" + (s.role || "?") + " #" + s.seq + "] " + s.text.replace(/\n+/g, " ").slice(0, 500));
      return { sessionId: res.sessionId, segments: lines };
    },
  }));

  // MDA 分层:区域列表 / 模型介绍 / 模型合作
  tools.register(defineTool({
    name: "mda_list_areas",
    description: "列出当前 MDA 分组模式(native/workspace/model)与所有分支模型区域(名称/工作区/插件清单/成员会话)。用于了解分组结构。",
    parameters: {},
    output: { schema: { type: "object", additionalProperties: false, properties: {
      mode: { type: "string", required: true },
      areas: { type: "array", required: true, items: { type: "string" } },
    } }, render: (_a, v) => [{ type: "text", text: "MDA 模式 = " + v.mode + "\n" + v.areas.join("\n") }] },
    async execute() {
      const res = await service.mdaGet({});
      if (!res.ok) throw new Error(res.error || "读取失败");
      const lines = res.areas.map((a) => "• " + a.name + "  [" + a.id + "]  workshop=" + (a.workspace || "-") + "  plugins=" + (a.pluginSet.length) + "  members=" + (a.memberSessions.length));
      return { mode: res.mode, areas: lines };
    },
  }));

  tools.register(defineTool({
    name: "mda_card",
    description: "为某个模型(会话)生成/更新「模型介绍」(用途/配置/工具/最近在做什么),用 TCT 生成并存入 MDA。传入 sessionId(缺省为当前会话)。供模型合作时其它模型参考。",
    parameters: { sessionId: { type: "string", description: "可选:目标会话 id;缺省当前会话。" } },
    output: { schema: { type: "object", additionalProperties: false, properties: {
      sessionId: { type: "string", required: true },
      intro: { type: "string", required: true },
      message: { type: "string", required: true },
    } }, render: (_a, v) => [{ type: "text", text: v.message + "\n" + v.intro }] },
    async execute(args, exec) {
      const agent = exec && exec.agent;
      const sessionId = (args && args.sessionId ? String(args.sessionId) : "") || (agent && agent.id ? String(agent.id) : "");
      const res = await service.mdaCard({ sessionId });
      if (!res.ok) throw new Error(res.error || "生成失败");
      return { sessionId: res.sessionId, intro: res.intro, message: "模型介绍(" + res.sessionId + ",模型 " + res.model + "):" };
    },
  }));

  tools.register(defineTool({
    name: "mda_activate",
    description: "激活其它模型(模型组合作):传入目标会话(targetSessionId,代表一个模型)与一段提示词;会读取目标模型的介绍,再用目标模型的模型路由复用一个隐藏子会话并提交提示词(类似 VTD 分叉)。⚠ 不鼓励常规使用——每次激活都会新建会话、消耗提示词。",
    parameters: {
      targetSessionId: { type: "string", required: true, description: "目标模型(会话)id,来自 mda_list_areas / cdm_list。" },
      prompt: { type: "string", required: true, description: "要交给目标模型的任务/提示词。" },
    },
    output: { schema: { type: "object", additionalProperties: false, properties: {
      targetSessionId: { type: "string", required: true },
      childSessionId: { type: "string", required: true },
      intro: { type: "string" },
      message: { type: "string", required: true },
    } }, render: (_a, v) => [{ type: "text", text: v.message + (v.intro ? "\n目标模型介绍:\n" + v.intro : "") }] },
    async execute(args) {
      const res = await service.mdaActivate({
        targetSessionId: String((args && args.targetSessionId) || ""),
        prompt: String((args && args.prompt) || ""),
      });
      if (!res.ok) throw new Error(res.error || "激活失败");
      return { targetSessionId: res.targetSessionId, childSessionId: res.childSessionId, ...res.intro ? { intro: res.intro } : {}, message: "已激活模型 " + res.targetSessionId + "(子会话 " + res.childSessionId + ")" + (res.submitted ? ",已提交任务" : ",提交失败") + ";" + res.note };
    },
  }));

  // 模型提示(简短;档位语义已在各工具描述内)
  const sp = ctx.get("systemPrompt");
  if (sp && typeof sp.section === "function") {
    sp.section({
      name: "tool:det-global-plugins",
      order: 116,
      text: "# DET 全局插件\n\nDET 维护一个进程级「全局插件库」:每个插件有名称、描述与五个档位(全局启用 always / 对话AI可自行决定启用 ai-auto / 对话内AI需审批启用 ai-approve / 不再会有新启用 frozen / 全局禁用 disabled),你可以在对话内通过 det_global_plugin_list / det_global_plugin_enable / det_global_plugin_disable 按档位启用或停用。det_global_plugin_scan_installed 可扫描「已安装的永久宿主插件」(如 dbs,自动排除 DET 管理器本身),再用 det_global_plugin_import_installed 一键纳入全局插件库以便管理。对 DBS 这类跨会话常驻插件,用 det_global_plugin_set_enabled 做二分「启用/禁用」(实时经 loader 卸载/装载,且跨重启持久化;完成后前端自动刷新以生效)。启用前先 list 查看档位;等待审批时(awaiting-approval)不要重试;被拒绝(frozen/disabled)后不要再请求。全局插件代码与动态 Cordis 插件一样在当前进程执行,拥有真实权限。\n\nTCT(Temp Chat Tool):det_tct 做一次性的临时对话(低成本),传入简短 prompt + 可选 preset(review/summary/format/brainstorm)+ 权限控制;返回单段 feedback,调用后临时对话即销毁、无持久化。TCT 模型可在 DET 设置内选择。\n\nCDM(CrossDialogueMemory):跨对话记忆——cdm_list 列出可读取对话;cdm_search 搜索与某内容有关的对话段(默认限定当前工作区;cross=true 提权可跨工作区);cdm_read 读取某对话的片段。在合适时机获取相关记忆/上下文(会消耗提示词,按需使用)。\n\nMDA 分层:设置「MDA」分组(原生/工作区组/模型组)。mda_list_areas 看分组与区域;模型合作(仅模型组):mda_card 为某模型生成模型介绍(用 TCT),mda_activate 激活其它模型(⚠很不鼓励,耗提示词,类似开新会话)。从 GitHub 安装插件有两种方式:① 直接下载 det_global_plugin_github_direct(传入仓库 URL/owner/repo,按约定格式拉取并入库,返回可疑代码扫描警告);② AI 读取源码自行编写 det_global_plugin_github_rebuild(拉取 README 与 host/client 源码,注入安全(病毒/漏洞)检查上下文供你审查,你对照后自行实现等价版本,再用 det_global_plugin_github_save 入库)。方式二不直接执行第三方代码,更安全但要自行保证语义等价。",
    });
  }
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
  registerGlobalPluginTools(ctx, service);
  return service;
}

export { Config, EssentialToolsService, apply, inject, name, safeHttpUrl, safeVersionId, isPrivateHostname };
export default { name, inject, Config, apply };

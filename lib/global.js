// dsh-essential-tools — 全局插件控制(DET 全局插件库)
// 域:dsh_global_plugins (v1) — 表:
//   plugins      : 全局插件记录(id/名称/描述/五档控制/host+client 代码/来源/AI 摘要/各会话启用映射)
//   store_cache  : 应用商店 AI 摘要缓存(key = repo@branch, 避免重复消耗 token)
// 档位语义(见 README):
//   always    全局启用           — 每个会话自动挂载,不区分发起方
//   ai-auto   对话AI可自行决定启用 — AI 请求直接执行(宿主直跑 + 客户端自动批准)
//   ai-approve对话内AI需审批启用   — AI 请求进入动态 Cordis 审批流程,用户批准后生效
//   frozen    不再会有新启用      — 拒绝一切新启用(包括用户),已启用会话保持运行
//   disabled  全局禁用           — 立即停止所有实例并拒绝任何启用
// 安全口径:全局插件代码与动态 Cordis 插件一致,拥有当前进程权限。

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** storage-domain 域名。 */
const DOMAIN_NAME = "dsh_global_plugins";

/** 五档级别。 */
const LEVELS = ["always", "ai-auto", "ai-approve", "frozen", "disabled"];

/** 级别显示名(中文,host/客户端/工具共享)。 */
const LEVEL_LABELS = {
  always: "全局启用",
  "ai-auto": "对话AI可自行决定启用",
  "ai-approve": "对话内AI需审批启用",
  frozen: "不再会有新启用",
  disabled: "全局禁用",
};

/** 来源类型。 */
const ORIGIN_KINDS = ["cordis", "url", "github"];

/** 代码单侧大小上限(字符)。 */
const CODE_MAX = 512 * 1024;
/** 描述/名称上限。 */
const NAME_MAX = 200;
const DESC_MAX = 2000;

/** 域声明(v1)。 */
const DOMAIN_SPEC = defineDomain({
  name: DOMAIN_NAME,
  version: 1,
  tables: {
    plugins: domainTable(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().default(""),
      level: z.enum(LEVELS),
      host: z.string().optional(),
      client: z.string().optional(),
      originKind: z.enum(ORIGIN_KINDS),
      originRef: z.string().default(""),
      summary: z.string().optional(),
      summaryAt: z.number().optional(),
      // 各会话启用映射:key = sessionId;pluginId/packageId 为宿主 Cordis 运行时身份。
      // state: enabled=已运行成功;pending=AI 请求已定义、等待审批(不可自动恢复)。
      sessions: z.record(z.object({
        pluginId: z.string(),
        packageId: z.string(),
        enabledAt: z.number(),
        by: z.string().default("user"),
        state: z.enum(["enabled", "pending"]).default("enabled"),
      })).default({}),
      createdAt: z.number(),
      updatedAt: z.number(),
    })),
    store_cache: domainTable(z.object({
      key: z.string(),
      summary: z.string(),
      at: z.number(),
    })),
  },
});

/** 校验级别值,非法返回 null。 */
function normalizeLevel(level) {
  if (typeof level !== "string") return null;
  return LEVELS.indexOf(level) >= 0 ? level : null;
}

/** 从名称/来源生成 idPrefix(3-6 个小写字母,动态 Cordis 要求)。 */
function idPrefixOf(id, name) {
  const src = String(id || name || "det").toLowerCase().replace(/[^a-z]/g, "");
  // 取前 6 个连续字母;不足 3 时补 det。
  let p = src.length > 6 ? src.slice(0, 6) : src;
  if (p.length < 3) p = (p + "det").slice(0, 6);
  return p || "det";
}

/** 简单哈希(仅用于判断代码是否变化,非安全用途)。 */
function hashOf(text) {
  let h1 = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  return h1.toString(16);
}

/** 规范全局插件 id:统一 "gp-<body>";输入可带任何个数的 "gp-" 前缀(兼容旧数据)。 */
function gpIdOf(input) {
  const raw = String((input && input.id) || "").replace(/[^A-Za-z0-9_-]/g, "");
  let body = raw.replace(/^gp-/, "").replace(/^gp-/, "");
  if (body === "" || body.length < 3) {
    body = String((input && input.name) || "p").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  }
  if (body === "") body = hashOf((input && input.name || "p") + Date.now()).slice(0, 20);
  return "gp-" + body.slice(0, 40);
}

/**
 * 全局插件库:域的打开/读写 + 档位策略。
 * 与 VTD 一样,宿主 storageDomain 不可用时安全降级(所有端点返回 ok:false + error)。
 */
export class GlobalPluginStore {
  constructor(ctx) {
    this.ctx = ctx;
    this.domain = null;
    this.openError = null;
    this.opening = null;
    this._open();
  }

  async _open() {
    const sd = this.ctx.get("storageDomain");
    if (!sd || typeof sd.open !== "function") {
      this.openError = "storageDomain 服务不可用(全局插件库不可用)";
      return;
    }
    try {
      const domain = await sd.open(DOMAIN_SPEC);
      this.domain = domain;
      this.ctx.effect(() => () => domain.close(), "dsh-global-plugins: close domain");
    } catch (e) {
      this.openError = String(e && e.message ? e.message : e);
    }
  }

  async _ready() {
    if (this.domain !== null || this.openError !== null) return;
    await this._open();
  }

  /** 域不可用时的统一错误。 */
  async _unavailable() {
    await this._ready();
    if (this.domain === null) return { ok: false, error: this.openError || "全局插件库不可用" };
    return null;
  }

  /** 读取全部插件(按创建时间排序)。 */
  async list() {
    const un = await this._unavailable();
    if (un) return un;
    try {
      const rows = await this.domain.table("plugins").all();
      const out = rows.sort((a, b) => a.createdAt - b.createdAt);
      return { ok: true, plugins: out };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** 读取单条。 */
  async get(id) {
    const un = await this._unavailable();
    if (un) return un;
    try {
      const row = await this.domain.table("plugins").get(id);
      if (!row) return { ok: false, error: "插件不存在: " + id };
      return { ok: true, plugin: row };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** 写入(整条覆盖)。 */
  async put(record) {
    const un = await this._unavailable();
    if (un) return un;
    try {
      await this.domain.table("plugins").put(record.id, record);
      return { ok: true, plugin: record };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** 删除。 */
  async del(id) {
    const un = await this._unavailable();
    if (un) return un;
    try {
      await this.domain.table("plugins").delete(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** AI 摘要缓存读取。 */
  async cacheGet(key) {
    const un = await this._unavailable();
    if (un) return un;
    try {
      const row = await this.domain.table("store_cache").get(key);
      return { ok: true, entry: row || null };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** AI 摘要缓存写入。 */
  async cachePut(key, summary) {
    const un = await this._unavailable();
    if (un) return un;
    try {
      await this.domain.table("store_cache").put(key, { key, summary, at: Date.now() });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  /** 新建一条记录(名称/描述/代码校验)。 */
  async create(input) {
    const un = await this._unavailable();
    if (un) return un;
    const name = typeof input.name === "string" ? input.name.trim().slice(0, NAME_MAX) : "";
    if (name === "") return { ok: false, error: "缺少插件名称" };
    const description = typeof input.description === "string" ? input.description.trim().slice(0, DESC_MAX) : "";
    const code = input.code || {};
    const host = typeof code.host === "string" && code.host.trim() !== "" ? code.host : undefined;
    const client = typeof code.client === "string" && code.client.trim() !== "" ? code.client : undefined;
    if (!host && !client) return { ok: false, error: "插件缺少代码(host/client 至少其一)" };
    if (host && host.length > CODE_MAX) return { ok: false, error: "host 代码超过大小上限" };
    if (client && client.length > CODE_MAX) return { ok: false, error: "client 代码超过大小上限" };
    let level = normalizeLevel(input.level);
    if (!level) level = "ai-approve"; // 默认:对话内AI需审批启用
    const now = Date.now();
    const id = gpIdOf(input);
    const record = {
      id,
      name,
      description,
      level,
      ...host === undefined ? {} : { host },
      ...client === undefined ? {} : { client },
      originKind: input.originKind && ORIGIN_KINDS.indexOf(input.originKind) >= 0 ? input.originKind : "url",
      originRef: String(input.originRef || ""),
      ...typeof input.summary === "string" && input.summary.trim() !== "" ? { summary: input.summary.trim().slice(0, 4000) } : {},
      ...typeof input.summary === "string" && input.summary.trim() !== "" ? { summaryAt: now } : {},
      sessions: input.sessions && typeof input.sessions === "object" ? input.sessions : {},
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.put(record);
    return saved.ok ? { ok: true, plugin: saved.plugin } : saved;
  }

  /** 更新名称/描述/级别/摘要。 */
  async updateMeta(id, patch) {
    const un = await this._unavailable();
    if (un) return un;
    const got = await this.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    if (typeof patch.name === "string" && patch.name.trim() !== "") rec.name = patch.name.trim().slice(0, NAME_MAX);
    if (typeof patch.description === "string") rec.description = patch.description.trim().slice(0, DESC_MAX);
    if (typeof patch.summary === "string") rec.summary = patch.summary.trim().slice(0, 4000);
    if (typeof patch.summary === "string") rec.summaryAt = Date.now();
    if (patch.level !== undefined) {
      const level = normalizeLevel(patch.level);
      if (!level) return { ok: false, error: "非法档位: " + String(patch.level) };
      rec.level = level;
    }
    rec.updatedAt = Date.now();
    return this.put(rec);
  }

  /**
   * 创建或更新(upsert):已存在时保留 档位/各会话启用映射(防止重复导入清空运行状态),
   * 仅更新 名称/描述/代码/来源/摘要。
   */
  async upsert(input) {
    const un = await this._unavailable();
    if (un) return un;
    let id = gpIdOf(input);
    let existing = await this.get(id);
    // 兼容旧数据:早期 create() 会把 "gp-x" 再叠一层前缀存成 "gp-gp-x"。
    if (!existing.ok && input && input.id) {
      const legacy = "gp-" + String(input.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      const alt = await this.get(legacy);
      if (alt.ok) { id = legacy; existing = alt; }
    }
    if (existing.ok) {
      const rec = existing.plugin;
      const code = input.code || {};
      const host = typeof code.host === "string" && code.host.trim() !== "" ? code.host : undefined;
      const client = typeof code.client === "string" && code.client.trim() !== "" ? code.client : undefined;
      if (!host && !client) return { ok: false, error: "插件缺少代码(host/client 至少其一)" };
      if (host && host.length > CODE_MAX) return { ok: false, error: "host 代码超过大小上限" };
      if (client && client.length > CODE_MAX) return { ok: false, error: "client 代码超过大小上限" };
      rec.name = typeof input.name === "string" && input.name.trim() !== "" ? input.name.trim().slice(0, NAME_MAX) : rec.name;
      rec.description = typeof input.description === "string" ? input.description.trim().slice(0, DESC_MAX) : rec.description;
      rec.host = host;
      rec.client = client;
      if (input.originKind && ORIGIN_KINDS.indexOf(input.originKind) >= 0) rec.originKind = input.originKind;
      if (typeof input.originRef === "string" && input.originRef !== "") rec.originRef = input.originRef;
      if (typeof input.summary === "string" && input.summary.trim() !== "") {
        rec.summary = input.summary.trim().slice(0, 4000);
        rec.summaryAt = Date.now();
      }
      rec.updatedAt = Date.now();
      return this.put(rec);
    }
    return this.create(Object.assign({}, input, { id: id }));
  }

  /** 记录某会话已启用(pending=等待审批,enabled=运行成功)。 */
  async markSession(id, sessionId, pluginId, packageId, by, state) {
    const got = await this.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    rec.sessions = Object.assign({}, rec.sessions);
    rec.sessions[sessionId] = {
      pluginId, packageId, enabledAt: Date.now(),
      by: String(by || "user"),
      state: state === "pending" ? "pending" : "enabled",
    };
    rec.updatedAt = Date.now();
    return this.put(rec);
  }

  /** 仅更新某会话条目状态(不改其它字段)。 */
  async setSessionState(id, sessionId, state) {
    const got = await this.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    if (!rec.sessions || !rec.sessions[sessionId]) return { ok: true, plugin: rec };
    rec.sessions = Object.assign({}, rec.sessions);
    rec.sessions[sessionId] = Object.assign({}, rec.sessions[sessionId], {
      state: state === "pending" ? "pending" : "enabled",
    });
    rec.updatedAt = Date.now();
    return this.put(rec);
  }

  /** 取消某会话启用标记。 */
  async unmarkSession(id, sessionId) {
    const got = await this.get(id);
    if (!got.ok) return got;
    const rec = got.plugin;
    if (!rec.sessions || !rec.sessions[sessionId]) return { ok: true, plugin: rec };
    rec.sessions = Object.assign({}, rec.sessions);
    delete rec.sessions[sessionId];
    rec.updatedAt = Date.now();
    return this.put(rec);
  }

  /**
   * 档位策略:给定级别与发起方,得出动作。
   * by: 'user'(设置页手动) | 'ai'(对话内 AI 工具) | 'auto'(自动/恢复)
   * verb: 'run'(直接执行) | 'request-auto'(执行但客户端自动批准) | 'request'(需用户审批) | 'refuse'(拒绝)
   */
  static policy(level, by) {
    switch (level) {
      case "always":
        return { verb: "run" };
      case "ai-auto":
        return by === "ai" ? { verb: "request-auto" } : { verb: "run" };
      case "ai-approve":
        return by === "ai" ? { verb: "request" } : { verb: "run" };
      case "frozen":
        // 豁免:auto 仅用于"已有启用记录的恢复",由调用方在 allowed 之外检查。
        return by === "auto" ? { verb: "refuse", reason: "frozen-recovery-check" } : { verb: "refuse", reason: "frozen" };
      case "disabled":
        return { verb: "refuse", reason: "disabled" };
      default:
        return { verb: "refuse", reason: "unknown-level" };
    }
  }

  /** 拒绝理由的人话文案。 */
  static refuseText(reason, level) {
    if (reason === "frozen") return "该插件处于「不再会有新启用」档位:拒绝一切新启用(已启用会话保持运行)。可在全局插件管理中修改档位。";
    if (reason === "disabled") return "该插件处于「全局禁用」档位:无法启用。可在全局插件管理中修改档位。";
    return "该插件当前档位不允许此启用请求。";
  }
}

/** 可疑代码特征扫描(黑名单尽力而为;白名单/沙箱仍是真正边界——见 SECURITY 说明)。 */
const SUSPICIOUS_PATTERNS = [
  { re: /new\s+Function|eval\s*\(/i, label: "eval / new Function(动态求值)" },
  { re: /child_process|child_process\b/i, label: "child_process(进程执行)" },
  { re: /require\s*\(\s*["'](node:)?child_process|execFile|exec\s*\(/i, label: "exec / execFile" },
  { re: /process\.env/i, label: "process.env(读取环境变量)" },
  { re: /process\.mainModule|require\.main|module\.constructor/i, label: "require 逃逸" },
  { re: /\bnet\s*\.|dgram\s*\.|http\.request|https\.request|new\s+WebSocket/im, label: "原始网络 socket / http.request" },
  { re: /globalThis\.fetch|window\.fetch|\bfetch\s*\(/i, label: "fetch(网络请求)" },
  { re: /document\.cookie|localStorage|sessionStorage/i, label: "浏览器 Cookie / 存储(仅 client 半区合法场所)" },
  { re: /atob\s*\(|btoa\s*\(|Buffer\.from\s*\([^,]*,\s*["']base64/i, label: "base64 解码(常见混淆手法)" },
  { re: /gtag|google-analytics|umami|posthog|sentry|telemetry|analytics/i, label: "遥测 / 统计上报" },
  { re: /sk-[A-Za-z0-9]{16,}/, label: "疑似硬编码 API Key(sk-...)" },
];
/** 对 host/client 代码做可疑特征扫描,返回 [{half,label}] 列表(尽力而为,不构成安全边界)。 */
function scanCodeWarnings(code) {
  const hits = [];
  const sources = [];
  if (code && typeof code.host === "string" && code.host.trim() !== "") sources.push({ label: "host", text: code.host });
  if (code && typeof code.client === "string" && code.client.trim() !== "") sources.push({ label: "client", text: code.client });
  for (const src of sources) {
    for (const p of SUSPICIOUS_PATTERNS) {
      if (p.re.test(src.text)) hits.push({ half: src.label, label: p.label });
    }
    const lines = src.text.split("\n");
    for (const line of lines) {
      if (line.replace(/\s/g, "").length > 1200) {
        hits.push({ half: src.label, label: "单行过长(疑似压缩/混淆代码): " + line.replace(/\s/g, "").length + " 字符" });
        break;
      }
    }
  }
  return hits;
}

export { LEVELS, LEVEL_LABELS, ORIGIN_KINDS, normalizeLevel, idPrefixOf, hashOf, gpIdOf, scanCodeWarnings, DOMAIN_NAME };

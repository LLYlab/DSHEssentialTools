// dsh-essential-tools — VTD(虚拟对话存储系统)核心模块(重建版)
// 虚拟对话树 = 父会话日志中 conversation/link 事件的派生(树边),内容 = 各叉真实子会话的日志(经原系统读写)。
// VTD 域只存"元数据":小版本(工作区自动快照)、会话侧边栏登记簿(存在性数据,非对话本体)、DET 功能开关与自检记录。
// 树本身不落域(日志即事实源)。
//
// 域版本:保持 2(不弹版本不迁移)。v2 仅声明 minor_versions;本次在同一版本内新增 sessions/settings 两张表——
// json 后端按"声明表名 → 介质表"逐表加载,介质缺少的新表为空表,未改变的 minor_versions 记录原样重验,无需迁移。

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** storage-domain 域名。 */
const DOMAIN_NAME = "dsh_versions";
/** 小版本快照的存放前缀(相对工作区)。 */
const MINOR_PREFIX = ".lval-versions\\.minor";

/** 域声明(v2 兼容扩展:minor_versions + sessions + settings)。 */
const DOMAIN_SPEC = defineDomain({
  name: DOMAIN_NAME,
  version: 2,
  tables: {
    minor_versions: domainTable(z.object({
      id: z.string(),
      sessionId: z.string(),
      forkId: z.string().optional(),
      kind: z.enum(["edit", "retry", "reply", "baseline", "auto-switch"]),
      time: z.number(),
      snapshotDir: z.string(),
      fileCount: z.number(),
      note: z.string().optional(),
    })),
    // 会话侧边栏登记簿:存在的对话(侧边栏)数据——只存"存在性/元数据",绝不存对话本体(消息永远在 DSH 会话日志)。
    // key = sessionId。
    sessions: domainTable(z.object({
      id: z.string(),
      title: z.string().default(""),
      cwd: z.string().default(""),
      parentSession: z.string().nullable().default(null),
      origin: z.string().default(""),
      hidden: z.boolean().default(false),
      createdAt: z.number(),
      updatedAt: z.number(),
      lastSeq: z.number().default(-1),
      activeBranchId: z.string().default("trunk"),
    })),
    // 插件级偏好与自检记录:key 可为 "det.features"(功能开关)或 "det.registry.check"(最近一次自检报告)。
    settings: domainTable(z.object({
      key: z.string(),
      value: z.unknown(),
    })),
  },
});

/** 新小版本 id。 */
function mintMinorId() {
  return "m" + String(Date.now()) + String(Math.floor(Math.random() * 1000));
}

/**
 * VTD 核心:域的打开/读写 + 虚拟对话树派生。
 * 树边 = 会话日志的 conversation/link 事件(每个 branchId 取最后一次事件的 state)。
 */
export class VtdStore {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.domain = null;
    this.openError = null;
    this.opening = null;
    this._open();
  }

  async _open() {
    const sd = this.ctx.get("storageDomain");
    if (!sd || typeof sd.open !== "function") {
      this.openError = "storageDomain 服务不可用(VTD 元数据不可用)";
      return;
    }
    try {
      const domain = await sd.open(DOMAIN_SPEC);
      this.domain = domain;
      this.ctx.effect(() => () => domain.close(), "vtd: close dsh_versions domain");
    } catch (e) {
      this.openError = String(e && e.message ? e.message : e);
    }
  }

  async _ready() {
    if (this.domain !== null || this.openError !== null) return;
    await this._open();
  }

  async _unavailable() {
    await this._ready();
    if (this.domain === null) return { ok: false, error: this.openError || "VTD 存储域不可用" };
    return null;
  }

  // ── 虚拟对话树派生(纯函数)────────────────────────────────────────────

  /**
   * 从一个会话的事件列派生"本会话直接分出的叉"。
   * @param events - 该会话的完整事件列(live 或冷读)。
   * @returns {forks, activeBranchId} — forks 按 createdAt 升序;activeBranchId 为唯一 active 分支或 'trunk'。
   */
  static deriveTree(events) {
    const byBranch = new Map();
    for (const ev of events || []) {
      if (!ev || ev.type !== "conversation/link") continue;
      const d = ev.data;
      if (!d || typeof d.branchId !== "string") continue;
      byBranch.set(d.branchId, {
        branchId: d.branchId,
        pivotSeq: typeof d.pivotSeq === "number" ? d.pivotSeq : -1,
        forkBoundary: typeof d.forkBoundary === "number" ? d.forkBoundary : undefined,
        childSessionId: typeof d.childSessionId === "string" ? d.childSessionId : "",
        kind: d.kind || "reply",
        state: d.state === "active" ? "active" : "superseded",
        createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
        label: typeof d.label === "string" ? d.label : "",
      });
    }
    const forks = [...byBranch.values()].sort((a, b) => a.createdAt - b.createdAt);
    const active = forks.find((f) => f.state === "active");
    return { forks, activeBranchId: active ? active.branchId : "trunk" };
  }

  /** 某会话在指定 pivot(消息 seq)处的叉列表 + trunk(用于 <N> 选择器)。 */
  static forksAt(events, pivotSeq) {
    const { forks } = VtdStore.deriveTree(events);
    return forks.filter((f) => f.pivotSeq === pivotSeq);
  }

  // ── 小版本(自动版本控制)──────────────────────────────────────────────

  /** 记录一条小版本。 */
  async recordMinor(sessionId, forkId, kind, snapshotDir, fileCount, note) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const id = mintMinorId();
    const record = {
      id,
      sessionId,
      kind,
      time: Date.now(),
      snapshotDir,
      fileCount,
    };
    if (forkId) record.forkId = forkId;
    if (note) record.note = note;
    await this.domain.table("minor_versions").put(id, record);
    return { ok: true, id, ...record };
  }

  /** 某会话(或全部)的小版本列表。 */
  async listMinor(sessionId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const out = [];
    for (const [, rec] of this.domain.table("minor_versions").entries()) {
      if (sessionId && rec.sessionId !== sessionId) continue;
      out.push({ id: rec.id, sessionId: rec.sessionId, forkId: rec.forkId || null, kind: rec.kind, time: rec.time, snapshotDir: rec.snapshotDir, fileCount: rec.fileCount, note: rec.note || "" });
    }
    out.sort((a, b) => b.time - a.time);
    return { ok: true, versions: out };
  }

  /** 某 fork 的最新小版本。 */
  async minorOfFork(forkId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    let found = null;
    for (const [, rec] of this.domain.table("minor_versions").entries()) {
      if (rec.forkId === forkId && (found === null || rec.time > found.time)) found = rec;
    }
    return { ok: true, rec: found };
  }

  // ── 会话侧边栏登记簿(存在性数据,非对话本体)──────────────────────────

  /** 记录/更新一条会话登记(存在一个会话的事实)。 */
  async upsertSession(record) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const id = typeof record === "object" && record !== null && typeof record.id === "string" ? record.id : "";
    if (id === "") return { ok: false, error: "会话登记缺少 id" };
    await this.domain.table("sessions").put(id, record);
    return { ok: true };
  }

  /** 读取一条会话登记。 */
  async getSession(id) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const rec = this.domain.table("sessions").get(id);
    return { ok: true, record: rec || null };
  }

  /** 删除一条会话登记。 */
  async deleteSession(id) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const removed = await this.domain.table("sessions").delete(id);
    return { ok: true, removed };
  }

  /** 全部会话登记(按 updatedAt 降序)。 */
  async listSessions() {
    const bad = await this._unavailable();
    if (bad) return bad;
    const out = [];
    for (const [, rec] of this.domain.table("sessions").entries()) {
      out.push({
        id: rec.id,
        title: rec.title || "",
        cwd: rec.cwd || "",
        parentSession: rec.parentSession ?? null,
        origin: rec.origin || "",
        hidden: rec.hidden === true,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        lastSeq: typeof rec.lastSeq === "number" ? rec.lastSeq : -1,
        activeBranchId: rec.activeBranchId || "trunk",
      });
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return { ok: true, sessions: out };
  }

  /** 打开下一轮写链(供不落盘的内存辅助)。 */
  async countSessions() {
    const bad = await this._unavailable();
    if (bad) return bad;
    return { ok: true, count: this.domain.table("sessions").size };
  }

  // ── 插件级偏好/自检记录(settings)────────────────────────────────────

  /** 写一条设置(覆盖整条记录)。 */
  async setSetting(key, value) {
    const bad = await this._unavailable();
    if (bad) return bad;
    await this.domain.table("settings").put(key, { key, value });
    return { ok: true };
  }

  /** 读一条设置。 */
  async getSetting(key) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const rec = this.domain.table("settings").get(key);
    return { ok: true, value: rec ? rec.value : undefined };
  }

  /** 全部设置。 */
  async listSettings() {
    const bad = await this._unavailable();
    if (bad) return bad;
    const out = [];
    for (const [key, rec] of this.domain.table("settings").entries()) {
      out.push({ key, value: rec.value });
    }
    out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return { ok: true, settings: out };
  }
}

export { DOMAIN_NAME, DOMAIN_SPEC, MINOR_PREFIX, mintMinorId };

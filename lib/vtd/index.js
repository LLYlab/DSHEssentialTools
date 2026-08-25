// dsh-essential-tools — VTD(虚拟对话存储系统)核心模块(重建版)
// 虚拟对话树 = 父会话日志中 conversation/link 事件的派生(树边),内容 = 各叉真实子会话的日志(经原系统读写)。
// VTD 域只存"小版本"(工作区自动快照)与版本绑定;树本身不落域(日志即事实源)。

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** storage-domain 域名。 */
const DOMAIN_NAME = "dsh_versions";
/** 小版本快照的存放前缀(相对工作区)。 */
const MINOR_PREFIX = ".lval-versions\\.minor";

/** 域声明(v2: 小版本)。 */
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
}

export { DOMAIN_NAME, DOMAIN_SPEC, MINOR_PREFIX, mintMinorId };

// dsh-essential-tools — VTD（虚拟对话存储系统）核心模块
// VTD = 插件 Host 半区内的虚拟覆盖层：
//   - 只存虚拟层元数据（分支/开关/消息版本），不存对话本体（会话日志是唯一事实源）
//   - 经 DSH storage-domain（backend json → ~/.dsh/storages/dsh_versions.json）落盘
//   - 对外由 lib/index.js 的 EssentialToolsService 暴露为 dshEssentialTools/* 端点
//
// 数据模型（域 dsh_versions, version 1）：
//   branches:       {branchId, sessionId, parentBranchId?, anchorSeq, label, ranges[{from,to}], createdAt, active}
//   message_versions {id, sessionId, messageId, branchId?, versionIndex, cause, content, replacedSeqs[], time}  ← M2 使用
//   settings:       {key, value}（rollbackTarget: 'minor' | 'original'）
//
// 分支语义：会话日志线性追加；分支 = 锚点 seq + 消息 seq 区间集合（ranges）。
//   切换分支 = 置 active；分支活跃期间新追加的事件 seq 并入该分支 ranges（session/event 监听）。

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** storage-domain 域名（须匹配 /^[a-z][a-z0-9_]*$/）。 */
const DOMAIN_NAME = "dsh_versions";
/** 开关默认值：回退消息时回到最近小版本。 */
const DEFAULT_ROLLBACK_TARGET = "minor";

/** 域声明：版本化，升级改 version 并提供迁移。 */
const DOMAIN_SPEC = defineDomain({
  name: DOMAIN_NAME,
  version: 1,
  tables: {
    branches: domainTable(z.object({
      branchId: z.string(),
      sessionId: z.string(),
      parentBranchId: z.string().optional(),
      anchorSeq: z.number(),
      label: z.string(),
      ranges: z.array(z.object({ from: z.number(), to: z.number() })),
      createdAt: z.number(),
      active: z.boolean(),
    })),
    message_versions: domainTable(z.object({
      id: z.string(),
      sessionId: z.string(),
      messageId: z.string(),
      branchId: z.string().optional(),
      versionIndex: z.number(),
      cause: z.enum(["original", "edit", "regenerate", "rollback"]),
      content: z.any(),
      replacedSeqs: z.array(z.number()),
      time: z.number(),
    })),
    settings: domainTable(z.object({
      key: z.string(),
      value: z.string(),
    })),
  },
});

/** 新分支 id 生成。 */
function mintBranchId() {
  return "b" + String(Date.now()) + String(Math.floor(Math.random() * 1000));
}

/** 从会话事件里按消息 id 找 seq（user/message: data.id；assistant/message: data.message.id；tool/result: data.id）。 */
function findMessageSeq(session, messageId) {
  if (!session || typeof messageId !== "string" || messageId === "") return -1;
  let events;
  try {
    events = session.events;
  } catch (e) {
    return -1;
  }
  if (!Array.isArray(events)) return -1;
  for (const ev of events) {
    if (!ev || typeof ev.seq !== "number" || !ev.data || typeof ev.data !== "object") continue;
    if (ev.data.id === messageId) return ev.seq;
    if (ev.data.message && typeof ev.data.message === "object" && ev.data.message.id === messageId) return ev.seq;
  }
  return -1;
}

/**
 * VTD 核心：域的打开/读写、分支操作、开关、事件区间追踪。
 */
export class VtdStore {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.domain = null;
    this.openError = null;
    this.opening = null;
    // sessionId -> activeBranchId 缓存（避免每个事件扫表）
    this.activeBySession = new Map();
    // 内存回退开关（域不可用时降级）
    this.memoryToggle = null;
    this._open();
  }

  async _open() {
    const sd = this.ctx.get("storageDomain");
    if (!sd || typeof sd.open !== "function") {
      this.openError = "storageDomain 服务不可用（VTD 元数据不可用）";
      return;
    }
    try {
      const domain = await sd.open(DOMAIN_SPEC);
      this.domain = domain;
      this.ctx.effect(() => () => domain.close(), "vtd: close dsh_versions domain");
      // 恢复各会话活跃分支
      const table = domain.table("branches");
      for (const [branchId, rec] of table.entries()) {
        if (rec && rec.active === true) this.activeBySession.set(rec.sessionId, branchId);
      }
    } catch (e) {
      this.openError = String(e && e.message ? e.message : e);
    }
  }

  /** 等待域打开完成（幂等）。 */
  async _ready() {
    if (this.domain !== null || this.openError !== null) return;
    await this._open();
  }

  /** 域不可用时返回错误对象；可用返回 null。 */
  async _unavailable() {
    await this._ready();
    if (this.domain === null) return { ok: false, error: this.openError || "VTD 存储域不可用" };
    return null;
  }

  // ── 分支 ────────────────────────────────────────────────────────────────

  async branchList(sessionId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const out = [];
    const table = this.domain.table("branches");
    for (const [branchId, rec] of table.entries()) {
      if (rec.sessionId !== sessionId) continue;
      out.push({
        branchId,
        anchorSeq: rec.anchorSeq,
        parentBranchId: rec.parentBranchId || null,
        label: rec.label || "",
        ranges: rec.ranges,
        createdAt: rec.createdAt,
        active: rec.active === true,
      });
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return { ok: true, branches: out };
  }

  async branchCreate(sessionId, messageId, label, resolveSeq) {
    const bad = await this._unavailable();
    if (bad) return bad;
    if (typeof sessionId !== "string" || sessionId === "") return { ok: false, error: "缺少会话 id" };
    const anchorSeq = typeof resolveSeq === "function" ? resolveSeq(messageId) : -1;
    if (!Number.isSafeInteger(anchorSeq) || anchorSeq < 0) return { ok: false, error: "无法定位消息（会话未加载或消息不存在）" };
    const branchId = mintBranchId();
    const record = {
      branchId,
      sessionId,
      anchorSeq,
      label: typeof label === "string" ? label.slice(0, 60) : "",
      ranges: [],
      createdAt: Date.now(),
      active: false,
    };
    await this.domain.table("branches").put(branchId, record);
    return { ok: true, branchId, anchorSeq };
  }

  async branchSwitch(sessionId, branchId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    if (typeof sessionId !== "string" || sessionId === "" || typeof branchId !== "string" || branchId === "") {
      return { ok: false, error: "缺少会话或分支 id" };
    }
    const table = this.domain.table("branches");
    const target = table.get(branchId);
    if (!target || target.sessionId !== sessionId) return { ok: false, error: "分支不存在或不属于该会话" };
    // 清除同会话其它活跃分支
    for (const [id, rec] of table.entries()) {
      if (rec.sessionId === sessionId && rec.active === true && id !== branchId) {
        await table.put(id, { ...rec, active: false });
      }
    }
    await table.put(branchId, { ...target, active: true });
    this.activeBySession.set(sessionId, branchId);
    return { ok: true, branchId };
  }

  async branchDelete(sessionId, branchId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const table = this.domain.table("branches");
    const rec = table.get(branchId);
    if (!rec || rec.sessionId !== sessionId) return { ok: false, error: "分支不存在或不属于该会话" };
    if (rec.active === true) this.activeBySession.delete(sessionId);
    await table.delete(branchId);
    return { ok: true };
  }

  /** 分支活跃期间新事件并入活跃分支 ranges（线性日志 → 区间标记）。 */
  async onSessionEvent(session, event) {
    const branchId = this.activeBySession.get(session && session.id);
    if (branchId === undefined || this.domain === null || !event || typeof event.seq !== "number") return;
    const table = this.domain.table("branches");
    const rec = table.get(branchId);
    if (!rec || rec.active !== true) {
      this.activeBySession.delete(session && session.id);
      return;
    }
    const ranges = Array.isArray(rec.ranges) ? rec.ranges.slice() : [];
    const last = ranges[ranges.length - 1];
    if (last !== undefined && last.to === event.seq - 1) {
      const extended = { from: last.from, to: event.seq };
      ranges[ranges.length - 1] = extended;
    } else {
      ranges.push({ from: event.seq, to: event.seq });
    }
    await this.domain.table("branches").put(branchId, { ...rec, ranges });
  }

  // ── 消息小版本（M2）──────────────────────────────────────────────────────

  /** 记录一条消息的一个内容快照（versionIndex = max+1；首次为 0）。 */
  async recordVersion(sessionId, messageId, cause, content, replacedSeqs, branchId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const table = this.domain.table("message_versions");
    let maxIndex = -1;
    for (const [, rec] of table.entries()) {
      if (rec.sessionId === sessionId && rec.messageId === messageId && rec.versionIndex > maxIndex) maxIndex = rec.versionIndex;
    }
    const record = {
      id: "v" + String(Date.now()) + String(Math.floor(Math.random() * 1000)),
      sessionId,
      messageId,
      versionIndex: maxIndex + 1,
      cause,
      content,
      replacedSeqs: Array.isArray(replacedSeqs) ? replacedSeqs : [],
      time: Date.now(),
    };
    if (branchId !== undefined) record.branchId = branchId;
    await table.put(record.id, record);
    return { ok: true, versionIndex: record.versionIndex, id: record.id };
  }

  /** 某消息的全部版本（按 versionIndex 升序）。 */
  async listVersions(sessionId, messageId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const out = [];
    for (const [, rec] of this.domain.table("message_versions").entries()) {
      if (rec.sessionId === sessionId && rec.messageId === messageId) {
        out.push({
          id: rec.id,
          versionIndex: rec.versionIndex,
          cause: rec.cause,
          content: rec.content,
          time: rec.time,
          branchId: rec.branchId || null,
        });
      }
    }
    out.sort((a, b) => a.versionIndex - b.versionIndex);
    return { ok: true, versions: out };
  }

  /** 有版本记录的消息汇总（版本面板用）。 */
  async listMessagesWithVersions(sessionId) {
    const bad = await this._unavailable();
    if (bad) return bad;
    const byMessage = new Map();
    for (const [, rec] of this.domain.table("message_versions").entries()) {
      if (rec.sessionId !== sessionId) continue;
      const list = byMessage.get(rec.messageId) || [];
      list.push(rec);
      byMessage.set(rec.messageId, list);
    }
    const out = [];
    for (const [messageId, list] of byMessage) {
      list.sort((a, b) => a.versionIndex - b.versionIndex);
      out.push({
        messageId,
        versionCount: list.length,
        latest: list[list.length - 1],
        first: list[0],
        versions: list.map((rec) => ({ id: rec.id, versionIndex: rec.versionIndex, cause: rec.cause, content: rec.content, time: rec.time })),
      });
    }
    return { ok: true, messages: out };
  }

  /** 取指定版本。 */
  async getVersion(sessionId, messageId, versionIndex) {
    const bad = await this._unavailable();
    if (bad) return bad;
    let found = null;
    for (const [, rec] of this.domain.table("message_versions").entries()) {
      if (rec.sessionId === sessionId && rec.messageId === messageId && rec.versionIndex === versionIndex) { found = rec; break; }
    }
    if (!found) return { ok: false, error: "版本不存在" };
    return { ok: true, version: { id: found.id, versionIndex: found.versionIndex, cause: found.cause, content: found.content, time: found.time } };
  }

  // ── 开关（回退目标）──────────────────────────────────────────────────────

  async getToggle() {
    const bad = await this._unavailable();
    if (bad) return { ok: true, target: this.memoryToggle || this.config.rollbackTargetDefault || DEFAULT_ROLLBACK_TARGET };
    try {
      const rec = this.domain.table("settings").get("rollbackTarget");
      return { ok: true, target: rec && rec.value ? rec.value : this.config.rollbackTargetDefault || DEFAULT_ROLLBACK_TARGET };
    } catch (e) {
      return { ok: true, target: this.config.rollbackTargetDefault || DEFAULT_ROLLBACK_TARGET };
    }
  }

  async setToggle(target) {
    if (target !== "minor" && target !== "original") return { ok: false, error: "target 必须是 minor 或 original" };
    this.memoryToggle = target;
    const bad = await this._unavailable();
    if (bad) return { ok: true, target };
    try {
      await this.domain.table("settings").put("rollbackTarget", { key: "rollbackTarget", value: target });
    } catch (e) { /* 域写失败仍返回 ok（内存已生效） */ }
    return { ok: true, target };
  }
}

export { DEFAULT_ROLLBACK_TARGET, DOMAIN_NAME, DOMAIN_SPEC, findMessageSeq, mintBranchId };

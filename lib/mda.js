// dsh-essential-tools — MDA 分层(Mixing Dialogue Agent)
// 域:dsh_mda (v1)
//   global      : 当前 MDA 分组模式 native / workspace / model
//   areas       : 分支模型区域(id/name/workspace/pluginSet/memberSessions)
//   model_cards : 每个模型(会话)的「模型介绍」(TCT 生成;用途/配置/工具/当前在做什么)
// 作用域语义(见设计评审):
//   native    原生分组   —— 行为与现在一致
//   workspace 工作区组   —— 侧边栏按 工作区→分支模型区域→会话 分组;区域共享 CDM 记忆 + 插件清单
//   model     模型组     —— 同工作区组,另允许模型合作(mda_activate)
// 提权:cdm_search/cdm_read 默认限定「当前工作区」;cross=true 提权可跨工作区。

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

/** MDA 域名。 */
const DOMAIN_NAME = "dsh_mda";

/** 分组模式。 */
const MODES = ["native", "workspace", "model"];

/** 域声明(v1)。 */
const DOMAIN_SPEC = defineDomain({
  name: DOMAIN_NAME,
  version: 1,
  global: { schema: z.enum(MODES), initial: "native" },
  tables: {
    areas: domainTable(z.object({
      id: z.string(),
      name: z.string(),
      workspace: z.string().default(""),
      pluginSet: z.array(z.string()).default([]),
      memberSessions: z.array(z.string()).default([]),
      createdAt: z.number(),
      updatedAt: z.number(),
    })),
    model_cards: domainTable(z.object({
      sessionId: z.string(),
      intro: z.string(),
      at: z.number(),
    })),
  },
});

/** 校验模式,非法返回 null。 */
function normalizeMode(mode) {
  if (typeof mode !== "string") return null;
  return MODES.indexOf(mode) >= 0 ? mode : null;
}

/** MDA 存储:域的打开/读写。与 VTD/全局插件库一样,宿主 storageDomain 不可用时安全降级。 */
export class MdaStore {
  constructor(ctx) {
    this.ctx = ctx;
    this.domain = null;
    this.openError = null;
    this.opening = null;
    this._open();
  }

  async _open() {
    if (this.opening) return this.opening;
    const sd = this.ctx.get("storageDomain");
    if (!sd || typeof sd.open !== "function") {
      this.openError = "storageDomain 服务不可用(MDA 不可用)";
      return;
    }
    this.opening = (async () => {
      try {
        const domain = await sd.open(DOMAIN_SPEC);
        this.domain = domain;
        this.ctx.effect(() => () => domain.close(), "dsh-mda: close domain");
      } catch (e) {
        this.openError = String(e && e.message ? e.message : e);
      } finally {
        this.opening = null;
      }
    })();
    return this.opening;
  }

  async _ready() {
    if (this.domain !== null || this.openError !== null) return;
    await this._open();
  }

  async _unavailable() {
    await this._ready();
    if (this.domain === null) return { ok: false, error: this.openError || "MDA 不可用" };
    return null;
  }

  /** 当前分组模式。 */
  async getMode() {
    const un = await this._unavailable();
    if (un) return un;
    try { return { ok: true, mode: this.domain.global.get() }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 设置分组模式。 */
  async setMode(mode) {
    const un = await this._unavailable();
    if (un) return un;
    const m = typeof mode === "string" ? MODES.indexOf(mode) >= 0 ? mode : null : null;
    if (!m) return { ok: false, error: "非法 MDA 模式: " + String(mode) };
    try { await this.domain.global.set(m); return { ok: true, mode: m }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 全部区域(按创建时间排序)。 */
  async listAreas() {
    const un = await this._unavailable();
    if (un) return un;
    try {
      const rows = [...this.domain.table("areas").entries()].map((entry) => entry[1]);
      rows.sort((a, b) => a.createdAt - b.createdAt);
      return { ok: true, areas: rows };
    } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 写入一个区域。 */
  async putArea(rec) {
    const un = await this._unavailable();
    if (un) return un;
    try { await this.domain.table("areas").put(rec.id, rec); return { ok: true, area: rec }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 删除一个区域。 */
  async delArea(id) {
    const un = await this._unavailable();
    if (un) return un;
    try { await this.domain.table("areas").delete(id); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 读取某模型(会话)的模型介绍。 */
  async getCard(sessionId) {
    const un = await this._unavailable();
    if (un) return un;
    try { return { ok: true, card: this.domain.table("model_cards").get(sessionId) || null }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }

  /** 写入某模型(会话)的模型介绍。 */
  async putCard(sessionId, intro) {
    const un = await this._unavailable();
    if (un) return un;
    try { await this.domain.table("model_cards").put(sessionId, { sessionId, intro, at: Date.now() }); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  }
}

export { MODES, normalizeMode, DOMAIN_NAME };

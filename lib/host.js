// dsh-essential-tools — 宿主能力层（Host capability layer）
//
// DET 是「版本感知」插件：同一个源码包在旧宿主（DSH 0.1.1-rc.2）与
// 新宿主（DSH 0.1.5-rc.1）上都能跑，并对两者呈现不同行为：
//
//   · 新宿主已原生完善支持的功能 → DET 卸载自己的实现（见 featuresFor()）
//   · 新宿主原生不完善处         → DET 改进/接管（优先接管 slot 与渲染）
//   · 旧宿主                     → 保留 DET 全部既有能力
//
// 判定原则：**一律做能力探测，不硬编码版本号**。宿主在 0.1.1→0.1.5 之间
// 连跳三条线（0.1.2/0.1.3/0.1.5），任何中间版本都可能落在任意组合上；
// 只有「这个 API 现在在不在」是可靠判据。版本号仅用于诊断展示。
//
// 本文件是全部版本差异的唯一归属地：其余模块只读 HOST 上的布尔/枚举，
// 不再自行做 !! 判断。

/**
 * 宿主能力快照的字段说明（全部为布尔，除 formatVersion/formatLabel）：
 *
 * 会话日志读取
 *   sessionEventsGetter  —— 旧式 `Session#events` 数组可读（0.1.2-alpha.4 移除）
 *   sessionSnapshotEvents—— `Session#snapshotEvents()` 半开区间快照
 *   sessionOwnEvents     —— `Session#ownEvents()`（排除 fork 继承前缀）
 *   sessionEventAt       —— `Session#eventAt(seq)`
 *   sessionSeq           —— `Session#seq` 日志长度（新旧皆有，新宿主为 O(1) 首选）
 *
 * 持久化
 *   handlePersistence    —— `create/open` 返回 SessionHandle（0.1.3-alpha.1 起）
 *   legacyPersistence    —— `load(id)` / `create(meta)` / `append(id, events)`（已移除）
 *
 * 会话头
 *   headerOriginSubagentOnly —— `SessionHeader.origin` 仅接受 'subagent'，
 *                               不能再承载 'vtd-fork'（否则该会话无法被读回）
 *   headerIsSeeded          —— 头字段用 `isSeeded` + `inheritedEventCount`
 *                              取代 `seedLength`
 *
 * 会话存储
 *   storeFork            —— `ctx.sessions.fork(source, boundary, childId)`
 *                           （新旧皆有；注意它创建的是**活**会话，DET 的冷叉子
 *                            仍走持久化层，故此能力仅供增强路径使用）
 */

/** 能力快照的默认值：全部按「旧宿主」保守取值，探测到再逐项放开。 */
function emptyCaps() {
  return {
    probed: false,
    // 会话日志读取
    sessionEventsGetter: false,
    sessionSnapshotEvents: false,
    sessionOwnEvents: false,
    sessionEventAt: false,
    sessionSeq: false,
    // 持久化
    handlePersistence: false,
    legacyPersistence: false,
    serviceFaceProbed: false,
    // 会话头
    headerOriginSubagentOnly: false,
    headerIsSeeded: false,
    // 会话存储
    storeFork: false,
    // 诊断
    formatVersion: null,
    sessionPkgFound: false,
  };
}

/** 已探测的能力快照（进程级缓存；宿主能力在进程生命周期内不会变）。 */
let cached = null;

/**
 * 探测宿主能力。幂等：首次调用后缓存。
 *
 * 分三层探测，任一层失败都不影响其余层：
 *   1. 模块面 —— 动态 import `@deepseek-ai/dsh-session`，直接看 `Session.prototype`
 *      上有没有对应方法。这是最可靠的判据：不依赖任何服务已就绪。
 *   2. 服务面 —— 经 ctx 取 sessionPersistence / sessions，看实例方法。
 *   3. 派生   —— modern / legacy 归类。
 *
 * @param {object} [ctx] - Cordis 上下文；缺省时只做模块面探测。
 * @returns {Promise<object>} 能力快照（同一对象引用，勿修改）。
 */
export async function probeHost(ctx) {
  if (cached) return cached;
  const caps = emptyCaps();

  // ── 1. 模块面 ────────────────────────────────────────────────────────
  try {
    const sessionMod = await import("@deepseek-ai/dsh-session");
    caps.sessionPkgFound = !!sessionMod;
    const proto = sessionMod && sessionMod.Session ? sessionMod.Session.prototype : null;
    if (proto) {
      caps.sessionSnapshotEvents = typeof proto.snapshotEvents === "function";
      caps.sessionOwnEvents = typeof proto.ownEvents === "function";
      caps.sessionEventAt = typeof proto.eventAt === "function";
      // seq 是 getter（定义在原型上的访问器），不是普通方法。
      caps.sessionSeq = typeof Object.getOwnPropertyDescriptor(proto, "seq") === "object";
      // eventsGetter：旧宿主把 events 定义为原型访问器；新宿主已整个移除。
      caps.sessionEventsGetter = typeof Object.getOwnPropertyDescriptor(proto, "events") === "object";
    }
    if (sessionMod && typeof sessionMod.SESSION_FORMAT_VERSION === "number") {
      caps.formatVersion = sessionMod.SESSION_FORMAT_VERSION;
    }
  } catch (e) { /* 模块不可达：保持保守默认 */ }

  // ── 2. 服务面 ────────────────────────────────────────────────────────
  const getSvc = (name) => {
    try { return ctx && typeof ctx.get === "function" ? ctx.get(name) : null; } catch (e) { return null; }
  };
  try {
    const persistence = getSvc("sessionPersistence");
    if (persistence) {
      caps.handlePersistence = typeof persistence.open === "function";
      caps.legacyPersistence = typeof persistence.load === "function";
      // 服务面探测成功才让能力层对「持久化形态」有权威结论。
      // apply() 阶段该服务常常尚未就绪，此时必须回落到实例鸭子类型，
      // 否则会把新版宿主误判成旧版并走错分支。
      caps.serviceFaceProbed = true;
    }
  } catch (e) { /* ignore */ }
  try {
    const sessions = getSvc("sessions");
    caps.storeFork = !!sessions && typeof sessions.fork === "function";
  } catch (e) { /* ignore */ }

  // ── 3. 派生判定 ──────────────────────────────────────────────────────
  // 会话头规则的推断：`isSeeded` + `inheritedEventCount` 与
  // `origin` 收紧到 'subagent' 同属 0.1.2-alpha.4 那次会话头重写，
  // 故以 snapshotEvents 的出现作为两者的共同信号。
  // 运行时仍以「写入失败即回退」兜底（见 index.js 的 createSeededSession）。
  caps.headerIsSeeded = caps.sessionSnapshotEvents;
  caps.headerOriginSubagentOnly = caps.sessionSnapshotEvents;

  // 若服务面不可用（apply 阶段服务尚未就绪），以模块面为准则已足够；
  // 只有模块面也失败时才需要调用方稍后重试。
  caps.modern = caps.sessionSnapshotEvents;
  caps.legacy = !caps.modern;
  caps.probed = caps.sessionPkgFound;
  if (caps.probed) cached = caps;
  return caps;
}

/**
 * 强制重新探测（例如 apply 阶段服务未就绪、拿到 live 会话后想补测服务面）。
 * 仅清缓存；下次 probeHost() 重新取。
 */
export function resetHostProbe() { cached = null; }

/** 取得已缓存的能力快照；未探测时返回保守默认（不触发探测）。 */
export function hostCaps() { return cached || emptyCaps(); }

/**
 * 面向诊断/前端展示的能力摘要（不含函数，可直接 JSON 序列化）。
 * @returns {object} 版本走廊标签 + 关键能力布尔。
 */
export function hostSummary() {
  const c = hostCaps();
  const corridor = c.legacy
    ? "legacy (≤0.1.1-rc.2)"
    : (c.formatVersion === 3 ? "modern (≥0.1.5)" : "modern (0.1.2~0.1.3)");
  return {
    corridor,
    formatVersion: c.formatVersion,
    sessionEventsGetter: c.sessionEventsGetter,
    sessionSnapshotEvents: c.sessionSnapshotEvents,
    handlePersistence: c.handlePersistence,
    legacyPersistence: c.legacyPersistence,
    headerOriginSubagentOnly: c.headerOriginSubagentOnly,
    headerIsSeeded: c.headerIsSeeded,
    storeFork: c.storeFork,
  };
}

// ── 功能归属登记表 ──────────────────────────────────────────────────────
//
// 每个 DET 功能在新宿主上的处置。key 与 DET 管理器的功能开关键一一对应
// （`det.features` 存储，见 client.js 的 detFeatures 默认表）。
//
// verdict 语义：
//   'keep'                —— 新宿主无对应原生能力，DET 保留（新旧一致）
//   'enhance-native'      —— 新宿主有原生实现但不完善 → DET 改进/接管，
//                            优先接管原生 slot 与渲染（红线：最后手段才改 DSH 包内文件）
//   'uninstall-on-modern' —— 新宿主已原生完善支持 → 新宿主上卸载 DET 自己的实现，
//                            旧宿主仍按 'keep' 保留
//
// ⚠ 判定为『新宿主已完善支持』属产品判断，是**推断**而非宿主事实。
//   集中在下面一处，作者改这里即可整体调整，不必翻遍代码。

/** @type {ReadonlyArray<{key:string,label:string,nativeIn:string,verdict:string,note:string}>} */
export const FEATURE_REGISTRY = Object.freeze([
  {
    key: "file", label: "文件浏览",
    nativeIn: "0.1.5 右侧 Sidebar：多标签文件树 + Markdown/代码/HTML/PDF/图片预览 + 默认应用打开 + 文件管理器定位",
    verdict: "uninstall-on-modern",
    note: "原生已覆盖树浏览与多类型预览，DET 的 🗎 属重复实现。",
  },
  {
    key: "vtd", label: "VTD 对话树",
    nativeIn: "消息级 branch 按钮 + SessionStore.fork(source,boundary,childId) + fork 错误码体系",
    verdict: "enhance-native",
    note: "原生只有单点分叉，缺完整树视图与编辑/重试/<N> 分支选择 → DET 保留树视图，并接管原生 branch 按钮把它接进 VTD。",
  },
  {
    key: "plugins", label: "全局插件管理",
    nativeIn: "Settings → Plugins 插件清单/面板 + dsh plugin CLI",
    verdict: "enhance-native",
    note: "原生只有清单级能力，缺五档门禁/GitHub 直装/商店四源/会话级启停 → 保留并改进。",
  },
  {
    key: "run", label: "运行（LVAL 编译/运行）",
    nativeIn: "无",
    verdict: "keep",
    note: "工程专有，宿主无对应物。",
  },
  {
    key: "ver", label: "版本（快照/回退）",
    nativeIn: "无",
    verdict: "keep",
    note: "宿主有会话检查点策略，但无程序版本快照/回退。",
  },
  {
    key: "mda", label: "MDA 分层 / 模型合作",
    nativeIn: "Workspaces（原生）",
    verdict: "keep",
    note: "原生按工作区分组，无跨对话分层/模型卡片/模型激活语义。",
  },
  {
    key: "approve", label: "审批",
    nativeIn: "permission presets + approval policy（原生）",
    verdict: "keep",
    note: "维度不同，不构成重复。",
  },
  {
    key: "mms", label: "MMS 混合模型",
    nativeIn: "模型选择 + 子代理模型选择（原生）",
    verdict: "keep",
    note: "原生模型选择面向子代理，不提供「把低难度子问题委派给便宜模型」的工具面。",
  },
  {
    key: "secCmdAudit", label: "AI 命令审计",
    nativeIn: "无对应机制",
    verdict: "keep",
    note: "宿主有沙箱与 SSRF 防护，但无「每次工具调用前跑一次独立模型审计」。",
  },
  {
    key: "secPromptDefense", label: "Prompt 攻击防御",
    nativeIn: "无对应机制",
    verdict: "keep",
    note: "同上。",
  },
]);

/**
 * 按当前宿主能力解析出每个功能键的最终状态。
 *
 * @param {object} [caps] - 能力快照；缺省取已缓存的 HOST。
 * @returns {{[key:string]: 'active'|'uninstalled'|'enhanced'}} 功能键 → 状态。
 *   active      —— DET 实现照常运行（含旧宿主上的一切功能）
 *   uninstalled —— DET 在新宿主上已卸载该实现（管理器中应显示为「原生已提供」）
 *   enhanced    —— DET 在新宿主上改进/接管了原生实现
 */
export function featuresFor(caps) {
  const c = caps || hostCaps();
  const out = {};
  for (const f of FEATURE_REGISTRY) {
    if (c.legacy || f.verdict === "keep") out[f.key] = "active";
    else if (f.verdict === "uninstall-on-modern") out[f.key] = "uninstalled";
    else out[f.key] = "enhanced";
  }
  return out;
}


// dsh-essential-tools — 宿主服务接入层（Host service access layer）
//
// 为什么需要这一层：
//   DET 的 Host 半区要跨 DSH 0.1.1-rc.2 ↔ 0.1.5-rc.1 跑，而它依赖十多个宿主服务
//   （loader / llm / agents / sessionPersistence / systemPrompt …）。此前这些服务名
//   作为字符串字面量散落在 4700 行的 index.js 里，共 50 处 —— 宿主一旦改名、改签名
//   或让某个服务变为可选，就得全文搜改，且漏一处只有运行时才炸。
//
// 本层的两条纪律：
//   1. **服务名唯一归属地**：所有服务名集中到 SERVICE 表。宿主改名只改这里。
//   2. **取用永不抛出**：`svc()` 把 `ctx.get()` 包成"取值失败/服务缺失/服务自身抛错
//      一律返回 undefined"，调用方按既有鸭子类型兜底即可。这是 DET「单一子能力失败
//      不得拖垮整体」的基础设施。
//
// 与 host.js 的分工：
//   host.js  —— 宿主**能力**探测（API 在不在：snapshotEvents / handlePersistence …）
//   adapt.js —— 宿主**服务**接入（服务拿得到、拿不到、有没有某方法）
//
// 注意：本文件只服务 Host 半区。`lib/client.js` 是浏览器 bundle，不做相对导入。

/**
 * 宿主服务名表（唯一归属地）。
 * ⚠ 改这里之前先确认新名字在**旧宿主**上也有，否则会破坏「同一源码包跨版本可跑」。
 */
export const SERVICE = Object.freeze({
  // 插件装载 / 动态 Cordis
  loader: "loader",
  dynamicCordisRunner: "dynamicCordisRunner",
  // 文件与进程
  fs: "fs",
  subprocess: "subprocess",
  // 会话
  sessions: "sessions",
  sessionPersistence: "sessionPersistence",
  sessionTitle: "sessionTitle",
  // 模型与代理
  llm: "llm",
  agents: "agents",
  agentLoop: "agentLoop",
  agentDefaultModel: "agentDefaultModel",
  // 工具与提示词
  tools: "tools",
  systemPrompt: "systemPrompt",
  // 存储与凭据
  storageDomain: "storageDomain",
  credentials: "credentials",
});

/** 供诊断/测试使用：服务名清单（值去重后的数组）。 */
export function serviceNames() {
  return Array.from(new Set(Object.values(SERVICE)));
}

/**
 * 安全取服务。**永不抛出**。
 * @param {object} ctx - Cordis 上下文。
 * @param {string} name - 服务名（建议取 SERVICE.*）。
 * @returns {any|undefined} 服务实例；上下文非法、服务缺失或服务取值抛错时为 undefined。
 */
export function svc(ctx, name) {
  if (!ctx || typeof ctx.get !== "function") return undefined;
  try {
    const value = ctx.get(name);
    return value === null ? undefined : value;
  } catch (e) {
    // Cordis 在服务不可用时可能直接抛错（strict 模式）；对 DET 而言
    // "拿不到"与"还不存在"是同一件事，一律按缺失处理。
    return undefined;
  }
}

/**
 * 取服务并要求它具备指定方法；不满足则返回 undefined。
 * 用于"能力式分流"：有就走增强路径，没有就走既有兜底路径。
 * @param {object} ctx
 * @param {string} name
 * @param {string} method - 必需的方法名。
 */
export function svcWith(ctx, name, method) {
  const service = svc(ctx, name);
  if (!service) return undefined;
  return typeof service[method] === "function" ? service : undefined;
}

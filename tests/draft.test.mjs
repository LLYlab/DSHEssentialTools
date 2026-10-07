/**
 * DET 草图（draft）测试（draft）
 * ====================================================================
 * 用户实测报出的原话是：「自动切换视觉模型居然不是实时检查模型表判定的」。
 * 查下来是**两处**陈旧：
 *
 *   1. **Host 侧拿的是历史模型**：`sessionModelRoute` 只读会话日志里最后一条
 *      `request/header`（= 已经跑过的那一轮的模型）。用户在模型选择器里换了模型后，
 *      会话会先落一条 `model/selection`、会话投影里出现 `pending`，要等下一轮请求才会
 *      被消费 —— 只看 request/header 就永远慢一拍，于是「当前模型能收图」判断错误，
 *      发送时才被宿主以 MODEL_DOES_NOT_SUPPORT_IMAGES 顶回来。
 *      → `liveModelSelection` 优先读投影的 `pending ?? lastUsed`，再退事件日志
 *        （最后一条 model/selection 若晚于最后一条 request/header 就采信它），
 *        最后才退宿主默认模型。
 *   2. **Client 侧复用了挂载那一刻的结论**：`doImport` 拿 `support` 状态当缓存，
 *      画布开着时换模型完全被忽略。→ 每次点「导入」都重新问 Host（源码守卫钉住）。
 *
 * 另外钉住三件「别撒谎 / 别乱写」的事：
 *   · 收不收图只认宿主模型表的 `inputModalities`（拿不到就按「收不了」）；
 *   · 交付失败时如实回报 `imageFailure` / `delivered`，不谎报「已作为图片注入」；
 *   · 草图落盘只允许写进本会话工作区（外部 dir 一律忽略），同名不覆盖。
 *
 *     node <repo>/tests/draft.test.mjs
 */

import { promises as fsp, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DltBridge } from "../lib/dlt-tools.js";

let pass = 0;
const failures = [];
const notes = [];
function ok(cond, label) {
  if (cond) { pass++; return true; }
  failures.push(label);
  return false;
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${label}\n      expected ${e}\n      actual   ${a}`);
}
function section(t) { console.log(`\n-- ${t}`); }

/** 1×1 透明 PNG 的真字节（magic + IHDR + IDAT + IEND），保证过得了魔数校验。 */
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * 假宿主。可注：
 *   events     会话日志（getter 返回的就是它）
 *   projection modelSelection 投影状态（{lastUsed, pending}）
 *   models     provider → [{id}] ；modalities 是 `${provider}/${model}` → 模态数组
 */
function makeBridge(opts = {}) {
  const ctx = {
    get(name) {
      if (name === "sessions") {
        return { get: (id) => (opts.session === false ? null : { id }) };
      }
      if (name === "sessionProjections") {
        if (opts.noProjections === true) return undefined;
        return {
          stateOf: () => (opts.projection === undefined ? undefined : opts.projection),
        };
      }
      if (name === "llm") {
        if (opts.noLlm === true) return undefined;
        return {
          listProviders: () => Object.keys(opts.models || {}).map((id) => ({ id })),
          listModels: async (p) => (opts.models || {})[p] || [],
          resolveModelInfo: async (p, m) => {
            if (opts.infoThrows === true) throw new Error("模型表不可达");
            const key = `${p}/${m}`;
            const mods = (opts.modalities || {})[key];
            if (mods === undefined) throw new Error("未知模型 " + key);
            return { inputModalities: mods };
          },
        };
      }
      if (name === "attachments") {
        if (opts.imageLimits === undefined) return undefined;
        return { imageLimits: { mediaTypes: opts.imageLimits } };
      }
      if (name === "agentDefaultModel") {
        if (!opts.defaultSelection) return undefined;
        return { currentSelection: () => opts.defaultSelection };
      }
      return undefined;
    },
  };
  const work = mkdtempSync(join(tmpdir(), "det-draft-work-"));
  const service = {
    ctx,
    config: { dltPythonEnv: "python312", dltCacheDir: join(tmpdir(), "det-draft-cache") },
    sessionEventsOf: async () => opts.events || [],
    workspaceRoot: async () => (opts.workspace === null ? "" : work),
  };
  return { bridge: new DltBridge(service), work, ctx };
}

// ─────────────────────────────────────────────────────────────
section("liveModelSelection —— 实时（投影 pending）优先，不再拿上一轮的历史当现在");

// 投影 pending 就是「用户刚在模型选择器里换的、下一次请求要用的模型」。
{
  const { bridge } = makeBridge({
    projection: { lastUsed: { provider: "p", model: "old-text" }, pending: { provider: "p", model: "new-vision" } },
    events: [{ type: "request/header", seq: 5, data: { header: { config: { provider: "p", model: "old-text" } } } }],
  });
  const route = await bridge.liveModelSelection("s1");
  eq(route, { provider: "p", model: "new-vision", source: "projection-pending", live: true }, "★ 用投影的 pending（实时），不是 request/header 里的 old-text");
}

// 没有 pending 时用投影的 lastUsed（仍是实时快照，比翻事件日志稳）。
{
  const { bridge } = makeBridge({
    projection: { lastUsed: { provider: "p", model: "used" }, pending: null },
  });
  const route = await bridge.liveModelSelection("s1");
  eq(route.source, "projection-lastUsed", "pending 为空 → 退到投影的 lastUsed");
  eq(route.model, "used", "模型取自 lastUsed");
}

// 投影服务缺失 → 退到事件日志：晚于最后一条 request/header 的 model/selection 要采信。
{
  const { bridge } = makeBridge({
    noProjections: true,
    events: [
      { type: "model/selection", seq: 1, data: { provider: "p", model: "first" } },
      { type: "request/header", seq: 2, data: { header: { config: { provider: "p", model: "ran" } } } },
      { type: "model/selection", seq: 3, data: { provider: "p", model: "switched-after" } },
    ],
  });
  const route = await bridge.liveModelSelection("s1");
  eq(route, { provider: "p", model: "switched-after", source: "event-model-selection", live: true }, "★ 切换发生在最后一次真正跑过的请求之后 → 采信切换（实时）");
}

// 切换发生在旧请求之前 → 那一次请求已经把它消费掉了，应当采信 request/header。
{
  const { bridge } = makeBridge({
    noProjections: true,
    events: [
      { type: "model/selection", seq: 1, data: { provider: "p", model: "switched" } },
      { type: "request/header", seq: 2, data: { header: { config: { provider: "p", model: "ran" } } } },
    ],
  });
  const route = await bridge.liveModelSelection("s1");
  eq(route, { provider: "p", model: "ran", source: "request/header", live: false }, "切换早于该请求 → 用 request/header，并如实标 live=false");
}

// 什么都拿不到 → 宿主默认模型。
{
  const { bridge } = makeBridge({ noProjections: true, defaultSelection: { provider: "d", model: "def" } });
  const route = await bridge.liveModelSelection("s1");
  eq(route, { provider: "d", model: "def", source: "default", live: false }, "投影与日志都拿不到 → 退宿主默认模型");
}

// 真的什么都没有 → 空路由（而不是抛错）。
{
  const { bridge } = makeBridge({ noProjections: true });
  const route = await bridge.liveModelSelection("s1");
  eq(route, { provider: "", model: "", source: null, live: false }, "全空时返回空路由，不抛错");
}

// ─────────────────────────────────────────────────────────────
section("modelAcceptsImages —— 只认模型表的 inputModalities");

{
  const { bridge } = makeBridge({ modalities: { "p/vision": ["text", "image"], "p/text": ["text"] } });
  eq((await bridge.modelAcceptsImages("p", "vision")).images, true, "声明了 image → 收图");
  eq((await bridge.modelAcceptsImages("p", "text")).images, false, "只声明 text → 不收图");
  eq((await bridge.modelAcceptsImages("p", "text")).modalities, ["text"], "如实回报模态表，供界面解释原因");
}
{
  const { bridge } = makeBridge({ noLlm: true });
  const r = await bridge.modelAcceptsImages("p", "m");
  eq({ images: r.images, known: r.known }, { images: false, known: false }, "llm 服务不可用 → 按「收不了」处理且 known=false（宁可存 PNG，也不要发送时才被拒）");
  ok(r.error.indexOf("llm") !== -1, "并说明原因");
}
{
  const { bridge } = makeBridge({ infoThrows: true });
  const r = await bridge.modelAcceptsImages("p", "m");
  eq(r.images, false, "模型表读失败 → 按「收不了」处理");
  ok(r.error.indexOf("模型表不可达") !== -1, "带上真实错误");
}
{
  const { bridge } = makeBridge({ modalities: {} });
  eq((await bridge.modelAcceptsImages("", "")).known, false, "空路由 → known=false");
}

// ─────────────────────────────────────────────────────────────
section("draftSupport —— 把「实时路由 + 模型表 + 附件白名单」合成一个结论");

{
  const { bridge } = makeBridge({
    projection: { lastUsed: null, pending: { provider: "p", model: "text-only" } },
    modalities: { "p/text-only": ["text"] },
  });
  const sup = await bridge.draftSupport({ sessionId: "s1" });
  eq({ images: sup.images, model: sup.model, live: sup.routeLive }, { images: false, model: "text-only", live: true }, "★ 实时模型是纯文本 → images=false（客户端据此走「切到视觉模型」）");
  ok(String(sup.reason).indexOf("inputModalities=text") !== -1, "原因里带上真实模态表");
}
{
  const { bridge } = makeBridge({
    projection: { lastUsed: null, pending: { provider: "p", model: "sees" } },
    modalities: { "p/sees": ["text", "image"] },
  });
  const sup = await bridge.draftSupport({ sessionId: "s1" });
  eq(sup.images, true, "实时模型收图 → images=true");
  eq(sup.modalities, ["text", "image"], "回报模态表");
}
{
  const { bridge } = makeBridge({
    projection: { lastUsed: null, pending: { provider: "p", model: "sees" } },
    modalities: { "p/sees": ["text", "image"] },
    imageLimits: ["text/plain"], // 部署不收 image/png
  });
  const sup = await bridge.draftSupport({ sessionId: "s1" });
  eq({ images: sup.images, png: sup.pngAllowed }, { images: false, png: false }, "模型收图但部署附件白名单不收 image/png → 仍然不当作图片");
  ok(String(sup.reason).indexOf("image/png") !== -1, "并如实说明是附件白名单的问题");
  eq((await makeBridge({ imageLimits: ["image/png"] }).bridge.draftSupport({})).pngAllowed, true, "白名单含 image/png → 放行");
}

// ─────────────────────────────────────────────────────────────
section("draftSave —— 落盘只认合法 PNG，且不许写到工作区之外");

{
  const { bridge, work } = makeBridge({});
  const r = await bridge.draftSave({ sessionId: "s1", dataUrl: "data:image/png;base64," + TINY_PNG_B64, name: "a.png" });
  eq(r.ok, true, "合法 PNG 落盘成功");
  eq(r.cwd, work, "落在本会话工作区");
  ok(String(r.path).indexOf(".dsh-drafts") !== -1, "在 .dsh-drafts 子目录里");
  eq(r.rel, ".dsh-drafts/a.png", "回报工作区相对路径（供模型/输入框使用）");
  ok((await fsp.readFile(r.path)).length > 0, "磁盘上真的有内容");
}
{
  const { bridge } = makeBridge({});
  const r = await bridge.draftSave({ dataUrl: "data:image/png;base64," + Buffer.from("not a png at all").toString("base64") });
  eq(r.ok, false, "非 PNG 被拒（魔数校验）");
  ok(String(r.error).indexOf("PNG") !== -1, "错误里说明只收 PNG");
  eq((await bridge.draftSave({})).ok, false, "缺数据被拒");
}
{
  // 外部 dir：必须被忽略并如实回报（防止把 PNG 写到任意位置）。
  const outside = mkdtempSync(join(tmpdir(), "det-draft-outside-"));
  const { bridge, work } = makeBridge({});
  const r = await bridge.draftSave({ sessionId: "s1", dir: outside, dataUrl: TINY_PNG_B64 });
  eq(r.ok, true, "依然落盘（只是换到默认目录）");
  eq(r.cwd, work, "★ 拒绝外部 dir，落在本会话工作区");
  eq(r.dirIgnored, outside, "并如实回报被忽略的目录");
  ok(String(r.dirIgnoredReason).indexOf("工作区") !== -1, "说明忽略原因");
}
{
  // 同名不覆盖：同秒连画两张要得到两个文件。
  const { bridge } = makeBridge({});
  const a = await bridge.draftSave({ sessionId: "s1", dataUrl: TINY_PNG_B64, name: "same.png" });
  const b = await bridge.draftSave({ sessionId: "s1", dataUrl: TINY_PNG_B64, name: "same.png" });
  eq(a.name, "same.png", "第一张用原名");
  eq(b.name, "same-2.png", "★ 第二张自动改名，不覆盖第一张");
  ok(a.path !== b.path, "两个不同的文件");
}

// ─────────────────────────────────────────────────────────────
section("源码守卫 —— 客户端不得复用挂载时的旧结论");

{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join: pjoin } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(pjoin(here, "..", "lib", "client.js"), "utf8");
  ok(src.indexOf("var withSupport = support") === -1,
    "★ 不再复用挂载那一刻的 support（画布开着时换模型必须立刻被看到）");
  ok(src.indexOf('call("dltDraftSupport"') !== -1 && src.indexOf("不做任何缓存复用") !== -1,
    "每次「导入」都重新问 Host，并在源码里写明原因");
  ok(src.indexOf("dltPickVisionRoute") !== -1, "挑视觉模型的逻辑被抽成一个共用函数（挂载 + 导入两条路一致）");
}

// ─────────────────────────────────────────────────────────────
section("结果");
for (const n of notes) console.log("   · " + n);
if (failures.length === 0) {
  console.log(`\n✅ 全部通过：${pass} 项断言`);
  process.exit(0);
}
console.log(`\n❌ 失败 ${failures.length} 项 / 通过 ${pass} 项`);
for (const f of failures) console.log("   • " + f);
process.exit(1);

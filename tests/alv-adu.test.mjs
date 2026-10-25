/**
 * DET · ALV（辅助线视觉）与 ADU（按需装载）测试
 * ====================================================================
 * 两个新模块的共同风险是「看起来加了、其实没接上」：
 *   · ALV 的引擎路径/OCR 桥路径写错 → 工具列表里照样有 alv_*，一调用才炸；
 *   · ADU 的模块表与真正的注册组对不上 → adu_load 报成功但工具没出现。
 *
 * 所以这里的断言分三层：
 *   1. **模块表契约**（纯数据）：id 唯一、必填字段齐全、可装载集合与 always 标记一致。
 *   2. **源码守卫**：ALV/ADU 必须真的被 index.js 导入、sync、并且走 _aduGroups 记账；
 *      ADU 的 5 个元工具必须真的被注册（否则按需模式没有入口 = 死锁）。
 *   3. **引擎契约**（需要 python312 + 夹具图，缺失就跳过而不是失败）：
 *      跑通 info / grid / edges / annotate / crop 的 JSON 形状，样本缺了不算失败。
 *
 *     node <repo>/tests/alv-adu.test.mjs
 */

import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ADU_MODULES, ADU_MODULE_IDS, ADU_TOOL_NAMES, aduLoadableIds, aduModule, aduFeatureOn, aduToolIndex, ADU_TOOL_INDEX } from "../lib/adu.js";
import { ALV_FEATURE_KEYS, ALV_TOOL_NAMES, alvFeatureOn } from "../lib/alv.js";
import { apply, Config } from "../lib/index.js";

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; return; }
  failures.push(label);
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${label}\n      expected ${e}\n      actual   ${a}`);
}
function section(t) { console.log(`\n-- ${t}`); }

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..");
const indexSrc = readFileSync(join(REPO, "lib", "index.js"), "utf8");
const clientSrc = readFileSync(join(REPO, "lib", "client.js"), "utf8");

// ─────────────────────────────────────────────────────────────
section("ADU 模块表契约");

ok(ADU_MODULES.length >= 6, `模块表至少 6 项（当前 ${ADU_MODULES.length}）`);
eq(new Set(ADU_MODULE_IDS).size, ADU_MODULE_IDS.length, "模块 id 唯一");
eq(ADU_MODULES.filter((m) => !m.title || !m.summary).length, 0, "每个模块都有 title 与 summary");
eq(ADU_MODULES.filter((m) => !m.cost || !m.risk).length, 0, "每个模块都交代了 cost 与 risk");
eq(ADU_MODULES.filter((m) => !Array.isArray(m.tools)).length, 0, "每个模块都有 tools 数组（可为空）");
eq(ADU_MODULES.filter((m) => m.always !== true && m.tools.length === 0).length, 0,
  "可装载模块必须真的会带来工具（否则 adu_load 等于空转）");
ok(aduModule("alv") !== null, "alv 是模块表里的一项");
ok(aduModule("nope") === null, "未知 id 返回 null");

const loadable = aduLoadableIds();
ok(loadable.indexOf("alv") !== -1, "alv 可装载");
ok(loadable.indexOf("dlt") !== -1, "dlt 可装载");
ok(loadable.indexOf("plugins") !== -1, "plugins 可装载");
eq(loadable.filter((id) => (aduModule(id).always === true)).length, 0, "可装载集合里不得混入 always 模块");
eq(ADU_MODULES.filter((m) => m.always === true).length, ADU_MODULES.length - loadable.length,
  "always 模块数 = 总数 − 可装载数");

eq(ADU_TOOL_NAMES, ["adu_list", "adu_describe", "adu_load", "adu_unload", "adu_status", "adu_rememory"], "六个元工具名固定（v2.11 起含 adu_rememory）");
for (const name of ADU_TOOL_NAMES) ok(aduSrcHasTool(name), `adu.js 里注册了 ${name}`);

function aduSrcHasTool(name) {
  const src = readFileSync(join(REPO, "lib", "adu.js"), "utf8");
  return src.indexOf(`name: "${name}"`) !== -1;
}

section("ADU 开关语义");

eq(aduFeatureOn({ master: true, adu: true }), true, "master+adu 开 → 按需模式生效");
eq(aduFeatureOn({ master: false, adu: true }), false, "总开关关 → ADU 不生效");
eq(aduFeatureOn({ master: true, adu: false }), false, "adu 关 → 回到全装");
eq(aduFeatureOn({}), true, "缺省（adu 未声明）→ 默认视为开启");

section("ALV 工具与开关");

eq(ALV_FEATURE_KEYS, ["alv"], "ALV 只有一个功能键");
eq(ALV_TOOL_NAMES.length, 8, "ALV 八件套");
for (const name of ALV_TOOL_NAMES) ok(name.startsWith("alv_"), `${name} 使用 alv_ 前缀`);
eq(alvFeatureOn({ master: true, alv: true }), true, "alv 开 → 生效");
eq(alvFeatureOn({ master: true, alv: false }), false, "alv 关 → 不生效");
eq(alvFeatureOn({ master: false }), false, "总开关关 → 不生效");

section("源码守卫 —— 两个新模块必须真的接进宿主");

ok(indexSrc.indexOf('from "./alv.js"') !== -1, "index.js 导入了 alv.js");
ok(indexSrc.indexOf('from "./adu.js"') !== -1, "index.js 导入了 adu.js");
ok(indexSrc.indexOf("this.alv = new AlvBridge(this)") !== -1, "service 构造了 AlvBridge");
ok(indexSrc.indexOf("this.adu = new AduBridge(this") !== -1, "service 构造了 AduBridge");
ok(indexSrc.indexOf("this._aduGroups = new Map()") !== -1, "ADU 用 _aduGroups 记账（唯一状态源）");
ok(indexSrc.indexOf("_aduIsLazy") !== -1, "存在 _aduIsLazy 判据");
ok(indexSrc.indexOf("if (this._aduIsLazy()) {") !== -1,
  "_loadExtension 在按需模式下必须提前返回（否则等于没按需）");
ok(/if \(this\._aduIsLazy\(\)\) \{[\s\S]{0,400}?return;/.test(indexSrc),
  "提前返回之前仍保留必要注入（网络权限档位提示）");
ok(indexSrc.indexOf('safe(() => this.adu.sync(') !== -1, "ADU 元工具在 _loadExtension 里始终注册");
ok(indexSrc.indexOf("this.alv.dispose()") !== -1, "总开关关闭时 ALV 被撤下");
ok(indexSrc.indexOf('"alv", "adu"') !== -1 || indexSrc.indexOf('"adu"') !== -1, "detFeatureSet 接受 alv/adu 键");
ok(indexSrc.indexOf("_diagPush") !== -1, "存在失败账本（_diagPush）");
for (const ep of ["alvStatus", "aduStatus", "aduSet", "detHealth"]) {
  ok(indexSrc.indexOf(`"${ep}"`) !== -1, `typert 端点 ${ep} 已登记`);
}

section("源码守卫 —— 客户端有对应面板");

for (const cls of ["dset-adu-row", "dset-alv-tools", "dset-alv-chip"]) {
  ok(clientSrc.indexOf("." + cls + "{") !== -1, `样式类 .${cls} 已定义`);
}
ok(clientSrc.indexOf('call("aduStatus"') !== -1, "客户端读了 aduStatus");
ok(clientSrc.indexOf('call("alvStatus"') !== -1, "客户端读了 alvStatus");
ok(clientSrc.indexOf('call("detHealth"') !== -1, "客户端读了 detHealth");
ok(clientSrc.indexOf('["alv", "ALV 辅助线视觉"') !== -1, "alv 已归组（架构守卫）");
ok(clientSrc.indexOf('["adu", "ADU 按需装载"') !== -1, "adu 已归组（架构守卫）");

// ─────────────────────────────────────────────────────────────
section("元工具输出必须是无损 JSON（undefined 会让整次调用被判 invalid）");

{
  // 宿主的工具输出校验 = JSON.parse(JSON.stringify(v)) 深比较。任何一个 undefined
  // 字段都会让「装载成功」被报成 invalid output —— 2.10.0 的 adu_load 就栽在这。
  const lossless = (value) => JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value);
  const aduMod = await import("../lib/adu.js");
  const fakeService = { ctx: { get: () => undefined }, config: {} };
  // 一个"刚装载完、没有任何错误"的桥：最容易产出 undefined 的那种状态。
  const fakeBridge = new aduMod.AduBridge(fakeService, {
    mount: async (id) => ({ ok: true, tools: [`${id}_tool`] }),
    unmount: async () => ({ ok: true }),
    status: () => ({ lazy: true, loaded: { alv: true }, toolsByModule: { alv: ["alv_info"] }, groups: ["alv"] }),
  });
  fakeBridge._features = { master: true, adu: true };
  const aduTools = aduMod.buildAduTools(fakeBridge);
  eq(aduTools.length, 6, "buildAduTools 产出 6 个工具");

  for (const t of aduTools) {
    const args = t.name === "adu_describe"
      ? {}
      : (t.name === "adu_load" || t.name === "adu_unload" ? { id: "alv" } : {});
    let out;
    try {
      out = await t.execute(args, {});
    } catch (error) {
      out = { thrown: String(error && error.message ? error.message : error) };
    }
    ok(out && out.thrown === undefined, `${t.name} 不抛错`);
    ok(lossless(out), `${t.name} 的输出是无损 JSON（无 undefined 字段）`);
  }

  const loadedOut = await aduTools[2].execute({ id: "alv" }, {});
  eq(loadedOut.ok, true, "adu_load 成功路径 ok:true");
  eq(loadedOut.loaded, ["alv"], "adu_load 回传已装载模块");
  ok(loadedOut.results[0].error === undefined, "成功结果不携带 error 键");

  const badOut = await aduTools[2].execute({ id: "nope" }, {});
  eq(badOut.ok, false, "未知模块如实失败");
  ok(typeof badOut.error === "string" && badOut.error.length > 0, "失败时给出可读错误");
}

// ─────────────────────────────────────────────────────────────
section("adu_rememory —— 重新注入工具记忆");

{
  // 索引必须覆盖「模块表里声明的每一个工具」，否则模型拿到的记忆是残缺的。
  const declared = new Set();
  for (const m of ADU_MODULES) for (const t of m.tools) declared.add(t);
  const missing = [...declared].filter((name) => !ADU_TOOL_INDEX[name]);
  eq(missing.length, 0, `每个模块工具都要有索引条目（缺：${missing.join(", ") || "无"}）`);
  const stale = Object.keys(ADU_TOOL_INDEX).filter((name) => !declared.has(name));
  eq(stale.length, 0, `索引里不得有已经不存在的工具（多：${stale.join(", ") || "无"}）`);

  const all = aduToolIndex({ includeAdu: true });
  eq(all.reduce((n, g) => n + g.tools.length, 0), declared.size + ADU_TOOL_NAMES.length,
    "全量索引 = 模块工具 + 元工具");
  let badParams = 0; let badDesc = 0;
  for (const g of all) for (const t of g.tools) {
    if (!(typeof t.params === "string" && t.params.length > 0)) badParams++;
    if (!(typeof t.desc === "string" && t.desc.length >= 6)) badDesc++;
  }
  eq(badParams, 0, "每条索引都有参数摘要");
  eq(badDesc, 0, "每条索引都有一句话说明");

  const alvOnly = aduToolIndex({ modules: ["alv"] });
  eq(alvOnly.length, 1, "按模块筛选只返回该模块");
  eq(alvOnly[0].tools.length, 8, "alv 索引 8 条");

  // 端到端：真跑 rememory，输出必须无损 JSON 且带已装模块。
  const aduMod = await import("../lib/adu.js");
  const bridge = new aduMod.AduBridge({ ctx: { get: () => undefined }, config: {} }, {
    mount: async () => ({ ok: true, tools: [] }),
    unmount: async () => ({ ok: true }),
    status: () => ({ lazy: true, loaded: { alv: true }, toolsByModule: { alv: [] }, groups: ["alv"] }),
  });
  bridge._features = { master: true, adu: true };
  const rememory = aduMod.buildAduTools(bridge).find((t) => t.name === "adu_rememory");
  ok(!!rememory, "adu_rememory 已注册");
  const out = await rememory.execute({}, {});
  eq(out.ok, true, "rememory 成功");
  ok(out.modules.some((m) => m.id === "alv"), "默认带上已装载的 alv");
  ok(out.modules.some((m) => m.id === "adu"), "默认带上 ADU 元工具索引");
  eq(JSON.stringify(JSON.parse(JSON.stringify(out))), JSON.stringify(out), "输出是无损 JSON");
}

section("粘性装载 —— ADU 不主动卸载");

ok(indexSrc.indexOf("_aduPersistMounts") !== -1, "装载后持久化（_aduPersistMounts）");
ok(indexSrc.indexOf('"det.adu.mounted"') !== -1, "持久化键为 det.adu.mounted");
ok(indexSrc.indexOf("_aduRestoreMounts") !== -1, "启动时恢复（_aduRestoreMounts）");
ok(indexSrc.indexOf("this._aduRestoreMounts().catch") !== -1, "按需模式装载扩展后立即恢复上次模块");
ok(indexSrc.indexOf("_applyLoadMode") !== -1, "开关切模式时整体重装（_applyLoadMode）");
ok(clientSrc.indexOf("装载是粘性") !== -1, "管理器里如实说明粘性");
ok(clientSrc.indexOf("adu_rememory") !== -1, "管理器里提示 adu_rememory");
ok(indexSrc.indexOf("_aduEnsure") !== -1, "存在自愈 _aduEnsure");
ok(indexSrc.indexOf("_aduPinByTool") !== -1, "存在「用过即钉住」_aduPinByTool");
ok(indexSrc.indexOf('ctx.on("agent/pre-step"') !== -1, "每步请求前自愈（agent/pre-step）");
ok(indexSrc.indexOf('ctx.on("tools/pre-execute"') !== -1, "工具被调用时钉住所属模块");
ok(indexSrc.indexOf("aduMode") !== -1, "detFeatureGet 回传 aduMode（模式事实可查）");
ok(indexSrc.indexOf("_aduPromptText") !== -1, "存在「工具选择优先级」提示生成器");
ok(indexSrc.indexOf("专用工具优先") !== -1, "提示里明确：专用工具优先");
ok(indexSrc.indexOf("什么时候才用 pwsh") !== -1, "提示里明确：pwsh 只是兜底");
ok(indexSrc.indexOf("_refreshAduPrompt") !== -1, "装载/卸载后刷新提示（「这一轮可用」实时）");
const dltSrc = readFileSync(join(REPO, "lib", "dlt-tools.js"), "utf8");
ok(dltSrc.indexOf("function normalizedRun") !== -1, "dlt 结果有归一化（exitCode 不会是 null）");
eq((dltSrc.match(/exitCode: \{ type: "number" \}/g) || []).length, 2, "dlt_run / dlt_build 的 exitCode 都声明为 number");
ok(dltSrc.indexOf("nullable") === -1, "不得使用宿主不认识的 nullable 关键字");
ok(indexSrc.indexOf("this._aduWanted") !== -1, "wanted 内存镜像存在");
ok(!/if \(lazy && !mounted\("alv"\)\) this\.alv\.dispose\(\)/.test(indexSrc),
  "按需模式不得隐式 dispose ALV（旧实现的自动卸载来源）");
ok(!/if \(lazy && !mounted\("dlt"\)\) this\.dlt\.dispose\(\)/.test(indexSrc),
  "按需模式不得隐式 dispose DLT");

section("粘性装载（行为）—— 恢复、幂等、真卸载");

{
  // 一个「能真的注册/回收工具」的假上下文：tools.register 返回真正的 disposer，
  // 于是「卸下了但工具还在」这种假卸载会被当场抓住（v2.11.0 的真实缺陷）。
  const active = new Set();
  const record = { prompts: 0, provided: [] };
  const ctx = {
    effect(fn) { let d = null; try { d = fn(); } catch (e) { /* ignore */ } return typeof d === "function" ? d : () => {}; },
    on() { return () => {}; },
    get(name) { return name === "tools" ? ctx.tools : (name === "systemPrompt" ? ctx.systemPrompt : undefined); },
    reflect: { props: {}, store: {}, provide(n, v) { record.provided.push(n); return v; }, get() {}, set() {}, bind(f) { return f; } },
    provide(n, v) { record.provided.push(n); return v; },
    set(n, v) { record.provided.push(n); return v; },
    mixin() {},
    typert: { register() {} },
    tools: {
      register(def) { active.add(def.name); return () => active.delete(def.name); },
      guard() {},
    },
    systemPrompt: { section() { record.prompts++; return () => {}; } },
  };

  const service = apply(ctx, Config({}));
  await new Promise((r) => setTimeout(r, 120));
  // 换成可记录的设置层（绕开真实存储域），并固定开关快照
  const written = [];
  service.vtd = {
    getSetting: async (k) => (k === "det.adu.mounted" ? { ok: true, value: ["alv"] } : { ok: true, value: {} }),
    setSetting: async (k, v) => { written.push({ k, v }); return { ok: true }; },
  };
  service._featuresSnapshot = { master: true, adu: true, alv: true };
  service._aduGroups = new Map();

  const restored = await service._aduRestoreMounts();
  eq(restored.restored, ["alv"], "启动时按 det.adu.mounted 恢复 alv");
  ok(service._aduGroups.has("alv"), "恢复后 alv 记账在 _aduGroups");
  ok(active.has("alv_info") && active.has("alv_edges"), "恢复真的注册了 alv_* 工具");

  const again = await service._aduRestoreMounts();
  eq(again.restored, [], "再次恢复不会重复装载");

  const un = await service._aduUnmount("alv");
  eq(un.ok, true, "卸载返回成功");
  ok(!service._aduGroups.has("alv"), "卸载后账本清空");
  ok(!active.has("alv_info"), "卸载后工具真的被回收（不是假卸载）");
  const last = written[written.length - 1];
  eq(last && last.k, "det.adu.mounted", "卸载后写回 det.adu.mounted");
  eq(last && last.v, [], "卸载后持久化列表为空");

  const remount = await service._aduMount("alv");
  eq(remount.ok, true, "卸载后可重新装载");
  ok(active.has("alv_info"), "重新装载后工具回来了");
  eq(remount.sticky, true, "装载结果标注 sticky");
  ok(service._aduWanted.has("alv"), "装载后进入 wanted（期望集合）");

  // 模拟"工具被莫名卸掉"（重启竞态/热重载/误卸）：自愈必须装回来
  service._aduGroups = new Map();
  const healed = service._aduEnsure("test");
  eq(healed.ensured, ["alv"], "自愈把丢掉的模块补回来");
  ok(service._aduGroups.has("alv"), "自愈后记账恢复");
  ok(active.has("alv_info"), "自愈真的重新注册了工具");

  // 用过即钉住：清空 wanted 后，只要调用过该模块的工具，就应重新钉住
  service._aduWanted = new Set();
  service._aduGroups = new Map();
  const pinned = service._aduPinByTool("alv_edges");
  eq(pinned, "alv", "调用过的模块被钉住");
  ok(service._aduWanted.has("alv"), "钉住写进 wanted");
  const persisted = written[written.length - 1];
  eq(persisted && persisted.v, ["alv"], "钉住立即持久化");

  const promptText = service._aduPromptText();
  ok(promptText.indexOf("专用工具优先") !== -1, "提示写明专用工具优先");
  ok(promptText.indexOf("pwsh") !== -1, "提示交代 pwsh 只做兜底");
  ok(promptText.indexOf("alv_ocr") !== -1, "已装模块的工具被点名（这一轮可用）");
  ok(promptText.indexOf("dlt_doc_read") === -1, "未装模块的工具不点名（不推荐手里没有的工具）");
  ok(promptText.indexOf("还没装") !== -1, "未装模块单独一段，给 adu_load 提示");
}

// ─────────────────────────────────────────────────────────────
section("引擎契约（需要 python312；缺失则跳过）");

const PY = "C:\\Users\\L2959\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
const ENGINE = join(REPO, "py", "alv.py");
const FIXTURE = join(here, "fixtures", "alv-smoke.png");
const OCR_BRIDGE = join(REPO, "py", "alv_ocr.ps1");

ok(existsSync(ENGINE), "引擎 py/alv.py 随包存在");
ok(existsSync(OCR_BRIDGE), "OCR 桥 py/alv_ocr.ps1 随包存在");
ok(indexSrc.indexOf('join(PACKAGE_ROOT, "py", "alv.py")') !== -1 || existsSync(ENGINE), "引擎路径可解析");

const canRun = existsSync(PY) && existsSync(ENGINE) && existsSync(FIXTURE);
if (!canRun) {
  console.log("   · 跳过引擎实跑（缺 python312 或夹具图）");
} else {
  const run = (op, args) => {
    const out = execFileSync(PY, [ENGINE], {
      input: JSON.stringify({ op, args }),
      encoding: "utf8",
      timeout: 120000,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    const line = String(out).trim().split("\n").filter(Boolean).pop();
    return JSON.parse(line);
  };

  // 产物一律写临时目录：测试不得在仓库里留垃圾（夹具图除外）。
  const OUT = mkdtempSync(join(tmpdir(), "dsh-alv-test-"));

  const info = run("info", { path: FIXTURE });
  eq(info.ok, true, "info 成功");
  ok(info.width > 100 && info.height > 100, "info 返回尺寸");
  eq(typeof info.darkRatio, "number", "info 返回暗像素比例");

  const gridOut = join(OUT, "grid.png");
  const grid = run("grid", { path: FIXTURE, cell: 60, guides: { horizontal: [470] }, out: gridOut });
  eq(grid.ok, true, "grid 成功");
  ok(Array.isArray(grid.columns) && grid.columns.length > 2, "grid 返回列坐标");
  eq(grid.guidesDrawn.horizontal, [470], "grid 画出了指定辅助线");
  ok(existsSync(gridOut), "grid 落盘");

  const edges = run("edges", { path: FIXTURE, minLineLen: 100 });
  eq(edges.ok, true, "edges 成功");
  ok(Array.isArray(edges.horizontalPositions) && edges.horizontalPositions.length > 0, "edges 找到水平边线位置");
  ok(edges.horizontalPositions.every((p) => typeof p.y === "number" && typeof p.votes === "number"),
    "边线位置是 {y,votes} 形状（可被模型直接引用）");

  const anno = run("annotate", { path: FIXTURE, ops: [{ kind: "box", box: [10, 10, 100, 40] }, { kind: "cross", x: 50, y: 50 }] });
  eq(anno.ok, true, "annotate 成功");
  eq(anno.drawn, 2, "annotate 画了 2 项");

  const crop = run("crop", { path: FIXTURE, box: [60, 80, 200, 60], scale: 2 });
  eq(crop.ok, true, "crop 成功");
  eq(crop.scale, 2, "crop 记住缩放倍数");
  ok(crop.toSource && crop.toSource.x === 60, "crop 给出换算回原图的偏移");

  const bad = run("nope", {});
  eq(bad.ok, false, "未知 op 如实报错（不静默成功）");

  const missing = run("info", { path: join(here, "fixtures", "does-not-exist.png") });
  eq(missing.ok, false, "缺图如实报错");
}

// ─────────────────────────────────────────────────────────────
console.log("\n-- 结果");
if (failures.length === 0) {
  console.log(`✅ 全部通过：${pass} 项断言`);
  process.exit(0);
}
console.log(`❌ 失败 ${failures.length} 项 / 通过 ${pass} 项`);
for (const f of failures) console.log("   ✗ " + f);
process.exit(1);

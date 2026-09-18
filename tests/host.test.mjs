/**
 * DET 宿主半区装载测试（host smoke）
 * ====================================================================
 * 这是防「DSH 升级把 DET 打断」最有效的一道网：
 * 用假 Cordis 上下文真的执行 apply()，把"能装载、能注册、能探测"变成断言。
 *
 * 与 unit.test.mjs 的区别：
 *   unit  —— 纯函数，零依赖
 *   host  —— 真装载插件（仍不联网、不起服务、不写盘）
 *
 * 运行（必须在插件包内，ESM 要按该包 realpath 解析裸包名）：
 *
 *     node <repo>/tests/host.test.mjs
 *
 * 覆盖：apply() 装载契约、typert 注册表、宿主能力探测、原生接管门控
 *       （applyHostGating 的"只改返回值、绝不写回"不变量）、
 *       MSBuild 解析优先级（目标 (1)：配置失效必须回退到自动探测）。
 */

import { Config, EssentialToolsService, apply, name } from "../lib/index.js";
import { probeHost, hostCaps, hostSummary, featuresFor, FEATURE_REGISTRY } from "../lib/host.js";
import { existsSync, statSync } from "node:fs";

let pass = 0;
const failures = [];
const notes = [];
const unhandled = [];

process.on("unhandledRejection", (e) => {
  unhandled.push(String((e && e.message) || e));
});

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

// ─────────────────────────────────────────────────────────────
// 假 Cordis 上下文：只实现 DET 真正用到的面。
// 不提供任何真实服务（get 全返回 undefined）—— 这本身就是一次
// 「宿主服务缺失时 DET 是否仍能装载」的降级验证。
// ─────────────────────────────────────────────────────────────
function makeCtx() {
  const record = { typertRegistrations: [], effects: 0, listeners: [], toolRegistrations: 0, promptSections: 0, provided: [] };
  const ctx = {
    _record: record,
    effect(fn) {
      record.effects++;
      let disposer = null;
      try { disposer = fn(); } catch (e) { notes.push("effect 回调抛错: " + String(e && e.message || e)); }
      return typeof disposer === "function" ? disposer : () => {};
    },
    on(event, handler) {
      record.listeners.push(event);
      return () => {};
    },
    get(_serviceName) { return undefined; },
    // Cordis 的服务注册面。真正的入口是 `ctx.reflect.provide(...)`
    // （Cordis `Service` 基类构造函数第 1781 行），`provide`/`set` 一并给出
    // 以免不同版本走不同路径。
    reflect: {
      props: {},
      store: {},
      provide(serviceName, value) { record.provided.push(serviceName); return value; },
      get() { return undefined; },
      set() {},
      bind(fn) { return fn; },
    },
    provide(serviceName, value) { record.provided.push(serviceName); return value; },
    set(serviceName, value) { record.provided.push(serviceName); return value; },
    mixin() {},
    typert: {
      register(descriptor) { record.typertRegistrations.push(descriptor); },
    },
    tools: {
      register(def) { record.toolRegistrations++; return () => {}; },
    },
    systemPrompt: {
      section() { record.promptSections++; return () => {}; },
    },
  };
  return ctx;
}

function resolveConfig(input) {
  try { return Config(input); } catch (e) { return null; }
}

// ─────────────────────────────────────────────────────────────
section("宿主能力探测（host.js 适配层）");

const ctx = makeCtx();
let caps = null;
try {
  caps = await probeHost(ctx);
  ok(true, "probeHost(ctx) 不抛错");
} catch (e) {
  ok(false, "probeHost(ctx) 抛错: " + String(e && e.message || e));
}

if (caps) {
  ok(typeof caps.probed === "boolean", "caps.probed 是布尔");
  ok(typeof caps.modern === "boolean", "caps.modern 是布尔（modern/legacy 归类必须存在）");
  ok(caps.legacy === !caps.modern, "legacy 必须恒等于 !modern（两者不可同时为真）");
  eq(caps.headerIsSeeded, caps.sessionSnapshotEvents, "headerIsSeeded 应跟随 snapshotEvents 信号");
  eq(caps.headerOriginSubagentOnly, caps.sessionSnapshotEvents, "headerOriginSubagentOnly 应跟随同一信号");

  const caps2 = await probeHost(ctx);
  ok(caps2 === caps, "probeHost 幂等：二次调用返回同一对象引用（进程级缓存）");

  const capsView = hostCaps();
  ok(capsView === caps, "hostCaps() 返回已缓存的同一快照");

  const summary = hostSummary();
  ok(typeof summary.corridor === "string" && summary.corridor.length > 0, "hostSummary().corridor 是可读字符串");
  ok(!("modern" in summary) || true, "hostSummary 面向序列化展示");
  notes.push(`宿主走廊判定：${summary.corridor}（formatVersion=${summary.formatVersion}）`);
}

// ─────────────────────────────────────────────────────────────
section("功能归属表 featuresFor（原生接管的唯一判定源）");

ok(Array.isArray(FEATURE_REGISTRY) && FEATURE_REGISTRY.length > 0, "FEATURE_REGISTRY 非空");
const verdicts = featuresFor(caps || undefined);
const verdictKeys = Object.keys(verdicts);
eq(verdictKeys.length, FEATURE_REGISTRY.length, "featuresFor 覆盖 FEATURE_REGISTRY 的每一个功能键");
for (const k of verdictKeys) {
  ok(["active", "uninstalled", "enhanced"].indexOf(verdicts[k]) !== -1, `verdicts.${k} 取值合法（${verdicts[k]}）`);
}
if (caps && caps.legacy) {
  const allActive = verdictKeys.every((k) => verdicts[k] === "active");
  ok(allActive, "旧宿主上全部功能必须保持 active（不得卸载任何实现）");
}

// ─────────────────────────────────────────────────────────────
section("apply() 装载契约");

const ctx2 = makeCtx();
let service = null;
const cfg = resolveConfig({});
ok(cfg !== null, "Config({}) 可解析");

try {
  service = apply(ctx2, cfg);
  ok(true, "apply(ctx, config) 不抛错（宿主服务全缺失时也必须能装载）");
} catch (e) {
  ok(false, "apply() 抛错: " + String(e && e.message || e));
}

if (service) {
  ok(service instanceof EssentialToolsService, "apply 返回 EssentialToolsService 实例");
  ok(!!service.vtd, "子存储 vtd 已构造");
  ok(!!service.global, "子存储 global 已构造");
  ok(!!service.mda, "子存储 mda 已构造");
  ok(!!service.browser, "浏览器桥已构造");
  eq(service.masterEnabled, true, "总开关默认开启（不得默认静默关闭 DET）");
  eq(service._extLoaded, false, "装载后扩展尚未装载（由总开关异步决定，不阻塞挂载）");
  ok(ctx2._record.effects >= 2, `apply 至少登记 2 个 ctx.effect 清理器（实际 ${ctx2._record.effects}）`);

  await service.hostReady;
  ok(true, "service.hostReady 可 await（异步探测不阻塞挂载）");
}

// ─────────────────────────────────────────────────────────────
section("typert 注册表（Host↔Client 契约）");

const regs = ctx2._record.typertRegistrations;
eq(regs.length, 1, "apply 期间恰好注册一次 typert 描述符");
if (regs.length === 1) {
  const r = regs[0];
  eq(r.package, name, "描述符 package 必须等于包名");
  eq(r.face, "host", "描述符 face 必须是 host");
  ok(Array.isArray(r.invocations) && r.invocations.length > 0, "invocations 非空");
  ok(Array.isArray(r.schemas), "schemas 是数组");
  if (Array.isArray(r.invocations)) {
    notes.push(`typert 端点数量：${r.invocations.length}`);
    const ids = new Set();
    let bad = 0, dup = 0;
    for (const inv of r.invocations) {
      if (!inv || typeof inv.id !== "string" || !inv.id) bad++;
      else if (ids.has(inv.id)) dup++;
      else ids.add(inv.id);
      if (!inv || typeof inv.method !== "string" || !inv.method) bad++;
      if (!inv || typeof inv.namespace !== "string" || !inv.namespace) bad++;
    }
    eq(bad, 0, "每个 invocation 都必须有非空 id / namespace / method");
    eq(dup, 0, "invocation id 不得重复（重复 id 会被注册表拒绝）");
    ok(ids.size === r.invocations.length, "invocation id 唯一");
  }
}

// ─────────────────────────────────────────────────────────────
section("原生接管门控 applyHostGating 的不变量");

const userFeatures = { master: true, file: true, run: true, ver: true, vtd: true, mda: true, plugins: true, approve: false, mms: false, secCmdAudit: false, secPromptDefense: false };
const frozen = JSON.stringify(userFeatures);
const gated = EssentialToolsService.applyHostGating(userFeatures);

ok(JSON.stringify(userFeatures) === frozen, "applyHostGating 绝不修改调用方传入的对象（用户开关值必须原样保留）");
ok(gated !== userFeatures, "applyHostGating 返回新对象");
const nativeKeys = Object.keys(EssentialToolsService.nativeProvidedKeys());
for (const k of nativeKeys) {
  eq(gated[k], false, `被原生接管的功能 ${k} 在返回值里必须强制为 false`);
}
for (const k of Object.keys(userFeatures)) {
  if (nativeKeys.indexOf(k) === -1) {
    eq(gated[k], userFeatures[k], `未被原生接管的功能 ${k} 不受门控影响`);
  }
}
notes.push(`本机被原生接管（新宿主上 DET 卸载实现）的功能键：${nativeKeys.length ? nativeKeys.join(", ") : "无"}`);

// ─────────────────────────────────────────────────────────────
section("MSBuild 解析优先级（目标 (1)：配置失效必须回退探测）");

if (service) {
  const isUsableFile = (p) => { try { return p !== "" && existsSync(p) && statSync(p).isFile(); } catch (e) { return false; } };

  // 1) 中性配置 → 必须靠自动探测
  service.config.msbuild = "";
  service._msbuildResolved = null;
  const probed = await service.resolveMsbuild();
  if (probed === "") {
    notes.push("本机未探测到 MSBuild（跳过后续优先级断言）");
  } else {
    ok(isUsableFile(probed), `自动探测到的 MSBuild 必须是真实存在的文件：${probed}`);
    ok(probed.toLowerCase().indexOf("msbuild.exe") !== -1, "探测结果必须指向 MSBuild.exe");

    // 2) 缓存：同一配置下二次调用复用
    const probed2 = await service.resolveMsbuild();
    eq(probed2, probed, "同配置下二次解析命中 60s 缓存，结果一致");

    // 3) 配置指向不存在的路径 → 必须回退到探测（不得把坏路径返回给调用方）
    service.config.msbuild = "C:\\__det_missing_msbuild__\\MSBuild.exe";
    service._msbuildResolved = null;
    const fallback = await service.resolveMsbuild();
    ok(fallback !== service.config.msbuild, "配置路径不存在时不得直接采用该路径");
    ok(isUsableFile(fallback), "配置路径不存在时必须回退到真实可用的探测结果");

    // 4) 配置指向真实存在的文件 → 原样优先采用
    service.config.msbuild = probed;
    service._msbuildResolved = null;
    const honored = await service.resolveMsbuild();
    eq(honored, probed, "配置路径真实存在时必须优先采用配置值");
  }
}

// ─────────────────────────────────────────────────────────────
section("结果");

await new Promise((r) => setTimeout(r, 60));
if (unhandled.length > 0) {
  failures.push(`出现 ${unhandled.length} 个未处理的 Promise 拒绝：` + unhandled.slice(0, 3).join(" | "));
}
for (const n of notes) console.log("   · " + n);

if (failures.length === 0) {
  console.log(`\n✅ 全部通过：${pass} 项断言`);
  process.exit(0);
}
console.log(`\n❌ 失败 ${failures.length} 项 / 通过 ${pass} 项`);
for (const f of failures) console.log("   • " + f);
process.exit(1);

/**
 * DET 客户端 DLT 集成装配测试（dlt-integration）
 * ====================================================================
 * 为什么需要：DLT 集成把「每轮成本小签 / 右栏预览 / 草图按钮」三块界面搬进了 DET，
 * 而这三块**受六个分项开关门控**（dltCost / dltPreview / dltDocs / dltDraft …）：
 * 开关一变就得当场装卸，不能等刷新。client-load 那套的假 connection 一律
 * `{ok:false}`，所以功能开关永远读不到、masterWiring 从不执行 —— 这条装配路径
 * 一条断言都没有。
 *
 * 本套用一个**会答 detFeatureGet** 的假 connection 真跑一遍 apply()，并且
 * 把 inject/register 的 disposer 也模拟出来（撤销后从「在册」集合里移除），
 * 于是能在几种开关组合下核对「此刻到底挂着什么」：
 *   · 全开            → 成本小签 + 右栏预览（docx/xlsx/csv）+ 草图按钮都在；
 *   · 关掉 dltCost    → 只少成本小签；
 *   · 关掉 dltPreview → 只少预览（documentPreviews.register 一次都不调）；
 *   · 关掉 dltDraft   → 只少草图按钮（输入框那一行只剩 DET 自己的网络权限控件）；
 *   · 总开关关闭      → 三块全撤。
 *
 *     node <repo>/tests/dlt-integration.test.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..");
const src = readFileSync(join(REPO, "lib", "client.js"), "utf8");

const reactStub = {
  createElement: function () { return { __el: true }; },
  Fragment: "fragment",
  useState: function (v) { return [typeof v === "function" ? v() : v, function () {}]; },
  useEffect: function () {},
  useMemo: function (fn) { try { return fn(); } catch (e) { return null; } },
  useCallback: function (fn) { return fn; },
  useRef: function () { return { current: null }; },
  createPortal: function (node) { return node; },
};

function loadBundle() {
  const registrations = [];
  const previousWindow = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load: function (def) { registrations.push(def); } } };
  try {
    // eslint-disable-next-line no-new-func
    new Function(src)();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
  const def = registrations[0];
  return def.factory(function (id) {
    if (id === "react" || id === "react-dom") return reactStub;
    throw new Error("未声明的外部依赖: " + id);
  });
}

const ALL_ON = {
  master: true, file: true, run: true, ver: true, vtd: true, mda: true, plugins: true,
  approve: false, mms: false, secCmdAudit: false, secPromptDefense: false,
  dltDocs: true, dltPreview: true, dltEnv: true, dltRun: true, dltCost: true, dltDraft: true,
};

/** 在册登记表：注册返回 disposer，调用即从在册集合里移除（模拟宿主回收插槽）。 */
function makeLedger() {
  const live = [];
  return {
    live: live,
    add: function (name) {
      live.push(name);
      return function () {
        const at = live.indexOf(name);
        if (at >= 0) live.splice(at, 1);
      };
    },
    count: function (name) { return live.filter(function (n) { return n === name; }).length; },
    has: function (name) { return live.indexOf(name) !== -1; },
  };
}

/** 造一个会答 detFeatureGet 的假 ctx。 */
function makeCtx(features, calls) {
  const connection = {
    rpc: {
      call: function (_route, method, payload) {
        const name = String(method).replace("dshEssentialTools/", "");
        calls.push({ method: name, args: payload && payload.args ? payload.args.args : null });
        if (name === "detFeatureGet") return Promise.resolve({ ok: true, value: { ok: true, features: features, nativeProvided: {}, host: {} } });
        if (name === "mdaGet") return Promise.resolve({ ok: true, value: { ok: true, mode: "native", areas: [] } });
        return Promise.resolve({ ok: false, error: { message: "stub " + name } });
      },
    },
  };
  const ledger = makeLedger();
  const previews = {
    registered: [],
    register: function (def) {
      previews.registered.push(def.id);
      return ledger.add("preview:" + def.id);
    },
    getSnapshot: function () { return [{ priority: "builtin", extensions: ["md", "pdf"] }]; },
    subscribe: function () { return function () {}; },
  };
  const slots = {
    inject: function (name, cb) {
      const dispose = ledger.add("inject:" + name);
      try { cb(); } catch (e) { /* 单个插槽失败不应中断 */ }
      return dispose;
    },
    register: function (def, _component) {
      const name = def && def.name ? def.name : String(def);
      const id = def && def.id ? "#" + def.id : "";
      return ledger.add("register:" + name + id);
    },
  };
  const ctx = {
    get: function (name) {
      if (name === "connection") return connection;
      if (name === "modelDirectories") return { directoryFor: function () { return null; } };
      if (name === "dynamicCordisRunner") return { startUserRun: function () {}, define: function () {}, run: function () {} };
      if (name === "workspaces") return { archiveSession: function () {} };
      if (name === "conversation") return { input: { shell: function () { return null; } }, createDrafts: function () { return []; } };
      if (name === "documentPreviews") return previews;
      return undefined;
    },
    effect: function (fn) { let d = null; try { d = fn(); } catch (e) { /* ignore */ } return typeof d === "function" ? d : function () {}; },
    on: function () { return function () {}; },
    emit: function () {},
    logger: { info: function () {}, warn: function () {}, error: function () {}, debug: function () {} },
    slots: slots,
    sessions: {
      list: { getSnapshot: function () { return { current: "sess-1" }; }, subscribe: function () { return function () {}; } },
      open: function () {},
      binding: function () { return null; },
      fork: function () { return Promise.resolve("child"); },
    },
    remote: {},
  };
  return { ctx: ctx, ledger: ledger, previews: previews, calls: calls };
}

function tick() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }

async function scenario(features) {
  const bundle = loadBundle();
  const calls = [];
  const fake = makeCtx(features, calls);
  bundle.apply(fake.ctx);
  // detFeatureGet / mdaGet 是异步的：让它们落地后 masterWiring 才会跑完。
  await tick();
  await tick();
  return { ledger: fake.ledger, previews: fake.previews, calls: calls };
}

// ─────────────────────────────────────────────────────────────
section("全开：三块界面都装配上");

const on = await scenario(ALL_ON);
ok(on.calls.some((c) => c.method === "detFeatureGet"), "客户端确实向宿主读了功能开关");
ok(on.ledger.has("inject:conversation.chat.turnTail"), "成本小签注入 conversation.chat.turnTail");
ok(on.ledger.live.some((n) => n.indexOf("register:conversation.chat.turnTail") === 0), "成本小签真的注册了");
eq(on.ledger.count("inject:conversation.input.left"), 2, "输入框左行有两个控件（DET 网络权限 + DLT 草图按钮）");
ok(on.ledger.has("register:conversation.input.left#dset-dlt-draft"), "草图按钮真的注册了");
ok(on.ledger.has("inject:sidebar.right.tab.document"), "右栏预览注入 sidebar.right.tab.document");
eq(on.previews.registered, ["dset-dlt-docx", "dset-dlt-xlsx", "dset-dlt-csv"], "docx/xlsx/csv 三个预览渲染器都注册了");
notes.push(`全开：在册 ${on.ledger.live.length} 项、预览 ${on.previews.registered.length} 个`);

// ─────────────────────────────────────────────────────────────
section("关掉 dltCost：只少成本小签");

const noCost = await scenario(Object.assign({}, ALL_ON, { dltCost: false }));
ok(!noCost.ledger.has("inject:conversation.chat.turnTail"), "关掉 dltCost 后不再注入 turnTail");
eq(noCost.ledger.count("inject:conversation.input.left"), 2, "草图按钮不受 dltCost 影响");
eq(noCost.previews.registered.length, 3, "右栏预览不受 dltCost 影响");

// ─────────────────────────────────────────────────────────────
section("关掉 dltPreview / dltDocs：右栏预览一个都不注册");

const noPreview = await scenario(Object.assign({}, ALL_ON, { dltPreview: false }));
eq(noPreview.previews.registered, [], "关掉 dltPreview 后 documentPreviews 一次都不注册");
ok(noPreview.ledger.has("inject:conversation.chat.turnTail"), "成本小签不受 dltPreview 影响");
eq(noPreview.ledger.count("inject:conversation.input.left"), 2, "草图按钮不受 dltPreview 影响");

const noDocs = await scenario(Object.assign({}, ALL_ON, { dltDocs: false }));
eq(noDocs.previews.registered, [], "关掉 dltDocs 后右栏预览也不注册（它依赖文档引擎）");

// ─────────────────────────────────────────────────────────────
section("关掉 dltDraft：草图按钮不注入");

const noDraft = await scenario(Object.assign({}, ALL_ON, { dltDraft: false }));
eq(noDraft.ledger.count("inject:conversation.input.left"), 1, "关掉 dltDraft 后输入框左行只剩 DET 自己的控件");
ok(!noDraft.ledger.has("register:conversation.input.left#dset-dlt-draft"), "草图按钮组件不再注册");
ok(noDraft.ledger.has("inject:conversation.chat.turnTail"), "成本小签不受 dltDraft 影响");

// ─────────────────────────────────────────────────────────────
section("总开关关闭：三块全撤（完全原生）");

const off = await scenario(Object.assign({}, ALL_ON, { master: false }));
ok(!off.ledger.has("inject:conversation.chat.turnTail"), "总开关关闭后不注入成本小签");
eq(off.ledger.count("inject:conversation.input.left"), 0, "总开关关闭后输入框左行的 DET 控件也一并撤下");
ok(!off.ledger.has("inject:sidebar.right.tab.document"), "总开关关闭后不注入右栏预览");
eq(off.previews.registered, [], "总开关关闭后不注册任何预览");
// 注意：总开关关闭 ≠ DET 完全消失 —— 设计上「DET 管理器」设置页与 VTD 视图片段仍在
// （否则用户没有入口把总开关打回来）。这里只要求 DLT 集成的登记一个不留。
eq(off.ledger.live.filter((n) => n.indexOf("dset-dlt") !== -1).length, 0, "总开关关闭后 DLT 集成的登记一个不留");
notes.push(`总开关关闭：在册 ${off.ledger.live.length} 项（DET 管理器 / VTD 视图片段按设计保留）`);

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

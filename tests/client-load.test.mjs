/**
 * DET 客户端半区装载测试（client-load）
 * ====================================================================
 * 为什么需要：lib/client.js 是 `window.__ModuleLoader__.load({factory})` 形式的
 * 预打包 bundle。`new Function(src)` 只能证明它**编译得过**，证明不了
 * factory 真能执行、`exports.apply(ctx)` 真能挂载 —— 而 client 半区此前
 * 一条断言都没有。
 *
 * 本套在一个假 ModuleLoader + 假 require + 假 ctx 下**真执行**这个 factory，
 * 因此能抓住"顶层引用错、服务取用崩、注入声明与使用不一致"这类运行时问题。
 *
 *     node <repo>/tests/client-load.test.mjs
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

// ─────────────────────────────────────────────────────────────
section("假 ModuleLoader + 假 require");

const reactStub = {
  createElement: function () { return { __el: true }; },
  Fragment: "fragment",
  useState: function (v) { return [typeof v === "function" ? v() : v, function () {}]; },
  useEffect: function () {},
  useMemo: function (fn) { try { return fn(); } catch (e) { return null; } },
  useCallback: function (fn) { return fn; },
  useRef: function () { return { current: null }; },
};
const requireLog = [];
function requireStub(id) {
  requireLog.push(id);
  if (id === "react" || id === "react-dom") return reactStub;
  throw new Error("client bundle 出现了未声明的外部依赖: " + id);
}

const registrations = [];
const fakeWindow = {
  __ModuleLoader__: {
    load: function (def) { registrations.push(def); },
  },
};

// ─────────────────────────────────────────────────────────────
section("执行 bundle factory");

ok(registrations.length === 0, "执行前无注册");
let loadErr = null;
try {
  // client.js 顶层引用 window；在同 realm 内把 window 指向假对象。
  globalThis.window = fakeWindow;
  // eslint-disable-next-line no-new-func
  new Function(src)();
} catch (e) {
  loadErr = e;
}
ok(loadErr === null, `bundle 顶层必须能执行${loadErr ? "：" + String(loadErr && loadErr.message || loadErr) : ""}`);
eq(registrations.length, 1, "恰好在 __ModuleLoader__ 上注册一次");

const def = registrations[0];
if (def) {
  eq(def.id, "dsh-essential-tools", "注册 id 必须等于包名");
  ok(typeof def.factory === "function", "注册项提供 factory");
}

// ─────────────────────────────────────────────────────────────
section("factory 执行 → exports 契约");

let exportsObj = null;
let factoryErr = null;
if (def) {
  try {
    exportsObj = def.factory(requireStub);
  } catch (e) {
    factoryErr = e;
  }
}
ok(factoryErr === null, `factory 必须能执行${factoryErr ? "：" + String(factoryErr && factoryErr.message || factoryErr) : ""}`);
ok(requireLog.indexOf("react") !== -1, "factory 通过注入的 require 取 react");
ok(requireLog.indexOf("react-dom") !== -1, "factory 通过注入的 require 取 react-dom");
const badRequires = requireLog.filter((id) => id !== "react" && id !== "react-dom");
eq(badRequires.length, 0, `不得 require 其它外部依赖（bundle purity）：${badRequires.join(", ") || "无"}`);

if (exportsObj) {
  ok(Array.isArray(exportsObj.inject), "exports.inject 是数组");
  ok(exportsObj.inject && exportsObj.inject.length > 0, "exports.inject 非空");
  ok(exportsObj.inject && exportsObj.inject.indexOf("slots") !== -1, "必须注入 slots（UI 全靠插槽）");
  ok(typeof exportsObj.apply === "function", "exports.apply 是函数（客户端入口）");
}

// ─────────────────────────────────────────────────────────────
section("exports.apply(ctx) 在假上下文中可挂载");

const slotCalls = [];
const registeredSlots = [];
function makeFakeCtx() {
  const stubConnection = { rpc: { call: function () { return Promise.resolve({ ok: false, error: "stub" }); } } };
  const ctx = {
    get: function (name) {
      if (name === "connection") return stubConnection;
      if (name === "modelDirectories") return { directoryFor: function () { return null; } };
      if (name === "dynamicCordisRunner") return { startUserRun: function () {}, define: function () {}, run: function () {} };
      if (name === "workspaces") return { archiveSession: function () {} };
      return undefined;
    },
    effect: function (fn) { let d = null; try { d = fn(); } catch (e) { /* ignore */ } return typeof d === "function" ? d : function () {}; },
    on: function () { return function () {}; },
    emit: function () {},
    logger: { info: function () {}, warn: function () {}, error: function () {}, debug: function () {} },
    slots: {
      inject: function (name, cb) { slotCalls.push(name); try { cb(); } catch (e) { /* 单个插槽失败不应中断 */ } return function () {}; },
      register: function (slotDef, comp) { registeredSlots.push(slotDef && slotDef.id ? slotDef.id : String(slotDef)); return function () {}; },
    },
    sessions: {
      list: { getSnapshot: function () { return []; }, subscribe: function () { return function () {}; } },
      open: function () {},
      binding: function () { return null; },
      fork: function () { return Promise.resolve("child"); },
    },
    remote: {},
  };
  return ctx;
}

if (exportsObj && typeof exportsObj.apply === "function") {
  let applyErr = null;
  let ctx = null;
  try {
    ctx = makeFakeCtx();
    exportsObj.apply(ctx);
  } catch (e) {
    applyErr = e;
  }
  ok(applyErr === null, `exports.apply(ctx) 不得抛错${applyErr ? "：" + String(applyErr && applyErr.message || applyErr) : ""}`);
  ok(slotCalls.length > 0, `apply 必须向宿主插槽注入 UI（实际 ${slotCalls.length} 个插槽：${slotCalls.join(", ")}）`);
  notes.push(`插槽注入 ${slotCalls.length} 个：${[...new Set(slotCalls)].join(", ")}`);
  notes.push(`注册插槽 ${registeredSlots.length} 个`);
  ok(slotCalls.indexOf("settings.section") !== -1, "必须往 settings.section 注入 DET 管理器页");
  ok(slotCalls.indexOf("shell.overlay") !== -1, "必须往 shell.overlay 注入工具栏/浮层");
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

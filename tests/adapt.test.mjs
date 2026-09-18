/**
 * DET 宿主服务接入层测试（adapt）
 * ====================================================================
 * 覆盖 lib/adapt.js 本身，以及一条**架构守卫**：
 * Host 半区不得再出现裸的 `ctx.get("字面量")` —— 服务名必须集中在
 * SERVICE 表里，否则宿主改名时又会退化成"全文搜改、漏一处运行时才炸"。
 *
 *     node <repo>/tests/adapt.test.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SERVICE, serviceNames, svc, svcWith } from "../lib/adapt.js";

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

// ─────────────────────────────────────────────────────────────
section("SERVICE 服务名表");

ok(Object.isFrozen(SERVICE), "SERVICE 必须被冻结（不可在运行期被改写）");
const keys = Object.keys(SERVICE);
ok(keys.length > 0, "SERVICE 非空");
let badValue = 0;
for (const k of keys) {
  const v = SERVICE[k];
  if (typeof v !== "string" || v.trim() === "") badValue++;
}
eq(badValue, 0, "每个服务名都必须是非空字符串");

const names = serviceNames();
ok(Array.isArray(names), "serviceNames() 返回数组");
eq(names.length, new Set(names).size, "serviceNames() 去重");
ok(names.every((n) => typeof n === "string" && n !== ""), "serviceNames() 元素均为非空字符串");
// key 与值当前一致（命名规范：key 就是服务名）；若将来出现别名，这条会提醒作者更新说明。
const alias = keys.filter((k) => SERVICE[k] !== k);
if (alias.length > 0) console.log(`   · 注意：存在与 key 不同名的服务别名 → ${alias.map((k) => `${k}=${SERVICE[k]}`).join(", ")}`);

// ─────────────────────────────────────────────────────────────
section("svc() —— 安全取服务，永不抛出");

const marker = { tag: "svc" };
eq(svc(null, SERVICE.fs), undefined, "ctx 为 null → undefined");
eq(svc(undefined, SERVICE.fs), undefined, "ctx 为 undefined → undefined");
eq(svc({}, SERVICE.fs), undefined, "ctx 无 get 方法 → undefined");
eq(svc({ get: "not-a-function" }, SERVICE.fs), undefined, "ctx.get 非函数 → undefined");
eq(svc({ get() { return undefined; } }, SERVICE.fs), undefined, "服务缺失 → undefined");
eq(svc({ get() { return null; } }, SERVICE.fs), undefined, "服务为 null → 归一为 undefined（调用方只需判 falsy）");
ok(svc({ get() { return marker; } }, SERVICE.fs) === marker, "服务存在 → 原样返回同一引用（不得包壳）");

// 关键不变量：宿主服务取值抛错时必须被吞掉，而不是把整个 DET 拖垮。
let threw = false;
try {
  const r = svc({ get() { throw new Error("cordis strict: service unavailable"); } }, SERVICE.llm);
  eq(r, undefined, "ctx.get 抛错 → 返回 undefined");
} catch (e) {
  threw = true;
}
ok(!threw, "svc() 绝不向外抛出（这是「单一子能力失败不拖垮整体」的基础）");

// ─────────────────────────────────────────────────────────────
section("svcWith() —— 能力式分流");

const withOpen = { open() {} };
const withoutOpen = { load() {} };
eq(svcWith({ get: () => withOpen }, SERVICE.sessionPersistence, "open"), withOpen, "具备所需方法 → 返回服务");
eq(svcWith({ get: () => withoutOpen }, SERVICE.sessionPersistence, "open"), undefined, "缺少所需方法 → undefined");
eq(svcWith({ get: () => undefined }, SERVICE.sessionPersistence, "open"), undefined, "服务缺失 → undefined");
eq(svcWith(null, SERVICE.sessionPersistence, "open"), undefined, "ctx 非法 → undefined");
eq(svcWith({ get: () => ({ open: "not-a-function" }) }, SERVICE.sessionPersistence, "open"), undefined, "同名属性不是函数 → undefined");

// ─────────────────────────────────────────────────────────────
section("架构守卫 —— Host 半区不得再有裸的 ctx.get(\"字面量\")");

const indexSrc = readFileSync(join(REPO, "lib", "index.js"), "utf8");
const rawSites = [...indexSrc.matchAll(/(?:this\.)?ctx\.get\("([A-Za-z0-9_]+)"\)/g)].map((m) => m[1]);
const uniq = [...new Set(rawSites)];
eq(uniq.length, 0, `lib/index.js 仍有未收敛的服务取值（应改用 svc(ctx, SERVICE.x)）：${uniq.join(", ") || "无"}`);

const useCount = (indexSrc.match(/svc\((?:this\.)?ctx, SERVICE\./g) || []).length;
ok(useCount >= 30, `lib/index.js 应已大规模使用接入层（当前 ${useCount} 处）`);

// 反向守卫：接入层自己当然要调用 ctx.get —— 但只允许在 adapt.js 里。
const adaptSrc = readFileSync(join(REPO, "lib", "adapt.js"), "utf8");
ok(adaptSrc.includes("ctx.get(name)"), "adapt.js 是唯一调用 ctx.get(name) 的地方");

// ─────────────────────────────────────────────────────────────
section("结果");
if (failures.length === 0) {
  console.log(`\n✅ 全部通过：${pass} 项断言`);
  console.log(`   · SERVICE 条目 ${keys.length} 个，index.js 接入层调用点 ${useCount} 处`);
  process.exit(0);
}
console.log(`\n❌ 失败 ${failures.length} 项 / 通过 ${pass} 项`);
for (const f of failures) console.log("   • " + f);
process.exit(1);

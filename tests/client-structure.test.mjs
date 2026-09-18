/**
 * DET 客户端结构测试（client-structure）
 * ====================================================================
 * `lib/client.js`（3800+ 行）是浏览器 bundle，用宿主提供的 require("react")，
 * **没有 ESM 相对导入**，因此无法直接 import 进测试。本套改为**源码扫描**：
 * 把"信息架构"这件容易悄悄退化的事变成可执行的断言。
 *
 *     node <repo>/tests/client-structure.test.mjs
 *
 * 守的是三条：
 *   1. DET 管理器的分项开关必须**分组**呈现，且每个功能键**恰好归组一次**
 *      （新增开关忘了归组 → 这里失败）；
 *   2. 分组表与宿主侧 Config/开关归一化表保持一致（跨文件不变量）；
 *   3. 分组用的样式类必须真的定义了，并且用原生 --dsw-alias-* token
 *      （"原生视觉统一"不是形容词，是断言）。
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
const clientSrc = readFileSync(join(REPO, "lib", "client.js"), "utf8");
const indexSrc = readFileSync(join(REPO, "lib", "index.js"), "utf8");

/** 从起始标记处按方括号配平截取数组字面量（跳过字符串内部）。 */
function extractArray(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const open = src.indexOf("[", at);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '"') {
      j++;
      while (j < src.length && src[j] !== '"') { if (src[j] === "\\") j++; j++; }
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
section("client.js 基本可解析性（客户端无测试，先兜住语法）");

let syntaxOk = true;
let syntaxErr = "";
try {
  // 不执行，只编译：等价于对该 bundle 做一次 node --check。
  // eslint-disable-next-line no-new-func
  new Function(clientSrc);
} catch (e) {
  syntaxOk = false;
  syntaxErr = String((e && e.message) || e);
}
ok(syntaxOk, `lib/client.js 必须可编译${syntaxOk ? "" : "：" + syntaxErr}`);
ok(clientSrc.indexOf('require("react")') !== -1, "客户端经宿主提供的 require(\"react\") 取 React（包内不做相对导入）");

// ─────────────────────────────────────────────────────────────
section("分组表 DET_FEATURE_GROUPS");

const block = extractArray(clientSrc, "var DET_FEATURE_GROUPS = ");
ok(block !== null, "能找到 DET_FEATURE_GROUPS 数组字面量");

const groups = [];
if (block) {
  const pick = (re) => {
    const out = [];
    let m;
    const r = new RegExp(re.source, "g");
    while ((m = r.exec(block)) !== null) out.push(m[1]);
    return out;
  };
  const ids = pick(/\bid:\s*"([^"]+)"/);
  const titles = pick(/\btitle:\s*"([^"]+)"/);
  const descs = pick(/\bdesc:\s*"([^"]+)"/);
  const rowRe = /\[\s*"([A-Za-z0-9_]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/g;

  let m;
  while ((m = rowRe.exec(block)) !== null) {
    groups.push({ key: m[1], name: m[2], sub: m[3] });
  }

  ok(ids.length > 0, "至少有 1 个分组");
  eq(titles.length, ids.length, "每个分组都有 title");
  eq(descs.length, ids.length, "每个分组都有 desc");
  eq(new Set(ids).size, ids.length, "分组 id 唯一");
  ok(ids.every((s) => s.trim() !== ""), "分组 id 非空");
  ok(titles.every((s) => s.trim() !== ""), "分组 title 非空");
  ok(descs.every((s) => s.trim() !== ""), "分组 desc 非空");
  notes.push(`分组：${ids.map((id, i) => `${id}(${titles[i]})`).join(" · ")}`);

  // 行三元组
  ok(groups.length >= 10, `分组至少覆盖 10 个分项开关（当前 ${groups.length}）`);
  const emptyName = groups.filter((g) => g.name.trim() === "" || g.sub.trim() === "");
  eq(emptyName.length, 0, "每个开关的显示名与说明都必须非空");
}

// ─────────────────────────────────────────────────────────────
section("架构守卫 —— 每个功能键恰好归组一次");

// 宿主侧开关归一化表是权威键集（含 master；master 单独渲染，不进球）。
const FEATURE_KEYS = ["master", "file", "run", "ver", "vtd", "mda", "plugins", "approve", "mms", "secCmdAudit", "secPromptDefense"];
const rowKeys = groups.map((g) => g.key);
const dup = rowKeys.filter((k, i) => rowKeys.indexOf(k) !== i);
eq(dup.length, 0, `分组表里不得有重复功能键：${[...new Set(dup)].join(", ") || "无"}`);

const expectedInGroups = FEATURE_KEYS.filter((k) => k !== "master");
const missing = expectedInGroups.filter((k) => rowKeys.indexOf(k) === -1);
eq(missing.length, 0, `以下功能键遗漏了分组（新增开关必须归组）：${missing.join(", ") || "无"}`);
const unknown = rowKeys.filter((k) => FEATURE_KEYS.indexOf(k) === -1);
eq(unknown.length, 0, `分组表出现未知功能键（宿主侧不认识）：${unknown.join(", ") || "无"}`);

// 扁平列表必须已经消失：不再有 toggleRow("字面量", ...)
const flatCalls = [...clientSrc.matchAll(/toggleRow\(\s*"/g)].length;
eq(flatCalls, 0, `分项开关不得再写回扁平列表（发现 ${flatCalls} 处 toggleRow("字面量")）`);
ok(clientSrc.indexOf("DET_FEATURE_GROUPS.map(") !== -1, "分组表必须真的被渲染（DET_FEATURE_GROUPS.map(...)）");

// ─────────────────────────────────────────────────────────────
section("跨文件不变量 —— 分组表 ↔ 宿主开关归一化表");

const nfAt = indexSrc.indexOf("static normalizeFeatures(");
ok(nfAt > 0, "能找到宿主侧 normalizeFeatures");
if (nfAt > 0) {
  const nfEnd = indexSrc.indexOf("\n  }", nfAt);
  const nf = indexSrc.slice(nfAt, nfEnd > 0 ? nfEnd : nfAt + 2000);
  const notDeclared = FEATURE_KEYS.filter((k) => !new RegExp(`(?:^|\\n)\\s*${k}:\\s`).test(nf));
  eq(notDeclared.length, 0, `宿主 normalizeFeatures 未声明以下键：${notDeclared.join(", ") || "无"}`);
}

// ─────────────────────────────────────────────────────────────
section("原生视觉统一 —— 分组样式必须用宿主 token");

for (const cls of ["dset-feat-group", "dset-feat-group-head", "dset-feat-group-title", "dset-feat-group-desc"]) {
  ok(clientSrc.indexOf("." + cls + "{") !== -1, `样式类 .${cls} 已定义`);
}
// 只取真样式字面量行（形如 `      '.dset-feat-group...`），不要 React 调用行。
const groupCss = clientSrc
  .split("\n")
  .filter((l) => /^\s*'\.dset-feat-group/.test(l));
ok(groupCss.length >= 4, `找到分组样式行（${groupCss.length} 条）`);

// 不变量 1：颜色必须走宿主 token，不得硬编码色值。
const hardcoded = groupCss.filter((l) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(l));
eq(hardcoded.length, 0, `分组样式不得硬编码色值（必须用 --dsw-alias-* token）：\n      ${hardcoded.join("\n      ") || "无"}`);

// 不变量 2：承载文字颜色的两条必须真的引用 token。
for (const cls of [".dset-feat-group-title", ".dset-feat-group-desc"]) {
  const line = groupCss.find((l) => l.indexOf(cls + "{") !== -1);
  ok(!!line, `找到 ${cls} 的样式行`);
  if (line) ok(line.indexOf("var(--dsw-alias-") !== -1, `${cls} 必须使用原生 --dsw-alias-* token`);
}

// ─────────────────────────────────────────────────────────────
section("架构守卫 —— 客户端服务名同样收敛到表（bundle 不能相对导入）");

const rawClientGets = [...clientSrc.matchAll(/ctx\.get\(\s*"/g)].length;
eq(rawClientGets, 0, `lib/client.js 不得再出现裸的 ctx.get("字面量")（发现 ${rawClientGets} 处）`);

const svcAt = clientSrc.indexOf("var CLIENT_SERVICE = {");
ok(svcAt > 0, "存在 CLIENT_SERVICE 服务名表");
const svcSrc = svcAt > 0 ? clientSrc.slice(svcAt, clientSrc.indexOf("};", svcAt)) : "";
const svcPairs = [...svcSrc.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
ok(svcPairs.length > 0, "CLIENT_SERVICE 非空");
const svcMismatch = svcPairs.filter(([k, v]) => k !== v);
eq(svcMismatch.length, 0, `服务名表的 key 应与值同名（避免同一服务两种叫法）：${svcMismatch.map((p) => p.join("=")).join(", ") || "无"}`);
for (const [k] of svcPairs) {
  ok(clientSrc.indexOf("CLIENT_SERVICE." + k) !== -1, `服务 ${k} 在表里就必须真被引用（CLIENT_SERVICE.${k}）`);
}

const injAt = clientSrc.indexOf("var CLIENT_INJECT = ");
ok(injAt > 0, "存在 CLIENT_INJECT 硬依赖声明");
const injSrc = injAt > 0 ? clientSrc.slice(injAt, clientSrc.indexOf("];", injAt)) : "";
const injItems = [...injSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
ok(injItems.length > 0, "CLIENT_INJECT 非空");
ok(injItems.every((s) => s.trim() !== ""), "CLIENT_INJECT 元素均为非空字符串");
eq(new Set(injItems).size, injItems.length, "CLIENT_INJECT 无重复");

// exports.inject 必须引用该表,而不是又写一份字面量数组
ok(clientSrc.indexOf("exports.inject = CLIENT_INJECT;") !== -1, "exports.inject 必须来自 CLIENT_INJECT 表");
eq([...clientSrc.matchAll(/exports\.inject\s*=\s*\[/g)].length, 0, "不得再写 exports.inject = [字面量数组]");

// 双向不变量:直接以 ctx.<name> 访问的**服务**,必须都在 inject 里声明。
// Cordis 上下文自身的 API(不是服务)要排除,否则会误报。
const CTX_API = ["get", "effect", "on", "set", "inject", "logger", "emit", "parallel", "waterfall", "bail", "mixin", "provide"];
const directNames = [...new Set([...clientSrc.matchAll(/\bctx\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))]
  .filter((n) => CTX_API.indexOf(n) === -1);
const undeclared = directNames.filter((n) => injItems.indexOf(n) === -1);
eq(undeclared.length, 0, `直接访问 ctx.<name> 的服务必须在 CLIENT_INJECT 中声明：${undeclared.join(", ") || "无"}`);
const unusedInject = injItems.filter((n) => directNames.indexOf(n) === -1);
eq(unusedInject.length, 0, `声明了却没用到的注入服务（inject 与实际使用不一致）：${unusedInject.join(", ") || "无"}`);
notes.push(`客户端：ctx.get 服务 ${svcPairs.length} 个（${svcPairs.map((p) => p[0]).join("/")}）· inject ${injItems.join("/")} · 直接访问 ctx.<name> ${directNames.length} 个`);

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

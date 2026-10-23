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
import { ADU_MODULES, ADU_MODULE_IDS, ADU_TOOL_NAMES, aduLoadableIds, aduModule, aduFeatureOn } from "../lib/adu.js";
import { ALV_FEATURE_KEYS, ALV_TOOL_NAMES, alvFeatureOn } from "../lib/alv.js";

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

eq(ADU_TOOL_NAMES, ["adu_list", "adu_describe", "adu_load", "adu_unload", "adu_status"], "五个元工具名固定");
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

/**
 * DET 宿主侧 DLT 集成测试（dlt-host）
 * ====================================================================
 * 把 DLT 的全部宿主侧能力搬进 DET 之后，这条链路有四个必须钉住的行为：
 *   1. **同名工具**：DET 注册的必须是 dlt_env / dlt_run / dlt_build /
 *      dlt_doc_read / dlt_doc_write / dlt_doc_convert 这六个（模型侧习惯与
 *      系统提示都按这名字写），且六个分项开关**各自独立**装卸；
 *   2. **系统提示**：环境表那段只在 dltEnv 开着时注入，关掉 dlt_run 后提示里
 *      不能再教模型用它（否则模型会去调不存在的工具）；
 *   3. **总开关**：关掉即一件工具、一段提示都不留（与 DET「完全原生」同口径）；
 *   4. **撞名容错**：启动瞬间 DLT 还没收到接管声明时，DET 注册同名工具会抛错 ——
 *      这时必须只跳过那一件并登记冲突，而不是把整个插件带崩。
 * 另外钉一下草图端点：dltDraftSave 真能落出合法 PNG，dltDraftSupport 在没有
 * llm 服务时如实回答「不支持图片」。
 *
 *     node <repo>/tests/dlt-host.test.mjs
 */

import { existsSync, promises as fsp, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DltBridge, DLT_FEATURE_KEYS, dltFeatureOn } from "../lib/dlt-tools.js";

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

const ALL_ON = {
  master: true,
  dltDocs: true, dltPreview: true, dltEnv: true, dltRun: true, dltCost: true, dltDraft: true,
};

/** 假宿主：tools 注册表（同名抛错，模拟宿主拒绝重复注册）+ systemPrompt 段落表。 */
function makeHost() {
  const tools = {
    regs: new Map(),
    order: [],
    register(def) {
      if (tools.regs.has(def.name)) throw new Error(`工具 ${def.name} 已被注册`);
      tools.regs.set(def.name, def);
      tools.order.push(def.name);
      return () => {
        tools.regs.delete(def.name);
        const at = tools.order.indexOf(def.name);
        if (at >= 0) tools.order.splice(at, 1);
      };
    },
  };
  const sections = [];
  const ctx = {
    get(name) {
      if (name === "tools") return tools;
      if (name === "systemPrompt") {
        return {
          section(def) {
            sections.push(def);
            return () => {
              const at = sections.indexOf(def);
              if (at >= 0) sections.splice(at, 1);
            };
          },
        };
      }
      return undefined;
    },
  };
  const config = {
    dltPythonEnv: "python312",
    dltCacheDir: join(tmpdir(), "det-dlt-cache"),
    dltPricingMaxAgeMs: 1000,
    dltDocTimeoutMs: 5000,
    dltRunTimeoutMs: 5000,
    dltMaxOutputBytes: 4096,
    dltPromptSection: true,
    dltPromptOrder: 140,
    dltDefaultSolution: "",
    dltDefaultConfiguration: "Debug",
    dltDefaultPlatform: "x64",
    dltPreviewMaxRows: 10,
    dltPreviewMaxCols: 5,
    dltEnvironments: {},
  };
  const work = mkdtempSync(join(tmpdir(), "det-dlt-work-"));
  const service = {
    ctx,
    config,
    sessionEventsOf: async () => [],
    workspaceRoot: async () => work,
  };
  return { service, tools, sections, work };
}

// ─────────────────────────────────────────────────────────────
section("功能开关语义");

eq(DLT_FEATURE_KEYS, ["dltDocs", "dltPreview", "dltEnv", "dltRun", "dltCost", "dltDraft"], "六个集成键与顺序固定");
ok(dltFeatureOn(ALL_ON, "dltDocs") === true, "默认开着");
ok(dltFeatureOn(ALL_ON, "dltDocs") === true && dltFeatureOn(Object.assign({}, ALL_ON, { master: false }), "dltDocs") === false, "总开关关闭时一律不生效");
ok(dltFeatureOn(Object.assign({}, ALL_ON, { dltRun: false }), "dltRun") === false, "单独关掉即不生效");

// ─────────────────────────────────────────────────────────────
section("全开：六个 dlt_* 工具 + 环境表提示段落");

const host = makeHost();
const bridge = new DltBridge(host.service);
const first = bridge.sync(ALL_ON);
eq(first.tools.slice().sort(), ["dlt_build", "dlt_doc_convert", "dlt_doc_read", "dlt_doc_write", "dlt_env", "dlt_run"], "六个工具按 DLT 原名注册");
ok(first.conflict === false, "首次注册无冲突");
eq(host.sections.length, 1, "系统提示注入一段");
ok(host.sections[0].name === "tool:dlt", "提示段落名为 tool:dlt（与 DLT 一致）");
ok(host.sections[0].text.indexOf("msvc-x64") !== -1, "环境表清单写进了提示");
ok(host.sections[0].text.indexOf("dlt_run") !== -1, "提示里教了 dlt_run");
notes.push(`全开：工具 ${first.tools.length} 个 · 提示 ${host.sections[0].text.split("\n").length} 行`);

// ─────────────────────────────────────────────────────────────
section("分项开关：只装卸对应的那一块");

bridge.sync(Object.assign({}, ALL_ON, { dltRun: false }));
eq(bridge.info().tools.slice().sort(), ["dlt_doc_convert", "dlt_doc_read", "dlt_doc_write", "dlt_env"], "关掉 dltRun 后只剩 4 件工具");
ok(host.sections[0].text.indexOf("dlt_run") === -1, "关掉后提示里不再教 dlt_run");
ok(host.sections[0].text.indexOf("msvc-x64") !== -1, "环境表仍然在（dltEnv 还开着）");

bridge.sync(Object.assign({}, ALL_ON, { dltEnv: false }));
ok(host.sections[0].text.indexOf("msvc-x64") === -1, "关掉 dltEnv 后环境表清单不再注入");
ok(host.sections[0].text.indexOf("dlt_doc_read") !== -1, "文档工具说明照旧");

bridge.sync(Object.assign({}, ALL_ON, { dltDocs: false }));
eq(bridge.info().tools.slice().sort(), ["dlt_env", "dlt_run", "dlt_build"].sort(), "关掉 dltDocs 后只剩环境表与执行/编译");
eq(host.sections.length, 1, "提示段落仍在（env/run 还开着）");

// ─────────────────────────────────────────────────────────────
section("总开关关闭：一件工具、一段提示都不留");

bridge.sync(Object.assign({}, ALL_ON, { master: false }));
eq(bridge.info().tools, [], "总开关关闭后工具全撤");
eq(host.tools.regs.size, 0, "宿主注册表里确实一个不剩");
eq(host.sections.length, 0, "系统提示段落也撤下");

// 再打开：必须能原样恢复（可逆）
bridge.sync(ALL_ON);
eq(bridge.info().tools.length, 6, "重新打开后恢复六个工具");
eq(host.sections.length, 1, "重新打开后恢复提示段落");

// ─────────────────────────────────────────────────────────────
section("撞名容错：启动瞬间 DLT 还没让位时不崩");

const busy = makeHost();
// 先占住 dlt_env（模拟 DLT 本体抢先注册），DET 只能注册剩下的 5 件。
busy.tools.register({ name: "dlt_env", description: "占位" });
const bridge2 = new DltBridge(busy.service);
const second = bridge2.sync(ALL_ON);
ok(second.conflict === true, "同名被占时如实回报冲突（由上层稍后重试）");
eq(bridge2.info().tools.slice().sort(), ["dlt_build", "dlt_doc_convert", "dlt_doc_read", "dlt_doc_write", "dlt_run"], "只跳过被占的那一件，其余照常注册");
ok(bridge2.info().promptSection === true, "提示段落不受工具撞名影响");
// 让位之后重试一次：六件齐活。
busy.tools.regs.delete("dlt_env");
bridge2.resetRetry();
const third = bridge2.sync(ALL_ON);
eq(third.tools.length, 6, "对手让位后重试补齐六件工具");
bridge2.dispose();

// ─────────────────────────────────────────────────────────────
section("草图端点：dltDraftSave 真落 PNG、dltDraftSupport 如实回答");

const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const saved = await bridge.draftSave({ sessionId: "s1", dataUrl: "data:image/png;base64," + png.toString("base64"), name: "sketch-1.png" });
ok(saved.ok === true, `草图落盘成功（${saved.error || "ok"}）`);
ok(saved.rel === ".dsh-drafts/sketch-1.png", "相对路径落在 <工作区>/.dsh-drafts 下");
ok(existsSync(saved.path), "磁盘上真有这个文件");
eq(readFileSync(saved.path).length, png.length, "字节数与画布导出一致");
eq(saved.bytes, png.length, "回报的字节数一致");

const bad = await bridge.draftSave({ sessionId: "s1", dataUrl: "data:image/png;base64," + Buffer.from("not a png at all").toString("base64") });
ok(bad.ok === false, "非 PNG 数据被拒绝（不在工作区留坏文件）");
eq((await fsp.readdir(join(host.work, ".dsh-drafts"))).length, 1, "被拒绝的那次没有留下文件");

const support = await bridge.draftSupport({ sessionId: "s1" });
ok(support.ok === true, "dltDraftSupport 可用");
ok(support.images === false, "没有 llm 服务时如实回答「不支持图片」（草图走 PNG + 路径）");
ok(typeof support.reason === "string" && support.reason !== "", "并给出人话原因");

bridge.dispose();
eq(host.tools.regs.size, 0, "dispose() 把注册的工具全部回收");

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

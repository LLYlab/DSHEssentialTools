/**
 * DET 全局插件状态机测试（gp-state）
 * ====================================================================
 * 这一套钉的是「在 DET 里禁用一个常驻插件，重启后它还会不会回来」这条链路上的
 * 三个真实缺陷（都是用户实测报出来的）：
 *
 *   1. **名字对不上**：profile 的 insert 行有两套名字（`id: dbs` vs `name: 'dsh-bgm-service'`），
 *      库里只记其中一套。只按 `entry.options.name` 匹配时永远找不到条目 →
 *      「禁用」在重启后一次都没落到 loader 上。→ `matchLoaderEntry` 容忍四种名字。
 *   2. **意图被事实覆盖**：`gpList` 以前拿 loader 的实际状态回写 `globallyEnabled`，
 *      把用户「禁用」的意图抹掉（档位还写着 disabled，却永远禁不掉）。
 *      → 意图单列成权威字段 `enabledIntent`；`permanentIntent` 优先读它，档位只保留
 *        「全局禁用」这个硬否决；`gpList` / `_applyPersistentPermanentStates` 一律**不再**
 *        拿 loader 的**事实**去覆盖意图（最后两段是源码守卫，防止旧写法回流）。
 *   4. **总开关静默回弹**：启动失败兜底 `_disableAllGlobalPlugins` 过去只写「记账字段」，
 *      于是下一次 `_applyPersistentPermanentStates` 又把插件装回来 —— 兜底等于没有。
 *      → 兜底与总开关暂停都写 `enabledIntent`，意图与恢复快照各司其职。
 *   3. **启动时应用从未执行**：`loader.await()` 会等 DET 自己那条 init 任务 → 死锁，
 *      启动健康记录停在 9 天前。 → 改成延迟 + 会话事件两脚（本套覆盖应用函数本身）。
 *
 *     node <repo>/tests/gp-state.test.mjs
 */

import { EssentialToolsService } from "../lib/index.js";

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

// ─────────────────────────────────────────────────────────────
section("matchLoaderEntry —— 四种名字都要认得（否则禁用永远落不到条目上）");

const ENTRIES = [
  { id: "include", options: { name: "cordis:include" }, subtree: {} },
  { id: "include:dbs", options: { id: "dbs", name: "dsh-bgm-service" } },
  { id: "include:topo", options: { id: "topo", name: "topo" } },
  { id: "include:dlt", options: { id: "dlt", name: "dsh-light-tool" } },
  { id: "group:1", options: { name: "some-group", group: true } },
];

const byName = EssentialToolsService.matchLoaderEntry(ENTRIES, "topo");
eq(byName && byName.entryId, "include:topo", "按 options.name 命中（topo）");

const byId = EssentialToolsService.matchLoaderEntry(ENTRIES, "dbs");
eq(byId && byId.entryId, "include:dbs", "记录里写 profile 的 id（dbs）也能命中包名条目 dsh-bgm-service");
eq(byId && byId.matchName, "dsh-bgm-service", "回报匹配到的真实名字（供记录自愈）");

const byTail = EssentialToolsService.matchLoaderEntry(ENTRIES, "dlt");
eq(byTail && byTail.entryId, "include:dlt", "按 entry id 末段（include:dlt → dlt）命中");

const byPkg = EssentialToolsService.matchLoaderEntry(ENTRIES, "dsh-light-tool");
eq(byPkg && byPkg.entryId, "include:dlt", "按包名（dsh-light-tool）命中");

eq(EssentialToolsService.matchLoaderEntry(ENTRIES, "DSH-LIGHT-TOOL") && true, true, "大小写不敏感兜底");
eq(EssentialToolsService.matchLoaderEntry(ENTRIES, "not-installed"), null, "找不到就如实返回 null");
eq(EssentialToolsService.matchLoaderEntry(ENTRIES, ""), null, "空名字返回 null");
eq(EssentialToolsService.matchLoaderEntry(ENTRIES, "some-group"), null, "分组/容器条目（options.group）不参与匹配");
notes.push(`条目 ${ENTRIES.length} 个，命中测试 8 项`);

// ─────────────────────────────────────────────────────────────
section("permanentIntent —— 意图的唯一权威是 enabledIntent（档位只保留「全局禁用」这个硬否决）");

// 硬否决：档位「全局禁用」按定义「拒绝任何启用」，对常驻插件同样成立。
eq(EssentialToolsService.permanentIntent({ level: "disabled", globallyEnabled: true }), { wantDisabled: true, source: "level=disabled(veto)" }, "档位=全局禁用 → 硬否决要停（哪怕 enabledIntent 说开）");
eq(EssentialToolsService.permanentIntent({ level: "disabled", enabledIntent: true }), { wantDisabled: true, source: "level=disabled(veto)" }, "档位=全局禁用 否决 enabledIntent=true");
// 二分开关的意图：与档位解耦，这正是「禁用不再被事实抹平」的关键。
eq(EssentialToolsService.permanentIntent({ level: "always", enabledIntent: false }), { wantDisabled: true, source: "enabledIntent" }, "enabledIntent=false → 要停（哪怕档位是全局启用）");
eq(EssentialToolsService.permanentIntent({ level: "ai-approve", enabledIntent: true }), { wantDisabled: false, source: "enabledIntent" }, "enabledIntent=true → 要开（档位保持 ai-approve 不被改写）");
// 旧记录（还没有 enabledIntent）的兼容推断：level 优先于会被记账污染的 globallyEnabled。
eq(EssentialToolsService.permanentIntent({ level: "always", globallyEnabled: false }), { wantDisabled: false, source: "legacy-level=always" }, "旧记录档位=全局启用 → 要开（总开关记账写的 globallyEnabled=false 不算数）");
eq(EssentialToolsService.permanentIntent({ level: "ai-auto", globallyEnabled: false }), { wantDisabled: true, source: "legacy-globallyEnabled=false" }, "旧记录非 always 档位上被显式禁用 → 要停");
eq(EssentialToolsService.permanentIntent({ level: "ai-approve" }), { wantDisabled: false, source: "legacy-level=ai-approve" }, "旧记录默认要开");
eq(EssentialToolsService.permanentIntent({}), { wantDisabled: false, source: "legacy-default" }, "空记录默认要开");

// ─────────────────────────────────────────────────────────────
section("_applyPersistentPermanentStates —— 意图真的落到 loader");

/** 造一个只暴露这三个面的假服务（其余靠原型方法）。 */
function makeService(plugins, entries, opts = {}) {
  const updates = [];
  const metaPatches = [];
  const entryList = entries.map((e) => Object.assign({}, e));
  const loader = {
    entries: () => entryList,
    async update(entryId, patch) {
      if (opts.updateThrows) throw new Error("loader.update 拒绝");
      updates.push({ entryId, patch });
      const hit = entryList.find((e) => e.id === entryId);
      if (hit && typeof patch.disabled === "boolean") hit.disabled = patch.disabled;
    },
  };
  // 用原型做壳：这样 this._loaderEntryByModule / _isContainerEntry 这些真方法都能用上，
  // 只把三个外部面（ctx.get('loader') / global / vtd）换成假的。
  const fake = Object.create(EssentialToolsService.prototype);
  Object.assign(fake, {
    ctx: { get: (name) => (name === "loader" ? loader : undefined) },
    global: {
      list: async () => ({ ok: true, plugins: plugins.map((p) => Object.assign({}, p)) }),
      updateMeta: async (id, patch) => { metaPatches.push({ id, patch }); return { ok: true }; },
    },
    vtd: {
      getSetting: async (key) => (key === "det.features" ? { ok: true, value: opts.features || { master: true } } : { ok: true, value: undefined }),
    },
    _updates: updates,
    _metaPatches: metaPatches,
    _entries: entryList,
  });
  return fake;
}

const PLUGINS = [
  {
    id: "gp-dbs", name: "dbs", permanent: true, moduleName: "dbs", level: "always", globallyEnabled: false,
  },
  {
    id: "gp-topo", name: "topo", permanent: true, moduleName: "topo", level: "disabled", globallyEnabled: true,
  },
  { id: "gp-dyn", name: "dynamic", permanent: false, level: "ai-approve", moduleName: "" },
];

const svc1 = makeService(PLUGINS, ENTRIES);
const report = await EssentialToolsService.prototype._applyPersistentPermanentStates.call(svc1, {});
eq(report.applied.length, 1, "只有「档位=全局禁用」的那条被应用");
eq(report.applied[0].id, "gp-topo", "应用的是 topo");
eq(report.applied[0].disabled, true, "应用方向是「禁用」");
eq(report.applied[0].intent, "level=disabled(veto)", "意图来源如实回报「档位硬否决」");
eq(svc1._updates.map((u) => u.entryId), ["include:topo"], "disable 真的发给了 loader 条目 include:topo");
eq(svc1._entries.find((e) => e.id === "include:topo").disabled, true, "loader 条目已停");

const dbsPatches = svc1._metaPatches.filter((p) => p.id === "gp-dbs");
eq(dbsPatches.length, 1, "dbs 记录被修了一次（moduleName 别名 + 意图字段迁移）");
eq(dbsPatches[0].patch, { moduleName: "dsh-bgm-service", enabledIntent: true, globallyEnabled: true }, "dbs 记录修成 loader 的真实名字，并把「启用」意图迁进权威字段 enabledIntent");
ok(!svc1._entries.find((e) => e.id === "include:dbs").disabled, "dbs 没有被误停（意图=启用）");
const topoPatches = svc1._metaPatches.filter((p) => p.id === "gp-topo");
eq(topoPatches.length, 1, "topo 的记录也修了");
eq(topoPatches[0].patch, { enabledIntent: false, globallyEnabled: false }, "topo 的 enabledIntent / globallyEnabled 与「禁用」意图对齐");
eq(report.skipped.filter((s) => s.id === "gp-dyn").length, 0, "非常驻插件不参与（也不进跳过清单）");
notes.push(`应用 ${report.applied.length} 条 · 修记录 ${svc1._metaPatches.length} 处 · 跳过 ${report.skipped.length} 条`);

// 已经是期望状态 → 什么都不做（幂等）
const svc2 = makeService(PLUGINS, ENTRIES.map((e) => (e.id === "include:topo" ? Object.assign({}, e, { disabled: true }) : e)));
const again = await EssentialToolsService.prototype._applyPersistentPermanentStates.call(svc2, {});
eq(again.applied.length, 0, "幂等：已是期望状态就不再动 loader");
ok(again.skipped.some((s) => s.id === "gp-topo"), "并在 skipped 里说明原因");

// 总开关关闭 = 完全原生：一件都不碰
const svc3 = makeService(PLUGINS, ENTRIES, { features: { master: false } });
const off = await EssentialToolsService.prototype._applyPersistentPermanentStates.call(svc3, {});
eq(svc3._updates.length, 0, "总开关关闭时不对 loader 做任何改动");
ok(typeof off.skippedAll === "string" && off.skippedAll.indexOf("总开关") !== -1, "并如实说明「总开关关闭」");

// loader.update 失败 → 如实进 failed，不假装成功
const svc4 = makeService(PLUGINS, ENTRIES, { updateThrows: true });
const bad = await EssentialToolsService.prototype._applyPersistentPermanentStates.call(svc4, {});
eq(bad.ok, false, "有失败时 ok=false");
eq(bad.failed.length, 1, "失败 1 条");
ok(bad.failed[0].reason.indexOf("拒绝") !== -1, "带上失败原因");

// 容器条目永不碰
const svc5 = makeService(
  [{ id: "gp-inc", name: "include", permanent: true, moduleName: "dbs", level: "disabled" }],
  [{ id: "include:dbs", options: { id: "dbs", name: "dsh-bgm-service" }, subtree: {} }],
);
const container = await EssentialToolsService.prototype._applyPersistentPermanentStates.call(svc5, {});
eq(svc5._updates.length, 0, "容器条目（有子树）绝不被停");
ok(container.skipped.some((s) => String(s.reason).indexOf("容器") !== -1), "并记进 skipped");

// ─────────────────────────────────────────────────────────────
section("gpSetPermanentEnabled —— 只改「装不装」，不销毁档位");

/** 造一个能跑 gpSetPermanentEnabled 的假服务。 */
function makeToggleService(rec, entries, opts = {}) {
  const updates = [];
  const metaPatches = [];
  const entryList = entries.map((e) => Object.assign({}, e));
  const loader = {
    entries: () => entryList,
    async update(entryId, patch) {
      updates.push({ entryId, patch });
      const hit = entryList.find((e) => e.id === entryId);
      if (hit && typeof patch.disabled === "boolean") hit.disabled = patch.disabled;
    },
  };
  const fake = Object.create(EssentialToolsService.prototype);
  Object.assign(fake, {
    ctx: { get: (name) => (name === "loader" ? loader : undefined) },
    global: {
      get: async () => ({ ok: true, plugin: Object.assign({}, rec) }),
      updateMeta: async (id, patch) => {
        metaPatches.push({ id, patch });
        Object.assign(rec, patch);
        return { ok: true, plugin: rec };
      },
    },
    _updates: updates,
    _metaPatches: metaPatches,
    _entries: entryList,
    _rec: rec,
  });
  return fake;
}

const TOGGLE_ENTRIES = [{ id: "include:topo", options: { id: "topo", name: "topo" } }];
const toggleRec = {
  id: "gp-topo", name: "topo", permanent: true, moduleName: "topo", level: "ai-approve", globallyEnabled: true,
};
const svcT = makeToggleService(toggleRec, TOGGLE_ENTRIES);
const offRes = await EssentialToolsService.prototype.gpSetPermanentEnabled.call(svcT, { id: "gp-topo", enabled: false });
eq(offRes.ok, true, "禁用成功");
eq(svcT._rec.enabledIntent, false, "意图写进权威字段 enabledIntent=false");
eq(svcT._rec.level, "ai-approve", "★ 五档档位原样保留，没有被改写成 disabled");
eq(svcT._entries[0].disabled, true, "loader 条目被实时卸下");
eq(offRes.actualEnabled, false, "如实回报 loader 的**实际**状态");
eq(offRes.levelUntouched, "ai-approve", "回报里带上「档位未被改动」");

// 再启用：档位仍是 ai-approve，但意图变回启用 → 装回来
const onRes = await EssentialToolsService.prototype.gpSetPermanentEnabled.call(svcT, { id: "gp-topo", enabled: true });
eq(onRes.ok, true, "启用成功");
eq(svcT._rec.enabledIntent, true, "意图写进 enabledIntent=true");
eq(svcT._rec.level, "ai-approve", "档位始终是 ai-approve（两次开关都没动它）");
eq(svcT._entries[0].disabled, false, "loader 条目被装回");

// 档位=全局禁用 是硬否决：说清楚，而不是「以为点了启用就装回来」
const vetoRec = {
  id: "gp-topo", name: "topo", permanent: true, moduleName: "topo", level: "disabled", enabledIntent: false, globallyEnabled: false,
};
const svcV = makeToggleService(vetoRec, TOGGLE_ENTRIES.map((e) => Object.assign({}, e, { disabled: true })));
const vetoRes = await EssentialToolsService.prototype.gpSetPermanentEnabled.call(svcV, { id: "gp-topo", enabled: true });
eq(vetoRes.ok, false, "档位=全局禁用时「启用」被拒绝");
ok(String(vetoRes.error).indexOf("全局禁用") !== -1, "并如实说明是档位否决了启用");
eq(svcV._updates.length, 0, "被否决时一个 loader 改动都不发");

// 名字是别名（记录写 profile 的 id，条目挂的是包名）：既要能落到条目上，
// 又要顺手把记录里的名字对齐，而且**不能**因为「拿旧名字去核对」而误报 applyError。
const aliasRec = {
  id: "gp-dbs", name: "dbs", permanent: true, moduleName: "dbs", level: "always", enabledIntent: true, globallyEnabled: true,
};
const svcA = makeToggleService(aliasRec, [{ id: "include:dbs", options: { id: "dbs", name: "dsh-bgm-service" } }]);
const aliasRes = await EssentialToolsService.prototype.gpSetPermanentEnabled.call(svcA, { id: "gp-dbs", enabled: false });
eq(aliasRes.ok, true, "别名名字下禁用成功（回到真正的 loader 条目）");
eq(svcA._updates.map((u) => u.entryId), ["include:dbs"], "改动作用在 include:dbs（不是凭空找一个叫 dbs 的条目）");
eq(svcA._entries[0].disabled, true, "loader 条目已停");
eq(aliasRes.moduleName, "dsh-bgm-service", "回报里带上对齐后的真实名字");
eq(aliasRes.actualEnabled, false, "实际状态取自**对齐后**的条目，所以不误报");
ok(!aliasRes.applyError, "★ 不得因为拿旧名字核对而误报 applyError");
eq(svcA._rec.moduleName, "dsh-bgm-service", "记录里的 moduleName 被就地修成 loader 那套");

// ─────────────────────────────────────────────────────────────
section("subordinateGrants().grants.sketchDraft —— 拆包后的「单拥有者」开关");

/**
 * 造一个能跑 subordinateGrants() 的假服务：只需要 vtd.getSetting。
 * 这条 grant 是「DET 与独立包 dsh-sketch-draft 谁挂那个铅笔按钮」的**唯一**判据，
 * 一旦它和 dltDraft 开关脱钩，输入框旁就会冒出两个按钮（或一个都没有）。
 */
function makeGrantService(features, subordinate) {
  const fake = Object.create(EssentialToolsService.prototype);
  Object.assign(fake, {
    vtd: {
      getSetting: async (key) => {
        if (key === "det.features") return { ok: true, value: features };
        if (key === "det.subordinate") return { ok: true, value: subordinate };
        return { ok: true, value: undefined };
      },
    },
  });
  return fake;
}

const grantAll = await makeGrantService({ master: true, dltDraft: true }, undefined).subordinateGrants();
eq(grantAll.grants.sketchDraft, true, "总开关开 + dltDraft 开 → 声明接管草图（独立包让位）");
eq(grantAll.grants.dlt, true, "同一套判据下 dlt 也被接管");

const grantDraftOff = await makeGrantService({ master: true, dltDraft: false }, undefined).subordinateGrants();
eq(grantDraftOff.grants.sketchDraft, false, "★ 关掉 dltDraft → 不再声明接管草图（独立包自动接手）");
eq(grantDraftOff.grants.dlt, true, "关草图不影响 DLT 的整体接管声明");

const grantMasterOff = await makeGrantService({ master: false, dltDraft: true }, undefined).subordinateGrants();
eq(grantMasterOff.grants.sketchDraft, false, "总开关关闭 → 不声明（完全原生口径）");

const grantSubOff = await makeGrantService({ master: true, dltDraft: true }, { enabled: false }).subordinateGrants();
eq(grantSubOff.grants.sketchDraft, false, "det.subordinate 关闭 → 不声明");

const grantSuppressed = await makeGrantService({ master: true, dltDraft: true }, { suppress: { dlt: false } }).subordinateGrants();
eq(grantSuppressed.grants.sketchDraft, false, "det.subordinate.suppress.dlt = false → 不声明");

// ─────────────────────────────────────────────────────────────
section("源码守卫 —— 防止「事实覆盖意图」与「强制整页刷新」回流");

const { readFileSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const { dirname, join } = await import("node:path");
const here = dirname(fileURLToPath(import.meta.url));
const hostSrc = readFileSync(join(here, "..", "lib", "index.js"), "utf8");
const clientSrc = readFileSync(join(here, "..", "lib", "client.js"), "utf8");

ok(hostSrc.indexOf("updateMeta(p.id, { globallyEnabled: actualEnabled })") === -1,
  "★ host 半区不再把 loader 的**事实**回写进意图字段（旧写法会抹掉「禁用」意图 → 重启回弹）");
ok(hostSrc.indexOf("updateMeta(id, { globallyEnabled: enabled, level:") === -1,
  "★ gpSetPermanentEnabled 不再把档位改写成 always/disabled");
ok(hostSrc.indexOf('{ enabledIntent: false, globallyEnabled: false }') !== -1,
  "总开关暂停/兜底会写 enabledIntent=false（兜底不再被下一次「应用」悄悄撤销）");
ok(hostSrc.indexOf('{ enabledIntent: true, globallyEnabled: true }') !== -1,
  "恢复路径会写 enabledIntent=true");
// 客户端：常驻插件启停**不得**自动刷新整页（那会把 DET 自己的界面与操作现场一起重置）。
ok(clientSrc.indexOf("自动刷新前端以生效") === -1,
  "★ 客户端不再自动整页刷新（用户报的「关掉插件反而影响了 DET 自带功能/UI」）");
ok(clientSrc.indexOf('onClick: reloadFrontend') !== -1,
  "改成用户显式点「刷新前端」才刷新");
notes.push(`源码守卫：host ${hostSrc.length} 字符 · client ${clientSrc.length} 字符`);

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

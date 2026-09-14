// pause.test.mjs — DET「总开关关闭 ⇒ 停用 DET 管控插件」这段逻辑的回归测试
//
// 两条真实事故钉在这里:
//   1) 上一版把 `cordis:include` 这个**容器**也当插件停 —— include 持有整份 cordis.yml
//      的子树(dbs/dlt/topo 都是它的孩子 `include:xxx`),动它等于拆树,include 那侧
//      随后按配置重建孩子,刚停掉的插件又被拉起来。
//   2) 上一版还靠「盲扫 loader 里所有非框架常驻条目」找目标,于是把**不属于 DET 的
//      DLT** 也一起停了。
// 现在的界限:总开关只管「DET 全局插件库」里的插件(记录需绑定 moduleName),
// 容器永不碰、不在库里的常驻插件(如 dlt)永不碰、绑定不上的如实报 unmanaged。
//
// 用**假 loader/假存储**驱动真实方法实现(从 lib/index.js 取原型方法),不用起 DSH。
//
//     cd C:\Users\L2959\.dsh\profiles\web   (或任何能解析 @deepseek-ai/* 的目录)
//     node C:\Users\L2959\.dsh\profiles\node_modules\dsh-essential-tools\tests\pause.test.mjs

const MODULE = process.env.DET_MODULE || 'dsh-essential-tools'
const det = await import(MODULE)
const proto = det.EssentialToolsService.prototype

let pass = 0
let fail = 0
const fails = []
const section = (t) => console.log(`\n=== ${t} ===`)
const ok = (l, extra = '') => { console.log(`  [ ok ] ${l}${extra ? '  → ' + extra : ''}`); pass++ }
const bad = (l, why) => { console.log(`  [FAIL] ${l}  → ${why}`); fail++; fails.push(`${l}: ${why}`) }
async function check(label, fn) {
  try { const extra = await fn(); ok(label, extra || '') } catch (e) { bad(label, e && e.message ? e.message : String(e)) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

// ── 假 loader:结构照着真实 cordis loader(include 容器 + include:xxx 孩子)摆 ──
function makeEntry(id, name, opts = {}) {
  return {
    id,
    options: { id, name },
    disabled: opts.disabled === true,
    fiber: opts.noFiber ? undefined : { state: opts.state === undefined ? 2 : opts.state },
    subtree: opts.subtree ? {} : undefined,
  }
}
function makeLoader() {
  const entries = [
    makeEntry('include', 'cordis:include', { subtree: true }),
    makeEntry('include:dbs', 'dbs'),
    makeEntry('include:topo', 'topo'),
    makeEntry('include:dlt', 'dlt'),           // ← 不属于 DET:任何情况下都不许动
    makeEntry('include:stubborn', 'stubborn'),
    makeEntry('include:dsh-essential-tools', 'dsh-essential-tools'),
    makeEntry('include:framework', '@deepseek-ai/dsh-tools'),
  ]
  const calls = []
  const loader = {
    entries: () => entries.slice(),
    async update(id, options) {
      calls.push({ id, options: { ...options } })
      const entry = entries.find((e) => e.id === id)
      if (!entry) throw new Error('cannot resolve entry ' + id)
      // stubborn 模拟「怎么停都停不下来」的插件(用来验证核对与如实上报)。
      if (entry.options.name === 'stubborn' && options.disabled === true) return
      entry.disabled = options.disabled === true
      if (entry.disabled) entry.fiber = undefined
      else if (!entry.fiber) entry.fiber = { state: 2 }
    },
  }
  return { loader, entries, calls }
}

// ── 假全局插件库 + 假 VTD 存储 ──────────────────────────────────────────────
function makeStore(records) {
  const table = new Map(records.map((r) => [r.id, JSON.parse(JSON.stringify(r))]))
  return {
    table,
    async list() { return { ok: true, plugins: [...table.values()].map((r) => JSON.parse(JSON.stringify(r))) } },
    async get(id) { const row = table.get(id); return row ? { ok: true, plugin: JSON.parse(JSON.stringify(row)) } : { ok: false, error: '插件不存在: ' + id } },
    async updateMeta(id, patch) {
      const row = table.get(id)
      if (!row) return { ok: false, error: '插件不存在' }
      Object.assign(row, patch)
      return { ok: true, plugin: row }
    },
    async markSession(id, sid, pluginId, packageId, by, state) {
      const row = table.get(id)
      if (!row) return { ok: false, error: '插件不存在: ' + id }
      row.sessions = row.sessions || {}
      row.sessions[sid] = { pluginId, packageId, by, state }
      return { ok: true, plugin: row }
    },
  }
}
function makeVtd() {
  const settings = new Map()
  return {
    settings,
    async getSetting(key) { return { ok: true, value: settings.has(key) ? settings.get(key) : undefined } },
    async setSetting(key, value) { settings.set(key, value); return { ok: true } },
  }
}

function makeService() {
  const { loader, entries, calls } = makeLoader()
  const global = makeStore([
    // 库里、绑定了常驻条目 → 归 DET 管
    { id: 'gp-dbs', name: 'dbs', level: 'always', permanent: true, moduleName: 'dbs', globallyEnabled: true, sessions: { s1: { state: 'enabled' } } },
    { id: 'gp-topo', name: 'TOPO 偷跑', level: 'disabled', permanent: true, moduleName: 'topo', globallyEnabled: true, sessions: {} },
    { id: 'gp-stubborn', name: '停不下来的', level: 'always', permanent: true, moduleName: 'stubborn', globallyEnabled: true, sessions: {} },
    // 库里但没绑定 loader 条目 → 停不了,应如实进 unmanaged
    { id: 'gp-loose', name: '未绑定的常驻', level: 'always', permanent: true, globallyEnabled: true, sessions: {} },
    // 库里但绑定到容器 → 整条跳过
    { id: 'gp-container', name: '误入库的容器', level: 'always', permanent: true, moduleName: 'cordis:include', globallyEnabled: true, sessions: {} },
    // 库里的纯动态插件(只有会话实例)
    { id: 'gp-sessiononly', name: '会话内的动态插件', level: 'always', permanent: false, globallyEnabled: true, sessions: { s1: { state: 'enabled' } } },
  ])
  const vtd = makeVtd()
  const stopped = []
  const svc = {
    ctx: { get: (name) => (name === 'loader' ? loader : null) },
    global,
    vtd,
    masterEnabled: true,
    // 真实实现(从原型取,保证测的是被测代码而不是复制品)
    _loaderEntryByModule: proto._loaderEntryByModule,
    _isContainerEntry: proto._isContainerEntry,
    _entryRuntimeState: proto._entryRuntimeState,
    _pauseItemState: proto._pauseItemState,
    _verifyPause: proto._verifyPause,
    _disableAllGlobalPlugins: proto._disableAllGlobalPlugins,
    _pauseManagedPlugins: proto._pauseManagedPlugins,
    _resumeManagedPlugins: proto._resumeManagedPlugins,
    gpMasterState: proto.gpMasterState,
    // 停会话实例:真实实现会删掉该会话的启用映射(这里照做)
    async _stopSession(p, sid) {
      stopped.push(p.id + '#' + sid)
      const row = global.table.get(p.id)
      if (row && row.sessions) delete row.sessions[sid]
    },
    _permanentActual: proto._permanentActual,
    _installedRow: proto._installedRow,
  }
  return { svc, loader, entries, calls, global, vtd, stopped }
}

// ── 用例 ────────────────────────────────────────────────────────────────────

section('停用清单:只管库里的插件')
const ctx1 = makeService()
let paused = null
let unmanaged = null
await check('_pauseManagedPlugins 只列库记录,且容器/未绑定不入列', async () => {
  const res = await ctx1.svc._pauseManagedPlugins()
  paused = res.paused
  unmanaged = res.unmanaged
  const ids = paused.map((p) => p.id).sort()
  assert(ids.join(',') === 'gp-dbs,gp-sessiononly,gp-stubborn,gp-topo', '清单不对: ' + ids.join(','))
  assert(!ids.includes('gp-container'), '容器记录入了列')
  assert(!ids.includes('gp-loose'), '未绑定记录不该进停用清单')
  return '清单: ' + ids.join(', ')
})

await check('DLT 不属于 DET:全程不碰(用户更正)', async () => {
  const touched = ctx1.calls.map((c) => c.id)
  assert(!touched.includes('include:dlt'), 'loader.update 动了 DLT: ' + touched.join(','))
  const dlt = ctx1.entries.find((e) => e.options.name === 'dlt')
  assert(dlt.disabled === false && dlt.fiber, 'DLT 被停掉了')
  assert(!unmanaged.some((u) => u.name === 'dlt'), 'DLT 不该出现在 unmanaged 里')
  return 'dlt 未被 update、仍 enabled'
})

await check('容器 cordis:include 全程不碰', async () => {
  const touched = ctx1.calls.map((c) => c.id)
  assert(!touched.includes('include'), 'loader.update 动了 include 容器: ' + touched.join(','))
  const include = ctx1.entries.find((e) => e.id === 'include')
  assert(include.disabled === false, '容器被停用了')
  return 'include 未被 update、仍 enabled'
})

await check('库里绑定的插件真的停掉(含 topo / 会话实例)', async () => {
  for (const name of ['dbs', 'topo']) {
    assert(ctx1.entries.find((e) => e.options.name === name).disabled === true, name + ' 还没停')
  }
  const sessionOnly = ctx1.global.table.get('gp-sessiononly')
  assert(Object.keys(sessionOnly.sessions).length === 0, 'gp-sessiononly 的会话实例没停')
  const applied = paused.filter((p) => p.applied === true).length
  return `dbs/topo 已停 · 会话实例已停 · applied=${applied}/${paused.length}`
})

await check('停不下来的:补一次 + 如实记 applied=false', async () => {
  const stubborn = paused.find((p) => p.moduleName === 'stubborn')
  assert(stubborn && stubborn.applied === false, 'stubborn 应记 applied=false')
  assert(stubborn.reason && stubborn.reason.includes('仍在运行'), '缺少可读原因: ' + stubborn.reason)
  const tries = ctx1.calls.filter((c) => c.id === 'include:stubborn' && c.options.disabled === true).length
  assert(tries >= 2, '没有补刀(应 update ≥2 次,实为 ' + tries + ')')
  return `重试 ${tries} 次 · ${stubborn.reason}`
})

await check('库里绑定不上的如实进 unmanaged(不是靠猜名字去停)', async () => {
  assert(unmanaged.length === 1 && unmanaged[0].id === 'gp-loose', 'unmanaged 不对: ' + JSON.stringify(unmanaged))
  assert(unmanaged[0].reason.includes('没有绑定'), '原因没说清: ' + unmanaged[0].reason)
  const saved = ctx1.vtd.settings.get('det.master.unmanaged')
  assert(Array.isArray(saved) && saved.length === 1, 'unmanaged 没落盘')
  return unmanaged[0].reason.slice(0, 40) + '…'
})

await check('快照落盘带核对结果(det.master.paused)', async () => {
  const snap = ctx1.vtd.settings.get('det.master.paused')
  assert(Array.isArray(snap) && snap.length === paused.length, '快照没写或长度不对')
  assert(snap.every((x) => typeof x.applied === 'boolean'), '快照里没有 applied 字段')
  return `${snap.length} 条(含 applied)`
})

await check('gpMasterState 如实汇总(已确认/未能停用/未绑定)', async () => {
  const info = await ctx1.svc.gpMasterState({})
  assert(info.pausedCount === paused.length, 'pausedCount 不对')
  assert(info.stoppedCount === paused.length - 1, '已确认数应为 ' + (paused.length - 1) + ',实为 ' + info.stoppedCount)
  assert(info.failedCount === 1, '未能停用数应为 1,实为 ' + info.failedCount)
  assert(info.unmanagedCount === 1, 'unmanagedCount 应为 1,实为 ' + info.unmanagedCount)
  return `确认 ${info.stoppedCount} / 失败 ${info.failedCount} / 未绑定 ${info.unmanagedCount}`
})

section('恢复:旧快照里的越界条目不会被 DET 乱动')
// 真实遗留数据:老版本把 installed:cordis:include 与 installed:dlt 写进了 det.master.paused。
// 打开总开关时要恢复「当时被停的那些」,但绝不 update 容器。
const ctx3 = makeService()
// 快照里只有这三条 → 只有它们该被恢复(dbs 走库记录、dlt 走 loader、include 是容器要跳过)。
for (const name of ['dbs', 'dlt']) {
  const entry = ctx3.entries.find((e) => e.options.name === name)
  entry.disabled = true
  entry.fiber = undefined
}
ctx3.vtd.settings.set('det.master.paused', [
  { id: 'gp-dbs', name: 'dbs', kind: 'library', permanent: true, moduleName: 'dbs', sessions: { s1: { state: 'enabled', pluginId: 'permanent', by: 'auto' } } },
  { id: 'installed:cordis:include', name: 'cordis:include', kind: 'installed', permanent: true, moduleName: 'cordis:include', sessions: {} },
  { id: 'installed:dlt', name: 'dlt', kind: 'installed', permanent: true, moduleName: 'dlt', sessions: {} },
])
await check('容器被跳过;DLT 按旧快照恢复;库里记录照常恢复', async () => {
  const res = await ctx3.svc._resumeManagedPlugins()
  assert(res.skipped.includes('installed:cordis:include'), '没跳过容器: ' + JSON.stringify(res.skipped))
  assert(!ctx3.calls.some((c) => c.id === 'include'), '动了 include 容器: ' + ctx3.calls.map((c) => c.id).join(','))
  assert(ctx3.entries.find((e) => e.options.name === 'dlt').disabled === false, 'DLT 没按快照恢复')
  assert(ctx3.entries.find((e) => e.options.name === 'dbs').disabled === false, 'dbs 没恢复')
  const dbs = ctx3.global.table.get('gp-dbs')
  assert(dbs.globallyEnabled === true && dbs.sessions.s1 && dbs.sessions.s1.state === 'enabled', 'gp-dbs 记录/会话没还原')
  assert(ctx3.vtd.settings.get('det.master.paused').length === 0, '快照没清空')
  return '已恢复 ' + res.resumed.join(',') + ' · 跳过 ' + res.skipped.join(',')
})

section('插件管理开关:范围同样是「库里的插件」')
const ctx2 = makeService()
await check('_disableAllGlobalPlugins 不碰容器、不碰未绑定记录、不碰 DLT', async () => {
  const res = await ctx2.svc._disableAllGlobalPlugins('det-feature-off')
  assert(res.ok === true, '返回失败')
  const touched = ctx2.calls.map((c) => c.id)
  assert(!touched.includes('include'), '动了 include 容器: ' + touched.join(','))
  assert(!touched.includes('include:dlt'), '动了 DLT: ' + touched.join(','))
  assert(ctx2.global.table.get('gp-container').globallyEnabled === true, '容器记录的全局开关被改了')
  assert(ctx2.entries.find((e) => e.options.name === 'dbs').disabled === true, 'dbs 没被停')
  assert(ctx2.entries.find((e) => e.options.name === 'topo').disabled === true, 'topo 没被停')
  return 'dbs/topo 已停 · 容器与 dlt 未动'
})

console.log(`\n=== 结果: pass=${pass} fail=${fail} ===`)
if (fails.length) { console.log('失败项:'); fails.forEach((x) => console.log('  - ' + x)) }
process.exit(fail ? 1 : 0)

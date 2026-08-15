// DSHEssentialTools — Host 半区（DSH 动态 Cordis 插件）
// 用法：把本文件内部 `return { apply(ctx) { ... } }` 部分作为 cordis_define 的 code.host
// （去掉外层 `export default function () {` 与结尾的 `}`，或直接粘贴整个函数体）

export default function () {
  return {
    apply(ctx) {
      const fs = ctx.get('fs')
      const subprocess = ctx.get('subprocess')
      const sessionQuery = ctx.get('sessionQuery')
      const sessions = ctx.get('sessions')
      const sessionTitle = ctx.get('sessionTitle')
      if (fs === undefined || subprocess === undefined) {
        console.error('lval: fs 或 subprocess 服务不可用')
        return
      }

      const NL = String.fromCharCode(10)
      const ROOT = 'C:\\Users\\L2959\\Desktop\\项目\\LVAL'
      const SRC_DIR = ROOT + '\\LVAL'
      const SOLUTION = ROOT + '\\LVAL.slnx'
      const MSBUILD = 'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe'
      const CONFIG = 'Debug'
      const PLATFORM = 'x64'
      const EXE = ROOT + '\\x64\\' + CONFIG + '\\LVAL.exe'
      const VERS_DIR = ROOT + '\\.lval-versions'
      const MANIFEST = VERS_DIR + '\\versions.json'

      const SOURCE_EXT = { '.h': 1, '.hpp': 1, '.hh': 1, '.hxx': 1, '.inl': 1, '.c': 1, '.cpp': 1, '.cc': 1, '.cxx': 1, '.rc': 1, '.json': 1, '.slnx': 1, '.sln': 1, '.vcxproj': 1, '.md': 1, '.txt': 1, '.py': 1, '.cs': 1, '.js': 1, '.ts': 1, '.yaml': 1, '.yml': 1, '.xml': 1, '.props': 1, '.targets': 1 }
      const SKIP_DIRS = { 'x64': 1, 'debug': 1, 'release': 1, '.vs': 1, '.git': 1, 'microsoft': 1, 'vcpkg_installed': 1, 'out': 1, '.lval-versions': 1 }

      const safeRel = (rel) => {
        if (typeof rel !== 'string') return null
        const r = rel.replace(/\\/g, '/')
        if (r === '' || r.charAt(0) === '/') return null
        if (r.indexOf('..') !== -1) return null
        if (/^[A-Za-z]:/.test(r)) return null
        return r
      }

      const collectSourceFiles = async () => {
        const out = []
        const seen = {}
        const walk = async (target, rel) => {
          if (out.length >= 400) return
          let entries
          try {
            entries = await fs.listDir(target)
          } catch (e) {
            return
          }
          for (const entry of entries) {
            if (entry.type === 'directory') {
              const n = entry.name.toLowerCase()
              if (SKIP_DIRS[n]) continue
              await walk(entry.target, rel + '/' + entry.name)
            } else {
              const dot = entry.name.lastIndexOf('.')
              if (dot < 0) continue
              const ext = entry.name.slice(dot).toLowerCase()
              if (!SOURCE_EXT[ext]) continue
              const p = (rel + '/' + entry.name).slice(1)
              if (seen[p]) continue
              seen[p] = 1
              out.push({ rel: p, size: entry.size || 0, target: entry.target })
            }
          }
        }
        try {
          const srcTarget = await fs.resolve(SRC_DIR)
          await walk(srcTarget, '')
        } catch (e) { /* ignore */ }
        return out
      }

      const readManifest = async () => {
        try {
          const target = await fs.resolve(MANIFEST)
          const stat = await fs.stat(target)
          if (!stat || stat.type !== 'file') return []
          const text = await fs.readText(target)
          const data = JSON.parse(text)
          return Array.isArray(data) ? data : []
        } catch (e) {
          return []
        }
      }

      const writeManifest = async (list) => {
        try {
          const target = await fs.resolve(MANIFEST)
          await fs.writeText(target, JSON.stringify(list, null, 2))
        } catch (e) { /* ignore */ }
      }

      const snapshotOnce = async (label) => {
        const id = 'v' + String(Date.now())
        const dir = VERS_DIR + '\\' + id
        let count = 0
        try {
          const files = await collectSourceFiles()
          for (const f of files) {
            const content = await fs.readText(f.target)
            const dst = await fs.resolve(dir + '\\' + f.rel)
            await fs.writeText(dst, content)
            count++
          }
          const slnTarget = await fs.resolve(SOLUTION)
          const slnStat = await fs.stat(slnTarget)
          if (slnStat && slnStat.type === 'file') {
            const content = await fs.readText(slnTarget)
            const dst = await fs.resolve(dir + '\\LVAL.slnx')
            await fs.writeText(dst, content)
            count++
          }
        } catch (e) {
          return { ok: false, error: '快照写入失败: ' + String(e && e.message ? e.message : e), id: id }
        }
        const list = await readManifest()
        list.push({ id: id, label: label || '', time: Date.now(), fileCount: count })
        await writeManifest(list)
        return { ok: true, id: id, fileCount: count }
      }

      harness.handle('lval-info', async () => {
        return {
          root: ROOT,
          sourceDir: SRC_DIR,
          solution: SOLUTION,
          msbuild: MSBUILD,
          configuration: CONFIG,
          platform: PLATFORM,
          exe: EXE,
        }
      })

      harness.handle('lval-list-files', async () => {
        const files = await collectSourceFiles()
        files.sort(function (a, b) { return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0 })
        return { files: files.map(function (f) { return { path: f.rel, name: f.rel.split('/').pop(), size: f.size } }) }
      })

      harness.handle('lval-read-file', async (args) => {
        const rel = safeRel(args && args.path)
        if (rel === null) return { error: '非法路径' }
        const full = SRC_DIR + '\\' + rel.replace(/\//g, '\\')
        try {
          const target = await fs.resolve(full)
          const stat = await fs.stat(target)
          if (!stat || stat.type !== 'file') return { error: '文件不存在: ' + rel }
          if (stat.size !== undefined && stat.size > 2 * 1024 * 1024) return { error: '文件过大(>2MB): ' + rel }
          const content = await fs.readText(target)
          return { content: content, path: rel }
        } catch (e) {
          return { error: '读取失败: ' + String(e && e.message ? e.message : e) }
        }
      })

      const buildOnce = async () => {
        let handle
        try {
          handle = subprocess.spawn({
            argv: [MSBUILD, SOLUTION, '-p:Configuration=' + CONFIG, '-p:Platform=' + PLATFORM, '-m', '-v:m', '-nologo'],
            cwd: ROOT,
            stdio: {
              stdin: 'ignore',
              stdout: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
              stderr: { maxBytes: 1024 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
            },
            graceMs: 30000,
          })
        } catch (e) {
          return { ok: false, exitCode: -1, output: '启动 MSBuild 失败: ' + String(e && e.message ? e.message : e) }
        }
        let outcome
        try {
          outcome = await handle.done
        } catch (e) {
          return { ok: false, exitCode: -1, output: 'MSBuild 运行失败: ' + String(e && e.message ? e.message : e) }
        }
        let out = ''
        let err = ''
        try { out = handle.collected.stdout.readFrom(0).text || '' } catch (e) { /* ignore */ }
        try { err = handle.collected.stderr.readFrom(0).text || '' } catch (e) { /* ignore */ }
        const text = (out + NL + err).replace(/\n{3,}/g, NL + NL).trim()
        return { ok: outcome.exitCode === 0, exitCode: outcome.exitCode, output: text }
      }

      const runExe = async () => {
        try {
          const target = await fs.resolve(EXE)
          const stat = await fs.stat(target)
          if (!stat || stat.type !== 'file') return { ok: false, error: '未找到 ' + EXE + '，请先编译' }
        } catch (e) {
          return { ok: false, error: '未找到 ' + EXE + '，请先编译' }
        }
        try {
          const handle = subprocess.spawn({
            argv: [EXE],
            cwd: ROOT,
            stdio: { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' },
            graceMs: 5000,
          })
          return { ok: true, pid: handle.pid }
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e) }
        }
      }

      harness.handle('lval-build', async () => buildOnce())
      harness.handle('lval-run', async () => runExe())
      harness.handle('lval-build-run', async () => {
        const build = await buildOnce()
        if (!build.ok) return { ok: build.ok, exitCode: build.exitCode, output: build.output, run: null }
        const run = await runExe()
        return { ok: build.ok, exitCode: build.exitCode, output: build.output, run: run }
      })

      harness.handle('lval-ver-snapshot', async (args) => {
        const label = args && args.label ? String(args.label).slice(0, 60) : ''
        return snapshotOnce(label)
      })

      harness.handle('lval-ver-list', async () => {
        const list = await readManifest()
        list.sort(function (a, b) { return (b.time || 0) - (a.time || 0) })
        return { versions: list }
      })

      harness.handle('lval-ver-restore', async (args) => {
        const id = args && args.id ? String(args.id) : ''
        if (id === '') return { ok: false, error: '缺少版本 id' }
        let backup
        try {
          backup = await snapshotOnce('回退前自动备份 ' + id)
        } catch (e) {
          backup = null
        }
        const dir = VERS_DIR + '\\' + id
        let dirTarget
        try {
          dirTarget = await fs.resolve(dir)
        } catch (e) {
          return { ok: false, error: '版本目录不存在' }
        }
        const st = await fs.stat(dirTarget)
        if (!st || st.type !== 'directory') return { ok: false, error: '版本 ' + id + ' 不存在' }
        let restored = 0
        const walkRestore = async (target, rel) => {
          let entries
          try {
            entries = await fs.listDir(target)
          } catch (e) {
            return
          }
          for (const entry of entries) {
            if (entry.type === 'directory') {
              await walkRestore(entry.target, rel + '/' + entry.name)
            } else {
              const content = await fs.readText(entry.target)
              const dst = await fs.resolve(ROOT + '\\' + (rel + '/' + entry.name).slice(1).replace(/\//g, '\\'))
              await fs.writeText(dst, content)
              restored++
            }
          }
        }
        try {
          await walkRestore(dirTarget, '')
        } catch (e) {
          return { ok: false, error: '回退失败: ' + String(e && e.message ? e.message : e) }
        }
        return { ok: true, restored: restored, backupId: backup ? backup.id : null }
      })

      harness.handle('lval-ver-delete', async (args) => {
        const id = args && args.id ? String(args.id) : ''
        if (id === '') return { ok: false, error: '缺少版本 id' }
        try {
          const handle = subprocess.spawn({
            argv: ['cmd.exe', '/c', 'rmdir', '/s', '/q', VERS_DIR + '\\' + id],
            cwd: ROOT,
            stdio: {
              stdin: 'ignore',
              stdout: { maxBytes: 4096 },
              stderr: { maxBytes: 4096 },
            },
            graceMs: 10000,
          })
          await handle.done
        } catch (e) {
          return { ok: false, error: '删除失败: ' + String(e && e.message ? e.message : e) }
        }
        const list = await readManifest()
        const next = list.filter(function (v) { return v.id !== id })
        await writeManifest(next)
        return { ok: true }
      })

      harness.handle('lval-sessions', async () => {
        if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery 服务不可用', sessions: [] }
        let records
        try {
          records = await sessionQuery.listSessions()
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e), sessions: [] }
        }
        const ids = records.map(function (r) { return r.header && r.header.id ? r.header.id : '' })
        const titles = {}
        try {
          const obs = await sessionQuery.readTitleSnapshots(ids)
          for (const o of obs) {
            if (o.status === 'fulfilled' && o.value && o.value.title && o.value.title.text) titles[o.sessionId] = o.value.title.text
          }
        } catch (e) { /* ignore */ }
        const out = records.map(function (r) {
          const h = r.header || {}
          return {
            id: h.id || '',
            title: titles[h.id] || h.id || '',
            createdAt: h.createdAt || 0,
            cwd: h.cwd || '',
            live: !!r.live,
            persisted: !!r.persisted,
            parent: h.parentSession || '',
          }
        })
        out.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
        return { ok: true, sessions: out }
      })

      harness.handle('lval-session-rename', async (args) => {
        const id = args && args.id ? String(args.id) : ''
        const title = args && args.title ? String(args.title).trim() : ''
        if (id === '' || title === '') return { ok: false, error: '缺少会话 id 或标题' }
        if (sessions === undefined || sessionTitle === undefined) return { ok: false, error: '会话服务不可用' }
        const session = sessions.get(id)
        if (!session) return { ok: false, error: '会话未在运行中，请先打开再重命名' }
        try {
          sessionTitle.rename(session, title)
          return { ok: true, title: title }
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e) }
        }
      })
    },
  }
}

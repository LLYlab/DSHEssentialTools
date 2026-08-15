// DSHEssentialTools — Client 半区（DSH 动态 Cordis 插件，浏览器端）
// 用法：把本文件内部 `return { apply(ctx) { ... } }` 部分作为 cordis_define 的 code.client
// （去掉外层 `export default function () {` 与结尾的 `}`，或直接粘贴整个函数体）

export default function () {
  return {
    apply(ctx) {
      const slots = ctx.get('slots')
      const sessionsSvc = ctx.get('sessions')
      if (slots === undefined) return

      const NL = String.fromCharCode(10)
      const NBSP = String.fromCharCode(160)

      styles.insert(
        '.lval3-root{position:fixed;inset:0;z-index:9990;pointer-events:none;font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:12.5px;color:var(--dsw-alias-label-primary)}' +
        '.lval3-toolbar{position:fixed;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:9995}' +
        '.lval3-tb-btn{width:48px;padding:9px 0;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;cursor:pointer;font:inherit}' +
        '.lval3-tb-btn:hover{border-color:var(--dsw-alias-brand-primary)}' +
        '.lval3-tb-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}' +
        '.lval3-tb-ico{font-size:17px;line-height:1}' +
        '.lval3-tb-lbl{font-size:11px}' +
        '.lval3-panel{position:fixed;right:64px;top:50%;transform:translateY(-50%);width:380px;max-width:62vw;max-height:78vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;pointer-events:auto;z-index:9994;box-shadow:0 8px 30px rgba(0,0,0,.35)}' +
        '.lval3-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600;min-height:34px}' +
        '.lval3-x{background:none;border:none;color:var(--dsw-alias-label-secondary);font-size:16px;cursor:pointer;line-height:1;padding:2px 6px}' +
        '.lval3-x:hover{color:var(--dsw-alias-label-primary)}' +
        '.lval3-x:disabled{opacity:.4;cursor:default}' +
        '.lval3-ptabs{display:flex;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}' +
        '.lval3-ptab{background:none;border:none;color:var(--dsw-alias-label-secondary);padding:6px 14px;cursor:pointer;font:inherit;border-bottom:2px solid transparent}' +
        '.lval3-ptab-on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}' +
        '.lval3-body{overflow:auto;flex:1;padding:8px;display:flex;flex-direction:column;gap:8px}' +
        '.lval3-row{display:flex;gap:6px;align-items:center}' +
        '.lval3-input{flex:1;min-width:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 8px;font:inherit}' +
        '.lval3-btn{background:var(--dsw-alias-brand-primary);border:1px solid transparent;color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
        '.lval3-btn:hover{opacity:.9}' +
        '.lval3-btn:disabled{opacity:.5;cursor:default}' +
        '.lval3-btn-mini{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 8px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
        '.lval3-btn-mini:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
        '.lval3-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
        '.lval3-ver{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
        '.lval3-ver-main{flex:1;min-width:0}' +
        '.lval3-ver-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.lval3-ver-sub{color:var(--dsw-alias-label-secondary);font-size:11px}' +
        '.lval3-msg{color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:pre-wrap;word-break:break-all}' +
        '.lval3-msg-ok{color:var(--dsw-alias-state-success-primary)}' +
        '.lval3-msg-err{color:var(--dsw-alias-state-error-primary)}' +
        '.lval3-empty{padding:10px;color:var(--dsw-alias-label-secondary);text-align:center}' +
        '.lval3-files{display:flex;flex-direction:column;gap:2px}' +
        '.lval3-file{display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;white-space:nowrap;border-radius:6px}' +
        '.lval3-file:hover{background:var(--dsw-alias-bg-layer-2)}' +
        '.lval3-file-sel{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}' +
        '.lval3-file-name{overflow:hidden;text-overflow:ellipsis}' +
        '.lval3-foot{padding:6px 12px;color:var(--dsw-alias-label-secondary);border-top:1px solid var(--dsw-alias-border-l1);font-size:11.5px}' +
        '.lval3-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:9996}' +
        '.lval3-modal{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
        '.lval3-run-modal{width:min(680px,92vw);max-height:75vh}' +
        '.lval3-code-modal{width:min(1040px,94vw);height:min(80vh,900px)}' +
        '.lval3-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.lval3-runbody{display:flex;flex-direction:column;gap:10px;padding:12px;overflow:auto;flex:1}' +
        '.lval3-btns{display:flex;gap:8px;flex-wrap:wrap}' +
        '.lval3-status{color:var(--dsw-alias-label-secondary)}' +
        '.lval3-log{margin:0;padding:10px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-all;overflow:auto;max-height:300px;font:inherit;line-height:1.5}' +
        '.lval3-codewrap{display:flex;flex-direction:column;flex:1;min-height:0}' +
        '.lval3-codescroll{overflow:auto;flex:1;background:var(--dsw-alias-bg-base)}' +
        '.lval3-line{display:flex}' +
        '.lval3-gutter{min-width:3.4em;text-align:right;padding:0 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);user-select:none;flex:none}' +
        '.lval3-code{white-space:pre;padding:0 12px;flex:1;min-width:0}' +
        '.lval3-kw{color:var(--dsw-alias-brand-primary)}' +
        '.lval3-str{color:var(--dsw-alias-state-success-primary)}' +
        '.lval3-com{color:var(--dsw-alias-label-secondary)}' +
        '.lval3-num{color:var(--dsw-alias-state-warn-primary)}' +
        '.lval3-pre{color:var(--dsw-alias-state-error-primary)}' +
      '.lval4-actions{display:inline-flex;align-items:center;gap:2px;font-size:11.5px}' +
      '.lval4-act{display:inline-flex;align-items:center;gap:3px;background:none;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11.5px;padding:2px 6px;border-radius:6px}' +
      '.lval4-act:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.lval4-act:disabled{opacity:.4;cursor:default}'
      )

      const KEYWORDS = 'alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class co_await co_return co_yield compl concept const consteval constexpr constinit const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq override final import module'.split(' ')
      const KW = {}
      KEYWORDS.forEach(function (k) { KW[k] = 1 })

      const tokenizeLine = (line) => {
        const tokens = []
        const re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(#[ \t]*[A-Za-z_][A-Za-z0-9_]*)|(\b\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?[fFuUlL]*\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g
        let m
        while ((m = re.exec(line)) !== null) {
          if (m[1] !== undefined) tokens.push({ t: m[1], c: 'com' })
          else if (m[2] !== undefined) tokens.push({ t: m[2], c: 'com' })
          else if (m[3] !== undefined) tokens.push({ t: m[3], c: 'str' })
          else if (m[4] !== undefined) tokens.push({ t: m[4], c: 'pre' })
          else if (m[5] !== undefined) tokens.push({ t: m[5], c: 'num' })
          else if (m[6] !== undefined) tokens.push({ t: m[6], c: KW[m[6]] ? 'kw' : null })
          else if (m[7] !== undefined) tokens.push({ t: m[7], c: null })
          else tokens.push({ t: m[0], c: null })
        }
        return tokens
      }

      const fmtTime = (t) => {
        if (!t) return ''
        try {
          return new Date(t).toLocaleString()
        } catch (e) {
          return String(t)
        }
      }

      const nodeText = (node) => {
        if (!node) return ''
        const blocks = node.kind === 'assistant' ? node.blocks : node.content
        if (!Array.isArray(blocks)) return ''
        const parts = []
        for (const b of blocks) {
          if (b && typeof b.text === 'string' && b.text !== '') parts.push(b.text)
        }
        return parts.join(NL)
      }

      const findPrompt = (snap, targetId) => {
        if (!snap || !Array.isArray(snap.nodes)) return ''
        const nodes = snap.nodes
        let idx = -1
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i] && nodes[i].kind === 'assistant' && nodes[i].messageId === targetId) {
            idx = i
            break
          }
        }
        if (idx < 0) return ''
        for (let j = idx - 1; j >= 0; j--) {
          const n = nodes[j]
          if (n && (n.kind === 'user' || n.kind === 'steering')) {
            return nodeText(n)
          }
        }
        return ''
      }

      const CodeBlock = ({ content }) => {
        const lines = (content || '').split(NL)
        const rows = lines.map(function (ln, i) {
          const toks = tokenizeLine(ln)
          const spans = toks.map(function (tok, j) {
            if (tok.c === null) return tok.t
            return React.createElement('span', { key: j, className: 'lval3-' + tok.c }, tok.t)
          })
          return React.createElement('div', { key: i, className: 'lval3-line' },
            React.createElement('span', { className: 'lval3-gutter' }, String(i + 1)),
            React.createElement('span', { className: 'lval3-code' }, spans.length > 0 ? spans : NBSP)
          )
        })
        return React.createElement('div', { className: 'lval3-codewrap' },
          React.createElement('div', { className: 'lval3-codescroll' }, rows)
        )
      }

      const ActionStrip = ({ messageId, useSession, inputActions }) => {
        const snap = useSession ? useSession(function (s) { return s }) : null
        const prompt = findPrompt(snap, messageId)
        const running = !!(snap && snap.running)
        const can = prompt !== '' && !running
        const doModify = () => {
          if (!can || !inputActions) return
          try {
            inputActions.setDraft(prompt)
          } catch (e) { /* ignore */ }
        }
        const doRetry = () => {
          if (!can || !inputActions) return
          try {
            inputActions.setDraft(prompt)
            inputActions.submit()
          } catch (e) { /* ignore */ }
        }
        return React.createElement('span', { className: 'lval4-actions' },
          React.createElement('button', {
            className: 'lval4-act',
            title: '修改这条提问（回填输入框编辑后重发）',
            disabled: !can,
            onClick: doModify,
          },
            React.createElement('span', null, '✎'),
            ' 修改'
          ),
          React.createElement('button', {
            className: 'lval4-act',
            title: '用同一提问重试（重新生成回答）',
            disabled: !can,
            onClick: doRetry,
          },
            React.createElement('span', null, '↻'),
            ' 重试'
          )
        )
      }

      const Toolbar = () => {
        const [panel, setPanel] = React.useState(null)
        const [ptab, setPtab] = React.useState('code')
        const [info, setInfo] = React.useState(null)
        const [files, setFiles] = React.useState([])
        const [filesLoading, setFilesLoading] = React.useState(true)
        const [sel, setSel] = React.useState(null)
        const [codeModal, setCodeModal] = React.useState(null)
        const [busy, setBusy] = React.useState(false)
        const [log, setLog] = React.useState('')
        const [runModal, setRunModal] = React.useState(false)
        const [versions, setVersions] = React.useState([])
        const [verLoading, setVerLoading] = React.useState(true)
        const [snapLabel, setSnapLabel] = React.useState('')
        const [verBusy, setVerBusy] = React.useState(false)
        const [verMsg, setVerMsg] = React.useState(null)
        const [confirmVer, setConfirmVer] = React.useState(null)
        const [sessions, setSessions] = React.useState([])
        const [sessLoading, setSessLoading] = React.useState(true)
        const [editId, setEditId] = React.useState(null)
        const [editTitle, setEditTitle] = React.useState('')
        const [sessMsg, setSessMsg] = React.useState(null)

        React.useEffect(function () {
          let alive = true
          host.call('lval-info', {}).then(function (r) {
            if (alive) setInfo(r)
          }).catch(function () {})
          host.call('lval-list-files', {}).then(function (r) {
            if (!alive) return
            setFiles((r && r.files) || [])
            setFilesLoading(false)
          }).catch(function () {
            if (alive) setFilesLoading(false)
          })
          host.call('lval-ver-list', {}).then(function (r) {
            if (!alive) return
            setVersions((r && r.versions) || [])
            setVerLoading(false)
          }).catch(function () {
            if (alive) setVerLoading(false)
          })
          loadSessions()
          return function () { alive = false }
        }, [])

        const loadSessions = () => {
          setSessLoading(true)
          host.call('lval-sessions', {}).then(function (r) {
            setSessLoading(false)
            if (r && r.ok) setSessions(r.sessions || [])
            else setSessMsg({ ok: false, text: (r && r.error) || '加载会话失败' })
          }).catch(function (e) {
            setSessLoading(false)
            setSessMsg({ ok: false, text: String(e && e.message ? e.message : e) })
          })
        }

        const refreshVersions = () => {
          host.call('lval-ver-list', {}).then(function (r) {
            setVersions((r && r.versions) || [])
          }).catch(function () {})
        }

        const openCode = (f) => {
          setCodeModal({ path: f.path, content: '加载中…' })
          host.call('lval-read-file', { path: f.path }).then(function (r) {
            if (r && r.error) setCodeModal({ path: f.path + ' — ' + r.error, content: '' })
            else setCodeModal({ path: f.path, content: (r && r.content) || '' })
          }).catch(function (e) {
            setCodeModal({ path: f.path, content: '读取失败: ' + String(e && e.message ? e.message : e) })
          })
        }

        const buildLog = (r, withRun) => {
          const parts = []
          if (r.output) parts.push(r.output)
          if (r.error) parts.push(r.error)
          if (r.ok) {
            parts.push('✓ 编译成功（' + (info ? info.configuration : '') + ' | ' + (info ? info.platform : '') + '）')
            if (withRun && r.run) {
              if (r.run.ok) parts.push('✓ 已启动 ' + (info ? info.exe : 'LVAL.exe') + '（PID ' + r.run.pid + '）')
              else parts.push('✗ 启动失败：' + (r.run.error || ''))
            }
          } else {
            parts.push('✗ 编译失败（退出码 ' + r.exitCode + '）')
          }
          return parts.join(NL)
        }

        const doRun = (withRun) => {
          if (busy) return
          setRunModal(true)
          setBusy(true)
          setLog('正在使用 VS2026 (MSBuild) 编译 LVAL.slnx…')
          host.call(withRun ? 'lval-build-run' : 'lval-build', {}).then(function (r) {
            setBusy(false)
            if (!r) { setLog('无响应'); return }
            setLog(buildLog(r, withRun))
          }).catch(function (e) {
            setBusy(false)
            setLog('✗ 调用失败：' + String(e && e.message ? e.message : e))
          })
        }

        const createSnapshot = () => {
          if (verBusy) return
          setVerBusy(true)
          setVerMsg(null)
          host.call('lval-ver-snapshot', { label: snapLabel }).then(function (r) {
            setVerBusy(false)
            if (r && r.ok) {
              setSnapLabel('')
              setVerMsg({ ok: true, text: '✓ 已创建快照 ' + r.id + '（' + r.fileCount + ' 个文件）' })
              refreshVersions()
            } else {
              setVerMsg({ ok: false, text: '✗ ' + ((r && r.error) || '创建失败') })
            }
          }).catch(function (e) {
            setVerBusy(false)
            setVerMsg({ ok: false, text: '✗ ' + String(e && e.message ? e.message : e) })
          })
        }

        const restoreVer = (id) => {
          if (confirmVer && confirmVer.id === id && confirmVer.kind === 'restore') {
            setConfirmVer(null)
            setVerBusy(true)
            setVerMsg(null)
            host.call('lval-ver-restore', { id: id }).then(function (r) {
              setVerBusy(false)
              if (r && r.ok) setVerMsg({ ok: true, text: '✓ 已回退 ' + r.restored + ' 个文件（自动备份 ' + r.backupId + '）' })
              else setVerMsg({ ok: false, text: '✗ ' + ((r && r.error) || '回退失败') })
            }).catch(function (e) {
              setVerBusy(false)
              setVerMsg({ ok: false, text: '✗ ' + String(e && e.message ? e.message : e) })
            })
          } else {
            setConfirmVer({ id: id, kind: 'restore' })
          }
        }

        const deleteVer = (id) => {
          if (confirmVer && confirmVer.id === id && confirmVer.kind === 'delete') {
            setConfirmVer(null)
            setVerBusy(true)
            setVerMsg(null)
            host.call('lval-ver-delete', { id: id }).then(function (r) {
              setVerBusy(false)
              if (r && r.ok) {
                setVerMsg({ ok: true, text: '✓ 已删除版本 ' + id })
                refreshVersions()
              } else {
                setVerMsg({ ok: false, text: '✗ ' + ((r && r.error) || '删除失败') })
              }
            }).catch(function (e) {
              setVerBusy(false)
              setVerMsg({ ok: false, text: '✗ ' + String(e && e.message ? e.message : e) })
            })
          } else {
            setConfirmVer({ id: id, kind: 'delete' })
          }
        }

        const openSession = (id) => {
          if (!sessionsSvc) {
            setSessMsg({ ok: false, text: '会话服务不可用' })
            return
          }
          try {
            sessionsSvc.open(id)
            setSessMsg({ ok: true, text: '✓ 已重新启用会话 ' + id })
          } catch (e) {
            setSessMsg({ ok: false, text: '✗ ' + String(e && e.message ? e.message : e) })
          }
        }

        const forkSession = (id) => {
          if (!sessionsSvc) {
            setSessMsg({ ok: false, text: '会话服务不可用' })
            return
          }
          setSessMsg(null)
          sessionsSvc.fork({ sessionId: id, increaseTitle: true }).then(function (newId) {
            setSessMsg({ ok: true, text: '✓ 已复制会话 ' + id + ' → ' + newId })
            if (newId) {
              try {
                sessionsSvc.open(newId)
              } catch (e) { /* ignore */ }
            }
            loadSessions()
          }).catch(function (e) {
            setSessMsg({ ok: false, text: '✗ 复制失败：' + String(e && e.message ? e.message : e) })
          })
        }

        const saveRename = (id) => {
          setSessMsg(null)
          host.call('lval-session-rename', { id: id, title: editTitle }).then(function (r) {
            if (r && r.ok) {
              setEditId(null)
              setEditTitle('')
              setSessMsg({ ok: true, text: '✓ 已重命名' })
              loadSessions()
            } else {
              setSessMsg({ ok: false, text: '✗ ' + ((r && r.error) || '重命名失败') })
            }
          }).catch(function (e) {
            setSessMsg({ ok: false, text: '✗ ' + String(e && e.message ? e.message : e) })
          })
        }

        const msgCls = (m) => m ? (m.ok ? 'lval3-msg lval3-msg-ok' : 'lval3-msg lval3-msg-err') : 'lval3-msg'
        const msgText = (m) => m ? m.text : ''

        const verRows = versions.map(function (v) {
          const confirm = confirmVer && confirmVer.id === v.id ? confirmVer.kind : null
          return React.createElement('div', { key: v.id, className: 'lval3-ver' },
            React.createElement('div', { className: 'lval3-ver-main' },
              React.createElement('div', { className: 'lval3-ver-title' }, v.label || v.id),
              React.createElement('div', { className: 'lval3-ver-sub' }, v.id + ' · ' + fmtTime(v.time) + ' · ' + v.fileCount + ' 文件')
            ),
            React.createElement('button', {
              className: 'lval3-btn-mini' + (confirm === 'restore' ? ' lval3-btn-danger' : ''),
              disabled: verBusy,
              onClick: function () { restoreVer(v.id) },
            }, confirm === 'restore' ? '确认回退?' : '回退'),
            React.createElement('button', {
              className: 'lval3-btn-mini lval3-btn-danger' + (confirm === 'delete' ? ' lval3-btn-danger' : ''),
              disabled: verBusy,
              onClick: function () { deleteVer(v.id) },
            }, confirm === 'delete' ? '确认删除?' : '删除')
          )
        })

        const sessRows = sessions.map(function (s) {
          if (editId === s.id) {
            return React.createElement('div', { key: s.id, className: 'lval3-ver' },
              React.createElement('input', {
                className: 'lval3-input',
                value: editTitle,
                onChange: function (e) { setEditTitle(e.target.value) },
              }),
              React.createElement('button', { className: 'lval3-btn-mini', onClick: function () { saveRename(s.id) } }, '确定'),
              React.createElement('button', { className: 'lval3-btn-mini', onClick: function () { setEditId(null) } }, '取消')
            )
          }
          return React.createElement('div', { key: s.id, className: 'lval3-ver' },
            React.createElement('div', { className: 'lval3-ver-main' },
              React.createElement('div', { className: 'lval3-ver-title' }, s.title),
              React.createElement('div', { className: 'lval3-ver-sub' }, s.id + (s.live ? ' · 运行中' : '') + ' · ' + fmtTime(s.createdAt))
            ),
            React.createElement('button', { className: 'lval3-btn-mini', onClick: function () { openSession(s.id) } }, '打开'),
            React.createElement('button', { className: 'lval3-btn-mini', onClick: function () { forkSession(s.id) } }, '复制'),
            React.createElement('button', {
              className: 'lval3-btn-mini',
              onClick: function () {
                setEditId(s.id)
                setEditTitle(s.title)
              },
            }, '重命名')
          )
        })

        return React.createElement('div', { className: 'lval3-root' },
          React.createElement('div', { className: 'lval3-toolbar' },
            React.createElement('button', {
              className: 'lval3-tb-btn' + (runModal ? ' lval3-tb-on' : ''),
              title: '使用 VS2026 编译并运行主程序',
              onClick: function () { doRun(true) },
            },
              React.createElement('span', { className: 'lval3-tb-ico' }, '▶'),
              React.createElement('span', { className: 'lval3-tb-lbl' }, '运行')
            ),
            React.createElement('button', {
              className: 'lval3-tb-btn' + (panel === 'file' ? ' lval3-tb-on' : ''),
              title: '查看工程内部文件',
              onClick: function () { setPanel(panel === 'file' ? null : 'file') },
            },
              React.createElement('span', { className: 'lval3-tb-ico' }, '🗎'),
              React.createElement('span', { className: 'lval3-tb-lbl' }, '文件')
            ),
            React.createElement('button', {
              className: 'lval3-tb-btn' + (panel === 'ver' ? ' lval3-tb-on' : ''),
              title: '版本管理：代码快照/回退 与 会话管理',
              onClick: function () { setPanel(panel === 'ver' ? null : 'ver') },
            },
              React.createElement('span', { className: 'lval3-tb-ico' }, '🕘'),
              React.createElement('span', { className: 'lval3-tb-lbl' }, '版本')
            )
          ),
          panel === 'file'
            ? React.createElement('div', { className: 'lval3-panel' },
                React.createElement('div', { className: 'lval3-head' },
                  React.createElement('span', null, 'LVAL 工程文件'),
                  React.createElement('button', { className: 'lval3-x', onClick: function () { setPanel(null) } }, '×')
                ),
                React.createElement('div', { className: 'lval3-body' },
                  filesLoading
                    ? React.createElement('div', { className: 'lval3-empty' }, '加载文件列表…')
                    : files.length === 0
                      ? React.createElement('div', { className: 'lval3-empty' }, '无源文件')
                      : React.createElement('div', { className: 'lval3-files' },
                          files.map(function (f) {
                            return React.createElement('div', {
                              key: f.path,
                              className: 'lval3-file' + (sel === f.path ? ' lval3-file-sel' : ''),
                              onClick: function () { setSel(f.path) },
                              onDoubleClick: function () { openCode(f) },
                            },
                              React.createElement('span', { className: 'lval3-file-name' }, '📄 ' + f.path)
                            )
                          })
                        )
                ),
                React.createElement('div', { className: 'lval3-foot' }, '双击文件打开代码查看')
              )
            : null,
          panel === 'ver'
            ? React.createElement('div', { className: 'lval3-panel' },
                React.createElement('div', { className: 'lval3-head' },
                  React.createElement('span', null, '版本管理'),
                  React.createElement('button', { className: 'lval3-x', onClick: function () { setPanel(null) } }, '×')
                ),
                React.createElement('div', { className: 'lval3-ptabs' },
                  React.createElement('button', { className: 'lval3-ptab' + (ptab === 'code' ? ' lval3-ptab-on' : ''), onClick: function () { setPtab('code') } }, '代码版本'),
                  React.createElement('button', { className: 'lval3-ptab' + (ptab === 'sess' ? ' lval3-ptab-on' : ''), onClick: function () { setPtab('sess') } }, '对话版本')
                ),
                React.createElement('div', { className: 'lval3-body' },
                  ptab === 'code'
                    ? React.createElement(React.Fragment, null,
                        React.createElement('div', { className: 'lval3-row' },
                          React.createElement('input', {
                            className: 'lval3-input',
                            placeholder: '快照标签（可选）',
                            value: snapLabel,
                            onChange: function (e) { setSnapLabel(e.target.value) },
                          }),
                          React.createElement('button', { className: 'lval3-btn', disabled: verBusy, onClick: createSnapshot }, verBusy ? '处理中…' : '创建快照')
                        ),
                        verMsg ? React.createElement('div', { className: msgCls(verMsg) }, msgText(verMsg)) : null,
                        verLoading
                          ? React.createElement('div', { className: 'lval3-empty' }, '加载版本列表…')
                          : versions.length === 0
                            ? React.createElement('div', { className: 'lval3-empty' }, '暂无快照，点击「创建快照」备份当前代码')
                            : React.createElement('div', { className: 'lval3-files' }, verRows)
                      )
                    : React.createElement(React.Fragment, null,
                        React.createElement('div', { className: 'lval3-row' },
                          React.createElement('button', { className: 'lval3-btn', disabled: sessLoading, onClick: loadSessions }, sessLoading ? '加载中…' : '刷新会话'),
                          React.createElement('span', { className: 'lval3-ver-sub' }, '重新启用 / 更改 / 复制 之前的对话')
                        ),
                        sessMsg ? React.createElement('div', { className: msgCls(sessMsg) }, msgText(sessMsg)) : null,
                        sessLoading
                          ? React.createElement('div', { className: 'lval3-empty' }, '加载会话列表…')
                          : sessions.length === 0
                            ? React.createElement('div', { className: 'lval3-empty' }, '暂无会话记录')
                            : React.createElement('div', { className: 'lval3-files' }, sessRows)
                      )
                )
              )
            : null,
          runModal
            ? React.createElement('div', { className: 'lval3-mask', onClick: function () { if (!busy) setRunModal(false) } },
                React.createElement('div', { className: 'lval3-modal lval3-run-modal', onClick: function (e) { e.stopPropagation() } },
                  React.createElement('div', { className: 'lval3-head' },
                    React.createElement('span', null, '运行 (VS2026)'),
                    React.createElement('button', { className: 'lval3-x', disabled: busy, onClick: function () { setRunModal(false) } }, '×')
                  ),
                  React.createElement('div', { className: 'lval3-runbody' },
                    React.createElement('div', { className: 'lval3-btns' },
                      React.createElement('button', { className: 'lval3-btn', disabled: busy, onClick: function () { doRun(false) } }, busy ? '编译中…' : '编译'),
                      React.createElement('button', { className: 'lval3-btn', disabled: busy, onClick: function () { doRun(true) } }, busy ? '编译运行中…' : '▶ 编译并运行')
                    ),
                    info ? React.createElement('div', { className: 'lval3-status' }, '工程: ' + info.solution + ' · ' + info.configuration + ' | ' + info.platform) : null,
                    React.createElement('pre', { className: 'lval3-log' }, log)
                  )
                )
              )
            : null,
          codeModal
            ? React.createElement('div', { className: 'lval3-mask', onClick: function () { setCodeModal(null) } },
                React.createElement('div', { className: 'lval3-modal lval3-code-modal', onClick: function (e) { e.stopPropagation() } },
                  React.createElement('div', { className: 'lval3-head' },
                    React.createElement('span', { className: 'lval3-path' }, codeModal.path),
                    React.createElement('button', { className: 'lval3-x', onClick: function () { setCodeModal(null) } }, '×')
                  ),
                  React.createElement(CodeBlock, { content: codeModal.content })
                )
              )
            : null
        )
      }

      slots.inject('shell.overlay', function () {
        return slots.register(
          { name: 'shell.overlay', id: 'lval-toolbar' },
          function () { return React.createElement(Toolbar, null) }
        )
      })

      slots.inject('conversation.chat.assistant-actions', function () {
        return slots.register(
          { name: 'conversation.chat.assistant-actions', id: 'lval-actions', order: 20 },
          function (props) { return React.createElement(ActionStrip, props) }
        )
      })
    },
  }
}

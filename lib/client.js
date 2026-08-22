// dsh-essential-tools — Client 半区（永久 npm 包，浏览器端）
// 格式：window.__ModuleLoader__.load({id, factory}) —— dsh-client-modules 契约（与产品包同构）。
// 依赖解析：react / @deepseek-ai/cordis 等为平台种子词；slots 服务经 ctx.get('slots') 读取。
// 通信：ctx.get('connection').rpc.call('/api', 'dshEssentialTools/<method>', {args})
//   （永久包标准机制；动态插件的 host.call 在这里不存在）
// 功能：右侧 LVAL 工具栏（运行/文件/版本）+ 会话树入口（M1 起扩展）。

window.__ModuleLoader__.load({
  id: "dsh-essential-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    var NL = String.fromCharCode(10);
    var NBSP = String.fromCharCode(160);

    // ── 主题样式（data-plugin 标记便于 client-modules 认领/HMR 记账）────────
    var CSS = "" +
      '.dset-root{position:fixed;inset:0;z-index:9990;pointer-events:none;font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:12.5px;color:var(--dsw-alias-label-primary)}' +
      '.dset-toolbar{position:fixed;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:9995}' +
      '.dset-tb-btn{width:48px;padding:9px 0;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;cursor:pointer;font:inherit}' +
      '.dset-tb-btn:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tb-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tb-ico{font-size:17px;line-height:1}' +
      '.dset-tb-lbl{font-size:11px}' +
      '.dset-panel{position:fixed;right:64px;top:50%;transform:translateY(-50%);width:360px;max-width:60vw;max-height:78vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;pointer-events:auto;z-index:9994;box-shadow:0 8px 30px rgba(0,0,0,.35)}' +
      '.dset-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600;min-height:34px}' +
      '.dset-x{background:none;border:none;color:var(--dsw-alias-label-secondary);font-size:16px;cursor:pointer;line-height:1;padding:2px 6px}' +
      '.dset-x:hover{color:var(--dsw-alias-label-primary)}' +
      '.dset-x:disabled{opacity:.4;cursor:default}' +
      '.dset-body{overflow:auto;flex:1;padding:8px;display:flex;flex-direction:column;gap:8px}' +
      '.dset-row{display:flex;gap:6px;align-items:center}' +
      '.dset-input{flex:1;min-width:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 8px;font:inherit}' +
      '.dset-btn{background:var(--dsw-alias-brand-primary);border:1px solid transparent;color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-btn:hover{opacity:.9}' +
      '.dset-btn:disabled{opacity:.5;cursor:default}' +
      '.dset-btn-mini{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 8px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-btn-mini:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-ver{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
      '.dset-ver-main{flex:1;min-width:0}' +
      '.dset-ver-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-ver-sub{color:var(--dsw-alias-label-secondary);font-size:11px}' +
      '.dset-msg{color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:pre-wrap;word-break:break-all}' +
      '.dset-msg-ok{color:var(--dsw-alias-state-success-primary)}' +
      '.dset-msg-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-empty{padding:10px;color:var(--dsw-alias-label-secondary);text-align:center}' +
      '.dset-files{display:flex;flex-direction:column;gap:2px}' +
      '.dset-file{display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;white-space:nowrap;border-radius:6px}' +
      '.dset-file:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-file-sel{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}' +
      '.dset-file-name{overflow:hidden;text-overflow:ellipsis}' +
      '.dset-foot{padding:6px 12px;color:var(--dsw-alias-label-secondary);border-top:1px solid var(--dsw-alias-border-l1);font-size:11.5px}' +
      '.dset-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:9996}' +
      '.dset-modal{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
      '.dset-run-modal{width:min(680px,92vw);max-height:75vh}' +
      '.dset-code-modal{width:min(1040px,94vw);height:min(80vh,900px)}' +
      '.dset-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-runbody{display:flex;flex-direction:column;gap:10px;padding:12px;overflow:auto;flex:1}' +
      '.dset-btns{display:flex;gap:8px;flex-wrap:wrap}' +
      '.dset-status{color:var(--dsw-alias-label-secondary)}' +
      '.dset-log{margin:0;padding:10px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-all;overflow:auto;max-height:300px;font:inherit;line-height:1.5}' +
      '.dset-codewrap{display:flex;flex-direction:column;flex:1;min-height:0}' +
      '.dset-codescroll{overflow:auto;flex:1;background:var(--dsw-alias-bg-base)}' +
      '.dset-line{display:flex}' +
      '.dset-gutter{min-width:3.4em;text-align:right;padding:0 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);user-select:none;flex:none}' +
      '.dset-code{white-space:pre;padding:0 12px;flex:1;min-width:0}' +
      '.dset-kw{color:var(--dsw-alias-brand-primary)}' +
      '.dset-str{color:var(--dsw-alias-state-success-primary)}' +
      '.dset-com{color:var(--dsw-alias-label-secondary)}' +
      '.dset-num{color:var(--dsw-alias-state-warn-primary)}' +
      '.dset-pre{color:var(--dsw-alias-state-error-primary)}';

    function ensureStyles() {
      if (typeof document === "undefined") return;
      if (document.querySelector('style[data-plugin-css="dsh-essential-tools"]')) return;
      var el = document.createElement("style");
      el.setAttribute("data-plugin", "dsh-essential-tools");
      el.setAttribute("data-plugin-css", "dsh-essential-tools");
      el.textContent = CSS;
      document.head.append(el);
    }

    // ── RPC 桥（永久包：connection.rpc.call；自动解包 {ok, value} 信封）─────
    function makeCaller(getConnection) {
      return function call(method, args) {
        var connection = getConnection();
        if (connection === undefined || typeof connection.rpc !== "object" || typeof connection.rpc.call !== "function") {
          return Promise.reject(new Error("connection 服务不可用（dsh-essential-tools）"));
        }
        return connection.rpc.call("/api", "dshEssentialTools/" + method, { args: args || {} }).then(function (r) {
          if (r && r.ok) return r.value;
          var err = (r && r.error) || {};
          throw new Error(err.message || ("调用失败: " + method));
        });
      };
    }

    // ── C/C++ 语法高亮（沿用原实现）────────────────────────────────────────
    var KEYWORDS = "alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class co_await co_return co_yield compl concept const consteval constexpr constinit const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq override final import module".split(" ");
    var KW = {};
    KEYWORDS.forEach(function (k) { KW[k] = 1; });

    function tokenizeLine(line) {
      var tokens = [];
      var re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(#[ \t]*[A-Za-z_][A-Za-z0-9_]*)|(\b\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?[fFuUlL]*\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;
      var m;
      while ((m = re.exec(line)) !== null) {
        if (m[1] !== undefined) tokens.push({ t: m[1], c: "com" });
        else if (m[2] !== undefined) tokens.push({ t: m[2], c: "com" });
        else if (m[3] !== undefined) tokens.push({ t: m[3], c: "str" });
        else if (m[4] !== undefined) tokens.push({ t: m[4], c: "pre" });
        else if (m[5] !== undefined) tokens.push({ t: m[5], c: "num" });
        else if (m[6] !== undefined) tokens.push({ t: m[6], c: KW[m[6]] ? "kw" : null });
        else if (m[7] !== undefined) tokens.push({ t: m[7], c: null });
        else tokens.push({ t: m[0], c: null });
      }
      return tokens;
    }

    function fmtTime(t) {
      if (!t) return "";
      try {
        return new Date(t).toLocaleString();
      } catch (e) {
        return String(t);
      }
    }

    function CodeBlock(props) {
      var content = props.content || "";
      var lines = content.split(NL);
      var rows = lines.map(function (ln, i) {
        var toks = tokenizeLine(ln);
        var spans = toks.map(function (tok, j) {
          if (tok.c === null) return tok.t;
          return React.createElement("span", { key: j, className: "dset-" + tok.c }, tok.t);
        });
        return React.createElement("div", { key: i, className: "dset-line" },
          React.createElement("span", { className: "dset-gutter" }, String(i + 1)),
          React.createElement("span", { className: "dset-code" }, spans.length > 0 ? spans : NBSP)
        );
      });
      return React.createElement("div", { className: "dset-codewrap" },
        React.createElement("div", { className: "dset-codescroll" }, rows)
      );
    }

    // ── 右侧工具栏：运行 / 文件 / 版本 ─────────────────────────────────────
    function Toolbar(props) {
      var call = props.call;
      var panel = React.useState(null);
      var setPanel = panel[1];
      var info = React.useState(null);
      var setInfo = info[1];
      var files = React.useState([]);
      var setFiles = files[1];
      var filesLoading = React.useState(true);
      var setFilesLoading = filesLoading[1];
      var sel = React.useState(null);
      var setSel = sel[1];
      var codeModal = React.useState(null);
      var setCodeModal = codeModal[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var log = React.useState("");
      var setLog = log[1];
      var runModal = React.useState(false);
      var setRunModal = runModal[1];
      var versions = React.useState([]);
      var setVersions = versions[1];
      var verLoading = React.useState(true);
      var setVerLoading = verLoading[1];
      var snapLabel = React.useState("");
      var setSnapLabel = snapLabel[1];
      var verBusy = React.useState(false);
      var setVerBusy = verBusy[1];
      var verMsg = React.useState(null);
      var setVerMsg = verMsg[1];
      var confirmVer = React.useState(null);
      var setConfirmVer = confirmVer[1];

      React.useEffect(function () {
        var alive = true;
        call("lvalInfo", {}).then(function (r) {
          if (alive) setInfo(r);
        }).catch(function () {});
        call("lvalListFiles", {}).then(function (r) {
          if (!alive) return;
          setFiles((r && r.files) || []);
          setFilesLoading(false);
        }).catch(function () {
          if (alive) setFilesLoading(false);
        });
        call("verProgList", {}).then(function (r) {
          if (!alive) return;
          setVersions((r && r.versions) || []);
          setVerLoading(false);
        }).catch(function () {
          if (alive) setVerLoading(false);
        });
        return function () { alive = false; };
      }, []);

      var refreshVersions = function () {
        call("verProgList", {}).then(function (r) {
          setVersions((r && r.versions) || []);
        }).catch(function () {});
      };

      var openCode = function (f) {
        setCodeModal({ path: f.path, content: "加载中…" });
        call("lvalReadFile", { path: f.path }).then(function (r) {
          if (r && r.error) setCodeModal({ path: f.path + " — " + r.error, content: "" });
          else setCodeModal({ path: f.path, content: (r && r.content) || "" });
        }).catch(function (e) {
          setCodeModal({ path: f.path, content: "读取失败: " + String(e && e.message ? e.message : e) });
        });
      };

      var buildLog = function (r, withRun) {
        var parts = [];
        if (r.output) parts.push(r.output);
        if (r.error) parts.push(r.error);
        if (r.ok) {
          parts.push("✓ 编译成功（" + (info[0] ? info[0].configuration : "") + " | " + (info[0] ? info[0].platform : "") + "）");
          if (withRun && r.run) {
            if (r.run.ok) parts.push("✓ 已启动 " + (info[0] ? info[0].exe : "LVAL.exe") + "（PID " + r.run.pid + "）");
            else parts.push("✗ 启动失败：" + (r.run.error || ""));
          }
        } else {
          parts.push("✗ 编译失败（退出码 " + r.exitCode + "）");
        }
        return parts.join(NL);
      };

      var doRun = function (withRun) {
        if (busy[0]) return;
        setRunModal(true);
        setBusy(true);
        setLog("正在使用 VS2026 (MSBuild) 编译 " + (info[0] ? info[0].solution : "LVAL.slnx") + "…");
        call(withRun ? "lvalBuildRun" : "lvalBuild", {}).then(function (r) {
          setBusy(false);
          if (!r) { setLog("无响应"); return; }
          setLog(buildLog(r, withRun));
        }).catch(function (e) {
          setBusy(false);
          setLog("✗ 调用失败：" + String(e && e.message ? e.message : e));
        });
      };

      var createSnapshot = function () {
        if (verBusy[0]) return;
        setVerBusy(true);
        setVerMsg(null);
        call("verProgCreate", { label: snapLabel[0] }).then(function (r) {
          setVerBusy(false);
          if (r && r.ok) {
            setSnapLabel("");
            setVerMsg({ ok: true, text: "✓ 已创建快照 " + r.id + "（" + r.fileCount + " 个文件）" });
            refreshVersions();
          } else {
            setVerMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
          }
        }).catch(function (e) {
          setVerBusy(false);
          setVerMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };

      var restoreVer = function (id) {
        if (confirmVer[0] && confirmVer[0].id === id && confirmVer[0].kind === "restore") {
          setConfirmVer(null);
          setVerBusy(true);
          setVerMsg(null);
          call("verProgRestore", { id: id }).then(function (r) {
            setVerBusy(false);
            if (r && r.ok) setVerMsg({ ok: true, text: "✓ 已回退 " + r.restored + " 个文件（自动备份 " + r.backupId + "）" });
            else setVerMsg({ ok: false, text: "✗ " + ((r && r.error) || "回退失败") });
          }).catch(function (e) {
            setVerBusy(false);
            setVerMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
          });
        } else {
          setConfirmVer({ id: id, kind: "restore" });
        }
      };

      var deleteVer = function (id) {
        if (confirmVer[0] && confirmVer[0].id === id && confirmVer[0].kind === "delete") {
          setConfirmVer(null);
          setVerBusy(true);
          setVerMsg(null);
          call("verProgDelete", { id: id }).then(function (r) {
            setVerBusy(false);
            if (r && r.ok) {
              setVerMsg({ ok: true, text: "✓ 已删除版本 " + id });
              refreshVersions();
            } else {
              setVerMsg({ ok: false, text: "✗ " + ((r && r.error) || "删除失败") });
            }
          }).catch(function (e) {
            setVerBusy(false);
            setVerMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
          });
        } else {
          setConfirmVer({ id: id, kind: "delete" });
        }
      };

      var msgCls = function (m) { return m ? (m.ok ? "dset-msg dset-msg-ok" : "dset-msg dset-msg-err") : "dset-msg"; };
      var msgText = function (m) { return m ? m.text : ""; };

      var verRows = versions[0].map(function (v) {
        var confirm = confirmVer[0] && confirmVer[0].id === v.id ? confirmVer[0].kind : null;
        return React.createElement("div", { key: v.id, className: "dset-ver" },
          React.createElement("div", { className: "dset-ver-main" },
            React.createElement("div", { className: "dset-ver-title" }, v.label || v.id),
            React.createElement("div", { className: "dset-ver-sub" }, v.id + " · " + fmtTime(v.time) + " · " + v.fileCount + " 文件")
          ),
          React.createElement("button", {
            className: "dset-btn-mini" + (confirm === "restore" ? " dset-btn-danger" : ""),
            disabled: verBusy[0],
            onClick: function () { restoreVer(v.id); },
          }, confirm === "restore" ? "确认回退?" : "回退"),
          React.createElement("button", {
            className: "dset-btn-mini dset-btn-danger",
            disabled: verBusy[0],
            onClick: function () { deleteVer(v.id); },
          }, confirm === "delete" ? "确认删除?" : "删除")
        );
      });

      return React.createElement("div", { className: "dset-root" },
        React.createElement("div", { className: "dset-toolbar" },
          React.createElement("button", {
            className: "dset-tb-btn" + (runModal[0] ? " dset-tb-on" : ""),
            title: "使用 VS2026 编译并运行主程序",
            onClick: function () { doRun(true); },
          },
            React.createElement("span", { className: "dset-tb-ico" }, "▶"),
            React.createElement("span", { className: "dset-tb-lbl" }, "运行")
          ),
          React.createElement("button", {
            className: "dset-tb-btn" + (panel[0] === "file" ? " dset-tb-on" : ""),
            title: "查看工程内部文件",
            onClick: function () { setPanel(panel[0] === "file" ? null : "file"); },
          },
            React.createElement("span", { className: "dset-tb-ico" }, "🗎"),
            React.createElement("span", { className: "dset-tb-lbl" }, "文件")
          ),
          React.createElement("button", {
            className: "dset-tb-btn" + (panel[0] === "ver" ? " dset-tb-on" : ""),
            title: "程序版本：代码快照/回退",
            onClick: function () { setPanel(panel[0] === "ver" ? null : "ver"); },
          },
            React.createElement("span", { className: "dset-tb-ico" }, "🕘"),
            React.createElement("span", { className: "dset-tb-lbl" }, "版本")
          )
        ),
        panel[0] === "file"
          ? React.createElement("div", { className: "dset-panel" },
              React.createElement("div", { className: "dset-head" },
                React.createElement("span", null, "LVAL 工程文件"),
                React.createElement("button", { className: "dset-x", onClick: function () { setPanel(null); } }, "×")
              ),
              React.createElement("div", { className: "dset-body" },
                filesLoading[0]
                  ? React.createElement("div", { className: "dset-empty" }, "加载文件列表…")
                  : files[0].length === 0
                    ? React.createElement("div", { className: "dset-empty" }, "无源文件")
                    : React.createElement("div", { className: "dset-files" },
                        files[0].map(function (f) {
                          return React.createElement("div", {
                            key: f.path,
                            className: "dset-file" + (sel[0] === f.path ? " dset-file-sel" : ""),
                            onClick: function () { setSel(f.path); },
                            onDoubleClick: function () { openCode(f); },
                          },
                            React.createElement("span", { className: "dset-file-name" }, "📄 " + f.path)
                          );
                        })
                      )
              ),
              React.createElement("div", { className: "dset-foot" }, "双击文件打开代码查看")
            )
          : null,
        panel[0] === "ver"
          ? React.createElement("div", { className: "dset-panel" },
              React.createElement("div", { className: "dset-head" },
                React.createElement("span", null, "程序版本（代码快照）"),
                React.createElement("button", { className: "dset-x", onClick: function () { setPanel(null); } }, "×")
              ),
              React.createElement("div", { className: "dset-body" },
                React.createElement("div", { className: "dset-row" },
                  React.createElement("input", {
                    className: "dset-input",
                    placeholder: "快照标签（可选）",
                    value: snapLabel[0],
                    onChange: function (e) { setSnapLabel(e.target.value); },
                  }),
                  React.createElement("button", { className: "dset-btn", disabled: verBusy[0], onClick: createSnapshot }, verBusy[0] ? "处理中…" : "创建快照")
                ),
                verMsg[0] ? React.createElement("div", { className: msgCls(verMsg[0]) }, msgText(verMsg[0])) : null,
                verLoading[0]
                  ? React.createElement("div", { className: "dset-empty" }, "加载版本列表…")
                  : versions[0].length === 0
                    ? React.createElement("div", { className: "dset-empty" }, "暂无快照，点击「创建快照」备份当前代码")
                    : React.createElement("div", { className: "dset-files" }, verRows)
              )
            )
          : null,
        runModal[0]
          ? React.createElement("div", { className: "dset-mask", onClick: function () { if (!busy[0]) setRunModal(false); } },
              React.createElement("div", { className: "dset-modal dset-run-modal", onClick: function (e) { e.stopPropagation(); } },
                React.createElement("div", { className: "dset-head" },
                  React.createElement("span", null, "运行 (VS2026)"),
                  React.createElement("button", { className: "dset-x", disabled: busy[0], onClick: function () { setRunModal(false); } }, "×")
                ),
                React.createElement("div", { className: "dset-runbody" },
                  React.createElement("div", { className: "dset-btns" },
                    React.createElement("button", { className: "dset-btn", disabled: busy[0], onClick: function () { doRun(false); } }, busy[0] ? "编译中…" : "编译"),
                    React.createElement("button", { className: "dset-btn", disabled: busy[0], onClick: function () { doRun(true); } }, busy[0] ? "编译运行中…" : "▶ 编译并运行")
                  ),
                  info[0] ? React.createElement("div", { className: "dset-status" }, "工程: " + info[0].solution + " · " + info[0].configuration + " | " + info[0].platform) : null,
                  React.createElement("pre", { className: "dset-log" }, log[0])
                )
              )
            )
          : null,
        codeModal[0]
          ? React.createElement("div", { className: "dset-mask", onClick: function () { setCodeModal(null); } },
              React.createElement("div", { className: "dset-modal dset-code-modal", onClick: function (e) { e.stopPropagation(); } },
                React.createElement("div", { className: "dset-head" },
                  React.createElement("span", { className: "dset-path" }, codeModal[0].path),
                  React.createElement("button", { className: "dset-x", onClick: function () { setCodeModal(null); } }, "×")
                ),
                React.createElement(CodeBlock, { content: codeModal[0].content })
              )
            )
          : null
      );
    }

    /**
     * Client 插件主体。
     * @param ctx - 客户端 Cordis 根上下文（slots 等经 ctx.get 读取）。
     */
    function apply(ctx) {
      ensureStyles();
      var call = makeCaller(function () { return ctx.get("connection"); });
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
          function (props) { return React.createElement(Toolbar, Object.assign({ call: call }, props)); }
        );
      });
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    // 客户端内核要求：ctx.<service> 属性访问必须先声明 inject（服务名）。
    // slots 服务来自平台种子 @deepseek-ai/dsh-client-ui-slots；connection 经 ctx.get 可选读取。
    exports.inject = ["slots"];
    return module.exports;
  },
});

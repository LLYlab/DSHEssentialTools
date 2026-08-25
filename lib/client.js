// dsh-essential-tools — Client 半区（永久 npm 包，浏览器端，精简版）
// 只保留三大能力：运行（条件显示）/ 文件（工作区文件夹折叠树预览）/ 版本（程序版本）
// 已移除：VTD 分支、会话树、会话管理、消息小版本、回退开关。

window.__ModuleLoader__.load({
  id: "dsh-essential-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    var NL = String.fromCharCode(10);

    // ── 主题样式 ───────────────────────────────────────────────────────────
    var CSS = "" +
      '.dset-root{position:fixed;inset:0;z-index:9990;pointer-events:none;font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:12.5px;color:var(--dsw-alias-label-primary)}' +
      '.dset-toolbar{position:fixed;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:9995}' +
      '.dset-tb-btn{width:48px;padding:9px 0;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;cursor:pointer;font:inherit}' +
      '.dset-tb-btn:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tb-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tb-ico{font-size:17px;line-height:1}' +
      '.dset-tb-lbl{font-size:11px}' +
      '.dset-panel{position:fixed;right:64px;top:50%;transform:translateY(-50%);width:380px;max-width:62vw;max-height:78vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;pointer-events:auto;z-index:9994;box-shadow:0 8px 30px rgba(0,0,0,.35)}' +
      '.dset-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600;min-height:34px}' +
      '.dset-x{background:none;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;line-height:1;padding:2px 4px}' +
      '.dset-body{overflow:auto;flex:1;padding:8px;display:flex;flex-direction:column;gap:4px}' +
      '.dset-empty{color:var(--dsw-alias-label-secondary);padding:14px 8px;text-align:center;font-size:12px}' +
      '.dset-toolbar-row{display:flex;gap:6px;align-items:center;padding:0 0 6px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:6px}' +
      '.dset-btn-mini{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);padding:3px 10px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-btn-mini:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-btn-mini:disabled{opacity:.5;cursor:default}' +
      '.dset-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-msg{padding:6px 8px;font-size:11.5px;border-radius:6px;white-space:pre-wrap;word-break:break-word}' +
      '.dset-msg-ok{color:var(--dsw-alias-state-success-primary)}' +
      '.dset-msg-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-msg-plain{color:var(--dsw-alias-label-secondary)}' +
      // 文件树（文件夹折叠）
      '.dset-tree{flex:1;overflow:auto;display:flex;flex-direction:column;gap:1px}' +
      '.dset-tree-row{display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:5px;cursor:pointer;white-space:nowrap;min-width:0}' +
      '.dset-tree-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-tree-row-file{color:var(--dsw-alias-label-primary)}' +
      '.dset-tree-caret{width:12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      '.dset-tree-ico{flex:none;width:16px;text-align:center;font-size:12px}' +
      '.dset-tree-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-size:12px}' +
      '.dset-tree-size{color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      // 文件内容查看
      '.dset-viewer{flex:1;overflow:auto;padding:8px;background:var(--dsw-alias-bg-base);border-radius:6px}' +
      '.dset-viewer-code{white-space:pre;word-break:break-word;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      // 版本
      '.dset-ver{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
      '.dset-ver-main{flex:1;min-width:0}' +
      '.dset-ver-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
      '.dset-ver-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      // 运行结果
      '.dset-runbox{margin-top:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);font-size:11.5px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto}' +
      '.dset-foot{color:var(--dsw-alias-label-secondary);font-size:11px;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l1)}';

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
        return connection.rpc.call("/api", "dshEssentialTools/" + method, { args: { args: args || {} } }).then(function (r) {
          if (r && r.ok) return r.value;
          var err = (r && r.error) || {};
          throw new Error(err.message || ("调用失败: " + method));
        });
      };
    }

    // ── 文件面板：工作区文件夹折叠树 + 内容预览 ────────────────────────────
    function FilePanel(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var tree = React.useState([]);
      var setTree = tree[1];
      var root = React.useState("");
      var setRoot = root[1];
      var expanded = React.useState({});
      var setExpanded = expanded[1];
      var loading = React.useState(false);
      var setLoading = loading[1];
      var error = React.useState(null);
      var setError = error[1];
      var file = React.useState(null);
      var setFile = file[1];
      var content = React.useState(null);
      var setContent = content[1];

      var refresh = function () {
        if (!sessionId) return;
        setLoading(true); setError(null);
        call("lvalListFiles", { sessionId: sessionId }).then(function (r) {
          setLoading(false);
          if (r && r.ok) { setTree(r.tree || []); setRoot(r.root || ""); }
          else setError((r && r.error) || "加载失败");
        }).catch(function (e) { setLoading(false); setError(String(e && e.message ? e.message : e)); });
      };
      React.useEffect(function () { if (sessionId) refresh(); }, [sessionId]);

      var toggleDir = function (path) {
        setExpanded(function (prev) { var next = Object.assign({}, prev); if (next[path]) delete next[path]; else next[path] = true; return next; });
      };
      var openFile = function (path) {
        if (!path) return;
        setContent(null); setError(null);
        call("lvalReadFile", { sessionId: sessionId, path: path }).then(function (r) {
          if (r && r.ok) { setFile(path); setContent(r.content || ""); }
          else setError((r && r.error) || "读取失败");
        }).catch(function (e) { setError(String(e && e.message ? e.message : e)); });
      };
      var renderNode = function (node, depth) {
        if (node.type === "dir") {
          var isOpen = expanded[0][node.path] === true;
          return React.createElement("div", { key: "d" + node.path },
            React.createElement("div", { className: "dset-tree-row" },
              React.createElement("span", { className: "dset-tree-caret", onClick: function () { toggleDir(node.path); } }, isOpen ? "▾" : "▸"),
              React.createElement("span", { className: "dset-tree-ico" }, isOpen ? "📂" : "📁"),
              React.createElement("span", { className: "dset-tree-name", onClick: function () { toggleDir(node.path); } }, node.name)
            ),
            isOpen && node.children ? node.children.map(function (c) { return renderNode(c, depth + 1); }) : null
          );
        }
        return React.createElement("div", { key: "f" + node.path },
          React.createElement("div", { className: "dset-tree-row dset-tree-row-file", onClick: function () { openFile(node.path); }, style: { paddingLeft: String(16 + depth * 14) + "px" } },
            React.createElement("span", { className: "dset-tree-caret" }, ""),
            React.createElement("span", { className: "dset-tree-ico" }, "🗎"),
            React.createElement("span", { className: "dset-tree-name" }, node.name),
            React.createElement("span", { className: "dset-tree-size" }, node.size ? String(Math.round(node.size / 1024)) + "KB" : "")
          )
        );
      };

      return React.createElement("div", { className: "dset-panel" },
        React.createElement("div", { className: "dset-head" },
          React.createElement("span", null, "文件 · 工作区"),
          React.createElement("button", { className: "dset-x", onClick: function () { props.onClose(); } }, "×")
        ),
        React.createElement("div", { className: "dset-body" },
          React.createElement("div", { className: "dset-toolbar-row" },
            React.createElement("button", { className: "dset-btn-mini", disabled: loading[0], onClick: refresh }, loading[0] ? "加载中…" : "刷新"),
            React.createElement("span", { className: "dset-foot", style: { border: "none", padding: "0" } }, root[0] ? root[0].split("\\").pop() : "")
          ),
          error[0] ? React.createElement("div", { className: "dset-empty" }, error[0]) : null,
          file[0] && content[0] !== null
            ? React.createElement("div", { className: "dset-viewer" },
                React.createElement("div", { className: "dset-viewer-code" }, content[0])
              )
            : React.createElement("div", { className: "dset-tree" },
                tree[0].length === 0 && !loading[0]
                  ? React.createElement("div", { className: "dset-empty" }, "工作区无源码文件")
                  : tree[0].map(function (n) { return renderNode(n, 0); })
              )
        ),
        React.createElement("div", { className: "dset-foot" }, "当前会话工作区 · 点击文件夹折叠/展开，点击文件预览")
      );
    }

    // ── 版本面板：程序版本快照/回退/删除 ──────────────────────────────────
    function VerPanel(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var versions = React.useState([]);
      var setVersions = versions[1];
      var loading = React.useState(false);
      var setLoading = loading[1];
      var error = React.useState(null);
      var setError = error[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var busy = React.useState(false);
      var setBusy = busy[1];

      var refresh = function () {
        if (!sessionId) return;
        setLoading(true); setError(null);
        call("verProgList", { sessionId: sessionId }).then(function (r) {
          setLoading(false);
          if (r && r.ok) setVersions(r.versions || []);
          else setError((r && r.error) || "加载失败");
        }).catch(function (e) { setLoading(false); setError(String(e && e.message ? e.message : e)); });
      };
      React.useEffect(function () { if (sessionId) refresh(); }, [sessionId]);

      var snapshot = function () {
        if (!sessionId || busy[0]) return;
        var label = window.prompt("版本标签（可选）", "");
        if (label === null) return;
        setBusy(true); setMsg(null);
        call("verProgCreate", { sessionId: sessionId, label: label }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已快照 " + r.fileCount + " 个文件" }); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "快照失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var restore = function (id, label) {
        if (!sessionId || busy[0]) return;
        if (!window.confirm("回退到版本 " + (label || id) + "？\n（回退前会自动备份当前代码）")) return;
        setBusy(true); setMsg(null);
        call("verProgRestore", { sessionId: sessionId, id: id }).then(function (r) {
          setBusy(false);
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已回退 " + r.restored + " 个文件" : "✗ " + ((r && r.error) || "回退失败") });
          refresh();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var remove = function (id, label) {
        if (!sessionId || busy[0]) return;
        if (!window.confirm("删除版本 " + (label || id) + "？")) return;
        setBusy(true); setMsg(null);
        call("verProgDelete", { sessionId: sessionId, id: id }).then(function (r) {
          setBusy(false);
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已删除" : "✗ " + ((r && r.error) || "删除失败") });
          refresh();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      return React.createElement("div", { className: "dset-panel" },
        React.createElement("div", { className: "dset-head" },
          React.createElement("span", null, "版本 · 程序快照"),
          React.createElement("button", { className: "dset-x", onClick: function () { props.onClose(); } }, "×")
        ),
        React.createElement("div", { className: "dset-body" },
          React.createElement("div", { className: "dset-toolbar-row" },
            React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: snapshot }, busy[0] ? "处理中…" : "快照"),
            React.createElement("button", { className: "dset-btn-mini", disabled: loading[0], onClick: refresh }, "刷新")
          ),
          msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
          error[0] ? React.createElement("div", { className: "dset-empty" }, error[0]) : null,
          versions[0].length === 0 && !loading[0]
            ? React.createElement("div", { className: "dset-empty" }, "暂无程序版本快照")
            : versions[0].map(function (v) {
                var confirm = null;
                return React.createElement("div", { key: v.id, className: "dset-ver" },
                  React.createElement("div", { className: "dset-ver-main" },
                    React.createElement("div", { className: "dset-ver-title" }, v.label || v.id),
                    React.createElement("div", { className: "dset-ver-sub" }, v.id + " · " + new Date(v.time).toLocaleString() + " · " + v.fileCount + " 文件")
                  ),
                  React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { restore(v.id, v.label); } }, "回退"),
                  React.createElement("button", { className: "dset-btn-mini dset-btn-danger", disabled: busy[0], onClick: function () { remove(v.id, v.label); } }, "删除")
                );
              })
        ),
        React.createElement("div", { className: "dset-foot" }, "代码快照 · 回退前自动备份")
      );
    }

    // ── 工具栏主体：运行（条件）/ 文件 / 版本 ──────────────────────────────
    function Toolbar(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var panel = React.useState(null);
      var setPanel = panel[1];
      var runable = React.useState(false);
      var setRunable = runable[1];
      var runKind = React.useState(null);
      var setRunKind = runKind[1];
      var runEntry = React.useState(null);
      var setRunEntry = runEntry[1];
      var running = React.useState(false);
      var setRunning = running[1];
      var runMsg = React.useState(null);
      var setRunMsg = runMsg[1];

      // 工作区运行入口探测（只在有可运行入口时显示"运行"）
      var detect = function () {
        if (!sessionId) { setRunable(false); return; }
        call("workspaceDetectEndpoint", { sessionId: sessionId }).then(function (r) {
          if (r && r.ok) { setRunable(r.runable === true); setRunKind(r.kind || null); setRunEntry(r.entry || null); }
          else setRunable(false);
        }).catch(function () { setRunable(false); });
      };
      React.useEffect(function () { detect(); }, [sessionId]);

      var doRun = function () {
        if (!sessionId || running[0]) return;
        setRunning(true); setRunMsg(null);
        call("lvalRun", { sessionId: sessionId }).then(function (r) {
          setRunning(false);
          if (r && r.ok) {
            var sub = r.run && r.run.ok ? "（进程 " + r.run.pid + "）" : (r.run && r.run.error ? " · " + r.run.error : "");
            setRunMsg({ ok: true, text: "✓ 已启动 " + (r.kind || "") + (r.entry ? " " + r.entry : "") + sub + (r.output ? "\n" + r.output.slice(0, 800) : "") });
          } else {
            setRunMsg({ ok: false, text: "✗ " + ((r && r.error) || "运行失败") + (r && r.output ? "\n" + r.output.slice(0, 800) : "") });
          }
        }).catch(function (e) { setRunning(false); setRunMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      return React.createElement("div", { ref: undefined, className: "dset-toolbar" },
        runable[0] ? React.createElement("button", {
          className: "dset-tb-btn",
          title: "运行入口：" + (runEntry[0] || runKind[0] || "") + "（工作区检测）",
          onClick: doRun,
        },
          React.createElement("span", { className: "dset-tb-ico" }, "▶"),
          React.createElement("span", { className: "dset-tb-lbl" }, running[0] ? "…" : "运行")
        ) : null,
        React.createElement("button", {
          className: "dset-tb-btn" + (panel[0] === "file" ? " dset-tb-on" : ""),
          title: "浏览工作区文件",
          onClick: function () { setPanel(panel[0] === "file" ? null : "file"); },
        },
          React.createElement("span", { className: "dset-tb-ico" }, "🗎"),
          React.createElement("span", { className: "dset-tb-lbl" }, "文件")
        ),
        React.createElement("button", {
          className: "dset-tb-btn" + (panel[0] === "ver" ? " dset-tb-on" : ""),
          title: "程序版本：快照/回退",
          onClick: function () { setPanel(panel[0] === "ver" ? null : "ver"); },
        },
          React.createElement("span", { className: "dset-tb-ico" }, "🕘"),
          React.createElement("span", { className: "dset-tb-lbl" }, "版本")
        ),
        runMsg[0] ? React.createElement("div", { className: "dset-panel", style: { width: 300, transform: "translateY(-50%)" } },
          React.createElement("div", { className: "dset-head" },
            React.createElement("span", null, "运行结果"),
            React.createElement("button", { className: "dset-x", onClick: function () { setRunMsg(null); } }, "×")
          ),
          React.createElement("div", { className: "dset-body" },
            React.createElement("div", { className: "dset-msg " + (runMsg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, runMsg[0].text)
          )
        ) : null,
        panel[0] === "file" ? React.createElement(FilePanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null,
        panel[0] === "ver" ? React.createElement(VerPanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null
      );
    }

    // ── 插件主体 ───────────────────────────────────────────────────────────
    function apply(ctx) {
      ensureStyles();
      var call = makeCaller(function () { return ctx.get("connection"); });
      var getCurrentSession = function () {
        try {
          var list = ctx.sessions.list.getSnapshot();
          return list && list.current;
        } catch (e) {
          return undefined;
        }
      };
      var getSessionId = function () {
        var cur = getCurrentSession();
        return cur ? cur.id : undefined;
      };
      // 右侧悬浮工具栏（shell.overlay 槽）
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
          function (props) {
            return React.createElement(Toolbar, Object.assign({
              call: call,
              sessionId: props.sessionId || getSessionId(),
            }, props));
          }
        );
      });
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    exports.inject = ["slots", "sessions"];
    return module.exports;
  },
});

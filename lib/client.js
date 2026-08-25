// dsh-essential-tools — Client 半区(永久 npm 包,浏览器端,重建版)
// 能力:三件套工具栏(运行/文件/版本)+ VTD 虚拟对话树视图(默认会话视图,编辑/重试/<N>)
//      + 设置页 VTD debug / 自动版本控制 debug。

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
      '.dset-tree{flex:1;overflow:auto;display:flex;flex-direction:column;gap:1px}' +
      '.dset-tree-row{display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:5px;cursor:pointer;white-space:nowrap;min-width:0}' +
      '.dset-tree-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-tree-caret{width:12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      '.dset-tree-ico{flex:none;width:16px;text-align:center;font-size:12px}' +
      '.dset-tree-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-size:12px}' +
      '.dset-tree-size{color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      '.dset-viewer{flex:1;overflow:auto;padding:8px;background:var(--dsw-alias-bg-base);border-radius:6px}' +
      '.dset-viewer-code{white-space:pre;word-break:break-word;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dset-ver{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
      '.dset-ver-main{flex:1;min-width:0}' +
      '.dset-ver-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
      '.dset-ver-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      '.dset-foot{color:var(--dsw-alias-label-secondary);font-size:11px;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l1)}' +
      // VTD 对话视图
      '.dset-vtd{flex:1;min-width:0;display:flex;flex-direction:column;height:100%;overflow:hidden}' +
      '.dset-vtd-msgs{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px}' +
      '.dset-vtd-row{display:flex;flex-direction:column;gap:4px;max-width:min(760px,92%)}' +
      '.dset-vtd-row-user{align-self:flex-end;align-items:flex-end}' +
      '.dset-vtd-row-assistant{align-self:flex-start;align-items:flex-start}' +
      '.dset-vtd-bubble{padding:8px 12px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-vtd-bubble-user{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-vtd-bubble-assistant{background:var(--dsw-alias-bg-base)}' +
      '.dset-vtd-meta{color:var(--dsw-alias-label-secondary);font-size:10.5px;padding:0 4px}' +
      '.dset-vtd-bar{display:flex;align-items:center;gap:6px;padding:0 2px;min-height:22px}' +
      '.dset-vtd-ico{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;background:none;color:var(--dsw-alias-label-secondary);border:none;border-radius:6px;cursor:pointer;padding:0}' +
      '.dset-vtd-ico:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-vtd-ico svg{width:15px;height:15px;display:block}' +
      '.dset-vtd-nav{display:inline-flex;align-items:center;gap:2px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-vtd-nav-btn{background:none;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;padding:0 4px;line-height:1;border-radius:4px}' +
      '.dset-vtd-nav-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-vtd-nav-num{min-width:16px;text-align:center;font-weight:600;color:var(--dsw-alias-brand-primary)}' +
      '.dset-vtd-editbox{display:flex;flex-direction:column;gap:4px;width:min(520px,90%);padding:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}' +
      '.dset-vtd-editarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 6px;font:inherit;font-size:12.5px}' +
      '.dset-vtd-composer{padding:8px 14px 8px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:4px;flex:none}' +
      '.dset-vtd-composer-input{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}' +
      '.dset-vtd-send{align-self:flex-end}' +
      // 设置 debug
      '.dset-dbg-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}' +
      '.dset-dbg-panel{margin-top:8px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;background:var(--dsw-alias-bg-base);max-height:320px;overflow:auto}' +
      '.dset-dbg-row{display:flex;gap:8px;align-items:center;font-size:11.5px;padding:3px 4px;border-radius:5px}' +
      '.dset-dbg-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-dbg-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-dbg-tag{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}' +
      '.dset-dbg-tag-hid{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}';

    function ensureStyles() {
      if (typeof document === "undefined") return;
      if (document.querySelector('style[data-plugin-css="dsh-essential-tools"]')) return;
      var el = document.createElement("style");
      el.setAttribute("data-plugin", "dsh-essential-tools");
      el.setAttribute("data-plugin-css", "dsh-essential-tools");
      el.textContent = CSS;
      document.head.append(el);
    }

    // ── RPC 桥 ────────────────────────────────────────────────────────────
    function makeCaller(getConnection) {
      return function call(method, args) {
        var connection = getConnection();
        if (connection === undefined || typeof connection.rpc !== "object" || typeof connection.rpc.call !== "function") {
          return Promise.reject(new Error("connection 服务不可用(dsh-essential-tools)"));
        }
        return connection.rpc.call("/api", "dshEssentialTools/" + method, { args: { args: args || {} } }).then(function (r) {
          if (r && r.ok) return r.value;
          var err = (r && r.error) || {};
          throw new Error(err.message || ("调用失败: " + method));
        });
      };
    }

    // ── 图标(网上免费图标风格:inline SVG,无文字,悬停 title 显示描述)────
    var ICON_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
    var ICON_RETRY = 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 9.99h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';

    // ── 文件面板(工作区文件夹折叠树 + 预览)───────────────────────────────
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
            ? React.createElement("div", { className: "dset-viewer" }, React.createElement("div", { className: "dset-viewer-code" }, content[0]))
            : React.createElement("div", { className: "dset-tree" },
                tree[0].length === 0 && !loading[0]
                  ? React.createElement("div", { className: "dset-empty" }, "工作区无源码文件")
                  : tree[0].map(function (n) { return renderNode(n, 0); })
              )
        ),
        React.createElement("div", { className: "dset-foot" }, "当前会话工作区 · 点击文件夹折叠/展开,点击文件预览")
      );
    }

    // ── 版本面板(大版本:手动快照/回退/删除)───────────────────────────────
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
        var label = window.prompt("版本标签(可选)", "");
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
        if (!window.confirm("回退到版本 " + (label || id) + "?\n(回退前会自动备份当前代码)")) return;
        setBusy(true); setMsg(null);
        call("verProgRestore", { sessionId: sessionId, id: id }).then(function (r) {
          setBusy(false);
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已回退 " + r.restored + " 个文件" : "✗ " + ((r && r.error) || "回退失败") });
          refresh();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var remove = function (id, label) {
        if (!sessionId || busy[0]) return;
        if (!window.confirm("删除版本 " + (label || id) + "?")) return;
        setBusy(true); setMsg(null);
        call("verProgDelete", { sessionId: sessionId, id: id }).then(function (r) {
          setBusy(false);
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已删除" : "✗ " + ((r && r.error) || "删除失败") });
          refresh();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      return React.createElement("div", { className: "dset-panel" },
        React.createElement("div", { className: "dset-head" },
          React.createElement("span", null, "版本 · 大版本(手动)"),
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
            ? React.createElement("div", { className: "dset-empty" }, "暂无大版本快照")
            : versions[0].map(function (v) {
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

    // ── VTD 对话视图(虚拟对话树 = 默认会话视图)───────────────────────────
    function VtdView(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var tree = React.useState(null);
      var setTree = tree[1];
      var loading = React.useState(false);
      var setLoading = loading[1];
      var error = React.useState(null);
      var setError = error[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var editFor = React.useState(null);
      var setEditFor = editFor[1];
      var draft = React.useState("");
      var setDraft = draft[1];
      var msgsRef = React.useRef(null);

      var refresh = function () {
        if (!sessionId) return;
        setLoading(true);
        call("treeView", { sessionId: sessionId }).then(function (r) {
          setLoading(false);
          if (r && r.ok) { setTree(r); setError(null); }
          else setError((r && r.error) || "加载失败");
        }).catch(function (e) { setLoading(false); setError(String(e && e.message ? e.message : e)); });
      };
      React.useEffect(function () { if (sessionId) refresh(); }, [sessionId]);
      // 轮询:子会话回答是异步的,轻量刷新
      React.useEffect(function () {
        if (!sessionId) return undefined;
        var handle = setInterval(refresh, 4000);
        return function () { clearInterval(handle); };
      }, [sessionId]);

      var doEdit = function (m) {
        if (busy[0]) return;
        var text = (editFor[0] && editFor[0].messageId === m.messageId ? editFor[0].text : "").trim();
        if (text === "") { setMsg({ ok: false, text: "编辑内容不能为空" }); return; }
        setBusy(true); setMsg(null);
        call("editMessage", { sessionId: sessionId, messageId: m.messageId, newText: text }).then(function (r) {
          setBusy(false); setEditFor(null);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已编辑并创建新叉,新回答生成中…" }); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "编辑失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var doRetry = function (m) {
        if (busy[0]) return;
        if (!window.confirm("重试这条消息?\n(将创建新叉并让 AI 重新回答;原对话隐藏但保留)")) return;
        setBusy(true); setMsg(null);
        call("retryMessage", { sessionId: sessionId, messageId: m.messageId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已重试并创建新叉,新回答生成中…" }); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "重试失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var cycleFork = function (m, dir) {
        if (busy[0] || !m.selector || !m.childBranches || m.childBranches.length < 2) return;
        var cur = m.branchIndex || 1;
        var next = (cur - 1 + dir + m.childBranches.length) % m.childBranches.length;
        var target = m.childBranches[next];
        if (!target) return;
        setBusy(true);
        call("switchFork", { sessionId: sessionId, branchId: target.branchId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已切换分叉" }); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "切换失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var sendMsg = function () {
        var text = draft[0].trim();
        if (text === "" || busy[0]) return;
        setBusy(true); setMsg(null);
        call("newMessage", { sessionId: sessionId, text: text }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setDraft(""); setMsg({ ok: true, text: "✓ 已发送" }); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "发送失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var msgs = (tree[0] && tree[0].messages) || [];
      var renderMsg = function (m) {
        var isUser = m.role === "user";
        var editing = editFor[0] && editFor[0].messageId === m.messageId;
        return React.createElement("div", { key: String(m.seq) + "-" + (m.messageId || ""), className: "dset-vtd-row " + (isUser ? "dset-vtd-row-user" : "dset-vtd-row-assistant") },
          React.createElement("div", { className: "dset-vtd-bubble " + (isUser ? "dset-vtd-bubble-user" : "dset-vtd-bubble-assistant") },
            React.createElement("div", null, m.text || "（无文本）"),
            React.createElement("div", { className: "dset-vtd-meta" }, (isUser ? "用户" : "助手") + " #" + m.seq)
          ),
          React.createElement("div", { className: "dset-vtd-bar" },
            m.selector === true
              ? React.createElement("span", { className: "dset-vtd-nav" },
                  React.createElement("button", { className: "dset-vtd-nav-btn", disabled: busy[0], title: "上一个分叉", onClick: function () { cycleFork(m, -1); } }, "<"),
                  React.createElement("span", { className: "dset-vtd-nav-num" }, String(m.branchIndex || 1)),
                  React.createElement("button", { className: "dset-vtd-nav-btn", disabled: busy[0], title: "下一个分叉", onClick: function () { cycleFork(m, 1); } }, ">")
                )
              : null,
            isUser
              ? React.createElement("button", { className: "dset-vtd-ico", title: "编辑", disabled: busy[0], onClick: function () { setEditFor(editing ? null : { messageId: m.messageId, text: m.text }); } },
                  React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_EDIT }))
                )
              : null,
            isUser
              ? React.createElement("button", { className: "dset-vtd-ico", title: "重试", disabled: busy[0], onClick: function () { doRetry(m); } },
                  React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_RETRY }))
                )
              : null
          ),
          editing
            ? React.createElement("div", { className: "dset-vtd-editbox" },
                React.createElement("textarea", { className: "dset-vtd-editarea", value: editFor[0].text, onChange: function (e) { setEditFor({ messageId: m.messageId, text: e.target.value }); } }),
                React.createElement("div", { className: "dset-toolbar-row", style: { border: "none", margin: 0, justifyContent: "flex-end" } },
                  React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { doEdit(m); } }, busy[0] ? "处理中…" : "保存(重发)"),
                  React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { setEditFor(null); } }, "取消")
                )
              )
            : null
        );
      };

      return React.createElement("div", { className: "dset-vtd" },
        React.createElement("div", { className: "dset-toolbar-row", style: { padding: "8px 14px 4px", border: "none", margin: 0 } },
          React.createElement("button", { className: "dset-btn-mini", disabled: loading[0], onClick: refresh }, loading[0] ? "加载中…" : "刷新"),
          React.createElement("span", { className: "dset-foot", style: { border: "none", padding: 0 } },
            tree[0] && tree[0].activeBranchId && tree[0].activeBranchId !== "trunk"
              ? ("当前分叉: " + ((tree[0].forks || []).find(function (f) { return f.branchId === tree[0].activeBranchId; }) || {}).label || "#" + (tree[0].activeBranchId || "").slice(0, 8))
              : "主线"
          ),
          msg[0] ? React.createElement("span", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null
        ),
        error[0] ? React.createElement("div", { className: "dset-empty" }, "✗ " + error[0]) : null,
        React.createElement("div", { ref: msgsRef, className: "dset-vtd-msgs" },
          msgs.length === 0 && !loading[0]
            ? React.createElement("div", { className: "dset-empty" }, "暂无消息")
            : msgs.map(renderMsg)
        ),
        React.createElement("div", { className: "dset-vtd-composer" },
          React.createElement("textarea", { className: "dset-vtd-composer-input", value: draft[0], placeholder: tree[0] && tree[0].activeBranchId !== "trunk" ? "在分叉中发送…" : "发送到主线…", onChange: function (e) { setDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMsg(); } } }),
          React.createElement("button", { className: "dset-btn-mini dset-vtd-send", disabled: busy[0], onClick: sendMsg }, busy[0] ? "处理中…" : "发送")
        )
      );
    }

    // ── 工具栏(运行/文件/版本)────────────────────────────────────────────
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

      return React.createElement("div", { className: "dset-toolbar" },
        runable[0] ? React.createElement("button", { className: "dset-tb-btn", title: "运行入口: " + (runEntry[0] || runKind[0] || "") + "（工作区检测）", onClick: doRun },
          React.createElement("span", { className: "dset-tb-ico" }, "▶"),
          React.createElement("span", { className: "dset-tb-lbl" }, running[0] ? "…" : "运行")
        ) : null,
        React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "file" ? " dset-tb-on" : ""), title: "浏览工作区文件", onClick: function () { setPanel(panel[0] === "file" ? null : "file"); } },
          React.createElement("span", { className: "dset-tb-ico" }, "🗎"),
          React.createElement("span", { className: "dset-tb-lbl" }, "文件")
        ),
        React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "ver" ? " dset-tb-on" : ""), title: "大版本:快照/回退", onClick: function () { setPanel(panel[0] === "ver" ? null : "ver"); } },
          React.createElement("span", { className: "dset-tb-ico" }, "🕘"),
          React.createElement("span", { className: "dset-tb-lbl" }, "版本")
        ),
        runMsg[0] ? React.createElement("div", { className: "dset-panel", style: { width: 300 } },
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

    // ── 设置页:VTD debug / 自动版本控制 debug ─────────────────────────────
    function VtdDebugSection(props) {
      var call = props.call;
      var showSessions = React.useState(false);
      var setShowSessions = showSessions[1];
      var showMinor = React.useState(false);
      var setShowMinor = showMinor[1];
      var sessionsData = React.useState([]);
      var setSessionsData = sessionsData[1];
      var minorData = React.useState([]);
      var setMinorData = minorData[1];
      var error = React.useState(null);
      var setError = error[1];

      var loadSessions = function () {
        setShowSessions(!showSessions[0]); setError(null);
        if (showSessions[0]) return;
        call("debugSessions", {}).then(function (r) {
          if (r && r.ok) setSessionsData(r.sessions || []);
          else setError((r && r.error) || "加载失败");
        }).catch(function (e) { setError(String(e && e.message ? e.message : e)); });
      };
      var loadMinor = function () {
        setShowMinor(!showMinor[0]); setError(null);
        if (showMinor[0]) return;
        call("debugMinor", {}).then(function (r) {
          if (r && r.ok) setMinorData(r.versions || []);
          else setError((r && r.error) || "加载失败");
        }).catch(function (e) { setError(String(e && e.message ? e.message : e)); });
      };

      return React.createElement("div", null,
        React.createElement("h3", null, "VTD 调试"),
        React.createElement("p", null, "查看被隐藏的真实对话(根会话 + 全部 fork 子会话)与自动版本控制记录。"),
        React.createElement("div", { className: "dset-dbg-btns" },
          React.createElement("button", { className: "dset-btn-mini", onClick: loadSessions }, "VTD debug"),
          React.createElement("button", { className: "dset-btn-mini", onClick: loadMinor }, "自动版本控制 debug")
        ),
        error[0] ? React.createElement("div", { className: "dset-msg dset-msg-err" }, error[0]) : null,
        showSessions[0] ? React.createElement("div", { className: "dset-dbg-panel" },
          sessionsData[0].length === 0 ? React.createElement("div", { className: "dset-empty" }, "暂无会话") : null,
          sessionsData[0].map(function (s) {
            return React.createElement("div", { key: s.id, className: "dset-dbg-row" },
              React.createElement("span", { className: "dset-dbg-id" }, s.id + (s.parentSession ? " · fork 自 " + s.parentSession.slice(-8) : "")),
              React.createElement("span", { className: "dset-dbg-tag " + (s.hidden ? "dset-dbg-tag-hid" : "") }, s.hidden ? "隐藏(叉)" : (s.origin || "正常"))
            );
          })
        ) : null,
        showMinor[0] ? React.createElement("div", { className: "dset-dbg-panel" },
          minorData[0].length === 0 ? React.createElement("div", { className: "dset-empty" }, "暂无小版本") : null,
          minorData[0].map(function (v) {
            return React.createElement("div", { key: v.id, className: "dset-dbg-row" },
              React.createElement("span", { className: "dset-dbg-id" }, v.id + " · " + v.kind + (v.forkId ? " · fork " + v.forkId.slice(0, 10) : "") + " · " + v.fileCount + " 文件"),
              React.createElement("span", { className: "dset-dbg-tag" }, new Date(v.time).toLocaleString())
            );
          })
        ) : null
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
      // 预置 VTD 对话视图为默认会话视图(产品也可手动切回"聊天")
      try {
        if (typeof localStorage !== "undefined") {
          var rawView = localStorage.getItem("dsh.conversation.chat");
          var viewState = rawView ? JSON.parse(rawView) : null;
          localStorage.setItem("dsh.conversation.chat", JSON.stringify(Object.assign({ selection: null, draft: "", view: "vtd-tree", inspect: null }, viewState || {}, { view: "vtd-tree" })));
        }
      } catch (e) { /* 忽略 */ }
      // 三件套工具栏(shell.overlay)
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
          function (props) {
            return React.createElement(Toolbar, Object.assign({ call: call, sessionId: props.sessionId || getSessionId() }, props));
          }
        );
      });
      // VTD 对话树视图(conversation.view 视图环)
      ctx.slots.inject("conversation.view", function () {
        return ctx.slots.register({
          name: "conversation.view",
          id: "vtd-tree",
          order: 15,
          label: function () { return "VTD 对话"; },
        }, function (props) {
          return React.createElement(VtdView, Object.assign({ call: call }, props));
        });
      });
      // 设置页:VTD debug / 自动版本控制 debug(settings.section)
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-vtd-debug",
          order: 90,
          label: function () { return "VTD"; },
        }, function (props) {
          return React.createElement(VtdDebugSection, Object.assign({ call: call }, props));
        });
      });
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    exports.inject = ["slots", "sessions"];
    return module.exports;
  },
});

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
      '.dset-pre{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-tree-panel{position:fixed;left:10px;top:50%;transform:translateY(-50%);width:340px;max-width:70vw;max-height:80vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;pointer-events:auto;z-index:9994;box-shadow:0 8px 30px rgba(0,0,0,.35)}' +
      '.dset-tree-body{overflow:auto;flex:1;padding:8px;display:flex;flex-direction:column;gap:2px}' +
      '.dset-tree-node{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;min-width:0}' +
      '.dset-tree-node:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-tree-title{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}' +
      '.dset-tree-sub{color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}' +
      '.dset-tree-live{width:6px;height:6px;border-radius:50%;flex:none}' +
      '.dset-tree-live-on{background:var(--dsw-alias-state-success-primary)}' +
      '.dset-tree-live-off{background:var(--dsw-alias-label-tertiary)}' +
      '.dset-tree-caret{width:14px;flex:none;text-align:center;color:var(--dsw-alias-label-secondary);font-size:10px}' +
      '.dset-tree-fork{color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}' +
      '.dset-tree-toolbar{display:flex;gap:6px;align-items:center}' +
      '.dset-tree-refresh{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 8px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-tree-refresh:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tree-count{color:var(--dsw-alias-label-secondary);font-size:11px;flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis}' +
      '.dset-tree-empty{padding:12px;color:var(--dsw-alias-label-secondary);text-align:center}' +
      '.dset-branch-wrap{position:relative;display:inline-flex;align-items:center}' +
      '.dset-branch-btn{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--dsw-alias-label-secondary);border-radius:6px;cursor:pointer;font-size:13px;line-height:1;padding:0}' +
      '.dset-branch-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-branch-menu{position:absolute;bottom:calc(100% + 6px);right:0;width:240px;max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:2px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;z-index:9998;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:6px}' +
      '.dset-branch-title{font-size:11.5px;font-weight:600;padding:2px 6px 4px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-branch-item{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;font-size:12px;min-width:0}' +
      '.dset-branch-item:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-branch-item-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}' +
      '.dset-branch-item-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px;flex:none}' +
      '.dset-branch-item-btn{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:1px 6px;font-size:11px;border-radius:5px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-branch-item-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-branch-item-btn:disabled{opacity:.5;cursor:default}' +
      '.dset-branch-new{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px}' +
      '.dset-branch-new-input{flex:1;min-width:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:3px 6px;font:inherit;font-size:12px}' +
      '.dset-branch-msg{font-size:11px;padding:2px 6px;white-space:pre-wrap;word-break:break-all}' +
      '.dset-branch-msg-ok{color:var(--dsw-alias-state-success-primary)}' +
      '.dset-branch-msg-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-branch-mask{position:fixed;inset:0;z-index:9997;background:transparent}' +
      '.dset-branch-active{color:var(--dsw-alias-brand-primary)}' +
      '.dset-branch-ops{display:flex;gap:4px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px}' +
      '.dset-branch-op{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 8px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-branch-op:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-branch-op:disabled{opacity:.5;cursor:default}' +
      '.dset-branch-editbox{display:flex;flex-direction:column;gap:4px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px}' +
      '.dset-branch-editarea{width:100%;box-sizing:border-box;min-height:56px;resize:vertical;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 6px;font:inherit;font-size:12px}' +
      '.dset-branch-editbtns{display:flex;gap:4px;justify-content:flex-end}' +
      '.dset-branch-vtab{display:flex;gap:6px;align-items:center;padding:0 0 6px;border-bottom:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-branch-vtab-btn{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 10px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-branch-vtab-on{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-bview-root{display:flex;flex-direction:column;height:100%;gap:8px;padding:8px;box-sizing:border-box}' +
      '.dset-bview-cols{display:flex;flex:1;min-height:0;gap:8px}' +
      '.dset-bview-list{width:200px;flex:none;overflow:auto;display:flex;flex-direction:column;gap:2px}' +
      '.dset-bview-item{display:flex;flex-direction:column;gap:2px;padding:5px 6px;border-radius:6px;cursor:pointer;font-size:12px;border:1px solid transparent}' +
      '.dset-bview-item:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-bview-item-on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-bview-item-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-bview-item-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      '.dset-bview-msgs{flex:1;min-width:0;overflow:auto;display:flex;flex-direction:column;gap:6px}' +
      '.dset-bview-msg{padding:6px 8px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-bview-msg-user{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-bview-msg-assistant{background:var(--dsw-alias-bg-base)}' +
      '.dset-bview-msg-seq{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-bottom:2px}' +
      '.dset-ver-tabrow{display:flex;gap:6px;align-items:center;padding:0 0 6px;border-bottom:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-ver-tab{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:2px 10px;font-size:11.5px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-ver-tab-on{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-ver-toggle{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}' +
      '.dset-ver-toggle select{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:2px 4px;font:inherit;font-size:11.5px}' +
      '.dset-vermsg{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
      '.dset-vermsg-head{display:flex;align-items:center;gap:6px;min-width:0}' +
      '.dset-vermsg-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:12px}' +
      '.dset-vermsg-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px;flex:none}' +
      '.dset-vermsg-body{display:flex;flex-direction:column;gap:4px}' +
      '.dset-vermsg-ver{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 4px;border-radius:6px}' +
      '.dset-vermsg-ver:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-vermsg-ver-info{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}' +
      '.dset-vermsg-ver-btn{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:0 6px;font-size:10.5px;border-radius:5px;cursor:pointer;font:inherit;white-space:nowrap}' +
      '.dset-vermsg-ver-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-bview-msgrow{display:flex;flex-direction:column;gap:4px}' +
      '.dset-bview-msgbar{display:flex;align-items:center;gap:6px;padding:0 2px;min-height:20px}' +
      '.dset-bview-nav{display:inline-flex;align-items:center;gap:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-bview-nav-btn{background:none;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;padding:0 4px;line-height:1;border-radius:4px}' +
      '.dset-bview-nav-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-bview-nav-btn:disabled{opacity:.35;cursor:default}' +
      '.dset-bview-nav-num{min-width:14px;text-align:center;font-weight:600;color:var(--dsw-alias-brand-primary)}' +
      '.dset-bview-act{background:none;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:0 7px;font-size:10.5px;border-radius:5px;cursor:pointer;font:inherit;white-space:nowrap;line-height:1.6}' +
      '.dset-bview-act:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-bview-act:disabled{opacity:.5;cursor:default}' +
      '.dset-bview-editbox{display:flex;flex-direction:column;gap:4px}' +
      '.dset-bview-editarea{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 6px;font:inherit;font-size:12px}' +
      '.dset-dlg-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:9999}' +
      '.dset-dlg{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4);width:min(420px,92vw)}' +
      '.dset-dlg-head{padding:10px 14px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600;font-size:13px}' +
      '.dset-dlg-body{padding:12px 14px;font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}' +
      '.dset-dlg-btns{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1);justify-content:flex-end}' +
      '.dset-dlg-btn{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);padding:5px 12px;border-radius:6px;cursor:pointer;font:inherit;font-size:12px}' +
      '.dset-dlg-btn:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-dlg-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-dlg-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}' +
      '.dset-dlg-btn:disabled{opacity:.5;cursor:default}' +
      '.dset-bview-msgbar-empty{min-height:0}';

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
    // 网关契约：payload.args 含描述符 wire 字段；我们的描述符是单参数 wire:'args'，
    // 因此方法实参要包在 {args: {args: <实参>}} 里（与 ctx.remote 生成的调用一致）。
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

    // ── 共享：消息操作执行 + 三选项确认弹窗 ────────────────────────────────
    // kind: edit | retry | rollback；rollbackCode=true 时附带回退代码至断点。
    function runMsgAction(call, sessionId, messageId, kind, extraArgs, rollbackCode) {
      var args = { sessionId: sessionId, messageId: messageId, rollbackCode: rollbackCode === true };
      if (kind === "edit" && extraArgs && typeof extraArgs.newText === "string") args.newText = extraArgs.newText;
      var method = kind === "edit" ? "msgEdit" : kind === "retry" ? "msgRegenerate" : "msgRollback";
      return call(method, args);
    }
    function dialogText(kind) {
      var what = kind === "edit" ? "编辑这条消息" : kind === "retry" ? "重试（重新生成）" : "回退这条消息";
      return "即将" + what + "。\n\n· 确定：应用更改 + 重发消息 + 创造分支 + 回退代码至断点\n· 继续但不回退：应用更改，但不回退代码\n· 取消：不做任何更改";
    }
    function ConfirmDialog(props) {
      var d = props.dialog;
      if (!d) return null;
      return React.createElement("div", { className: "dset-dlg-mask", onClick: function () { if (!props.busy) props.onChoice("cancel"); } },
        React.createElement("div", { className: "dset-dlg", onClick: function (e) { e.stopPropagation(); } },
          React.createElement("div", { className: "dset-dlg-head" }, "此操作会回退"),
          React.createElement("div", { className: "dset-dlg-body" }, dialogText(d.kind)),
          React.createElement("div", { className: "dset-dlg-btns" },
            React.createElement("button", { className: "dset-dlg-btn", disabled: props.busy, onClick: function () { props.onChoice("cancel"); } }, "取消"),
            React.createElement("button", { className: "dset-dlg-btn", disabled: props.busy, onClick: function () { props.onChoice("nocode"); } }, "继续但不回退"),
            React.createElement("button", { className: "dset-dlg-btn dset-dlg-btn-primary", disabled: props.busy, onClick: function () { props.onChoice("confirm"); } }, "确定")
          )
        )
      );
    }

    // ── 消息"分叉"动作（VTD 会话内分支；渲染在复制按钮旁边）────────────────
    function BranchAction(props) {
      var call = props.call;
      var messageId = props.messageId;
      var sessionId = props.sessionId;
      var open = React.useState(false);
      var setOpen = open[1];
      var branches = React.useState([]);
      var setBranches = branches[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var label = React.useState("");
      var setLabel = label[1];
      var editMode = React.useState(false);
      var setEditMode = editMode[1];
      var editText = React.useState("");
      var setEditText = editText[1];
      var opBusy = React.useState(false);
      var setOpBusy = opBusy[1];
      var dlg = React.useState(null);
      var setDlg = dlg[1];

      var refresh = function () {
        if (!sessionId) return;
        call("branchList", { sessionId: sessionId }).then(function (r) {
          setBranches((r && r.ok && r.branches) || []);
        }).catch(function () { setBranches([]); });
      };
      var toggle = function () {
        var next = !open[0];
        setOpen(next);
        setMsg(null);
        setEditMode(false);
        if (next) refresh();
      };
      var startEdit = function () {
        if (!editMode[0]) setEditText("");
        setEditMode(!editMode[0]);
      };
      var confirmChoice = function (choice) {
        var d = dlg[0];
        if (!d) return;
        if (choice === "cancel") { setDlg(null); return; }
        setDlg(null);
        setOpBusy(true);
        setMsg(null);
        var extra = null;
        if (d.kind === "edit") {
          var text = (editMode[0] ? editText[0] : "").trim();
          if (text === "") { setOpBusy(false); setMsg({ ok: false, text: "✗ 编辑内容不能为空" }); return; }
          extra = { newText: text };
        }
        runMsgAction(call, sessionId, messageId, d.kind, extra, choice === "confirm").then(function (r) {
          setOpBusy(false);
          if (r && r.ok) {
            setEditMode(false);
            var suffix = choice === "confirm" ? (r.code && r.code.skipped ? "（无程序快照可回退）" : "（代码已回退）") : "（未回退代码）";
            setMsg({ ok: true, text: "✓ " + (d.kind === "edit" ? "已编辑" : d.kind === "retry" ? "已重新生成" : "已回退") + suffix });
            refresh();
          } else {
            setMsg({ ok: false, text: "✗ " + ((r && r.error) || "操作失败") });
          }
        }).catch(function (e) {
          setOpBusy(false);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      var saveEdit = function () {
        if (editMode[0]) { setDlg({ kind: "edit" }); return; }
        setEditMode(true);
        setEditText("");
      };
      var createBranch = function () {
        if (busy[0] || !sessionId) return;
        setBusy(true);
        setMsg(null);
        call("branchCreate", { sessionId: sessionId, messageId: messageId, label: label[0] }).then(function (r) {
          setBusy(false);
          if (r && r.ok) {
            setLabel("");
            setMsg({ ok: true, text: "✓ 已创建分支（锚点 seq " + r.anchorSeq + "）" });
            refresh();
          } else {
            setMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
          }
        }).catch(function (e) {
          setBusy(false);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      var switchBranch = function (branchId) {
        if (busy[0] || !sessionId) return;
        setBusy(true);
        setMsg(null);
        call("branchSwitch", { sessionId: sessionId, branchId: branchId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) setMsg({ ok: true, text: "✓ 已切换分支" });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "切换失败") });
          refresh();
        }).catch(function (e) {
          setBusy(false);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };

      if (!messageId || !sessionId) return null;
      return React.createElement("div", { className: "dset-branch-wrap" },
        React.createElement("button", {
          type: "button",
          className: "dset-branch-btn",
          title: "重试（重新生成）",
          "aria-label": "重试",
          disabled: opBusy[0],
          onClick: function () { setDlg({ kind: "retry" }); },
        }, "⟳"),
        React.createElement("button", {
          type: "button",
          className: "dset-branch-btn",
          title: "回退",
          "aria-label": "回退",
          disabled: opBusy[0],
          onClick: function () { setDlg({ kind: "rollback" }); },
        }, "↩"),
        open[0] ? React.createElement("div", { className: "dset-branch-mask", onClick: function () { setOpen(false); } }) : null,
        React.createElement("button", {
          type: "button",
          className: "dset-branch-btn",
          title: "分叉（VTD 会话内分支）/ 编辑",
          "aria-label": "分叉",
          onClick: toggle,
        }, "⑂"),
        open[0]
          ? React.createElement("div", { className: "dset-branch-menu", onClick: function (e) { e.stopPropagation(); } },
              React.createElement("div", { className: "dset-branch-title" }, "消息操作（VTD）"),
              React.createElement("div", { className: "dset-branch-ops" },
                React.createElement("button", { className: "dset-branch-op", disabled: opBusy[0], onClick: saveEdit }, "✎ 编辑"),
                React.createElement("button", { className: "dset-branch-op", disabled: opBusy[0], onClick: function () { setDlg({ kind: "rollback" }); } }, "↩ 回退"),
                React.createElement("button", { className: "dset-branch-op", disabled: opBusy[0], onClick: function () { setDlg({ kind: "retry" }); } }, "⟳ 重新生成")
              ),
              editMode[0]
                ? React.createElement("div", { className: "dset-branch-editbox" },
                    React.createElement("textarea", {
                      className: "dset-branch-editarea",
                      value: editText[0],
                      placeholder: "新内容…",
                      onChange: function (e) { setEditText(e.target.value); },
                    }),
                    React.createElement("div", { className: "dset-branch-editbtns" },
                      React.createElement("button", { className: "dset-branch-op", disabled: opBusy[0], onClick: saveEdit }, opBusy[0] ? "保存中…" : "保存"),
                      React.createElement("button", { className: "dset-branch-op", disabled: opBusy[0], onClick: function () { setEditMode(false); } }, "取消")
                    )
                  )
                : null,
              React.createElement("div", { className: "dset-branch-title" }, "在此分叉（虚拟分支）"),
              React.createElement("div", { className: "dset-branch-new" },
                React.createElement("input", {
                  className: "dset-branch-new-input",
                  placeholder: "分支标签（可选）",
                  value: label[0],
                  onChange: function (e) { setLabel(e.target.value); },
                }),
                React.createElement("button", { className: "dset-branch-item-btn", disabled: busy[0], onClick: createBranch }, busy[0] ? "处理中…" : "新建")
              ),
              msg[0] ? React.createElement("div", { className: "dset-branch-msg " + (msg[0].ok ? "dset-branch-msg-ok" : "dset-branch-msg-err") }, msg[0].text) : null,
              branches[0].length === 0
                ? React.createElement("div", { className: "dset-branch-msg" }, "暂无分支")
                : branches[0].map(function (b) {
                    return React.createElement("div", { key: b.branchId, className: "dset-branch-item" },
                      React.createElement("span", { className: "dset-branch-item-label" }, (b.label || "分支@" + b.anchorSeq) + (b.active ? "（当前）" : "")),
                      React.createElement("span", { className: "dset-branch-item-sub" }, "锚点 " + b.anchorSeq + " · " + b.ranges.length + " 段"),
                      React.createElement("button", {
                        className: "dset-branch-item-btn",
                        disabled: busy[0] || b.active,
                        onClick: function () { switchBranch(b.branchId); },
                      }, b.active ? "当前" : "切换")
                    );
                  })
            )
          : null,
        React.createElement(ConfirmDialog, { dialog: dlg[0], busy: opBusy[0], onChoice: confirmChoice })
      );
    }

    // ── "分支"视图（conversation.view 标签）：分支感知对话流 ─────────────────
    // 每条消息下：< N > 分支序号选择器（节点子分支创建顺序，分支数<=1 时隐藏）
    //           + 操作（我的消息: 编辑；你的回答: 重试；均有 回退）
    // 编辑/重试/回退触发三选项弹窗：取消 / 确定(应用更改+重发+建分支+回退代码至断点) / 继续但不回退
    function BranchView(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var branches = React.useState([]);
      var setBranches = branches[1];
      var views = React.useState({});
      var setViews = views[1];
      var selected = React.useState(null);
      var setSelected = selected[1];
      var loading = React.useState(false);
      var setLoading = loading[1];
      var error = React.useState(null);
      var setError = error[1];
      var info = React.useState(null);
      var setInfo = info[1];
      var editFor = React.useState(null);
      var setEditFor = editFor[1];
      var dialog = React.useState(null);
      var setDialog = dialog[1];
      var busy = React.useState(false);
      var setBusy = busy[1];

      var refresh = function () {
        if (!sessionId) return;
        setLoading(true);
        setError(null);
        call("branchView", { sessionId: sessionId }).then(function (r) {
          setLoading(false);
          if (r && r.ok) {
            setBranches(r.branches || []);
            setViews(r.views || {});
            setInfo(r);
            setSelected(function (prev) {
              if (prev && r.views[prev]) return prev;
              var active = (r.branches || []).find(function (b) { return b.active; });
              return active ? active.branchId : ((r.branches || [])[0] ? r.branches[0].branchId : null);
            });
          } else {
            setError((r && r.error) || "加载失败");
          }
        }).catch(function (e) {
          setLoading(false);
          setError(String(e && e.message ? e.message : e));
        });
      };
      React.useEffect(function () { refresh(); }, [sessionId]);

      var switchBranch = function (branchId) {
        if (!sessionId || busy[0]) return;
        setBusy(true);
        call("branchSwitch", { sessionId: sessionId, branchId: branchId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setSelected(branchId); refresh(); }
          else setError((r && r.error) || "切换失败");
        }).catch(function (e) {
          setBusy(false);
          setError(String(e && e.message ? e.message : e));
        });
      };
      // < > 在该消息节点的子分支间循环（按创建顺序）
      var cycleBranch = function (m, dir) {
        var children = m.childBranches || [];
        if (children.length < 2) return;
        var current = m.branchIndex || 1;
        var next = (current - 1 + dir + children.length) % children.length;
        switchBranch(children[next].branchId);
      };
      var askDialog = function (kind, messageId) {
        setDialog({ kind: kind, messageId: messageId });
      };
      var runAction = function (kind, messageId, rollbackCode) {
        var sid = sessionId;
        if (!sid) return;
        setBusy(true);
        var args = { sessionId: sid, messageId: messageId, rollbackCode: rollbackCode === true };
        if (kind === "edit") {
          var text = (editFor[0] && editFor[0].messageId === messageId ? editFor[0].text : "").trim();
          if (text === "") { setBusy(false); setError("编辑内容不能为空"); return; }
          args.newText = text;
        }
        var method = kind === "edit" ? "msgEdit" : (kind === "retry" ? "msgRegenerate" : "msgRollback");
        call(method, args).then(function (r) {
          setBusy(false);
          setDialog(null);
          setEditFor(null);
          if (r && r.ok) {
            setInfo({ ok: true, text: "✓ " + (kind === "edit" ? "已编辑" : kind === "retry" ? "已重新生成" : "已回退") + (rollbackCode && r.code && r.code.skipped ? "（无程序快照可回退）" : rollbackCode ? "（代码已回退）" : "（未回退代码）") });
            refresh();
          } else {
            setError("✗ " + ((r && r.error) || "操作失败"));
          }
        }).catch(function (e) {
          setBusy(false);
          setDialog(null);
          setError("✗ " + String(e && e.message ? e.message : e));
        });
      };
      var confirmDialog = function (choice) {
        var d = dialog[0];
        if (!d) return;
        if (choice === "cancel") { setDialog(null); return; }
        runAction(d.kind, d.messageId, choice === "confirm");
      };
      var startEdit = function (messageId) {
        var current = editFor[0];
        if (current && current.messageId === messageId) { setEditFor(null); return; }
        setEditFor({ messageId: messageId, text: "" });
      };
      var dialogText = function (d) {
        if (!d) return "";
        var what = d.kind === "edit" ? "编辑这条消息" : d.kind === "retry" ? "重试（重新生成）" : "回退这条消息";
        return "即将" + what + "。\n\n· 确定：应用更改 + 重发消息 + 创造分支 + 回退代码至断点\n· 继续但不回退：应用更改，但不回退代码\n· 取消：不做任何更改";
      };

      var msgs = (selected[0] && views[0][selected[0]] && views[0][selected[0]].messages) || [];
      var renderMsg = function (m) {
        var isUser = m.role === "user";
        var editing = editFor[0] && editFor[0].messageId === m.messageId;
        return React.createElement("div", { key: String(m.seq) + (m.messageId || ""), className: "dset-bview-msgrow" },
          React.createElement("div", {
            className: "dset-bview-msg " + (isUser ? "dset-bview-msg-user" : "dset-bview-msg-assistant"),
          },
            React.createElement("div", { className: "dset-bview-msg-seq" }, "#" + m.seq + (isUser ? " · 用户" : " · 助手")),
            m.text || "（无文本）"
          ),
          React.createElement("div", { className: "dset-bview-msgbar" },
            m.selector === true
              ? React.createElement("span", { className: "dset-bview-nav" },
                  React.createElement("button", { className: "dset-bview-nav-btn", disabled: busy[0], onClick: function () { cycleBranch(m, -1); } }, "<"),
                  React.createElement("span", { className: "dset-bview-nav-num" }, String(m.branchIndex || 1)),
                  React.createElement("button", { className: "dset-bview-nav-btn", disabled: busy[0], onClick: function () { cycleBranch(m, 1); } }, ">")
                )
              : null,
            isUser
              ? React.createElement("button", { className: "dset-bview-act", disabled: busy[0], onClick: function () { startEdit(m.messageId); } }, "✎ 编辑")
              : React.createElement("button", { className: "dset-bview-act", disabled: busy[0], onClick: function () { askDialog("retry", m.messageId); } }, "⟳ 重试"),
            React.createElement("button", { className: "dset-bview-act", disabled: busy[0], onClick: function () { askDialog("rollback", m.messageId); } }, "↩ 回退")
          ),
          editing
            ? React.createElement("div", { className: "dset-bview-editbox" },
                React.createElement("textarea", {
                  className: "dset-bview-editarea",
                  value: editFor[0].text,
                  placeholder: "新内容…",
                  onChange: function (e) { setEditFor({ messageId: m.messageId, text: e.target.value }); },
                }),
                React.createElement("div", { className: "dset-branch-editbtns" },
                  React.createElement("button", { className: "dset-branch-op", disabled: busy[0], onClick: function () { askDialog("edit", m.messageId); } }, busy[0] ? "处理中…" : "保存"),
                  React.createElement("button", { className: "dset-branch-op", disabled: busy[0], onClick: function () { setEditFor(null); } }, "取消")
                )
              )
            : null
        );
      };

      return React.createElement("div", { className: "dset-bview-root" },
        React.createElement("div", { className: "dset-tree-toolbar" },
          React.createElement("button", { className: "dset-tree-refresh", disabled: loading[0], onClick: refresh }, loading[0] ? "加载中…" : "刷新"),
          React.createElement("span", { className: "dset-tree-count" }, branches[0].length ? String(branches[0].length) + " 个分支" : "")
        ),
        info[0] && info[0].ok && info[0].text ? React.createElement("div", { className: "dset-branch-msg dset-branch-msg-ok" }, info[0].text) : null,
        error[0] ? React.createElement("div", { className: "dset-empty" }, "✗ " + error[0]) : null,
        React.createElement("div", { className: "dset-bview-cols" },
          React.createElement("div", { className: "dset-bview-list" },
            branches[0].length === 0 && !loading[0]
              ? React.createElement("div", { className: "dset-empty" }, "暂无分支\n（在本视图内编辑/重试会创建分支）")
              : branches[0].map(function (b) {
                  return React.createElement("div", {
                    key: b.branchId,
                    className: "dset-bview-item" + (selected[0] === b.branchId ? " dset-bview-item-on" : ""),
                    onClick: function () { setSelected(b.branchId); },
                  },
                    React.createElement("span", { className: "dset-bview-item-title" }, (b.label || "分支@" + b.anchorSeq) + (b.active ? "（当前）" : "")),
                    React.createElement("span", { className: "dset-bview-item-sub" }, "锚点 " + b.anchorSeq + " · " + b.ranges.length + " 段 · " + (((views[0][b.branchId] || {}).messages) || []).length + " 条"),
                    React.createElement("button", {
                      className: "dset-branch-item-btn",
                      disabled: busy[0] || b.active,
                      onClick: function (e) { e.stopPropagation(); switchBranch(b.branchId); },
                    }, b.active ? "当前" : "切换")
                  );
                })
          ),
          React.createElement("div", { className: "dset-bview-msgs" },
            msgs.length === 0
              ? React.createElement("div", { className: "dset-empty" }, "该分支暂无消息")
              : msgs.map(renderMsg)
          )
        ),
        dialog[0]
          ? React.createElement("div", { className: "dset-dlg-mask", onClick: function () { if (!busy[0]) setDialog(null); } },
              React.createElement("div", { className: "dset-dlg", onClick: function (e) { e.stopPropagation(); } },
                React.createElement("div", { className: "dset-dlg-head" }, "此操作会回退"),
                React.createElement("div", { className: "dset-dlg-body" }, dialogText(dialog[0])),
                React.createElement("div", { className: "dset-dlg-btns" },
                  React.createElement("button", { className: "dset-dlg-btn", disabled: busy[0], onClick: function () { confirmDialog("cancel"); } }, "取消"),
                  React.createElement("button", { className: "dset-dlg-btn", disabled: busy[0], onClick: function () { confirmDialog("nocode"); } }, "继续但不回退"),
                  React.createElement("button", { className: "dset-dlg-btn dset-dlg-btn-primary", disabled: busy[0], onClick: function () { confirmDialog("confirm"); } }, "确定")
                )
              )
            )
          : null
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
      // ── 版本面板：程序/消息页签 + 回退开关 ──
      var verTab = React.useState("prog");
      var setVerTab = verTab[1];
      var minorMessages = React.useState([]);
      var setMinorMessages = minorMessages[1];
      var minorLoading = React.useState(false);
      var setMinorLoading = minorLoading[1];
      var minorMsg = React.useState(null);
      var setMinorMsg = minorMsg[1];
      var toggleTarget = React.useState(null);
      var setToggleTarget = toggleTarget[1];
      var expandedMsg = React.useState({});
      var setExpandedMsg = expandedMsg[1];
      // ── 会话树（M1）──
      var treeOpen = React.useState(false);
      var setTreeOpen = treeOpen[1];
      var trees = React.useState([]);
      var setTrees = trees[1];
      var treeLoading = React.useState(false);
      var setTreeLoading = treeLoading[1];
      var treeError = React.useState(null);
      var setTreeError = treeError[1];
      var expanded = React.useState({});
      var setExpanded = expanded[1];

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
        call("verToggleGet", {}).then(function (r) {
          if (alive && r && r.ok) setToggleTarget(r.target);
        }).catch(function () {});
        return function () { alive = false; };
      }, []);

      var refreshVersions = function () {
        call("verProgList", {}).then(function (r) {
          setVersions((r && r.versions) || []);
        }).catch(function () {});
      };

      // ── 消息版本（M4 面板页签）────────────────────────────────────────
      var currentSession = function () {
        return props.getCurrentSession ? props.getCurrentSession() : undefined;
      };
      var loadMinor = function () {
        var sid = currentSession();
        if (!sid) { setMinorMessages([]); setMinorLoading(false); return; }
        setMinorLoading(true);
        call("verMinorMessages", { sessionId: sid }).then(function (r) {
          setMinorLoading(false);
          setMinorMessages((r && r.ok && r.messages) || []);
        }).catch(function () {
          setMinorLoading(false);
          setMinorMessages([]);
        });
      };
      var setToggle = function (target) {
        setToggleTarget(target);
        call("verToggleSet", { target: target }).then(function (r) {
          if (r && r.ok) setMinorMsg({ ok: true, text: "✓ 回退目标: " + (r.target === "original" ? "原始版本" : "最近小版本") });
          else setMinorMsg({ ok: false, text: "✗ " + ((r && r.error) || "保存失败") });
        }).catch(function (e) {
          setMinorMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      var restoreMinor = function (messageId, versionIndex) {
        var sid = currentSession();
        if (!sid) return;
        call("verMinorRestore", { sessionId: sid, messageId: messageId, versionIndex: versionIndex }).then(function (r) {
          if (r && r.ok) setMinorMsg({ ok: true, text: "✓ 已恢复该版本" });
          else setMinorMsg({ ok: false, text: "✗ " + ((r && r.error) || "恢复失败") });
        }).catch(function (e) {
          setMinorMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      var toggleMsgExpand = function (messageId) {
        setExpandedMsg(function (prev) {
          var next = Object.assign({}, prev);
          if (next[messageId]) delete next[messageId];
          else next[messageId] = true;
          return next;
        });
      };
      var fmtCause = function (c) {
        return { original: "原始", edit: "编辑", regenerate: "重新生成", rollback: "回退" }[c] || c;
      };
      var fmtVerTime = function (t) {
        if (!t) return "";
        try { return new Date(t).toLocaleString(); } catch (e) { return String(t); }
      };
      var minorRows = minorMessages[0].map(function (m) {
        var isExpanded = expandedMsg[0][m.messageId] === true;
        return React.createElement("div", { key: m.messageId, className: "dset-vermsg" },
          React.createElement("div", { className: "dset-vermsg-head", onClick: function () { toggleMsgExpand(m.messageId); } },
            React.createElement("span", { className: "dset-vermsg-title" }, (isExpanded ? "▾ " : "▸ ") + (m.textPreview || m.messageId)),
            React.createElement("span", { className: "dset-vermsg-sub" }, m.versionCount + " 个版本")
          ),
          isExpanded
            ? React.createElement("div", { className: "dset-vermsg-body" },
                m.versions.map(function (v) {
                  return React.createElement("div", { key: v.id, className: "dset-vermsg-ver" },
                    React.createElement("span", { className: "dset-vermsg-ver-info" }, "v" + v.versionIndex + " · " + fmtCause(v.cause) + " · " + fmtVerTime(v.time)),
                    React.createElement("button", {
                      className: "dset-vermsg-ver-btn",
                      onClick: function () { restoreMinor(m.messageId, v.versionIndex); },
                    }, "恢复")
                  );
                })
              )
            : null
        );
      });

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

      // ── 会话树：拉取 / 刷新 ────────────────────────────────────────────
      var fetchTree = function () {
        setTreeLoading(true);
        setTreeError(null);
        call("treeList", {}).then(function (r) {
          setTreeLoading(false);
          if (r && r.ok) setTrees((r.trees) || []);
          else setTreeError((r && r.error) || "加载会话树失败");
        }).catch(function (e) {
          setTreeLoading(false);
          setTreeError(String(e && e.message ? e.message : e));
        });
      };
      var toggleTree = function () {
        var next = !treeOpen[0];
        setTreeOpen(next);
        if (next) fetchTree();
      };
      var toggleNode = function (id) {
        setExpanded(function (prev) {
          var next = Object.assign({}, prev);
          if (next[id]) delete next[id];
          else next[id] = true;
          return next;
        });
      };
      var openNode = function (id) {
        if (props.openSession) props.openSession(id);
      };
      var countSessions = function (nodes) {
        var n = 0;
        for (var i = 0; i < nodes.length; i++) { n += 1; n += countSessions(nodes[i].children || []); }
        return n;
      };
      var renderTreeRow = function (node, depth) {
        var kids = node.children || [];
        var isExpanded = expanded[0][node.id] !== undefined ? expanded[0][node.id] : true;
        var hasKids = kids.length > 0;
        return React.createElement("div", { key: node.id },
          React.createElement("div", {
            className: "dset-tree-node",
            style: { paddingLeft: String(10 + depth * 16) + "px" },
            onClick: function (e) {
              e.stopPropagation();
              if (hasKids) toggleNode(node.id);
              else openNode(node.id);
            },
            title: node.id + (node.parent ? "（fork 自 " + node.parent + "）" : ""),
          },
            React.createElement("span", { className: "dset-tree-caret" }, hasKids ? (isExpanded ? "▾" : "▸") : ""),
            React.createElement("span", { className: "dset-tree-fork" }, node.parent ? "⑂" : "◉"),
            React.createElement("span", { className: "dset-tree-live " + (node.live ? "dset-tree-live-on" : "dset-tree-live-off") }),
            React.createElement("span", { className: "dset-tree-title" }, node.title || node.id),
            React.createElement("span", { className: "dset-tree-sub" }, node.live ? "运行中" : "")
          ),
          hasKids && isExpanded ? kids.map(function (k) { return renderTreeRow(k, depth + 1); }) : null
        );
      };

      var treePanel =
        treeOpen[0]
          ? React.createElement("div", { className: "dset-tree-panel" },
              React.createElement("div", { className: "dset-head" },
                React.createElement("span", null, "会话树（fork 血缘）"),
                React.createElement("button", { className: "dset-x", onClick: function () { setTreeOpen(false); } }, "×")
              ),
              React.createElement("div", { className: "dset-body dset-tree-body" },
                React.createElement("div", { className: "dset-tree-toolbar" },
                  React.createElement("button", { className: "dset-tree-refresh", disabled: treeLoading[0], onClick: fetchTree }, treeLoading[0] ? "加载中…" : "刷新"),
                  React.createElement("span", { className: "dset-tree-count" }, trees[0].length ? String(countSessions(trees[0])) + " 个会话" : "")
                ),
                treeError[0] ? React.createElement("div", { className: "dset-empty" }, "✗ " + treeError[0]) : null,
                treeLoading[0] && trees[0].length === 0
                  ? React.createElement("div", { className: "dset-empty" }, "加载会话树…")
                  : trees[0].length === 0 && !treeError[0]
                    ? React.createElement("div", { className: "dset-empty" }, "暂无会话，或全部为孤儿会话（无 fork 血缘）")
                    : trees[0].map(function (root) { return renderTreeRow(root, 0); })
              ),
              React.createElement("div", { className: "dset-foot" }, "点击节点切换会话；带 ⑂ 的是 fork 子会话")
            )
          : null;

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
          ),
          React.createElement("button", {
            className: "dset-tb-btn" + (treeOpen[0] ? " dset-tb-on" : ""),
            title: "会话树：fork 血缘（祖先/后代）",
            onClick: toggleTree,
          },
            React.createElement("span", { className: "dset-tb-ico" }, "🌳"),
            React.createElement("span", { className: "dset-tb-lbl" }, "会话树")
          )
        ),
        treePanel,
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
                React.createElement("span", null, "版本管理"),
                React.createElement("button", { className: "dset-x", onClick: function () { setPanel(null); } }, "×")
              ),
              React.createElement("div", { className: "dset-body" },
                React.createElement("div", { className: "dset-ver-tabrow" },
                  React.createElement("button", {
                    className: "dset-ver-tab" + (verTab[0] === "prog" ? " dset-ver-tab-on" : ""),
                    onClick: function () { setVerTab("prog"); },
                  }, "程序版本"),
                  React.createElement("button", {
                    className: "dset-ver-tab" + (verTab[0] === "msg" ? " dset-ver-tab-on" : ""),
                    onClick: function () { setVerTab("msg"); loadMinor(); },
                  }, "消息版本")
                ),
                verTab[0] === "prog"
                  ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
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
                  : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                      React.createElement("div", { className: "dset-ver-toggle" },
                        React.createElement("span", null, "回退目标:"),
                        React.createElement("select", {
                          value: toggleTarget[0] || "minor",
                          onChange: function (e) { setToggle(e.target.value); },
                        },
                          React.createElement("option", { value: "minor" }, "最近小版本（自动）"),
                          React.createElement("option", { value: "original" }, "原始版本")
                        )
                      ),
                      minorMsg[0] ? React.createElement("div", { className: msgCls(minorMsg[0]) }, msgText(minorMsg[0])) : null,
                      minorLoading[0]
                        ? React.createElement("div", { className: "dset-empty" }, "加载消息版本…")
                        : minorMessages[0].length === 0
                          ? React.createElement("div", { className: "dset-empty" }, "暂无消息版本记录\n（编辑/回退消息后自动产生）")
                          : minorRows
                    )
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
     * @param ctx - 客户端 Cordis 根上下文（slots/sessions 已注入）。
     */
    function apply(ctx) {
      ensureStyles();
      // 让"分支"视图成为默认主视图：预置会话视图状态（store 整值 JSON 持久化）。
      // 仅首次写入；用户手动切回"聊天"后尊重其选择。
      try {
        if (typeof localStorage !== "undefined" && localStorage.getItem("dsh.conversation.chat") === null) {
          localStorage.setItem("dsh.conversation.chat", JSON.stringify({ selection: null, draft: "", view: "dsh-branch", inspect: null }));
        }
      } catch (e) { /* 忽略 */ }
      var call = makeCaller(function () { return ctx.get("connection"); });
      var getCurrentSession = function () {
        try {
          var list = ctx.sessions.list.getSnapshot();
          return list && list.current;
        } catch (e) {
          return undefined;
        }
      };
      // 右侧工具栏（shell.overlay，list 槽）
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
          function (props) {
            return React.createElement(Toolbar, Object.assign({
              call: call,
              getCurrentSession: getCurrentSession,
              openSession: function (id) { ctx.sessions.open(id); },
            }, props));
          }
        );
      });
      // 消息"分叉"动作（conversation.chat.assistant-actions，list 槽，渲染在复制旁边）
      ctx.slots.inject("conversation.chat.assistant-actions", function () {
        return ctx.slots.register({
          name: "conversation.chat.assistant-actions",
          id: "dsh-branch",
          order: 5,
          inject: function (sessionId) { return { sessionId: sessionId }; },
        }, function (props) {
          return React.createElement(BranchAction, Object.assign({ call: call }, props));
        });
      });
      // "分支"视图标签（conversation.view 视图环，与"轨迹"同机制）
      ctx.slots.inject("conversation.view", function () {
        return ctx.slots.register({
          name: "conversation.view",
          id: "dsh-branch",
          order: 20,
          label: function () { return "分支"; },
          inject: function (sessionId) { return { sessionId: sessionId }; },
        }, function (props) {
          return React.createElement(BranchView, Object.assign({ call: call }, props));
        });
      });
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    // 客户端内核要求：ctx.<service> 属性访问必须先声明 inject（服务名）。
    // slots 服务来自平台种子 @deepseek-ai/dsh-client-ui-slots；sessions 由 client-runtime 提供；
    // connection 经 ctx.get 可选读取。
    exports.inject = ["slots", "sessions"];
    return module.exports;
  },
});

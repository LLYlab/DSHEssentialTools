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
    var ReactDOM = require("react-dom");

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
      '.dset-btn-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-btn-mini:disabled{opacity:.5;cursor:default}' +
      '.dset-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      // DET 管理器开关
      '.dset-switch-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);cursor:pointer;margin:0}' +
      '.dset-switch-row:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-mda-on{border-color:var(--dsw-alias-brand-primary)!important;background:var(--dsw-alias-bg-layer-2)!important}' +
      '.dset-mda-on .dset-switch-name{color:var(--dsw-alias-brand-primary);font-weight:600}' +
      '.dset-mda-check{font-weight:600;color:var(--dsw-alias-state-success-primary)}' +
      '.dset-switch-main{flex:1;min-width:0}' +
      '.dset-switch-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-switch-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      '.dset-switch{width:36px;height:20px;flex:none;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;transition:background .15s,border-color .15s}' +
      '.dset-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:999px;background:var(--dsw-alias-label-secondary);transition:left .15s}' +
      '.dset-switch-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-switch-on::after{left:18px;background:#fff}' +
      '.dset-sec-title{margin:10px 0 4px;font-size:12.5px;font-weight:600}' +
      '.dset-sec-desc{margin:0 0 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}' +
      '.dset-chk-summary{padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);font-size:11.5px;line-height:1.6}' +
      '.dset-msg{padding:6px 8px;font-size:11.5px;border-radius:6px;white-space:pre-wrap;word-break:break-word}' +
      '.dset-msg-ok{color:var(--dsw-alias-state-success-primary)}' +
      '.dset-msg-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-tree{flex:1;overflow:auto;display:flex;flex-direction:column;gap:1px}' +
      '.dset-tree-row{display:flex;align-items:center;gap:5px;padding:2px 6px;border-radius:5px;cursor:pointer;white-space:nowrap;min-width:0}' +
      '.dset-tree-row:hover{background:rgba(128,128,128,.16)}' +
      '.dset-tree-row-file:hover{background:rgba(128,128,128,.24)}' +
      '.dset-modal-actions .dset-btn-mini:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-tree-caret{width:12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      '.dset-tree-ico{flex:none;width:16px;text-align:center;font-size:12px}' +
      '.dset-tree-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-size:12px}' +
      '.dset-tree-size{color:var(--dsw-alias-label-secondary);font-size:10px;flex:none}' +
      '.dset-viewer{flex:1;overflow:auto;padding:8px;background:var(--dsw-alias-bg-base);border-radius:6px}' +
      '.dset-viewer-code{white-space:pre;word-break:break-word;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dset-tree-dir .dset-tree-name{font-weight:500}' +
      '.dset-tree-row-open .dset-tree-name{color:var(--dsw-alias-brand-primary);font-weight:600}' +
      '.dset-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9997;display:flex;align-items:center;justify-content:center}' +
      '.dset-modal{width:min(940px,93vw);max-height:86vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45)}' +
      '.dset-modal-code{flex:1;overflow:auto;padding:10px 12px;background:var(--dsw-alias-bg-base);white-space:pre;word-break:break-word;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dset-modal-edit{flex:1;overflow:auto;width:100%;box-sizing:border-box;padding:10px 12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:none;outline:none;font:inherit;font-size:12px;line-height:1.5;resize:none;white-space:pre;word-break:break-word}' +
      '.dset-modal-actions{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);justify-content:flex-end;align-items:center}' +
      '.dset-modal-state{color:var(--dsw-alias-label-secondary);font-size:11px;margin-right:auto}' +
      '.dset-diff{flex:1;overflow:auto;padding:8px 10px;background:var(--dsw-alias-bg-base);font-family:inherit;font-size:12px;line-height:1.5;white-space:pre;word-break:break-word}' +
      '.dset-diff-row{display:flex;gap:6px;padding:0 2px}' +
      '.dset-diff-sign{flex:none;width:14px;text-align:center;font-weight:600;color:var(--dsw-alias-label-secondary)}' +
      '.dset-diff-add{background:rgba(0,200,120,.14);color:var(--dsw-alias-state-success-primary)}' +
      '.dset-diff-del{background:rgba(230,60,60,.14);color:var(--dsw-alias-state-error-primary)}' +
      '.dset-approve-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11.5px}' +
      '.dset-ver{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}' +
      '.dset-ver-main{flex:1;min-width:0}' +
      '.dset-ver-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
      '.dset-ver-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      '.dset-foot{color:var(--dsw-alias-label-secondary);font-size:11px;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l1)}' +
      // VTD 对话视图(借鉴产品普通对话 UI)
      '.dset-vtd{flex:1;min-width:0;display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}' +
      '.dset-vtd-msgs{flex:1;overflow:auto;display:flex;flex-direction:column;gap:16px;padding:18px 22px 10px}' +
      '.dset-vtd-row{display:flex;flex-direction:column;gap:4px}' +
      '.dset-vtd-row-user{align-self:flex-end;align-items:flex-end;max-width:min(600px,86%)}' +
      '.dset-vtd-row-assistant{align-self:flex-start;align-items:flex-start;width:100%;max-width:min(820px,100%)}' +
      '.dset-vtd-bubble{white-space:pre-wrap;word-break:break-word;font-size:16px;line-height:24px}' +
      '.dset-vtd-bubble-user{background:var(--dsw-specific-bubble);color:var(--dsw-alias-label-primary);border-radius:22px;padding:10px 16px}' +
      '.dset-vtd-bubble-assistant{background:none;border:none;padding:2px 2px 0}' +
      '.dset-vtd-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:2px 4px 0}' +
      '.dset-vtd-bar{display:flex;align-items:center;gap:4px;padding:0 4px;min-height:26px}' +
      '.dset-vtd-bar:empty{display:none}' +
      '.dset-vtd-ico{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;background:none;color:var(--dsw-alias-label-secondary);border:none;border-radius:999px;cursor:pointer;padding:0;transition:background-color .12s,color .12s}' +
      '.dset-vtd-ico:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-vtd-ico svg{width:16px;height:16px;display:block}' +
      '.dset-vtd-nav{display:inline-flex;align-items:center;gap:1px;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);background:var(--dsw-specific-selector);border-radius:999px;padding:1px 2px 1px 6px}' +
      '.dset-vtd-nav-btn{background:none;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;padding:0 4px;line-height:1;border-radius:999px}' +
      '.dset-vtd-nav-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-vtd-nav-num{min-width:14px;text-align:center;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dset-vtd-branch{display:inline-flex;align-items:center;gap:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 10px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}' +
      '.dset-vtd-row-context{align-self:stretch;max-width:min(820px,100%)}' +
      '.dset-vtd-context{display:block;min-width:0;margin:0}' +
      '.dset-vtd-context summary{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px;padding:2px 0;list-style:none}' +
      '.dset-vtd-context summary::-webkit-details-marker{display:none}' +
      '.dset-vtd-context-caret{flex:none;font-size:10px;color:var(--dsw-alias-label-caption);transition:transform .12s}' +
      '.dset-vtd-context[open] .dset-vtd-context-caret{transform:rotate(90deg)}' +
      '.dset-vtd-context-title{font-weight:500}' +
      '.dset-vtd-context-src{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.dset-vtd-context-body{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;margin:6px 0 0 16px;padding:10px 12px;max-height:160px;overflow:auto;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}' +
      '.dset-vtd-context-body p{margin:4px 0}' +
      '.dset-vtd-editbox{display:flex;flex-direction:column;gap:6px;width:min(520px,90%);padding:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv2)}' +
      '.dset-vtd-edit-inplace{display:flex;flex-direction:column;gap:6px;width:100%;min-width:260px}' +
      '.dset-vtd-edit-inplace .dset-vtd-editarea{min-height:56px}' +
      '.dset-vtd-edit-actions{display:flex;gap:6px;justify-content:flex-end}' +
      '.dset-vtd-editarea{width:100%;box-sizing:border-box;resize:none;overflow:hidden;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:12px;padding:8px 12px;font:inherit;font-size:13px;line-height:20px;outline:none}' +
      '.dset-vtd-editarea:focus{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-vtd-composer{flex:none;box-sizing:border-box;width:100%;max-width:min(820px,calc(100% - 32px));margin:0 auto 12px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);border-radius:18px;padding:10px 12px 8px;display:flex;flex-direction:column;gap:6px}' +
      '.dset-vtd-composer-input{width:100%;box-sizing:border-box;min-height:44px;max-height:200px;resize:none;overflow-y:auto;background:none;border:none;outline:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;line-height:24px;white-space:pre-wrap}' +
      '.dset-vtd-composer-input::placeholder{color:var(--dsw-alias-label-caption)}' +
      '.dset-vtd-send{align-self:flex-end;background:var(--dsw-alias-button-info-fill);color:#fff;border:none;border-radius:999px;padding:6px 16px;font:inherit;font-size:12.5px;line-height:1;cursor:pointer;transition:background-color .12s}' +
      '.dset-vtd-send:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}' +
      '.dset-vtd-send:disabled{opacity:.5;cursor:default}' +
      // 设置 debug
      '.dset-dbg-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}' +
      '.dset-dbg-panel{margin-top:8px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;background:var(--dsw-alias-bg-base);max-height:320px;overflow:auto}' +
      '.dset-dbg-row{display:flex;gap:8px;align-items:center;font-size:11.5px;padding:3px 4px;border-radius:5px}' +
      '.dset-dbg-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-dbg-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-dbg-tag{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}' +
      '.dset-dbg-tag-hid{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      // 精细渲染(Markdown-lite + 内容块;跟随产品排版/卡片)
      '.dset-md-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;overflow:auto;white-space:pre;font-family:inherit;font-size:12.5px;line-height:1.6;margin:6px 0;color:var(--dsw-alias-label-primary)}' +
      '.dset-md-reason{margin:6px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-reason summary{cursor:pointer;user-select:none;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-reason summary:hover{color:var(--dsw-alias-label-primary)}' +
      '.dset-md-reason pre{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;margin:6px 0;color:var(--dsw-alias-label-secondary);white-space:pre;overflow:auto;font-family:inherit;font-size:12px;line-height:1.6}' +
      '.dset-md-tool{margin:8px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:8px 12px;font-size:12.5px}' +
      '.dset-md-tool-result{margin:2px 0 6px}' +
      '.dset-md-tool-err{border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-md-tool-head{display:flex;align-items:center;gap:6px;margin-bottom:4px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-tool-ico{flex:none;font-size:12px}' +
      '.dset-md-tool-name{font-weight:500;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      '.dset-md-tool-id{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-left:auto}' +
      '.dset-md-args{white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;font-family:inherit}' +
      '.dset-vtd-bubble h1,.dset-vtd-bubble h2,.dset-vtd-bubble h3,.dset-vtd-bubble h4{font-size:13px;margin:8px 0 4px}' +
      '.dset-vtd-bubble p{margin:5px 0}' +
      '.dset-vtd-bubble ul,.dset-vtd-bubble ol{margin:5px 0;padding-left:18px}' +
      '.dset-vtd-bubble blockquote{margin:5px 0;padding-left:12px;border-left:2px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary)}' +
      '.dset-vtd-bubble code{background:var(--dsw-alias-markdown-inline-code);border-radius:4px;padding:0 4px;font-size:12.5px;font-family:inherit}' +
      '.dset-vtd-bubble strong{font-weight:600}' +
      '.dset-vtd-meta{margin-top:4px}' +
      // 全局插件管理(设置页)
      '.dset-gp-tabs{display:flex;gap:6px;margin-bottom:10px}' +
      '.dset-gp-card{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);margin-bottom:8px}' +
      '.dset-gp-head{display:flex;align-items:center;gap:8px;min-width:0}' +
      '.dset-gp-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-gp-badge{flex:none;font-size:10px;padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}' +
      '.dset-gp-badge-on{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}' +
      '.dset-gp-badge-lock{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-gp-desc{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}' +
      '.dset-gp-summary{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word}' +
      '.dset-gp-levels{display:flex;flex-wrap:wrap;gap:6px}' +
      '.dset-gp-level{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-secondary)}' +
      '.dset-gp-level:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-gp-level-on{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-gp-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
      '.dset-gp-act{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:15px;line-height:1}' +
      '.dset-gp-act:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-gp-act:disabled{opacity:.45;cursor:default}' +
      '.dset-gp-act-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-gp-code{font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:11.5px;white-space:pre-wrap;word-break:break-word}' +
      '.dset-gp-collapse{cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;padding:6px 2px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-gp-collapse:hover{color:var(--dsw-alias-label-primary)}' +
      '.dset-gp-collapse-caret{flex:none;font-size:10px;color:var(--dsw-alias-label-caption)}' +
      '.dset-gp-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:4px 8px;font:inherit;font-size:11.5px;outline:none}' +
      '.dset-gp-input:focus{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-gp-row{display:flex;gap:8px;align-items:center;padding:5px 6px;border-radius:6px;font-size:12px}' +
      '.dset-gp-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-gp-row-main{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-gp-store{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);margin-bottom:8px}' +
      '.dset-gp-store-head{display:flex;gap:6px;align-items:center}' +
      '.dset-gp-store-name{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-gp-store-sub{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}' +
      '.dset-gp-note{color:var(--dsw-alias-state-error-primary);font-size:11.5px;line-height:1.5;padding:6px 8px;border:1px dashed var(--dsw-alias-state-error-primary);border-radius:8px;margin-bottom:8px}' +
      // 余额(右下角悬浮卡)+ 模型单价(模型选择旁边)
      '.dset-ds-bal{position:fixed;right:14px;bottom:14px;z-index:9993;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      '.dset-ds-bal-chip{display:inline-flex;align-items:center;gap:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:5px 12px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}' +
      '.dset-ds-bal-chip:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-ds-bal-chip-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dset-ds-bal-card{width:300px;max-width:86vw;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:8px}' +
      '.dset-ds-bal-head{display:flex;align-items:center;gap:8px}' +
      '.dset-ds-bal-title{font-size:12.5px;font-weight:600;flex:1}' +
      '.dset-ds-bal-total{font-size:14px;font-weight:600}' +
      '.dset-ds-bal-sub{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}' +
      '.dset-ds-bal-row{display:flex;gap:6px;font-size:11.5px;padding:2px 0;color:var(--dsw-alias-label-secondary)}' +
      '.dset-ds-bal-row b{color:var(--dsw-alias-label-primary);font-weight:600}' +
      '.dset-ds-price-tbl{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-ds-price-row{display:flex;gap:6px;align-items:center;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}' +
      '.dset-ds-price-name{flex:none;min-width:34px;color:var(--dsw-alias-label-primary);font-weight:600}' +
      '.dset-ds-price-cell{flex:none}' +
      '.dset-ds-price{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:20px;white-space:nowrap;padding:0 4px;cursor:default}' +
      '.dset-ds-price b{color:var(--dsw-alias-label-secondary);font-weight:500}' +
      '.dset-ds-price-peak{color:var(--dsw-alias-state-warn-label);font-size:9px;line-height:1}' +
      '.dset-ds-price:hover{color:var(--dsw-alias-label-primary)}';

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

    // ── 精细渲染:Markdown-lite + 内容块(文本/推理/工具调用/工具结果)──────
    function renderInline(text, keyPrefix) {
      var nodes = [];
      var re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
      var last = 0;
      var m;
      var idx = 0;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        var tok = m[0];
        if (tok.slice(0, 2) === "**") nodes.push(React.createElement("strong", { key: keyPrefix + "b" + (idx++) }, tok.slice(2, -2)));
        else if (tok.charAt(0) === "`") nodes.push(React.createElement("code", { key: keyPrefix + "c" + (idx++) }, tok.slice(1, -1)));
        else nodes.push(React.createElement("em", { key: keyPrefix + "i" + (idx++) }, tok.slice(1, -1)));
        last = m.index + tok.length;
      }
      if (last < text.length) nodes.push(text.slice(last));
      return nodes;
    }
    function renderTextBlock(text, key) {
      var trimmed = text.replace(/^\n+|\n+$/g, "");
      if (trimmed === "") return null;
      var fence = trimmed.match(/^```([\w+-]*)\n([\s\S]*?)```$/);
      if (fence) {
        return React.createElement("pre", { key: key, className: "dset-md-code" },
          React.createElement("code", null, fence[2].replace(/\n$/, ""))
        );
      }
      var lines = trimmed.split("\n");
      var out = [];
      var i = 0;
      var keyN = 0;
      while (i < lines.length) {
        var line = lines[i];
        var h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
          out.push(React.createElement("h" + h[1].length, { key: key + "h" + (keyN++) }, renderInline(h[2], key + "h" + keyN)));
          i++; continue;
        }
        var quote = line.match(/^>\s?(.*)$/);
        if (quote) {
          var qlines = [];
          while (i < lines.length && lines[i].match(/^>\s?/)) { qlines.push(lines[i].replace(/^>\s?/, "")); i++; }
          out.push(React.createElement("blockquote", { key: key + "q" + (keyN++) }, renderInline(qlines.join("\n"), key + "q" + keyN)));
          continue;
        }
        var ul = line.match(/^\s*[-*]\s+(.*)$/);
        if (ul) {
          var items = [];
          while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
          out.push(React.createElement("ul", { key: key + "u" + (keyN++) }, items.map(function (it, j) { return React.createElement("li", { key: j }, renderInline(it, key + "u" + keyN + "i" + j)); })));
          continue;
        }
        var ol = line.match(/^\s*\d+\.\s+(.*)$/);
        if (ol) {
          var oitems = [];
          while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) { oitems.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
          out.push(React.createElement("ol", { key: key + "o" + (keyN++) }, oitems.map(function (it, j) { return React.createElement("li", { key: j }, renderInline(it, key + "o" + keyN + "i" + j)); })));
          continue;
        }
        var p = [];
        var hc = /^(#{1,4})\s+/;
        while (i < lines.length && lines[i] !== "" && !hc.test(lines[i])) { p.push(lines[i]); i++; }
        out.push(React.createElement("p", { key: key + "p" + (keyN++) }, renderInline(p.join("\n"), key + "p" + keyN)));
        if (i < lines.length && lines[i] === "") i++;
      }
      return React.createElement(React.Fragment, null, out);
    }
    function RenderBlocks(props) {
      var blocks = props.blocks || [];
      var i = 0;
      var out = [];
      for (var k = 0; k < blocks.length; k++) {
        var b = blocks[k];
        var key = "bl" + (k);
        if (b.type === "text" && b.text) out.push(renderTextBlock(b.text, key));
        else if (b.type === "reasoning" && b.text) {
          out.push(React.createElement("details", { key: key, className: "dset-md-reason" },
            React.createElement("summary", null, "思考"),
            React.createElement("pre", { className: "dset-md-code" }, b.text.slice(0, 4000))
          ));
        } else if (b.type === "tool-call") {
          out.push(React.createElement("div", { key: key, className: "dset-md-tool" },
            React.createElement("div", { className: "dset-md-tool-head" },
              React.createElement("span", { className: "dset-md-tool-ico" }, "⚙"),
              React.createElement("span", { className: "dset-md-tool-name" }, b.name || "工具调用"),
              React.createElement("span", { className: "dset-md-tool-id" }, (b.id || "").slice(0, 14))
            ),
            React.createElement("pre", { className: "dset-md-args" }, b.arguments ? b.arguments.slice(0, 800) : "")
          ));
        } else if (b.type === "tool-result") {
          out.push(React.createElement("div", { key: key, className: "dset-md-tool dset-md-tool-result" + (b.error ? " dset-md-tool-err" : "") },
            React.createElement("div", { className: "dset-md-tool-head" },
              React.createElement("span", { className: "dset-md-tool-ico" }, b.error ? "✗" : "✓"),
              React.createElement("span", { className: "dset-md-tool-name" }, "工具结果"),
              React.createElement("span", { className: "dset-md-tool-id" }, "→ " + (b.toolCallId || "").slice(0, 14))
            ),
            React.createElement("pre", { className: "dset-md-args" }, b.text ? b.text.slice(0, 2000) : "")
          ));
        }
      }
      if (out.length === 0) out.push(React.createElement("p", { key: "empty" }, "（无内容）"));
      return React.createElement(React.Fragment, null, out);
    }

    // ── 图标(网上免费图标风格:inline SVG,无文字,悬停 title 显示描述)────
    var ICON_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
    var ICON_RETRY = 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 9.99h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';

    // ── 文件面板(工作区文件夹折叠树 + 弹窗预览/编辑)───────────────────────
    // 简易行级 LCS 差异(审批预览用;大文件回退为省略提示)。
    function diffLines(a, b) {
      var A = String(a || "").split("\n");
      var B = String(b || "").split("\n");
      var n = A.length, m = B.length;
      if (n * m > 250000) return [{ type: "same", text: "(大文件,已省略逐行差异)" }];
      var dp = [];
      for (var i = 0; i <= n; i++) { dp[i] = new Array(m + 1); for (var j = 0; j <= m; j++) dp[i][j] = 0; }
      for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) dp[i][j] = (A[i] === B[j]) ? (dp[i + 1][j + 1] + 1) : (dp[i + 1][j] > dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1]);
      var res = [];
      i = 0; j = 0;
      while (i < n && j < m) {
        if (A[i] === B[j]) { res.push({ type: "same", text: A[i] }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { res.push({ type: "del", text: A[i] }); i++; }
        else { res.push({ type: "add", text: B[j] }); j++; }
      }
      while (i < n) res.push({ type: "del", text: A[i++] });
      while (j < m) res.push({ type: "add", text: B[j++] });
      return res;
    }

    function FileModal(props) {
      var path = props.path;
      var content = props.content;
      var sessionId = props.sessionId;
      var call = props.call;
      var feats = useDetFeatures() || {};
      var needApprove = feats.approve === true;
      var editing = React.useState(false);
      var setEditing = editing[1];
      var draft = React.useState("");
      var setDraft = draft[1];
      var saving = React.useState(false);
      var setSaving = saving[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var approveOpen = React.useState(false);
      var setApproveOpen = approveOpen[1];
      var approveDiff = React.useState(null);
      var setApproveDiff = approveDiff[1];
      var doSave = function (text) {
        setSaving(true); setMsg(null);
        call("lvalWriteFile", { sessionId: sessionId, path: path, content: text }).then(function (r) {
          setSaving(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已保存" }); setEditing(false); setApproveOpen(false); setApproveDiff(null); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "保存失败") });
        }).catch(function (e) { setSaving(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var handleSave = function () {
        if (!needApprove) { doSave(draft[0]); return; }
        setApproveDiff(diffLines(content, draft[0]));
        setApproveOpen(true);
      };
      var loaded = content !== null;
      return ReactDOM.createPortal(React.createElement("div", { className: "dset-modal-mask", onClick: function () { if (!saving[0] && !approveOpen[0]) props.onClose(); } },
        React.createElement("div", { className: "dset-modal", onClick: function (e) { e.stopPropagation(); } },
          React.createElement("div", { className: "dset-head" },
            React.createElement("span", null, (approveOpen[0] ? "审批代码修改 · " : "预览 / 编辑 · ") + path.split("/").pop()),
            React.createElement("button", { className: "dset-x", onClick: props.onClose }, "×")
          ),
          msg[0] ? React.createElement("div", { className: "dset-modal-state", style: msg[0].ok ? { color: "var(--dsw-alias-state-success-primary)" } : { color: "var(--dsw-alias-state-error-primary)" } }, msg[0].text) : null,
          approveOpen[0]
            ? React.createElement("div", { className: "dset-diff" },
                (approveDiff[0] || []).map(function (dl, i) {
                  var cls = dl.type === "add" ? " dset-diff-add" : (dl.type === "del" ? " dset-diff-del" : "");
                  var sign = dl.type === "add" ? "+" : (dl.type === "del" ? "-" : "");
                  return React.createElement("div", { key: i, className: "dset-diff-row" + cls },
                    React.createElement("span", { className: "dset-diff-sign" }, sign),
                    React.createElement("span", null, dl.text)
                  );
                })
              )
            : (!loaded
                ? React.createElement("div", { className: "dset-modal-code" }, "加载中…")
                : (!editing[0]
                    ? React.createElement("pre", { className: "dset-modal-code" }, content)
                    : React.createElement("textarea", { className: "dset-modal-edit", value: draft[0], onChange: function (e) { setDraft(e.target.value); }, spellCheck: false })
                  )
              ),
          approveOpen[0] ? React.createElement("div", { className: "dset-approve-bar" }, "代码修改需审批: 同意后才会写入磁盘并继续。") : null,
          React.createElement("div", { className: "dset-modal-actions" },
            approveOpen[0]
              ? React.createElement("button", { className: "dset-btn-mini", onClick: function () { setApproveOpen(false); setApproveDiff(null); } }, "取消")
              : null,
            approveOpen[0]
              ? React.createElement("button", { className: "dset-btn-mini", disabled: saving[0], onClick: function () { doSave(draft[0]); } }, saving[0] ? "保存中…" : "批准并执行")
              : null,
            approveOpen[0] ? null
              : React.createElement("button", { className: "dset-btn-mini", onClick: function () { if (!editing[0]) { setDraft(content || ""); setEditing(true); } else setEditing(false); } }, editing[0] ? "返回预览" : "编辑"),
            approveOpen[0] ? null
              : (editing[0] ? React.createElement("button", { className: "dset-btn-mini", disabled: saving[0], onClick: handleSave }, saving[0] ? "保存中…" : "保存") : null),
            React.createElement("button", { className: "dset-btn-mini", onClick: props.onClose }, "关闭")
          )
        )
      ),
        document.body
      );
    }

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
        setFile(path); setContent(null); setError(null);
        call("lvalReadFile", { sessionId: sessionId, path: path }).then(function (r) {
          if (r && r.ok) setContent(r.content || "");
          else { setError((r && r.error) || "读取失败"); setFile(null); }
        }).catch(function (e) { setError(String(e && e.message ? e.message : e)); setFile(null); });
      };
      var renderNode = function (node, depth) {
        if (node.type === "dir") {
          var isOpen = expanded[0][node.path] === true;
          var count = node.children ? node.children.length : 0;
          return React.createElement("div", { key: "d" + node.path },
            React.createElement("div", { className: "dset-tree-row dset-tree-dir" + (isOpen ? " dset-tree-row-open" : ""), style: { paddingLeft: String(12 + depth * 14) + "px" }, title: (isOpen ? "点击折叠 · " : "点击展开 · ") + node.path },
              React.createElement("span", { className: "dset-tree-caret", onClick: function () { toggleDir(node.path); }, style: { visibility: count ? "visible" : "hidden" } }, isOpen ? "▾" : "▸"),
              React.createElement("span", { className: "dset-tree-ico" }, isOpen ? "📂" : "📁"),
              React.createElement("span", { className: "dset-tree-name", onClick: function () { toggleDir(node.path); } }, node.name),
              React.createElement("span", { className: "dset-tree-size" }, count ? String(count) : "")
            ),
            isOpen && node.children ? node.children.map(function (c) { return renderNode(c, depth + 1); }) : null
          );
        }
        return React.createElement("div", { key: "f" + node.path },
          React.createElement("div", { className: "dset-tree-row dset-tree-row-file", onClick: function () { openFile(node.path); }, style: { paddingLeft: String(16 + depth * 14) + "px" }, title: "点击预览/编辑 · " + node.path },
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
          React.createElement("div", { className: "dset-tree" },
            tree[0].length === 0 && !loading[0]
              ? React.createElement("div", { className: "dset-empty" }, "工作区无源码文件")
              : tree[0].map(function (n) { return renderNode(n, 0); })
          )
        ),
        React.createElement("div", { className: "dset-foot" }, "点击文件夹展开/折叠 · 点击文件预览/编辑"),
        file[0] ? React.createElement(FileModal, { key: file[0], call: call, sessionId: sessionId, path: file[0], content: content[0], onClose: function () { setFile(null); setContent(null); } }) : null
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
      var restore = function (id, label, fileCount) {
        if (!sessionId || busy[0]) return;
        var mustApprove = ((useDetFeatures() || {}).approve === true);
        var base = "回退到版本 " + (label || id) + (fileCount ? "(" + fileCount + " 个文件)" : "") + "?\n(回退前会自动备份当前代码)";
        if (!mustApprove) { if (!window.confirm(base)) return; }
        else { if (!window.confirm("代码修改需审批:\n确认回退到版本 " + (label || id) + "?\n将覆盖 " + (fileCount || "?") + " 个代码文件(回退前自动备份)。\n同意后才执行。")) return; }
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
                  React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { restore(v.id, v.label, v.fileCount); } }, "回退"),
                  React.createElement("button", { className: "dset-btn-mini dset-btn-danger", disabled: busy[0], onClick: function () { remove(v.id, v.label); } }, "删除")
                );
              })
        ),
        React.createElement("div", { className: "dset-foot" }, "代码快照 · 回退前自动备份")
      );
    }

    // ── 产品聊天视图内的用户消息操作(conversation.chat.user-actions)─────
    // 渲染在用户气泡"复制"旁:编辑/重试图标(悬停显示)+ < N > 分叉选择器。
    var bvCache = { sessionId: null, data: null, at: 0 };
    function fetchTreeCached(call, sessionId) {
      var now = Date.now();
      if (bvCache.sessionId === sessionId && bvCache.data !== null && now - bvCache.at < 4000) return Promise.resolve(bvCache.data);
      return call("treeView", { sessionId: sessionId }).then(function (r) {
        if (r && r.ok) { bvCache.sessionId = sessionId; bvCache.data = r; bvCache.at = Date.now(); }
        return r;
      });
    }
    function UserActions(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var messageId = props.messageId;
      var seq = props.seq;
      var feat = useDetFeatures();
      var nav = React.useState(null);
      var setNav = nav[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var editMode = React.useState(false);
      var setEditMode = editMode[1];
      var editText = React.useState("");
      var setEditText = editText[1];
      var msg = React.useState(null);
      var setMsg = msg[1];

      var refreshNav = function () {
        if (!sessionId || seq === undefined) return;
        fetchTreeCached(call, sessionId).then(function (r) {
          if (!r || !r.ok) return;
          var row = (r.messages || []).find(function (m) { return m.seq === seq || m.messageId === messageId; });
          if (row) setNav({ childBranches: row.childBranches || [], index: row.branchIndex || 1, selector: row.selector === true });
        }).catch(function () {});
      };
      React.useEffect(function () { refreshNav(); }, [sessionId, seq, messageId]);

      var doEdit = function () {
        if (busy[0]) return;
        var text = editText[0].trim();
        if (text === "") { setMsg({ ok: false, text: "内容不能为空" }); return; }
        setBusy(true); setMsg(null);
        call("editMessage", { sessionId: sessionId, messageId: messageId, newText: text }).then(function (r) {
          setBusy(false); setEditMode(false); bvCache.data = null;
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已编辑并创建新叉(新回答生成中…)" : "✗ " + ((r && r.error) || "编辑失败") });
          refreshNav();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var doRetry = function () {
        if (busy[0]) return;
        if (!window.confirm("重试这条消息?(将创建新叉,原对话保留)")) return;
        setBusy(true); setMsg(null);
        call("retryMessage", { sessionId: sessionId, messageId: messageId }).then(function (r) {
          setBusy(false); bvCache.data = null;
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已重试并创建新叉(新回答生成中…)" : "✗ " + ((r && r.error) || "重试失败") });
          refreshNav();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var cycleFork = function (dir) {
        var n = nav[0];
        if (busy[0] || !n || !n.selector || !n.childBranches || n.childBranches.length < 2) return;
        var next = (n.index - 1 + dir + n.childBranches.length) % n.childBranches.length;
        var target = n.childBranches[next];
        if (!target) return;
        setBusy(true);
        call("switchFork", { sessionId: sessionId, branchId: target.branchId }).then(function (r) {
          setBusy(false); bvCache.data = null;
          setMsg({ ok: !!(r && r.ok), text: (r && r.ok) ? "✓ 已切换分叉(查看内容请切到 VTD 对话标签)" : "✗ " + ((r && r.error) || "切换失败") });
          refreshNav();
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      if (!messageId || !sessionId) return null;
      if (feat !== null && feat.vtd === false) return null;
      return React.createElement("span", { className: "dset-vtd-bar", style: { display: "inline-flex", alignItems: "center", gap: "3px" } },
        nav[0] && nav[0].selector
          ? React.createElement("span", { className: "dset-vtd-nav" },
              React.createElement("button", { className: "dset-vtd-nav-btn", disabled: busy[0], title: "上一个分叉", onClick: function () { cycleFork(-1); } }, "<"),
              React.createElement("span", { className: "dset-vtd-nav-num" }, String(nav[0].index || 1)),
              React.createElement("button", { className: "dset-vtd-nav-btn", disabled: busy[0], title: "下一个分叉", onClick: function () { cycleFork(1); } }, ">")
            )
          : null,
        React.createElement("button", { className: "dset-vtd-ico", title: "编辑", disabled: busy[0], onClick: function () { setEditMode(!editMode[0]); if (!editMode[0]) setEditText(""); } },
          React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_EDIT }))
        ),
        React.createElement("button", { className: "dset-vtd-ico", title: "重试", disabled: busy[0], onClick: doRetry },
          React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_RETRY }))
        ),
        editMode[0]
          ? React.createElement("span", { className: "dset-vtd-editbox", style: { position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 9996 } },
              React.createElement("textarea", {
                className: "dset-vtd-editarea",
                value: editText[0],
                placeholder: "新内容…",
                rows: 2,
                autoFocus: true,
                ref: function (el) { if (el) { el.style.height = "auto"; el.style.height = (el.scrollHeight + 2) + "px"; } },
                onChange: function (e) { setEditText(e.target.value); var el = e.target; el.style.height = "auto"; el.style.height = (el.scrollHeight + 2) + "px"; },
                onKeyDown: function (e) {
                  if (e.key === "Escape") { setEditMode(false); return; }
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doEdit(); }
                },
              }),
              React.createElement("div", { className: "dset-toolbar-row", style: { border: "none", margin: 0, justifyContent: "flex-end" } },
                React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: doEdit }, busy[0] ? "处理中…" : "保存并重发"),
                React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { setEditMode(false); } }, "取消")
              )
            )
          : null,
        msg[0]
          ? React.createElement("span", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err"), style: { position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 9996, width: 280, background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: 8, padding: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, msg[0].text)
          : null
      );
    }

    // ── VTD 对话视图(虚拟对话树 = 独立标签,精细渲染)───────────────────────
    function VtdView(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var feat = useDetFeatures();
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
      if (feat !== null && feat.vtd === false) return null;
      var autoGrow = function (el) {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = (el.scrollHeight + 2) + "px";
      };
      var renderMsg = function (m) {
        var isUser = m.role === "user";
        var isContext = m.role === "context";
        var isTool = m.role === "tool";
        // 系统代提(上下文注入/审批提示/目标注入/空消息等):披露行,不算用户消息
        if (isContext) {
          return React.createElement("div", { key: String(m.seq) + "-" + (m.messageId || ""), className: "dset-vtd-row dset-vtd-row-context" },
            React.createElement("details", { className: "dset-vtd-context" },
              React.createElement("summary", null,
                React.createElement("span", { className: "dset-vtd-context-caret" }, "▸"),
                React.createElement("span", { className: "dset-vtd-context-title" }, "上下文注入"),
                m.srcLabel
                  ? React.createElement("span", { className: "dset-vtd-context-src" }, "· " + m.srcLabel)
                  : null
              ),
              React.createElement("div", { className: "dset-vtd-context-body" },
                React.createElement(RenderBlocks, { blocks: (m.blocks && m.blocks.length > 0) ? m.blocks : [{ type: "text", text: m.text || "（无内容）" }] })
              )
            ),
            React.createElement("div", { className: "dset-vtd-meta" }, "系统 #" + m.seq)
          );
        }
        // 工具结果:助手侧卡片,非用户气泡
        if (isTool) {
          return React.createElement("div", { key: String(m.seq) + "-" + (m.messageId || ""), className: "dset-vtd-row dset-vtd-row-assistant" },
            React.createElement("div", { className: "dset-vtd-bubble dset-vtd-bubble-assistant" },
              React.createElement(RenderBlocks, { blocks: (m.blocks && m.blocks.length > 0) ? m.blocks : [{ type: "text", text: m.text || "" }] })
            ),
            React.createElement("div", { className: "dset-vtd-meta" }, "工具结果 #" + m.seq)
          );
        }
        var editing = editFor[0] && editFor[0].messageId === m.messageId;
        return React.createElement("div", { key: String(m.seq) + "-" + (m.messageId || ""), className: "dset-vtd-row " + (isUser ? "dset-vtd-row-user" : "dset-vtd-row-assistant") },
          React.createElement("div", { className: "dset-vtd-bubble " + (isUser ? "dset-vtd-bubble-user" : "dset-vtd-bubble-assistant") },
            editing
              ? React.createElement("div", { className: "dset-vtd-edit-inplace" },
                  React.createElement("textarea", {
                    className: "dset-vtd-editarea",
                    value: editFor[0].text,
                    rows: 2,
                    autoFocus: true,
                    ref: function (el) { if (el) autoGrow(el); },
                    onChange: function (e) { setEditFor({ messageId: m.messageId, text: e.target.value }); autoGrow(e.target); },
                    onKeyDown: function (e) {
                      if (e.key === "Escape") { setEditFor(null); return; }
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doEdit(m); }
                    },
                  }),
                  React.createElement("div", { className: "dset-vtd-edit-actions" },
                    React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { setEditFor(null); } }, "取消"),
                    React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { doEdit(m); } }, busy[0] ? "处理中…" : "保存并重发")
                  )
                )
              : React.createElement(RenderBlocks, { blocks: (m.blocks && m.blocks.length > 0) ? m.blocks : [{ type: "text", text: m.text || "" }] }),
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
              ? React.createElement("button", { className: "dset-vtd-ico", title: "编辑", disabled: busy[0], onClick: function () { setEditFor(editing ? null : { messageId: m.messageId, text: (m.text || "").slice(0, 2000) }); } },
                  React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_EDIT }))
                )
              : null,
            isUser
              ? React.createElement("button", { className: "dset-vtd-ico", title: "重试", disabled: busy[0], onClick: function () { doRetry(m); } },
                  React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_RETRY }))
                )
              : null
          )
        );
      };

      return React.createElement("div", { className: "dset-vtd" },
        React.createElement("div", { className: "dset-toolbar-row", style: { padding: "10px 16px 6px", border: "none", margin: 0 } },
          React.createElement("button", { className: "dset-btn-mini", disabled: loading[0], onClick: refresh }, loading[0] ? "加载中…" : "刷新"),
          React.createElement("span", { className: "dset-vtd-branch" },
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
          React.createElement("button", { className: "dset-vtd-send", disabled: busy[0], onClick: sendMsg }, busy[0] ? "处理中…" : "发送")
        )
      );
    }

    // ── 工具栏(运行/文件/版本;按 DET 开关装载/卸载)────────────────────
    // 会话分组视图(MDA):按 工作区→分支模型区域→会话 分组(工作区组/模型组)或扁平(原生组)
    // 当前对话插件控制(模仿 cordis 控制):本对话的动态 Cordis 插件 + 全局插件(本对话内生效)
    // 主视图左侧栏:MDA 分组(工作区→分支模型区域→会话) + 「+」建分组/新对话
    function MdaSidebar(props) {
      var call = props.call;
      var st = React.useState({ loading: true, mode: "native", areas: [], sessions: [], error: "" });
      var collapsed = React.useState({});
      var setCollapsed = collapsed[1];
      var load = function () {
        st[1]({ loading: true });
        Promise.all([call("mdaGet", {}), call("cdmList", {})]).then(function (rs) {
          var m = rs[0], c = rs[1];
          if (m && m.ok) st[1]({ loading: false, mode: m.mode || "native", areas: m.areas || [], sessions: c && c.ok ? (c.sessions || []) : [], error: "" });
          else st[1]({ loading: false, mode: "native", areas: [], sessions: [], error: ((m && m.error) || (c && c.error) || "") });
        }).catch(function (e) { st[1]({ loading: false, mode: "native", areas: [], sessions: [], error: String(e && e.message ? e.message : e) }); });
      };
      React.useEffect(function () { load(); }, []);
      var newArea = function (workspace) {
        setDisabled(true);
        call("mdaAreaCreate", { name: "区域 " + (st[0].areas.length + 1), workspace: workspace }).then(function (r) {
          if (r && r.ok && r.area) { call("mdaNewConversation", { areaId: r.area.id, workspace: workspace }).then(load, load); }
          else { setDisabled(false); load(); }
        }, function () { setDisabled(false); load(); });
      };
      var newConv = function (areaId, workspace) {
        setDisabled(true);
        call("mdaNewConversation", { areaId: areaId, workspace: workspace }).then(function () { setDisabled(false); load(); }, function () { setDisabled(false); load(); });
      };
      var disabled = React.useState(false);
      var setDisabled = disabled[1];
      var toggle = function (key, e) { if (e && e.stopPropagation) e.stopPropagation(); setCollapsed(Object.assign({}, collapsed[0], { [key]: !collapsed[0][key] })); };
      var wsMap = {};
      st[0].sessions.forEach(function (s) { var w = s.cwd || "(无工作区)"; (wsMap[w] = wsMap[w] || []).push(s.id); });
      var workspaces = Object.keys(wsMap).sort();
      var sessionTitle = function (id) { var s = st[0].sessions.find(function (x) { return x.id === id; }); return s ? (s.title || id.slice(-8)) : id.slice(-8); };
      return React.createElement("div", { style: { padding: "4px 2px" } },
        st[0].loading ? React.createElement("div", { className: "dset-empty" }, "加载中…") : null,
        st[0].error ? React.createElement("div", { className: "dset-empty", style: { fontSize: 11 } }, "✗ " + st[0].error) : null,
        st[0].mode === "native"
          ? workspaces.map(function (w) { return React.createElement("div", { key: w, className: "dset-dbg-row" }, React.createElement("span", { className: "dset-dbg-id" }, "🗂 " + w + " (" + wsMap[w].length + ")")); })
          : workspaces.map(function (w) {
              var areas = st[0].areas.filter(function (a) { return a.workspace === w; });
              var wsOpen = !collapsed[0]["ws:" + w];
              return React.createElement("div", { key: w },
                React.createElement("div", { className: "dset-dbg-row" },
                  React.createElement("button", { className: "dset-vtd-ico", title: "折叠/展开", onClick: function (e) { toggle("ws:" + w, e); } }, wsOpen ? "▾" : "▸"),
                  React.createElement("span", { className: "dset-dbg-id" }, "🗂 " + w + " (" + wsMap[w].length + ")"),
                  React.createElement("button", { className: "dset-btn-mini", title: "建分组+新对话", disabled: disabled[0], onClick: function () { newArea(w); } }, "➕")
                ),
                wsOpen ? areas.map(function (a) {
                  var aOpen = !collapsed[0]["area:" + a.id];
                  var members = (a.memberSessions || []);
                  return React.createElement("div", { key: a.id, style: { paddingLeft: 12 } },
                    React.createElement("div", { className: "dset-dbg-row" },
                      React.createElement("button", { className: "dset-vtd-ico", title: "折叠/展开", onClick: function (e) { toggle("area:" + a.id, e); } }, aOpen ? "▾" : "▸"),
                      React.createElement("span", { className: "dset-dbg-id" }, a.name + " (" + members.length + ")"),
                      React.createElement("button", { className: "dset-btn-mini", title: "组内新对话", disabled: disabled[0], onClick: function () { newConv(a.id, w); } }, "➕")
                    ),
                    aOpen ? members.map(function (sid) {
                      return React.createElement("div", { key: sid, className: "dset-dbg-row", style: { paddingLeft: 22 } },
                        React.createElement("span", { className: "dset-dbg-id" }, "💬 " + sessionTitle(sid))
                      );
                    }) : null
                  );
                }) : null
              );
            })
      );
    }

    // 左侧栏底部加入口:打开 MDA 分组面板(加法,不顶掉原生会话列表)
    function MdaSidebarEntry(props) {
      var call = props.call;
      var feat = useDetFeatures();
      var open = React.useState(false);
      var setOpen = open[1];
      if (feat && feat.mda === false) return null;
      return React.createElement(React.Fragment, null,
        React.createElement("button", { className: "dset-sidebar-btn", title: "MDA 分组", style: { width: "100%", textAlign: "left", font: "inherit", fontSize: 12, color: "var(--dsw-alias-label-secondary)", background: "none", border: "none", padding: "4px 6px", cursor: "pointer" }, onClick: function () { setOpen(!open[0]); } }, "🔀 MDA 分组"),
        open[0] ? React.createElement("div", { className: "dset-panel", style: { width: 380, maxWidth: "70vw", left: 320, right: "auto" } },
          React.createElement("div", { className: "dset-head" },
            React.createElement("span", null, "MDA 分组"),
            React.createElement("button", { className: "dset-x", onClick: function () { setOpen(false); } }, "×")
          ),
          React.createElement("div", { className: "dset-body" },
            React.createElement(MdaSidebar, { call: call })
          )
        ) : null
      );
    }

    function SessionPluginsPanel(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var siden = typeof sessionId === "string" ? sessionId : "";
      var st = React.useState({ loading: true, dyn: [], global: [], error: "" });
      React.useEffect(function () {
        st[1]({ loading: true });
        Promise.all([call("gpCordisInventory", {}), call("gpList", {})]).then(function (rs) {
          var inv = rs[0], gl = rs[1];
          var dyn = [];
          var sess = inv && inv.ok ? (inv.sessions || []).find(function (s) { return s.id === siden; }) : null;
          dyn = sess ? (sess.plugins || []) : [];
          var global = gl && gl.ok ? (gl.plugins || []) : [];
          st[1]({ loading: false, dyn: dyn, global: global, error: "" });
        }).catch(function (e) { st[1]({ loading: false, dyn: [], global: [], error: String(e && e.message ? e.message : e) }); });
      }, []);
      var toggleGlobal = function (p) {
        var m = p.sessions && p.sessions[siden];
        var on = !!(m && m.state === "enabled" && p.level !== "disabled");
        if (on && !window.confirm("停用「" + p.name + "」在本对话的生效?")) return;
        var fn = on ? "gpSessionDisable" : "gpSessionEnable";
        call(fn, { sessionId: siden, id: p.id, by: "user" }).then(function () {
          call("gpList", {}).then(function (r) { if (r && r.ok) { st[1]({ loading: false, dyn: st[0].dyn, global: r.plugins || [], error: "" }); } });
        }).catch(function (e) { st[1]({ loading: false, dyn: st[0].dyn, global: st[0].global, error: String(e && e.message ? e.message : e) }); });
      };
      var globalLine = function (p) {
        var m = p.sessions && p.sessions[siden];
        var on = !!(m && m.state === "enabled" && p.level !== "disabled");
        return React.createElement("div", { key: p.id, className: "dset-gp-row" },
          React.createElement("div", { className: "dset-gp-row-main" }, p.name + " (" + p.id + ")" + (p.permanent ? " · 常驻" : "") + " · 档位 " + p.level),
          React.createElement("span", { className: "dset-gp-badge " + (on ? "dset-gp-badge-on" : "") }, on ? "本对话已启用" : "本对话未启用"),
          React.createElement("button", { className: "dset-btn-mini", onClick: function () { toggleGlobal(p); } }, on ? "停用" : "启用")
        );
      };
      return React.createElement("div", { className: "dset-panel", style: { width: 400, maxWidth: "70vw" } },
        React.createElement("div", { className: "dset-head" },
          React.createElement("span", null, "当前对话插件控制"),
          React.createElement("button", { className: "dset-x", onClick: props.onClose }, "×")
        ),
        React.createElement("div", { className: "dset-body" },
          st[0].loading ? React.createElement("div", { className: "dset-empty" }, "读取中…") : null,
          st[0].error ? React.createElement("div", { className: "dset-empty" }, "✗ " + st[0].error) : null,
          React.createElement("div", { className: "dset-sec-title" }, "动态 Cordis 插件(本对话)"),
          React.createElement("p", { className: "dset-sec-desc" }, "当前对话里已装载的动态 Cordis 插件(运行状态;完整管理在 设置→全局插件管理)。"),
          (st[0].dyn || []).length === 0 ? React.createElement("div", { className: "dset-empty" }, "本对话暂无动态 Cordis 插件") : null,
          (st[0].dyn || []).map(function (p) {
            return React.createElement("div", { key: p.pluginId, className: "dset-gp-row" },
              React.createElement("div", { className: "dset-gp-row-main" }, (p.name || p.pluginId) + " · " + p.pluginId + (p.running ? " · 运行中" : "")),
              React.createElement("span", { className: "dset-gp-badge" }, p.hasHostHalf && p.hasClientHalf ? "host+client" : p.hasHostHalf ? "host" : "client")
            );
          }),
          React.createElement("div", { className: "dset-sec-title" }, "全局插件(本对话内生效)"),
          React.createElement("p", { className: "dset-sec-desc" }, "DET 全局插件库:非跨对话插件可在本对话启用/停用;常驻(跨会话)插件用设置里的「启用/禁用」开关。"),
          (st[0].global || []).length === 0 ? React.createElement("div", { className: "dset-empty" }, "暂无全局插件") : null,
          (st[0].global || []).map(globalLine)
        )
      );
    }

    function Toolbar(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var panel = React.useState(null);
      var setPanel = panel[1];
      var pluginPanel = React.useState(false);
      var setPluginPanel = pluginPanel[1];
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
      var feat = useDetFeatures();
      var feats = feat === null ? { file: true, run: true, ver: true, vtd: true, mda: true, plugins: true } : { file: feat.file === true, run: feat.run === true, ver: feat.ver === true, mda: feat.mda !== false, plugins: feat.plugins !== false };

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

      return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "dset-toolbar" },
          feats.plugins ? React.createElement("button", { className: "dset-tb-btn" + (pluginPanel[0] ? " dset-tb-on" : ""), title: "当前对话插件控制", onClick: function () { setPluginPanel(!pluginPanel[0]); } },
            React.createElement("span", { className: "dset-tb-ico" }, "🧩"),
            React.createElement("span", { className: "dset-tb-lbl" }, "插件")
          ) : null,
          feats.run && runable[0] ? React.createElement("button", { className: "dset-tb-btn", title: "运行入口: " + (runEntry[0] || runKind[0] || "") + "（工作区检测）", onClick: doRun },
            React.createElement("span", { className: "dset-tb-ico" }, "▶"),
            React.createElement("span", { className: "dset-tb-lbl" }, running[0] ? "…" : "运行")
          ) : null,
          feats.file ? React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "file" ? " dset-tb-on" : ""), title: "浏览工作区文件", onClick: function () { setPanel(panel[0] === "file" ? null : "file"); } },
            React.createElement("span", { className: "dset-tb-ico" }, "🗎"),
            React.createElement("span", { className: "dset-tb-lbl" }, "文件")
          ) : null,
          feats.ver ? React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "ver" ? " dset-tb-on" : ""), title: "大版本:快照/回退", onClick: function () { setPanel(panel[0] === "ver" ? null : "ver"); } },
            React.createElement("span", { className: "dset-tb-ico" }, "🕘"),
            React.createElement("span", { className: "dset-tb-lbl" }, "版本")
          ) : null
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
        feats.file && panel[0] === "file" ? React.createElement(FilePanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null,
        feats.ver && panel[0] === "ver" ? React.createElement(VerPanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null,
        pluginPanel[0] ? React.createElement(SessionPluginsPanel, { call: call, sessionId: sessionId, onClose: function () { setPluginPanel(false); } }) : null
      );
    }

    // ── 设置页:DET 管理器(功能开关 + 侧边栏数据自检 + VTD 调试)─────────────
    // 可折叠 DET 区块(手风琴)
    function CollapseBlock(props) {
      var open = React.useState(props.defaultOpen !== false);
      var setOpen = open[1];
      return React.createElement("div", null,
        React.createElement("div", { className: "dset-gp-collapse", onClick: function () { setOpen(!open[0]); } },
          React.createElement("span", { className: "dset-gp-collapse-caret" }, open[0] ? "▾" : "▸"),
          React.createElement("span", { style: { fontWeight: 600 } }, props.title)
        ),
        open[0] ? props.children : null
      );
    }

    function DetManagerSection(props) {
      var call = props.call;
      var feat = useDetFeatures();
      var feats = feat === null ? { file: true, run: true, ver: true, vtd: true, mda: true, plugins: true } : feat;
      var busy = React.useState(false);
      var setBusy = busy[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      // 侧边栏登记簿
      var regRows = React.useState([]);
      var setRegRows = regRows[1];
      var regLoading = React.useState(false);
      var setRegLoading = regLoading[1];
      var lastCheck = React.useState(null);
      var setLastCheck = lastCheck[1];
      // VTD 调试
      var showSessions = React.useState(false);
      var setShowSessions = showSessions[1];
      var showMinor = React.useState(false);
      var setShowMinor = showMinor[1];
      var sessionsData = React.useState([]);
      var setSessionsData = sessionsData[1];
      var minorData = React.useState([]);
      var setMinorData = minorData[1];
      // TCT
      var tctModels = React.useState([]);
      var setTctModels = tctModels[1];
      var tctCurrent = React.useState("");
      var setTctCurrent = tctCurrent[1];
      var tctBusy = React.useState(false);
      var setTctBusy = tctBusy[1];
      var tctPrompt = React.useState("");
      var setTctPrompt = tctPrompt[1];
      var tctFeedback = React.useState("");
      var setTctFeedback = tctFeedback[1];

      var loadTctModels = function () {
        setTctBusy(true); setMsg(null);
        call("tctModels", {}).then(function (r) {
          setTctBusy(false);
          if (r && r.ok) { setTctModels(r.models || []); setTctCurrent(r.current || ""); }
          else if (r && r.llmAvailable === false) setMsg({ ok: false, text: "✗ " + (r.error || "未配置 LLM") });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取模型失败") });
        }).catch(function (e) { setTctBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var tctPickModel = function (val) {
        setTctBusy(true); setMsg(null);
        call("tctSetModel", { model: val }).then(function (r) {
          setTctBusy(false);
          if (r && r.ok) { setTctCurrent(val); setMsg({ ok: true, text: "✓ TCT 模型已设为: " + (val || "宿主默认") }); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") });
        }).catch(function (e) { setTctBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var tctTry = function () {
        if (tctPrompt[0].trim() === "") { setMsg({ ok: false, text: "请输入测试提示词" }); return; }
        setTctBusy(true); setMsg(null);
        call("tctRun", { prompt: tctPrompt[0] }).then(function (r) {
          setTctBusy(false);
          if (r && r.ok) setTctFeedback(r.feedback);
          else if (r && r.llmAvailable === false) setMsg({ ok: false, text: "✗ " + (r.error || "未配置 LLM") });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "TCT 调用失败") });
        }).catch(function (e) { setTctBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      // MDA 分层
      var mdaMode = React.useState("native");
      var setMdaMode = mdaMode[1];
      var mdaAreas = React.useState([]);
      var setMdaAreas = mdaAreas[1];
      var mdaBusy = React.useState(false);
      var setMdaBusy = mdaBusy[1];
      var areaName = React.useState("");
      var setAreaName = areaName[1];
      var areaWorkspace = React.useState("");
      var setAreaWorkspace = areaWorkspace[1];
      var loadMda = function () {
        setMdaBusy(true); setMsg(null);
        call("mdaGet", {}).then(function (r) {
          setMdaBusy(false);
          if (r && r.ok) { setMdaMode(r.mode || "native"); setMdaAreas(r.areas || []); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取 MDA 失败") });
        }).catch(function (e) { setMdaBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var mdaChangeMode = function (val) {
        setMdaBusy(true); setMsg(null);
        call("mdaSetMode", { mode: val }).then(function (r) {
          setMdaBusy(false);
          if (r && r.ok) { setMdaMode(r.mode || val); setMsg({ ok: true, text: "✓ MDA 分组已设为: " + val }); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") });
        }).catch(function (e) { setMdaBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var mdaNewArea = function () {
        if (areaName[0].trim() === "") { setMsg({ ok: false, text: "请输入区域名称" }); return; }
        setMdaBusy(true); setMsg(null);
        call("mdaAreaCreate", { name: areaName[0], workspace: areaWorkspace[0] }).then(function (r) {
          setMdaBusy(false);
          if (r && r.ok) { setAreaName(""); setMsg({ ok: true, text: "✓ 已创建区域「" + r.area.name + "」" }); loadMda(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
        }).catch(function (e) { setMdaBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var mdaDelArea = function (id) {
        if (!window.confirm("删除分支模型区域?")) return;
        setMdaBusy(true); setMsg(null);
        call("mdaAreaRemove", { id: id }).then(function (r) {
          setMdaBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已删除区域" }); loadMda(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "删除失败") });
        }).catch(function (e) { setMdaBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var loadRegistry = function (forceCheck, silent) {
        if (!silent) { setRegLoading(true); setMsg(null); }
        var method = forceCheck ? "registrySelfCheck" : "registryList";
        call(method, {}).then(function (r) {
          setRegLoading(false);
          if (!r || !r.ok) {
            setLastCheck(null);
            setMsg({ ok: false, text: "✗ " + ((r && r.error) || "失败(主机端点可能未就绪,请重启 DSH)") });
            return;
          }
          if (r.lastCheck) setLastCheck(r.lastCheck);
          if (r.sessions) setRegRows(r.sessions);
          if (forceCheck) {
            setMsg({ ok: true, text: "✓ 自检完成: 登记 " + r.stored + " / 实际 " + r.real + " · 新增 " + (r.added ? r.added.length : 0) + " · 修正 " + (r.updated ? r.updated.length : 0) + " · 清理 " + (r.removed ? r.removed.length : 0) });
            setLastCheck(r);
          }
        }).catch(function (e) {
          setRegLoading(false);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      React.useEffect(function () { loadRegistry(false, true); }, []);

      var toggle = function (key) {
        if (busy[0]) return;
        var cur = feat === null ? detFeatures : feat;
        var next = {};
        for (var k in cur) next[k] = cur[k];
        next[key] = !(cur[key] === true);
        setBusy(true); setMsg(null);
        setDet(next); // 乐观更新,立即装载/卸载
        var patch = {}; patch[key] = next[key];
        call("detFeatureSet", { patch: patch }).then(function (r) {
          setBusy(false);
          if (r && r.ok && r.features) setDet(r.features);
          else { setDet(cur); setMsg({ ok: false, text: "✗ " + ((r && r.error) || "开关保存失败") }); }
        }).catch(function (e) {
          setBusy(false);
          setDet(cur);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };

      var toggleRow = function (key, name, sub) {
        var on = feats[key] === true;
        return React.createElement("div", { key: key, className: "dset-switch-row", onClick: function () { toggle(key); } },
          React.createElement("div", { className: "dset-switch-main" },
            React.createElement("div", { className: "dset-switch-name" }, name),
            React.createElement("div", { className: "dset-switch-sub" }, sub + (on ? " · 已装载" : " · 已卸载"))
          ),
          React.createElement("span", { className: "dset-switch" + (on ? " dset-switch-on" : "") }, "")
        );
      };

      var loadSessions = function () {
        setShowSessions(!showSessions[0]); setMsg(null);
        if (showSessions[0]) return;
        call("debugSessions", {}).then(function (r) {
          if (r && r.ok) setSessionsData(r.sessions || []);
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "加载失败") });
        }).catch(function (e) { setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var loadMinor = function () {
        setShowMinor(!showMinor[0]); setMsg(null);
        if (showMinor[0]) return;
        call("debugMinor", {}).then(function (r) {
          if (r && r.ok) setMinorData(r.versions || []);
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "加载失败") });
        }).catch(function (e) { setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var fmt = function (t) { return t ? new Date(t).toLocaleString() : "—"; };
      return React.createElement("div", null,
        React.createElement("h3", null, "DET 管理器 · 功能装载/卸载"),
        React.createElement("p", null, "开关即时生效并持久化(宿主 ~/.dsh/storages)。卸载后对应 UI 不再渲染(工具栏按钮 / VTD 对话标签 / 消息操作);端点保持可用,可随时重新装载。"),
        React.createElement("div", { className: "dset-dbg-btns", style: { flexDirection: "column", alignItems: "stretch" } },
          toggleRow("file", "文件视图", "工具栏 🗎 工作区文件树/预览"),
          toggleRow("run", "运行按钮", "工具栏 ▶ 运行入口(工作区检测)"),
          toggleRow("ver", "版本控制", "工具栏 🕘 代码快照/回退/删除"),
          toggleRow("vtd", "VTD", "VTD 对话标签 + 编辑/重试/<N> 消息操作"),
          toggleRow("plugins", "插件管理", "工具栏「插件」按钮/当前对话插件控制 + 全局插件管理"),
          toggleRow("mda", "MDA 分组", "左侧栏 MDA 分组入口 + 分组树/模型合作"),
          toggleRow("approve", "代码修改审批", "需先预览差异并批准,代码修改(文件保存/快照回退)才生效并继续")
        ),
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        React.createElement(CollapseBlock, { title: "会话侧边栏数据(登记簿)", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "只存“存在的对话”元数据(id/标题/工作区/血缘/时间/激活分支),不存对话本体——消息永远留在 DSH 会话日志。自动维护:会话创建即时登记;列表/树访问节流自检(60 秒);自检发现缺失/失联自动增删改。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: regLoading[0], onClick: function () { loadRegistry(true); } }, regLoading[0] ? "自检中…" : "自检并修复"),
            React.createElement("button", { className: "dset-btn-mini", disabled: regLoading[0], onClick: function () { loadRegistry(false); } }, "刷新列表")
          ),
          lastCheck[0]
            ? React.createElement("div", { className: "dset-chk-summary" },
                "最近自检: " + fmt(lastCheck[0].checkedAt) + " · 登记 " + lastCheck[0].stored + " / 实际 " + lastCheck[0].real +
                " · 新增 " + (lastCheck[0].added ? lastCheck[0].added.length : 0) +
                " · 修正 " + (lastCheck[0].updated ? lastCheck[0].updated.length : 0) +
                " · 清理 " + (lastCheck[0].removed ? lastCheck[0].removed.length : 0)
              )
            : null,
          React.createElement("div", { className: "dset-dbg-panel" },
            regRows[0].length === 0 && !regLoading[0]
              ? React.createElement("div", { className: "dset-empty" }, "暂无登记 · 首次自检后出现")
              : regRows[0].slice(0, 60).map(function (s) {
                  return React.createElement("div", { key: s.id, className: "dset-dbg-row" },
                    React.createElement("span", { className: "dset-dbg-id" },
                      (s.title ? s.title + " · " : "") + s.id + (s.parentSession ? " · fork 自 " + s.parentSession.slice(-8) : "")),
                    React.createElement("span", { className: "dset-dbg-tag " + (s.hidden ? "dset-dbg-tag-hid" : "") }, s.hidden ? "隐藏(叉)" : (s.origin || "正常")),
                    React.createElement("span", { className: "dset-dbg-tag" }, fmt(s.updatedAt))
                  );
                })
          )
        ),
        React.createElement(CollapseBlock, { title: "VTD 调试", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "查看被隐藏的真实对话(根会话 + 全部 fork 子会话)与自动版本控制记录。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", onClick: loadSessions }, "VTD debug"),
            React.createElement("button", { className: "dset-btn-mini", onClick: loadMinor }, "自动版本控制 debug")
          ),
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
        ),
        React.createElement(CollapseBlock, { title: "TCT(临时对话)设置", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "TCT(Temp Chat Tool)是一次性、低成本的临时对话(返回单段反馈,调用后即焚)。选择采用的模型;下方可快速试一次。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: tctBusy[0], onClick: loadTctModels }, tctBusy[0] ? "读取中…" : "读取模型"),
            React.createElement("select", {
              className: "dset-gp-input", style: { width: "auto", flex: 1 }, value: tctCurrent[0],
              onChange: function (e) { tctPickModel(e.target.value); },
            }, React.createElement("option", { value: "" }, "宿主默认"), tctModels[0].map(function (m) {
              return React.createElement("option", { key: m.provider + ":" + m.id, value: m.id }, (m.label || m.id) + " (" + m.provider + ")");
            }))
          ),
          React.createElement("div", { className: "dset-gp-store-head" },
            React.createElement("input", { className: "dset-gp-input", value: tctPrompt[0], placeholder: "输入测试提示词", onChange: function (e) { setTctPrompt(e.target.value); } }),
            React.createElement("button", { className: "dset-btn-mini", disabled: tctBusy[0], onClick: tctTry }, tctBusy[0] ? "运行中…" : "试一次")
          ),
          tctFeedback[0] ? React.createElement("div", { className: "dset-dbg-panel", style: { maxHeight: 260 } },
            React.createElement("pre", { className: "dset-viewer-code" }, tctFeedback[0])
          ) : null
        )
      );
    }

    // ── DET 功能开关(模块级 store):装载/卸载 文件视图/运行按钮/版本控制/VTD ──
    var detFeatures = { file: true, run: true, ver: true, vtd: true, mda: true, plugins: true, approve: false };
    var detLoaded = false;
    var detListeners = [];
    var vtdWiring = null; // apply() 注入:按开关注册/注销 VTD 视图与消息操作
    function setDet(next) {
      if (next && typeof next === "object") detFeatures = next;
      detLoaded = true;
      for (var i = 0; i < detListeners.length; i++) { try { detListeners[i](); } catch (e) {} }
      if (vtdWiring) { try { vtdWiring(); } catch (e) {} }
    }
    function useDetFeatures() {
      var pair = React.useState(detLoaded ? detFeatures : null);
      React.useEffect(function () {
        var onChange = function () { pair[1](detLoaded ? detFeatures : null); };
        detListeners.push(onChange);
        return function () { var i = detListeners.indexOf(onChange); if (i >= 0) detListeners.splice(i, 1); };
      }, []);
      return pair[0];
    }

    // ── 全局插件管理(设置页:插件列表/五档控制 + 从对话拉取 + 应用商店)──────
    var GP_LEVELS = [
      { key: "always", label: "全局启用", hint: "每个会话自动挂载(会话打开即生效)" },
      { key: "ai-auto", label: "对话AI可自行决定启用", hint: "对话内 AI 可自行启用,无需用户审批" },
      { key: "ai-approve", label: "对话内AI需审批启用", hint: "对话内 AI 启用须用户批准(默认)" },
      { key: "frozen", label: "不再会有新启用", hint: "拒绝一切新启用;已启用会话保持运行" },
      { key: "disabled", label: "全局禁用", hint: "立即停止所有会话实例并拒绝任何启用" },
    ];

    // MDA 分组(仿照「外观」:独立设置区,三选一单选 + 分组树)
    function MdaSection(props) {
      var call = props.call;
      var mfeat = useDetFeatures();
      var mode = React.useState("native");
      var setMode = mode[1];
      var areas = React.useState([]);
      var setAreas = areas[1];
      var sessions = React.useState([]);
      var setSessions = sessions[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var name = React.useState("");
      var setName = name[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var MODES = [
        { key: "native", icon: "🏠", label: "原生分组", desc: "侧边栏/行为与现在一致。" },
        { key: "workspace", icon: "🗂", label: "工作区组", desc: "按 工作区→分支模型区域→会话 分组;区域内模型共享 CDM 记忆 + 插件清单。" },
        { key: "model", icon: "🤝", label: "模型组", desc: "同工作区组,并允许模型合作(mda_activate,耗提示词、不鼓励)。" },
      ];
      var load = function () {
        setBusy(true); setMsg(null);
        Promise.all([call("mdaGet", {}), call("cdmList", {})]).then(function (rs) {
          var r = rs[0], c = rs[1];
          setBusy(false);
          if (r && r.ok) { setMode(r.mode || "native"); setAreas(r.areas || []); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取失败") });
          if (c && c.ok) setSessions(c.sessions || []);
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      React.useEffect(function () { load(); }, []);
      var pick = function (key) {
        setBusy(true); setMsg(null);
        call("mdaSetMode", { mode: key }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMode(r.mode || key); setMsg({ ok: true, text: "✓ 已选择: " + key }); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var newArea = function (workspace) {
        setBusy(true); setMsg(null);
        var nm = name[0].trim() === "" ? ("区域 " + (areas[0].length + 1)) : name[0].trim();
        call("mdaAreaCreate", { name: nm, workspace: workspace || "" }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setName(""); setMsg({ ok: true, text: "✓ 已创建「" + r.area.name + "」" }); load(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var newConv = function (areaId, workspace) {
        setBusy(true); setMsg(null);
        call("mdaNewConversation", { areaId: areaId, workspace: workspace }).then(function (r) {
          setBusy(false);
          if (r && r.ok) setMsg({ ok: true, text: "✓ 已在该分组新建对话(子会话 " + r.childSessionId.slice(-8) + ")" });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var delArea = function (id) {
        if (!window.confirm("删除分支模型区域?")) return;
        setBusy(true); setMsg(null);
        call("mdaAreaRemove", { id: id }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已删除区域" }); load(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "删除失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var wsMap = {};
      sessions[0].forEach(function (s) { var w = s.cwd || "(无工作区)"; (wsMap[w] = wsMap[w] || []).push(s.id); });
      var workspaces = Object.keys(wsMap).sort();
      if (mfeat && mfeat.mda === false) return React.createElement("div", { className: "dset-empty" }, "MDA 分组已关闭(可在 DET 管理器开启)。");
      return React.createElement("div", null,
        React.createElement("h3", null, "MDA 分组"),
        React.createElement("p", null, "选择 MDA 分组模式(仿照「外观」)。"),
        React.createElement("div", null, MODES.map(function (o) {
          var on = mode[0] === o.key;
          return React.createElement("div", { key: o.key, className: "dset-switch-row" + (on ? " dset-mda-on" : ""), onClick: function () { if (!busy[0]) pick(o.key); } },
            React.createElement("span", { style: { width: 22 }, className: on ? "dset-mda-check" : "" }, on ? "✔" : o.icon),
            React.createElement("div", { className: "dset-switch-main" },
              React.createElement("div", { className: "dset-switch-name" }, o.label),
              React.createElement("div", { className: "dset-switch-sub" }, o.desc)
            )
          );
        })),
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        React.createElement("div", { className: "dset-sec-title" }, "分组(工作区 → 分支模型区域 → 会话)"),
        React.createElement("p", { className: "dset-sec-desc" }, "非原生模式下:每个工作区右侧「+」在该工作区下建分组并新建一个对话;每个分组右侧「+」在组内新建对话。"),
        React.createElement("div", null, workspaces.map(function (w) {
          var ws = wsMap[w];
          var wsAreas = areas[0].filter(function (a) { return a.workspace === w; });
          return React.createElement("div", { key: w },
            React.createElement("div", { className: "dset-gp-row" },
              React.createElement("div", { className: "dset-gp-row-main" }, "🗂 " + w + " (" + ws.length + " 会话)"),
              React.createElement("button", { className: "dset-btn-mini", title: "建分组 + 新对话", disabled: busy[0], onClick: function () { newArea(w); } }, "➕ 分组+新对话")
            ),
            wsAreas.map(function (a) {
              return React.createElement("div", { key: a.id, style: { paddingLeft: 14 } },
                React.createElement("div", { className: "dset-gp-row" },
                  React.createElement("div", { className: "dset-gp-row-main" }, "▸ 区域「" + a.name + "」(" + (a.memberSessions.length) + " 对话)"),
                  React.createElement("button", { className: "dset-btn-mini", title: "组内新建对话", disabled: busy[0], onClick: function () { newConv(a.id, w); } }, "➕"),
                  React.createElement("button", { className: "dset-btn-mini dset-btn-danger", disabled: busy[0], onClick: function () { delArea(a.id); } }, "删")
                )
              );
            })
          );
        })),
        React.createElement("div", { className: "dset-sec-title" }, "手动新建区域"),
        React.createElement("div", { className: "dset-gp-store-head" },
          React.createElement("input", { className: "dset-gp-input", value: name[0], placeholder: "区域名称", onChange: function (e) { setName(e.target.value); } }),
          React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { newArea(""); } }, "新建区域")
        )
      );
    }

    function GlobalPluginsSection(props) {
      var call = props.call;
      var getSessionId = props.getSessionId || function () { return undefined; };
      var gfeat = useDetFeatures();
      var tab = React.useState("global");
      var setTab = tab[1];
      var plugins = React.useState([]);
      var setPlugins = plugins[1];
      var llmAvail = React.useState(false);
      var setLlmAvail = llmAvail[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var editingId = React.useState(null);
      var setEditingId = editingId[1];
      var editName = React.useState("");
      var setEditName = editName[1];
      var editDesc = React.useState("");
      var setEditDesc = editDesc[1];
      // 拉取
      var cors = React.useState([]);
      var setCors = cors[1];
      var corsSel = React.useState(0);
      var setCorsSel = corsSel[1];
      var corsLoading = React.useState(false);
      var setCorsLoading = corsLoading[1];
      // 商店
      var query = React.useState("dsh plugin");
      var setQuery = query[1];
      var storeItems = React.useState([]);
      var setStoreItems = storeItems[1];
      var storeBusy = React.useState(false);
      var setStoreBusy = storeBusy[1];
      var summaries = React.useState({});
      var setSummaries = summaries[1];
      var dlUrl = React.useState("");
      var setDlUrl = dlUrl[1];
      var previews = React.useState({});
      var setPreviews = previews[1];
      var previewBusy = React.useState({});
      var setPreviewBusy = previewBusy[1];
      // 内联编辑工作区(编辑代码) + AI 安全审查
      var editCodeId = React.useState(null);
      var setEditCodeId = editCodeId[1];
      var editHost = React.useState("");
      var setEditHost = editHost[1];
      var editClient = React.useState("");
      var setEditClient = editClient[1];
      var secText = React.useState({});
      var setSecText = secText[1];
      var secBusy = React.useState({});
      var setSecBusy = secBusy[1];
      // 已安装(永久宿主插件扫描;排除 DET 管理器本身)
      var installed = React.useState([]);
      var setInstalled = installed[1];
      var installedBusy = React.useState(false);
      var setInstalledBusy = installedBusy[1];

      var sid = getSessionId() || "";

      var loadPlugins = function (silent) {
        if (!silent) setBusy(true);
        call("gpList", {}).then(function (r) {
          setBusy(false);
          if (!r || !r.ok) { setMsg({ ok: false, text: "✗ " + ((r && r.error) || "全局插件库不可用(端点未就绪?)") }); return; }
          setPlugins(r.plugins || []);
          setLlmAvail(r.llmAvailable === true);
          setMsg(null);
        }).catch(function (e) {
          setBusy(false);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };
      React.useEffect(function () { loadPlugins(true); }, []);

      var refresh = loadPlugins;

      var loadInstalled = function () {
        setInstalledBusy(true); setMsg(null);
        call("gpScanInstalled", {}).then(function (r) {
          setInstalledBusy(false);
          if (!r || !r.ok) { setMsg({ ok: false, text: "✗ " + ((r && r.error) || "扫描已安装插件失败") }); return; }
          setInstalled(r.plugins || []);
          setMsg(null);
        }).catch(function (e) { setInstalledBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var importInstalled = function (p) {
        setBusy(true); setMsg(null);
        call("gpImportInstalled", { moduleName: p.moduleName }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已把「" + ((r.plugin && r.plugin.name) || p.moduleName) + "」纳入全局插件库(常驻型,启用不重复加载)。可到「插件列表」设置档位/会话启用。" }); setTab("global"); refresh(true); loadInstalled(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "纳入失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var setLevel = function (p, level) {
        setBusy(true); setMsg(null);
        call("gpSetLevel", { id: p.id, level: level }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 「" + p.name + "」档位已改为: " + level + (r.stoppedOnDisable ? "(已停止全部会话实例)" : "") }); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "保存失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var setGlobalEnabled = function (p, enabled) {
        if (!enabled && !window.confirm("禁用常驻插件「" + p.name + "」?\n将实时卸载该插件的宿主实例(不再提供其功能),并自动刷新前端使其 UI 消失;跨会话/跨重启生效。")) return;
        setBusy(true); setMsg(null);
        call("gpSetPermanentEnabled", { id: p.id, enabled: enabled }).then(function (r) {
          setBusy(false);
          if (r && r.ok) {
            // 自动刷新前端:卸载/装载后客户端需重挂载,DBS 这类插件的浮层/UI 才会随之消失或重新出现。
            setMsg({ ok: true, text: "✓ 常驻插件「" + p.name + "」已" + (r.enabled ? "启用" : "禁用") + (r.applyError ? "(仅持久化,未实时生效)" : "") + ",自动刷新前端以生效…" });
            setTimeout(function () { try { window.location.reload(); } catch (e) { /* ignore */ } }, 500);
          } else { setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") }); }
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var sessionEnable = function (p) {
        if (!sid) { setMsg({ ok: false, text: "✗ 未检测到当前会话" }); return; }
        var activate = props.activate || function (s, pid) { return call("gpSessionEnable", { sessionId: s, id: pid, by: "user" }); };
        setBusy(true); setMsg(null);
        activate(sid, p.id, "user").then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已在当前会话启用「" + p.name + "」" }); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "启用失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var sessionDisable = function (p) {
        if (!sid) { setMsg({ ok: false, text: "✗ 未检测到当前会话" }); return; }
        setBusy(true); setMsg(null);
        call("gpSessionDisable", { sessionId: sid, id: p.id }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已在当前会话停用「" + p.name + "」" }); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "停用失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var removePlugin = function (p) {
        if (!window.confirm("删除全局插件「" + p.name + "」?\n将停止所有会话中的实例并移除代码记录。")) return;
        setBusy(true); setMsg(null);
        call("gpDelete", { id: p.id }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已删除「" + p.name + "」" }); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "删除失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var saveMeta = function (p) {
        setBusy(true); setMsg(null);
        call("gpSetMeta", { id: p.id, name: editName[0], description: editDesc[0] }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setEditingId(null); setMsg({ ok: true, text: "✓ 已保存「" + editName[0] + "」名称/描述" }); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "保存失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var loadCordis = function () {
        setCorsLoading(true); setMsg(null);
        call("gpCordisInventory", {}).then(function (r) {
          setCorsLoading(false);
          if (r && r.ok) { setCors(r.sessions || []); setCorsSel(0); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取对话插件失败") });
        }).catch(function (e) { setCorsLoading(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var pullPlugin = function (sess, p) {
        setBusy(true); setMsg(null);
        call("gpPull", { sessionId: sess.id, pluginId: p.pluginId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已拉取为全局插件「" + r.plugin.name + "」(默认档位:对话内AI需审批启用)" }); setTab("global"); refresh(true); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "拉取失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var searchStore = function () {
        setStoreBusy(true); setMsg(null);
        call("gpStoreSearch", { q: query[0] }).then(function (r) {
          setStoreBusy(false);
          if (r && r.ok) setStoreItems(r.items || []);
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "搜索失败") });
        }).catch(function (e) { setStoreBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var summarize = function (item) {
        if (summaries[0][item.fullName]) return;
        setStoreBusy(true); setMsg(null);
        call("gpStoreSummarize", { repo: item.fullName }).then(function (r) {
          setStoreBusy(false);
          var next = Object.assign({}, summaries[0]);
          if (r && r.ok) { next[item.fullName] = { text: r.summary, cached: r.cached === true }; setSummaries(next); }
          else setMsg({ ok: false, text: "✗ AI 摘要失败: " + ((r && r.error) || "未知错误") });
        }).catch(function (e) { setStoreBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var installRepo = function (item) {
        if (!window.confirm("安装 " + item.fullName + " 为全局插件?\n\n⚠ 该仓库代码将以当前 DSH 进程的真实权限运行(与动态 Cordis 插件一致);只安装你信任的代码。\n安装后默认档位:对话内AI需审批启用。")) return;
        setBusy(true); setMsg(null);
        call("gpInstall", { repo: item.fullName }).then(function (r) {
          setBusy(false);
          if (r && r.ok) {
            var warn = r.warnings && r.warnings.length ? " ⚠ 代码含可疑特征: " + r.warnings.map(function (w) { return w.half + ":" + w.label; }).join("; ") : "";
            setMsg({ ok: true, text: "✓ 已安装「" + r.plugin.name + "」" + warn });
            setTab("global"); refresh(true);
          }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "安装失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var downloadUrl = function () {
        var url = dlUrl[0].trim();
        if (url === "") { setMsg({ ok: false, text: "✗ 请输入清单/代码 URL" }); return; }
        if (!window.confirm("从 " + url + " 下载为全局插件?\n\n⚠ 下载的代码将以当前 DSH 进程的真实权限运行;只下载你信任的代码。")) return;
        setBusy(true); setMsg(null);
        call("gpDownload", { url: url }).then(function (r) {
          setBusy(false);
          if (r && r.ok) {
            var warn = r.warnings && r.warnings.length ? " ⚠ 代码含可疑特征: " + r.warnings.map(function (w) { return w.half + ":" + w.label; }).join("; ") : "";
            setMsg({ ok: true, text: "✓ 已下载「" + r.plugin.name + "」(默认档位:对话内AI需审批启用)" + warn });
            setDlUrl(""); setTab("global"); refresh(true);
          }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "下载失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var previewCode = function (p) {
        if (previews[0][p.id]) { setPreviews(Object.assign({}, previews[0], { [p.id]: null })); return; }
        setPreviewBusy(Object.assign({}, previewBusy[0], { [p.id]: true }));
        call("gpCode", { id: p.id }).then(function (r) {
          setPreviewBusy(Object.assign({}, previewBusy[0], { [p.id]: false }));
          if (r && r.ok) setPreviews(Object.assign({}, previews[0], { [p.id]: r }));
          else setMsg({ ok: false, text: "✗ 预览失败: " + ((r && r.error) || "未知错误") });
        }).catch(function (e) { setPreviewBusy(Object.assign({}, previewBusy[0], { [p.id]: false })); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      // 编辑(笔图标):内联打开代码工作区
      var openCodeEdit = function (p) {
        if (p.permanent === true) { setMsg({ ok: false, text: "常驻插件由宿主装载,只能全局启用/禁用,不能编辑代码。" }); return; }
        setBusy(true); setMsg(null);
        call("gpCode", { id: p.id }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setEditCodeId(p.id); setEditHost(r.host || ""); setEditClient(r.client || ""); }
          else setMsg({ ok: false, text: "✗ 读取代码失败: " + ((r && r.error) || "未知错误") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var saveCode = function (p) {
        setBusy(true); setMsg(null);
        call("gpUpdateCode", { id: p.id, host: editHost[0], client: editClient[0] }).then(function (r) {
          setBusy(false);
          if (r && r.ok) {
            var warn = r.warnings && r.warnings.length ? " ⚠ 可疑特征: " + r.warnings.map(function (w) { return w.half + ":" + w.label; }).join("; ") : "";
            setMsg({ ok: true, text: "✓ 已保存「" + p.name + "」代码(" + (r.plugin && r.plugin.id || p.id) + ")" + warn + "。改动需对应会话重启该插件后生效。" });
            setEditCodeId(null); refresh(true);
          } else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "保存失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      // 预览代码(盾图标):交给 AI 安全审查(只出报告,不改码)
      var runSecurity = function (p) {
        setSecBusy(Object.assign({}, secBusy[0], { [p.id]: true })); setMsg(null);
        call("gpSecurityReview", { id: p.id }).then(function (r) {
          setSecBusy(Object.assign({}, secBusy[0], { [p.id]: false }));
          if (r && r.ok) setSecText(Object.assign({}, secText[0], { [p.id]: r }));
          else if (r && r.llmAvailable === false) setMsg({ ok: false, text: "✗ " + (r.error || "未配置 LLM,无法做 AI 安全审查") });
          else setMsg({ ok: false, text: "✗ 安全审查失败: " + ((r && r.error) || "未知错误") });
        }).catch(function (e) { setSecBusy(Object.assign({}, secBusy[0], { [p.id]: false })); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var sess = cors[0][corsSel[0]] || null;

      var levelRow = function (p) {
        return GP_LEVELS.map(function (lv) {
          return React.createElement("span", {
            key: lv.key,
            className: "dset-gp-level" + (p.level === lv.key ? " dset-gp-level-on" : ""),
            title: lv.hint,
            onClick: function () { if (!busy[0]) setLevel(p, lv.key); },
          }, lv.label);
        });
      };

      var card = function (p) {
        var m = p.sessions && sid ? p.sessions[sid] : null;
        var on = !!(m && m.state === "enabled" && p.level !== "disabled");
        return React.createElement("div", { key: p.id, className: "dset-gp-card" },
          React.createElement("div", { className: "dset-gp-head" },
            React.createElement("span", { className: "dset-gp-name" }, p.name + " (" + p.id + ")"),
            p.permanent ? React.createElement("span", { className: "dset-gp-badge dset-gp-badge-on" }, "常驻") : null,
            React.createElement("span", { className: "dset-gp-badge " + (on ? "dset-gp-badge-on" : "") }, on ? "本会话启用中" : "本会话未启用"),
            React.createElement("span", { className: "dset-gp-badge" }, p.originKind === "cordis" ? "来自对话" : p.originKind === "github" ? "GitHub" : p.originKind === "installed" ? "已安装插件" : "URL")
          ),
          p.description ? React.createElement("div", { className: "dset-gp-desc" }, p.description) : null,
          p.summary ? React.createElement("div", { className: "dset-gp-summary" }, "AI 摘要: " + p.summary) : null,
          p.permanent
            ? React.createElement("div", { className: "dset-gp-levels" }, [
                React.createElement("span", { className: "dset-gp-level" + (p.globallyEnabled !== false ? " dset-gp-level-on" : ""), title: "全局启用(跨会话/跨重启)", onClick: function () { if (!busy[0]) setGlobalEnabled(p, true); } }, "启用"),
                React.createElement("span", { className: "dset-gp-level" + (p.globallyEnabled === false ? " dset-gp-level-on" : ""), title: "全局禁用(实时卸载插件实例)", onClick: function () { if (!busy[0]) setGlobalEnabled(p, false); } }, "禁用")
              ])
            : React.createElement("div", { className: "dset-gp-levels" }, levelRow(p)),
          React.createElement("div", { className: "dset-gp-acts" },
            React.createElement("button", { className: "dset-gp-act", title: "编辑代码(打开工作区)", disabled: busy[0] || p.permanent === true, onClick: function () { openCodeEdit(p); } },
              React.createElement("span", null, "✎")),
            React.createElement("button", { className: "dset-gp-act", title: "AI 安全审查", disabled: busy[0] || secBusy[0][p.id] === true, onClick: function () { runSecurity(p); } },
              React.createElement("span", null, secBusy[0][p.id] ? "…" : "🔍")),
            React.createElement("button", { className: "dset-gp-act dset-gp-act-danger", title: "删除", onClick: function () { removePlugin(p); } },
              React.createElement("span", null, "🗑"))
          ),
          editCodeId[0] === p.id ? React.createElement("div", { className: "dset-dbg-panel" },
            React.createElement("div", { className: "dset-gp-store-sub" }, "编辑代码工作区(保存后入库,需对应会话重启该插件后生效):"),
            React.createElement("span", { className: "dset-gp-store-sub" }, "host 半区"),
            React.createElement("textarea", { className: "dset-gp-input dset-gp-code", rows: 9, value: editHost[0], onChange: function (e) { setEditHost(e.target.value); }, spellCheck: false }),
            React.createElement("span", { className: "dset-gp-store-sub" }, "client 半区"),
            React.createElement("textarea", { className: "dset-gp-input dset-gp-code", rows: 9, value: editClient[0], onChange: function (e) { setEditClient(e.target.value); }, spellCheck: false }),
            React.createElement("div", { className: "dset-dbg-btns" },
              React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { saveCode(p); } }, "保存"),
              React.createElement("button", { className: "dset-btn-mini", onClick: function () { setEditCodeId(null); } }, "取消")
            )
          ) : null,
          secText[0][p.id] ? React.createElement("div", { className: "dset-dbg-panel", style: { maxHeight: 340 } },
            React.createElement("div", { className: "dset-gp-store-sub" }, "AI 安全审查(只读报告;非安全边界,请以信任为准):"),
            React.createElement("pre", { className: "dset-viewer-code" }, secText[0][p.id].review),
            secText[0][p.id].staticWarnings && secText[0][p.id].staticWarnings.length
              ? React.createElement("div", { className: "dset-gp-note" }, "⚠ 可疑特征扫描: " + secText[0][p.id].staticWarnings.map(function (w) { return w.half + ":" + w.label; }).join("; "))
              : null
          ) : null
        );
      };

      if (gfeat && gfeat.plugins === false) return React.createElement("div", { className: "dset-empty" }, "插件管理已关闭(可在 DET 管理器开启)。");
      return React.createElement("div", null,
        React.createElement("h3", null, "全局插件管理"),
        React.createElement("p", null, "DET 维护的进程级全局插件库:可从对话中的动态 Cordis 插件拉取或从网上下载(应用商店 / 清单 URL)。每个插件五个档位,控制对话内 AI 可不可启用、要不要审批;用户手动启用不受 ai-approve 影响(受「不再会有新启用/全局禁用」限制)。代码拥有当前进程权限,请只收录信任的插件。"),
        React.createElement("div", { className: "dset-gp-tabs" },
          React.createElement("button", { className: "dset-btn-mini" + (tab[0] === "global" ? " dset-btn-on" : ""), onClick: function () { setTab("global"); } }, "插件列表"),
          React.createElement("button", { className: "dset-btn-mini" + (tab[0] === "pull" ? " dset-btn-on" : ""), onClick: function () { setTab("pull"); } }, "从对话拉取"),
          React.createElement("button", { className: "dset-btn-mini" + (tab[0] === "store" ? " dset-btn-on" : ""), onClick: function () { setTab("store"); } }, "应用商店/URL 下载"),
          React.createElement("button", { className: "dset-btn-mini" + (tab[0] === "installed" ? " dset-btn-on" : ""), onClick: function () { setTab("installed"); loadInstalled(); } }, "已安装插件")
        ),
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        tab[0] === "global" ? React.createElement("div", null,
          plugins[0].length === 0 && !busy[0] ? React.createElement("div", { className: "dset-empty" }, "暂无全局插件 · 到「从对话拉取」或「应用商店」添加") : null,
          plugins[0].map(card)
        ) : null,
        tab[0] === "pull" ? React.createElement("div", null,
          React.createElement("p", { className: "dset-sec-desc" }, "从任意【运行中】的对话选择其动态 Cordis 插件,点击拉取即成为全局插件(默认档位:对话内AI需审批启用)。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: corsLoading[0], onClick: loadCordis }, corsLoading[0] ? "读取中…" : "列出对话插件"),
            cors[0].length > 0 ? React.createElement("select", {
              className: "dset-gp-input", style: { width: "auto", flex: 1 },
              value: corsSel[0],
              onChange: function (e) { setCorsSel(Number(e.target.value) || 0); },
            }, cors[0].map(function (s, i) {
              return React.createElement("option", { key: s.id, value: i }, s.title + " · " + s.id.slice(-8) + " · " + s.plugins.length + " 个插件");
            })) : null
          ),
          sess ? React.createElement("div", { className: "dset-dbg-panel" },
            sess.plugins.length === 0 ? React.createElement("div", { className: "dset-empty" }, "该会话暂无动态 Cordis 插件") : null,
            sess.plugins.map(function (p) {
              return React.createElement("div", { key: p.pluginId, className: "dset-gp-row" },
                React.createElement("div", { className: "dset-gp-row-main" },
                  p.name + " · " + p.pluginId + (p.running ? " · 运行中" : "") + (p.hasHostHalf && p.hasClientHalf ? " · host+client" : p.hasHostHalf ? " · host" : " · client")
                ),
                React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { pullPlugin(sess, p); } }, "拉取为全局插件")
              );
            })
          ) : null
        ) : null,
        tab[0] === "store" ? React.createElement("div", null,
          React.createElement("div", { className: "dset-gp-note" }, "⚠ 应用商店/下载获得的代码将以当前 DSH 进程的真实权限运行(与动态 Cordis 插件一致);只收录你信任的插件。"),
          React.createElement("div", { className: "dset-gp-store" },
            React.createElement("div", { className: "dset-gp-store-head" },
              React.createElement("input", { className: "dset-gp-input", value: query[0], onChange: function (e) { setQuery(e.target.value); }, placeholder: "搜索关键词(默认 dsh plugin)" }),
              React.createElement("button", { className: "dset-btn-mini", disabled: storeBusy[0], onClick: searchStore }, "GitHub 搜索")
            ),
            React.createElement("div", { className: "dset-gp-store-head" },
              React.createElement("input", { className: "dset-gp-input", value: dlUrl[0], onChange: function (e) { setDlUrl(e.target.value); }, placeholder: "或直接粘贴 JSON 清单 / JS 文件 URL 下载" }),
              React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: downloadUrl }, "下载")
            ),
            React.createElement("div", { className: "dset-gp-store-sub", style: { display: "flex", gap: 6, flexWrap: "wrap" } },
              React.createElement("span", null, "清单格式(JSON):"), React.createElement("code", null, "{ name, description, host?, client?, hostUrl?, clientUrl? }"),
              React.createElement("span", null, "·"), React.createElement("span", null, "GitHub 仓库约定: 根 dsh-plugin.json,或 plugin/host.js + plugin/client.js"),
              llmAvail[0] ? null : React.createElement("span", { style: { color: "var(--dsw-alias-state-error-primary)" } }, "· 当前未配置 LLM,AI 摘要不可用(设置 → 模型)")
            )
          ),
          storeItems[0].length === 0 ? React.createElement("div", { className: "dset-empty" }, "输入关键词搜索 GitHub 上的 DSH 插件") : null,
          storeItems[0].map(function (item) {
            var sum = summaries[0][item.fullName];
            return React.createElement("div", { key: item.fullName, className: "dset-gp-store" },
              React.createElement("div", { className: "dset-gp-store-head" },
                React.createElement("span", { className: "dset-gp-store-name" }, item.fullName),
                React.createElement("span", { className: "dset-gp-badge" }, "★ " + item.stars),
                React.createElement("button", { className: "dset-btn-mini", disabled: storeBusy[0], onClick: function () { summarize(item); } }, sum ? "已摘要" : "AI 摘要"),
                React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { installRepo(item); } }, "安装")
              ),
              React.createElement("div", { className: "dset-gp-store-sub" }, item.description || "无描述"),
              sum ? React.createElement("div", { className: "dset-gp-summary" }, (sum.cached ? "(缓存) " : "") + sum.text) : null
            );
          })
        ) : null,
          tab[0] === "installed" ? React.createElement("div", null,
          React.createElement("p", { className: "dset-sec-desc" }, "扫描当前 DSH 已常驻装载的「永久宿主插件」(自动排除 DET 全局插件库管理器本身)。例如 DBS(背景音乐)若已常驻会在这里显示。点击「重新扫描」刷新装载状态;点「纳入全局插件库」后即可到「插件列表」管理(常驻型,启用不重复加载)。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: installedBusy[0], onClick: loadInstalled }, installedBusy[0] ? "扫描中…" : "重新扫描")
          ),
          installed[0].length === 0 && !installedBusy[0] ? React.createElement("div", { className: "dset-empty" }, "未发现已安装的常驻插件(排除 DET 管理器)") : null,
          installed[0].map(function (p) {
            return React.createElement("div", { key: p.id, className: "dset-gp-row" },
              React.createElement("div", { className: "dset-gp-row-main" },
                (p.moduleName || p.name) + " · " + (p.enabled ? "已启用" : "已禁用") + (p.fiberPhase ? " · " + p.fiberPhase : "") + (p.inLibrary ? " · 已在库" : "")
              ),
              React.createElement("button", { className: "dset-btn-mini", disabled: busy[0] || p.inLibrary, onClick: function () { importInstalled(p); } }, p.inLibrary ? "已纳入" : "纳入全局插件库")
            );
          })
        ) : null
      );
    }

    // ── DeepSeek 余额 / 官网单价(参考开源做法;client 侧仅展示,数据由宿主端点提供)──
    var dsState = {
      price: null, priceErr: null, priceAt: 0, loadingPrice: false,
      balance: null, balanceErr: null, balanceAt: 0, loadingBalance: false, balanceLoaded: false,
    };
    var dsListeners = [];
    var dsFetch = { price: null, balance: null };
    function setDs(patch) {
      if (patch) { for (var k in patch) dsState[k] = patch[k]; }
      for (var i = 0; i < dsListeners.length; i++) { try { dsListeners[i](); } catch (e) {} }
    }
    function useDs() {
      var pair = React.useState(dsState);
      React.useEffect(function () {
        var onChange = function () { pair[1](dsState); };
        dsListeners.push(onChange);
        return function () { var i = dsListeners.indexOf(onChange); if (i >= 0) dsListeners.splice(i, 1); };
      }, []);
      return pair[0];
    }
    /** 官网峰值时段:北京时间周一至五 9:00-12:00 / 14:00-18:00(与文档 note 一致,UTC+8)。 */
    function isDsPeakNow() {
      var d = new Date();
      var bei = new Date(d.getTime() + 8 * 3600 * 1000); // 转为北京时间读 UTC 字段
      var day = bei.getUTCDay();
      if (day === 0 || day === 6) return false; // 周末错峰
      var h = bei.getUTCHours();
      return (h >= 9 && h < 12) || (h >= 14 && h < 18);
    }
    /** 余额显示串(参考实现:跳过零余额,¥/$ 标志,多币种用 | 连接)。 */
    function dsBalanceText(bal) {
      if (!bal || !bal.balances || !bal.balances.length) return "—";
      var parts = [];
      for (var i = 0; i < bal.balances.length; i++) {
        var b = bal.balances[i];
        var v = Number(b.total);
        if (!isFinite(v) || v === 0) continue;
        parts.push((b.currency === "CNY" ? "¥" : "$") + v.toFixed(2).replace(/\.00$/, ""));
      }
      return parts.length ? parts.join(" | ") : "¥0";
    }

    /** 右下角余额悬浮卡(点击展开详情/刷新)。 */
    function DsBalanceChip(props) {
      var call = props.call;
      var st = useDs();
      var open = React.useState(false);
      var setOpen = open[1];
      var err = st.balanceErr;
      var bal = st.balance;
      var summary = err ? "余额 ?" : (bal ? ("余额 " + dsBalanceText(bal)) : (st.loadingBalance ? "余额 …" : "余额 ?"));
      return React.createElement("div", { className: "dset-ds-bal" },
        open[0] && (bal || err) ? React.createElement("div", { className: "dset-ds-bal-card" },
          React.createElement("div", { className: "dset-ds-bal-head" },
            React.createElement("span", { className: "dset-ds-bal-title" }, "DeepSeek 余额"),
            React.createElement("span", { className: "dset-ds-bal-sub" }, bal && bal.fetchedAt ? new Date(bal.fetchedAt).toLocaleTimeString() : ""),
            React.createElement("button", { className: "dset-btn-mini", disabled: st.loadingBalance, onClick: function () { (dsFetch.balance || function () {})(true); } }, "刷新"),
            React.createElement("button", { className: "dset-x", onClick: function () { setOpen(false); } }, "✕")
          ),
          bal ? React.createElement("div", null,
            bal.balances.length ? bal.balances.map(function (b) {
              return React.createElement("div", { key: b.currency, className: "dset-ds-bal-row" },
                React.createElement("span", { style: { flex: 1 } }, b.currency, " 总计 "),
                React.createElement("b", null, (b.currency === "CNY" ? "¥" : "$") + String(b.total)),
                React.createElement("span", null, " 赠送 " + String(b.granted) + " · 充值 " + String(b.toppedUp))
              );
            }) : React.createElement("div", { className: "dset-ds-bal-sub" }, "无余额记录"),
            React.createElement("div", { className: "dset-ds-bal-sub" }, bal.isAvailable ? "账户可用" : "账户不可用(可能欠费)"),
            bal.estimate ? React.createElement("div", { className: "dset-ds-bal-sub" },
              bal.estimate.mismatch
                ? ("定价为 " + bal.estimate.currency + ",当前余额为其它币种 — 未估算耗尽时间")
                : ("预计耗尽: " + (typeof bal.estimate.daysLeft === "number" ? "约 " + bal.estimate.daysLeft + " 天" : "—") +
                    " · 近 " + bal.estimate.windowDays + " 天日均 " + (bal.estimate.currency === "CNY" ? "¥" : "$") + String(bal.estimate.daily) +
                    " · 按 " + (bal.estimate.modelId || "") + " 错峰单价 × 会话用量估算")
            ) : null,
            st.price && st.price.models && st.price.models.length ? React.createElement("div", { className: "dset-ds-price-tbl" },
              React.createElement("div", { className: "dset-ds-bal-title" }, "模型单价(每 1M tks · 当前" + (isDsPeakNow() ? "峰值" : "错峰") + ")"),
              st.price.models.map(function (mn) {
                var s = st.price.currency === "CNY" ? "¥" : "$";
                var short = String(mn.id).replace(/^deepseek-v4-/, "").replace(/-exp$/, "");
                var peak2 = isDsPeakNow();
                return React.createElement("div", { key: mn.id, className: "dset-ds-price-row" },
                  React.createElement("span", { className: "dset-ds-price-name" }, short),
                  React.createElement("span", { className: "dset-ds-price-cell" }, "命中 " + s + String(peak2 ? mn.inputHitPeak : mn.inputHitOffPeak)),
                  React.createElement("span", { className: "dset-ds-price-cell" }, "未命中 " + s + String(peak2 ? mn.inputMissPeak : mn.inputMissOffPeak)),
                  React.createElement("span", { className: "dset-ds-price-cell" }, "输出 " + s + String(peak2 ? mn.outputPeak : mn.outputOffPeak))
                );
              })
            ) : null
          ) : null,
          err ? React.createElement("div", { className: "dset-ds-bal-sub dset-ds-bal-chip-err" },
            "✗ " + err + (bal ? " (展示上次缓存)" : ""),
            st.balanceHint ? React.createElement("div", null, st.balanceHint) : null
          ) : null
        ) : null,
        React.createElement("div", {
          className: "dset-ds-bal-chip" + (err ? " dset-ds-bal-chip-err" : ""),
          title: err || "点击查看余额详情",
          onClick: function () { setOpen(!open[0]); },
        }, React.createElement("span", { className: "dset-ds-bal-total" }, summary))
      );
    }

    /** 模型选择旁边的单价芯片:输入(缓存未命中)/输出,按当前错峰/峰值择一显示。 */
    function DsModelPrice(props) {
      var getSessionId = props.getSessionId;
      var st = useDs();
      var sid = typeof getSessionId === "function" ? (getSessionId() || "") : "";
      var sel = React.useState(null);
      var setSel = sel[1];
      React.useEffect(function () {
        var dirs = null;
        try { dirs = props.modelDirectories; } catch (e) {}
        if (dirs && typeof dirs.directoryFor === "function" && sid) {
          var d = null;
          try { d = dirs.directoryFor(sid); } catch (e) { return undefined; }
          if (!d || !d.store) return undefined;
          var go = function () {
            try { setSel(d.store.getSnapshot().current || null); } catch (e) {}
          };
          go();
          var stop = typeof d.store.subscribe === "function" ? d.store.subscribe(go) : null;
          return function () { if (typeof stop === "function") { try { stop(); } catch (e) {} } };
        }
        return undefined;
      }, [sid, props.modelDirectories]);
      var cur = sel[0];
      if (!cur || cur.provider !== "deepseek-official") return null;
      var models = st.price ? st.price.models : null;
      if (!models) return null;
      var curSym = st.price && st.price.currency === "CNY" ? "¥" : "$";
      var rec = null;
      for (var i = 0; i < models.length; i++) {
        if (String(models[i].id) === String(cur.model)) { rec = models[i]; break; }
      }
      if (!rec) return null;
      var peak = isDsPeakNow();
      var s = curSym;
      var hitOff = rec.inputHitOffPeak, hitPeak = rec.inputHitPeak;
      var missOff = rec.inputMissOffPeak, missPeak = rec.inputMissPeak;
      var outOff = rec.outputOffPeak, outPeak = rec.outputPeak;
      // 仅显示当前时段(峰/谷)的那一档价格。
      var title = String(cur.model) +
        "\n每 1M tks(" + (st.price && st.price.currency === "CNY" ? "CNY" : "USD") + ") 缓存命中/未命中/输出(" + (peak ? "峰值" : "错峰") + "):" +
        "\n  · 命中 " + s + String(peak ? hitPeak : hitOff) +
        "\n  · 未命中 " + s + String(peak ? missPeak : missOff) +
        "\n  · 输出 " + s + String(peak ? outPeak : outOff) +
        "\n当前时段: " + (peak ? "峰值" : "错峰(谷)") +
        "\n" + (st.price && st.price.note ? String(st.price.note).slice(0, 140) : "") +
        (st.price && st.price.fetchedAt ? "\n更新于 " + new Date(st.price.fetchedAt).toLocaleString() : "");
      return React.createElement("span", { className: "dset-ds-price", title: title },
        React.createElement("span", { className: "dset-ds-price-peak" }, peak ? "峰" : "错"),
        React.createElement("b", null, "命 " + s + String(peak ? hitPeak : hitOff)),
        React.createElement("span", null, " · "),
        React.createElement("b", null, "未命 " + s + String(peak ? missPeak : missOff)),
        React.createElement("span", null, " · "),
        React.createElement("b", null, "出 " + s + String(peak ? outPeak : outOff)),
        React.createElement("span", null, "/1M")
      );
    }

    function apply(ctx) {
      ensureStyles();
      var call = makeCaller(function () { return ctx.get("connection"); });
      // 读入功能开关(持久化在宿主;旧版端点缺失时保持全开,不报错)
      call("detFeatureGet", {}).then(function (r) {
        if (r && r.ok && r.features) setDet(r.features);
      }).catch(function () {});
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
        if (typeof cur === "string") return cur;
        return (cur && cur.id) || undefined;
      };
      // 三件套工具栏(shell.overlay)
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
          function (props) {
            return React.createElement(Toolbar, Object.assign({ call: call, sessionId: props.sessionId || getSessionId() }, props));
          }
        );
      });
      // ── DeepSeek 余额(右下角悬浮卡)与官网单价(模型选择旁边)──────────────
      var loadDsPrice = function (force) {
        if (dsState.loadingPrice) return;
        setDs({ loadingPrice: true });
        (dsFetch.price || function () {})(force === true);
      };
      var loadDsBalance = function (force) {
        if (dsState.loadingBalance) return;
        setDs({ loadingBalance: true });
        (dsFetch.balance || function () {})(force === true);
      };
      dsFetch.price = function (force) {
        call("dsPrice", { force: force === true }).then(function (r) {
          if (r && r.ok) setDs({ price: r, priceErr: null, priceAt: r.fetchedAt || Date.now(), loadingPrice: false });
          else setDs({ priceErr: (r && r.error) || "单价加载失败", loadingPrice: false });
        }).catch(function (e) {
          setDs({ priceErr: String(e && e.message ? e.message : e), loadingPrice: false });
        });
      };
      dsFetch.balance = function (force) {
        call("dsBalance", { force: force === true }).then(function (r) {
          if (r && r.ok) setDs({ balance: r, balanceErr: null, balanceAt: r.fetchedAt || Date.now(), balanceLoaded: true, loadingBalance: false });
          else setDs({ balanceErr: (r && r.error) || "余额加载失败", balanceHint: r && r.hint ? r.hint : null, loadingBalance: false, balanceLoaded: true });
        }).catch(function (e) {
          setDs({ balanceErr: String(e && e.message ? e.message : e), balanceHint: null, loadingBalance: false, balanceLoaded: true });
        });
      };
      loadDsBalance(false);
      loadDsPrice(false);
      ctx.effect(function () {
        var timer = setInterval(function () { if (dsState.balanceLoaded) loadDsBalance(false); }, 60 * 1000);
        return function () { clearInterval(timer); };
      }, "dsh-essential-tools: balance poller");
      ctx.on("connection/reset", function () { loadDsBalance(false); loadDsPrice(false); });
      // 每次完成一次对话(turn/end)后也刷新余额, 让余量及时反映最新消耗。
      ctx.on("session/event", function (session, event) {
        if (event && event.type === "turn/end") loadDsBalance(false);
      });
      // 右下角余额悬浮卡
      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register(
          { name: "shell.overlay", id: "dsh-ds-balance", order: 300 },
          function (props) {
            return React.createElement(DsBalanceChip, Object.assign({ call: call }, props));
          }
        );
      });
      // 模型选择旁边的单价芯片(conversation.input.right = 模型选择右侧座位)
      ctx.slots.inject("conversation.input.right", function () {
        return ctx.slots.register(
          { name: "conversation.input.right", id: "dsh-model-price", order: 150 },
          function (props) {
            var dirs = null;
            try { dirs = ctx.get("modelDirectories"); } catch (e) { /* 忽略 */ }
            return React.createElement(DsModelPrice, Object.assign({ call: call, getSessionId: getSessionId, modelDirectories: dirs }, props));
          }
        );
      });
      // VTD 对话树视图 + 用户消息操作:按 DET 开关 装载/卸载(列表订阅实时响应)
      var vtdViewDisposer = null;
      var userActDisposer = null;
      var registerVtdView = function () {
        if (vtdViewDisposer !== null) return;
        try {
          vtdViewDisposer = ctx.slots.register({
            name: "conversation.view",
            id: "vtd-tree",
            order: 15,
            label: function () { return "VTD 对话"; },
          }, function (props) {
            return React.createElement(VtdView, Object.assign({ call: call, sessionId: props.sessionId }, props));
          });
        } catch (e) { /* 槽尚未声明,由下方 inject 兜底登记 */ }
      };
      var registerUserActions = function () {
        if (userActDisposer !== null) return;
        try {
          userActDisposer = ctx.slots.register({
            name: "conversation.chat.user-actions",
            id: "dsh-user-actions",
            order: 5,
          }, function (props) {
            return React.createElement(UserActions, Object.assign({ call: call }, props));
          });
        } catch (e) { /* 同上 */ }
      };
      vtdWiring = function () {
        if (detFeatures.vtd === true) {
          registerVtdView();
          registerUserActions();
        } else {
          if (vtdViewDisposer !== null) { var d = vtdViewDisposer; vtdViewDisposer = null; d(); }
          if (userActDisposer !== null) { var d2 = userActDisposer; userActDisposer = null; d2(); }
        }
      };
      ctx.slots.inject("conversation.view", function () {
        if (detFeatures.vtd && vtdViewDisposer === null) registerVtdView();
        return function () { if (vtdViewDisposer !== null) { var d = vtdViewDisposer; vtdViewDisposer = null; d(); } };
      });
      ctx.slots.inject("conversation.chat.user-actions", function () {
        if (detFeatures.vtd && userActDisposer === null) registerUserActions();
        return function () { if (userActDisposer !== null) { var d2 = userActDisposer; userActDisposer = null; d2(); } };
      });
      // 左侧栏底部:MDA 分组入口(加法,不顶掉原生会话列表)
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register({ name: "sidebar.footer.action", id: "dsh-mda-entry", order: 200 }, function (props) {
          return React.createElement(MdaSidebarEntry, Object.assign({ call: call }, props));
        });
      });
      // 设置页:DET 管理器(功能开关 + 侧边栏数据自检 + VTD 调试)
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-det-manager",
          order: 90,
          label: function () { return "DET 管理器"; },
        }, function (props) {
          return React.createElement(DetManagerSection, Object.assign({ call: call }, props));
        });
      });
      // 设置页:全局插件管理(独立条目)
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-global-plugins",
          order: 89,
          label: function () { return "全局插件管理"; },
        }, function (props) {
          return React.createElement(GlobalPluginsSection, Object.assign({ call: call, getSessionId: getSessionId, activate: gpActivateSession }, props));
        });
      });
      // 设置页:MDA 分组(仿照「外观」:三选一单选 + 分支模型区域)
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-mda",
          order: 88,
          label: function () { return "MDA 分组"; },
        }, function (props) {
          return React.createElement(MdaSection, Object.assign({ call: call }, props));
        });
      });
      // ── 启用路径:宿主定义+host 直跑后,由客户端 startUserRun 完成 client 半区加载 ──
      var gpActivateSession = function (sid, pid, by) {
        return call("gpSessionEnable", { sessionId: sid, id: pid, by: by || "user" }).then(function (r) {
          if (!r || !r.ok) throw new Error((r && r.error) || "启用失败");
          if (r.hasClientHalf === true) {
            var face = null;
            try { face = ctx.get("dynamicCordisRunner"); } catch (e) { /* 忽略 */ }
            if (face && typeof face.startUserRun === "function") {
              return face.startUserRun({ agentId: sid, pluginId: r.pluginId, packageId: r.packageId, mode: "run", hasClientHalf: true }).then(function () { return r; }, function () { return r; });
            }
          }
          return r;
        });
      };
      // ── 全局插件运行时同步:自动启用(全局启用)+ 恢复已启用会话 ────────────
      var gpLastSession = null;
      var gpSyncing = false;
      var gpSync = function (force) {
        if (gpSyncing) return;
        var sidCheck = getSessionId();
        if (!sidCheck) return;
        if (!force && sidCheck === gpLastSession) return;
        gpLastSession = sidCheck;
        gpSyncing = true;
        call("gpList", {}).then(function (r) {
          if (!r || !r.ok) return;
          var list = r.plugins || [];
          var chain = Promise.resolve();
          for (var i = 0; i < list.length; i++) {
            (function (p) {
              var m = p.sessions && p.sessions[sidCheck];
              if (p.level === "disabled") return; // 全局禁用:不恢复
              // 已有启用记录 → 恢复(含 frozen 存量;待审批的 pending 不恢复);全局启用且未启用 → 自动启用。
              if ((m && m.state !== "pending") || p.level === "always") {
                chain = chain.then(function () {
                  return gpActivateSession(sidCheck, p.id, "auto").catch(function () {});
                });
              }
            })(list[i]);
          }
          return chain;
        }).then(function () { gpSyncing = false; }, function () { gpSyncing = false; });
      };
      // 会话切换时同步当前会话;连接重置后强制重试。
      try {
        if (ctx.sessions.list && typeof ctx.sessions.list.subscribe === "function") {
          ctx.sessions.list.subscribe(function () { gpSync(false); });
        }
      } catch (e) { /* 忽略 */ }
      ctx.on("connection/reset", function () { gpSync(true); });
      gpSync(true);
      // ── ai-auto 自动批准:子动态 Cordis 审批请求,若为 DET 全局插件且档位 ai-auto → 自动批准 ──
      var gpApproved = {};
      var gpRemote = null;
      try { gpRemote = ctx.remote; } catch (e) { /* 忽略 */ }
      if (gpRemote && typeof gpRemote.$on === "function") {
        gpRemote.$on("cordis/request-run", function (req) {
          if (!req || req.requiresApproval !== true || !req.requestId || gpApproved[req.requestId]) return;
          // 仅该会话所在页面自动批准(避免多页面并发批准同一请求)。
          try { if (getSessionId() !== req.agentId) return; } catch (e) { /* 忽略 */ }
          call("gpCheckApproval", { sessionId: req.agentId || "", pluginId: req.pluginId || "" }).then(function (r) {
            if (!r || !r.ok || r.autoApprove !== true || gpApproved[req.requestId]) return;
            gpApproved[req.requestId] = true;
            var face = null;
            try { face = ctx.get("dynamicCordisRunner"); } catch (e) { /* 忽略 */ }
            if (face && typeof face.approve === "function") {
              face.approve(req.requestId, true).catch(function () {
                delete gpApproved[req.requestId];
              });
            } else {
              delete gpApproved[req.requestId];
            }
          }).catch(function () { /* 忽略 */ });
        });
      }
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    exports.inject = ["slots", "sessions", "remote"];
    return module.exports;
  },
});

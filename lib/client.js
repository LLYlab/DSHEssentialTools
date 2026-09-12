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

    // ── 主题样式 ───────────────────────────────────────────────────────────
    var CSS = "" +
      '.dset-root{position:fixed;inset:0;z-index:9990;pointer-events:none;font-family:var(--dsw-font-family);font-size:13px;line-height:1.45;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}' +
      // 工具栏:胶囊容器 + 圆形无边框图标按钮,对齐新版原生的控件语言。
      // 尺寸取 28x28 —— 与原生 .P3OORG_iconButton 完全一致;32px 按钮会让胶囊
      // 宽达 46px,而正文右缘与新版「回合导航轨」之间只有约 52px,塞不下必然压住一边。
      // 28px 按钮 + 4px 内边距 = 36px 胶囊,配合下方 38px 的让位正好落在空隙里。
      // 文案不再常驻显示,改由按钮已有的 title/aria-label 承担(可发现性不受影响)。
      '.dset-toolbar{position:fixed;right:calc(38px + var(--dset-inset-right,0px));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:2px;padding:4px;pointer-events:auto;z-index:9995;border-radius:999px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv2);transition:right var(--ds-transition-duration-slow) var(--ds-ease-in-out)}' +
      '.dset-tb-btn{width:28px;height:28px;padding:0;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--dsw-alias-label-secondary);border:none;border-radius:999px;cursor:pointer;font:inherit;transition:background-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),color var(--ds-transition-duration-fast) var(--ds-ease-in-out)}' +
      '.dset-tb-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}' +
      '.dset-tb-btn:disabled{opacity:.45;cursor:default}' +
      '.dset-tb-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}' +
      '.dset-tb-ico{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}' +
      '.dset-tb-lbl{display:none}' +
      '.dset-panel{position:fixed;right:calc(86px + var(--dset-inset-right,0px));top:50%;transform:translateY(-50%);width:380px;max-width:62vw;max-height:78vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;pointer-events:auto;z-index:9994;box-shadow:var(--dsw-shadow-lv3);transition:right var(--ds-transition-duration-slow) var(--ds-ease-in-out)}' +
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
      // 可访问性:键盘焦点可见 + 图标按钮点击区不小于 28px
      '.dset-x:focus-visible,.dset-tb-btn:focus-visible,.dset-btn-mini:focus-visible,.dset-switch-row:focus-visible,.dset-vtd-ico:focus-visible,.dset-gp-act:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
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
      // 能力层门禁:新宿主已原生完善提供、DET 已卸载的功能 → 只读行(不可点)。
      '.dset-switch-row-native{cursor:default;opacity:.75;border-style:dashed}' +
      '.dset-switch-native{width:auto;height:18px;padding:0 8px;border-radius:5px;display:inline-flex;align-items:center;font-size:11px;cursor:default;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-switch-on::after{left:18px;background:#fff}' +
      // 总开关:比普通分项更醒目(它是「完全原生 ↔ 扩展」的唯一入口)
      '.dset-master-head{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 10px;border:1px solid var(--dsw-alias-brand-primary);border-radius:10px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:border-color .15s,background .15s}' +
      '.dset-master-head:hover{background:var(--dsw-alias-bg-layer-1)}' +
      '.dset-master-head.dset-master-off{border-style:dashed;border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}' +
      '.dset-master-name{font-weight:600;font-size:12.5px}' +
      '.dset-master-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}' +
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
      '.dset-viewer-code{white-space:pre;word-break:break-word;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dset-tree-dir .dset-tree-name{font-weight:500}' +
      '.dset-tree-row-open .dset-tree-name{color:var(--dsw-alias-brand-primary);font-weight:600}' +
      '.dset-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9997;display:flex;align-items:center;justify-content:center}' +
      '.dset-modal{width:min(940px,93vw);max-height:86vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45)}' +
      '.dset-modal-code{flex:1;overflow:auto;padding:10px 12px;background:var(--dsw-alias-bg-base);white-space:pre;word-break:break-word;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dset-modal-edit{flex:1;overflow:auto;width:100%;box-sizing:border-box;padding:10px 12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:none;outline:none;font:inherit;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.5;resize:none;white-space:pre;word-break:break-word}' +
      '.dset-modal-actions{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);justify-content:flex-end;align-items:center}' +
      '.dset-modal-state{color:var(--dsw-alias-label-secondary);font-size:11px;margin-right:auto}' +
      '.dset-diff{flex:1;overflow:auto;padding:8px 10px;background:var(--dsw-alias-bg-base);font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.5;white-space:pre;word-break:break-word}' +
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
      '.dset-vtd-bar{display:flex;align-items:center;gap:2px;padding:0;min-height:calc(28px + var(--dsh-content-font-delta,0px))}' +
      '.dset-vtd-bar:empty{display:none}' +
      '.dset-vtd-ico{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;background:none;color:var(--dsw-alias-label-secondary);border:none;border-radius:999px;cursor:pointer;padding:0;transition:background-color .12s,color .12s}' +
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
      '.dset-vtd-generating{flex:none;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary);padding:2px 0 8px;margin:0 auto;max-width:min(820px,calc(100% - 32px))}' +
      '.dset-vtd-generating::before{content:"";width:8px;height:8px;border-radius:999px;background:var(--dsw-alias-label-tertiary);animation:dset-vtd-pulse 1s ease-in-out infinite}' +
      '@keyframes dset-vtd-pulse{0%,100%{opacity:.35}50%{opacity:1}}' +
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
      '.dset-md-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;overflow:auto;white-space:pre;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12.5px;line-height:1.6;margin:6px 0;color:var(--dsw-alias-label-primary)}' +
      '.dset-md-reason{margin:6px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-reason summary{cursor:pointer;user-select:none;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-reason summary:hover{color:var(--dsw-alias-label-primary)}' +
      '.dset-md-reason pre{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;margin:6px 0;color:var(--dsw-alias-label-secondary);white-space:pre;overflow:auto;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.6}' +
      '.dset-md-tool{margin:8px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:8px 12px;font-size:12.5px}' +
      '.dset-md-tool-result{margin:2px 0 6px}' +
      '.dset-md-tool-err{border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-md-tool-head{display:flex;align-items:center;gap:6px;margin-bottom:4px;color:var(--dsw-alias-label-secondary)}' +
      '.dset-md-tool-ico{flex:none;font-size:12px}' +
      '.dset-md-tool-name{font-weight:500;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      '.dset-md-tool-id{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-left:auto}' +
      '.dset-md-args{white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}' +
      '.dset-vtd-bubble h1,.dset-vtd-bubble h2,.dset-vtd-bubble h3,.dset-vtd-bubble h4{font-size:13px;margin:8px 0 4px}' +
      '.dset-vtd-bubble p{margin:5px 0}' +
      '.dset-vtd-bubble ul,.dset-vtd-bubble ol{margin:5px 0;padding-left:18px}' +
      '.dset-vtd-bubble blockquote{margin:5px 0;padding-left:12px;border-left:2px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary)}' +
      '.dset-vtd-bubble code{background:var(--dsw-alias-markdown-inline-code);border-radius:4px;padding:0 4px;font-size:12.5px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}' +
      '.dset-vtd-bubble strong{font-weight:600}' +
      '.dset-vtd-meta{margin-top:4px}' +
      // 全局插件管理(设置页)
      '.dset-gp-tabs{display:flex;gap:6px;margin-bottom:10px}' +
      '.dset-gp-card{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);margin-bottom:8px}' +
      '.dset-gp-head{display:flex;align-items:center;gap:8px;min-width:0}' +
      '.dset-gp-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-gp-badge{flex:none;font-size:10px;padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}' +
      '.dset-gp-badge-on{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}' +
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
      '.dset-gp-code{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11.5px;white-space:pre-wrap;word-break:break-word}' +
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
      // 余额/单价细节(仅复用 chip-err;其余已被「右下角状态方块」重构取代,清除)。
      '.dset-ds-bal-chip-err{color:var(--dsw-alias-state-error-primary)}' +
      // MDA 伪主侧边栏:几何/色彩**全部交给原生类**(YDXeBa_ 行 / hHd-Xa_ 外壳 / qDHVXG_ 会话列表),
      // 这里只保留原生没有的两点,避免自定义样式覆盖原生(DET 的 CSS 追加在原生之后,同权重会赢)。
      // 已删除的冗余/冲突规则:.dset-mda-item(与原生 row 重复且 gap:6px 覆盖了原生 sessionRow 的 gap:0)、
      // .dset-mda-item-active(原生 YDXeBa_selected)、.dset-mda-slot/.dset-mda-title/.dset-mda-meta/.dset-mda-chev(全部未被引用)。
      '.dset-mda-item{min-width:0}' +
      // ★ 高亮:DET 自有功能,**独立成一个金色按钮**(不塞进「…」菜单),高亮后行标题/图标/星标都是金色。
      '.dset-mda-hl .YDXeBa_title{color:#d4a017;font-weight:600}' +
      '.dset-mda-hl .YDXeBa_slot{color:#d4a017}' +
      '.dset-mda-star{color:var(--dsw-alias-label-tertiary)}' +
      '.dset-mda-star:hover{color:#d4a017}' +
      '.dset-mda-star-on{color:#d4a017}' +
      // 底部「设置」行:hover 用原生行同款高亮(原生没有该按钮的 hover 规则)。
      // 底部设置按钮直接用原生 VOzbGW_trigger(不需要自定义 hover;原生本身没有)。
      '.dset-mda-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
      // logoRow 的「…」菜单:外壳保持与原生一致,把 DET 的额外功能(分组模式/关闭视图)收进来。
      // 几何与配色照原生下拉菜单(--dsw-specific-menu / 行高 38 / 圆角 10 / 勾选 18px)。
      '.dset-mda-menu{min-width:200px;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.32);padding:6px;z-index:9999;font-size:14px;color:var(--dsw-alias-label-primary)}' +
      '.dset-mda-menu-sec{padding:5px 8px 3px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;line-height:18px}' +
      '.dset-mda-menu-item{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:38px;padding:6px 8px;border-radius:10px;cursor:pointer;white-space:nowrap;color:inherit}' +
      '.dset-mda-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-mda-menu-check{flex:0 0 18px;display:grid;place-items:center;color:var(--dsw-alias-label-primary)}' +
      '.dset-mda-menu-sep{height:1px;background:var(--dsw-alias-border-l1);margin:6px 4px}' +
      // DET 5 档网络权限选择器
      '.dset-wp-row{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);cursor:pointer;margin:0}' +
      '.dset-wp-row:hover{border-color:var(--dsw-alias-brand-primary)}' +
      '.dset-wp-on{border-color:var(--dsw-alias-brand-primary)!important;background:var(--dsw-alias-bg-layer-2)!important}' +
      '.dset-wp-main{flex:1;min-width:0}' +
      '.dset-wp-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-wp-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px}' +
      '.dset-wp-rank{width:16px;flex:none;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary)}' +
      '.dset-wp-check{font-weight:600;color:var(--dsw-alias-state-success-primary);flex:none}' +
      // 安全面板
      '.dset-sec-note{padding:6px 8px;border:1px dashed var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}' +
      '.dset-sec-log{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow:auto}' +
      '.dset-sec-log-row{display:flex;gap:6px;align-items:flex-start;font-size:11px;padding:3px 4px;border-radius:5px}' +
      '.dset-sec-log-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dset-sec-log-tag{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}' +
      '.dset-sec-log-tag-risk{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dset-sec-log-main{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dset-sec-log-name{color:var(--dsw-alias-label-tertiary);font-size:10px}' +
      // 输入框工具行:网络权限内联控件
      '.dset-wp-chip{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1;white-space:nowrap}' +
      '.dset-wp-chip:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}' +
      '.dset-wp-chip-ico{font-size:12px}' +
      '.dset-wp-chip-label{overflow:hidden;text-overflow:ellipsis;max-width:120px}' +
      // 外层:与输入框工具行的「模式/权限控制」容器(uV2eYG_modes)同几何,向左贴合。
      '.dset-wp-anchor{position:relative;display:flex;align-items:center;gap:12px;min-width:0;justify-content:flex-start;margin:0;flex:none}' +
      '.dset-wp-anchor .dset-wp-menu{left:0;right:auto}' +
      // 下拉菜单:复刻产品菜单(MenuView._list_19372_8 + _compactList_19372_127)外观,保持一致。
      '.dset-wp-menu{position:absolute;bottom:calc(100% + 4px);left:0;z-index:9996;box-sizing:border-box;min-width:200px;max-width:340px;padding:2px;display:flex;flex-direction:column;gap:0;border:1px solid var(--dsw-alias-border-inverted);border-radius:7px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary)}' +
      '.dset-wp-chip-ico{display:inline-flex;width:16px;height:16px;flex:none;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}' +
      '.dset-wp-chip-ico svg{display:block}' +
      '.dset-wp-menu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:26px;padding:3px 7px;border:none;border-radius:5px;background:transparent;cursor:pointer;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);text-align:left;box-sizing:border-box}' +
      '.dset-wp-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
      '.dset-wp-menu-on{background:transparent}' +
      '.dset-wp-menu-on .dset-wp-name{color:var(--dsw-alias-label-primary);font-weight:600}' +
      '.dset-wp-menu .dset-wp-rank{width:14px;flex:none;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary)}' +
      '.dset-wp-menu .dset-wp-main{flex:1;min-width:0}' +
      '.dset-wp-menu .dset-wp-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px}' +
      '.dset-wp-menu .dset-wp-sub{color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:15px}' +
      '.dset-wp-menu .dset-wp-check{flex:none;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      // 右下角统一状态小方块:价格 / 余额+本对话 / MMS 三行(产品风格,可点击展开详情)。
      // 状态框 + 详情卡:统一挂在一个固定锚点里(列向排列),卡片自然叠在状态框**上方**,
      // 不再各自 position:fixed 互相猜高度。z-index 提到 9998 —— 高于所有 DET 面板(9994~9997)。
      '.dset-statuswrap{position:fixed;right:calc(14px + var(--dset-inset-right,0px));bottom:calc(14px + var(--dset-inset-bottom,0px));z-index:9998;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;transition:right var(--ds-transition-duration-slow) var(--ds-ease-in-out),bottom var(--ds-transition-duration-slow) var(--ds-ease-in-out)}' +
      // 右侧 Sidebar 以 fullscreen 呈现时它 position:fixed 覆盖整个视口,
      // DET 的浮动控件应整体让位,否则会浮在全屏面板之上。
      'html[data-dset-sidebar-fullscreen="1"] .dset-toolbar,html[data-dset-sidebar-fullscreen="1"] .dset-statuswrap{display:none}' +
      '.dset-statuswrap>*{pointer-events:auto}' +
      '.dset-statusbox{display:flex;flex-direction:column;align-items:flex-end;gap:3px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:6px 10px;box-shadow:var(--dsw-shadow-lv2);font-size:12px;color:var(--dsw-alias-label-primary);cursor:default}' +
      '.dset-statusbox-row{display:flex;align-items:center;gap:5px;white-space:nowrap;line-height:18px}' +
      '.dset-statusbox-chip{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;line-height:18px}' +
      '.dset-statusbox-chip:hover{color:var(--dsw-alias-label-primary)}' +
      '.dset-statusbox-chip b{color:var(--dsw-alias-label-primary);font-weight:600}' +
      '.dset-statusbox-chip .dset-statusbox-em{color:var(--dsw-alias-label-secondary)}' +
      // 峰/谷 状态字:居中,峰=金色,谷=绿色。
      '.dset-statusbox-pk{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;border-radius:5px;font-size:11px;font-weight:600;line-height:1}' +
      '.dset-statusbox-pk-peak{color:var(--dsw-alias-state-warn-primary);background:rgba(201,162,39,.16);border:1px solid rgba(201,162,39,.4)}' +
      '.dset-statusbox-pk-valley{color:var(--dsw-alias-state-success-primary);background:rgba(34,160,107,.14);border:1px solid rgba(34,160,107,.38)}' +
      // 展开详情卡(点击后弹出):产品菜单式 popover。
      '.dset-statusbox-card{width:320px;max-width:90vw;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);overflow:hidden;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      '.dset-statusbox-card-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1)}' +
      '.dset-statusbox-card-title{font-weight:600;font-size:12.5px;flex:1}' +
      '.dset-statusbox-card-sub{color:var(--dsw-alias-label-tertiary);font-size:11px}' +
      '.dset-statusbox-card-body{display:flex;flex-direction:column;gap:10px;padding:10px 12px}' +
      '.dset-statusbox-sec{margin:0;font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary)}' +
      '.dset-statusbox-line{display:flex;gap:6px;align-items:baseline;font-size:11.5px;line-height:18px}' +
      '.dset-statusbox-line b{color:var(--dsw-alias-label-primary);font-weight:600}' +
      '.dset-statusbox-line .lab{flex:1;min-width:0;color:var(--dsw-alias-label-secondary)}' +
      '.dset-statusbox-break{font-size:11px;color:var(--dsw-alias-label-secondary)}';

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
    // 工具栏用单色线性图标(24x24,描边式),替代原先的 emoji ——
    // emoji 在深浅色下表现不一(彩色拼图/深灰时钟/细线盾牌,三种风格混在一起),
    // 而新版原生控件一律是单色线性图标。这组路径已用 sharp 渲染自查过。
    var ICON_PLUGINS = 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z';
    var ICON_RUN = 'M8 5v14l11-7z';
    var ICON_FILE = 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z';
    var ICON_HISTORY = 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8h-1.5z';
    var ICON_SHIELD = 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z';
    /** 生成一个工具栏线性图标元素。 */
    var tbIcon = function (d) {
      return React.createElement("svg", { className: "dset-tb-ico", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
        React.createElement("path", { d: d })
      );
    };

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
            React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: props.onClose }, "×")
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
          React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: function () { props.onClose(); } }, "×")
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
      // 必须在组件体内调用:hook 不能写在事件处理函数里(否则点击「回退」会抛 Invalid hook call)。
      var feats = useDetFeatures() || {};

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
        var mustApprove = (feats.approve === true);
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
          React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: function () { props.onClose(); } }, "×")
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
      // mode: 'user'(旧槽 conversation.chat.user-actions) / 'assistant'(新槽
      // conversation.chat.assistant-actions)。助手侧不提供「编辑」——编辑并重发
      // 是用户消息的动作;助手侧给的是 <N> 分支导航 + 重试(在此处建新叉),
      // 恰好补上原生分叉按钮在 branchUnavailable(非最新轮次)时禁用所缺的能力。
      var isAssistant = props.mode === "assistant";
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
        // 只要有一个定位标识就能查:seq 与 messageId 在 treeView 的行里二者可比。
        // ⚠ 新版宿主的消息操作槽(conversation.chat.assistant-actions)**只传
        //   { messageId }**,没有 seq;旧槽(user-actions)两者都传。这里若仍要求
        //   seq 存在,新版上 <N> 分支选择器会静默永不显示 —— 正是最难查的那类回归。
        if (!sessionId || (seq === undefined && !messageId)) return;
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
        isAssistant ? null : React.createElement("button", { className: "dset-vtd-ico", title: "编辑", disabled: busy[0], onClick: function () { setEditMode(!editMode[0]); if (!editMode[0]) setEditText(""); } },
          React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_EDIT }))
        ),
        React.createElement("button", { className: "dset-vtd-ico", title: "重试", disabled: busy[0], onClick: doRetry },
          React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: ICON_RETRY }))
        ),
        !isAssistant && editMode[0]
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
      var generating = React.useState(false);
      var setGenerating = generating[1];
      var refreshingRef = React.useRef(false);
      // 生长检测:树(messages)指纹在两次刷新间变化 → 仍在生成;用于宿主未提供 generating 时的兜底。
      var treeFpRef = React.useRef(null);
      var stableRef = React.useRef(0);
      var vtdFp = function (r) {
        var msgs = (r && r.messages) || [];
        var n = 0, len = 0;
        for (var i = 0; i < msgs.length; i++) { n++; len += (msgs[i].text ? msgs[i].text.length : 0); }
        return n + ":" + len;
      };

      var refresh = function () {
        if (!sessionId) return;
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        setLoading(true);
        call("treeView", { sessionId: sessionId }).then(function (r) {
          refreshingRef.current = false;
          setLoading(false);
          if (r && r.ok) {
            setTree(r); setError(null);
            var fp = vtdFp(r);
            var prev = treeFpRef.current;
            var grew = prev !== null && prev !== fp;
            treeFpRef.current = fp;
            stableRef.current = grew ? 0 : stableRef.current + 1;
            setGenerating(r.generating === true || grew || stableRef.current < 2);
          } else setError((r && r.error) || "加载失败");
        }).catch(function (e) { refreshingRef.current = false; setLoading(false); setError(String(e && e.message ? e.message : e)); });
      };
      React.useEffect(function () { if (sessionId) refresh(); }, [sessionId]);
      // 轮询:子会话回答是异步的;生成中(open turn)高频刷新体现流式,空闲回退到低频。
      React.useEffect(function () {
        if (!sessionId) return undefined;
        var ms = generating[0] ? 700 : 2500;
        var handle = setInterval(refresh, ms);
        return function () { clearInterval(handle); };
      }, [sessionId, generating[0]]);
      // 流式跟随:生成中自动滚到底部(与产品一致)。
      React.useEffect(function () {
        if (!generating[0]) return;
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
      }, [tree[0] && tree[0].messages, generating[0]]);

      var doEdit = function (m) {
        if (busy[0]) return;
        var text = (editFor[0] && editFor[0].messageId === m.messageId ? editFor[0].text : "").trim();
        if (text === "") { setMsg({ ok: false, text: "编辑内容不能为空" }); return; }
        setBusy(true); setMsg(null);
        call("editMessage", { sessionId: sessionId, messageId: m.messageId, newText: text }).then(function (r) {
          setBusy(false); setEditFor(null);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已编辑并创建新叉,新回答生成中…" }); setGenerating(true); refresh(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "编辑失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var doRetry = function (m) {
        if (busy[0]) return;
        if (!window.confirm("重试这条消息?\n(将创建新叉并让 AI 重新回答;原对话隐藏但保留)")) return;
        setBusy(true); setMsg(null);
        call("retryMessage", { sessionId: sessionId, messageId: m.messageId }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMsg({ ok: true, text: "✓ 已重试并创建新叉,新回答生成中…" }); setGenerating(true); refresh(); }
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
          if (r && r.ok) { setDraft(""); setMsg({ ok: true, text: "✓ 已发送" }); setGenerating(true); refresh(); }
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
              : React.createElement(RenderBlocks, { blocks: (m.blocks && m.blocks.length > 0) ? m.blocks : [{ type: "text", text: m.text || "" }] })
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
        generating[0]
          ? React.createElement("div", { className: "dset-vtd-generating" }, "正在生成…")
          : null,
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
    // 新模式: ① model(模型组)= Model→工作区→对话(Model 最外层,无工作区对话落「全工作区」彩色文件夹)
    //         ② workspace(工作区组)= 工作区→Model→对话(工作区最外层);无所属 Model 的对话自动归入同名工作区 Model
    // ── MDA 模式共享 store:前端加分选器/设置页/分组面板 三者同步 ──
    var mdaModeState = { mode: "native", listeners: [] };
    function getMdaMode() { return mdaModeState.mode; }
    function setMdaMode(mode) {
      if (typeof mode !== "string") return;
      if (mode === mdaModeState.mode) return;
      mdaModeState.mode = mode;
      for (var i = 0; i < mdaModeState.listeners.length; i++) { try { mdaModeState.listeners[i](mode); } catch (e) {} }
    }
    function subscribeMdaMode(fn) {
      mdaModeState.listeners.push(fn);
      return function () { var i = mdaModeState.listeners.indexOf(fn); if (i >= 0) mdaModeState.listeners.splice(i, 1); };
    }
    function useMdaMode() {
      var p = React.useState(getMdaMode());
      React.useEffect(function () {
        var unsub = subscribeMdaMode(function (m) { p[1](m); });
        // 同步一次当前值:种子(mdaGet)可能在订阅之前就把 store 设成了非原生,
        // 否则订阅后收不到通知,组件停在初始 native。
        p[1](getMdaMode());
        return unsub;
      }, []);
      return p[0];
    }

    function mdaAreaMembers(a, sMap) {
      var out = [];
      (a.memberSessions || []).forEach(function (sid) { if (sMap[sid]) out.push(sMap[sid]); });
      return out;
    }
    function wsShort(cwd) {
      if (!cwd) return "(无工作区)";
      var s = String(cwd).replace(/[\\/]+$/, "");
      var i = Math.max(s.lastIndexOf("\\"), s.lastIndexOf("/"));
      return i > 0 ? s.slice(i + 1) : s;
    }
    function mdaGroupByWorkspace(members) {
      var byWs = {}, all = [];
      members.forEach(function (s) { var ws = s.cwd || ""; if (ws === "") all.push(s); else (byWs[ws] = byWs[ws] || []).push(s); });
      var folders = [];
      Object.keys(byWs).sort().forEach(function (ws) { folders.push({ key: "ws:" + ws, name: wsShort(ws), isAllWorkspace: false, members: byWs[ws] }); });
      if (all.length) folders.push({ key: "ws:__all__", name: "全工作区", isAllWorkspace: true, members: all });
      return folders;
    }
    function mdaMemberCount(m) {
      var n = 0;
      (m.folders || []).forEach(function (f) { n += (f.members || []).length; });
      return n;
    }
    function mdaBuildTree(mode, areas, sessions) {
      var sMap = {};
      sessions = sessions || [];
      areas = areas || [];
      sessions.forEach(function (s) { if (s) sMap[s.id] = s; });
      if (mode === "native") return { kind: "native", items: sessions };
      var used = {};
      var modelNodes = areas.map(function (a) {
        var members = mdaAreaMembers(a, sMap);
        members.forEach(function (s) { used[s.id] = true; });
        return { kind: "model", key: a.id, id: a.id, name: a.name || "未命名", workspace: a.workspace || "", pluginSet: a.pluginSet || [], folders: mdaGroupByWorkspace(members), synthetic: false };
      });
      // 未归入任何 Model 的会话:有工作区→同名工作区 Model;无工作区→未分组(全工作区)
      var orphanWs = {}, orphans = [];
      sessions.forEach(function (s) { if (!used[s.id]) { var ws = s.cwd || ""; if (ws === "") orphans.push(s); else (orphanWs[ws] = orphanWs[ws] || []).push(s); } });
      Object.keys(orphanWs).sort().forEach(function (ws) {
        var shortName = wsShort(ws);
        var byName = null;
        for (var i = 0; i < modelNodes.length; i++) { if (modelNodes[i].name === shortName) { byName = modelNodes[i]; break; } }
        if (byName) {
          var f = byName.folders.filter(function (x) { return !x.isAllWorkspace && x.name === shortName; })[0];
          if (f) f.members = f.members.concat(orphanWs[ws]);
          else byName.folders.push({ key: byName.id + ":ws:" + ws, name: shortName, isAllWorkspace: false, members: orphanWs[ws] });
        } else {
          modelNodes.push({ kind: "model", key: "__auto__" + ws, id: "__auto__" + ws, name: shortName, workspace: ws, pluginSet: [], folders: [{ key: "__auto__" + ws + ":ws:" + ws, name: shortName, isAllWorkspace: false, members: orphanWs[ws] }], synthetic: true });
        }
      });
      if (orphans.length) modelNodes.push({ kind: "model", key: "__unassigned__", id: "__unassigned__", name: "未分组", workspace: "", pluginSet: [], folders: [{ key: "__unassigned__:ws:__all__", name: "全工作区", isAllWorkspace: true, members: orphans }], synthetic: true });
      modelNodes.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      if (mode === "model") return { kind: "model", items: modelNodes };
      var wsGroups = {};
      modelNodes.forEach(function (m) { var ws = m.workspace || "(无工作区)"; (wsGroups[ws] = wsGroups[ws] || []).push(m); });
      var wsItems = Object.keys(wsGroups).sort().map(function (ws) { return { kind: "workspace", key: "gc:" + ws, name: ws, models: wsGroups[ws] }; });
      return { kind: "workspace", items: wsItems };
    }
    // 会话高亮(金色)持久化:localStorage 保存被高亮会话 id 列表。
    var HL_KEY = "dsh_mda_highlight";
    function loadHl() { try { var a = JSON.parse(localStorage.getItem(HL_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function saveHl(arr) { try { localStorage.setItem(HL_KEY, JSON.stringify(arr)); } catch (e) {} }

    // 官方 DSH 字标(取自原生 sidebar.brand.name):"DSH" 字母 + 深蓝 DEEPSEEK 徽章。
    var DSH_WORDMARK = '<svg width="156" height="24" viewBox="26 0 156 24" fill="none" aria-hidden="true"><path d="M68.416 18.2447H67.0501V16.1272H68.416C69.2619 16.1272 70.1166 15.9163 70.6671 15.3304C71.2181 14.7444 71.426 13.8455 71.426 12.9471C71.426 12.0487 71.2268 11.1498 70.6671 10.5643C70.1083 9.97831 69.2619 9.76744 68.416 9.76744C67.5701 9.76744 66.7154 9.97831 66.1639 10.5643C65.6129 11.1503 65.4049 12.0487 65.4049 12.9471V21.6435H63.009V7.6582H65.4049V8.54883H65.8442C65.8918 8.49393 65.9394 8.44728 65.9875 8.40064C66.5871 7.85353 67.5049 7.6582 68.4072 7.6582C69.8212 7.6582 71.2341 8.00998 72.1607 8.98662C73.0868 9.96325 73.4143 11.4632 73.4143 12.9558C73.4143 14.4485 73.0785 15.9406 72.1607 16.925C71.2424 17.9094 69.8212 18.2457 68.416 18.2457V18.2447Z" fill="currentColor"></path><path d="M31.9551 8.03497H33.3204V10.1525H31.9551C31.1087 10.1525 30.2545 10.3633 29.7035 10.9493C29.1525 11.5353 28.945 12.4342 28.945 13.3326C28.945 14.231 29.1447 15.1294 29.7035 15.7154C30.2623 16.3014 31.1087 16.5122 31.9551 16.5122C32.8015 16.5122 33.6562 16.3014 34.2072 15.7154C34.7582 15.1294 34.9657 14.231 34.9657 13.3326V4.62842H37.3611V18.6219H34.9657V17.7313H34.5264C34.4783 17.7857 34.4307 17.8329 34.3826 17.8795C33.7835 18.4261 32.8652 18.6219 31.9629 18.6219C30.5494 18.6219 29.136 18.2707 28.2099 17.294C27.2838 16.3174 26.9563 14.817 26.9563 13.3248C26.9563 11.8327 27.2916 10.34 28.2099 9.35561C29.136 8.37898 30.5494 8.03497 31.9551 8.03497Z" fill="currentColor"></path><path d="M49.3786 13.1431V13.9948H42.9984V12.2996H47.2305C47.1348 11.6825 46.9113 11.1043 46.5119 10.682C45.9371 10.0727 45.0503 9.85409 44.1723 9.85409C43.2943 9.85409 42.4076 10.0727 41.8328 10.682C41.258 11.2913 41.05 12.2213 41.05 13.1435C41.05 14.0658 41.2575 15.003 41.8328 15.6046C42.4076 16.2061 43.2939 16.433 44.1723 16.433C45.0508 16.433 45.9371 16.2143 46.5119 15.6046C46.5916 15.5186 46.6635 15.4248 46.7354 15.331H49.0992C48.8918 16.0657 48.5643 16.7299 48.0691 17.2454C47.111 18.2531 45.6339 18.6205 44.1723 18.6205C42.7108 18.6205 41.2337 18.2609 40.2755 17.2454C39.3174 16.2299 38.9661 14.6828 38.9661 13.1435C38.9661 11.6043 39.3096 10.0494 40.2755 9.04168C41.242 8.03396 42.7108 7.66663 44.1723 7.66663C45.6339 7.66663 47.111 8.02618 48.0691 9.04168C49.0351 10.0572 49.3786 11.6043 49.3786 13.1435V13.1431Z" fill="currentColor"></path><path d="M61.4045 13.1431V13.9948H55.0243V12.2996H59.2564C59.1602 11.6825 58.9372 11.1043 58.5378 10.682C57.963 10.0727 57.0762 9.85409 56.1982 9.85409C55.3202 9.85409 54.4335 10.0727 53.8587 10.682C53.2839 11.2913 53.0759 12.2213 53.0759 13.1435C53.0759 14.0658 53.2834 15.003 53.8587 15.6046C54.4335 16.2061 55.3202 16.433 56.1982 16.433C57.0762 16.433 57.963 16.2143 58.5378 15.6046C58.6179 15.5186 58.6894 15.4248 58.7608 15.331H61.1251C60.9171 16.0657 60.5897 16.7299 60.0945 17.2454C59.1364 18.2531 57.6593 18.6205 56.1982 18.6205C54.7372 18.6205 53.2596 18.2609 52.3014 17.2454C51.3432 16.2299 50.9919 14.6828 50.9919 13.1435C50.9919 11.6043 51.3355 10.0494 52.3014 9.04168C53.2678 8.03396 54.7367 7.66663 56.1982 7.66663C57.6598 7.66663 59.1364 8.02618 60.0945 9.04168C61.061 10.0572 61.4045 11.6043 61.4045 13.1435V13.1431Z" fill="currentColor"></path><path d="M80.242 18.6214C81.7035 18.6214 83.1801 18.4105 84.1383 17.809C85.0965 17.2075 85.4482 16.2931 85.4482 15.3869C85.4482 14.4807 85.1042 13.5585 84.1383 12.9647C83.1801 12.371 81.703 12.1518 80.242 12.1518C79.6186 12.1518 79.0438 12.0658 78.6366 11.8394C78.2294 11.6047 78.0778 11.2534 78.0778 10.9017C78.0778 10.5499 78.2216 10.1908 78.6366 9.9639C79.0438 9.72921 79.6749 9.65147 80.2973 9.65147C80.9198 9.65147 81.5509 9.73747 81.9591 9.9639C82.3663 10.1986 82.5179 10.5499 82.5179 10.9017H84.9531C84.9531 9.99499 84.6421 9.07327 83.7719 8.47951C82.9017 7.88576 81.5679 7.66663 80.2424 7.66663C78.9169 7.66663 77.5837 7.8775 76.713 8.47951C75.8427 9.08104 75.5308 9.99499 75.5308 10.9017C75.5308 11.8083 75.8423 12.73 76.713 13.3238C77.5832 13.9176 78.9165 14.1367 80.2424 14.1367C80.929 14.1367 81.688 14.2227 82.1428 14.4491C82.5985 14.676 82.7579 15.0351 82.7579 15.3869C82.7579 15.7387 82.5985 16.0977 82.1428 16.3246C81.688 16.5511 80.9931 16.6371 80.3066 16.6371C79.62 16.6371 78.9169 16.5511 78.4694 16.3246C78.0224 16.0982 77.8543 15.7387 77.8543 15.3869H75.0435C75.0435 16.2935 75.3865 17.2153 76.3534 17.809C77.3194 18.4028 78.7809 18.6214 80.2424 18.6214H80.242Z" fill="currentColor"></path><path d="M97.4733 13.1431V13.9948H91.0932V12.2996H95.3252C95.23 11.6825 95.006 11.1043 94.6071 10.682C94.0313 10.0727 93.1456 9.85409 92.2666 9.85409C91.3876 9.85409 90.5018 10.0727 89.927 10.682C89.3522 11.2913 89.1452 12.2213 89.1452 13.1435C89.1452 14.0658 89.3522 15.003 89.927 15.6046C90.5018 16.2061 91.3886 16.433 92.2666 16.433C93.1446 16.433 94.0313 16.2143 94.6071 15.6046C94.6863 15.5186 94.7587 15.4248 94.8301 15.331H97.1935C96.9855 16.0657 96.6585 16.7299 96.1639 17.2454C95.2057 18.2531 93.7281 18.6205 92.2666 18.6205C90.805 18.6205 89.3284 18.2609 88.3703 17.2454C87.4121 16.2299 87.0613 14.6828 87.0613 13.1435C87.0613 11.6043 87.4043 10.0494 88.3703 9.04168C89.3367 8.03396 90.806 7.66663 92.2666 7.66663C93.7272 7.66663 95.2057 8.02618 96.1639 9.04168C97.1298 10.0572 97.4729 11.6043 97.4729 13.1435L97.4733 13.1431Z" fill="currentColor"></path><path d="M109.499 13.1431V13.9948H103.119V12.2996H107.351C107.256 11.6825 107.032 11.1043 106.632 10.682C106.057 10.0727 105.172 9.85409 104.293 9.85409C103.414 9.85409 102.528 10.0727 101.953 10.682C101.378 11.2913 101.17 12.2213 101.17 13.1435C101.17 14.0658 101.378 15.003 101.953 15.6046C102.528 16.2061 103.415 16.433 104.293 16.433C105.171 16.433 106.057 16.2143 106.632 15.6046C106.712 15.5186 106.784 15.4248 106.856 15.331H109.22C109.012 16.0657 108.685 16.7299 108.19 17.2454C107.231 18.2531 105.754 18.6205 104.293 18.6205C102.831 18.6205 101.355 18.2609 100.396 17.2454C99.4382 16.2299 99.0864 14.6828 99.0864 13.1435C99.0864 11.6043 99.4295 10.0494 100.396 9.04168C101.362 8.03396 102.832 7.66663 104.293 7.66663C105.754 7.66663 107.231 8.02618 108.19 9.04168C109.156 10.0572 109.499 11.6043 109.499 13.1435V13.1431Z" fill="currentColor"></path><path d="M113.5 4.62817H111.104V18.6217H113.5V4.62817Z" fill="currentColor"></path><path d="M117.589 12.8154L121.517 18.6208H118.554L114.625 12.8154L118.554 8.15088H121.517L117.589 12.8154Z" fill="currentColor"></path><rect x="129.348" y="5.5" width="52" height="14" rx="2" fill="currentColor"></rect><g clip-path="url(#dsh-mda-wordmark-badge-clip)"><path d="M132.848 8.93205H134.08V16.137H132.848V8.93205ZM136.5 8.93205H137.732V16.137H136.5V8.93205ZM133.365 13.024V11.99H137.193V13.024H133.365Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M140.397 14.432L140.672 13.453H143.202L143.532 14.432H140.397ZM140.287 16.137H139.055L141.277 8.93205H142.201L142.146 9.74605L140.947 13.915H140.969L140.287 16.137ZM145.039 16.137H143.741L143.07 13.948L143.081 13.937L141.871 9.74605L141.926 8.93205H142.817L145.039 16.137Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M146.846 8.93205H149.068C149.852 8.93205 150.443 9.11538 150.839 9.48205C151.235 9.84138 151.433 10.3327 151.433 10.956C151.433 11.22 151.396 11.4657 151.323 11.693C151.249 11.9204 151.125 12.1257 150.949 12.309C150.773 12.4924 150.531 12.65 150.223 12.782C149.922 12.9067 149.541 13.0057 149.079 13.079V13.321H146.846V12.639L148.023 12.485C148.631 12.4044 149.09 12.298 149.398 12.166C149.706 12.034 149.915 11.8764 150.025 11.693C150.135 11.5024 150.19 11.2934 150.19 11.066C150.19 10.6994 150.083 10.417 149.871 10.219C149.658 10.021 149.324 9.92205 148.87 9.92205H146.846V8.93205ZM146.395 8.93205H147.627V16.137H146.395V8.93205ZM151.917 16.093V16.137H150.366L149.024 14.322C148.87 14.1094 148.73 13.9407 148.606 13.816C148.481 13.684 148.345 13.5887 148.199 13.53C148.052 13.464 147.872 13.42 147.66 13.398C147.447 13.3687 147.176 13.3504 146.846 13.343V13.145H149.079C149.233 13.211 149.368 13.2844 149.486 13.365C149.61 13.4457 149.735 13.5447 149.86 13.662C149.992 13.7794 150.138 13.937 150.3 14.135L151.917 16.093Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M153.58 9.57005L153.591 8.93205H154.46L157.584 15.51V16.137H156.704L153.58 9.57005ZM158.024 16.137H156.968L156.88 8.93205H158.024V16.137ZM154.24 16.137H153.096V8.93205H154.152L154.24 16.137Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M159.963 8.93205H161.206V16.137H159.963V8.93205ZM160.095 9.96605V8.93205H164.858V9.96605H160.095ZM160.095 16.137V15.103H164.902V16.137H160.095ZM160.095 13.013V11.99H164.374V13.013H160.095Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M169.052 15.257C169.543 15.257 169.895 15.1654 170.108 14.982C170.328 14.7987 170.438 14.5457 170.438 14.223C170.438 14.047 170.405 13.8967 170.339 13.772C170.273 13.6474 170.152 13.5337 169.976 13.431C169.807 13.321 169.558 13.2147 169.228 13.112L168.491 12.881C167.846 12.6757 167.38 12.4044 167.094 12.067C166.808 11.7297 166.665 11.3007 166.665 10.78C166.665 10.428 166.76 10.1017 166.951 9.80105C167.142 9.50038 167.428 9.25838 167.809 9.07505C168.19 8.89172 168.663 8.80005 169.228 8.80005C169.631 8.80005 169.998 8.82938 170.328 8.88805C170.665 8.93938 171.039 9.01638 171.45 9.11905L171.274 10.175C170.834 10.0504 170.442 9.96238 170.097 9.91105C169.76 9.85238 169.463 9.82305 169.206 9.82305C168.737 9.82305 168.403 9.90738 168.205 10.076C168.007 10.2374 167.908 10.439 167.908 10.681C167.908 10.857 167.941 11.0147 168.007 11.154C168.073 11.286 168.19 11.407 168.359 11.517C168.535 11.627 168.784 11.7334 169.107 11.836L169.866 12.078C170.526 12.276 170.995 12.5327 171.274 12.848C171.553 13.156 171.692 13.585 171.692 14.135C171.692 14.5604 171.589 14.9344 171.384 15.257C171.179 15.5797 170.878 15.8327 170.482 16.016C170.093 16.1994 169.609 16.291 169.03 16.291C168.627 16.291 168.212 16.247 167.787 16.159C167.362 16.071 166.9 15.9427 166.401 15.774L166.665 14.718C167.156 14.894 167.6 15.0297 167.996 15.125C168.399 15.213 168.751 15.257 169.052 15.257Z" fill="var(--dsw-alias-label-primary-inverted)"></path><path d="M175.809 15.257C176.3 15.257 176.652 15.1654 176.865 14.982C177.085 14.7987 177.195 14.5457 177.195 14.223C177.195 14.047 177.162 13.8967 177.096 13.772C177.03 13.6474 176.909 13.5337 176.733 13.431C176.564 13.321 176.315 13.2147 175.985 13.112L175.248 12.881C174.603 12.6757 174.137 12.4044 173.851 12.067C173.565 11.7297 173.422 11.3007 173.422 10.78C173.422 10.428 173.517 10.1017 173.708 9.80105C173.899 9.50038 174.185 9.25838 174.566 9.07505C174.947 8.89172 175.42 8.80005 175.985 8.80005C176.388 8.80005 176.755 8.82938 177.085 8.88805C177.422 8.93938 177.796 9.01638 178.207 9.11905L178.031 10.175C177.591 10.0504 177.199 9.96238 176.854 9.91105C176.517 9.85238 176.22 9.82305 175.963 9.82305C175.494 9.82305 175.16 9.90738 174.962 10.076C174.764 10.2374 174.665 10.439 174.665 10.681C174.665 10.857 174.698 11.0147 174.764 11.154C174.83 11.286 174.947 11.407 175.116 11.517C175.292 11.627 175.541 11.7334 175.864 11.836L176.623 12.078C177.283 12.276 177.752 12.5327 178.031 12.848C178.31 13.156 178.449 13.585 178.449 14.135C178.449 14.5604 178.346 14.9344 178.141 15.257C177.936 15.5797 177.635 15.8327 177.239 16.016C176.85 16.1994 176.366 16.291 175.787 16.291C175.384 16.291 174.969 16.247 174.544 16.159C174.119 16.071 173.657 15.9427 173.158 15.774L173.422 14.718C173.913 14.894 174.357 15.0297 174.753 15.125C175.156 15.213 175.508 15.257 175.809 15.257Z" fill="var(--dsw-alias-label-primary-inverted)"></path></g><defs><clipPath id="dsh-mda-wordmark-badge-clip"><rect width="46" height="14" fill="white" transform="translate(132.348 5.5)"></rect></clipPath></defs></svg>';

    function MdaSidebar(props) {
      var call = props.call;
      var st = React.useState({ loading: true, mode: "native", areas: [], sessions: [], error: "" });
      var collapsed = React.useState({});
      var setCollapsed = collapsed[1];
      var load = function () {
        st[1]({ loading: true });
        Promise.all([call("mdaGet", {}), call("cdmList", {})]).then(function (rs) {
          var m = rs[0], c = rs[1];
          if (m && m.ok) st[1]({ loading: false, mode: m.mode || "native", areas: m.areas || [], sessions: c && c.ok ? (c.sessions || []).filter(function (s) { return !s.hidden; }) : [], error: "" });
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
      var currentId = props.sessionId;
      // 会话高亮(★):持久化于 localStorage,高亮会话金色展示。
      var hlState = React.useState(loadHl());
      var hlIds = {};
      hlState[0].forEach(function (id) { hlIds[id] = true; });
      var toggleHl = function (sid) {
        var arr = hlState[0].slice();
        var i = arr.indexOf(sid);
        if (i >= 0) arr.splice(i, 1); else arr.push(sid);
        saveHl(arr);
        hlState[1](arr);
      };
      // 折叠(收成窄栏)/展开(完整侧栏)与标题搜索过滤,对齐原生侧边栏顶部行为。
      var folded = React.useState(false);
      var setFolded = folded[1];
      var query = React.useState("");
      var setQuery = query[1];
      var searchOpen = React.useState(false);
      var setSearchOpen = searchOpen[1];
      var toggle = function (key, e) { if (e && e.stopPropagation) e.stopPropagation(); setCollapsed(Object.assign({}, collapsed[0], { [key]: !collapsed[0][key] })); };
      var sessionTitle = function (id) { var s = st[0].sessions.find(function (x) { return x.id === id; }); return s ? (s.title || id.slice(-8)) : id.slice(-8); };
      var openKey = function (x) { return x === undefined || x === null || x === "" ? null : !collapsed[0][x]; };
      // 复用原生侧边栏/工作区 CSS(已注入页面):项目/工作区行(34px,文件夹图标+标题)与会话行(32px,标题+相对时间)。
      var timeLabel = function (ts) {
        if (!ts) return "";
        var diff = Date.now() - ts;
        var m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
        if (m < 1) return "刚刚";
        if (m < 60) return m + " 分钟前";
        if (h < 24) return h + " 小时前";
        if (d < 7) return d + " 天前";
        return new Date(ts).toLocaleDateString();
      };
      var iconFolder = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M2.5 4.5A1.5 1.5 0 0 1 4 3h2.2l1.3 1.7h5A1.5 1.5 0 0 1 14 6.2v5.3A1.5 1.5 0 0 1 12.5 13H4a1.5 1.5 0 0 1-1.5-1.5v-7z", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" })
        );
      };
      var iconSession = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-2.3 2.3a.5.5 0 0 1-.85-.36V11.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" })
        );
      };
      // 顶部外壳图标(单色线性,对齐原生侧边栏):DSH 徽标、折叠/打开、搜索、+、新会话。
      var iconLogo = function () {
        // 官方 DSH 鲸鱼 mark(取自原生侧边栏 brandMark)。
        return React.createElement("svg", { width: 24, height: 17.658, viewBox: "0 0 23.16 17.04", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z", fill: "currentColor" })
        );
      };
      var iconPanel = function () {
        // 官方侧边栏折叠/打开 toggle 图标。
        return React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true },
          React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", fill: "currentColor", d: "M9.67272 0.522841C10.8339 0.522841 11.76 0.522714 12.4963 0.602493C13.2453 0.683657 13.8789 0.854248 14.4264 1.25197C14.7504 1.48739 15.0355 1.77247 15.2709 2.0965C15.6686 2.64394 15.8392 3.27758 15.9204 4.02655C16.0002 4.7629 16 5.68895 16 6.85014V9.14986C16 10.3111 16.0002 11.2371 15.9204 11.9735C15.8392 12.7224 15.6686 13.3561 15.2709 13.9035C15.0355 14.2275 14.7504 14.5126 14.4264 14.748C13.8789 15.1458 13.2453 15.3163 12.4963 15.3975C11.76 15.4773 10.8339 15.4772 9.67272 15.4772H6.3273C5.16611 15.4772 4.24006 15.4773 3.50371 15.3975C2.75474 15.3163 2.1211 15.1458 1.57366 14.748C1.24963 14.5126 0.964549 14.2275 0.729131 13.9035C0.331407 13.3561 0.160817 12.7224 0.0796529 11.9735C-0.000126137 11.2371 1.25338e-09 10.3111 1.25338e-09 9.14986V6.85014C1.25329e-09 5.68895 -0.000126137 4.7629 0.0796529 4.02655C0.160817 3.27758 0.331407 2.64394 0.729131 2.0965C0.964549 1.77247 1.24963 1.48739 1.57366 1.25197C2.1211 0.854248 2.75474 0.683657 3.50371 0.602493C4.24006 0.522714 5.16611 0.522841 6.3273 0.522841H9.67272ZM5.54303 1.88715V14.1118C5.78636 14.1128 6.04709 14.1169 6.3273 14.1169H9.67272C10.8639 14.1169 11.7032 14.1164 12.3493 14.0465C12.9824 13.9779 13.3497 13.8494 13.6268 13.6482C13.8354 13.4966 14.0195 13.3125 14.1711 13.1039C14.3723 12.8268 14.5007 12.4595 14.5693 11.8264C14.6393 11.1803 14.6398 10.341 14.6398 9.14986V6.85014C14.6398 5.65896 14.6393 4.81967 14.5693 4.1736C14.5007 3.54048 14.3723 3.17318 14.1711 2.89609C14.0195 2.68747 13.8354 2.50337 13.6268 2.35179C13.3497 2.1506 12.9824 2.02212 12.3493 1.95353C11.7032 1.88358 10.8639 1.88307 9.67272 1.88307H6.3273C6.04709 1.88307 5.78636 1.8862 5.54303 1.88715ZM4.1828 1.91166C3.99125 1.9216 3.8148 1.93577 3.65076 1.95353C3.01764 2.02212 2.65034 2.1506 2.37325 2.35179C2.16463 2.50337 1.98052 2.68747 1.82895 2.89609C1.62776 3.17318 1.49928 3.54048 1.43069 4.1736C1.36074 4.81967 1.36023 5.65896 1.36023 6.85014V9.14986C1.36023 10.341 1.36074 11.1803 1.43069 11.8264C1.49928 12.4595 1.62776 12.8268 1.82895 13.1039C1.98052 13.3125 2.16463 13.4966 2.37325 13.6482C2.65034 13.8494 3.01764 13.9779 3.65076 14.0465C3.81478 14.0642 3.99127 14.0774 4.1828 14.0873V1.91166Z" })
        );
      };
      var iconSearch = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("circle", { cx: "7", cy: "7", r: "4.5", stroke: "currentColor", strokeWidth: 1.3 }),
          React.createElement("path", { d: "M10.5 10.5 14 14", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })
        );
      };
      var iconPlus = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M8 3v10M3 8h10", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })
        );
      };
      var iconNewChat = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-2.3 2.3a.5.5 0 0 1-.85-.36V11.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" }),
          React.createElement("path", { d: "M8 4.5v4M6 6.5h4", stroke: "currentColor", strokeWidth: 1.1, strokeLinecap: "round" })
        );
      };
      var iconMore = function () {
        return React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true, fill: "currentColor" },
          React.createElement("circle", { cx: 3.4, cy: 8, r: 1.35 }),
          React.createElement("circle", { cx: 8, cy: 8, r: 1.35 }),
          React.createElement("circle", { cx: 12.6, cy: 8, r: 1.35 })
        );
      };
      // 会话行菜单里的三个动作图标(线性风格,与原生 16px 图标一致)。
      var iconEdit = function () {
        return React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M11.1 2.6l2.3 2.3-7.5 7.5-2.9.6.6-2.9 7.5-7.5z", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" })
        );
      };
      var iconBranch = function () {
        return React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("circle", { cx: 4.4, cy: 3.4, r: 1.5, stroke: "currentColor", strokeWidth: 1.2 }),
          React.createElement("circle", { cx: 4.4, cy: 12.6, r: 1.5, stroke: "currentColor", strokeWidth: 1.2 }),
          React.createElement("circle", { cx: 11.6, cy: 8, r: 1.5, stroke: "currentColor", strokeWidth: 1.2 }),
          React.createElement("path", { d: "M4.4 4.9v6.2M5.9 3.4h3.7a2 2 0 0 1 2 2v1.1", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
        );
      };
      var iconArchive = function () {
        return React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("path", { d: "M2.6 5.6h10.8v6.8a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V5.6z", stroke: "currentColor", strokeWidth: 1.2 }),
          React.createElement("path", { d: "M2.2 3.4h11.6v2.2H2.2z", stroke: "currentColor", strokeWidth: 1.2 }),
          React.createElement("path", { d: "M6.4 8.6h3.2", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
        );
      };
      var iconSettings = function () {
        return React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
          React.createElement("circle", { cx: "8", cy: "8", r: "3.1", stroke: "currentColor", strokeWidth: 1.3 }),
          React.createElement("path", { d: "M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
        );
      };
      var projectRowInner = function (key, pad, expanded, onToggle, title, actions) {
        return React.createElement("div", { key: key, className: "YDXeBa_projectRow dset-mda-item", style: { paddingLeft: pad }, onClick: onToggle, role: "treeitem", "aria-expanded": !!expanded },
          React.createElement("span", { className: "YDXeBa_slot YDXeBa_folder" }, iconFolder()),
          React.createElement("span", { className: "YDXeBa_slot YDXeBa_chevron" }, React.createElement("span", { className: "YDXeBa_arrow" + (expanded ? " YDXeBa_arrowOpen" : "") }, "▸")),
          React.createElement("span", { className: "YDXeBa_projectText" }, React.createElement("span", { className: "YDXeBa_title" }, title)),
          actions !== null ? React.createElement("span", { className: "YDXeBa_rowActions" }, actions) : null
        );
      };
      var doRename = function (id) {
        var t = window.prompt("重命名会话", sessionTitle(id));
        if (t && t.trim() && props.onRename) props.onRename(id, t.trim());
      };
      var doFork = function (id) { if (props.onFork) props.onFork(id); };
      var doArchive = function (id) { if (window.confirm("归档该会话?") && props.onArchive) props.onArchive(id); };
      var memberRow = function (s, pad) {
        var when = timeLabel(s.updatedAt);
        var active = currentId && s.id === currentId;
        var hl = !!hlIds[s.id];
        return React.createElement("div", { key: s.id, className: "YDXeBa_sessionRow dset-mda-item" + (active ? " YDXeBa_selected" : "") + (hl ? " dset-mda-hl" : ""), style: { paddingLeft: pad }, onClick: function () { if (props.openSession) props.openSession(s.id); } },
          React.createElement("span", { className: "YDXeBa_slot" }, iconSession()),
          React.createElement("span", { className: "YDXeBa_title" }, sessionTitle(s.id)),
          when ? React.createElement("span", { className: "YDXeBa_time" }, when) : null,
          // 原生会话行只放一个「…」;DET 额外保留一个**独立的高亮星标**(金色,状态一眼可见)。
          React.createElement("span", { className: "YDXeBa_rowActions" },
            React.createElement("button", {
              type: "button", className: "YDXeBa_iconButton dset-mda-star" + (hl ? " dset-mda-star-on" : ""),
              "aria-label": hl ? "取消高亮" : "高亮", "aria-pressed": hl,
              onClick: function (e) { e.stopPropagation(); toggleHl(s.id); },
            }, hl ? "★" : "☆"),
            React.createElement("button", {
              type: "button", className: "YDXeBa_iconButton",
              "aria-label": "会话操作", "aria-haspopup": "menu", "aria-expanded": !!(rowMenu[0] && rowMenu[0].id === s.id),
              onClick: function (e) { e.stopPropagation(); openRowMenu(s.id, e.currentTarget, hl); },
            }, iconMore())
          )
        );
      };
      var folderRow = function (f, modelKey, pad) {
        var fk = "folder:" + modelKey + ":" + f.key;
        var fo = openKey(fk);
        var fname = f.name || "(未命名)";
        var plus = React.createElement("button", { className: "YDXeBa_iconButton", title: "组内新对话", disabled: disabled[0], onClick: function (e) { e.stopPropagation(); newConv(modelKey, f.isAllWorkspace ? "" : fname); } }, "＋");
        return React.createElement("div", { key: f.key },
          projectRowInner(f.key, pad, fo, function () { toggle(fk); }, fname, plus),
          fo ? f.members.map(function (s) { return memberRow(s, pad + 22); }) : null
        );
      };
      var modelRow = function (m, pad) {
        var mk = "model:" + m.id;
        var mo = openKey(mk);
        var plus = m.synthetic ? null : React.createElement("button", { className: "YDXeBa_iconButton", title: "组内新对话", disabled: disabled[0], onClick: function (e) { e.stopPropagation(); newConv(m.id, m.workspace || ""); } }, "＋");
        // 未归入区域的自动 Model 通常只有一个同名工作区分组,平铺成员会话,避免两层同名嵌套。
        var flat = !!(m.synthetic && m.folders && m.folders.length === 1);
        return React.createElement("div", { key: m.id },
          projectRowInner(m.id, pad, mo, function () { toggle(mk); }, m.name || "未命名", plus),
          mo ? (flat
            ? m.folders[0].members.map(function (s) { return memberRow(s, pad + 22); })
            : m.folders.map(function (f) { return folderRow(f, m.id, pad + 22); })) : null
        );
      };
      var wsRow = function (w, pad) {
        var wk = "ws:" + w.key;
        var wo = openKey(wk);
        var plus = React.createElement("button", { className: "YDXeBa_iconButton", title: "建分组+新对话", disabled: disabled[0], onClick: function (e) { e.stopPropagation(); newArea(w.name === "(无工作区)" ? "" : w.name); } }, "＋");
        return React.createElement("div", { key: w.key },
          projectRowInner(w.key, pad, wo, function () { toggle(wk); }, w.name || "(无工作区)", plus),
          wo ? w.models.map(function (m) { return modelRow(m, pad + 22); }) : null
        );
      };
      var storeMode = useMdaMode();
      var mode = props.mode !== undefined ? props.mode : storeMode;
      var changeMode = function (m) {
        setDisabled(true);
        call("mdaSetMode", { mode: m }).then(function (r) {
          setDisabled(false);
          if (r && r.ok) {
            if (props.onModeChange) props.onModeChange(r.mode || m);
            setMdaMode(r.mode || m);
            load();
          }
          else { load(); }
        }, function () { setDisabled(false); load(); });
      };
      var tree = (function () {
        var q = query[0].trim().toLowerCase();
        var lists = q === "" ? st[0].sessions : (st[0].sessions || []).filter(function (s) { return (((s.title || "") + " " + (s.id || "")).toLowerCase().indexOf(q) >= 0); });
        return mdaBuildTree(mode, st[0].areas, lists);
      })();
      var foldedOn = folded[0];
      var wide = !foldedOn;
      // 指针是否在栏内:原生用它在离开 2s 后加 hHd-Xa_quietBars —— 不在栏内就不画滚动条。
      var ptr = React.useState(false);
      var setPtr = ptr[1];
      var linger = React.useRef(null);
      var onEnter = function () { if (linger.current) { clearTimeout(linger.current); linger.current = null; } setPtr(true); };
      var onLeave = function () {
        if (linger.current) return;
        linger.current = setTimeout(function () { linger.current = null; setPtr(false); }, 2000);
      };
      React.useEffect(function () { return function () { if (linger.current) clearTimeout(linger.current); }; }, []);

      // DET 的额外功能(分组模式切换 / 关闭 MDA 视图)收进 logoRow 的「…」菜单 ——
      // 这样外壳与原生 SidebarRoot 的 logoRow 完全一致(原生只有:品牌按钮 + 折叠按钮)。
      // 菜单必须 portal 到 body:logoRow 有 overflow:hidden,就地渲染会被裁掉(点了看不见)。
      var menuOpen = React.useState(false);
      var setMenuOpen = menuOpen[1];
      var menuPos = React.useState(null);
      var setMenuPos = menuPos[1];
      var menuBtn = React.useRef(null);
      var menuEl = React.useRef(null);
      var openMenu = function () {
        var r = menuBtn.current ? menuBtn.current.getBoundingClientRect() : null;
        setMenuPos(r ? { top: Math.round(r.bottom + 6), right: Math.max(8, Math.round(window.innerWidth - r.right)) } : { top: 60, right: 20 });
        setMenuOpen(true);
      };
      // 会话行的「…」菜单:与原生一致 —— 每行只有一个 YDXeBa_iconButton(省略号),
      // 四个动作(重命名/分叉/归档/高亮)全部收进菜单,不再并排铺开。
      var rowMenu = React.useState(null);
      var setRowMenu = rowMenu[1];
      var rowMenuEl = React.useRef(null);
      var rowMenuBtn = React.useRef(null);
      var openRowMenu = function (id, el, hl) {
        if (rowMenu[0] && rowMenu[0].id === id) { setRowMenu(null); return; }
        var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        rowMenuBtn.current = el || null;
        setRowMenu({
          id: id, hl: hl,
          top: r ? Math.round(r.bottom + 6) : 140,
          right: r ? Math.max(8, Math.round(window.innerWidth - r.right)) : 20,
        });
      };
      React.useEffect(function () {
        if (!menuOpen[0] && !rowMenu[0]) return undefined;
        var onDocDown = function (e) {
          if (menuEl.current && menuEl.current.contains(e.target)) return;
          if (menuBtn.current && menuBtn.current.contains(e.target)) return;
          if (rowMenuEl.current && rowMenuEl.current.contains(e.target)) return;
          if (rowMenuBtn.current && rowMenuBtn.current.contains(e.target)) return;
          setMenuOpen(false); setRowMenu(null);
        };
        var onKey = function (e) { if (e && e.key === "Escape") { setMenuOpen(false); setRowMenu(null); } };
        document.addEventListener("pointerdown", onDocDown, true);
        document.addEventListener("keydown", onKey);
        return function () {
          document.removeEventListener("pointerdown", onDocDown, true);
          document.removeEventListener("keydown", onKey);
        };
      }, [menuOpen[0], rowMenu[0]]);
      /** 渲染一个原生风格菜单(容器/行/分隔线都照原生下拉菜单的规格)。 */
      var menuNode = function (items, pos, onSelect, ref) {
        return React.createElement("div", {
          ref: ref, className: "dset-mda-menu", role: "menu",
          style: { position: "fixed", top: pos.top, right: pos.right },
        }, items.map(function (it) {
          if (it.sep) return React.createElement("div", { key: it.key, className: "dset-mda-menu-sep" });
          if (it.sec) return React.createElement("div", { key: it.key || it.sec, className: "dset-mda-menu-sec" }, it.sec);
          return React.createElement("div", {
            key: it.id, className: "dset-mda-menu-item", role: "menuitem",
            onClick: function () { onSelect(it.id); },
          },
            React.createElement("span", { className: "dset-mda-menu-check" }, it.icon || ""),
            React.createElement("span", null, it.label)
          );
        }));
      };

      // 外壳与原生 SidebarRoot 逐一对应:
      //   className = clsx(root, !wide&&collapsed, !pointerInside&&quietBars, wide&&wide)
      //   宽度 = 原生默认 280(收成 rail 时 56;原生 clampWidth 范围 264~420)
      //   品牌行 = 品牌按钮(=新会话)+ 折叠/展开按钮(常驻);DET 额外加一个「关闭 MDA 视图」×
      return React.createElement("div", {
        className: "hHd-Xa_root" + (!wide ? " hHd-Xa_collapsed" : "") + (ptr[0] ? "" : " hHd-Xa_quietBars") + (wide ? " hHd-Xa_wide" : ""),
        style: { width: wide ? 280 : 56, height: "100%", minWidth: 0, transition: "width .18s var(--ds-ease-in-out)" },
        onPointerEnter: onEnter,
        onPointerLeave: onLeave,
      },
        React.createElement("div", { className: "hHd-Xa_logoRow" },
          wide ? React.createElement("button", { className: "hHd-Xa_brand hHd-Xa_wide", title: "新建会话", "aria-label": "新建会话", onClick: function () { newConv("", ""); } },
                React.createElement("span", { className: "hHd-Xa_brandIdentity" },
                  React.createElement("span", { className: "hHd-Xa_brandMark" }, iconLogo()),
                  React.createElement("span", { className: "hHd-Xa_brandName", dangerouslySetInnerHTML: { __html: DSH_WORDMARK } })
                )
              ) : null,
          // 折叠/展开:原生里这个按钮常驻;收成 rail 时先显示鲸鱼标,悬停时换成面板图标(由原生 CSS 切换)。
          React.createElement("button", { className: "hHd-Xa_iconButton hHd-Xa_toggle", title: wide ? "收起侧边栏" : "打开侧边栏", "aria-label": wide ? "收起侧边栏" : "打开侧边栏", onClick: function () { setFolded(!foldedOn); } },
            !wide ? React.createElement("span", { className: "hHd-Xa_railMark" }, iconLogo()) : null,
            React.createElement("span", { className: "hHd-Xa_panelIcon" }, iconPanel())
          ),
          // DET 的额外功能收进「…」菜单(分组模式切换 + 关闭 MDA 视图)。
          // 展开态才渲染:收成 56px rail 时原生只放得下一个 36px 按钮。
          wide ? React.createElement("button", {
            ref: menuBtn, className: "hHd-Xa_iconButton", title: "更多", "aria-label": "更多",
            "aria-haspopup": "menu", "aria-expanded": menuOpen[0],
            onClick: function () { if (menuOpen[0]) setMenuOpen(false); else openMenu(); },
          }, iconMore()) : null
        ),
        React.createElement("button", { className: "hHd-Xa_newSession", title: "新建会话", "aria-label": "新建会话", onClick: function () { newConv("", ""); } },
          React.createElement("span", { style: { display: "inline-flex", flex: "none" } }, iconNewChat()),
          wide ? React.createElement("span", { className: "hHd-Xa_newSessionLabel hHd-Xa_wide" }, "新会话") : null
        ),
        wide ? React.createElement("div", { className: "qDHVXG_root" },
            React.createElement("div", { className: "qDHVXG_sectionHeader" },
              React.createElement("span", { className: "qDHVXG_sectionLabel" }, tree.kind === "native" ? "工作区" : "会话"),
              React.createElement("div", { className: "qDHVXG_searchSlot" + (searchOpen[0] ? " qDHVXG_searchSlotExpanded" : "") },
                React.createElement("div", { className: "qDHVXG_search" + (searchOpen[0] ? " qDHVXG_searchExpanded" : "") },
                  React.createElement("input", { className: "qDHVXG_searchInput", value: query[0], placeholder: "搜索会话…", autoFocus: searchOpen[0],
                    onChange: function (e) { setQuery(e.target.value); },
                    onBlur: function () { setSearchOpen(false); setQuery(""); } }),
                  React.createElement("button", { className: "qDHVXG_searchButton", title: "搜索会话", "aria-label": "搜索会话", onClick: function () { setSearchOpen(!searchOpen[0]); } }, iconSearch())
                )
              ),
              React.createElement("div", { className: "qDHVXG_headerActions" },
                React.createElement("button", { className: "qDHVXG_iconButton", title: "新建区域+新对话", "aria-label": "新建区域并新建对话", disabled: disabled[0], onClick: function () { newArea(""); } }, iconPlus())
              )
            ),
            React.createElement("div", { className: "hHd-Xa_regionArea" },
              React.createElement("div", { className: "qDHVXG_list" },
                st[0].loading ? React.createElement("div", { className: "qDHVXG_empty" }, "加载中…") : null,
                st[0].error ? React.createElement("div", { className: "qDHVXG_searchWarning" }, "✗ " + st[0].error) : null,
                tree.kind === "native"
                  ? (function () {
                      var wsMap = {};
                      tree.items.forEach(function (s) { var w = s.cwd || "(无工作区)"; (wsMap[w] = wsMap[w] || []).push(s.id); });
                      return Object.keys(wsMap).sort().map(function (w) { return React.createElement("div", { key: w, className: "YDXeBa_projectRow dset-mda-item", style: { paddingLeft: 8 } }, React.createElement("span", { className: "YDXeBa_slot YDXeBa_folder" }, iconFolder()), React.createElement("span", { className: "YDXeBa_projectText" }, React.createElement("span", { className: "YDXeBa_title" }, wsShort(w))), React.createElement("span", { className: "YDXeBa_rowActions" }, null)); });
                    })()
                  : tree.kind === "workspace"
                    ? tree.items.map(function (w) { return wsRow(w, 0); })
                    : tree.items.map(function (m) { return modelRow(m, 0); })
              )
            )
          ) : null,
        // 底部设置按钮:直接套原生的 VOzbGW_trigger / VOzbGW_rail(settings-general 的 CSS 已在页面里),
        // 结构与原生 TriggerContent 一致(图标 + VOzbGW_triggerLabel)。原生 footArea 常驻,故这里不再只在展开态渲染。
        React.createElement("div", { className: "hHd-Xa_footArea" },
          React.createElement("div", { className: "hHd-Xa_settingsArea" },
            React.createElement("button", {
              type: "button", className: "VOzbGW_trigger dset-mda-foot" + (wide ? "" : " VOzbGW_rail"),
              "aria-haspopup": "dialog", title: "设置",
              onClick: function () {
                // 委托给原生那个触发器(排除自己,否则会点到自己递归)。
                try { var el = document.querySelector(".VOzbGW_trigger:not(.dset-mda-foot)"); if (el) { el.click(); return; } } catch (e) {}
                if (props.onClose) props.onClose();
              },
            },
              React.createElement("span", { style: { display: "inline-flex", flex: "none" } }, iconSettings()),
              wide ? React.createElement("span", { className: "VOzbGW_triggerLabel" }, "设置") : null
            )
          )
        ),
        // 两个「…」菜单(外壳 / 会话行):都 portal 到 body + position:fixed,
        // 避开 logoRow 的 overflow:hidden 裁切;样式照原生下拉菜单。
        menuOpen[0] ? ReactDOM.createPortal(menuNode([
          { key: "s1", sec: "分组模式" },
          { id: "mode:native", label: "原生", icon: mode === "native" ? "✔" : "" },
          { id: "mode:workspace", label: "工作区组", icon: mode === "workspace" ? "✔" : "" },
          { id: "mode:model", label: "模型组", icon: mode === "model" ? "✔" : "" },
          { key: "sep", sep: true },
          { id: "close", label: "关闭 MDA 分组视图" },
        ], { top: menuPos[0] ? menuPos[0].top : 60, right: menuPos[0] ? menuPos[0].right : 20 }, function (id) {
          setMenuOpen(false);
          if (id.indexOf("mode:") === 0) {
            var k = id.slice(5);
            if (!disabled[0] && k !== mode) changeMode(k);
            return;
          }
          if (id === "close" && props.onClose) props.onClose();
        }, menuEl), document.body) : null,
        rowMenu[0] ? ReactDOM.createPortal(menuNode([
          { id: "rename", label: "重命名", icon: iconEdit() },
          { id: "fork", label: "分叉", icon: iconBranch() },
          { id: "archive", label: "归档", icon: iconArchive() },
        ], { top: rowMenu[0].top, right: rowMenu[0].right }, function (id) {
          var sid = rowMenu[0] ? rowMenu[0].id : "";
          setRowMenu(null);
          if (id === "rename") doRename(sid);
          else if (id === "fork") doFork(sid);
          else if (id === "archive") doArchive(sid);
        }, rowMenuEl), document.body) : null
      );
    }

    // 覆盖主侧边栏、可关闭的浮层(按模式自动显示):原生→扁平原版(不显示浮层,保持原厂侧边栏);
    // 工作区组/模型组→改进版分层树,按显示优先级盖在主侧边栏之上;关闭(×)后此模式内不显示,切模式会再次出现。
    function MdaSidebarOverlay(props) {
      var call = props.call;
      var dismissed = React.useState(false);
      var setDismissed = dismissed[1];
      // 响应式订阅共享 store:设置页/侧栏任何一处切换 MDA 模式,浮层即时跟随,免手动刷新。
      var mode = useMdaMode();
      React.useEffect(function () { setDismissed(false); }, [mode]);
      // 种子兜底:浮层先于 apply() 的 mdaGet 挂载时也读一次模式,把共享 store 对齐。
      React.useEffect(function () {
        call("mdaGet", {}).then(function (r) {
          if (r && r.ok && r.mode) setMdaMode(r.mode);
        }).catch(function () {});
      }, []);
      var show = mode !== "native" && !dismissed[0];
      // 始终返回非空包裹层(指针穿透、透明),保证条目 active;
      // 仅当非原生且未关闭时才渲染右侧真正的“伪主侧边栏”内容(宽度由内部折叠状态决定)。
      return React.createElement("div", { style: { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40, pointerEvents: show ? "auto" : "none" } },
        show
          ? React.createElement(MdaSidebar, { call: call, onClose: function () { setDismissed(true); }, sessionId: props.sessionId, openSession: props.openSession, onRename: props.onRename, onFork: props.onFork, onArchive: props.onArchive })
          : null
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
          React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: props.onClose }, "×")
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

    // ── 安全面板(右侧插件栏「安全」按钮):代码审批 / AI命令审计 / Prompt攻击防御 ──
    function SecurityPanel(props) {
      var call = props.call;
      var sessionId = props.sessionId;
      var feat = useDetFeatures();
      var feats = feat && typeof feat === "object" ? feat : {};
      var busy = React.useState(false);
      var setBusy = busy[1];
      var msg = React.useState(null);
      var setMsg = msg[1];
      var log = React.useState([]);
      var setLog = log[1];
      var logOpen = React.useState(false);
      var setLogOpen = logOpen[1];

      var loadLog = function () {
        call("secAuditLog", {}).then(function (r) {
          if (r && r.ok) setLog(r.entries || []);
        }).catch(function () {});
      };
      React.useEffect(function () { loadLog(); }, []);

      var toggle = function (key, name) {
        if (busy[0]) return;
        var cur = feats;
        var next = {};
        for (var k in cur) next[k] = cur[k];
        next[key] = !(cur[key] === true);
        setBusy(true); setMsg(null);
        setDet(next);
        var patch = {}; patch[key] = next[key];
        call("detFeatureSet", { patch: patch }).then(function (r) {
          setBusy(false);
          if (r && r.ok && r.features) setDet(r.features, r);
          else { setDet(cur); setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") }); }
        }).catch(function (e) { setBusy(false); setDet(cur); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };

      var row = function (key, name, sub, on) {
        return React.createElement("div", { key: key, className: "dset-switch-row", onClick: function () { toggle(key, name); } },
          React.createElement("div", { className: "dset-switch-main" },
            React.createElement("div", { className: "dset-switch-name" }, name),
            React.createElement("div", { className: "dset-switch-sub" }, sub + (on ? " · 已开启" : " · 已关闭"))
          ),
          React.createElement("span", { className: "dset-switch" + (on ? " dset-switch-on" : "") }, "")
        );
      };

      return React.createElement("div", { className: "dset-panel", style: { width: 380, maxWidth: "70vw" } },
        React.createElement("div", { className: "dset-head" },
          React.createElement("span", null, "安全"),
          React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: props.onClose }, "×")
        ),
        React.createElement("div", { className: "dset-body" },
          React.createElement("p", { className: "dset-sec-desc" }, "开关即时生效并持久化。命令审计/Prompt 防御开启后,DET 会对相应调用做一次独立模型安全审计(标记 + 高风险拦截止付)。"),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
            row("approve", "代码审批", "需先预览差异并批准,代码修改(文件保存/快照回退)才生效并继续", feats.approve === true),
            row("secCmdAudit", "AI 命令审计", "对 AI 的工具/命令调用,单独调用一次模型做安全审计;高风险则拦截", feats.secCmdAudit === true),
            row("secPromptDefense", "Prompt 攻击防御", "对 AI 的输入(含来自命令的)做独立恶意提示词审计;发现注入则拦截", feats.secPromptDefense === true)
          ),
          msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
          React.createElement("div", { className: "dset-sec-title" }, "安全审计记录"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", onClick: function () { loadLog(); } }, "刷新"),
            React.createElement("button", { className: "dset-btn-mini", onClick: function () { setLogOpen(!logOpen[0]); } }, logOpen[0] ? "收起" : "展开"),
            React.createElement("button", { className: "dset-btn-mini dset-btn-danger", onClick: function () {
              if (!window.confirm("清空安全审计记录?")) return;
              call("secAuditClear", {}).then(function () { setLog([]); }).catch(function () {});
            } }, "清空")
          ),
          logOpen[0] ? React.createElement("div", { className: "dset-sec-log" },
            (log[0] || []).length === 0 ? React.createElement("div", { className: "dset-empty" }, "暂无审计记录") : null,
            (log[0] || []).map(function (e) {
              var risk = e.decision === "RISKY";
              return React.createElement("div", { key: e.at + "-" + e.kind + "-" + e.toolName, className: "dset-sec-log-row" },
                React.createElement("span", { className: "dset-sec-log-tag" + (risk ? " dset-sec-log-tag-risk" : "") }, e.decision || "?"),
                React.createElement("div", { className: "dset-sec-log-main" },
                  React.createElement("div", null, (e.kind === "cmd" ? "命令审计 · " : "Prompt 防御 · ") + (e.toolName || "?") + " · " + new Date(e.at).toLocaleTimeString()),
                  React.createElement("div", { className: "dset-sec-log-name" }, (e.detail || "").slice(0, 120))
                )
              );
            })
          ) : null,
          React.createElement(CollapseBlock, { title: "说明", defaultOpen: false },
            React.createElement("p", { className: "dset-sec-desc" }, "命令审计与 Prompt 防御每次调用都会发起一次独立模型请求,会带来额外开销;仅在需要时开启。审计在 DET 宿主端拦截,高风险直接返回错误并写入记录。")
          )
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
      var secPanel = React.useState(false);
      var setSecPanel = secPanel[1];
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

      // Esc 关闭任意已打开的面板(快捷操作 + 可访问性)。监听器随组件卸载移除。
      React.useEffect(function () {
        var onKey = function (e) {
          if (!e || e.key !== "Escape") return;
          setPanel(null); setPluginPanel(false); setSecPanel(false); setRunMsg(null);
        };
        window.addEventListener("keydown", onKey);
        return function () { window.removeEventListener("keydown", onKey); };
      }, []);

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
          feats.plugins ? React.createElement("button", { className: "dset-tb-btn" + (pluginPanel[0] ? " dset-tb-on" : ""), title: "当前对话插件控制", "aria-label": "当前对话插件控制", "aria-expanded": pluginPanel[0], onClick: function () { setPluginPanel(!pluginPanel[0]); } },
            tbIcon(ICON_PLUGINS),
            React.createElement("span", { className: "dset-tb-lbl" }, "插件")
          ) : null,
          feats.run && runable[0] ? React.createElement("button", { className: "dset-tb-btn", title: "运行入口: " + (runEntry[0] || runKind[0] || "") + "（工作区检测）", "aria-label": "运行工作区入口", disabled: running[0], onClick: doRun },
            tbIcon(ICON_RUN),
            React.createElement("span", { className: "dset-tb-lbl" }, running[0] ? "…" : "运行")
          ) : null,
          feats.file ? React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "file" ? " dset-tb-on" : ""), title: "浏览工作区文件", "aria-label": "浏览工作区文件", "aria-expanded": panel[0] === "file", onClick: function () { setPanel(panel[0] === "file" ? null : "file"); } },
            tbIcon(ICON_FILE),
            React.createElement("span", { className: "dset-tb-lbl" }, "文件")
          ) : null,
          feats.ver ? React.createElement("button", { className: "dset-tb-btn" + (panel[0] === "ver" ? " dset-tb-on" : ""), title: "大版本:快照/回退", "aria-label": "大版本快照与回退", "aria-expanded": panel[0] === "ver", onClick: function () { setPanel(panel[0] === "ver" ? null : "ver"); } },
            tbIcon(ICON_HISTORY),
            React.createElement("span", { className: "dset-tb-lbl" }, "版本")
          ) : null,
          React.createElement("button", { className: "dset-tb-btn" + (secPanel[0] ? " dset-tb-on" : ""), title: "安全:代码审批 / 命令审计 / Prompt 防御", "aria-label": "安全设置", "aria-expanded": secPanel[0], onClick: function () { setSecPanel(!secPanel[0]); } },
            tbIcon(ICON_SHIELD),
            React.createElement("span", { className: "dset-tb-lbl" }, "安全")
          )
        ),
        runMsg[0] ? React.createElement("div", { className: "dset-panel", style: { width: 300 } },
          React.createElement("div", { className: "dset-head" },
            React.createElement("span", null, "运行结果"),
            React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: function () { setRunMsg(null); } }, "×")
          ),
          React.createElement("div", { className: "dset-body" },
            React.createElement("div", { className: "dset-msg " + (runMsg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, runMsg[0].text)
          )
        ) : null,
        feats.file && panel[0] === "file" ? React.createElement(FilePanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null,
        feats.ver && panel[0] === "ver" ? React.createElement(VerPanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null,
        pluginPanel[0] ? React.createElement(SessionPluginsPanel, { call: call, sessionId: sessionId, onClose: function () { setPluginPanel(false); } }) : null,
        secPanel[0] ? React.createElement(SecurityPanel, { call: call, sessionId: sessionId, onClose: function () { setSecPanel(false); } }) : null
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
      // MMS(混合模型系统)
      var mmsModels = React.useState([]);
      var setMmsModels = mmsModels[1];
      var mmsCurrent = React.useState("");
      var setMmsCurrent = mmsCurrent[1];
      var mmsBusy = React.useState(false);
      var setMmsBusy = mmsBusy[1];
      var mmsPrompt = React.useState("");
      var setMmsPrompt = mmsPrompt[1];
      var mmsFeedback = React.useState("");
      var setMmsFeedback = mmsFeedback[1];
      // DET 网络权限(5 档)—— DET 管理器内独立一块,与输入框控件/Full access 旁一行共用共享 store(useWp)。
      var wpm = useWp();
      // 浏览器控制状态
      var browserSt = React.useState(null);
      var setBrowserSt = browserSt[1];
      var browserBusy = React.useState(false);
      var setBrowserBusy = browserBusy[1];

      var loadBrowser = function () {
        setBrowserBusy(true);
        call("browserStatus", {}).then(function (r) {
          setBrowserBusy(false);
          setBrowserSt(r && r.ok ? r : null);
        }).catch(function () { setBrowserBusy(false); setBrowserSt(null); });
      };
      React.useEffect(function () { loadBrowser(); }, []);

      var loadMmsModels = function () {
        setMmsBusy(true); setMsg(null);
        call("mmsModels", {}).then(function (r) {
          setMmsBusy(false);
          if (r && r.ok) { setMmsModels(r.models || []); setMmsCurrent(r.current || ""); }
          else if (r && r.llmAvailable === false) setMsg({ ok: false, text: "✗ " + (r.error || "未配置 LLM") });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取模型失败") });
        }).catch(function (e) { setMmsBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var mmsPickModel = function (val) {
        setMmsBusy(true); setMsg(null);
        call("mmsSetModel", { model: val }).then(function (r) {
          setMmsBusy(false);
          if (r && r.ok) { setMmsCurrent(val); setMsg({ ok: true, text: "✓ MMS 模型已设为: " + (val || "宿主默认") }); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") });
        }).catch(function (e) { setMmsBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var mmsTry = function () {
        if (mmsPrompt[0].trim() === "") { setMsg({ ok: false, text: "请输入测试提示词" }); return; }
        setMmsBusy(true); setMsg(null);
        call("mmsRun", { prompt: mmsPrompt[0] }).then(function (r) {
          setMmsBusy(false);
          if (r && r.ok) setMmsFeedback(r.feedback);
          else if (r && r.llmAvailable === false) setMsg({ ok: false, text: "✗ " + (r.error || "未配置 LLM") });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "MMS 调用失败") });
        }).catch(function (e) { setMmsBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var loadWebPerm = function () {
        call("webPermGet", {}).then(function (r) {
          if (r && r.ok) setWpState({ levels: r.levels || [], current: r.level || "" });
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取网络权限失败") });
        }).catch(function (e) { setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      React.useEffect(function () { if (!wpLoaded) loadWebPerm(); }, []);

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
      // MDA 分层(共享 store:切换即时驱动左侧栏浮层,免手动刷新)
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
          if (r && r.ok && r.features) setDet(r.features, r);
          else { setDet(cur); setMsg({ ok: false, text: "✗ " + ((r && r.error) || "开关保存失败") }); }
        }).catch(function (e) {
          setBusy(false);
          setDet(cur);
          setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) });
        });
      };

      var toggleRow = function (key, name, sub) {
        // 新宿主已原生完善提供该功能 → DET 已卸载自己的实现:
        // 只读展示,不给开关(后端 detFeatureSet 也会拒绝重新打开)。
        if (detNativeProvided[key] === true) {
          return React.createElement("div", { key: key, className: "dset-switch-row dset-switch-row-native" },
            React.createElement("div", { className: "dset-switch-main" },
              React.createElement("div", { className: "dset-switch-name" }, name),
              React.createElement("div", { className: "dset-switch-sub" },
                sub + " · 已卸载(新版 DSH 已原生提供" +
                (detHostInfo && detHostInfo.corridor ? " · " + detHostInfo.corridor : "") + ")")
            ),
            React.createElement("span", { className: "dset-switch dset-switch-native" }, "原生")
          );
        }
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
      var masterOn = feat === null ? true : feat.master !== false;
      // 总开关:关闭后本页是「重新打开 DET」的唯一入口,所以它必须在任何情况下都渲染。
      var masterRow = React.createElement("div", {
        className: "dset-master-head" + (masterOn ? "" : " dset-master-off"),
        role: "switch",
        "aria-checked": masterOn ? "true" : "false",
        title: masterOn ? "点击关闭:回到完全原生 DSH" : "点击开启:恢复 DET 扩展",
        onClick: function () { toggle("master"); },
      },
        React.createElement("div", { className: "dset-switch-main" },
          React.createElement("div", { className: "dset-switch-name dset-master-name" }, "总开关 · DET 扩展"),
          React.createElement("div", { className: "dset-switch-sub" }, masterOn
            ? "已开启:按下方的分项开关装载 DET 扩展(界面注入 / 模型工具 / 系统提示 / 浏览器桥)"
            : "已关闭 · 完全原生:除本管理页与这个总开关外,DET 不再改动 DSH 的任何东西")
        ),
        React.createElement("span", { className: "dset-switch" + (masterOn ? " dset-switch-on" : "") }, "")
      );
      // 分项:总开关关闭时整块不渲染(它们此时都不生效)。
      var rest = masterOn ? React.createElement("div", null,
        React.createElement("p", null, "开关即时生效并持久化(宿主 ~/.dsh/storages)。卸载后对应 UI 不再渲染(工具栏按钮 / VTD 对话标签 / 消息操作);端点保持可用,可随时重新装载。"),
        React.createElement("div", { className: "dset-dbg-btns", style: { flexDirection: "column", alignItems: "stretch" } },
          toggleRow("file", "文件视图", "工具栏 🗎 工作区文件树/预览"),
          toggleRow("run", "运行按钮", "工具栏 ▶ 运行入口(工作区检测)"),
          toggleRow("ver", "版本控制", "工具栏 🕘 代码快照/回退/删除"),
          toggleRow("vtd", "VTD", "VTD 对话标签 + 编辑/重试/<N> 消息操作"),
          toggleRow("plugins", "插件管理", "工具栏「插件」按钮/当前对话插件控制 + 全局插件管理 + 安全面板"),
          toggleRow("mda", "MDA 分组", "左侧栏 MDA 分组入口 + 分组树/模型合作"),
          toggleRow("approve", "代码修改审批", "需先预览差异并批准,代码修改(文件保存/快照回退)才生效并继续"),
          toggleRow("mms", "MMS(混合模型)", "把低难度问题交给便宜/本地模型,为主模型省 token 与费用(关闭时模型不感知)"),
          toggleRow("secCmdAudit", "AI 命令审计", "对 AI 工具/命令做独立安全审计,高风险拦截"),
          toggleRow("secPromptDefense", "Prompt 攻击防御", "对 AI 输入(含从命令来的)做恶意提示词审计,注入则拦截")
        ),
        React.createElement(CollapseBlock, { title: "网络调用权限(5 档)", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "控制模型与本插件发起网络访问的范围。「官方API」= AI 用 DeepSeek 官方搜索 API 搜索(按 API 计费)。DET 会对自身网络请求按档位拦截;模型侧也会在系统提示感知当前档位。"),
          React.createElement("div", { className: "dset-dbg-btns", style: { flexDirection: "column", alignItems: "stretch" } },
            wpm.levels.length === 0 ? React.createElement("div", { className: "dset-empty" }, "读取中…") : null,
            wpm.levels.map(function (w) {
              var on = w.key === wpm.current;
              return React.createElement("div", { key: w.key, className: "dset-wp-row" + (on ? " dset-wp-on" : ""), onClick: function () {
                if (on || busy[0]) return;
                setBusy(true); setMsg(null);
                call("webPermSet", { level: w.key }).then(function (r) {
                  setBusy(false);
                  if (r && r.ok) { setWpState({ current: r.level, levels: r.levels || wpm.levels }); setMsg({ ok: true, text: "✓ 网络权限已设为: " + w.label }); }
                  else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "设置失败") });
                }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
              } },
                React.createElement("div", { className: "dset-wp-rank" }, String(w.rank)),
                React.createElement("div", { className: "dset-wp-main" },
                  React.createElement("div", { className: "dset-wp-name" }, w.label),
                  React.createElement("div", { className: "dset-wp-sub" }, w.desc)
                ),
                on ? React.createElement("span", { className: "dset-wp-check" }, "✓") : null
              );
            })
          )
        ),
        React.createElement(CollapseBlock, { title: "浏览器控制(DET → 你的浏览器)", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "让模型通过 det_browser 控制你已登录的浏览器。需 网络权限=使用用户浏览器 且 扩展已加载并开启。扩展侧有 关闭/只读/只写/启用 四档(用户侧控制,DSH 只读)。默认高危,非 Full access 动作需审批。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: browserBusy[0], onClick: loadBrowser }, browserBusy[0] ? "读取中…" : "刷新状态")
          ),
          browserSt[0] ? React.createElement("div", { className: "dset-chk-summary" },
            "Web 权限: " + (browserSt[0].enabled ? "已到「使用用户浏览器」档" : "未到(需设为使用用户浏览器)") +
            " · 桥 " + (browserSt[0].running ? "运行中(:9123)" : "未启动") +
            " · 扩展 " + (browserSt[0].connected ? "已连接" : "未连接(请加载扩展)") +
            " · 模式 " + (browserSt[0].mode || "?")
          ) : React.createElement("div", { className: "dset-empty" }, "读取中…")
        ),
        React.createElement(CollapseBlock, { title: "MMS(混合模型系统)设置", defaultOpen: true },
          React.createElement("p", { className: "dset-sec-desc" }, "MMS 开启时主模型可用 det_mms 把低难度子问题委派给便宜/本地模型,省 token 与费用;关闭时彻底隐藏,不分散注意力。"),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("button", { className: "dset-btn-mini", disabled: mmsBusy[0], onClick: loadMmsModels }, mmsBusy[0] ? "读取中…" : "读取模型"),
            React.createElement("select", {
              className: "dset-gp-input", style: { width: "auto", flex: 1 }, value: mmsCurrent[0],
              onChange: function (e) { mmsPickModel(e.target.value); },
            }, React.createElement("option", { value: "" }, "宿主默认"), mmsModels[0].map(function (m) {
              return React.createElement("option", { key: m.provider + ":" + m.id, value: m.id }, (m.label || m.id) + " (" + m.provider + ")");
            }))
          ),
          React.createElement("div", { className: "dset-dbg-btns" },
            React.createElement("input", { className: "dset-gp-input", value: mmsPrompt[0], placeholder: "试一次:输入简单问题", onChange: function (e) { setMmsPrompt(e.target.value); } }),
            React.createElement("button", { className: "dset-btn-mini", disabled: mmsBusy[0], onClick: mmsTry }, mmsBusy[0] ? "运行中…" : "试一次")
          ),
          mmsFeedback[0] ? React.createElement("div", { className: "dset-dbg-panel", style: { maxHeight: 200 } },
            React.createElement("pre", { className: "dset-viewer-code" }, mmsFeedback[0])
          ) : null
        ),
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
      ) : React.createElement("p", null, "总开关已关闭 —— DET 处于「完全原生」状态:界面注入、det_* 模型工具、系统提示注入、安全审计监听、浏览器桥与会话登记自检都已卸下,DSH 界面与产品原版一致,只剩本管理页。打开上面的总开关即可全部恢复(分项开关的持久化设置原样保留)。");
      return React.createElement("div", null,
        React.createElement("h3", null, "DET 管理器 · 总开关"),
        masterRow,
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        rest
      );
    }

    // ── DET 功能开关(模块级 store):装载/卸载 文件视图/运行按钮/版本控制/VTD ──
    // master = 总开关:关闭即「完全原生」——除「设置 → DET 管理器」这一页与其中的
    // 总开关外,DET 不在 DSH 上留下任何注入(界面 / 工具 / 系统提示 / 浏览器桥)。
    var detFeatures = { master: true, file: true, run: true, ver: true, vtd: true, mda: true, plugins: true, approve: false, mms: false, secCmdAudit: false, secPromptDefense: false };
    // 能力层结论:新宿主上「已由 DSH 原生完善提供、DET 已主动卸载其实现」的功能键。
    // 这些键在 DET 管理器里渲染成只读的「原生已提供」行,而不是可切换开关。
    var detNativeProvided = {};
    var detHostInfo = null;
    var detLoaded = false;
    var detListeners = [];
    var vtdWiring = null; // apply() 注入:按开关注册/注销 VTD 视图与消息操作
    var masterWiring = null; // apply() 注入:按总开关注册/注销全部 DET 界面注入与运行时同步
    function setDet(next, meta) {
      if (next && typeof next === "object") detFeatures = next;
      if (meta && typeof meta === "object") {
        if (meta.nativeProvided && typeof meta.nativeProvided === "object") detNativeProvided = meta.nativeProvided;
        if (meta.host && typeof meta.host === "object") detHostInfo = meta.host;
      }
      detLoaded = true;
      for (var i = 0; i < detListeners.length; i++) { try { detListeners[i](); } catch (e) {} }
      if (vtdWiring) { try { vtdWiring(); } catch (e) {} }
      if (masterWiring) { try { masterWiring(); } catch (e) {} }
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
      var mode = useMdaMode();
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
      var agentName = React.useState("");
      var setAgentName = agentName[1];
      var modelSel = React.useState("");
      var setModelSel = modelSel[1];
      var createNoWsAgent = function () {
        var nm = agentName[0].trim();
        if (nm === "") { setMsg({ ok: false, text: "✗ 请先输入 Agent 名称" }); return; }
        setBusy(true); setMsg(null);
        call("mdaCreateNoWorkspaceAgent", { name: nm, modelId: modelSel[0] || "" }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setAgentName(""); setMsg({ ok: true, text: "✓ 已创建无工作区 Agent(" + (r.childSessionId ? r.childSessionId.slice(-8) : "") + (r.cwd ? " · " + r.cwd : "") + ")" }); load(); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "创建失败") });
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
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
          if (r && r.ok) { setMdaMode(r.mode || "native"); setAreas(r.areas || []); }
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "读取失败") });
          if (c && c.ok) setSessions((c.sessions || []).filter(function (s) { return !s.hidden; }));
        }).catch(function (e) { setBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      React.useEffect(function () { load(); }, []);
      var pick = function (key) {
        setBusy(true); setMsg(null);
        call("mdaSetMode", { mode: key }).then(function (r) {
          setBusy(false);
          if (r && r.ok) { setMdaMode(r.mode || key); setMsg({ ok: true, text: "✓ 已选择: " + key }); }
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
      var collapsed = React.useState({});
      var setCollapsed = collapsed[1];
      var ctoggle = function (key, e) { if (e && e.stopPropagation) e.stopPropagation(); setCollapsed(Object.assign({}, collapsed[0], { [key]: !collapsed[0][key] })); };
      var tree = mdaBuildTree(mode, areas[0], sessions[0]);
      var sessionTitle = function (id) { var s = sessions[0].find(function (x) { return x.id === id; }); return s ? (s.title || id.slice(-8)) : id.slice(-8); };
      var openKey = function (x) { return x === undefined || x === null || x === "" ? null : !collapsed[0][x]; };
      var memberRow = function (s, pad) {
        return React.createElement("div", { key: s.id, className: "dset-dbg-row", style: { paddingLeft: pad } }, React.createElement("span", { className: "dset-dbg-id" }, "💬 " + sessionTitle(s.id)));
      };
      var folderRow = function (f, mk, pad) {
        var fk = "folder:" + mk + ":" + f.key; var fo = openKey(fk);
        return React.createElement("div", { key: f.key },
          React.createElement("div", { className: "dset-gp-row", style: { paddingLeft: pad } },
            React.createElement("button", { className: "dset-vtd-ico", title: "折叠/展开", onClick: function (e) { ctoggle(fk, e); } }, fo ? "▾" : "▸"),
            React.createElement("div", { className: "dset-gp-row-main", style: f.isAllWorkspace ? { color: "var(--dsw-alias-brand-primary)", fontWeight: 600 } : {} }, (f.isAllWorkspace ? "🗂 " : "📁 ") + f.name + " (" + f.members.length + ")")
          ),
          fo ? f.members.map(function (s) { return memberRow(s, pad + 12); }) : null
        );
      };
      var modelRow = function (m, pad) {
        var mk = "model:" + m.id; var mo = openKey(mk);
        return React.createElement("div", { key: m.id },
          React.createElement("div", { className: "dset-gp-row", style: { paddingLeft: pad } },
            React.createElement("button", { className: "dset-vtd-ico", title: "折叠/展开", onClick: function (e) { ctoggle(mk, e); } }, mo ? "▾" : "▸"),
            React.createElement("div", { className: "dset-gp-row-main" }, "🤖 " + m.name + " (" + mdaMemberCount(m) + ")"),
            React.createElement("button", { className: "dset-btn-mini", title: "组内新对话", disabled: busy[0] || m.synthetic, onClick: function () { if (!m.synthetic) newConv(m.id, m.workspace || ""); } }, m.synthetic ? "▫" : "➕"),
            m.synthetic ? null : React.createElement("button", { className: "dset-btn-mini dset-btn-danger", title: "删除区域", disabled: busy[0], onClick: function () { delArea(m.id); } }, "删")
          ),
          mo ? m.folders.map(function (f) { return folderRow(f, m.id, pad + 12); }) : null
        );
      };
      var wsRow = function (w, pad) {
        var wk = "ws:" + w.key; var wo = openKey(wk);
        return React.createElement("div", { key: w.key },
          React.createElement("div", { className: "dset-gp-row", style: { paddingLeft: pad } },
            React.createElement("button", { className: "dset-vtd-ico", title: "折叠/展开", onClick: function (e) { ctoggle(wk, e); } }, wo ? "▾" : "▸"),
            React.createElement("div", { className: "dset-gp-row-main" }, "🗂 " + w.name + " (" + w.models.length + " 模型)"),
            React.createElement("button", { className: "dset-btn-mini", title: "建分组+新对话", disabled: busy[0], onClick: function () { newArea(w.name === "(无工作区)" ? "" : w.name); } }, "➕")
          ),
          wo ? w.models.map(function (m) { return modelRow(m, pad + 12); }) : null
        );
      };
      if (mfeat && mfeat.mda === false) return React.createElement("div", { className: "dset-empty" }, "MDA 分组已关闭(可在 DET 管理器开启)。");
      return React.createElement("div", null,
        React.createElement("h3", null, "MDA 分组"),
        React.createElement("p", null, "选择 MDA 分组模式(仿照「外观」)。"),
        React.createElement("div", null, MODES.map(function (o) {
          var on = mode === o.key;
          return React.createElement("div", { key: o.key, className: "dset-switch-row" + (on ? " dset-mda-on" : ""), onClick: function () { if (!busy[0]) pick(o.key); } },
            React.createElement("span", { style: { width: 22 }, className: on ? "dset-mda-check" : "" }, on ? "✔" : o.icon),
            React.createElement("div", { className: "dset-switch-main" },
              React.createElement("div", { className: "dset-switch-name" }, o.label),
              React.createElement("div", { className: "dset-switch-sub" }, o.desc)
            )
          );
        })),
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        React.createElement("div", { className: "dset-sec-title" }, "分组(工作区 → Model → 对话)"),
        React.createElement("p", { className: "dset-sec-desc" }, "工作区组:工作区在顶层,其下是 Model;模型组:Model 在顶层,其下是工作区(含彩色「全工作区」)。工作区与 Model 均可折叠。"),
        tree.kind === "native"
          ? React.createElement("div", { className: "dset-empty" }, "原生分组不显示分层树(侧边栏/行为与现在一致)。")
          : tree.kind === "workspace"
            ? tree.items.map(function (w) { return wsRow(w, 0); })
            : tree.items.map(function (m) { return modelRow(m, 0); }),
        React.createElement("div", { className: "dset-sec-title" }, "创建无工作区 Agent"),
        React.createElement("div", { className: "dset-gp-store-head" },
          React.createElement("select", { className: "dset-gp-input", value: modelSel[0], onChange: function (e) { setModelSel(e.target.value); } },
            React.createElement("option", { value: "" }, "(不归入任何 Model)"),
            areas[0].map(function (a) { return React.createElement("option", { key: a.id, value: a.id }, a.name); })
          ),
          React.createElement("input", { className: "dset-gp-input", value: agentName[0], placeholder: "Agent 名称", onChange: function (e) { setAgentName(e.target.value); } }),
          React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { createNoWsAgent(); } }, "创建")
        ),
        React.createElement("p", { className: "dset-sec-desc" }, "无工作区 Agent 的工作目录为 DSH\\MDAtemp\\<Agent名>,在模型组模式下落在所归属 Model 的彩色「全工作区」内;可调用该 Model 内所有工作区的对话。"),
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
      var storeSource = React.useState("github");
      var setStoreSource = storeSource[1];
      var storeSources = React.useState([]);
      var setStoreSources = storeSources[1];
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
        call("gpStoreSearch", { q: query[0], source: storeSource[0] }).then(function (r) {
          setStoreBusy(false);
          if (r && r.ok) setStoreItems(r.items || []);
          else setMsg({ ok: false, text: "✗ " + ((r && r.error) || "搜索失败") });
        }).catch(function (e) { setStoreBusy(false); setMsg({ ok: false, text: "✗ " + String(e && e.message ? e.message : e) }); });
      };
      var loadStoreSources = function () {
        call("gpStoreSources", {}).then(function (r) {
          if (r && r.ok) setStoreSources(r.sources || []);
        }).catch(function () {});
      };
      React.useEffect(function () { loadStoreSources(); }, []);
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
        call("gpInstall", { repo: item.fullName, source: item.source || storeSource[0] }).then(function (r) {
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
              React.createElement("select", {
                className: "dset-gp-input", style: { width: "auto", flex: "none" }, value: storeSource[0],
                onChange: function (e) { setStoreSource(e.target.value); setStoreItems([]); },
                title: "选择搜索源(不同插件市场/仓库格式)",
              },
                storeSources[0].length === 0 ? React.createElement("option", { value: "github" }, "GitHub") : null,
                storeSources[0].map(function (s) { return React.createElement("option", { key: s.key, value: s.key }, s.label); })
              ),
              React.createElement("input", { className: "dset-gp-input", value: query[0], onChange: function (e) { setQuery(e.target.value); }, placeholder: "搜索关键词(默认 dsh plugin)" }),
              React.createElement("button", { className: "dset-btn-mini", disabled: storeBusy[0], onClick: searchStore }, storeBusy[0] ? "搜索中…" : "搜索")
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
          storeItems[0].length === 0 ? React.createElement("div", { className: "dset-empty" }, (storeSource[0] === "github" ? "输入关键词搜索 GitHub 上的 DSH 插件" : "点击「搜索」从 " + (storeSource[0] || "市场") + " 拉取插件(已预先爬取中心市场数据)")) : null,
          storeItems[0].map(function (item) {
            var sum = summaries[0][item.fullName];
            var srcName = (storeSources[0] || []).filter(function (s) { return s.key === item.source; })[0];
            return React.createElement("div", { key: item.source + ":" + item.fullName, className: "dset-gp-store" },
              React.createElement("div", { className: "dset-gp-store-head" },
                React.createElement("span", { className: "dset-gp-badge" }, srcName ? srcName.label : (item.source || "?")),
                React.createElement("span", { className: "dset-gp-store-name" }, item.fullName),
                React.createElement("span", { className: "dset-gp-badge" }, "★ " + item.stars),
                React.createElement("button", { className: "dset-btn-mini", disabled: storeBusy[0], onClick: function () { summarize(item); } }, sum ? "已摘要" : "AI 摘要"),
                React.createElement("button", { className: "dset-btn-mini", disabled: busy[0], onClick: function () { installRepo(item); } }, "安装")
              ),
              React.createElement("div", { className: "dset-gp-store-sub" }, item.description || "无描述"),
              (item.categories && item.categories.length) ? React.createElement("div", { className: "dset-gp-store-sub", style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 } },
                item.categories.slice(0, 6).map(function (c) { return React.createElement("span", { key: c, className: "dset-gp-badge" }, String(c).replace(/^🤖|^🎨|^🔌|^🛒|^💻|^📡|^🗂|^🎮|^🛠|^📚|^❓|^🧠/g, "")); })
              ) : null,
              item.verificationStatus ? React.createElement("div", { className: "dset-gp-store-sub", style: { marginTop: 4 } }, "验证: " + item.verificationStatus) : null,
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

    /** 右下角统一状态小方块:模型花费 / 余额 / MMS 三合一(点击展开详情)。 */
    function DshStatusBox(props) {
      var call = props.call;
      var st = useDs();
      var open = React.useState(false);
      var setOpen = open[1];
      var feat = useDetFeatures() || {};
      var mmsOn = feat.mms === true;
      var err = st.balanceErr;
      var bal = st.balance;
      var summary = err ? "余额 ?" : (bal ? ("余额 " + dsBalanceText(bal)) : (st.loadingBalance ? "余额 …" : "余额 ?"));
      // 订阅当前模型,按选中模型单价计算。
      var curModel = React.useState(null);
      var setCurModel = curModel[1];
      var sid = typeof props.getSessionId === "function" ? (props.getSessionId() || "") : "";
      React.useEffect(function () {
        var dirs = props.modelDirectories;
        if (dirs && typeof dirs.directoryFor === "function" && sid) {
          var dd = null;
          try { dd = dirs.directoryFor(sid); } catch (e) { return undefined; }
          if (!dd || !dd.store) return undefined;
          var go = function () { try { setCurModel(dd.store.getSnapshot().current || null); } catch (e) {} };
          go();
          var stop = typeof dd.store.subscribe === "function" ? dd.store.subscribe(go) : null;
          return function () { if (typeof stop === "function") { try { stop(); } catch (e) {} } };
        }
        return undefined;
      }, [sid, props.modelDirectories]);
      // 本对话累计花费(估算):dsSessionCost;每 5 秒刷新,保持与余额同步。
      var sessionCost = React.useState(null);
      var setSessionCost = sessionCost[1];
      React.useEffect(function () {
        if (!sid) return;
        var load = function () {
          call("dsSessionCost", { sessionId: sid }).then(function (r) {
            if (r && r.ok) setSessionCost(r);
            else setSessionCost(null);
          }).catch(function () { setSessionCost(null); });
        };
        load();
        var t = setInterval(load, 5 * 1000);
        return function () { clearInterval(t); };
      }, [sid]);
      // 当前模型 × 当前状态(峰/错)的 命中/未命中/输出。
      var priceInfo = null;   // { s, peak, hit, miss, out, modelId }
      try {
        var cur = curModel[0];
        var models = st.price ? st.price.models : null;
        if (models && models.length && cur && cur.provider === "deepseek-official") {
          var rec0 = null;
          for (var i = 0; i < models.length; i++) { if (String(models[i].id) === String(cur.model)) { rec0 = models[i]; break; } }
          if (!rec0) rec0 = models[0];
          var peak = isDsPeakNow();
          var s = st.price.currency === "CNY" ? "¥" : "$";
          priceInfo = {
            s: s, peak: peak,
            hit: peak ? rec0.inputHitPeak : rec0.inputHitOffPeak,
            miss: peak ? rec0.inputMissPeak : rec0.inputMissOffPeak,
            out: peak ? rec0.outputPeak : rec0.outputOffPeak,
            modelId: rec0.id || "",
          };
        }
      } catch (e) { /* 忽略 */ }

      var mmsToggle = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var next = {}; for (var k in feat) next[k] = feat[k];
        next.mms = !mmsOn;
        setDet(next);
        var patch = {}; patch.mms = next.mms;
        call("detFeatureSet", { patch: patch }).then(function (r) { if (r && r.ok && r.features) setDet(r.features, r); else setDet(feat); }).catch(function () { setDet(feat); });
      };

      var card = open[0] ? React.createElement("div", { className: "dset-statusbox-card" },
        React.createElement("div", { className: "dset-statusbox-card-head" },
          React.createElement("span", { className: "dset-statusbox-card-title" }, "DET 状态"),
          React.createElement("span", { className: "dset-statusbox-card-sub" }, bal && bal.fetchedAt ? new Date(bal.fetchedAt).toLocaleTimeString() : ""),
          React.createElement("button", { className: "dset-btn-mini", disabled: st.loadingBalance, onClick: function () { (dsFetch.balance || function () {})(true); } }, "刷新"),
          React.createElement("button", { className: "dset-x", title: "关闭", "aria-label": "关闭", onClick: function () { setOpen(false); } }, "✕")
        ),
        React.createElement("div", { className: "dset-statusbox-card-body" },
          priceInfo ? React.createElement("div", { className: "dset-statusbox-sec" },
            "模型单价 · " + (priceInfo.peak ? "峰值" : "错峰") + " · " + String(priceInfo.modelId || "").replace(/^deepseek-v4-/, "").replace(/-exp$/, "") + " (每 1M tks)"
          ) : null,
          priceInfo ? React.createElement("div", { className: "dset-statusbox-line" },
            React.createElement("span", { className: "lab" }, "输入(命中)"),
            React.createElement("b", null, priceInfo.s + String(priceInfo.hit))
          ) : null,
          priceInfo ? React.createElement("div", { className: "dset-statusbox-line" },
            React.createElement("span", { className: "lab" }, "输入(未命中)"),
            React.createElement("b", null, priceInfo.s + String(priceInfo.miss))
          ) : null,
          priceInfo ? React.createElement("div", { className: "dset-statusbox-line" },
            React.createElement("span", { className: "lab" }, "输出"),
            React.createElement("b", null, priceInfo.s + String(priceInfo.out))
          ) : null,
          React.createElement("div", { className: "dset-statusbox-sec" }, "DeepSeek 余额"),
          bal ? (bal.balances.length ? bal.balances.map(function (b) {
            return React.createElement("div", { key: b.currency, className: "dset-statusbox-line" },
              React.createElement("span", { className: "lab" }, b.currency + " 总计"),
              React.createElement("b", null, (b.currency === "CNY" ? "¥" : "$") + String(b.total)),
              React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 10.5 } }, "赠 " + String(b.granted) + " · 充 " + String(b.toppedUp))
            );
          }) : React.createElement("div", { className: "dset-statusbox-break" }, "无余额记录")) : null,
          bal ? React.createElement("div", { className: "dset-statusbox-line" },
            React.createElement("span", { className: "lab" }, "账户"),
            React.createElement("b", null, bal.isAvailable ? "可用" : "不可用")
          ) : null,
          sessionCost[0] ? React.createElement("div", { className: "dset-statusbox-line" },
            React.createElement("span", { className: "lab" }, "本对话累计花费"),
            React.createElement("b", null, (sessionCost[0].currency === "CNY" ? "¥" : "$") + sessionCost[0].cost),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 10.5 } }, "命 " + sessionCost[0].hit + " · 未命 " + sessionCost[0].miss + " · 出 " + sessionCost[0].out)
          ) : null,
          err ? React.createElement("div", { className: "dset-statusbox-break dset-ds-bal-chip-err" },
            "✗ " + err + (bal ? " (展示上次缓存)" : ""),
            st.balanceHint ? React.createElement("div", null, st.balanceHint) : null
          ) : null,
          React.createElement("div", { className: "dset-statusbox-break" }, "MMS: " + (mmsOn ? "已开启(低难度问题可交给便宜模型)" : "已关闭(模型不感知)"))
        )
      ) : null;

      return React.createElement("div", { className: "dset-statuswrap" },
        card,
        React.createElement("div", { className: "dset-statusbox" },
          React.createElement("div", { className: "dset-statusbox-row" },
            priceInfo ? React.createElement("span", {
              className: "dset-statusbox-pk " + (priceInfo.peak ? "dset-statusbox-pk-peak" : "dset-statusbox-pk-valley"),
              title: priceInfo.peak ? "峰值时段(当前按峰值单价)" : "错峰时段(当前按错峰单价)",
            }, priceInfo.peak ? "峰" : "谷") : null,
            priceInfo ? React.createElement("span", {
              className: "dset-statusbox-chip", title: "单价(每 1M tks · " + (priceInfo.peak ? "峰值" : "错峰") + ")",
              onClick: function () { setOpen(true); },
            }, "输入(命中)" + priceInfo.s + priceInfo.hit + " · 输入(未命中)" + priceInfo.s + priceInfo.miss + " · 输出" + priceInfo.s + priceInfo.out) : React.createElement("span", { className: "dset-statusbox-chip" }, "价格 —")
          ),
          React.createElement("div", { className: "dset-statusbox-row" },
            React.createElement("span", {
              className: "dset-statusbox-chip" + (err ? " dset-ds-bal-chip-err" : ""),
              title: err || "点击查看余额/价格详情",
              onClick: function () { setOpen(!open[0]); },
            }, React.createElement("b", null, summary)),
            sessionCost[0] ? React.createElement("span", {
              className: "dset-statusbox-chip dset-statusbox-em",
              title: "本对话累计花费(估算;含命中/未命中/输出分解)",
              onClick: function () { setOpen(true); },
            }, "· 本对话 " + (sessionCost[0].currency === "CNY" ? "¥" : "$") + sessionCost[0].cost) : null
          ),
          React.createElement("div", { className: "dset-statusbox-row" },
            React.createElement("span", { className: "dset-statusbox-chip", style: { cursor: "default" } }, "MMS"),
            React.createElement("span", {
              className: "dset-switch" + (mmsOn ? " dset-switch-on" : ""),
              title: mmsOn ? "MMS 已开启。点击关闭" : "MMS 已关闭。点击开启(省 token)",
              onClick: mmsToggle,
            }, ""),
            // 开关旁的说明:一句话讲清 MMS 的作用(用户要求)。
            React.createElement("span", { className: "dset-statusbox-chip dset-statusbox-em", style: { cursor: "default" } },
              mmsOn ? "低难度问题交给便宜模型 · 省 token" : "开启后低难度问题走便宜模型 · 省 token")
          )
        )
      );
    }

    // ── 余额栏旁的 MMS 快捷开关:一键开启/关闭 MMS(即时生效) ──────────────
    // ── 输入框工具行右侧:网络权限(5 档)内联控制(模型花费左侧)───────────
    // 模块级共享 store:输入框控件 / 设置页 / Full access 旁一行 三者同步。
    var wpLevels = [];
    var wpCurrent = "";
    var wpLoaded = false;
    var wpListeners = [];
    function setWpState(next) {
      if (next) { if (typeof next.levels !== "undefined") wpLevels = next.levels; if (typeof next.current !== "undefined") wpCurrent = next.current; wpLoaded = true; }
      for (var i = 0; i < wpListeners.length; i++) { try { wpListeners[i](); } catch (e) {} }
    }
    function useWp() {
      var pair = React.useState({ levels: wpLevels, current: wpCurrent, loaded: wpLoaded });
      React.useEffect(function () {
        var onChange = function () { pair[1]({ levels: wpLevels, current: wpCurrent, loaded: wpLoaded }); };
        wpListeners.push(onChange);
        return function () { var i = wpListeners.indexOf(onChange); if (i >= 0) wpListeners.splice(i, 1); };
      }, []);
      return pair[0];
    }

    /** 输入框工具行:网络权限(5 档)内联控件(权限控制右侧、发送按钮前)。 */
    function WebPermInline(props) {
      var call = props.call;
      var st = useWp();
      var open = React.useState(false);
      var setOpen = open[1];
      var busy = React.useState(false);
      var setBusy = busy[1];
      var load = function () {
        call("webPermGet", {}).then(function (r) {
          if (r && r.ok) setWpState({ levels: r.levels || [], current: r.level || "" });
        }).catch(function () {});
      };
      React.useEffect(function () { if (!wpLoaded) load(); }, []);
      var currentRec = null;
      for (var i = 0; i < st.levels.length; i++) { if (st.levels[i].key === st.current) { currentRec = st.levels[i]; break; } }
      var pick = function (key) {
        if (key === st.current || busy[0]) { setOpen(false); return; }
        setBusy(true);
        call("webPermSet", { level: key }).then(function (r) {
          setBusy(false); setOpen(false);
          if (r && r.ok) setWpState({ current: r.level, levels: r.levels || st.levels });
        }).catch(function () { setBusy(false); });
      };
      var label = currentRec ? ("网络 " + currentRec.label) : "网络权限";
      // 产品风格单色线性图标(globe,currentColor)。菜单在控件上方弹出(sideTop)。
      return React.createElement("div", { className: "dset-wp-anchor" },
        React.createElement("div", {
          className: "dset-wp-chip", title: (currentRec ? currentRec.desc : "选择网络访问档位") + "（官方API = DeepSeek 官方搜索 API）",
          onClick: function () { setOpen(!open[0]); },
        },
          React.createElement("span", { className: "dset-wp-chip-ico" },
            React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
              React.createElement("circle", { cx: 8, cy: 8, r: 6.5, stroke: "currentColor", strokeWidth: 1.2 }),
              React.createElement("path", { d: "M1.5 8h13M8 1.5c1.5 1.4 2.3 3.4 2.3 6.5S9.5 13.1 8 14.5C6.5 13.1 5.7 11.1 5.7 8S6.5 2.9 8 1.5z", stroke: "currentColor", strokeWidth: 1.1, strokeLinejoin: "round" })
            )
          ),
          React.createElement("span", { className: "dset-wp-chip-label" }, label)
        ),
        open[0] ? React.createElement("div", { className: "dset-wp-menu" },
          (st.levels || []).map(function (w) {
            return React.createElement("div", { key: w.key, className: "dset-wp-menu-item" + (w.key === st.current ? " dset-wp-menu-on" : ""), onClick: function () { pick(w.key); } },
              React.createElement("span", { className: "dset-wp-rank" }, String(w.rank)),
              React.createElement("div", { className: "dset-wp-main" },
                React.createElement("div", { className: "dset-wp-name" }, w.label),
                React.createElement("div", { className: "dset-wp-sub" }, w.desc)
              ),
              w.key === st.current ? React.createElement("span", { className: "dset-wp-check" }, "✓") : null
            );
          })
        ) : null
      );
    }

    /** 模型选择旁边的单价芯片:输入(缓存未命中)/输出,按当前错峰/峰值择一显示。 */
    /**
     * 跟踪 DSH 右侧 Sidebar 的实际占位,写入 --dset-inset-right 与
     * html[data-dset-sidebar-fullscreen]。
     *
     * 为什么要做:0.1.5 的右侧 Sidebar 是 **push 模式布局列**
     * (data-sidebar-right-panel="push"),展开时占据右边缘并挤压对话区;
     * fullscreen 呈现时更是 position:fixed 覆盖整个视口。而 DET 的工具栏 /
     * 面板 / 状态框原本一律贴右边缘(right:10px / 64px / 14px),会与它重叠,
     * 且 DET 的 z-index(9990+)远高于 Sidebar 的 10,会直接盖在它上面。
     *
     * 做法:测量已展开面板的宽度,换算成 DET 自己的右侧内边距;面板全屏时
     * 整体让位(CSS 里按 html[data-dset-sidebar-fullscreen="1"] 隐藏)。
     * 纯客户端自适应,不改宿主代码。
     */
    var layoutSyncBound = false;
    // 返回 disposer:撤销监听、观察器,并清掉写到 <html> 上的 DET 样式变量/属性。
    function mountLayoutSync() {
      if (layoutSyncBound || typeof document === "undefined") return null;
      layoutSyncBound = true;
      var raf = 0;
      var observed = [];
      var ro = null;
      var mo = null;

      var measure = function () {
        var root = document.documentElement;
        var full = document.querySelector('[data-sidebar-right-panel="fullscreen"][data-sidebar-right-open]');
        var open = document.querySelector('[data-sidebar-right-open]');
        var inset = 0;
        if (!full && open) {
          var r = open.getBoundingClientRect();
          // 仅当该面板确实贴住右边缘且有实际尺寸时才算占位;
          // 动画中途/浮层宿主等情况不计入,避免把 DET 误推走。
          if (r.width > 0 && r.height > 0 && Math.abs(window.innerWidth - r.right) <= 2) {
            inset = Math.round(r.width);
          }
        }
        root.style.setProperty("--dset-inset-right", inset + "px");
        if (full) root.setAttribute("data-dset-sidebar-fullscreen", "1");
        else root.removeAttribute("data-dset-sidebar-fullscreen");

        // 输入框占位:0.1.5 的 composer 比旧版更宽更高,状态框(右下方)会压住
        // 它的发送按钮 —— 状态框子元素是 pointer-events:auto,不只是难看,还会挡点击。
        // 用 composer 自己的锚点(新版提供 data-composer-card / -seat)量出底部占位,
        // 把状态框整体移到输入框上方。
        var composer = document.querySelector("[data-composer-card]") || document.querySelector("[data-composer-seat]");
        var insetBottom = 0;
        if (composer) {
          var cb = composer.getBoundingClientRect();
          if (cb.height > 0 && cb.top < window.innerHeight) {
            insetBottom = Math.max(0, Math.round(window.innerHeight - cb.top) + 8);
          }
        }
        root.style.setProperty("--dset-inset-bottom", insetBottom + "px");

        // 侧栏宽度可被拖动、composer 高度随多行输入变化 → 各自盯住自身尺寸
        var watch = [open, composer];
        var changed = watch.length !== observed.length || watch.some(function (el, i) { return el !== observed[i]; });
        if (changed) {
          if (ro !== null) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
          observed = watch;
          if (typeof ResizeObserver === "function") {
            try {
              ro = new ResizeObserver(schedule);
              watch.forEach(function (el) { if (el) ro.observe(el); });
            } catch (e) { ro = null; }
          }
        }
      };
      var schedule = function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; measure(); });
      };

      window.addEventListener("resize", schedule, { passive: true });
      try {
        // 面板常驻挂载、靠属性切换显隐与呈现方式,故监听这两个属性最可靠。
        // 刻意**不**监听 style/childList:本页流式渲染频繁,那些会过于嘈杂。
        mo = new MutationObserver(schedule);
        mo.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-sidebar-right-open", "data-sidebar-right-panel"],
        });
      } catch (e) { mo = null; /* 观察器不可用时退化为初始化 + resize 同步 */ }
      measure();
      // 总开关关闭时撤销:移除监听/观察器,并清掉写到 <html> 上的 DET 变量与属性。
      return function () {
        layoutSyncBound = false;
        try { window.removeEventListener("resize", schedule); } catch (e) { /* ignore */ }
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try { if (ro) ro.disconnect(); } catch (e) { /* ignore */ }
        mo = null; ro = null;
        try {
          var root = document.documentElement;
          root.style.removeProperty("--dset-inset-right");
          root.style.removeProperty("--dset-inset-bottom");
          root.removeAttribute("data-dset-sidebar-fullscreen");
        } catch (e) { /* ignore */ }
      };
    }

    function apply(ctx) {
      ensureStyles();
      var call = makeCaller(function () { return ctx.get("connection"); });
      // 读入功能开关(持久化在宿主;旧版端点缺失时保持全开,不报错)
      call("detFeatureGet", {}).then(function (r) {
        if (r && r.ok && r.features) setDet(r.features, r);
      }).catch(function () {});
      // 读入当前 MDA 分组模式,驱动共享 store(前端分选器/分组面板/设置页同步)
      call("mdaGet", {}).then(function (r) {
        if (r && r.ok && r.mode) setMdaMode(r.mode);
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

      // ── 总开关(master)运行时装配 ──────────────────────────────────────
      // 开启:注册全部界面注入(工具栏 / 状态框 / 网络权限控件 / VTD / MDA)
      //       + 运行时同步(余额轮询、全局插件同步、ai-auto 自动批准)。
      // 关闭(=「完全原生」):以上全部撤销,DSH 界面恢复产品原样;只留
      //       「设置 → DET 管理器」这一页,以及其中的这个总开关。
      var extRegs = {};    // key -> disposer(界面注入)
      var extOrder = [];
      var extReg = function (key, register) {
        if (Object.prototype.hasOwnProperty.call(extRegs, key)) return;
        extRegs[key] = null;
        extOrder.push(key);
        try { var d = register(); if (typeof d === "function") extRegs[key] = d; } catch (e) { /* 槽不存在 */ }
      };
      var extUnreg = function (key) {
        if (!Object.prototype.hasOwnProperty.call(extRegs, key)) return;
        var d = extRegs[key];
        delete extRegs[key];
        var i = extOrder.indexOf(key);
        if (i >= 0) extOrder.splice(i, 1);
        if (typeof d === "function") { try { d(); } catch (e) { /* ignore */ } }
      };
      var extUnregAll = function () {
        for (var i = extOrder.length - 1; i >= 0; i--) extUnreg(extOrder[i]);
      };
      var runtimeStops = [];
      var runtimeStarted = false;
      var pushStop = function (d, fallback) {
        if (typeof d === "function") runtimeStops.push(d);
        else if (typeof fallback === "function") runtimeStops.push(fallback);
      };
      var pushStopInto = function (arr, d) { if (typeof d === "function") arr.push(d); };
      var stopRuntime = function () {
        for (var i = runtimeStops.length - 1; i >= 0; i--) { try { runtimeStops[i](); } catch (e) { /* ignore */ } }
        runtimeStops = [];
        runtimeStarted = false;
        stopGpSync();
        stopAutoApprove();
      };
      var masterOn = function () { return detFeatures.master !== false; };
      // 装配/拆卸「扩展」部分(与总开关一一对应)。
      var wireExtension = function () {
        wireToolbar();
        wireStatusBox();
        wireWebPermInline();
        wireMdaOverlay();
        wirePluginsSection();
        wireMdaSection();
        wireLayoutSync();
        startRuntime();
      };
      var unwireExtension = function () {
        extUnregAll();
        stopRuntime();
      };
      // 总开关变化(setDet 时调用):开则装配,关则全部撤销。
      masterWiring = function () {
        if (masterOn()) {
          wireExtension();
          if (typeof vtdWiring === "function") vtdWiring();
        } else {
          unwireExtension();
          if (typeof vtdWiring === "function") vtdWiring();
        }
      };
      // 三件套工具栏(shell.overlay)
      var wireToolbar = function () {
        extReg("toolbar", function () {
          return ctx.slots.inject("shell.overlay", function () {
            return ctx.slots.register(
              { name: "shell.overlay", id: "dsh-essential-tools-toolbar" },
              function (props) {
                return React.createElement(Toolbar, Object.assign({ call: call, sessionId: props.sessionId || getSessionId() }, props));
              }
            );
          });
        });
      };
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
      // 运行时同步(余额轮询 / 全局插件同步 / 自动批准):只在总开关开启时启动。
      var startRuntime = function () {
        if (runtimeStarted) return;
        runtimeStarted = true;
        loadDsBalance(false);
        loadDsPrice(false);
        var timer = setInterval(function () { if (dsState.balanceLoaded) loadDsBalance(false); }, 5 * 1000);
        var stopTimer = function () { clearInterval(timer); };
        pushStop(ctx.effect(function () {
          // 余额轮询:每 5 秒(宿主侧 BALANCE_TTL=4s,保证每次都能拿到新值)。
          return stopTimer;
        }, "dsh-essential-tools: balance poller"), stopTimer);
        pushStop(ctx.effect(function () {
          return ctx.on("connection/reset", function () { loadDsBalance(false); loadDsPrice(false); });
        }, "dsh-essential-tools: connection reset"));
        // 每次完成一次对话(turn/end)后也刷新余额, 让余量及时反映最新消耗。
        pushStop(ctx.effect(function () {
          return ctx.on("session/event", function (session, event) {
            if (event && event.type === "turn/end") loadDsBalance(false);
          });
        }, "dsh-essential-tools: turn end refresh"));
        startGpSync();
        startAutoApprove();
      };
      // 右下角统一状态小方块:模型花费 / 余额 / MMS 三合一(点击展开详情)。
      var wireStatusBox = function () {
        extReg("statusbox", function () {
          return ctx.slots.inject("shell.overlay", function () {
            return ctx.slots.register(
              { name: "shell.overlay", id: "dsh-statusbox", order: 300 },
              function (props) {
                var dirs = null;
                try { dirs = ctx.get("modelDirectories"); } catch (e) { /* 忽略 */ }
                return React.createElement(DshStatusBox, Object.assign({ call: call, getSessionId: getSessionId, modelDirectories: dirs }, props));
              }
            );
          });
        });
      };
      // 网络权限(5 档)内联控件:放输入框工具行「左侧」(与访问模式/权限控制同侧、向左贴合),样式对齐 modes 组。
      var wireWebPermInline = function () {
        extReg("webperm", function () {
          return ctx.slots.inject("conversation.input.left", function () {
            return ctx.slots.register(
              { name: "conversation.input.left", id: "dsh-web-permission", order: 5 },
              function (props) {
                return React.createElement(WebPermInline, Object.assign({ call: call }, props));
              }
            );
          });
        });
      };
      // VTD 对话树视图 + 消息操作:按 DET 开关 装载/卸载(列表订阅实时响应)
      var vtdViewDisposer = null;
      // 消息级操作槽在新旧宿主上**名字不同**:
      //   ≤0.1.1-rc.2 : conversation.chat.user-actions
      //   ≥0.1.5      : conversation.chat.assistant-actions（renderSlot 传入 { messageId },
      //                 并被原样传进原生 MessageIconActions 的 extraActions)
      // 挂载期无法先问宿主版本(注入发生在 apply 阶段,早于 detFeatureGet 返回),
      // 且注入不存在的槽只需一个 catch —— 故两个都注入:本宿主不认识的那个
      // 要么被槽注册器拒绝,要么永远不被渲染,代价可忽略。
      var MSG_ACTION_SLOTS = [
        { name: "conversation.chat.assistant-actions", id: "dsh-msg-actions-aa", mode: "assistant" },
        { name: "conversation.chat.user-actions", id: "dsh-msg-actions-ua", mode: "user" },
      ];
      var userActDisposers = [];
      var registerVtdView = function () {
        if (vtdViewDisposer !== null) return;
        try {
          vtdViewDisposer = ctx.slots.register({
            name: "conversation.view",
            id: "vtd-tree",
            order: 15,
            label: function () { return "VTD 对话"; },
          }, function (props) {
            // ⚠ 0.1.5 的 conversation.view 只传 { viewRequest, openView, completeViewRequest },
            //   **不再传 sessionId**(旧版有)。缺它会拿到 undefined,树视图无法加载数据。
            //   兜底写在 Object.assign 之后:若 props 里存在同名键且值为 undefined,
            //   放进 target 后再赋才不会被覆盖回去。
            var vp = Object.assign({ call: call }, props);
            if (!vp.sessionId) vp.sessionId = getSessionId();
            return React.createElement(VtdView, vp);
          });
        } catch (e) { /* 槽尚未声明,由下方 inject 兜底登记 */ }
      };
      var registerUserActions = function () {
        if (userActDisposers.length > 0) return;
        for (var si = 0; si < MSG_ACTION_SLOTS.length; si++) {
          var slotDef = MSG_ACTION_SLOTS[si];
          try {
            var dis = ctx.slots.register({
              name: slotDef.name,
              id: slotDef.id,
              order: 5,
            }, (function (def) {
              // 用 IIFE 捕获 def:for 的 var si 是函数级作用域,直接在回调里读
              // MSG_ACTION_SLOTS[si] 会让所有槽都拿到最后一次循环的值。
              return function (props) {
                var up = Object.assign({ call: call }, props);
                // 新槽只传 { messageId },旧槽还带 sessionId;UserActions 依赖它。
                if (!up.sessionId) up.sessionId = getSessionId();
                up.mode = def.mode;
                return React.createElement(UserActions, up);
              };
            })(slotDef));
            if (dis) userActDisposers.push(dis);
          } catch (e) { /* 该槽在本宿主不存在 */ }
        }
      };
      var disposeUserActions = function () {
        for (var i = 0; i < userActDisposers.length; i++) { try { userActDisposers[i](); } catch (e) { /* ignore */ } }
        userActDisposers = [];
      };
      vtdWiring = function () {
        if (masterOn() && detFeatures.vtd === true) {
          registerVtdView();
          registerUserActions();
        } else {
          if (vtdViewDisposer !== null) { var d = vtdViewDisposer; vtdViewDisposer = null; d(); }
          disposeUserActions();
        }
      };
      ctx.slots.inject("conversation.view", function () {
        if (masterOn() && detFeatures.vtd && vtdViewDisposer === null) registerVtdView();
        return function () { if (vtdViewDisposer !== null) { var d = vtdViewDisposer; vtdViewDisposer = null; d(); } };
      });
      for (var mi = 0; mi < MSG_ACTION_SLOTS.length; mi++) {
        try {
          ctx.slots.inject(MSG_ACTION_SLOTS[mi].name, function () {
            if (masterOn() && detFeatures.vtd && userActDisposers.length === 0) registerUserActions();
            return function () { disposeUserActions(); };
          });
        } catch (e) { /* 该槽在本宿主不存在 */ }
      }
      // 左侧栏底部:MDA 分组入口(加法,不顶掉原生会话列表)
      // 覆盖主侧边栏的可关闭 MDA 侧栏浮层(shell.overlay 为附加 list 槽,按模式自动显示,关闭时渲染 null)
      var wireMdaOverlay = function () {
        extReg("mda-overlay", function () {
          return ctx.slots.inject("shell.overlay", function () {
            return ctx.slots.register({ name: "shell.overlay", id: "dsh-mda-overlay", order: 150 }, function (props) {
              var mdaProps = Object.assign({ call: call }, props);
              if (!mdaProps.sessionId) mdaProps.sessionId = getSessionId();
              mdaProps.openSession = function (id) { try { if (ctx && ctx.sessions && typeof ctx.sessions.open === "function") ctx.sessions.open(id); } catch (e) {} };
              mdaProps.onRename = function (id, title) { try { var bind = ctx.sessions.binding(id); var ses = bind && bind.session; if (ses && typeof ses.rename === "function") ses.rename(title); } catch (e) {} };
              mdaProps.onFork = function (id) { try { var p = ctx.sessions.fork({ sessionId: id, increaseTitle: true }); if (p && p.then) { p.then(function (childId) { ctx.sessions.open(childId); }).catch(function () {}); } } catch (e) {} };
              mdaProps.onArchive = function (id) { try { if (ctx.workspaces && typeof ctx.workspaces.archiveSession === "function") ctx.workspaces.archiveSession(id); } catch (e) {} };
              return React.createElement(MdaSidebarOverlay, mdaProps);
            });
          });
        });
      };
      // [已清理] 网络权限不再放「通用设置(设置→常规 Full access 旁)」—— 已移除该遗留入口。
      // 保留:输入框内联控件(conversation.input.left)+ DET 管理器「网络调用权限」块。
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
      // 设置页:全局插件管理(独立条目;总开关关闭时不注册,仅留 DET 管理器)
      var wirePluginsSection = function () {
        extReg("settings-plugins", function () {
          return ctx.slots.inject("settings.section", function () {
            return ctx.slots.register({
              name: "settings.section",
              id: "dsh-global-plugins",
              order: 89,
              label: function () { return "全局插件管理"; },
            }, function (props) {
              return React.createElement(GlobalPluginsSection, Object.assign({ call: call, getSessionId: getSessionId, activate: gpActivateSession }, props));
            });
          });
        });
      };
      // 设置页:MDA 分组(仿照「外观」:三选一单选 + 分支模型区域;总开关关闭时不注册)
      var wireMdaSection = function () {
        extReg("settings-mda", function () {
          return ctx.slots.inject("settings.section", function () {
            return ctx.slots.register({
              name: "settings.section",
              id: "dsh-mda",
              order: 88,
              label: function () { return "MDA 分组"; },
            }, function (props) {
              return React.createElement(MdaSection, Object.assign({ call: call }, props));
            });
          });
        });
      };
      // 定位/占位同步:会改 <html> 的 CSS 变量与属性(对 DSH 页面的改动),
      // 因此也归总开关管 —— 关闭时撤销并清干净。
      var wireLayoutSync = function () {
        extReg("layout-sync", function () { return mountLayoutSync(); });
      };
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
      // 会话切换时同步当前会话;连接重置后强制重试。只在总开关开启时订阅。
      var gpSyncStops = [];
      var startGpSync = function () {
        if (gpSyncStops.length > 0) return;
        try {
          if (ctx.sessions.list && typeof ctx.sessions.list.subscribe === "function") {
            var offList = ctx.sessions.list.subscribe(function () { gpSync(false); });
            if (typeof offList === "function") gpSyncStops.push(offList);
          }
        } catch (e) { /* 忽略 */ }
        pushStopInto(gpSyncStops, ctx.effect(function () {
          return ctx.on("connection/reset", function () { gpSync(true); });
        }, "dsh-essential-tools: gp sync on reset"));
        gpSync(true);
      };
      var stopGpSync = function () {
        for (var i = gpSyncStops.length - 1; i >= 0; i--) { try { gpSyncStops[i](); } catch (e) { /* ignore */ } }
        gpSyncStops = [];
      };
      // ── ai-auto 自动批准:子动态 Cordis 审批请求,若为 DET 全局插件且档位 ai-auto → 自动批准 ──
      var gpApproved = {};
      var gpRemote = null;
      try { gpRemote = ctx.remote; } catch (e) { /* 忽略 */ }
      var autoApproveStop = null;
      var startAutoApprove = function () {
        if (autoApproveStop !== null) return;
        if (!gpRemote || typeof gpRemote.$on !== "function") return;
        var off = gpRemote.$on("cordis/request-run", function (req) {
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
        autoApproveStop = typeof off === "function" ? off : null;
        if (autoApproveStop === null) autoApproveStop = function () { /* 无 disposer,无法解除 */ };
      };
      var stopAutoApprove = function () {
        if (autoApproveStop === null) return;
        try { autoApproveStop(); } catch (e) { /* ignore */ }
        autoApproveStop = null;
      };
      // 首次装配(含界面注入 + 运行时同步);detFeatureGet 返回后若总开关为关,
      // masterWiring 会把上面这一切原样撤销。
      wireExtension();
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    exports.inject = ["slots", "sessions", "remote"];
    return module.exports;
  },
});

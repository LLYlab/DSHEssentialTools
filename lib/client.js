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
      // DET 管理器开关
      '.dset-switch-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);cursor:pointer;margin:0}' +
      '.dset-switch-row:hover{border-color:var(--dsw-alias-brand-primary)}' +
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
      '.dset-vtd-meta{margin-top:4px}';

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
      var feat = useDetFeatures();
      var feats = feat === null ? { file: true, run: true, ver: true } : { file: feat.file === true, run: feat.run === true, ver: feat.ver === true };

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
        ) : null,
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
        feats.ver && panel[0] === "ver" ? React.createElement(VerPanel, { call: call, sessionId: sessionId, onClose: function () { setPanel(null); } }) : null
      );
    }

    // ── 设置页:DET 管理器(功能开关 + 侧边栏数据自检 + VTD 调试)─────────────
    function DetManagerSection(props) {
      var call = props.call;
      var feat = useDetFeatures();
      var feats = feat === null ? { file: true, run: true, ver: true, vtd: true } : feat;
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
          toggleRow("vtd", "VTD", "VTD 对话标签 + 编辑/重试/<N> 消息操作")
        ),
        msg[0] ? React.createElement("div", { className: "dset-msg " + (msg[0].ok ? "dset-msg-ok" : "dset-msg-err") }, msg[0].text) : null,
        React.createElement("h3", { className: "dset-sec-title" }, "会话侧边栏数据(登记簿)"),
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
        ),
        React.createElement("h3", { className: "dset-sec-title" }, "VTD 调试"),
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
      );
    }

    // ── DET 功能开关(模块级 store):装载/卸载 文件视图/运行按钮/版本控制/VTD ──
    var detFeatures = { file: true, run: true, ver: true, vtd: true };
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

    // ── 插件主体 ───────────────────────────────────────────────────────────
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
        return cur ? cur.id : undefined;
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
    }

    exports.apply = apply;
    exports.name = "dsh-essential-tools";
    exports.inject = ["slots", "sessions"];
    return module.exports;
  },
});

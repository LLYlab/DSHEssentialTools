// DSH 浏览器控制 — background service worker
// - 与 DSH 宿主本地 WebSocket(127.0.0.1:9123)保持连接
// - 从 chrome.storage.local 读取四档模式:off / read / write / on
// - 收到宿主指令后,对「DSH 指定的 tab」执行页面操作,并把结果回传
// 安全:
//   - 只连本机 127.0.0.1:9123;不访问第三方站点
//   - 模式门禁在这里强制:read(只读)拒写;write(只写)不回读页面内容;off 全部拒绝
//   - 只操作宿主在指令里显式给出的 tabId;不主动遍历/控制其它标签页

const HOST = "ws://127.0.0.1:9123";
const RECONNECT_MIN = 1500;
const RECONNECT_MAX = 15000;

// ── 四档模式 ──────────────────────────────────────────────────────────
const MODES = ["off", "read", "write", "on"];
let mode = "off";

async function loadMode() {
  try {
    const s = await chrome.storage.local.get("dshBrowserMode");
    const m = s && s.dshBrowserMode;
    mode = MODES.indexOf(m) >= 0 ? m : "off";
    setBadge(mode);
  } catch (e) { mode = MODES.includes(mode) ? mode : "off"; }
  return mode;
}

async function setMode(next) {
  if (MODES.indexOf(next) < 0) return mode;
  mode = next;
  try {
    await chrome.storage.local.set({ dshBrowserMode: mode });
    setBadge(mode);
    // 通知 DSH 宿主模式已变(若已连接)。
    notify({ type: "mode", mode });
  } catch (e) {}
  return mode;
}

function setBadge(m) {
  try {
    const label = m === "off" ? "OFF" : m === "read" ? "R" : m === "write" ? "W" : "ON";
    chrome.action.setBadgeBackgroundColor({ color: m === "off" ? "#8a8f98" : m === "read" ? "#2563eb" : m === "write" ? "#c9a227" : "#22a06b" });
    chrome.action.setBadgeText({ text: label });
  } catch (e) {}
}

// ── WebSocket:与 DSH 宿主双向通信 ────────────────────────────────────
let ws = null;
let reconnectTimer = null;
let reconnectDelay = RECONNECT_MIN;
let pending = new Map(); // id -> {resolve,reject}
let msgSeq = 0;

function connect() {
  try {
    ws = new WebSocket(HOST);
  } catch (e) { scheduleReconnect(); return; }

  ws.onopen = () => {
    reconnectDelay = RECONNECT_MIN;
    // 握手:告知宿主身份与当前模式。
    sendRaw({ type: "hello", version: 1, mode, extension: "dsh-essential-tools" });
  };
  ws.onmessage = (ev) => {
    let data = ev.data;
    try { if (typeof data !== "string") data = String(data); } catch (e) {}
    let msg = null;
    try { msg = JSON.parse(data); } catch (e) { return; }
    handleHostMessage(msg);
  };
  ws.onclose = () => { ws = null; scheduleReconnect(); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
}

function sendRaw(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
}

function notify(obj) {
  if (obj && obj.id === undefined) { obj.id = "n" + (++msgSeq) + "-" + Date.now(); }
  return sendRaw(obj);
}

function reply(id, ok, result) {
  return sendRaw({ id, ok, result });
}

// ── 宿主指令 → 页面执行 ───────────────────────────────────────────────
async function handleHostMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  // 命令:带 id → 执行后回执。
  if (msg.id && msg.cmd) {
    const r = await execute(msg);
    reply(msg.id, r.ok, r.result);
    return;
  }
  // 无 id 的查询型(如 status/ping)也回执。
  if (msg.type === "ping") { sendRaw({ type: "pong", mode, ts: Date.now() }); return; }
  if (msg.type === "getMode") { sendRaw({ type: "mode", mode }); return; }
  if (msg.type === "setMode" && msg.mode) { setMode(msg.mode); return; }
  if (msg.type === "hello") { /* 宿主侧握手 */ }
}

/** 执行一条命令;按当前模式 + 命令类别做门禁。 */
async function execute(cmd) {
  const c = cmd.cmd;                 // read_text | read_dom | screenshot | get_url | get_title | list_tabs | navigate | click | fill | run
  const tabId = typeof cmd.tabId === "number" ? cmd.tabId : null;
  const modeNow = await loadMode();

  // 模式门禁
  if (modeNow === "off") return { ok: false, result: { error: "ext-mode-off" } };
  const isRead = ["read_text", "read_dom", "screenshot", "get_url", "get_title", "list_tabs", "insite_search", "inspect"].indexOf(c) >= 0;
  const isWrite = ["navigate", "click", "fill", "run", "human_search", "act", "focus_tab"].indexOf(c) >= 0;
  if (isRead && modeNow === "write") return { ok: false, result: { error: "ext-read-denied-in-write-mode" } };
  if (isWrite && modeNow === "read") return { ok: false, result: { error: "ext-write-denied-in-read-mode" } };
  // 只写模式:执行但不回读页面内容(只回执行结果/错误码)。

  try {
    if (c === "list_tabs") {
      const tabs = await queryTabs();
      return { ok: true, result: { tabs } };
    }
    if (c === "human_search") {
      const r = await doHumanSearch(cmd, tabId);
      if (modeNow === "write") return { ok: true, result: { note: "write-mode-no-readback", ok: r.ok } };
      return r;
    }
    if (c === "insite_search") {
      const r = await doInsiteSearch(cmd);
      if (modeNow === "write") return { ok: true, result: { note: "write-mode-no-readback", ok: r.ok } };
      return r;
    }
    if (c === "act") {
      const r = await doAct(cmd, tabId);
      if (modeNow === "write") return { ok: true, result: { note: "write-mode-no-readback", ok: r.ok } };
      return r;
    }
    if (c === "inspect") {
      const r = await doInspect(cmd, tabId);
      if (modeNow === "write") return { ok: true, result: { note: "write-mode-no-readback", ok: r.ok } };
      return r;
    }
    if (c === "focus_tab") {
      return await doFocusTab(cmd, tabId);
    }
    if (c === "get_url" || c === "get_title" || c === "read_text" || c === "read_dom" || c === "screenshot") {
      const res = await doRead(c, cmd, tabId);
      // 只写模式即使误调用读,也不回传内容。
      if (modeNow === "write") return { ok: true, result: { note: "write-mode-no-readback", ok: res.ok } };
      return res;
    }
    // 写类
    const res = await doWrite(c, cmd, tabId);
    return res;
  } catch (e) {
    return { ok: false, result: { error: String(e && e.message ? e.message : e) } };
  }
}

/** 枚举浏览器全部标签页(只读):id/标题/地址/是否激活等。 */
function queryTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) { resolve({ error: err.message || "查询标签页失败" }); return; }
      const list = (tabs || []).map((t) => ({
        id: t.id, title: t.title || "", url: t.url || "",
        active: !!t.active, pinned: !!t.pinned, index: t.index, windowId: t.windowId, status: t.status || "",
      }));
      resolve(list);
    });
  });
}

/** 构造搜索引擎 URL。 */
function searchUrlFor(engine, q) {
  const e = String(engine || "bing").toLowerCase();
  const qq = encodeURIComponent(String(q || ""));
  if (e === "google") return "https://www.google.com/search?q=" + qq;
  if (e === "brave") return "https://search.brave.com/search?q=" + qq;
  if (e === "duckduckgo") return "https://duckduckgo.com/?q=" + qq;
  if (e === "bing") return "https://www.bing.com/search?q=" + qq;
  return null;
}

/** 导航到 url 并等待加载完成(timeout 兜底)。 */
function navigateAndWait(tabId, url, timeoutMs) {
  return new Promise((resolve) => {
    const limit = timeoutMs || 12000;
    let listener = null;
    const done = (tab) => { try { if (listener) chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer); } catch (e) {} resolve(tab); };
    const timer = setTimeout(() => done(tabId), limit);
    try {
      chrome.tabs.update(tabId, { url }, () => {
        listener = (updatedTabId, changeInfo, tab) => {
          if (updatedTabId === tabId && changeInfo && changeInfo.status === "complete") done(tab);
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    } catch (e) { done(tabId); }
  });
}

/** 模仿用户在浏览器里用搜索站搜索。 */
async function doHumanSearch(cmd, tabId) {
  const q = String(cmd.query || "");
  if (!q) return { ok: false, result: { error: "缺少搜索词 query" } };
  const url = searchUrlFor(cmd.engine || "bing", q);
  if (!url) return { ok: false, result: { error: "未知搜索引擎: " + String(cmd.engine) + "(可用 bing/google/brave/duckduckgo)" } };
  const tab = await ensureTab(tabId);
  await navigateAndWait(tab.id, url, 12000).catch(() => {});
  let out = "";
  try { out = await injectScript(tab.id, "read_text", {}); } catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
  const text = String(out || "").slice(0, 20000);
  return { ok: true, result: { url: url, tabId: tab.id, text: text } };
}

/** 在全部标签页里搜索关键词。 */
async function doInsiteSearch(cmd) {
  const q = String(cmd.query || "");
  if (!q) return { ok: false, result: { error: "缺少搜索词 query" } };
  const all = await queryTabs();
  if (!Array.isArray(all)) return { ok: false, result: { error: (all && all.error) || "查询标签页失败" } };
  const SKIP = /^(chrome|edge|chrome-extension|about|devtools):/i;
  const matches = [];
  for (const t of all) {
    if (!t.url || SKIP.test(t.url)) continue;
    try {
      const res = await injectScript(t.id, "search_text", { query: q });
      if (typeof res === "string" && res.indexOf("FOUND:") === 0) {
        matches.push({ id: t.id, title: t.title || "", url: t.url || "", snippet: res.slice(6).slice(0, 400) });
      }
    } catch (e) { /* 无权限/受限标签页跳过 */ }
  }
  return { ok: true, result: { query: q, count: matches.length, matches: matches } };
}

/** 代码性质的人类化网页操作(click/type/scroll/press/hover/focus/clear/select)。 */
async function doAct(cmd, tabId) {
  const kind = String(cmd.kind || "");
  if (!kind) return { ok: false, result: { error: "缺少操作类型 kind" } };
  const tab = await ensureTab(tabId);
  const payload = { kind: kind, sel: cmd.selector || "", text: cmd.text, key: cmd.key, scroll: cmd.scroll };
  let out = "";
  try { out = await injectSmart(tab.id, "page_act", payload); } catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
  if (out.indexOf("ERR:") === 0) return { ok: false, result: { error: out.slice(4) } };
  return { ok: true, result: { action: kind, ok: true } };
}

/** 读取页面当前代码/DOM/元素/指标。 */
async function doInspect(cmd, tabId) {
  const what = String(cmd.what || "text");
  const tab = await ensureTab(tabId);
  // url / title 直接取自标签页元数据(静默,无需注入,任何标签页都能读)。
  if (what === "url") return { ok: true, result: { url: tab.url || "", title: tab.title || "", what: what, data: String(tab.url || "") } };
  if (what === "title") return { ok: true, result: { url: tab.url || "", title: tab.title || "", what: what, data: String(tab.title || "") } };
  let out = "";
  try { out = await injectSmart(tab.id, "inspect", { what: what, selector: cmd.selector || "" }); } catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
  if (out.indexOf("ERR:") === 0) return { ok: false, result: { error: out.slice(4) } };
  return { ok: true, result: { url: tab.url || "", title: tab.title || "", what: what, data: out } };
}

/** 聚焦指定标签页:激活该标签页并恢复/聚焦其所在窗口。 */
async function doFocusTab(cmd, tabId) {
  const tid = typeof tabId === "number" ? tabId : null;
  if (tid === null) return { ok: false, result: { error: "缺少 tabId" } };
  try {
    const tab = await new Promise((resolve, reject) => {
      chrome.tabs.get(tid, (t) => { const e = chrome.runtime.lastError; (e || !t) ? reject(new Error(e && e.message || "未找到标签页")) : resolve(t); });
    });
    await new Promise((resolve) => { try { chrome.tabs.update(tid, { active: true }, () => resolve()); } catch (e) { resolve(); } });
    if (tab.windowId != null) {
      await new Promise((resolve) => { try { chrome.windows.update(tab.windowId, { focused: true, state: "normal" }, () => resolve()); } catch (e) { resolve(); } });
    }
    return { ok: true, result: { focused: true, tabId: tid, windowId: tab.windowId } };
  } catch (e) {
    return { ok: false, result: { error: String(e && e.message ? e.message : e) } };
  }
}

function ensureTab(tabId) {
  return new Promise((resolve, reject) => {
    const finish = (tab) => {
      const err = chrome.runtime.lastError;
      if (err || !tab) { reject(new Error(err && err.message ? err.message : "未找到标签页")); return; }
      // 静默:不激活标签页、不聚焦/恢复窗口,避免改变用户当前的页面/窗口状态。
      resolve(tab);
    };
    // 显式 tabId → 直接按 id 取;否则取「当前活动标签页」。
    if (typeof tabId === "number" && tabId > 0) { chrome.tabs.get(tabId, finish); return; }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) { reject(new Error(err.message || "查询标签页失败")); return; }
      const tab = tabs && tabs[0];
      if (!tab) { reject(new Error("未找到活动标签页")); return; }
      finish(tab);
    });
  });
}

function injectScript(tabId, kind, payload, timeoutMs) {
  // 在页面 ISOLATED 世界执行;不依赖 eval/new Function(规避 MV3 世界 CSP 限制)。
  const p = chrome.scripting.executeScript({
    target: { tabId },
    func: (k, p) => {
      let out = "";
      try {
        if (k === "read_text") { out = document.body ? document.body.innerText : ""; }
        else if (k === "read_dom") { out = document.documentElement ? document.documentElement.outerHTML : ""; }
        else if (k === "click") {
          const el = p && p.sel ? document.querySelector(String(p.sel)) : null;
          if (!el) out = "ERR:no-element";
          else { el.click(); out = "clicked"; }
        }
        else if (k === "fill") {
          const el = p && p.sel ? document.querySelector(String(p.sel)) : null;
          if (!el) out = "ERR:no-element";
          else {
            el.value = String(p && p.val !== undefined ? p.val : "");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            out = "filled";
          }
        }
        else if (k === "run") {
          // 任意外部脚本:try eval(受页面/扩展 CSP 限制,失败则报错)。
          out = "" + eval(String(p && p.code || ""));
        }
        else if (k === "search_text") {
          const qr = String((p && p.query) || "").toLowerCase();
          const body = document.body ? document.body.innerText : "";
          const html = document.documentElement ? document.documentElement.outerHTML : "";
          const hay = (body + "\n" + html).toLowerCase();
          const idx = hay.indexOf(qr);
          if (idx < 0) out = "";
          else out = "FOUND:" + hay.slice(Math.max(0, idx - 120), idx + qr.length + 120);
        }
        else if (k === "page_act") {
          const kind = p && p.kind;
          const sel = p && p.sel ? String(p.sel) : "";
          const getEl = () => sel ? document.querySelector(sel) : null;
          if (kind === "click") { const el = getEl(); if (!el) out = "ERR:no-element"; else { el.click(); out = "clicked"; } }
          else if (kind === "focus") { const el = getEl(); if (!el) out = "ERR:no-element"; else { el.focus(); out = "focused"; } }
          else if (kind === "type") { const el = getEl(); if (!el) out = "ERR:no-element"; else { el.value = String(p.text !== undefined ? p.text : ""); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); out = "typed"; } }
          else if (kind === "clear") { const el = getEl(); if (!el) out = "ERR:no-element"; else { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); out = "cleared"; } }
          else if (kind === "press") { const key = String(p.key || "Enter"); document.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true })); document.dispatchEvent(new KeyboardEvent("keyup", { key: key, bubbles: true })); out = "pressed"; }
          else if (kind === "scroll") { const sc = String(p.scroll || "bottom"); if (sc === "top") window.scrollTo(0, 0); else if (sc === "bottom") window.scrollTo(0, document.body.scrollHeight || 0); else { const n = parseInt(sc, 10); if (!isNaN(n)) window.scrollBy(0, n); } out = "scrolled"; }
          else if (kind === "hover") { const el = getEl(); if (!el) out = "ERR:no-element"; else { el.dispatchEvent(new Event("mouseover", { bubbles: true })); out = "hovered"; } }
          else if (kind === "select") { const el = getEl(); if (!el) out = "ERR:no-element"; else { if (p.text !== undefined) el.value = String(p.text); el.dispatchEvent(new Event("change", { bubbles: true })); out = "selected"; } }
          else out = "ERR:unknown-kind";
        }
        else if (k === "inspect") {
          const what = String((p && p.what) || "text");
          if (what === "title") out = document.title || "";
          else if (what === "url") out = String(location.href || "");
          else if (what === "text") out = document.body ? document.body.innerText : "";
          else if (what === "html") out = document.documentElement ? document.documentElement.outerHTML : "";
          else if (what === "elements") {
            const q = (p && p.selector) ? String(p.selector) : "*";
            const els = document.querySelectorAll(q);
            const list = [];
            for (let i = 0; i < Math.min(els.length, 200); i++) {
              const e = els[i];
              const cls = (typeof e.className === "string" ? e.className : (e.className && e.className.baseVal || "")).trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
              list.push((e.tagName || "").toLowerCase() + "#" + (e.id || "") + (cls ? "." + cls : ""));
            }
            out = "ELEMENTS:" + JSON.stringify(list);
          }
          else if (what === "metrics") out = "METRICS:" + JSON.stringify({ title: document.title || "", url: String(location.href || ""), readyState: document.readyState, bodyTextLen: document.body ? document.body.innerText.length : 0, domCount: document.getElementsByTagName("*").length });
          else out = "ERR:unknown-what";
        }
      } catch (e) { out = "ERR:" + (e && e.message ? e.message : String(e)); }
      return out;
    },
    args: [kind, payload || {}],
  }).then((res) => {
    const r = res && res[0] ? res[0].result : undefined;
    return typeof r === "string" ? r : String(r || "");
  });
  // 静默读取:注入若因后台节流超过一定时间未返回,快速报超时而非一直挂起(不影响用户页面)。
  return Promise.race([p, new Promise((resolve) => setTimeout(() => resolve("ERR:inject-timeout"), timeoutMs || 8000))]);
}

/** 为读取被节流的后台窗口标签页:临时激活其窗口/标签页,注入后立即恢复原前台焦点(激活完全静默)。 */
function readWithActivation(tabId, kind, payload) {
  return new Promise((resolve) => {
    chrome.windows.getLastFocused({}, (prevWin) => {
      const prevWindowId = prevWin ? prevWin.id : null;
      chrome.tabs.query({ active: true, windowId: prevWindowId }, (prevTabs) => {
        const prevTabId = prevTabs && prevTabs[0] ? prevTabs[0].id : null;
        const restore = () => {
          if (prevTabId != null) { try { chrome.tabs.update(prevTabId, { active: true }, () => {}); } catch (e) {} }
          if (prevWindowId != null) { try { chrome.windows.update(prevWindowId, { focused: true, state: "normal" }, () => {}); } catch (e) {} }
        };
        chrome.tabs.get(tabId, (t) => {
          const err = chrome.runtime.lastError;
          if (err || !t) { restore(); resolve("ERR:no-tab"); return; }
          const doActivate = () => new Promise((r) => { try { chrome.tabs.update(tabId, { active: true }, () => r()); } catch (e) { r(); } });
          const doFocus = () => new Promise((r) => { if (t.windowId != null) { try { chrome.windows.update(t.windowId, { focused: true, state: "normal" }, () => r()); } catch (e) { r(); } } else { r(); } });
          doActivate().then(doFocus).then(() => {
            setTimeout(() => {
              Promise.resolve(injectScript(tabId, kind, payload, 10000)).then((out) => { restore(); resolve(out); }).catch(() => { restore(); resolve("ERR:inject-failed"); });
            }, 250);
          }).catch(() => { restore(); resolve("ERR:activate-failed"); });
        });
      });
    });
  });
}

/** 智能注入:先静默注入;若超时(后台节流),临时激活 + 读后恢复(静默),再次注入。 */
async function injectSmart(tabId, kind, payload) {
  let out = await injectScript(tabId, kind, payload, 6000);
  if (out === "ERR:inject-timeout") {
    out = await readWithActivation(tabId, kind, payload);
  }
  return out;
}

async function doRead(c, cmd, tabId) {
  const tab = await ensureTab(tabId);
  const url = tab.url || "";
  const title = tab.title || "";
  if (c === "get_url") return { ok: true, result: { url } };
  if (c === "get_title") return { ok: true, result: { title } };
  if (c === "screenshot") return screenshot(tab.id);
  let out = "";
  try {
    out = await injectSmart(tab.id, c === "read_dom" ? "read_dom" : "read_text", {});
  } catch (e) {
    return { ok: false, result: { error: String(e && e.message ? e.message : e) } };
  }
  const max = Math.max(1, Math.min(200000, cmd.maxLen ? Number(cmd.maxLen) : 20000));
  const text = (out || "").slice(0, max);
  return { ok: true, result: { text, url, title, truncated: out.length > max } };
}

function screenshot(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      const err = chrome.runtime.lastError;
      if (err) { resolve({ ok: false, result: { error: err.message || "截图失败" } }); return; }
      resolve({ ok: true, result: { dataUrl } });
    });
  }).catch((e) => ({ ok: false, result: { error: String(e && e.message ? e.message : e) } }));
}

async function doWrite(c, cmd, tabId) {
  const tab = await ensureTab(tabId);
  if (c === "navigate") {
    const url = String(cmd.url || "");
    if (!/^(https?|file):/i.test(url)) return { ok: false, result: { error: "仅支持 http/https/file 导航" } };
    await chrome.tabs.update(tab.id, { url });
    return { ok: true, result: { ok: true, url } };
  }
  if (c === "run") {
    // 任意外部脚本(高危,仅 on 模式并由 DET 审批后放行)。执行但不回读内容。
    try { await injectScript(tab.id, "run", { code: String(cmd.code || "") }); }
    catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
    return { ok: true, result: { ok: true } };
  }
  const kind = c === "click" ? "click" : "fill";
  const payload = c === "click" ? { sel: String(cmd.selector || "") } : { sel: String(cmd.selector || ""), val: cmd.value !== undefined ? String(cmd.value) : "" };
  let out = "";
  try { out = await injectScript(tab.id, kind, payload); }
  catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
  if (out.indexOf("ERR:") === 0) return { ok: false, result: { error: out.slice(4) } };
  return { ok: true, result: { ok: true } };
}

// ── 模块顶层:启动 ────────────────────────────────────────────────────
// MV3 通病:service worker 空闲约 30s 即被挂起,WebSocket 随之断开,
// 且挂起期间 setTimeout/scheduleReconnect 不再触发 → 桥侧 count 掉到 0。
// 解决:用周期性 chrome.alarms 唤醒 SW 并强制重连,保证连接稳定。
function ensureConnected() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  connect();
}
loadMode().then((m) => setBadge(m));
connect();
try {
  chrome.alarms.create("dsh-bridge", { delayInMinutes: 0.5, periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === "dsh-bridge") {
      loadMode();
      ensureConnected();
    }
  });
} catch (e) { /* 忽略:若是打包扩展导致周期受限,不影响手动重连 */ }

// 供 options/popup 调用的简单 RPC(通过 storage 变更事件也可)。
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getMode") { loadMode().then((m) => sendResponse({ mode: m })); return true; }
  if (msg && msg.type === "setMode") { setMode(msg.mode).then((m) => sendResponse({ mode: m })); return true; }
  return false;
});

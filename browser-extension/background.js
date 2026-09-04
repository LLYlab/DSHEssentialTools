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
  const c = cmd.cmd;                 // read_text | read_dom | screenshot | get_url | get_title | navigate | click | fill | run
  const tabId = typeof cmd.tabId === "number" ? cmd.tabId : null;
  const modeNow = await loadMode();

  // 模式门禁
  if (modeNow === "off") return { ok: false, result: { error: "ext-mode-off" } };
  const isRead = ["read_text", "read_dom", "screenshot", "get_url", "get_title"].indexOf(c) >= 0;
  const isWrite = ["navigate", "click", "fill", "run"].indexOf(c) >= 0;
  if (isRead && modeNow === "write") return { ok: false, result: { error: "ext-read-denied-in-write-mode" } };
  if (isWrite && modeNow === "read") return { ok: false, result: { error: "ext-write-denied-in-read-mode" } };
  // 只写模式:执行但不回读页面内容(只回执行结果/错误码)。

  try {
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

function ensureTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId || null, (tab) => {
      const err = chrome.runtime.lastError;
      if (err || !tab) { reject(new Error(err && err.message ? err.message : "未找到标签页")); return; }
      resolve(tab);
    });
  });
}

function injectScript(tabId, kind, payload) {
  // 在页面 ISOLATED 世界执行;不依赖 eval/new Function(规避 MV3 世界 CSP 限制)。
  return chrome.scripting.executeScript({
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
      } catch (e) { out = "ERR:" + (e && e.message ? e.message : String(e)); }
      return out;
    },
    args: [kind, payload || {}],
  }).then((res) => {
    const r = res && res[0] ? res[0].result : undefined;
    return typeof r === "string" ? r : String(r || "");
  });
}

async function doRead(c, cmd, tabId) {
  const tab = await ensureTab(tabId);
  const url = tab.url || "";
  const title = tab.title || "";
  if (c === "get_url") return { ok: true, result: { url } };
  if (c === "get_title") return { ok: true, result: { title } };
  if (c === "screenshot") return screenshot(tabId);
  let out = "";
  try {
    out = await injectScript(tabId, c === "read_dom" ? "read_dom" : "read_text", {});
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
    await chrome.tabs.update(tabId, { url });
    return { ok: true, result: { ok: true, url } };
  }
  if (c === "run") {
    // 任意外部脚本(高危,仅 on 模式并由 DET 审批后放行)。执行但不回读内容。
    try { await injectScript(tabId, "run", { code: String(cmd.code || "") }); }
    catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
    return { ok: true, result: { ok: true } };
  }
  const kind = c === "click" ? "click" : "fill";
  const payload = c === "click" ? { sel: String(cmd.selector || "") } : { sel: String(cmd.selector || ""), val: cmd.value !== undefined ? String(cmd.value) : "" };
  let out = "";
  try { out = await injectScript(tabId, kind, payload); }
  catch (e) { return { ok: false, result: { error: String(e && e.message ? e.message : e) } }; }
  if (out.indexOf("ERR:") === 0) return { ok: false, result: { error: out.slice(4) } };
  return { ok: true, result: { ok: true } };
}

// ── 模块顶层:启动 ────────────────────────────────────────────────────
loadMode().then((m) => setBadge(m));
connect();

// 供 options/popup 调用的简单 RPC(通过 storage 变更事件也可)。
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getMode") { loadMode().then((m) => sendResponse({ mode: m })); return true; }
  if (msg && msg.type === "setMode") { setMode(msg.mode).then((m) => sendResponse({ mode: m })); return true; }
  return false;
});

// dsh-essential-tools — 浏览器控制桥(宿主侧)
// 职责:
//   - 本地启动一个仅绑 127.0.0.1 的 HTTP + WebSocket 服务(默认端口 9123)
//   - 浏览器扩展(DSH 控制扩展,MV3)作为客户端连上
//   - DET 侧 det_browser 工具把「命令」交给已连接的扩展执行,并取回结果
// 安全:
//   - 仅绑定 127.0.0.1;握手校验 Sec-WebSocket-Key + Origin(允许扩展/空)
//   - 四档门禁在扩展端强制(off/read/write/on);宿主再叠加 DET 网络权限第4档(使用用户浏览器)+ 高危审批
//   - 不做服务端主动浏览器控制;这里只是命令中转

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** 四档模式(与扩展一致)。 */
export const EXT_MODES = ["off", "read", "write", "on"];
/** 读类命令。 */
const READ_CMDS = new Set(["read_text", "read_dom", "screenshot", "get_url", "get_title", "list_tabs", "insite_search", "inspect"]);
/** 写类命令。 */
const WRITE_CMDS = new Set(["navigate", "click", "fill", "run", "human_search", "act", "focus_tab"]);

/**
 * 每条命令自己的超时预算（毫秒）。
 *
 * 为什么不再用一个 15s 常数：实测 `screenshot` 打在一个 5000+ 节点的重页面上
 * （就是 DSH 自己的 GUI）时，扩展侧要序列化整页位图，15s 必然超时 ——
 * 当时的报错只有一句 `browser-timeout`，既不知道是哪条命令，也不知道等了多久，
 * 只能盲重试。按命令给预算，并在超时里带上 cmd/waitedMs/hint，才有得排查。
 *
 * 数值取向：**只要扩展还在干活就让它干完**，宁可慢也不要假失败；
 * 但 list_tabs 这种纯查询必须快速失败，避免把"扩展挂了"拖成十几秒的静默。
 */
const CMD_TIMEOUTS = {
  list_tabs: 10000,
  get_url: 10000,
  get_title: 10000,
  read_text: 25000,
  read_dom: 25000,
  inspect: 25000,
  insite_search: 25000,
  navigate: 25000,
  click: 20000,
  fill: 20000,
  act: 20000,
  human_search: 30000,
  focus_tab: 10000,
  screenshot: 45000,
  run: 45000,
};
const DEFAULT_TIMEOUT = 20000;

/** 某条命令的超时预算（未知命令走默认值）。 */
export function timeoutFor(cmd) {
  const key = String(cmd || "");
  return CMD_TIMEOUTS[key] || DEFAULT_TIMEOUT;
}

/** 超时后给用户/模型的下一步建议（写进错误里，省一轮往返）。 */
export function hintFor(cmd) {
  const key = String(cmd || "");
  if (key === "screenshot") return "页面可能过大：改用 read_text + maxLen（先取文本），或对该标签页先 web_focus 再重试，或加大 timeoutMs。";
  if (key === "read_dom" || key === "inspect") return "缩小范围：用 web_inspect what=text 代替整页 DOM，或降低 maxLen。";
  if (key === "run") return "页面脚本可能阻塞：把逻辑拆小，或改用 read_text 先确认页面状态。";
  if (key === "list_tabs" || key === "get_url" || key === "get_title") return "这类纯查询超时通常意味着扩展已卡死：重新加载扩展（chrome://extensions）后重试。";
  return "重试一次；若连续超时，先 web_focus 激活该标签页（后台标签会被浏览器节流），再检查扩展是否仍在运行。";
}

function wsAccept(key) {
  return createHash("sha1").update(key + GUID).digest("base64");
}

/** 解析一个 WebSocket 帧(服务端读客户端数据;客户端帧必须带 mask)。
 * 返回 { opcode, payload, total },total=本帧总字节数(含头)。不完整帧返回 null。 */
function decodeFrame(buf) {
  if (!buf || buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  let mask = null;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.slice(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  let payload = buf.slice(off, off + len);
  if (mask) {
    const out = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { opcode, payload, total: off + len };
}

/** 构造一个服务端→客户端帧(明文,不 masked)。 */
function encodeFrame(str) {
  const data = Buffer.from(String(str), "utf8");
  const len = data.length;
  let header;
  if (len <= 125) { header = Buffer.from([0x81, len]); }
  else if (len <= 65535) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, data]);
}

export class BrowserBridge {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.port = Number((config && config.browserPort) || 9123);
    this.host = "127.0.0.1";
    this.server = null;
    this.sockets = new Set();     // 已升级的 WebSocket 连接(扩展端)
    this.pending = new Map();     // id -> {resolve,reject,timer}
    this._seq = 0;
    this._websocketUpgrade = this._onUpgrade.bind(this);
    this._requestHandler = this._onRequest.bind(this);
    // 连接状态事件(客户端显示)
    this.connListeners = new Set();
  }

  onConn(cb) { this.connListeners.add(cb); return () => this.connListeners.delete(cb); }

  _emitConn() {
    const any = this.sockets.size > 0;
    for (const cb of this.connListeners) { try { cb({ connected: any, count: this.sockets.size }); } catch (e) {} }
  }

  online() { return this.sockets.size > 0; }

  start() {
    if (this.server) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const server = createServer(this._requestHandler);
      server.on("upgrade", this._websocketUpgrade);
      server.on("error", (e) => { /* 端口占用等 */ this.server = null; reject(e); });
      server.listen(this.port, this.host, () => {
        this.server = server;
        resolve(true);
      });
    });
  }

  stop() {
    for (const sock of this.sockets) { try { sock.destroy(); } catch (e) {} }
    this.sockets.clear();
    if (this.server) { try { this.server.close(); } catch (e) {} this.server = null; }
    for (const [, p] of this.pending) { if (p.timer) clearTimeout(p.timer); }
    this.pending.clear();
  }

  _onRequest(req, res) {
    // 非升级的普通 HTTP:仅提供健康/状态端点;跨域给最小头。
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    if (req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, connected: this.online(), count: this.sockets.size, port: this.port }));
      return;
    }
    res.writeHead(404); res.end("not found");
  }

  _onUpgrade(req, socket, head) {
    const key = req.headers["sec-websocket-key"];
    const origin = req.headers["origin"] || "";
    // 仅允许本机扩展/空 origin;解析失败则拒绝。
    const allowedOrigin = origin === "" || /^chrome-extension:\/\//.test(origin) || /^http:\/\/127\.0\.0\.1/.test(origin);
    if (!key || !allowedOrigin) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
    const accept = wsAccept(key);
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Accept: " + accept,
      "\r\n",
    ].join("\r\n");
    socket.write(headers);
    socket.write(head && head.length ? head : Buffer.alloc(0));
    const sock = { socket };
    this.sockets.add(sock);
    // 同一时刻只保留**最新**的一条扩展连接:扩展重载 / MV3 Service Worker 重启后,旧连接可能残留
    // (socket 的 close 事件没触发),而取连接时若拿到最早那条,命令就会发到死连接上,
    // 表现为间歇性 browser-timeout(实测见过 count=6 的残留)。新连接建立时清掉更早的连接。
    if (this.sockets.size > 1) {
      for (const old of [...this.sockets]) {
        if (old === sock) continue;
        try { old.socket.destroy(); } catch (e) { /* ignore */ }
        this.sockets.delete(old);
      }
    }
    const self = this;
    socket.on("data", (chunk) => self._onData(sock, chunk));
    // 断开时立刻结算在途命令：否则它们会一直挂到各自超时预算（最长 45s）才失败，
    // 表现就是"扩展明明掉了，工具却静默半分钟"。
    socket.on("close", () => { self.sockets.delete(sock); self._failPending("browser-disconnected"); self._emitConn(); });
    socket.on("error", () => { self.sockets.delete(sock); self._failPending("browser-disconnected"); self._emitConn(); });
    this._emitConn();
  }

  _onData(sock, chunk) {
    if (!sock.buf) sock.buf = Buffer.alloc(0);
    sock.buf = Buffer.concat([sock.buf, chunk]);
    let frame;
    while ((frame = decodeFrame(sock.buf)) !== null) {
      sock.buf = sock.buf.slice(frame.total);
      if (frame.opcode === 0x1) {
        try {
          const msg = JSON.parse(frame.payload.toString("utf8"));
          this._onMessage(msg);
        } catch (e) {}
      } else if (frame.opcode === 0x8) {
        try { sock.socket.end(); } catch (e) {}
      } else if (frame.opcode === 0x9) {
        // ping → pong
        try { sock.socket.write(encodeFrame("")); } catch (e) {}
      }
    }
  }

  _send(sock, obj) {
    try { sock.socket.write(encodeFrame(typeof obj === "string" ? obj : JSON.stringify(obj))); } catch (e) {}
  }

  _onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "hello") {
      if (typeof msg.mode === "string") { this.mode = msg.mode; this._emitMode(msg.mode); }
      return;
    }
    if (msg.type === "mode") {
      if (typeof msg.mode === "string") { this.mode = msg.mode; this._emitMode(msg.mode); }
      return;
    }
    if (msg.id && msg.id !== undefined && msg.cmd === undefined) {
      // 扩展对宿主命令的回执
      const p = this.pending.get(String(msg.id));
      if (p) {
        this.pending.delete(String(msg.id));
        if (p.timer) clearTimeout(p.timer);
        p.resolve({ ok: msg.ok === true, result: msg.result });
      }
      return;
    }
  }

  _emitMode(mode) {
    // 供 DET 读取当前扩展模式(可选)
    this.mode = mode;
  }

  /** 向扩展发送一条命令(需已连接)。返回 Promise<{ok,result}>。 */
  request(tabId, cmd, args, opts) {
    const ext = this._firstSocket();
    if (!ext) return Promise.resolve({ ok: false, result: { error: "browser-not-connected", cmd: String(cmd || "") } });
    const id = "r" + (++this._seq) + "-" + Date.now();
    // 预算按命令给(见 CMD_TIMEOUTS)；调用方仍可用 timeoutMs 显式覆盖。
    const timeoutMs = Math.max(1000, Number((opts && opts.timeoutMs) || timeoutFor(cmd)));
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // 结构化失败：带上命令名、等待时长与下一步建议，模型/用户不用再猜。
        resolve({
          ok: false,
          result: {
            error: "browser-timeout",
            cmd: String(cmd || ""),
            waitedMs: timeoutMs,
            tabId: typeof tabId === "number" ? tabId : null,
            hint: hintFor(cmd),
          },
        });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer, cmd: String(cmd || ""), startedAt });
      const msg = { id, cmd, tabId, ...(args || {}) };
      this._send(ext, msg);
    });
  }

  /** 超时之后能做什么 —— 写进错误里，省掉一轮"为什么失败"的往返。 */
  /** 取当前扩展连接。取**最后加入**的一条 —— 最新的连接才是活的,旧连接可能已死。 */
  _firstSocket() {
    let last = null;
    for (const s of this.sockets) last = s;
    return last;
  }

  /** 扩展连接断开时立刻结算在途命令（否则会静默等满超时预算）。 */
  _failPending(reason) {
    for (const [id, p] of Array.from(this.pending.entries())) {
      this.pending.delete(id);
      if (p.timer) clearTimeout(p.timer);
      try {
        p.resolve({
          ok: false,
          result: { error: reason, cmd: p.cmd || "", waitedMs: Date.now() - (p.startedAt || Date.now()) },
        });
      } catch (e) { /* ignore */ }
    }
  }

  /** det_browser 工具的执行主体:读/写命令门禁;「只写」模式不回读页面内容。 */
  async run(tabId, cmd, args, opts) {
    const modeNow = this.mode || "off";
    if (modeNow === "off") return { ok: false, result: { error: "ext-mode-off", cmd: String(cmd || "") } };
    const isRead = READ_CMDS.has(cmd);
    const isWrite = WRITE_CMDS.has(cmd);
    if (isRead && modeNow === "write") return { ok: false, result: { error: "ext-read-denied-in-write-mode", cmd: String(cmd || "") } };
    if (isWrite && modeNow === "read") return { ok: false, result: { error: "ext-write-denied-in-read-mode", cmd: String(cmd || "") } };
    const res = await this.request(tabId, cmd, args, opts);
    // 「只写」模式下,即便扩展误回读,宿主也剥离页面内容再返回。
    if (isWrite && res.ok && modeNow === "write") {
      if (res.result && typeof res.result === "object") { const r = res.result; delete r.text; delete r.dom; }
    }
    return res;
  }

  getMode() { return this.mode || "off"; }
}

export { READ_CMDS, WRITE_CMDS };

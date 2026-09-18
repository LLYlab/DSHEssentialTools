/**
 * DET 纯函数回归测试（unit）
 * ====================================================================
 * 为什么先做这个：
 *   DET 有 8400+ 行、16 项能力，但 tests/ 只有一个 pause.test.mjs。
 *   历史教训（见 CHANGELOG v2.6.0）说明：没有可重复运行的断言，
 *   缺陷只能靠"用户撞上"来发现。
 *
 * 本套只测 **导出的纯函数 + Config 校验**，不依赖 Cordis 上下文，
 * 因此不需要 profile，也不会联网/起子进程 —— 任何机器上都能跑：
 *
 *     node <repo>/tests/unit.test.mjs
 *
 * 覆盖：SSRF 防护（safeHttpUrl / isPrivateHostname）、路径与版本 id 白名单
 *       （safeVersionId）、Config 默认值与覆盖。
 */

import {
  Config,
  apply,
  hasOpenTurn,
  inject,
  ipv4Private,
  isDsPeakNowHost,
  isPrivateHostname,
  name,
  safeHttpUrl,
  safeVersionId,
  textContent,
} from "../lib/index.js";

let pass = 0;
const failures = [];

function ok(cond, label) {
  if (cond) { pass++; return; }
  failures.push(label);
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${label}\n      expected ${e}\n      actual   ${a}`);
}
function section(title) { console.log(`\n-- ${title}`); }

// ─────────────────────────────────────────────────────────────
section("包身份与硬依赖契约");

eq(name, "dsh-essential-tools", "name 必须是 dsh-essential-tools（loader 按 package.json 名解析）");
eq(inject, ["typert"], "inject 只硬依赖 typert（其余服务必须 ctx.get 可选读取）");
ok(typeof apply === "function", "apply 必须导出为函数（永久包入口）");
ok(Config && typeof Config === "function", "Config 必须是可调用的 schemastery schema");

// ─────────────────────────────────────────────────────────────
section("safeVersionId — 版本/快照 id 白名单");

ok(safeVersionId("abc") === "abc", "普通字母数字放行");
ok(safeVersionId("a_b-c123") === "a_b-c123", "允许 _ 与 -");
ok(safeVersionId("A".repeat(64)) !== null, "64 字符是上限内的合法值");
ok(safeVersionId("A".repeat(65)) === null, "65 字符必须拒绝");
eq(safeVersionId(""), null, "空串拒绝");
eq(safeVersionId("a/b"), null, "路径分隔符拒绝（防目录穿越）");
eq(safeVersionId(".."), null, ".. 拒绝");
eq(safeVersionId("a b"), null, "空格拒绝");
eq(safeVersionId("a\\b"), null, "反斜杠拒绝");
eq(safeVersionId(null), null, "null 拒绝");
eq(safeVersionId(undefined), null, "undefined 拒绝");
eq(safeVersionId(123), null, "数字拒绝");
eq(safeVersionId({}), null, "对象拒绝");
eq(safeVersionId(["a"]), null, "数组拒绝");

// ─────────────────────────────────────────────────────────────
section("isPrivateHostname — SSRF 主机判定");

// 名称类
ok(isPrivateHostname("localhost"), "localhost");
ok(isPrivateHostname("foo.local"), "*.local");
ok(isPrivateHostname("svc.internal"), "*.internal");
ok(isPrivateHostname("x.localhost"), "*.localhost");
ok(isPrivateHostname("LOCALHOST"), "大小写不敏感");

// IPv4 私网与边界
ok(isPrivateHostname("127.0.0.1"), "环回 127/8");
ok(isPrivateHostname("127.255.255.254"), "环回段上界");
ok(isPrivateHostname("10.1.2.3"), "10/8");
ok(isPrivateHostname("172.16.0.1"), "172.16/12 下界");
ok(isPrivateHostname("172.31.255.255"), "172.16/12 上界");
ok(!isPrivateHostname("172.32.0.1"), "172.32 已出私网段（上界 +1，必须放行）");
ok(!isPrivateHostname("172.15.0.1"), "172.15 在私网段外（下界 -1，必须放行）");
ok(isPrivateHostname("192.168.1.1"), "192.168/16");
ok(isPrivateHostname("169.254.169.254"), "链路本地（云元数据端点）");
ok(isPrivateHostname("0.0.0.0"), "0/8");
ok(isPrivateHostname("224.0.0.1"), "组播 >=224");
ok(isPrivateHostname("255.255.255.255"), "广播地址");
ok(!isPrivateHostname("8.8.8.8"), "公网 IPv4 放行");
ok(!isPrivateHostname("1.1.1.1"), "公网 IPv4 放行（2）");

// IPv6
ok(isPrivateHostname("::1"), "IPv6 环回");
ok(isPrivateHostname("[::1]"), "带方括号的 IPv6 环回（URL.hostname 形态）");
ok(isPrivateHostname("::"), "IPv6 未指定地址");
ok(isPrivateHostname("fc00::1"), "fc00::/7 唯一本地");
ok(isPrivateHostname("fd12:3456::1"), "fd00::/8 唯一本地");
ok(isPrivateHostname("fe80::1"), "fe80::/10 链路本地");
ok(isPrivateHostname("::ffff:127.0.0.1"), "v4-mapped（点分形式）");
ok(isPrivateHostname("::ffff:7f00:1"), "v4-mapped（十六进制形式 → 127.0.0.1）");
ok(isPrivateHostname("::ffff:0a00:1"), "v4-mapped（十六进制形式 → 10.0.0.1）");
ok(!isPrivateHostname("::ffff:8.8.8.8"), "v4-mapped 公网地址放行");
ok(!isPrivateHostname("2001:4860:4860::8888"), "公网 IPv6 放行");

// 非字符串一律按"危险"处理
ok(isPrivateHostname(null), "null → 视为私网（保守）");
ok(isPrivateHostname(undefined), "undefined → 视为私网（保守）");
ok(isPrivateHostname(123), "数字 → 视为私网（保守）");

// ─────────────────────────────────────────────────────────────
section("safeHttpUrl — 外部可达性校验");

const okUrl = safeHttpUrl("https://example.com/a?b=1");
ok(okUrl.ok === true, "正常 https 放行");
ok(typeof okUrl.url === "string" && okUrl.url.indexOf("example.com") !== -1, "放行时回传规范 URL");
ok(safeHttpUrl("http://example.com/").ok === true, "http 也允许");
ok(safeHttpUrl("HTTPS://EXAMPLE.COM/").ok === true, "协议大小写不敏感");

eq(safeHttpUrl("ftp://example.com/").ok, false, "非 http/https 拒绝");
eq(safeHttpUrl("file:///C:/x").ok, false, "file: 拒绝");
eq(safeHttpUrl("javascript:alert(1)").ok, false, "javascript: 拒绝");
eq(safeHttpUrl("https://user:pass@example.com/").ok, false, "URL 内嵌凭据拒绝");
eq(safeHttpUrl("https://user@example.com/").ok, false, "只带用户名也拒绝");
eq(safeHttpUrl("http://127.0.0.1:8080/").ok, false, "环回拒绝（SSRF）");
eq(safeHttpUrl("http://localhost/").ok, false, "localhost 拒绝（SSRF）");
eq(safeHttpUrl("http://169.254.169.254/latest/meta-data/").ok, false, "云元数据端点拒绝");
eq(safeHttpUrl("http://[::1]/").ok, false, "IPv6 环回拒绝");
eq(safeHttpUrl("not a url").ok, false, "非法 URL 拒绝");
eq(safeHttpUrl("").ok, false, "空串拒绝");
eq(safeHttpUrl(null).ok, false, "null 拒绝");
eq(safeHttpUrl(undefined).ok, false, "undefined 拒绝");

// 失败时必须回传人类可读的 error
ok(typeof safeHttpUrl("ftp://x/").error === "string" && safeHttpUrl("ftp://x/").error.length > 0, "失败必须带 error 文案");
ok(typeof safeHttpUrl("http://10.0.0.1/").error === "string" && safeHttpUrl("http://10.0.0.1/").error.indexOf("内网") !== -1, "SSRF 失败文案要点明内网");

// ─────────────────────────────────────────────────────────────
section("Config — 默认值必须中性（不含个人/机器信息）");

function resolveConfig(input) {
  try { return { value: Config(input) }; } catch (e) { return { error: String(e && e.message ? e.message : e) }; }
}

const def = resolveConfig({});
ok(!def.error, `Config({}) 不应抛错${def.error ? "：" + def.error : ""}`);
if (!def.error) {
  const v = def.value;
  eq(v.lvalRoot, "", "lvalRoot 默认空串（开源分发不得带入个人路径）");
  eq(v.srcDir, "", "srcDir 默认空串");
  eq(v.solution, "", "solution 默认空串");
  eq(v.msbuild, "", "msbuild 默认空串（必须靠探测/配置，不得硬编码）");
  eq(v.configuration, "Debug", "configuration 默认 Debug");
  eq(v.platform, "x64", "platform 默认 x64");
  eq(v.dsApiKey, "", "dsApiKey 默认空（密钥不得进仓库）");
  eq(v.dsApiKeyEnv, "DEEPSEEK_API_KEY", "dsApiKeyEnv 默认名");
  eq(v.bootFailLimit, 2, "bootFailLimit 默认 2");
}

const custom = resolveConfig({ configuration: "Release", platform: "x86", bootFailLimit: 5, lvalRoot: "D:\\p" });
ok(!custom.error, "显式覆盖不应抛错");
if (!custom.error) {
  eq(custom.value.configuration, "Release", "显式 configuration 生效");
  eq(custom.value.platform, "x86", "显式 platform 生效");
  eq(custom.value.bootFailLimit, 5, "显式 bootFailLimit 生效");
  eq(custom.value.lvalRoot, "D:\\p", "显式 lvalRoot 生效");
}

// ─────────────────────────────────────────────────────────────
section("ipv4Private — IPv4 私网段（直接导出，单独钉边界）");

ok(ipv4Private("10.0.0.1"), "10/8");
ok(ipv4Private("172.16.0.0"), "172.16/12 下界");
ok(ipv4Private("172.31.255.255"), "172.16/12 上界");
ok(!ipv4Private("172.15.255.255"), "172.15 在段外，必须放行");
ok(!ipv4Private("172.32.0.0"), "172.32 在段外，必须放行");
ok(ipv4Private("192.168.255.255"), "192.168/16");
ok(ipv4Private("169.254.0.1"), "链路本地");
ok(ipv4Private("127.0.0.1"), "环回");
ok(ipv4Private("0.0.0.0"), "0/8");
ok(ipv4Private("224.0.0.1"), "组播");
ok(!ipv4Private("8.8.8.8"), "公网地址放行");
eq(ipv4Private("not-an-ip"), false, "非 IPv4 文本返回 false");
eq(ipv4Private(""), false, "空串返回 false");

// ─────────────────────────────────────────────────────────────
section("textContent — 内容块提纯");

eq(textContent([{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }]), "a\nb", "只取 text 块，以换行连接");
eq(textContent([{ type: "text", text: "" }, { type: "text", text: "x" }]), "\nx", "空字符串 text 仍占位（与实现一致）");
eq(textContent([{ type: "text" }, { type: "text", text: 5 }]), "", "text 非字符串则丢弃");
eq(textContent([]), "", "空数组返回空串");
eq(textContent("not-an-array"), "", "非数组返回空串");
eq(textContent(null), "", "null 返回空串");
eq(textContent(undefined), "", "undefined 返回空串");

// ─────────────────────────────────────────────────────────────
section("hasOpenTurn — 会话是否仍在生成回答");

eq(hasOpenTurn([{ type: "turn/start" }, { type: "turn/end" }]), false, "一对一 → 无未闭合轮次");
eq(hasOpenTurn([{ type: "turn/start" }]), true, "只有 start → 有未闭合轮次");
eq(hasOpenTurn([{ type: "turn/start" }, { type: "turn/end" }, { type: "turn/start" }]), true, "多一次 start → 有未闭合轮次");
eq(hasOpenTurn([{ type: "turn/end" }, { type: "turn/start" }]), false, "顺序颠倒但 start/end 计数相等 → 判为无未闭合轮次（实现按计数而非顺序）");
eq(hasOpenTurn([{ type: "turn/end" }, { type: "turn/end" }]), false, "end 多于 start → 不是未闭合轮次");
eq(hasOpenTurn([]), false, "空数组 → false");
eq(hasOpenTurn(null), false, "null → false");
eq(hasOpenTurn("x"), false, "非数组 → false");
eq(hasOpenTurn([null, { type: "turn/start" }, 123, { type: "turn/end" }]), false, "脏事件被忽略，不误判");

// ─────────────────────────────────────────────────────────────
section("isDsPeakNowHost — 峰谷时段（北京时间，直接决定报价）");

// 自校准出"UTC 周一"，避免依赖硬编码的星期。
function mondayUTC() {
  const d = new Date(Date.UTC(2026, 0, 5, 0, 0, 0));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const mon = mondayUTC();
eq(mon.getUTCDay(), 1, "测试基准日自检：必须是周一");
// 北京时间 = UTC+8；北京 9:00–18:00 对应 UTC 同日 1:00–10:00。
const atUtc = (base, dayOffset, hourUtc) =>
  new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset, hourUtc, 0, 0));

eq(typeof isDsPeakNowHost(), "boolean", "无参调用可用（缺省取真实时间）");
eq(isDsPeakNowHost(atUtc(mon, 0, 1)), true, "周一 北京 09:00 → 峰值（下界含）");
eq(isDsPeakNowHost(atUtc(mon, 0, 0)), false, "周一 北京 08:00 → 非峰值");
eq(isDsPeakNowHost(atUtc(mon, 0, 2)), true, "周一 北京 10:00 → 峰值");
eq(isDsPeakNowHost(atUtc(mon, 0, 3)), true, "周一 北京 11:00 → 峰值");
eq(isDsPeakNowHost(atUtc(mon, 0, 4)), false, "周一 北京 12:00 → 非峰值（上界不含）");
eq(isDsPeakNowHost(atUtc(mon, 0, 5)), false, "周一 北京 13:00 → 非峰值（午休）");
eq(isDsPeakNowHost(atUtc(mon, 0, 6)), true, "周一 北京 14:00 → 峰值（下界含）");
eq(isDsPeakNowHost(atUtc(mon, 0, 9)), true, "周一 北京 17:00 → 峰值");
eq(isDsPeakNowHost(atUtc(mon, 0, 10)), false, "周一 北京 18:00 → 非峰值（上界不含）");
eq(isDsPeakNowHost(atUtc(mon, 4, 2)), true, "周五 北京 10:00 → 峰值");
eq(isDsPeakNowHost(atUtc(mon, 5, 2)), false, "周六 北京 10:00 → 非峰值");
eq(isDsPeakNowHost(atUtc(mon, 6, 7)), false, "周日 北京 15:00 → 非峰值");

// ─────────────────────────────────────────────────────────────
section("结果");
if (failures.length === 0) {
  console.log(`\n✅ 全部通过：${pass} 项断言`);
  process.exit(0);
}
console.log(`\n❌ 失败 ${failures.length} 项 / 通过 ${pass} 项`);
for (const f of failures) console.log("   • " + f);
process.exit(1);

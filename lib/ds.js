// dsh-essential-tools — DeepSeek 余额 / 官网单价(纯数据层,无副作用)
// 参考开源做法(见 README「余额/单价」):官方 GET https://api.deepseek.com/user/balance
// (Bearer key → balance_infos: currency/total_balance/granted_balance/topped_up_balance)。
// 价格从 DeepSeek 官方文档定价页(api-docs.deepseek.com/quick_start/pricing)SSR 表格解析。
// 安全口径(相对参考项目的剔除项):
//   - 不采用 usage-proxy 本地 MITM 代理;不建 sqlite 用量台账(不记录任何 token 用量);
//   - API key 只作为短暂请求头使用:不落盘、不进日志、不写入任何第三方地址;
//   - 无遥测/统计/上报;网络仅访问 api.deepseek.com 与 api-docs.deepseek.com。

/** 余额 API(参考项目通用端点)。 */
const BALANCE_URL = "https://api.deepseek.com/user/balance";
/** 官网定价页(SSR HTML 表格):中文页(CNY 计价,规范路由带尾斜杠)优先,英文页(USD)兜底。 */
const PRICE_URL_CN = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
const PRICE_URL_EN = "https://api-docs.deepseek.com/quick_start/pricing";
/** 余额缓存 TTL(毫秒):配合前端每 10 秒刷新,TTL 略低于 10s 以确保每次轮询拿到新值。 */
const BALANCE_TTL = 8 * 1000;
/** 价格缓存 TTL(毫秒):定价变动极少,6 小时一刷。 */
const PRICE_TTL = 6 * 60 * 60 * 1000;

/** 简单 HTML 实体解码(仅定价表需要)。 */
function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#(\d+);/g, (_m, n) => {
      try { return String.fromCodePoint(Number(n)); } catch (e) { return ""; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); } catch (e) { return ""; }
    });
}

/**
 * 解析官网定价页 HTML(纯函数,可单测;语言/币种自适应)。
 * 表格列 = 模型(deepseek-*),行(每行 models.length 个数值,顺序)：
 *   输入(缓存命中) 错峰 → 峰值 → 输入(缓存未命中) 错峰 → 峰值 → 输出 错峰 → 峰值
 * 币种自动识别:文本含 "元" → CNY(数字+元,如 "1.5元"),否则 USD($ 数字)。
 * @param {string} html - 完整页面 HTML。
 * @returns {{ok:true, models:Array, note:string, currency:string}|{ok:false,error:string}}
 */
export function parsePricingHtml(html) {
  const ti = String(html || "").indexOf("<table");
  if (ti < 0) return { ok: false, error: "页面中未找到价格表格" };
  const seg = String(html).slice(ti, ti + 120000);
  const text = decodeEntities(String(seg).replace(/<[^>]*>/g, "|"));
  // 模型列(语言无关):跳过空单元格,连续 deepseek-* 单元格即模型;遇非模型单元格停止。
  const cells = text.split("|");
  const models = [];
  for (let i = 0; i < cells.length && models.length < 6; i++) {
    const raw = String(cells[i]).trim();
    if (raw === "") continue;
    const c = raw.toLowerCase();
    if (/^deepseek-[a-z0-9-]+$/.test(c)) models.push(c);
    else if (models.length > 0) break;
  }
  // 兜底:正则扫描(仍要求数量与 6 行价格匹配)。
  if (models.length === 0) {
    const modelMatches = text.match(/deepseek-[a-z0-9-]+/gi) || [];
    for (const m of modelMatches) {
      const id = m.toLowerCase();
      if (models.indexOf(id) < 0) models.push(id);
    }
  }
  if (models.length === 0) return { ok: false, error: "未在表格中找到模型名" };
  if (models.length > 6) return { ok: false, error: "模型数量异常(" + models.length + "),请检查官网表格结构" };
  const isCny = /[元¥]/u.test(text);
  const prices = [];
  const priceRe = isCny ? /(\d+(?:\.\d+)?)\s*元/g : /\$(\d+(?:\.\d+)?)/g;
  let pm = priceRe.exec(text);
  while (pm !== null) { prices.push(Number(pm[1])); pm = priceRe.exec(text); }
  const rows = models.length * 6; // 每模型 6 行价格
  if (prices.length < rows) {
    return { ok: false, error: "价格数量不足(" + prices.length + "/" + rows + ")" };
  }
  const col = models.length;
  const rowNames = [
    "inputHitOffPeak", "inputHitPeak",
    "inputMissOffPeak", "inputMissPeak",
    "outputOffPeak", "outputPeak",
  ];
  const out = models.map((id, mIdx) => {
    const rec = { id };
    rowNames.forEach((key, rIdx) => { rec[key] = prices[rIdx * col + mIdx]; });
    return rec;
  });
  const note = (text.match(isCny ? /高峰时段为[^|]{0,180}/ : /Peak hours are[^|]{0,180}/) || [""])[0].trim() ||
    (isCny
      ? "高峰时段为北京时间周一至周五 9:00 - 12:00、14:00 - 18:00(其余为错峰)。"
      : "Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday (all other hours are off-peak).");
  return { ok: true, models: out, note, currency: isCny ? "CNY" : "USD" };
}

/**
 * 查询 DeepSeek 官方余额(异步;key 仅存在于本次请求头)。
 * @param {string} apiKey - DeepSeek API key。
 * @param {object} [opts] - { timeoutMs, signal }
 * @returns {Promise<{ok:true,isAvailable:boolean,balances:Array,fetchedAt:number}|{ok:false,code:string,error:string}>}
 */
export async function fetchDsBalance(apiKey, opts) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return { ok: false, code: "NO_KEY", error: "未配置 DeepSeek API Key" };
  }
  let resp = null;
  try {
    resp = await fetch(BALANCE_URL, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + apiKey.trim(),
        Accept: "application/json",
        "User-Agent": "dsh-essential-tools",
      },
      redirect: "follow",
      signal: opts && opts.signal ? opts.signal : undefined,
    });
  } catch (e) {
    return { ok: false, code: "NETWORK", error: "余额接口请求失败: " + String(e && e.message ? e.message : e) };
  }
  // 防重定向到异常主机:最终主机必须仍是官方余额端点。
  try {
    const finalHost = new URL(resp.url || BALANCE_URL).hostname;
    if (finalHost !== new URL(BALANCE_URL).hostname) {
      return { ok: false, code: "REDIRECT", error: "余额接口重定向到非官方主机: " + finalHost };
    }
  } catch (e) { /* ignore */ }
  let payload = null;
  try { payload = await resp.json(); } catch (e) { /* ignore */ }
  if (resp.status === 401 || resp.status === 403) {
    return { ok: false, code: "KEY_INVALID", error: "API Key 无效或无权限(HTTP " + resp.status + ")" };
  }
  if (resp.status === 429) {
    return { ok: false, code: "RATE_LIMITED", error: "触发限流(HTTP 429),请稍后重试" };
  }
  if (!resp.ok) {
    return { ok: false, code: "HTTP_" + resp.status, error: "余额接口返回 HTTP " + resp.status };
  }
  const infos = payload && Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  const balances = infos.map((b) => ({
    currency: String((b && b.currency) || "CNY").toUpperCase(),
    total: String((b && b.total_balance) || "0"),
    granted: String((b && b.granted_balance) || "0"),
    toppedUp: String((b && b.topped_up_balance) || "0"),
  }));
  return {
    ok: true,
    isAvailable: payload && payload.is_available === true,
    balances,
    fetchedAt: Date.now(),
  };
}

/**
 * 拉取官网定价页并解析(带回退:解析失败时优先返回调用方提供的 lastGood)。
 * 优先中文页(CNY 计价);失败或解析不出时尝试英文页(USD)。
 * @param {object} [lastGood] - 上次成功结果(内存缓存)。
 * @returns {Promise<{ok:true,models,note,fetchedAt,source,currency}|{ok:false,error,lastGood:object|null}>}
 */
export async function fetchDsPrice(lastGood, opts) {
  const candidates = [
    { url: PRICE_URL_CN, host: new URL(PRICE_URL_CN).hostname },
    { url: PRICE_URL_EN, host: new URL(PRICE_URL_EN).hostname },
  ];
  let lastError = "";
  for (const candidate of candidates) {
    let resp = null;
    try {
      resp = await fetch(candidate.url, {
        headers: { "User-Agent": "dsh-essential-tools", Accept: "text/html,*/*" },
        redirect: "follow",
      });
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
      continue;
    }
    // 防重定向到异常主机:最终主机必须仍是官方文档站。
    try {
      const finalHost = new URL(resp.url || candidate.url).hostname;
      if (finalHost !== candidate.host) {
        lastError = "定价页重定向到非官方主机: " + finalHost;
        continue;
      }
    } catch (e) { /* ignore */ }
    if (!resp.ok) { lastError = "定价页返回 HTTP " + resp.status; continue; }
    const html = await resp.text();
    const parsed = parsePricingHtml(html);
    if (!parsed.ok) { lastError = parsed.error; continue; }
    return {
      ok: true,
      models: parsed.models,
      note: parsed.note,
      currency: parsed.currency || "USD",
      fetchedAt: Date.now(),
      source: candidate.url,
    };
  }
  return { ok: false, error: lastError || "定价页均不可用", lastGood: lastGood || null };
}

export { BALANCE_URL, PRICE_URL_CN, PRICE_URL_EN, BALANCE_TTL, PRICE_TTL };

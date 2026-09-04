// dsh-essential-tools — 全局插件商店标准源层(纯数据层,无副作用)
// 职责:把「流行仓库/容器库格式」的插件市场规范化成一个统一的 store item,
//     供 DET 全局插件管理 的应用商店搜索 / 检查 / 安装使用。
// 兼容的源(每个都是专门爬取器,基于对真实 DSH 插件市场的访问与分析):
//   github       — 用 GitHub Search API 爬 `dsh-plugin` 话题的仓库(cordis 爬取约定;保持原行为)
//   marketplace  — 爬 YELEBAI/dsh-plugin-marketplace 中心 registry/plugins.json(v2)+ discovery.json
//   leaderboard  — 爬 dshpluginleaderboard.com 的 /api/catalog + /api/plugins/<href>(逐条取详情)
//   radar        — 爬 dsh-plugin-radar(awesome-dsh-plugins)data/snapshots/*.json 的 catalog_entries
//
// 私协议(私有)dsh-plugin.json / plugin\host.js + plugin\client.js 约定由安装层处理,这里不重复。
//
// store item 归一化字段(所有源一致):
//   fullName, name, owner, repo, description, stars, stars7dDelta, forks,
//   categories[], updatedAt, htmlUrl, source, verificationStatus?, installPath?,
//   packageName?, version?, topics[]?

/** 支持的源与显示名/说明(host/客户端/工具共享)。 */
export const STORE_SOURCES = [
  { key: "github", label: "GitHub 搜索", desc: "用 GitHub Search 爬 dsh-plugin 话题仓库(cordis 约定)。" },
  { key: "marketplace", label: "DSH 插件市场", desc: "爬 YELEBAI/dsh-plugin-marketplace 中心 Registry(plugins.json v2)。" },
  { key: "leaderboard", label: "DSH Plugin Leaderboard", desc: "爬 dshpluginleaderboard.com 目录 + 逐条详情(installPath/验证状态)。" },
  { key: "radar", label: "DSH 插件雷达", desc: "爬 dsh-plugin-radar 快照 catalog_entries(运行级判定)。" },
];

/** 每个源的最近一次抓取信息(进程内缓存;仅做性能去抖,不做权威数据)。 */
const SNAPSHOTS = {
  marketplace: null,   // { at, plugins[], discovery }
  leaderboard: null,   // { at, catalog, detail:{ [repo]:item } }
  radar: null,         // { at, entries[] }
};
const SNAPSHOT_TTL = 10 * 60 * 1000; // 10 分钟

// ── 源 URL(集中定义,便于维护)──────────────────────────────────────────
const URLS = {
  marketplace: {
    plugins: "https://raw.githubusercontent.com/YELEBAI/dsh-plugin-marketplace/main/registry/plugins.json",
    discovery: "https://raw.githubusercontent.com/YELEBAI/dsh-plugin-marketplace/main/registry/discovery.json",
  },
  leaderboard: {
    catalog: "https://dshpluginleaderboard.com/api/catalog",
    detail: (href) => "https://dshpluginleaderboard.com/api/plugins/" + encodeURIComponent(String(href).replace(/^\/+/, "")),
  },
  radar: {
    snapshots: "https://api.github.com/repos/AdamPlatin123/awesome-dsh-plugins/contents/data/snapshots?ref=main",
    snapshot: (name) => "https://raw.githubusercontent.com/AdamPlatin123/awesome-dsh-plugins/main/data/snapshots/" + encodeURIComponent(name),
  },
};

/** 安全的数字解析(non-finite → 0)。 */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 从 URL 解析 owner/repo(兼容 github.com/…、raw 等形式,失败返回 null)。 */
function ownerRepoFrom(url, fallbackFullName) {
  const s = String(url || "");
  const m = /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:\/|$)/.exec(s);
  if (m) { const parts = m[1].split("/"); return { owner: parts[0], repo: parts[1] }; }
  if (fallbackFullName && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fallbackFullName)) {
    const parts = fallbackFullName.split("/");
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

/** 统一的 store item 归一化(源专属字段 → 标准字段)。 */
function normalizeItem(src, raw) {
  const nameStr = typeof raw.name === "string" ? raw.name.trim() : "";
  const descStr = typeof raw.description === "string" ? raw.description.trim() : "";
  const fullName = typeof raw.fullName === "string" && raw.fullName !== ""
    ? raw.fullName
    : (raw.owner && raw.repo ? raw.owner + "/" + raw.repo : (typeof raw.repo === "string" ? raw.repo : nameStr));
  const or = ownerRepoFrom(raw.htmlUrl, fullName);
  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter((c) => typeof c === "string" && c !== "")
    : [];
  const item = {
    source: src,
    fullName: String(fullName).slice(0, 200),
    name: nameStr.slice(0, 200) || (or ? or.repo : String(fullName).slice(0, 200)),
    owner: (or && or.owner) || "",
    repo: (or && or.repo) || "",
    description: descStr.slice(0, 2000),
    stars: num(raw.stars),
    stars7dDelta: num(raw.stars7dDelta),
    forks: num(raw.forks),
    categories: categories.slice(0, 12),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : (typeof raw.updatedAt === "number" ? new Date(raw.updatedAt).toISOString() : ""),
    htmlUrl: typeof raw.htmlUrl === "string" ? raw.htmlUrl : (or ? "https://github.com/" + or.owner + "/" + or.repo : ""),
    verificationStatus: typeof raw.verificationStatus === "string" ? raw.verificationStatus : "",
    installPath: typeof raw.installPath === "string" ? raw.installPath : "",
    packageName: typeof raw.packageName === "string" ? raw.packageName : "",
    version: typeof raw.version === "string" ? raw.version : "",
  };
  // 逐字段清掉空串,保持返回紧凑。
  for (const k of Object.keys(item)) { if (item[k] === "" || item[k] === null) delete item[k]; }
  if (Array.isArray(raw.topics) && raw.topics.length) item.topics = raw.topics.map((t) => String(t)).slice(0, 8);
  return item;
}

/**
 * 爬取器:marketplace —— 中心 Registry plugins.json(v2)。
 * 附带 discovery.json 的分类/star 增长,合并到条目。
 * @param fetchJson 宿主提供的安全 JSON 抓取函数:(url,maxLen)=>Promise<{ok,text,error?}>
 */
async function crawlMarketplace(fetchJson) {
  const get = async (url) => {
    const r = await fetchJson(url, 8 * 1024 * 1024);
    if (!r.ok) return { ok: false, error: r.error || "抓取失败" };
    try { return { ok: true, json: JSON.parse(r.text) }; }
    catch (e) { return { ok: false, error: "JSON 解析失败: " + String(e && e.message ? e.message : e) }; }
  };
  const pj = await get(URLS.marketplace.plugins);
  if (!pj.ok) return { ok: false, error: pj.error };
  const plugins = Array.isArray(pj.json.plugins) ? pj.json.plugins : [];
  const dj = await get(URLS.marketplace.discovery);
  const disc = dj.ok && dj.json && Array.isArray(dj.json.plugins) ? dj.json.plugins : [];
  const byRepo = new Map();
  for (const d of disc) { if (d && d.fullName) byRepo.set(String(d.fullName), d); }
  const items = plugins.map((p) => {
    const d = byRepo.get(String(p.fullName || ""));
    const raw = Object.assign({}, p, {
      description: p.description || "",
      owner: p.owner || "",
      repo: p.repo || "",
      categories: (d && Array.isArray(d.categories)) ? d.categories : [],
      stars7dDelta: d ? num(d.starGrowth7d) : 0,
      topics: p.topics || [],
    });
    return normalizeItem("marketplace", raw);
  });
  // 附上该源的标记元信息,客户端可展示数据来源。
  const meta = {
    schemaVersion: pj.json.schemaVersion,
    generatedAt: pj.json.generatedAt,
    count: items.length,
    sourceUrl: URLS.marketplace.plugins,
  };
  return { ok: true, items, meta, ts: Date.now() };
}

/**
 * 爬取器:leaderboard —— 目录 /api/catalog + 逐条 /api/plugins/<href> 详情。
 * catalog 每页固定 25 条;详情能给到 installPath / verificationStatus / forks / watchers。
 */
async function crawlLeaderboard(fetchJson) {
  const get = async (url) => {
    const r = await fetchJson(url, 8 * 1024 * 1024);
    if (!r.ok) return { ok: false, error: r.error || "抓取失败" };
    try { return { ok: true, json: JSON.parse(r.text) }; }
    catch (e) { return { ok: false, error: "JSON 解析失败: " + String(e && e.message ? e.message : e) }; }
  };
  const cj = await get(URLS.leaderboard.catalog);
  if (!cj.ok) return { ok: false, error: cj.error };
  const catalog = Array.isArray(cj.json.items) ? cj.json.items : [];
  const items = [];
  for (const it of catalog) {
    const href = typeof it.href === "string" ? it.href : "";
    let raw = {
      fullName: it.repository || "",
      description: it.description || "",
      categories: it.categories || [],
      stars: it.stars,
      stars7dDelta: it.stars7dDelta,
    };
    // 逐条取详情(带宽松错误容错:详情失败不阻断整目录)。
    if (href) {
      const det = await get(URLS.leaderboard.detail(href));
      if (det.ok && det.json && det.json.plugin) {
        const p = det.json.plugin;
        raw = Object.assign({}, raw, {
          name: p.name || raw.fullName,
          description: p.description || raw.description,
          categories: p.categories || raw.categories,
          stars: p.stars !== undefined ? p.stars : raw.stars,
          stars7dDelta: raw.stars7dDelta,
          forks: p.forks,
          updatedAt: p.updatedAt || "",
          verificationStatus: p.verificationStatus || "",
          installPath: p.installPath || "",
          htmlUrl: p.repository ? "https://github.com/" + p.repository : "",
        });
      }
    }
    items.push(normalizeItem("leaderboard", raw));
  }
  const meta = {
    count: items.length,
    pluginsTracked: cj.json.metrics && cj.json.metrics.pluginsTracked,
    categories: (cj.json.facets && cj.json.facets.categories) || [],
    sourceUrl: URLS.leaderboard.catalog,
  };
  return { ok: true, items, meta, ts: Date.now() };
}

/**
 * 爬取器:radar —— data/snapshots 最新快照的 catalog_entries。
 * 每个条目带雷达运行级判定(verdict)与领域(domain)。
 */
async function crawlRadar(fetchJson) {
  const get = async (url) => {
    const r = await fetchJson(url, 8 * 1024 * 1024);
    if (!r.ok) return { ok: false, error: r.error || "抓取失败" };
    try { return { ok: true, json: JSON.parse(r.text) }; }
    catch (e) { return { ok: false, error: "JSON 解析失败: " + String(e && e.message ? e.message : e) }; }
  };
  const lj = await get(URLS.radar.snapshots);
  if (!lj.ok) return { ok: false, error: lj.error };
  const files = Array.isArray(lj.json) ? lj.json : [];
  const names = files.filter((f) => f && typeof f.name === "string" && /\.json$/.test(f.name)).map((f) => f.name).sort();
  const latest = names[names.length - 1];
  if (!latest) return { ok: false, error: "雷达快照列表为空" };
  const sj = await get(URLS.radar.snapshot(latest));
  if (!sj.ok) return { ok: false, error: sj.error };
  const entries = Array.isArray(sj.json.catalog_entries) ? sj.json.catalog_entries : [];
  const items = entries.map((e) => {
    const or = ownerRepoFrom(e.url, e.name);
    const raw = {
      fullName: or ? or.owner + "/" + or.repo : (String(e.name || "")),
      name: String(e.name || ""),
      description: String(e.desc || ""),
      stars: e.star,
      htmlUrl: e.url || "",
      categories: e.domain ? [String(e.domain)] : [],
      verificationStatus: String(e.verdict || ""),
      topics: [],
    };
    return normalizeItem("radar", raw);
  });
  const meta = {
    count: items.length,
    runId: sj.json.run_id,
    generatedAt: sj.json.generated_at,
    sourceUrl: URLS.radar.snapshot(latest),
  };
  return { ok: true, items, meta, ts: Date.now() };
}

/**
 * 按源抓取(带进程内 10 分钟快照缓存)。
 * @param source github|marketplace|leaderboard|radar
 * @param fetchJson 宿主 JSON 抓取函数
 */
export async function crawlStore(source, fetchJson) {
  const key = source;
  if (key === "github") {
    // GitHub 搜索由宿主 gpStoreSearch 直接处理(保持原行为与分页),这里不代理。
    return { ok: false, error: "github 源请走宿主原搜索路径", handledBy: "host" };
  }
  const cache = key === "marketplace" ? SNAPSHOTS.marketplace
    : key === "leaderboard" ? SNAPSHOTS.leaderboard
    : key === "radar" ? SNAPSHOTS.radar : null;
  if (cache && cache.at && Date.now() - cache.at < SNAPSHOT_TTL) {
    return Object.assign({ ok: true, cached: true, at: cache.at }, cache.data);
  }
  let res = null;
  if (key === "marketplace") res = await crawlMarketplace(fetchJson);
  else if (key === "leaderboard") res = await crawlLeaderboard(fetchJson);
  else if (key === "radar") res = await crawlRadar(fetchJson);
  else return { ok: false, error: "未知源: " + source };
  if (res.ok && SNAPSHOTS[key]) SNAPSHOTS[key] = { at: Date.now(), data: res };
  return res;
}

/** 本地按关键词过滤归一化 items(name/repo/fullName/description/categories 命中)。 */
export function filterItems(items, q) {
  const kw = String(q || "").trim().toLowerCase();
  if (kw === "") return items;
  return items.filter((it) => {
    const hay = [it.fullName, it.name, it.repo, it.description, (it.categories || []).join(" "), (it.packageName || ""), (it.topics || []).join(" ")]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.indexOf(kw) >= 0;
  });
}

/** 从归一化 item 取出用于安装的仓库引用(只接受能安全交给 GitHub 抓取的 owner/repo)。 */
export function installRepoOf(item) {
  if (!item) return null;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(item.fullName || "")) return item.fullName;
  if (item.owner && item.repo) return item.owner + "/" + item.repo;
  return null;
}

export { SNAPSHOTS, SNAPSHOT_TTL, URLS };

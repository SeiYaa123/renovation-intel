const fs = require("fs");
const path = require("path");
const Bottleneck = require("bottleneck");
const platforms = require("./platforms");
const {
  cheerio,
  extractFromJsonLd,
  extractBySelectors,
  bestPrice,
} = require("./extract");

const limiter = new Bottleneck({ maxConcurrent: 2, minTime: 400 });
const SUPPLIERS_FILE = path.join(__dirname, "..", "data", "suppliers.json");
const CACHE_FILE = path.join(__dirname, "..", "data", "price_cache.json");
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function loadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function normalizeBase(url = "") {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RenovationIntelBot/1.0 (+contact@example.com)",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// Détection plateforme par heuristiques HTML
function detectPlatformFromHtml(html) {
  const $ = cheerio.load(html);
  const gen = $('meta[name="generator"]').attr("content")?.toLowerCase() || "";
  const scripts = $("script[src]")
    .map((_, el) => $(el).attr("src"))
    .get()
    .join(" ");
  const classes = $("body").attr("class") || "";

  if (
    scripts.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    html.includes("window.Shopify")
  )
    return "shopify";
  if (
    gen.includes("woocommerce") ||
    gen.includes("wordpress") ||
    scripts.includes("woocommerce") ||
    html.includes("wc-add-to-cart")
  )
    return "woocommerce";
  if (gen.includes("prestashop") || html.toLowerCase().includes("prestashop"))
    return "prestashop";
  if (
    gen.includes("magento") ||
    html.includes("mage/requirejs") ||
    classes.includes("catalogsearch")
  )
    return "magento";
  return null;
}

async function detectPlatform(base) {
  try {
    const html = await limiter.schedule(() => fetchHtml(base));
    return detectPlatformFromHtml(html);
  } catch {
    return null;
  }
}

async function trySearchForPlatform(base, plat, q) {
  const p = platforms[plat];
  if (!p) throw new Error(`Unknown platform ${plat}`);
  const url = p.buildSearchUrl(base, q);
  const listing = await limiter.schedule(() => fetchHtml(url));
  const $ = cheerio.load(listing);

  // 1) prix sur la liste
  const listPrice = extractBySelectors($, [p.listPriceSelector]);

  // 2) lien produit
  let link =
    $(p.listItemSelector).first().attr("href") ||
    $('a[href*="product"], a[href*="/products/"]').first().attr("href");
  if (!link)
    return {
      search_url: url,
      product_url: null,
      productPrice: listPrice || null,
    };
  if (link.startsWith("/")) link = base.replace(/\/$/, "") + link;

  // 3) page produit
  const prod = await limiter.schedule(() => fetchHtml(link));
  const $$ = cheerio.load(prod);
  const candidates = [
    ...extractFromJsonLd($$),
    extractBySelectors($$, [p.detailPriceSelector]),
  ].filter(Boolean);
  const productPrice = bestPrice(candidates);
  return {
    search_url: url,
    product_url: link,
    productPrice: productPrice || listPrice || null,
  };
}

async function tryGenericPatterns(base, q) {
  for (const build of platforms.genericPatterns) {
    try {
      const url = build(base, q);
      const listing = await limiter.schedule(() => fetchHtml(url));
      const $ = cheerio.load(listing);
      const link = $('a[href*="product"], a[href*="/products/"]')
        .first()
        .attr("href");
      if (!link) continue;
      const full = link.startsWith("/") ? base.replace(/\/$/, "") + link : link;
      const prod = await limiter.schedule(() => fetchHtml(full));
      const $$ = cheerio.load(prod);
      const price = bestPrice([
        ...extractFromJsonLd($$),
        extractBySelectors($$, [".price", ".amount", '[itemprop="price"]']),
      ]);
      if (price)
        return { search_url: url, product_url: full, productPrice: price };
    } catch {
      /* essayer pattern suivant */
    }
  }
  return null;
}

function pickSuppliers({ limit, ids }) {
  const all = loadJson(SUPPLIERS_FILE) || [];
  let list = all.filter((s) => s.website && normalizeBase(s.website));
  if (ids?.length) list = list.filter((s) => ids.includes(Number(s.id)));
  if (limit) list = list.slice(0, limit);
  return list.map((s) => ({
    supplier_id: s.id,
    name: s.name,
    base: normalizeBase(s.website),
  }));
}

function readCache() {
  return loadJson(CACHE_FILE) || { entries: {} };
}
function writeCache(c) {
  saveJson(CACHE_FILE, c);
}
function cacheKey(base, q) {
  return `${base}::${q.toLowerCase()}`;
}

async function scrapePricesFromSuppliers(query, { limit = 12, ids = [] } = {}) {
  const suppliers = pickSuppliers({ limit, ids });
  const cache = readCache();
  const now = Date.now();

  const tasks = suppliers.map(async (s) => {
    const key = cacheKey(s.base, query);
    const cached = cache.entries[key];
    if (cached && now - cached.ts < CACHE_TTL_MS) return cached.item;

    try {
      const plat = await detectPlatform(s.base);
      let result = null;
      if (plat) result = await trySearchForPlatform(s.base, plat, query);
      if (!result || !result.productPrice)
        result = await tryGenericPatterns(s.base, query);
      if (!result || !result.productPrice) return null;

      const out = {
        supplier_id: s.supplier_id,
        supplier_name: s.name,
        source_platform: plat || "unknown",
        query,
        search_url: result.search_url,
        product_url: result.product_url,
        price_value: result.productPrice.value,
        currency: result.productPrice.currency || "EUR",
      };

      cache.entries[key] = { ts: now, item: out };
      return out;
    } catch {
      return null;
    } finally {
      writeCache(cache);
    }
  });

  const results = (await Promise.all(tasks))
    .filter(Boolean)
    .sort((a, b) => (a.price_value ?? 1e9) - (b.price_value ?? 1e9));

  return results;
}

module.exports = { scrapePricesFromSuppliers };

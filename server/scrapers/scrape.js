// server/scrapers/scrape.js
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

const DEBUG = process.env.DEBUG_SCRAPE === "1";

// récupère overrides + patterns génériques s'ils existent
const { domainOverrides, genericPatterns } = platforms;

const limiter = new Bottleneck({ maxConcurrent: 2, minTime: 400 });

const SUPPLIERS_FILE = path.join(__dirname, "..", "data", "suppliers.json");
const CACHE_FILE = path.join(__dirname, "..", "data", "price_cache.json");
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// ---------- helpers prix & pertinence ----------
function normalizePrice(input) {
  if (!input) return null;
  // { value, currency }
  if (typeof input === "object" && input.value != null) {
    const v = Number(String(input.value).replace(",", "."));
    if (isFinite(v) && v > 0)
      return { value: v, currency: input.currency || "EUR" };
    return null;
  }
  // "€129,90" / "129.90"
  const txt = String(input).replace(/\s/g, "");
  const m = txt.match(/(\d+[.,]?\d*)/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  if (!isFinite(v) || v <= 0) return null;
  return { value: v, currency: /€|eur/i.test(txt) ? "EUR" : "EUR" };
}

function looksRelevantTitle(q, title) {
  if (!q || !title) return true;
  const qt = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const tt = title.toLowerCase();
  return qt.some((t) => tt.includes(t));
}

// ---------- fs/json ----------
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

// ---------- HTTP util (timeout) ----------
async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000); // 8s
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RenovationIntelBot/1.0 (+contact@example.com)",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ---------- détection plateforme ----------
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

// ---------- search selon plateforme ----------
async function trySearchForPlatform(base, plat, q) {
  const p = platforms[plat];
  if (!p) throw new Error(`Unknown platform ${plat}`);
  const url = p.buildSearchUrl(base, q);
  const listing = await limiter.schedule(() => fetchHtml(url));
  const $ = cheerio.load(listing);

  const listPrice = extractBySelectors($, [p.listPriceSelector]);

  let link =
    $(p.listItemSelector).first().attr("href") ||
    $('a[href*="product"], a[href*="/products/"]').first().attr("href");
  if (!link) {
    return {
      search_url: url,
      product_url: null,
      productPrice: normalizePrice(listPrice),
    };
  }
  if (link.startsWith("/")) link = base.replace(/\/$/, "") + link;

  const prod = await limiter.schedule(() => fetchHtml(link));
  const $$ = cheerio.load(prod);
  const candidates = [
    ...extractFromJsonLd($$),
    extractBySelectors($$, [p.detailPriceSelector]),
  ].filter(Boolean);

  const productPrice =
    normalizePrice(bestPrice(candidates)) || normalizePrice(listPrice);
  if (!productPrice)
    return { search_url: url, product_url: link, productPrice: null };

  // filtre simple par titre
  const title = $$('h1,[itemprop="name"],.product-title,.page-title')
    .first()
    .text()
    .trim();
  if (!looksRelevantTitle(q, title))
    return { search_url: url, product_url: link, productPrice: null };

  return { search_url: url, product_url: link, productPrice };
}

// ---------- fallback patterns génériques ----------
const safeGenericPatterns = Array.isArray(genericPatterns)
  ? genericPatterns
  : [
      (base, q) => `${base}/search?q=${encodeURIComponent(q)}`,
      (base, q) => `${base}/fr/search?q=${encodeURIComponent(q)}`,
      (base, q) => `${base}/nl/search?q=${encodeURIComponent(q)}`,
      (base, q) => `${base}/recherche?q=${encodeURIComponent(q)}`,
      (base, q) => `${base}/zoeken?q=${encodeURIComponent(q)}`,
      (base, q) => `${base}/catalogsearch/result/?q=${encodeURIComponent(q)}`, // Magento
      (base, q) => `${base}/?s=${encodeURIComponent(q)}`, // WordPress
    ];

async function tryGenericPatterns(base, q) {
  for (const build of safeGenericPatterns) {
    try {
      const url = build(base, q);
      const listing = await limiter.schedule(() => fetchHtml(url));
      const $ = cheerio.load(listing);

      let link = $('a[href*="product"], a[href*="/products/"]')
        .first()
        .attr("href");
      if (!link) continue;
      if (link.startsWith("/")) link = base.replace(/\/$/, "") + link;

      const prod = await limiter.schedule(() => fetchHtml(link));
      const $$ = cheerio.load(prod);
      const price = normalizePrice(
        bestPrice([
          ...extractFromJsonLd($$),
          extractBySelectors($$, [
            ".price-wrapper [data-price-amount]",
            "meta[itemprop='price']",
            ".price",
            ".amount",
            "[itemprop='price']",
          ]),
        ])
      );
      if (!price) continue;

      const title = $$('h1,[itemprop="name"],.product-title,.page-title')
        .first()
        .text()
        .trim();
      if (!looksRelevantTitle(q, title)) continue;

      return { search_url: url, product_url: link, productPrice: price };
    } catch {
      // essayer pattern suivant
    }
  }
  return null;
}

// ---------- sélection fournisseurs & cache ----------
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

// ---------- MAIN ----------
async function scrapePricesFromSuppliers(query, { limit = 12, ids = [] } = {}) {
  const suppliers = pickSuppliers({ limit, ids });
  const cache = readCache();
  const now = Date.now();

  const tasks = suppliers.map(async (sup) => {
    const key = cacheKey(sup.base, query);
    const cached = cache.entries[key];
    if (cached && now - cached.ts < CACHE_TTL_MS) return cached.item;
    if (DEBUG) console.log("[SCRAPE] checking", sup.name, sup.base);

    try {
      let result = null;

      // 1) Domain override si dispo
      try {
        const host = new URL(sup.base).hostname.replace(/^www\./, "");
        const override = domainOverrides && domainOverrides[host];
        if (override) {
          if (DEBUG) console.log("[SCRAPE] domain override", sup.name, host);
          const url = override.buildSearchUrl(sup.base, query);
          const listing = await limiter.schedule(() => fetchHtml(url));
          const $ = cheerio.load(listing);

          let link =
            $(override.listItemSelector).first().attr("href") ||
            $('a[href*="product"], a[href*="/products/"]').first().attr("href");

          if (link) {
            if (link.startsWith("/")) link = sup.base.replace(/\/$/, "") + link;

            const prod = await limiter.schedule(() => fetchHtml(link));
            const $$ = cheerio.load(prod);

            const candidates = [
              ...extractFromJsonLd($$),
              extractBySelectors($$, [override.detailPriceSelector]),
            ].filter(Boolean);

            const productPrice =
              normalizePrice(bestPrice(candidates)) ||
              normalizePrice(
                extractBySelectors($$, [override.listPriceSelector])
              );

            if (productPrice) {
              const title = $$(
                'h1,[itemprop="name"],.product-title,.page-title'
              )
                .first()
                .text()
                .trim();
              if (looksRelevantTitle(query, title)) {
                result = { search_url: url, product_url: link, productPrice };
              }
            }
          }
        }
      } catch (e) {
        if (DEBUG)
          console.log("[SCRAPE] override fail", sup.name, e?.message || e);
      }

      // 2) Détection plateforme
      if (!result) {
        const plat = await detectPlatform(sup.base);
        if (DEBUG)
          console.log("[SCRAPE] platform", sup.name, plat || "unknown");
        if (plat) result = await trySearchForPlatform(sup.base, plat, query);
      }

      // 3) Fallback générique
      if (!result || !result.productPrice)
        result = await tryGenericPatterns(sup.base, query);

      if (!result || !result.productPrice) return null;

      const out = {
        supplier_id: sup.supplier_id,
        supplier_name: sup.name,
        source_platform: "override_or_detected",
        query,
        search_url: result.search_url,
        product_url: result.product_url,
        price_value: result.productPrice.value,
        currency: result.productPrice.currency || "EUR",
      };
      if (DEBUG)
        console.log(
          "[SCRAPE] found",
          sup.name,
          out.product_url,
          out.price_value
        );

      cache.entries[key] = { ts: now, item: out };
      return out;
    } catch (e) {
      if (DEBUG) console.error("[SCRAPE] fail", sup.name, e?.message || e);
      return null;
    }
  });

  const results = (await Promise.all(tasks))
    .filter(Boolean)
    .sort((a, b) => (a.price_value ?? 1e9) - (b.price_value ?? 1e9));

  // écriture du cache UNE SEULE FOIS
  try {
    writeCache(cache);
  } catch (e) {
    if (DEBUG) console.error("[CACHE] write fail", e?.message || e);
  }

  return results;
}

module.exports = { scrapePricesFromSuppliers };

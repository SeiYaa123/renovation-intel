const cheerio = require("cheerio");

const PRICE_RE = /(?:€|\$|£)\s?[\d\s.,]+|[\d\s.,]+\s?(?:€|\$|£)/;

function parsePriceText(txt) {
  if (!txt) return null;
  const m = String(txt).match(PRICE_RE);
  if (!m) return null;
  let s = m[0].replace(/\s/g, "");
  let currency = "EUR";
  if (s.includes("$")) currency = "USD";
  if (s.includes("£")) currency = "GBP";
  s = s.replace(/[€$£]/g, "");
  // EU vs US
  if (/,/.test(s) && /\.\d{3}/.test(s))
    s = s.replace(/\./g, "").replace(",", ".");
  else if (/,/.test(s) && !/\.\d{2}$/.test(s))
    s = s.replace(/\./g, "").replace(",", ".");
  const val = Number(s);
  return Number.isFinite(val) ? { value: val, currency } : null;
}

function extractFromJsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text().trim());
      const arr = Array.isArray(json) ? json : [json];
      for (const obj of arr) {
        if (!obj) continue;
        const t = obj["@type"];
        const isProd =
          t === "Product" || (Array.isArray(t) && t.includes("Product"));
        if (!isProd) continue;
        const offers =
          obj.offers || obj.aggregateOffer || obj.aggregateOffers || obj.Offer;
        const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const o of list) {
          const price = parsePriceText(o?.price || o?.lowPrice || o?.highPrice);
          if (price) {
            if (o?.priceCurrency) price.currency = o.priceCurrency;
            out.push(price);
          }
        }
      }
    } catch {}
  });
  return out;
}

function extractBySelectors($, selectors = []) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el && el.length) {
      const v = parsePriceText(el.text() || el.attr("content"));
      if (v) return v;
    }
  }
  const guess = $(
    '[class*="price"], [class*="prix"], [class*="amount"], [id*="price"], [itemprop="price"]'
  ).first();
  if (guess.length) {
    const v = parsePriceText(guess.text() || guess.attr("content"));
    if (v) return v;
  }
  return null;
}

function bestPrice(candidates = []) {
  return (
    candidates
      .filter(Boolean)
      .sort((a, b) => (a.value ?? 1e12) - (b.value ?? 1e12))[0] || null
  );
}

module.exports = {
  parsePriceText,
  extractFromJsonLd,
  extractBySelectors,
  bestPrice,
  cheerio,
};

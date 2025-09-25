const { load } = require("cheerio");
const fetch = global.fetch;

async function fetchHtmlList(url, { rowSelector, map }) {
  const res = await fetch(url, {
    headers: { "User-Agent": "RenovationIntelBot/1.0" },
  });
  if (!res.ok) throw new Error(`HTML HTTP ${res.status}`);
  const $ = load(await res.text());
  const out = [];
  $(rowSelector).each((_, el) => out.push(map($, el)));
  return out.filter(Boolean);
}

module.exports = { fetchHtmlList };

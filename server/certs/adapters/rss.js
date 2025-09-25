const { parseStringPromise } = require("xml2js");
const fetch = global.fetch;

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "RenovationIntelBot/1.0" },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const js = await parseStringPromise(xml, { explicitArray: false });
  const items = js?.rss?.channel?.item || js?.feed?.entry || [];
  const list = Array.isArray(items) ? items : [items];
  return list.map((it) => ({
    name: it.title || it?.["title"]?.["_"],
    summary: it.description || it.summary || "",
    docs_url: (it.link?.href || it.link || "").toString(),
  }));
}

module.exports = { fetchRss };

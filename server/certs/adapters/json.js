const fetch = global.fetch;

async function fetchJson(url, map) {
  const res = await fetch(url, {
    headers: { "User-Agent": "RenovationIntelBot/1.0" },
  });
  if (!res.ok) throw new Error(`JSON HTTP ${res.status}`);
  const data = await res.json();
  return map(data);
}
module.exports = { fetchJson };

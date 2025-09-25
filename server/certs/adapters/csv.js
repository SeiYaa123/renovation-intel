const { parse } = require("csv-parse/sync");
const fetch = global.fetch;

async function fetchCsv(url, map) {
  const res = await fetch(url, {
    headers: { "User-Agent": "RenovationIntelBot/1.0" },
  });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return rows.map(map).filter(Boolean);
}
module.exports = { fetchCsv };

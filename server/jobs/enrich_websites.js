// server/jobs/enrich_websites.js
// Usage: node jobs/enrich_websites.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "suppliers.json");

function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}
function save(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
}
function domainFromEmail(email) {
  if (!email) return null;
  const m = String(email).match(/@([^>@\s]+)/);
  return m ? normUrl(m[1]) : null;
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return true;
    const g = await fetch(url, { method: "GET" });
    return g.ok;
  } catch {
    return false;
  }
}

// --- Wikidata helpers ---
async function wikidataWebsiteFromId(qid) {
  if (!qid) return null;
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const entity = json?.entities?.[qid];
    const p856 = entity?.claims?.P856?.[0]?.mainsnak?.datavalue?.value; // official website
    return normUrl(p856);
  } catch {
    return null;
  }
}

async function wikidataSearchWebsiteByName(name, city) {
  try {
    const search = encodeURIComponent(`${name} ${city || ""}`.trim());
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${search}&language=fr&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const js = await res.json();
    const id = js?.search?.[0]?.id;
    if (!id) return null;
    return await wikidataWebsiteFromId(id);
  } catch {
    return null;
  }
}

(async () => {
  const list = load();
  let updated = 0,
    checked = 0;

  for (const s of list) {
    checked++;
    if (s.website) continue;

    // 1) domaine via email
    const byEmail = domainFromEmail(s.email);
    if (byEmail && (await headOk(byEmail))) {
      s.website = byEmail;
      updated++;
      continue;
    }

    // 2) via Wikidata (tag wikidata)
    const qid = s.meta?.wikidata;
    const byQid = await wikidataWebsiteFromId(qid);
    if (byQid && (await headOk(byQid))) {
      s.website = byQid;
      updated++;
      continue;
    }

    // 3) via recherche Wikidata (nom + ville)
    const bySearch = await wikidataSearchWebsiteByName(s.name, s.city);
    if (bySearch && (await headOk(bySearch))) {
      s.website = bySearch;
      updated++;
      continue;
    }

    // rester poli
    await sleep(200);
  }

  save(list);
  console.log(
    `✅ Enrichment done. ${updated} suppliers updated with website (checked ${checked}).`
  );
})();

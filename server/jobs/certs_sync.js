// server/jobs/certs_sync.js
const fs = require("fs");
const path = require("path");
const sources = require("../certs/sources");

const CERTS_FILE = path.join(__dirname, "..", "data", "certifications.json");
function loadDb() {
  if (!fs.existsSync(CERTS_FILE)) return { items: [], meta: {} };
  try {
    return JSON.parse(fs.readFileSync(CERTS_FILE, "utf8"));
  } catch {
    return { items: [], meta: {} };
  }
}
function saveDb(db) {
  fs.mkdirSync(path.dirname(CERTS_FILE), { recursive: true });
  fs.writeFileSync(CERTS_FILE, JSON.stringify(db, null, 2), "utf8");
}
const slugify = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

(async () => {
  console.log("🔎 Sync certifications from", sources.length, "sources…");
  const db = loadDb();
  db.meta = db.meta || {};
  const now = new Date().toISOString();

  let added = 0,
    updated = 0;

  for (const src of sources) {
    try {
      const { items, checksum } = await src.collect();
      const key = `source:${src.id}`;
      const prevSum = db.meta[key]?.checksum;
      const changed = checksum && prevSum && checksum !== prevSum;

      for (const it of items) {
        const slug = slugify(it.slug || it.name);
        const idx = db.items.findIndex((x) => x.slug === slug);
        const record = {
          ...it,
          slug,
          updatedAt: now,
          source_id: src.id,
        };
        if (idx >= 0) {
          db.items[idx] = { ...db.items[idx], ...record };
          updated++;
        } else {
          db.items.push(record);
          added++;
        }
      }
      db.meta[key] = {
        checksum,
        lastSync: now,
        url: src.url,
        jurisdiction: src.jurisdiction,
      };
      console.log(
        `✓ ${src.id} -> ${items.length} item(s) ${changed ? "(CHANGED)" : ""}`
      );
    } catch (e) {
      console.error(`✗ ${src.id} failed:`, e.message || e);
    }
  }

  // dédup (sécurité)
  const seen = new Set();
  db.items = db.items.filter((x) =>
    seen.has(x.slug) ? false : (seen.add(x.slug), true)
  );

  saveDb(db);
  console.log(`✅ Done. +${added} / ~${updated} (total ${db.items.length})`);
})();

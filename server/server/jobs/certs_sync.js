const fs = require("fs");
const path = require("path");
const sources = require("../certs/sources");

const CERTS_FILE = path.join(__dirname, "..", "data", "certifications.json");

function loadCerts() {
  if (!fs.existsSync(CERTS_FILE)) return { items: [] };
  try { return JSON.parse(fs.readFileSync(CERTS_FILE, "utf8")); } catch { return { items: [] }; }
}
function saveCerts(db) {
  fs.mkdirSync(path.dirname(CERTS_FILE), { recursive: true });
  fs.writeFileSync(CERTS_FILE, JSON.stringify(db, null, 2), "utf8");
}
function slugify(s="") {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}

(async () => {
  const db = loadCerts();
  const now = new Date().toISOString();
  let upserts = 0;

  for (const src of sources) {
    try {
      const list = await src.fetch();
      for (const c of list) {
        const name = (c.name || "").trim();
        if (!name) continue;
        const slug = slugify(name);
        const idx = db.items.findIndex(x => x.slug === slug);
        const item = {
          name,
          slug,
          type: src.type || c.type || null,
          jurisdiction: src.jurisdiction || c.jurisdiction || null,
          issuer: src.issuer || c.issuer || null,
          summary: c.summary || null,
          official_register_url: c.official_register_url || null,
          docs_url: c.docs_url || null,
          tags: c.tags || [],
          status: c.status || "active",
          aliases: c.aliases || [],
          updatedAt: now
        };
        if (idx >= 0) db.items[idx] = { ...db.items[idx], ...item, updatedAt: now };
        else db.items.push(item);
        upserts++;
      }
      console.log(`✅ ${src.key}: ${list.length} items`);
    } catch (e) {
      console.error(`❌ ${src.key}`, e?.message || e);
    }
  }

  // dédoublonnage basique par slug
  const seen = new Set();
  db.items = db.items.filter((x) => {
    if (seen.has(x.slug)) return false;
    seen.add(x.slug);
    return true;
  });

  saveCerts(db);
  console.log(`Done. Upserts: ${upserts} · Total: ${db.items.length}`);
})();

// server/index.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { spawn } = require("child_process");
const multer = require("multer");
const { parse } = require("csv-parse/sync");

// ---------- APP ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- UTILS FICHIERS ----------
const SUPPLIERS_FILE = path.join(__dirname, "data", "suppliers.json");
const CERTS_FILE = path.join(__dirname, "data", "certifications.json");

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function loadSuppliers() {
  return loadJson(SUPPLIERS_FILE, []);
}
function loadCerts() {
  return loadJson(CERTS_FILE, { items: [] });
}
function saveCerts(db) {
  saveJson(CERTS_FILE, db);
}

const slugify = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------- LOGS GLOBALS ----------
process.on("unhandledRejection", (err) =>
  console.error("[UNHANDLED REJECTION]", err)
);
process.on("uncaughtException", (err) =>
  console.error("[UNCAUGHT EXCEPTION]", err)
);

// ---------- MINI SCORER & DISTANCE ----------
function scoreLike(haystack, needle) {
  const q = (needle || "").toLowerCase().trim();
  const h = (haystack || "").toLowerCase();
  if (!q) return 1;
  if (!h) return 0;
  if (h.includes(q)) return 1;
  const qTokens = q.split(/[^a-z0-9]+/i).filter(Boolean);
  const hSet = new Set(h.split(/[^a-z0-9]+/i).filter(Boolean));
  if (qTokens.length === 0) return 0;
  let matches = 0;
  for (const t of qTokens) if (hSet.has(t)) matches++;
  return matches / qTokens.length; // 0..1
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371,
    toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

// ---------- HEALTH ----------
app.get("/api/ping", (_req, res) => res.json({ ok: true }));

// ---------- SUPPLIERS ----------
app.get("/api/suppliers", (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const eco = (req.query.eco || "").toString().trim().toUpperCase();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const origin = lat != null && lng != null ? { lat, lng } : null;
  const maxKm = req.query.maxKm ? Number(req.query.maxKm) : null;
  const sort = (req.query.sort || "").toString(); // '', 'distance','rating_desc','price_asc'
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 100);
  const page = Math.max(Number(req.query.page || 1), 1);

  let items = loadSuppliers();

  if (eco) items = items.filter((s) => (s.eco || "").toUpperCase() === eco);

  if (q) {
    items = items
      .map((s) => {
        const hay = `${s.name || ""} ${(s.certifications || []).join(" ")} ${
          s.city || ""
        }`;
        return { s, sc: scoreLike(hay, q) };
      })
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .map((x) => x.s);
  }

  items = items.map((s) => {
    const sLoc =
      s.lat != null && s.lng != null
        ? { lat: Number(s.lat), lng: Number(s.lng) }
        : null;
    const distanceKm = origin && sLoc ? haversineKm(origin, sLoc) : null;
    return { ...s, distanceKm };
  });

  if (maxKm != null)
    items = items.filter((s) => s.distanceKm != null && s.distanceKm <= maxKm);

  if (sort === "distance" && origin) {
    items.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } else if (sort === "rating_desc") {
    items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sort === "price_asc") {
    items.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  }

  const total = items.length;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);

  res.json({ total, page, limit, items: slice });
});

// debug: suppliers avec website
app.get("/api/suppliers/sites", (req, res) => {
  try {
    const all = loadSuppliers();
    const items = all
      .filter((s) => s.website)
      .map((s) => ({ id: s.id, name: s.name, website: s.website }));
    res.json({ total: items.length, items });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------- SCRAPING PRIX ----------
app.get("/api/scrape-prices", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const limit = req.query.limit ? Number(req.query.limit) : 8;
  const ids = req.query.ids
    ? String(req.query.ids).split(",").map(Number).filter(Boolean)
    : [];
  if (!q) return res.json({ query: q, items: [] });

  try {
    const { scrapePricesFromSuppliers } = require("./scrapers/scrape");
    const items = await scrapePricesFromSuppliers(q, { limit, ids });
    res.json({ query: q, items });
  } catch (e) {
    console.error("scrape-prices error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/compare-prices", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const sell = req.query.sell ? Number(req.query.sell) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const ids = req.query.ids
    ? String(req.query.ids).split(",").map(Number).filter(Boolean)
    : [];
  if (!q) return res.json({ query: q, sell, items: [] });

  try {
    const { scrapePricesFromSuppliers } = require("./scrapers/scrape");
    const raw = await scrapePricesFromSuppliers(q, { limit, ids });

    const FX = { EUR: 1, USD: 0.93, GBP: 1.17 };
    const items = (raw || [])
      .map((r) => {
        const fx = FX[r.currency] ?? 1;
        const cost_eur = r.price_value != null ? r.price_value * fx : null;
        const margin_abs =
          sell != null && cost_eur != null ? sell - cost_eur : null;
        const margin_pct =
          sell != null && cost_eur != null && sell > 0
            ? ((sell - cost_eur) / sell) * 100
            : null;
        return {
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          product_url: r.product_url,
          currency: r.currency,
          price_value: r.price_value,
          cost_eur,
          margin_abs,
          margin_pct,
        };
      })
      .filter((x) => x.cost_eur != null)
      .sort((a, b) =>
        sell == null
          ? a.cost_eur - b.cost_eur
          : (b.margin_abs ?? -1e9) - (a.margin_abs ?? -1e9)
      );

    res.json({ query: q, sell, items });
  } catch (e) {
    console.error("compare-prices error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// ---------- CERTIFICATIONS ----------
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/certs/import-csv", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const csv = req.file.buffer.toString("utf8");
    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const db = loadCerts();
    const now = new Date().toISOString();
    let upserted = 0;

    for (const r of rows) {
      const name = (r.name || "").trim();
      if (!name) continue;
      const slug = slugify(r.slug || name);
      const idx = db.items.findIndex((x) => x.slug === slug);
      const item = {
        name,
        slug,
        type: (r.type || "").toLowerCase() || null,
        jurisdiction: (r.jurisdiction || "").toUpperCase() || null,
        issuer: r.issuer || null,
        summary: r.summary || null,
        official_register_url: r.official_register_url || null,
        docs_url: r.docs_url || null,
        tags: r.tags
          ? r.tags
              .split("|")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        status: (r.status || "active").toLowerCase(),
        aliases: r.aliases
          ? r.aliases
              .split("|")
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        updatedAt: now,
      };
      if (idx >= 0)
        db.items[idx] = { ...db.items[idx], ...item, updatedAt: now };
      else db.items.push(item);
      upserted++;
    }

    saveCerts(db);
    res.json({ ok: true, upserted, total: db.items.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Recherche certifs
app.get("/api/certs", (req, res) => {
  const q = (req.query.q || "").toString().trim().toLowerCase();
  const type = (req.query.type || "").toString().trim().toLowerCase();
  const jurisdiction = (req.query.jurisdiction || "")
    .toString()
    .trim()
    .toUpperCase();
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

  const db = loadCerts();
  let items = db.items;

  if (type) items = items.filter((x) => (x.type || "").toLowerCase() === type);
  if (jurisdiction)
    items = items.filter(
      (x) => (x.jurisdiction || "").toUpperCase() === jurisdiction
    );
  if (q) {
    const toks = q.split(/[^a-z0-9]+/).filter(Boolean);
    items = items.filter((x) => {
      const hay = [
        x.name,
        x.slug,
        x.issuer,
        x.summary,
        ...(x.aliases || []),
        ...(x.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return toks.every((t) => hay.includes(t));
    });
  }
  res.json({ count: items.length, items: items.slice(0, limit) });
});

// Suggérer des certifs par métier via tags
const TRADE_TAGS = {
  electrician: [
    "électricité",
    "rgie",
    "incendie",
    "sécurité",
    "pv",
    "cctv",
    "alarme",
  ],
  plumber: ["plomberie", "gaz", "sanitaire", "chauffage", "sécurité", "hvac"],
  roofer: ["toiture", "étanchéité", "couverture", "isolation"],
  hvac: [
    "hvac",
    "réfrigération",
    "f-gas",
    "climatisation",
    "pac",
    "environnement",
  ],
  asbestos: ["amiante", "désamiantage", "réglementaire"],
  wood: ["bois", "traçabilité", "durable"],
  general: ["entreprise", "sécurité", "qualité", "marchés publics"],
};

app.get("/api/certs/suggest", (req, res) => {
  const trade = String(req.query.trade || "").toLowerCase();
  const jur = String(req.query.jurisdiction || "").toUpperCase();
  const tags = TRADE_TAGS[trade] || [];
  const db = loadCerts();

  let items = db.items;
  if (jur)
    items = items.filter((x) => (x.jurisdiction || "").toUpperCase() === jur);
  if (tags.length)
    items = items.filter((x) =>
      (x.tags || []).some((t) => tags.includes(t.toLowerCase()))
    );

  const essentials = db.items.filter(
    (x) =>
      (x.name || "").toLowerCase().includes("vca") ||
      (x.name || "").toLowerCase().includes("rgie")
  );
  const merged = [...items, ...essentials];
  const seen = new Set();
  const out = merged.filter((c) =>
    seen.has(c.slug) ? false : (seen.add(c.slug), true)
  );

  res.json({ trade, jurisdiction: jur || null, items: out });
});

// pondération simple d'essentiels par métier (en plus des tags)
const TRADE_ESSENTIAL_SLUGS = {
  electrician: [
    "rgie-be",
    "incert",
    "bosec",
    "rescert-installateur",
    "atg-ubatc",
  ],
  plumber: ["cerga", "rescert-installateur", "benor"],
  roofer: ["bcca-roofing", "atg-ubatc", "benor"],
  hvac: ["fgas-be", "rescert-installateur", "benor"],
};

app.get("/api/certs/suggest", (req, res) => {
  const trade = String(req.query.trade || "").toLowerCase();
  const jur = String(req.query.jurisdiction || "").toUpperCase();
  const tags = TRADE_TAGS[trade] || [];
  const db = loadCerts();

  let items = db.items;
  if (jur)
    items = items.filter((x) => (x.jurisdiction || "").toUpperCase() === jur);
  if (tags.length) {
    items = items.filter((x) =>
      (x.tags || []).some((t) => tags.includes(t.toLowerCase()))
    );
  }

  // Ajouter les essentiels de ce métier (si présents en base)
  const essentials = new Set(TRADE_ESSENTIAL_SLUGS[trade] || []);
  const plus = db.items.filter((x) => essentials.has(x.slug));

  const merged = [...items, ...plus];
  const seen = new Set();
  const out = merged.filter((c) =>
    seen.has(c.slug) ? false : (seen.add(c.slug), true)
  );

  res.json({ trade, jurisdiction: jur || null, items: out });
});

// [AJOUT] server/index.js — état des sources certifs
app.get("/api/certs/sources", (_req, res) => {
  try {
    const file = path.join(__dirname, "data", "certifications.json");
    if (!fs.existsSync(file)) return res.json({ items: [], meta: {} });
    const db = JSON.parse(fs.readFileSync(file, "utf8"));
    const meta = db.meta || {};
    const rows = Object.entries(meta).map(([k, v]) => ({
      id: k.replace(/^source:/, ""),
      ...v,
    }));
    res.json({ count: rows.length, items: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------- CRON (une seule fois) ----------
cron.schedule("30 3 * * *", () => {
  const job = path.join(__dirname, "jobs", "certs_sync.js");
  spawn(process.execPath, [job], { stdio: "inherit" });
});

// ---------- START ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Suppliers API running on http://localhost:${PORT}`);
});

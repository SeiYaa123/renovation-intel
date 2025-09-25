// server/index.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data", "suppliers.json");

function loadSuppliers() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

// --- petit scorer (pas de lib externe) ---
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

// --- distance Haversine (km) ---
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

app.get("/api/ping", (_req, res) => res.json({ ok: true }));

// /api/suppliers?q=&eco=&lat=&lng=&maxKm=&sort=&limit=&page=
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
  const { scrapePrices } = require("./scrapers/scrape");
  const { scrapePricesFromSuppliers } = require("./scrapers/scrape");

  // GET /api/scrape-prices?q=visseuse&limit=8&ids=1,3
  app.get("/api/scrape-prices", async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    const ids = req.query.ids
      ? String(req.query.ids)
          .split(",")
          .map((n) => Number(n))
          .filter(Boolean)
      : [];
    if (!q) return res.json({ query: q, items: [] });
    try {
      const items = await scrapePricesFromSuppliers(q, { limit, ids });
      res.json({ query: q, items });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ... tes autres routes

  // GET /api/scrape-prices?q=visseuse
  app.get("/api/scrape-prices", async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.json({ query: q, items: [] });
    try {
      const items = await scrapePrices(q);
      res.json({ query: q, items });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  let items = loadSuppliers();

  if (eco) items = items.filter((s) => (s.eco || "").toUpperCase() === eco);

  // scoring de pertinence simple
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

  // distance depuis (lat,lng)
  items = items.map((s) => {
    const sLoc =
      s.lat != null && s.lng != null
        ? { lat: Number(s.lat), lng: Number(s.lng) }
        : null;
    const distanceKm = origin && sLoc ? haversineKm(origin, sLoc) : null;
    return { ...s, distanceKm };
  });

  if (maxKm != null) {
    items = items.filter((s) => s.distanceKm != null && s.distanceKm <= maxKm);
  }

  // tri
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Suppliers API running on http://localhost:${PORT}`);
});

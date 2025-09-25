// server/jobs/osm_import.js
// Usage: node jobs/osm_import.js "Bruxelles, Belgium" 25

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const CITY =
  process.argv[2] || process.env.DEFAULT_CITY || "Bruxelles, Belgium";
const RADIUS_KM = Number(
  process.argv[3] || process.env.DEFAULT_RADIUS_KM || 25
);
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@example.com";

const DATA_FILE = path.join(__dirname, "..", "data", "suppliers.json");

function loadCurrent() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}
function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}
function slugify(s = "") {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function upsert(list, supplier) {
  const kWeb = supplier.website && slugify(supplier.website);
  const kNameCity = slugify(`${supplier.name}-${supplier.city || ""}`);
  const idx = list.findIndex(
    (s) =>
      (s.website && slugify(s.website) === kWeb) ||
      slugify(`${s.name}-${s.city || ""}`) === kNameCity
  );
  if (idx >= 0) list[idx] = { ...list[idx], ...supplier };
  else
    list.push({
      id: list.length ? Math.max(...list.map((x) => x.id || 0)) + 1 : 1,
      ...supplier,
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tag(obj, key) {
  return obj?.tags?.[key] || obj?.tags?.[`contact:${key}`] || null;
}
function cityFromTags(tags = {}) {
  return tags["addr:city"] || tags["addr:town"] || tags["addr:suburb"] || null;
}

async function geocodeCity(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    q
  )}`;
  const res = await fetch(url, {
    headers: { "User-Agent": `RenovationIntel/1.0 (${CONTACT_EMAIL})` },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const js = await res.json();
  if (!js?.length) throw new Error("City not found by Nominatim");
  return { lat: Number(js[0].lat), lon: Number(js[0].lon) };
}

function buildOverpassQL(lat, lon, radiusKm) {
  const R = Math.max(1, Math.min(50, Number(radiusKm))) * 1000; // m
  return `
[out:json][timeout:25];
(
  node(around:${R},${lat},${lon})["shop"="hardware"];
  node(around:${R},${lat},${lon})["shop"="doityourself"];
  node(around:${R},${lat},${lon})["shop"="tiles"];
  node(around:${R},${lat},${lon})["shop"="wood"];
  node(around:${R},${lat},${lon})["shop"="paint"];
  node(around:${R},${lat},${lon})["shop"="trade"]["trade"~"building_materials|timber|plumbing|electrical|tiles|construction"];
);
out body;
`;
}

(async () => {
  console.log(`🔎 OSM import around "${CITY}" (${RADIUS_KM} km)`);

  const current = loadCurrent();

  // 1) Géocodage
  const { lat, lon } = await geocodeCity(CITY);
  console.log(`📍 Center = ${lat.toFixed(5)}, ${lon.toFixed(5)}`);

  // 2) Requête Overpass
  const ql = buildOverpassQL(lat, lon, RADIUS_KM);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": `RenovationIntel/1.0 (${CONTACT_EMAIL})`,
    },
    body: new URLSearchParams({ data: ql }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Overpass HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  console.log(`📦 Overpass returned ${elements.length} elements`);

  // 3) Mapping -> suppliers
  let inserted = 0;
  for (const el of elements) {
    const name = tag(el, "name");
    if (!name) continue;

    const website = tag(el, "website") || tag(el, "url");
    const email = tag(el, "email");
    const supplier = {
      name,
      phone: tag(el, "phone"),
      email: email || null,
      website: website || null,
      eco: "B", // défaut
      rating: null,
      price: null,
      city: cityFromTags(el.tags) || CITY,
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
      certifications: [],
      meta: {
        wikidata: el.tags?.wikidata || el.tags?.["brand:wikidata"] || null,
        wikipedia: el.tags?.wikipedia || null,
      },
    };

    upsert(current, supplier);
    inserted++;
    // douceur API
    if (inserted % 50 === 0) await sleep(150);
  }

  // 4) Sauvegarde
  save(current);
  console.log(
    `✅ ${inserted} éléments traités · total en base: ${current.length}`
  );
})().catch((e) => {
  console.error("❌ OSM import failed:", e);
  process.exit(1);
});

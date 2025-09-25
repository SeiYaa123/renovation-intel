const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/import_csv.js data/suppliers.sample.csv");
  process.exit(1);
}

const raw = fs.readFileSync(input, "utf8");
const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

const out = rows.map((r, i) => ({
  id: i + 1,
  name: r.name?.trim(),
  phone: r.phone?.trim() || null,
  email: r.email?.trim() || null,
  website: r.website?.trim() || null,
  eco: (r.eco || "").trim().toUpperCase(),
  rating: r.rating ? Number(r.rating) : null,
  price: r.price ? Number(r.price) : null,
  city: r.city?.trim() || null,
  certifications: (r.certifications || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean),
}));

const outFile = path.join(path.dirname(input), "suppliers.json");
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${out.length} suppliers to ${outFile}`);

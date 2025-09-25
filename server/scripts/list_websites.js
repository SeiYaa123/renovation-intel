// server/scripts/list_websites.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "suppliers.json");
const outCSV = path.join(__dirname, "..", "data", "suppliers_with_sites.csv");

const list = JSON.parse(fs.readFileSync(FILE, "utf8"));
const withSites = list.filter((s) => s.website);

console.log(
  `Found ${withSites.length} suppliers with website over ${list.length}\n`
);
withSites.slice(0, 50).forEach((s) => {
  console.log(`${String(s.id).padEnd(4)}  ${s.name}  ->  ${s.website}`);
});

// Export CSV (id;name;website)
const csv =
  "id;name;website\n" +
  withSites
    .map((s) => `${s.id};${(s.name || "").replace(/;/g, ",")};${s.website}`)
    .join("\n");
fs.writeFileSync(outCSV, csv, "utf8");
console.log(`\nCSV written: ${outCSV}`);

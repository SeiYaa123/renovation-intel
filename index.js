const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data', 'suppliers.json');

function loadSuppliers() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.get('/api/suppliers', (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const eco = (req.query.eco || '').toString().trim().toUpperCase();

  let items = loadSuppliers();

  if (eco) items = items.filter(s => (s.eco || '').toUpperCase() === eco);

  if (q) {
    items = items.filter(s => {
      const name = (s.name || '').toLowerCase();
      const certs = (s.certifications || []).join(' ').toLowerCase();
      const city = (s.city || '').toLowerCase();
      return name.includes(q) || certs.includes(q) || city.includes(q);
    });
  }

  res.json(items.slice(0, 200));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Suppliers API running on http://localhost:${PORT}`));

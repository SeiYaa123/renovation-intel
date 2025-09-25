import React, { useEffect, useMemo, useState } from "react";

type Cert = {
  name: string;
  slug: string;
  type: "person" | "company" | "product" | "project" | string;
  jurisdiction: "BE" | "EU" | "INTL" | string;
  issuer?: string;
  summary?: string;
  official_register_url?: string;
  docs_url?: string;
  tags?: string[];
  status?: string;
  updatedAt?: string;
};

export default function CertsPanel() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [jur, setJur] = useState<string>("BE"); // on focalise BE par défaut
  const [items, setItems] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    if (jur) params.set("jurisdiction", jur);
    params.set("limit", "200");
    return `/api/certs?${params.toString()}`;
  }, [q, type, jur]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Certifications</h2>
        <p className="text-gray-600">
          Catalogue des certifications du bâtiment (recherche + filtres).
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-3 items-end mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Rechercher</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ex: VCA, BENOR, BREEAM, RESCert…"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            <option value="person">Personne</option>
            <option value="company">Entreprise</option>
            <option value="product">Produit</option>
            <option value="project">Projet/Bâtiment</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Juridiction
          </label>
          <select
            value={jur}
            onChange={(e) => setJur(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Toutes</option>
            <option value="BE">BE</option>
            <option value="EU">EU</option>
            <option value="INTL">INTL</option>
          </select>
        </div>
      </div>

      {loading && <div className="p-3 text-sm text-gray-600">Chargement…</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((c) => (
          <article
            key={c.slug}
            className="bg-white rounded-xl shadow p-5 border hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
              <div className="flex gap-2">
                {c.jurisdiction && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {c.jurisdiction}
                  </span>
                )}
                {c.type && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 capitalize">
                    {c.type}
                  </span>
                )}
                {c.status && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                    {c.status}
                  </span>
                )}
              </div>
            </div>
            {c.issuer && (
              <div className="text-sm text-gray-600 mb-2">
                Organisme : {c.issuer}
              </div>
            )}
            {c.summary && (
              <p className="text-sm text-gray-700 mb-3">{c.summary}</p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {(c.tags || []).map((t) => (
                <span
                  key={t}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="flex gap-3 text-sm">
              {c.official_register_url && (
                <a
                  href={c.official_register_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Registre officiel
                </a>
              )}
              {c.docs_url && (
                <a
                  href={c.docs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Docs
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {!loading && items.length === 0 && (
        <div className="text-sm text-gray-600">Aucun résultat.</div>
      )}
    </section>
  );
}

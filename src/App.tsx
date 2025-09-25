import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Search, Star, Phone, Mail, MapPin } from "lucide-react";

type Supplier = {
  id: number;
  name: string;
  price: number | null;
  rating: number | null;
  eco: string;
  phone?: string | null;
  email?: string | null;
  certifications?: string[];
  city?: string | null;
  distanceKm?: number | null;
};

type ApiResponse = {
  total: number;
  page: number;
  limit: number;
  items: Supplier[];
};

function Header({
  query,
  setQuery,
  onSubmitSearch,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSubmitSearch: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl text-white">
            <Building2 className="w-5 h-5" />
          </div>

          <div className="mr-auto">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Renovation Intelligence
            </h1>
            <p className="text-xs text-gray-500 -mt-0.5">
              Plateforme de construction
            </p>
          </div>

          <form
            className="relative hidden sm:block"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitSearch();
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-3 py-2 border rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Rechercher fournisseur/certif/ville…"
            />
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
          </form>
        </div>
      </div>
    </div>
  );
}

function MarginComparePanel({ query }: { query: string }) {
  const [sell, setSell] = React.useState<number | "">("");
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setRows([]);
        return;
      }
      try {
        setLoading(true);
        const p = new URLSearchParams();
        p.set("q", q);
        p.set("limit", "10");
        if (sell !== "") p.set("sell", String(sell));
        const res = await fetch(`/api/compare-prices?${p.toString()}`, {
          signal: ctrl.signal,
        });
        const js = await res.json();
        setRows(js.items || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, sell]);

  if (!rows.length && !loading) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6">
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="text-lg font-semibold">
            Comparatif prix/marge pour “{query}”
          </h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-600">Prix de vente (€)</span>
            <input
              type="number"
              value={sell === "" ? "" : sell}
              onChange={(e) =>
                setSell(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-28 border rounded-lg px-3 py-1.5 text-sm"
              placeholder="ex: 179"
            />
          </div>
        </div>

        {loading && <div className="text-sm text-gray-500 mb-2">Calcul…</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Fournisseur</th>
                <th className="py-2">Coût (EUR)</th>
                <th className="py-2">Lien</th>
                <th className="py-2">Marge €</th>
                <th className="py-2">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{r.supplier_name}</td>
                  <td className="py-2">€{r.cost_eur?.toFixed(2)}</td>
                  <td className="py-2">
                    {r.product_url ? (
                      <a
                        className="text-blue-600 hover:underline"
                        href={r.product_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2">
                    {r.margin_abs != null ? `€${r.margin_abs.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2">
                    {r.margin_pct != null ? `${r.margin_pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          * Prix scrappés (cache 12h). Pour plus de fiabilité, demande des flux
          CSV/API aux fournisseurs.
        </p>
      </div>
    </div>
  );
}

function Hero({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Construisez l&apos;Avenir
        </h2>
        <p className="text-lg sm:text-xl text-blue-100 mb-8">
          Plateforme intelligente pour la construction moderne
        </p>
        <button
          onClick={onExplore}
          className="inline-flex items-center justify-center px-8 py-3 rounded-lg font-semibold bg-white text-blue-700 hover:bg-blue-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70"
        >
          Explorer les Fournisseurs
        </button>
      </div>
    </div>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {supplier.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
            {supplier.price != null && <span>€{supplier.price}/unité</span>}
            {supplier.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                {supplier.rating}
              </span>
            )}
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
              Éco {supplier.eco}
            </span>
            {supplier.city && <span className="text-xs">{supplier.city}</span>}
            {supplier.distanceKm != null && (
              <span className="text-xs">
                {supplier.distanceKm.toFixed(1)} km
              </span>
            )}
            {supplier.certifications?.length ? (
              <span className="text-xs text-gray-500">
                Certifs: {supplier.certifications.join(", ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {supplier.phone ? (
            <a
              href={`tel:${supplier.phone}`}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label={`Appeler ${supplier.name}`}
            >
              <Phone className="w-4 h-4" />
            </a>
          ) : null}
          {supplier.email ? (
            <a
              href={`mailto:${supplier.email}`}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label={`Écrire à ${supplier.name}`}
            >
              <Mail className="w-4 h-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SupplierList({
  suppliers,
  total,
  page,
  setPage,
  sort,
  setSort,
  hasLocation,
  onUseLocation,
  maxKm,
  setMaxKm,
  filter,
  setFilter,
  anchorRef,
}: {
  suppliers: Supplier[];
  total: number;
  page: number;
  setPage: (p: number) => void;
  sort: string;
  setSort: (s: string) => void;
  hasLocation: boolean;
  onUseLocation: () => void;
  maxKm: number | "";
  setMaxKm: (v: number | "") => void;
  filter: "all" | "eco";
  setFilter: (f: "all" | "eco") => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const totalInfo = useMemo(() => {
    if (total === 0) return "Aucun fournisseur";
    if (total === 1) return "1 fournisseur";
    return `${total} fournisseurs`;
  }, [total]);

  return (
    <div
      ref={anchorRef}
      className="max-w-6xl mx-auto px-4 py-12"
      id="suppliers"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="text-gray-700">{totalInfo}</div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-2 rounded-lg text-sm ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter("eco")}
              className={`px-3 py-2 rounded-lg text-sm ${
                filter === "eco"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Éco A
            </button>
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            title="Tri"
          >
            <option value="">Pertinence</option>
            <option value="distance">Distance</option>
            <option value="rating_desc">Note décroissante</option>
            <option value="price_asc">Prix croissant</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={onUseLocation}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border ${
                hasLocation ? "bg-green-50 border-green-200" : "bg-gray-50"
              }`}
              title="Utiliser ma position"
            >
              <MapPin className="w-4 h-4" />
              {hasLocation ? "Position OK" : "Autour de moi"}
            </button>
            <input
              type="number"
              placeholder="Rayon km"
              value={maxKm === "" ? "" : String(maxKm)}
              onChange={(e) =>
                setMaxKm(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-24 border rounded-lg px-3 py-2 text-sm"
              title="Rayon max (km)"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((s) => (
          <SupplierCard key={s.id} supplier={s} />
        ))}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
            disabled={page <= 1}
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "eco">("all");
  const [sort, setSort] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(12);

  // localisation
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [maxKm, setMaxKm] = useState<number | "">("");

  // data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const scrollToSuppliers = () =>
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const handleSubmitSearch = () => scrollToSuppliers();

  // geolocation
  const onUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        // ignore error
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Fetch API (debounce)
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const p = new URLSearchParams();
        if (filter === "eco") p.set("eco", "A");
        if (query.trim()) p.set("q", query.trim());
        if (sort) p.set("sort", sort);
        p.set("limit", String(limit));
        p.set("page", String(page));
        if (lat != null && lng != null) {
          p.set("lat", String(lat));
          p.set("lng", String(lng));
        }
        if (maxKm !== "") p.set("maxKm", String(maxKm));

        const res = await fetch(`/api/suppliers?${p.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ApiResponse;
        setSuppliers(data.items || []);
        setTotal(data.total || 0);
      } catch {
        setSuppliers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, filter, sort, page, limit, lat, lng, maxKm]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased text-gray-900">
      <Header
        query={query}
        setQuery={setQuery}
        onSubmitSearch={handleSubmitSearch}
      />
      <Hero onExplore={scrollToSuppliers} />
      <MarginComparePanel query={query} />

      {loading && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
            Chargement des fournisseurs…
          </div>
        </div>
      )}

      <SupplierList
        suppliers={suppliers}
        total={total}
        page={page}
        setPage={setPage}
        sort={sort}
        setSort={setSort}
        hasLocation={lat != null && lng != null}
        onUseLocation={onUseLocation}
        maxKm={maxKm}
        setMaxKm={setMaxKm}
        filter={filter}
        setFilter={(f) => {
          setPage(1);
          setFilter(f);
        }}
        anchorRef={listRef}
      />

      <footer className="bg-gray-900 text-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="font-semibold">Renovation Intelligence</span>
          </div>
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} · Plateforme intelligente de
            construction
          </p>
        </div>
      </footer>
    </div>
  );
}

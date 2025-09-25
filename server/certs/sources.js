// server/certs/sources.js
const crypto = require("crypto");
const { load } = require("cheerio");

async function fetchText(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "RenovationIntelBot/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return await res.text();
}
const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");

/**
 * Chaque source doit retourner un tableau d'objets {
 *  name, slug, type, jurisdiction, issuer, summary, official_register_url, docs_url, tags[], status
 * }
 * On n’indexe PAS les personnes/entreprises individuellement ici — uniquement les “schémas/labels”.
 */
module.exports = [
  {
    id: "rescert-be",
    url: "https://rescert.be/fr/lists",
    jurisdiction: "BE",
    type: "person",
    issuer: "RESCert",
    async collect(fetchImpl = fetch) {
      const html = await fetchText(this.url, fetchImpl);
      const $ = load(html);
      // La page “Listes des installateurs certifiés” énumère les technologies (PV, PAC, solaire…)
      // On mappe chaque item en un schéma de certif.
      const items = [];
      const seen = new Set();

      $("a, li").each((_, el) => {
        const txt = $(el).text().trim();
        if (!txt) return;
        // Exemple de titres: “Pompes à chaleur”, “Photovoltaïque”, …
        if (/(pompes?|photovolta|solaire|biomasse|géotherm)/i.test(txt)) {
          const name = `RESCert – ${txt}`;
          const slug = name
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          if (seen.has(slug)) return;
          seen.add(slug);
          items.push({
            name,
            slug,
            type: "person",
            jurisdiction: "BE",
            issuer: "RESCert",
            summary:
              "Certification des installateurs d’énergies renouvelables (PV/PAC/solaire/biomasse/géothermie).",
            official_register_url: "https://rescert.be/fr/lists",
            docs_url: "https://rescert.be/fr",
            tags: ["énergie", "installateur", "pv", "pac", "solaire"],
            status: "active",
          });
        }
      });

      return { items, checksum: hash(html) };
    },
  },

  {
    id: "benor-label",
    url: "https://www.benor.be/en/",
    jurisdiction: "BE",
    type: "product",
    issuer: "BENOR",
    async collect(fetchImpl = fetch) {
      const html = await fetchText(this.url, fetchImpl);
      // Ici, on ne liste pas des certificats individuels mais le “label BENOR”
      // (on suit la page: si elle change => on met à jour updatedAt)
      return {
        items: [
          {
            name: "BENOR",
            slug: "benor",
            type: "product",
            jurisdiction: "BE",
            issuer: "BENOR",
            summary:
              "Label de qualité pour produits de construction en Belgique.",
            official_register_url: "https://www.benor.be/en/",
            docs_url: "https://www.benor.be/en/benor-vzw/the-benor-label/",
            tags: ["qualité", "produit"],
            status: "active",
          },
        ],
        checksum: hash(html),
      };
    },
  },

  {
    id: "ubatc-atg",
    url: "https://www.buildwise.be/fr/recherche-innovation/agrements-techniques-atg/",
    jurisdiction: "BE",
    type: "product",
    issuer: "UBAtc/Buildwise",
    async collect(fetchImpl = fetch) {
      const html = await fetchText(this.url, fetchImpl);
      // On référence le “schéma ATG” (agréments techniques) ; l’annuaire complet est complexe.
      return {
        items: [
          {
            name: "ATG (UBAtc)",
            slug: "atg-ubatc",
            type: "product",
            jurisdiction: "BE",
            issuer: "UBAtc",
            summary: "Agrément technique pour produits/systèmes en Belgique.",
            official_register_url: this.url,
            docs_url: "https://www.bcca.be/fr/evaluation-technique",
            tags: ["agrément", "produit", "système"],
            status: "active",
          },
        ],
        checksum: hash(html),
      };
    },
  },

  {
    id: "vca-register",
    url: "https://www.besacc-vca.be/en/diplomaregister/",
    jurisdiction: "BE",
    type: "person",
    issuer: "BESACC-VCA",
    async collect(fetchImpl = fetch) {
      const html = await fetchText(this.url, fetchImpl);
      return {
        items: [
          {
            name: "VCA (SCC) – Diplômes",
            slug: "vca-scc",
            type: "person",
            jurisdiction: "BE",
            issuer: "BESACC-VCA",
            summary: "Registre central des diplômes SCC/VCA (sécurité).",
            official_register_url: this.url,
            docs_url: "https://www.besacc-vca.be/en/vca-opleidingen/",
            tags: ["sécurité", "personne", "entreprise"],
            status: "active",
          },
        ],
        checksum: hash(html),
      };
    },
  },

  {
    id: "cerga",
    url: "https://www.cerga.be/fr",
    jurisdiction: "BE",
    type: "company",
    issuer: "Cerga",
    async collect(fetchImpl = fetch) {
      const html = await fetchText(this.url, fetchImpl);
      return {
        items: [
          {
            name: "Cerga (installateurs gaz)",
            slug: "cerga",
            type: "company",
            jurisdiction: "BE",
            issuer: "Cerga",
            summary:
              "Label qualité pour installateurs gaz en Belgique (naturel & propane).",
            official_register_url: "https://landing.cerga.be/?lang=fr",
            docs_url:
              "https://www.gas.be/fr/cerga/courses/formation-specifique-gaz-propane",
            tags: ["gaz", "installateur", "sécurité"],
            status: "active",
          },
        ],
        checksum: hash(html),
      };
    },
  },
  // --- ÉLECTRICIEN : RGIE (infos schéma) ---
  {
    id: "rgie-be",
    url: "https://economie.fgov.be/fr/themes/energie/installations-electriques/le-reglement-general-sur",
    jurisdiction: "BE",
    type: "person",
    issuer: "SPF Économie",
    async collect(fetchImpl = fetch) {
      const html = await (await fetch(this.url)).text();
      return {
        items: [
          {
            name: "RGIE (conformité installations électriques)",
            slug: "rgie-be",
            type: "person",
            jurisdiction: "BE",
            issuer: "SPF Économie",
            summary:
              "Réglementation belge des installations électriques. Concerne la conformité et les contrôles par organismes agréés.",
            official_register_url: this.url,
            docs_url:
              "https://economie.fgov.be/fr/publications/reglement-general-sur-les",
            tags: ["électricité", "réglementaire", "contrôle"],
            status: "active",
          },
        ],
        checksum: require("crypto")
          .createHash("sha1")
          .update(html)
          .digest("hex"),
      };
    },
  },

  // --- ÉLECTRICIEN : INCERT (systèmes d’alarme/sécurité) ---
  {
    id: "incert-be",
    url: "https://www.incert.be/fr",
    jurisdiction: "BE",
    type: "company",
    issuer: "INCERT",
    async collect(fetchImpl = fetch) {
      const html = await (await fetch(this.url)).text();
      return {
        items: [
          {
            name: "INCERT (sécurité – systèmes d’alarme)",
            slug: "incert",
            type: "company",
            jurisdiction: "BE",
            issuer: "INCERT",
            summary:
              "Schéma de certification pour installateurs et produits de sécurité (intrusion, CCTV, …).",
            official_register_url: "https://www.incert.be/fr/rechercher",
            docs_url: this.url,
            tags: ["électricité", "sécurité", "alarme", "cctv"],
            status: "active",
          },
        ],
        checksum: require("crypto")
          .createHash("sha1")
          .update(html)
          .digest("hex"),
      };
    },
  },

  // --- INCENDIE : BOSEC (détection incendie) ---
  {
    id: "bosec-be",
    url: "https://www.bosec.be/fr",
    jurisdiction: "BE",
    type: "company",
    issuer: "BOSEC",
    async collect(fetchImpl = fetch) {
      const html = await (await fetch(this.url)).text();
      return {
        items: [
          {
            name: "BOSEC (systèmes de détection incendie)",
            slug: "bosec",
            type: "company",
            jurisdiction: "BE",
            issuer: "BOSEC",
            summary:
              "Certification pour produits et entreprises en détection incendie.",
            official_register_url: "https://www.bosec.be/fr/certified",
            docs_url: this.url,
            tags: ["électricité", "incendie", "sécurité", "entreprise"],
            status: "active",
          },
        ],
        checksum: require("crypto")
          .createHash("sha1")
          .update(html)
          .digest("hex"),
      };
    },
  },

  // --- HVAC/FRIGO : F-Gas (personnes & entreprises) ---
  {
    id: "fgas-be",
    url: "https://www.climat.be/fr-be/politiques/f-gaz",
    jurisdiction: "BE",
    type: "person",
    issuer: "SPF Santé publique / Climat",
    async collect(fetchImpl = fetch) {
      const html = await (await fetch(this.url)).text();
      return {
        items: [
          {
            name: "F-Gas (manipulation des fluides frigorigènes)",
            slug: "fgas-be",
            type: "person",
            jurisdiction: "BE",
            issuer: "Autorités belges (Climat/SPF)",
            summary:
              "Certification du personnel/entreprises manipulant des gaz à effet de serre fluorés (réfrigération, climatisation).",
            official_register_url: this.url,
            docs_url: "https://ec.europa.eu/clima/policies/f-gas_fr",
            tags: ["hvac", "réfrigération", "sécurité", "environnement"],
            status: "active",
          },
        ],
        checksum: require("crypto")
          .createHash("sha1")
          .update(html)
          .digest("hex"),
      };
    },
  },

  // --- PLOMBIER/GAZ : Cerga (déjà présent, mais garde) ---

  // --- COUVREUR/ÉTANCHÉITÉ : BCCA (agréments/étanchéité) ---
  {
    id: "bcca-be",
    url: "https://www.bcca.be/fr/etancheite-des-toitures",
    jurisdiction: "BE",
    type: "company",
    issuer: "BCCA",
    async collect(fetchImpl = fetch) {
      const html = await (await fetch(this.url)).text();
      return {
        items: [
          {
            name: "BCCA – Étanchéité des toitures",
            slug: "bcca-roofing",
            type: "company",
            jurisdiction: "BE",
            issuer: "BCCA",
            summary:
              "Schémas d’agrément/contrôle liés à l’étanchéité des toitures en Belgique.",
            official_register_url: this.url,
            docs_url: "https://www.bcca.be/fr",
            tags: ["toiture", "étanchéité", "entreprise"],
            status: "active",
          },
        ],
        checksum: require("crypto")
          .createHash("sha1")
          .update(html)
          .digest("hex"),
      };
    },
  },
];

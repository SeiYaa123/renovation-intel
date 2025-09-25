module.exports = [
  {
    key: "be_benor",
    issuer: "BENOR",
    jurisdiction: "BE",
    type: "product",
    fetch: async () => [
      {
        name: "BENOR",
        summary: "Marquage de conformité belge pour produits de construction.",
        official_register_url: "https://www.benor.be/",
        docs_url: "https://www.benor.be/fr/specifications",
        tags: ["qualité","produit"],
        aliases: ["Label BENOR"]
      }
    ]
  },
  {
    key: "be_atg",
    issuer: "UBAtc",
    jurisdiction: "BE",
    type: "product",
    fetch: async () => [
      {
        name: "ATG (UBAtc)",
        summary: "Agrément technique pour produits/systèmes en Belgique.",
        official_register_url: "https://www.ubatc.be/fr/atg",
        docs_url: "https://www.ubatc.be/fr",
        tags: ["agrément","produit","système"]
      }
    ]
  },
  {
    key: "intl_breeam",
    issuer: "BRE",
    jurisdiction: "INTL",
    type: "project",
    fetch: async () => [
      {
        name: "BREEAM",
        summary: "Certification environnementale des bâtiments.",
        official_register_url: "https://www.breeam.com/",
        docs_url: "https://www.breeam.com/technical-standards/",
        tags: ["environnement","projet","durable"]
      }
    ]
  },
  {
    key: "intl_leed",
    issuer: "USGBC",
    jurisdiction: "INTL",
    type: "project",
    fetch: async () => [
      {
        name: "LEED",
        summary: "Leadership in Energy and Environmental Design.",
        official_register_url: "https://www.usgbc.org/leed",
        docs_url: "https://www.usgbc.org/resources?program=leed",
        tags: ["environnement","projet","durable"]
      }
    ]
  },
  {
    key: "be_rescert",
    issuer: "RESCert",
    jurisdiction: "BE",
    type: "person",
    fetch: async () => [
      {
        name: "RESCert Installateur",
        summary: "Certification des installateurs d’énergies renouvelables (PV, PAC, solaire).",
        official_register_url: "https://www.rescert.be/",
        docs_url: "https://www.rescert.be/fr",
        tags: ["énergie","installateur","personne"]
      }
    ]
  },
  {
    key: "be_vca",
    issuer: "SCC / VCA",
    jurisdiction: "BE",
    type: "company",
    fetch: async () => [
      {
        name: "VCA (SCC)",
        summary: "Certification sécurité pour entreprises et travailleurs.",
        official_register_url: "https://www.vca.be/",
        docs_url: "https://www.vca.be/nl/certificatie",
        tags: ["sécurité","entreprise","personne"]
      }
    ]
  }
];

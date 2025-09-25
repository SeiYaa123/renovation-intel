const domainOverrides = {
  // ...
  "zelfbouwmarkt.be": {
    // IMPORTANT: utiliser la recherche Magento (pas /nl/search)
    buildSearchUrl: (base, q) =>
      `${base}/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    listItemSelector:
      'a.product-item-link, a[href*="/product"], a[href*="/products/"]',
    listPriceSelector:
      ".price-wrapper [data-price-amount], meta[itemprop='price'], .price",
    detailPriceSelector:
      ".price-wrapper [data-price-amount], meta[itemprop='price'], .price",
  },
};

const genericPatterns = [
  (base, q) => `${base}/search?q=${encodeURIComponent(q)}`,
  (base, q) => `${base}/fr/search?q=${encodeURIComponent(q)}`,
  (base, q) => `${base}/nl/search?q=${encodeURIComponent(q)}`,
  (base, q) => `${base}/recherche?q=${encodeURIComponent(q)}`,
  (base, q) => `${base}/zoeken?q=${encodeURIComponent(q)}`,
  (base, q) => `${base}/catalogsearch/result/?q=${encodeURIComponent(q)}`, // Magento
  (base, q) => `${base}/?s=${encodeURIComponent(q)}`,                      // WordPress
];

module.exports = { domainOverrides, genericPatterns };

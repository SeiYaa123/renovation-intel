// Construit l'URL de recherche et propose des sélecteurs de prix par plateforme.
module.exports = {
  shopify: {
    buildSearchUrl: (base, q) =>
      `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(q)}`,
    listItemSelector: 'a[href*="/products/"]',
    listPriceSelector: ".price-item--regular, .price .money, [data-price]",
    detailPriceSelector:
      '.price-item--regular, .price .money, [itemprop="price"], meta[property="product:price:amount"]',
  },
  woocommerce: {
    buildSearchUrl: (base, q) =>
      `${base.replace(/\/$/, "")}/?s=${encodeURIComponent(
        q
      )}&post_type=product`,
    listItemSelector:
      ".products .product a.woocommerce-LoopProduct-link, .product a.woocommerce-loop-product__link",
    listPriceSelector: ".woocommerce-Price-amount, .price",
    detailPriceSelector:
      '.summary .price .amount, .woocommerce-Price-amount, [itemprop="price"]',
  },
  prestashop: {
    buildSearchUrl: (base, q) =>
      `${base.replace(
        /\/$/,
        ""
      )}/recherche?controller=search&s=${encodeURIComponent(q)}`,
    listItemSelector:
      ".product-miniature a.product-thumbnail, .thumbnail-container a",
    listPriceSelector: ".price, .product-price",
    detailPriceSelector: ".current-price, .price",
  },
  magento: {
    buildSearchUrl: (base, q) =>
      `${base.replace(/\/$/, "")}/catalogsearch/result/?q=${encodeURIComponent(
        q
      )}`,
    listItemSelector: ".product-item-link",
    listPriceSelector: ".price-final_price .price, .price",
    detailPriceSelector: ".price-final_price .price, .price",
  },
  // fallback génériques testés si plateforme inconnue
  genericPatterns: [
    (base, q) => `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(q)}`,
    (base, q) => `${base.replace(/\/$/, "")}/?s=${encodeURIComponent(q)}`,
    (base, q) =>
      `${base.replace(/\/$/, "")}/catalogsearch/result/?q=${encodeURIComponent(
        q
      )}`,
    (base, q) =>
      `${base.replace(
        /\/$/,
        ""
      )}/recherche?controller=search&s=${encodeURIComponent(q)}`,
  ],
};

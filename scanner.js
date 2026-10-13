(function () {
  'use strict';
  const C = globalThis.AsinPulse;
  function visible(el) {
    if (!el || el.closest('[hidden],[aria-hidden="true"],#asin-pulse-root')) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function selectedAsin(doc) {
    // Read the buying form, never data-asin attributes in ads or recommendations.
    const ids = ['#desktop_buybox input#ASIN', '#buybox input[name="ASIN"]', '#addToCart input[name="ASIN"]', 'input#ASIN'];
    for (const selector of ids) {
      const value = doc.querySelector(selector)?.value?.toUpperCase();
      if (C.validAsin(value)) return value;
    }
    return null;
  }
  function scan(doc = document, href = location.href) {
    const product = C.productUrl(href);
    if (!product) return null;
    const asin = selectedAsin(doc) || product.asin;
    const titleEl = doc.querySelector('#productTitle, #ebooksProductTitle, #title #title');
    const title = C.clean(titleEl?.textContent).slice(0, 500);
    // Deliberately restrict purchase text to Amazon's product social-proof widgets.
    // Searching the full body would incorrectly count recommended products.
    const widgets = doc.querySelectorAll('#social-proofing-faceout-title-tk_bought, #social-proofing-faceout-title, #socialProofingAsinFaceout_feature_div, #socialProofing_feature_div, #social-proofing-faceout, #boughtInPastMonth_feature_div');
    const signals = [];
    for (const el of widgets) {
      if (!visible(el) || el.closest('[data-component-type="s-search-result"], [id*="similarities"], [id*="recommendations"], [id*="sp_detail"], .a-carousel-container')) continue;
      const owner = el.closest('[data-asin]')?.getAttribute('data-asin')?.toUpperCase();
      if (C.validAsin(owner) && owner !== asin) continue;
      const parsed = C.parseBadge(typeof el.innerText === 'string' ? el.innerText : el.textContent);
      if (parsed && !signals.some(s => s.count === parsed.count && s.plus === parsed.plus)) signals.push(parsed);
    }
    const details = doc.querySelectorAll('#SalesRank, #detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr, #productDetails_db_sections tr, #prodDetails tr');
    let rank = '';
    for (const el of details) {
      const text = C.clean(el.innerText || el.textContent);
      if (/Best Sellers Rank|Amazon Bestsellers Rank/i.test(text)) { rank = text.replace(/^.*?(?:Best Sellers Rank|Amazon Bestsellers Rank)\s*:?\s*/i, '').slice(0, 350); break; }
    }
    const price = C.clean(doc.querySelector('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen, #corePrice_feature_div .a-price .a-offscreen, #priceblock_ourprice')?.textContent);
    return {
      asin, urlAsin: product.asin, market: product.label, domain: product.domain, host: product.host,
      url: `https://${product.host}/dp/${asin}`, title: title || 'Product information is not available', price, rank,
      signal: title && signals.length === 1 ? signals[0] : null,
      note: !title ? 'Amazon has not loaded a readable product page. Finish any sign-in or page check, then refresh.' : signals.length > 1 ? 'Conflicting purchase badges found. No count is shown to avoid using the wrong product.' : '',
      observedAt: new Date().toISOString()
    };
  }
  globalThis.AsinPulseScan = scan;
})();

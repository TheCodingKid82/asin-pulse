(function (root) {
  'use strict';
  const markets = { 'www.amazon.com': {label: 'US', domain: 1}, 'www.amazon.co.uk': {label: 'UK', domain: 2}, 'www.amazon.ca': {label: 'CA', domain: 6} };
  const clean = value => String(value ?? '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  const validAsin = value => /^[A-Z0-9]{10}$/.test(String(value || ''));
  function productUrl(value) {
    try {
      const url = new URL(value);
      const market = url.protocol === 'https:' && markets[url.hostname];
      const match = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
      return market && match ? {asin: match[1].toUpperCase(), host: url.hostname, ...market} : null;
    } catch { return null; }
  }
  function parseBadge(value) {
    const text = clean(value);
    const match = text.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([KM])?\s*(\+)?\s+bought\s+in\s+(?:the\s+)?past\s+month\b/i);
    if (!match) return null;
    const count = Number(match[1].replace(/,/g, '')) * ({K: 1000, M: 1000000}[match[2]?.toUpperCase()] || 1);
    if (!Number.isSafeInteger(count) || count < 1) return null;
    return {count, plus: Boolean(match[3]), text: clean(match[0]), source: 'Amazon page', kind: 'purchase-signal'};
  }
  function keepaResult(payload, asin, domain) {
    const p = payload?.products?.find(p => p.asin === asin && p.domainId === domain);
    if (!p) throw new Error('Keepa has no matching product for this ASIN and marketplace.');
    if (p.productType === 4) throw new Error('Keepa marks this ASIN as invalid or unavailable.');
    if (p.productType === 5) throw new Error('This is a parent ASIN. Select a specific size or color on Amazon.');
    const hasCount = Number.isSafeInteger(p.monthlySold) && p.monthlySold > 0;
    const updatedAt = Number.isFinite(p.lastSoldUpdate) && p.lastSoldUpdate > 0 ? (p.lastSoldUpdate + 21564000) * 60000 : null;
    return {asin, count: hasCount ? p.monthlySold : null, plus: true, source: 'Amazon via Keepa', kind: 'purchase-signal', updatedAt, parentAsin: validAsin(p.parentAsin) ? p.parentAsin : null};
  }
  function csv(snapshot) {
    const signal = snapshot.signal;
    const rows = [
      ['ASIN', 'Marketplace', 'Title', 'Monthly purchase signal', 'Metric', 'Exact monthly units', 'Source', 'Source updated at', 'Badge text', 'Sales rank', 'Observed at', 'URL'],
      [snapshot.asin, snapshot.market, snapshot.title, signal ? signal.count + (signal.plus ? '+' : '') : '', 'Approximate customer purchase signal; not exact units', 'Unavailable', signal?.source || '', signal?.updatedAt ? new Date(signal.updatedAt).toISOString() : '', signal?.text || '', snapshot.rank || '', snapshot.observedAt, snapshot.url]
    ];
    return rows.map(row => row.map(v => {
      let cell = String(v ?? '');
      if (/^[=+\-@\t\r\n]/.test(cell)) cell = "'" + cell;
      return '"' + cell.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  const api = {markets, clean, validAsin, productUrl, parseBadge, keepaResult, csv};
  root.AsinPulse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

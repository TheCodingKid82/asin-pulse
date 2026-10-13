(function () {
  'use strict';
  const CSS = `
    :host{all:initial;color-scheme:light} *{box-sizing:border-box} [hidden]{display:none!important}
    .pulse{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#142d32;background:#f7f9f6;border:1px solid #d5e1d9;border-radius:18px;box-shadow:0 14px 50px #102f322b;overflow:hidden;width:354px;max-width:calc(100vw - 28px)}
    button,a,input{font:inherit} button,a{touch-action:manipulation} button{cursor:pointer} button:focus-visible,a:focus-visible{outline:3px solid #b47b13;outline-offset:3px}
    .top{background:#173b3b;color:#fff;padding:15px 18px;display:flex;align-items:center;gap:10px}.logo{font-size:21px;color:#b8e397}.brand{font-weight:700;letter-spacing:-.2px;flex:1}.brand small{display:block;color:#c4d5d0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;font-weight:500}.close{border:0;background:transparent;color:white;font-size:23px;padding:0 5px}
    .body{padding:18px;max-height:min(660px,calc(100vh - 150px));overflow:auto}.meta{display:flex;align-items:center;gap:7px;font-size:11px}.chip{border:1px solid #cbdad0;border-radius:5px;padding:2px 6px;font-weight:700}.asin{font-family:ui-monospace,monospace;letter-spacing:.8px}.title{font-size:13px;color:#4f6769;margin:10px 0 18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5}
    .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#516967}.number{font-size:48px;line-height:1.1;font-weight:700;letter-spacing:-2px;margin:6px 0 4px;font-variant-numeric:tabular-nums}.number.empty{font-size:28px;letter-spacing:-.8px;margin:12px 0}.sub{font-size:12px;color:#4e6765}.source{display:inline-block;background:#e3eedf;color:#2b562c;border-radius:5px;padding:4px 7px;font-size:10px;margin:12px 0 0}.source.missing{background:#ecebe2;color:#6f6639}
    .notice{margin:14px 0 0;font-size:11px;line-height:1.6;color:#566865}.facts{margin:16px 0 0;border-top:1px solid #dce4de}.fact{display:flex;gap:12px;justify-content:space-between;padding:9px 0;border-bottom:1px solid #dce4de;font-size:11px}.fact span:first-child{color:#657671;flex-shrink:0}.fact span:last-child{text-align:right;overflow-wrap:anywhere}.rank{max-width:204px}
    .actions{display:flex;gap:7px;margin-top:16px} .actions button,.provider{border:1px solid #c6d6ca;background:#fff;border-radius:7px;padding:8px 10px;color:#254b43;font-size:12px;font-weight:600}.actions button{flex:1}.provider{display:block;width:100%;background:#173b3b;color:#fff;margin-top:8px;border-color:#173b3b}.provider:disabled{opacity:.55;cursor:wait}.foot{display:flex;justify-content:space-between;gap:10px;margin-top:14px;font-size:10px;color:#687875}.foot a{color:#38614f;text-decoration:underline}.status{font-size:11px;line-height:1.5;margin:10px 0 0;color:#6f5423}.intro{padding:28px 22px;color:#506766}.intro strong{display:block;color:#193c39;font-size:19px;margin-bottom:8px}.quote{font-size:11px;color:#60716d;margin-top:10px}.quote:empty{display:none}
  `;
  const template = `<section class="pulse" aria-label="ASIN Pulse monthly sales"><header class="top"><span class="logo" aria-hidden="true">▥</span><div class="brand">ASIN Pulse<small>Monthly sales intelligence</small></div><button class="close" title="Minimize panel" aria-label="Minimize panel">×</button></header><div class="intro" hidden><strong>Open an Amazon product</strong>Visit a product on Amazon.com, Amazon.ca, or Amazon.co.uk. Select a size or color to check its ASIN.</div><div class="body"><div class="meta"><span class="chip" data-field="market"></span><span class="asin" data-field="asin"></span></div><p class="title" data-field="title"></p><div class="eyebrow">Monthly purchase signal</div><div class="number" data-field="number"></div><div class="sub" data-field="subtitle"></div><span class="source" data-field="source"></span><p class="quote" data-field="quote"></p><p class="notice" data-field="notice"></p><div class="facts"><div class="fact"><span>Exact unit sales</span><span>Not publicly available</span></div><div class="fact"><span>Sales rank</span><span class="rank" data-field="rank"></span></div><div class="fact"><span>Price on page</span><span data-field="price"></span></div><div class="fact"><span>Page checked</span><span data-field="time"></span></div></div><div class="actions"><button data-action="refresh">↻ Refresh</button><button data-action="copy">Copy ASIN</button><button data-action="csv">CSV</button></div><button class="provider" data-action="keepa">Check Keepa data</button><button class="provider" data-action="sourcing">Retail sourcing desk ↗</button><p class="status" role="status" aria-live="polite"></p><div class="foot"><a href="#" data-action="options">Data settings</a><a href="https://sellercentral.amazon.com/seller-forums/discussions/t/04f56c0edc15e6ae30621c88bfce1bdf" target="_blank" rel="noopener noreferrer">About Amazon’s signal ↗</a></div></div></section>`;
  function mount(root, handlers = {}, closable = true) {
    const style = document.createElement('style'); style.textContent = CSS;
    const holder = document.createElement('div'); holder.innerHTML = template;
    root.replaceChildren(style, holder);
    const q = s => root.querySelector(s);
    q('.close').hidden = !closable;
    q('.close').addEventListener('click', () => handlers.close?.());
    let snapshot = null;
    const field = (name, text) => { q(`[data-field="${name}"]`).textContent = text; };
    const status = text => { q('.status').textContent = text; };
    root.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.action;
      try {
        if (action === 'copy' && snapshot) { await navigator.clipboard.writeText(snapshot.asin); status('ASIN copied.'); }
        else if (action === 'csv' && snapshot) {
          const url = URL.createObjectURL(new Blob(['\uFEFF' + AsinPulse.csv(snapshot)], {type:'text/csv;charset=utf-8'}));
          const a = document.createElement('a'); a.href = url; a.download = `${snapshot.asin}-monthly-signal.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); status('CSV exported.');
        } else await handlers[action]?.(snapshot);
      } catch (error) { status(error.message || 'Action failed. Refresh the page and try again.'); }
    });
    function render(data) {
      snapshot = data;
      q('.intro').hidden = Boolean(data); q('.body').hidden = !data;
      if (!data) return;
      const signal = data.signal;
      field('market', data.market); field('asin', data.asin); field('title', data.title);
      field('number', signal ? signal.count.toLocaleString('en-US') + (signal.plus ? '+' : '') : 'Not available');
      q('[data-field="number"]').classList.toggle('empty', !signal);
      field('subtitle', signal ? 'bought in the past month' : 'No readable monthly purchase badge');
      field('source', signal ? signal.source : 'No sales count provided');
      q('[data-field="source"]').classList.toggle('missing', !signal);
      field('quote', signal?.text ? `Amazon displays: “${signal.text}”` : '');
      field('notice', data.note || (signal ? 'A broad, rounded estimate of customers who purchased. This is not an exact unit count or your expected share of sales. Check the selected variation before sourcing.' : 'Missing data does not mean zero sales. Keepa may have a saved Amazon purchase signal. A sales rank alone cannot provide a reliable unit count.'));
      field('rank', data.rank || 'Not shown'); field('price', data.price || 'Not shown');
      field('time', new Date(data.observedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    }
    return {render, status, busy: busy => {q('[data-action="keepa"]').disabled = busy;}};
  }
  globalThis.AsinPulseUI = {mount};
})();

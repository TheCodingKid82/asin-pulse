(function () {
  'use strict';
  if (globalThis.__asinPulseLoaded) return;
  globalThis.__asinPulseLoaded = true;
  let host, root, ui, snapshot = null, signature = '', timer, open = false, generation = 0, variantUntil = 0;
  let previousBadge = '', previousAsin = '';
  function send(message) { return chrome.runtime.sendMessage(message); }
  function ensurePanel() {
    if (host?.isConnected) return;
    host = document.createElement('div'); host.id = 'asin-pulse-root';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646;';
    root = host.attachShadow({mode:'closed'});
    const wrap = document.createElement('div');
    const launcher = document.createElement('button');
    launcher.textContent = '▥  ASIN Pulse'; launcher.setAttribute('aria-label','Open ASIN Pulse monthly sales');
    launcher.style.cssText = 'font:600 14px Segoe UI,sans-serif;background:#173b3b;color:white;border:1px solid #87a392;border-radius:24px;padding:12px 18px;cursor:pointer;box-shadow:0 4px 24px #173b3b33;';
    root.append(wrap,launcher);
    const toggle = value => {open=value;wrap.hidden=!value;launcher.hidden=value;launcher.setAttribute('aria-expanded',String(value));};
    ui = AsinPulseUI.mount(wrap, {
      close:()=>toggle(false), refresh:()=>{update(true);ui.status('Page checked.');},
      options:()=>send({type:'OPEN_OPTIONS'}), sourcing:()=>send({type:'OPEN_SOURCING'}),
      keepa:async()=> {
        const current = snapshot; const token = generation;
        ui.busy(true); ui.status('Checking Keepa…');
        try {
          const result = await send({type:'KEEPA',asin:current.asin,domain:current.domain});
          if (token !== generation) return;
          if (!result.ok) {ui.status(result.error);return;}
          const value = result.data;
          const date = value.updatedAt ? new Date(value.updatedAt).toLocaleString() : 'date not supplied';
          if (value.count == null) {ui.status('Keepa has no monthly purchase signal for this ASIN. That does not mean zero sales.');return;}
          if (!current.signal) {snapshot={...current,signal:value}; ui.render(snapshot);}
          ui.status(`Keepa: ${value.count.toLocaleString()}+ bought in past month. Source updated: ${date}.${result.cached ? ' Saved lookup.' : ''}`);
        } finally {ui.busy(false);}
      }
    });
    launcher.addEventListener('click',()=>{update();toggle(true);});
    toggle(open); document.documentElement.append(host);
  }
  function update(force=false) {
    const data = AsinPulseScan();
    if (!data) {host?.remove();host=null;snapshot=null;signature='';previousAsin='';previousBadge='';return;}
    ensurePanel();
    const rawBadge = data.signal?.text || '';
    // Do not attribute the previous variation's unchanged badge to a newly selected ASIN.
    if (previousAsin && previousAsin !== data.asin) {variantUntil=Date.now()+2000;previousBadge=snapshot?.signal?.text || '';}
    previousAsin=data.asin;
    if (Date.now()<variantUntil || (previousBadge && rawBadge===previousBadge)) {
      data.signal=null;data.note='Variation changed. Waiting for Amazon to refresh its purchase badge. Reload this product page to verify an unchanged badge.';
    } else if (rawBadge) {previousBadge='';}
    const next = JSON.stringify({...data,observedAt:''});
    if (next!==signature || force) {signature=next;snapshot=data;generation++;ui.render(data);ui.status('');}
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if (message.type==='GET_SNAPSHOT') {update();reply(snapshot);}
    if (message.type==='SHOW_PANEL') {update();root?.querySelector('button[aria-label="Open ASIN Pulse monthly sales"]')?.click();reply({ok:true});}
  });
  const observer = new MutationObserver(records=>{
    if(records.every(r=>host?.contains(r.target))) return;
    clearTimeout(timer); timer=setTimeout(()=>update(),450);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value','data-asin']});
  setInterval(()=>{if(!document.hidden) update();},1500);
  addEventListener('popstate',()=>update());
  update();
})();

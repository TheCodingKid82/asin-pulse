'use strict';
importScripts('core.js');
const inflight = new Map();
const ready = chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
function allowed(sender, message) {
  if (sender.id !== chrome.runtime.id) return false;
  const extensionPage = ['popup.html','options.html','sourcing.html'].some(page => sender.url === chrome.runtime.getURL(page));
  if (extensionPage) return true;
  const page = AsinPulse.productUrl(sender.url);
  return Boolean(page && ['OPEN_OPTIONS','OPEN_SOURCING','KEEPA'].includes(message.type) &&
    (message.type !== 'KEEPA' || (AsinPulse.validAsin(message.asin) && message.domain===page.domain)));
}
async function lookup(asin, domain) {
  await ready;
  if (!AsinPulse.validAsin(asin) || ![1,2,6].includes(domain)) throw new Error('Unsupported ASIN or marketplace.');
  const {keepaKey,keepaCache={}} = await chrome.storage.local.get(['keepaKey','keepaCache']);
  if (!keepaKey) throw new Error('Optional: add a Keepa API key in Data settings. The free Amazon signal works without one.');
  if (!(await chrome.permissions.contains({origins:['https://api.keepa.com/*']}))) throw new Error('Enable Keepa access in Data settings.');
  const id=`${domain}:${asin}`;const saved=keepaCache[id];
  if(saved && Date.now()-saved.savedAt < (saved.data.count ? 86400000 : 3600000)) return {data:saved.data,cached:true};
  if(inflight.has(id)) return inflight.get(id);
  const request=(async()=>{
    const url=new URL('https://api.keepa.com/product');
    url.search=new URLSearchParams({key:keepaKey,domain:String(domain),asin,history:'0',update:'-1'}).toString();
    let response;
    try {response=await fetch(url,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});} catch {throw new Error('Keepa could not be reached. Check your connection and try again.');}
    if(response.status===401 || response.status===403) throw new Error('Keepa rejected the API key. Check your API access in Data settings.');
    if(response.status===429) throw new Error('Keepa API quota is exhausted. Wait for tokens to refill.');
    if(!response.ok) throw new Error(`Keepa request failed (HTTP ${response.status}). Try again later.`);
    let payload;try{payload=await response.json();}catch{throw new Error('Keepa returned an unreadable response.');}
    if(payload.error) throw new Error('Keepa could not complete the lookup. Check your key and API quota.');
    const data=AsinPulse.keepaResult(payload,asin,domain);
    const latest=await chrome.storage.local.get(['keepaCache','keepaKey']);
    if(latest.keepaKey===keepaKey){
      const entries=Object.entries({...latest.keepaCache,[id]:{savedAt:Date.now(),data}}).sort((a,b)=>b[1].savedAt-a[1].savedAt).slice(0,200);
      await chrome.storage.local.set({keepaCache:Object.fromEntries(entries)});
    }
    return {data,cached:false};
  })();
  inflight.set(id,request);
  try{return await request;}finally{inflight.delete(id);}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!allowed(sender,message)) {reply({ok:false,error:'Request not allowed.'});return;}
  if(message.type==='OPEN_OPTIONS'){chrome.runtime.openOptionsPage().then(()=>reply({ok:true}));return true;}
  if(message.type==='OPEN_SOURCING'){chrome.tabs.create({url:chrome.runtime.getURL('sourcing.html')}).then(()=>reply({ok:true}));return true;}
  if(message.type==='KEEPA'){
    lookup(message.asin,message.domain).then(result=>reply({ok:true,...result})).catch(error=>reply({ok:false,error:error.message}));return true;
  }
});

// The desktop updater opens update.html after replacing the local package.
// Reopen the desk once the new service worker starts; no Chrome profile data is removed.
ready.then(async()=>{
  const {reopenAfterUpdate}=await chrome.storage.local.get('reopenAfterUpdate');
  if(!reopenAfterUpdate)return;
  await chrome.storage.local.remove('reopenAfterUpdate');
  if(Date.now()-reopenAfterUpdate<300000)await chrome.tabs.create({url:chrome.runtime.getURL('sourcing.html?updated=1')});
});

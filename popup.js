'use strict';
let currentTab, snapshot, generation=0;
const ui=AsinPulseUI.mount(document.getElementById('app'),{
  options:()=>chrome.runtime.openOptionsPage(), sourcing:()=>chrome.tabs.create({url:chrome.runtime.getURL('sourcing.html')}),
  refresh:()=>load(),
  keepa:async()=>{
    const current=snapshot,token=generation;
    ui.busy(true);ui.status('Checking Keepa…');
    try{
      const result=await chrome.runtime.sendMessage({type:'KEEPA',asin:current.asin,domain:current.domain});
      if(token!==generation)return;
      if(!result.ok){ui.status(result.error);return;}
      if(result.data.count==null){ui.status('Keepa has no monthly purchase signal for this ASIN. That does not mean zero sales.');return;}
      if(!snapshot.signal){snapshot={...snapshot,signal:result.data};ui.render(snapshot);}
      ui.status(`Keepa: ${result.data.count.toLocaleString()}+ bought in past month. Source updated: ${result.data.updatedAt ? new Date(result.data.updatedAt).toLocaleString() : 'date not supplied'}.${result.cached ? ' Saved lookup.' : ''}`);
    }finally{ui.busy(false);}
  }
},false);
async function load(){
  generation++; ui.status('');
  [currentTab]=await chrome.tabs.query({active:true,currentWindow:true});
  document.getElementById('capture-retail').hidden=!/^https:\/\/(?:www\.)?(target|walmart|kohls|carters|boscovs|macys|jcpenney)\.com\//.test(currentTab?.url||'');
  if(!AsinPulse.productUrl(currentTab?.url)){snapshot=null;ui.render(null);return;}
  try{
    try{snapshot=await chrome.tabs.sendMessage(currentTab.id,{type:'GET_SNAPSHOT'});}
    catch{
      await chrome.scripting.executeScript({target:{tabId:currentTab.id},files:['core.js','scanner.js','ui.js','content.js']});
      snapshot=await chrome.tabs.sendMessage(currentTab.id,{type:'GET_SNAPSHOT'});
    }
    ui.render(snapshot);
  }catch{
    ui.render(null);
    const intro=document.querySelector('.intro');intro.textContent='Reload this Amazon product page, then open ASIN Pulse again.';
  }
}
document.getElementById('open-sourcing').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('sourcing.html')}));
document.getElementById('capture-retail').addEventListener('click',async()=>{
  const button=document.getElementById('capture-retail'),status=document.getElementById('capture-status');button.disabled=true;
  try{
    await chrome.scripting.executeScript({target:{tabId:currentTab.id},files:['sourcing-core.js','retail-scan.js']});
    const [result]=await chrome.scripting.executeScript({target:{tabId:currentTab.id},func:()=>SourcingPage.retail()});
    if(result.result.blocked)throw new Error('Complete the retailer page check yourself, then try again.');
    if(!result.result.products.length)throw new Error('No product cards were readable on this page. Open a product-results category.');
    await chrome.storage.local.set({sourcingCapture:result.result});await chrome.tabs.create({url:chrome.runtime.getURL('sourcing.html')});
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
load();

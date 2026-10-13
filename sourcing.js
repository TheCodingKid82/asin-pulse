'use strict';
const S=Sourcing,E=SourcingEngine,$=id=>document.getElementById(id);
let job=null,settings={...S.defaults},index=[],running=false,pauseRequested=false,reader=null,pageNumber=0,reviewing=null,renderTimer=null;
const money=v=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
const notice=text=>{$('app-status').textContent=text;};
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const link=(text,url)=>{const a=node('a',text);const safe=S.safeUrl(url);if(safe){a.href=safe;a.target='_blank';a.rel='noopener noreferrer';}return a;};
function selected(lead){return lead.candidates?.[lead.selected||0]||null;}
function calculation(lead){if(!eligible(lead))return {ready:false,spread:null,errors:[lead.source.detailVerified===false?'Retail product price needs verification':'Product identity needs verification before comparing prices']};return S.costs(lead.source,selected(lead),{...settings,...lead.fees});}
function eligible(lead){return S.comparable(lead);}
function auditSaved(value){
  if(!value)return value;
  for(const lead of value.leads){for(const p of lead.candidates||[])p.match=S.match(lead.source,p);if(selected(lead)?.match.level==='conflict')lead.confirmed=false;
    if(lead.source.detailVerified===undefined)lead.source.detailVerified=lead.source.origin==='Retailer product data';}
  if(!value.engineVersion&&!value.expectedTotal&&value.discoveryComplete){value.discoveryComplete=false;value.events.push({time:new Date().toISOString(),text:'Older scan coverage was not verified. Run a new category scan with version 2.2 to follow department subcategories.'});}
  return value;
}
async function saveJob(value){
  const summary={id:value.id,createdAt:value.createdAt,retailer:value.retailer,category:value.category,count:value.leads.length,status:value.status};
  index=[summary,...index.filter(j=>j.id!==value.id)];
  await chrome.storage.local.set({['sourcingJob:'+value.id]:value,sourcingIndex:index});
}
function recent(){const old=$('recent-scans').value;$('recent-scans').replaceChildren();for(const j of index){const o=node('option',`${j.retailer} · ${j.category} (${j.count})`);o.value=j.id;$('recent-scans').append(o);}if(job)$('recent-scans').value=job.id;else $('recent-scans').value=old;}
function fillStores(){for(const store of Retailers){const o=node('option',store.name);o.value=store.id;$('retailer').append(o);}fillCategories();}
function fillCategories(){const store=Retailers.find(s=>s.id===$('retailer').value);$('category').replaceChildren();store.categories.forEach(([name,url],i)=>{const o=node('option',name);o.value=String(i);$('category').append(o);});const custom=node('option','Custom category URL');custom.value='custom';$('category').append(custom);fillUrl();}
function fillUrl(){const store=Retailers.find(s=>s.id===$('retailer').value);if($('category').value==='custom'){$('source-url').value='';$('source-url').focus();}else $('source-url').value=store.categories[Number($('category').value)][1];}
function permissionOrigins(urls){return [...new Set(urls.map(url=>{const value=S.safeUrl(url);if(!value)throw new Error('Enter a public HTTPS retailer URL.');return new URL(value).origin+'/*';}))];}
async function requestAccess(urls){const origins=permissionOrigins(urls);const ok=await chrome.permissions.request({origins});if(!ok)throw new Error('Retailer access was not enabled. Allow access to the selected store to scan it.');}
function setRunning(value){running=value;$('scan-inputs').disabled=value;$('recent-scans').disabled=value;$('import-button').disabled=value;$('pause').hidden=!value;$('resume').hidden=value||!job||!['ready','paused'].includes(job.status);$('match-collected').hidden=value||!job||job.phase!=='discover'||!job.leads.length;}
async function run(){
  if(running||!job)return;pauseRequested=false;setRunning(true);
  notice('');
  if(reader&&reader.jobId!==job.id){await reader.close();reader=null;}
  if(reader?.tabId){try{await chrome.tabs.get(reader.tabId);reader.reuseCurrent=true;}catch{reader=null;}}
  if(!reader)reader=new E.BrowserReader({shouldStop:()=>pauseRequested,onTab:id=>{$('open-scan-tab').hidden=id===null;}});
  if(reader.jobId!==job.id){reader.jobId=job.id;if(job.metrics)reader.metrics=structuredClone(job.metrics);}
  try{
    await navigator.locks.request('asin-pulse-category-scan',{ifAvailable:true},async lock=>{
      if(!lock){notice('Another sourcing desk is already scanning. Pause it before starting here.');return;}
      const runner=new E.Runner({reader,shouldStop:()=>pauseRequested,save:saveJob,onChange:()=>render()});await runner.run(job);recent();
    });
  }catch(error){job.status='paused';job.message=error.message;await saveJob(job);notice(error.message);}
  finally{setRunning(false);render();}
}
function filtered(){
  const filters={};for(const [key,id] of Object.entries({text:'filter-text',kind:'filter-kind',priceSource:'price-source',minPrice:'min-price',maxPrice:'max-price',minSpread:'min-spread',minRank:'min-rank',maxRank:'max-rank',rankCategory:'rank-category',minProfit:'min-profit',minRoi:'min-roi'}))filters[key]=$(id).value;
  const rows=(job?.leads||[]).filter(l=>S.filterLead(l,filters,settings));
  const sort=$('sort').value;rows.sort((a,b)=>{if(sort==='rank')return (S.salesRank(selected(a)?.salesRank||selected(a)?.rank)?.value??Infinity)-(S.salesRank(selected(b)?.salesRank||selected(b)?.rank)?.value??Infinity);if(sort==='title')return a.source.title.localeCompare(b.source.title);if(sort==='match')return (selected(b)?.match.score??-1)-(selected(a)?.match.score??-1);return (calculation(b)[sort]??-Infinity)-(calculation(a)[sort]??-Infinity);});return rows;
}
function productCell(p,label){const td=node('td'),wrap=node('div',undefined,'product-cell');if(p?.image){const img=node('img');img.src=p.image;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';wrap.append(img);}const body=node('div');body.append(p?link(p.title,p.url):node('span',label||'Not checked','muted'));if(p)body.append(node('small',[p.asin||p.retailer,p.size,p.color].filter(Boolean).join(' · ')));wrap.append(body);td.append(wrap);return td;}
function renderRows(){
  const rows=filtered(),pageSize=50;pageNumber=Math.min(pageNumber,Math.max(0,Math.ceil(rows.length/pageSize)-1));$('results').replaceChildren();
  for(const l of rows.slice(pageNumber*pageSize,(pageNumber+1)*pageSize)){
    const p=selected(l),c=calculation(l),tr=node('tr');tr.dataset.id=l.id;
    tr.append(productCell(l.source),productCell(p,l.note||l.status));
    for(const [value,positive] of [[l.source.currency==='USD'?l.source.price:null,false],[p?.currency==='USD'?p.price:null,false],[c.spread,true],[c.ready&&eligible(l)?c.profit:null,true]])tr.append(node('td',money(value),'amount '+(positive&&value>0?'positive':positive&&value<0?'negative':'')));
    tr.append(node('td',c.ready&&eligible(l)&&c.roi!==null?c.roi.toFixed(1)+'%':'—','amount '+(c.roi>0?'positive':'')));
    const rank=S.salesRank(p?.salesRank||p?.rank),rankCell=node('td',rank?'#'+rank.value.toLocaleString():'—','amount');if(rank)rankCell.append(node('small',rank.category));tr.append(rankCell);
    const status=node('td'),level=l.confirmed?'confirmed':p?.match.level||l.status;status.append(node('span',{identifier:'UPC / GTIN match',model:'Brand + model match',review:'Needs review',weak:'Weak candidate',conflict:'Conflict',confirmed:'Confirmed',queued:'Queued',checking:'Checking',matched:'Candidate',unmatched:'No match',out:'Out of stock',error:'Page error'}[level]||level,'badge '+level));
    if(l.source.detailVerified===false)status.append(node('div','Retail price unverified','muted'));
    if(p?.signal)status.append(node('div',p.signal.count.toLocaleString()+(p.signal.plus?'+':'')+' monthly signal','muted'));tr.append(status);
    const action=node('td'),button=node('button',l.saved?'★ Review':'Review','review-button');button.disabled=running;button.addEventListener('click',()=>openReview(l.id));action.append(button);tr.append(action);$('results').append(tr);
  }
  $('empty').hidden=rows.length>0;$('result-count').textContent=`${rows.length} shown`;$('page-label').textContent=rows.length?`${pageNumber*pageSize+1}–${Math.min(rows.length,(pageNumber+1)*pageSize)} of ${rows.length}`:'0 results';$('prev-page').disabled=pageNumber===0;$('next-page').disabled=(pageNumber+1)*pageSize>=rows.length;
  if(job&&!rows.length){$('empty').querySelector('h3').textContent=job.leads.length?'No results match these filters.':'Collecting the category…';$('empty').querySelector('p').textContent=job.leads.length?'Broaden your filters, or inspect all results to see unmatched and unavailable products.':job.message;}
}
function render(){
  $('progress-card').hidden=!job;
  if(job){$('job-status').textContent=job.status.toUpperCase();$('job-title').textContent=`${job.retailer} · ${job.category}`;$('progress-message').textContent=job.message;$('progress-bar').value=job.phase==='discover'?0:job.leads.length?job.nextIndex/job.leads.length*100:0;
    $('coverage').textContent=`${job.visited.length} category pages · ${job.leads.length} products collected${job.expectedTotal?' · retailer reports '+job.expectedTotal:''} · ${job.suppliedProducts?'Supplied product list; not a whole category scan':job.discoveryComplete?'Reached the end of readable category results':job.phase==='discover'?'Discovery in progress':'Category coverage incomplete / limited'}`;
    $('scan-log').replaceChildren(...job.events.map(e=>node('li',new Date(e.time).toLocaleTimeString()+' · '+e.text)));}
  const leads=job?.leads||[];$('stat-products').textContent=leads.length.toLocaleString();$('stat-matches').textContent=leads.filter(eligible).length.toLocaleString();$('stat-cheaper').textContent=leads.filter(l=>eligible(l)&&calculation(l).spread>0).length.toLocaleString();$('stat-profit').textContent=S.number(settings.fba)===null&&!leads.some(l=>S.number(l.fees?.fba)!==null)?'—':leads.filter(l=>eligible(l)&&calculation(l).profit>0).length.toLocaleString();
  const completed=leads.filter(l=>l.elapsedMs),average=completed.length?completed.reduce((n,l)=>n+l.elapsedMs,0)/completed.length/1000:0;
  $('timing').textContent=job?`${job.nextIndex||0} / ${leads.length} products checked${average?' · '+Math.round(average)+' seconds per product on average':''}${job.metrics?.pages?' · '+job.metrics.pages+' page reads':''}`:'';
  $('recheck').disabled=running||!leads.length;
  $('cost-summary').textContent=S.number(settings.fba)===null?'Enter your FBA fee to calculate profit and ROI':`Assumptions: ${settings.referral}% referral · ${money(settings.fba)} FBA · ${settings.discount}% discount`;
  setRunning(running);renderRows();
}
function exportRows(){const rows=[['Retailer','Retail title','Retail URL','Retail price','Currency','Retail checked at','UPC / GTIN','ASIN','Amazon title','Amazon URL','Amazon price','Amazon sales rank','Rank category','Amazon checked at','Price difference','Est net profit','Est ROI %','Est margin %','Break even price','Acquisition cost','Referral fee','FBA fee','Other fee','Match status','Match evidence','Confirmed by user','Saved','Category coverage complete','Scan status']];
  for(const l of filtered()){const p=selected(l),c=calculation(l);rows.push([l.source.retailer,l.source.title,l.source.url,l.source.price,l.source.currency,l.source.observedAt,(l.source.gtins||[]).join(' '),p?.asin,p?.title,p?.url,p?.price,S.salesRank(p?.salesRank||p?.rank)?.value,S.salesRank(p?.salesRank||p?.rank)?.category,p?.observedAt,c.spread,c.ready&&eligible(l)?c.profit:'',c.ready&&eligible(l)?c.roi:'',c.ready&&eligible(l)?c.margin:'',c.ready&&eligible(l)?c.breakEven:'',c.acquisition,c.referral,c.fba,c.other,p?.match.level,p?.match.reasons.join('; '),l.confirmed?'Yes':'No',l.saved?'Yes':'No',job.discoveryComplete?'Yes':'No',l.status]);}return rows;
}
function download(name,text,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function openReview(id){
  const l=job?.leads.find(l=>l.id===id);if(!l)return;reviewing=id;
  const p=selected(l),c=calculation(l),root=$('review-content');root.replaceChildren(node('h2','Review this opportunity'));
  const compare=node('div',undefined,'comparison');for(const [label,item] of [['Retail source',l.source],['Amazon candidate',p]]){const card=node('div');card.append(node('span',label,'eyebrow'));if(item){if(item.image){const img=node('img');img.src=item.image;img.alt='';img.referrerPolicy='no-referrer';card.append(img);}card.append(node('h3',item.title),link('Open listing ↗',item.url),node('p',item.currency==='USD'?money(item.price):'Currency / price unconfirmed','amount'));const dl=node('dl',undefined,'facts');for(const [k,v] of [['ASIN',item.asin],['Amazon sales rank',S.salesRank(item.salesRank||item.rank)?.text||item.rank],['Brand',item.brand],['Model',item.model],['UPC / GTIN',(item.gtins||[]).join(', ')],['Color',item.color],['Size',item.size],['Pack',S.attributes(item).pack],['Availability',item.availability],['Checked',item.observedAt?new Date(item.observedAt).toLocaleString():null]]){if(v){dl.append(node('dt',k),node('dd',String(v)));}}card.append(dl);}else card.append(node('p',l.note||'No candidate yet.'));compare.append(card);}root.append(compare);
  if(p){root.append(node('p',p.match.reasons.join('. '),'review-note'));root.append(node('p',c.ready&&eligible(l)?`Estimated profit ${money(c.profit)} · ROI ${c.roi===null?'not defined':c.roi.toFixed(1)+'%'} · Break-even ${money(c.breakEven)}`:c.ready?'Confirm the product match before relying on profit estimates.':c.errors.join('. '),'review-note'));}
  const form=node('div',undefined,'review-form');
  const choiceLabel=node('label','Amazon candidate'),choice=node('select');choice.id='candidate-choice';l.candidates.forEach((v,i)=>{const o=node('option',`${v.asin} · ${money(v.price)} · ${v.match.level} · ${v.title.slice(0,65)}`);o.value=String(i);choice.append(o);});choice.value=String(l.selected||0);choice.addEventListener('change',async()=>{l.selected=Number(choice.value);l.confirmed=false;await saveJob(job);openReview(id);render();});choiceLabel.append(choice);choiceLabel.className='wide';form.append(choiceLabel);
  for(const [key,label,placeholder] of [['fba','FBA fee override $','Use shared assumption'],['referral','Referral % override','Use shared assumption']]){const lab=node('label',label),input=node('input');input.id='review-'+key;input.type='number';input.min='0';input.step='.01';if(key==='referral')input.max='100';input.placeholder=placeholder;input.value=l.fees?.[key]??'';lab.append(input);form.append(lab);}
  const manual=node('label','Check another Amazon ASIN'),asin=node('input');asin.id='manual-asin';asin.placeholder='B0… (10 characters)';asin.maxLength=10;manual.append(asin);form.append(manual);const manualButton=node('button','Check ASIN','secondary');manualButton.disabled=running;manualButton.addEventListener('click',()=>manualMatch(l,asin.value));form.append(manualButton);
  const confirm=node('label',undefined,'review-check wide'),check=node('input');check.id='confirm-match';check.type='checkbox';check.checked=Boolean(l.confirmed);check.disabled=!p||p.match.level==='conflict';confirm.append(check,document.createTextNode('I checked that size, color, pack quantity, and condition match.'));form.append(confirm);root.append(form);
  const actions=node('div',undefined,'review-actions'),save=node('button','Save review'),favorite=node('button',l.saved?'★ Saved — remove star':'☆ Save opportunity','secondary');save.addEventListener('click',async()=>{l.fees=l.fees||{};for(const key of ['fba','referral']){const v=$('review-'+key).value;if(v==='')delete l.fees[key];else{const n=S.number(v);if(n===null||n<0||key==='referral'&&n>100){notice('Enter a valid fee value.');return;}l.fees[key]=n;}}l.confirmed=$('confirm-match').checked;await saveJob(job);render();$('review-dialog').close();notice('Review saved.');});favorite.addEventListener('click',async()=>{l.saved=!l.saved;await saveJob(job);openReview(id);render();});actions.append(save,favorite,link('Search Amazon by title ↗',`https://www.amazon.com/s?k=${encodeURIComponent(l.source.title)}`));root.append(actions,node('p','Profit uses the latest saved prices and your cost assumptions. Clothing size ranges, membership prices, coupons, and multi-packs need manual verification.','fine'));
  if(!$('review-dialog').open)$('review-dialog').showModal();
}
async function manualMatch(lead,value){
  const asin=S.clean(value).toUpperCase();if(!/^[A-Z0-9]{10}$/.test(asin)){notice('Enter a valid 10-character Amazon ASIN.');return;}
  const manualReader=new E.BrowserReader();try{notice('Reading the Amazon product…');const p=await manualReader.open(`https://www.amazon.com/dp/${asin}`,'amazonProduct');if(p.missing)throw new Error('Amazon did not provide a readable product.');lead.candidates.push({...p,match:S.match(lead.source,p)});lead.selected=lead.candidates.length-1;lead.confirmed=false;lead.status='matched';await saveJob(job);openReview(lead.id);render();notice('Amazon candidate added.');}catch(error){notice(error.message);}finally{await manualReader.close();}
}
$('retailer').addEventListener('change',fillCategories);$('category').addEventListener('change',fillUrl);
$('browse-category').addEventListener('click',()=>{const url=S.safeUrl($('source-url').value);if(url)chrome.tabs.create({url});else notice('Enter a category URL first.');});
$('scan-form').addEventListener('submit',async event=>{event.preventDefault();if(running)return;try{const url=S.retailUrl($('source-url').value);if(!url)throw new Error('Enter a public HTTPS category URL.');const store=Retailers.find(s=>s.id===$('retailer').value);if(new URL(url).hostname.replace(/^www\./,'')!==store.host.replace(/^www\./,''))throw new Error('The URL must belong to the selected retailer.');await requestAccess([url]);job=E.newJob({url,retailer:store.name,category:$('category').value==='custom'?'Custom category':store.categories[Number($('category').value)][0],limit:$('limit').value});await saveJob(job);recent();pageNumber=0;render();await run();}catch(error){notice(error.message);}});
$('pause').addEventListener('click',()=>{pauseRequested=true;notice('Pausing at the next safe checkpoint…');});
$('resume').addEventListener('click',async()=>{try{await requestAccess([job.url,...job.leads.filter(l=>l.status==='queued').map(l=>l.source.url)]);await run();}catch(error){notice(error.message);}});
$('match-collected').addEventListener('click',async()=>{job.discoveryComplete=false;job.events.push({time:new Date().toISOString(),text:'You chose to match the products collected so far. Category coverage is incomplete.'});job.phase='match';job.nextIndex=0;await saveJob(job);await run();});
$('open-scan-tab').addEventListener('click',async()=>{if(reader?.tabId)try{await chrome.tabs.update(reader.tabId,{active:true});}catch{notice('The scan tab was closed. Resume to create a new one.');}});
$('cost-form').addEventListener('submit',async e=>{e.preventDefault();settings=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,S.number(v)]));await chrome.storage.local.set({sourcingSettings:settings});render();notice('Cost assumptions saved.');});
$('recent-scans').addEventListener('change',async()=>{const id=$('recent-scans').value;job=auditSaved((await chrome.storage.local.get('sourcingJob:'+id))['sourcingJob:'+id]);if(job?.status==='running'){job.status='paused';job.message='Scan was interrupted. Resume from its saved checkpoint.';}pageNumber=0;render();});
for(const id of ['filter-text','filter-kind','price-source','min-price','max-price','min-spread','min-rank','max-rank','rank-category','min-profit','min-roi','sort'])$(id).addEventListener('input',()=>{pageNumber=0;renderRows();const sourcingFilters=Object.fromEntries([...document.querySelectorAll('.filters input,.filters select')].map(el=>[el.id,el.value]));chrome.storage.local.set({sourcingFilters});});
$('clear-filters').addEventListener('click',async()=>{for(const el of document.querySelectorAll('.filters input'))el.value='';$('filter-kind').value='all';$('price-source').value='retail';$('sort').value='spread';pageNumber=0;await chrome.storage.local.remove('sourcingFilters');renderRows();});
$('show-saved').addEventListener('click',()=>{$('filter-kind').value='saved';pageNumber=0;renderRows();$('results').scrollIntoView({behavior:'smooth'});});
$('prev-page').addEventListener('click',()=>{pageNumber--;renderRows();});$('next-page').addEventListener('click',()=>{pageNumber++;renderRows();});
$('export').addEventListener('click',()=>{if(!job){notice('Run or import a scan first.');return;}download(`asin-pulse-${job.retailer.replace(/\W/g,'')}-${new Date().toISOString().slice(0,10)}.csv`,S.csvExport(exportRows()));notice('Visible results exported.');});
$('export-audit').addEventListener('click',()=>{if(!job)return;download(`asin-pulse-audit-${Date.now()}.json`,JSON.stringify({version:chrome.runtime.getManifest().version,exportedAt:new Date().toISOString(),job,costAssumptions:settings},null,2),'application/json');notice('Scan data, match evidence, and page timings exported.');});
$('recheck').addEventListener('click',async()=>{if(running||!job)return;try{await requestAccess([job.url,...job.leads.map(l=>l.source.url)]);const original=job;job=E.newJob({url:original.url,retailer:original.retailer,category:original.category+' · recheck',products:original.leads.map(l=>({...l.source}))});job.previousScanId=original.id;await saveJob(job);recent();render();await run();}catch(error){notice(error.message);}});
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>5000000)throw new Error('Use a CSV smaller than 5 MB.');const parsed=S.importCsv(await file.text());if(!parsed.products.length)throw new Error(parsed.errors.slice(0,4).join(' ')||'No valid products found.');job=E.newJob({url:parsed.products[0].url,retailer:'CSV import',category:file.name,products:parsed.products});await saveJob(job);recent();render();notice(`${parsed.products.length} products imported. Click Resume scan to find matches.${parsed.errors.length?' '+parsed.errors.slice(0,4).join(' '):''}`);}catch(error){notice(error.message);}finally{$('import-file').value='';}});
addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});fillStores();
  const stored=await chrome.storage.local.get(['sourcingSettings','sourcingIndex','sourcingCapture','sourcingFilters']);settings={...S.defaults,...stored.sourcingSettings};index=stored.sourcingIndex||[];
  for(const [k,v] of Object.entries(settings)){const input=$('cost-form').elements.namedItem(k);if(input)input.value=v??'';}
  if(index.length){job=auditSaved((await chrome.storage.local.get('sourcingJob:'+index[0].id))['sourcingJob:'+index[0].id]);if(job?.status==='running'){job.status='paused';job.message='Scan was interrupted. Resume from its saved checkpoint.';}}
  if(stored.sourcingCapture){const capture=stored.sourcingCapture;await chrome.storage.local.remove('sourcingCapture');$('capture-banner').hidden=false;$('capture-banner').append(node('span',`${capture.products.length} products captured from ${capture.retailer}.`));const use=node('button','Compare these products');use.addEventListener('click',async()=>{job=E.newJob({url:capture.url,retailer:capture.retailer,category:'Captured page',products:capture.products});await saveJob(job);recent();render();$('capture-banner').hidden=true;});$('capture-banner').append(use);const store=Retailers.find(s=>new URL(capture.url).hostname===s.host);if(store){$('retailer').value=store.id;fillCategories();$('category').value='custom';$('source-url').value=capture.url;}}
  for(const [id,value] of Object.entries(stored.sourcingFilters||{})){const el=$(id);if(el&&/^(filter-|price-source|min-|max-|rank-category|sort)/.test(id))el.value=value;}
  document.querySelector('footer').textContent=`ASIN Pulse ${chrome.runtime.getManifest().version_name||chrome.runtime.getManifest().version} · Scans and saved leads stay in this Chrome profile.`;
  if(new URL(location.href).searchParams.has('updated'))notice('ASIN Pulse updated. Your saved scans and settings are ready.');
  recent();render();
})();

// Test the actual packaged extension in an isolated browser profile.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(process.argv[2]||'.'),config=JSON.parse(fs.readFileSync(path.join(__dirname,'../distribution/config.json')));
 const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  console.log(`Testing ${process.platform}/${process.arch} Chromium ${context.browser().version()}`);
  let [worker]=context.serviceWorkers();if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:20000});assert.equal(worker.url().split('/')[2],config.extensionId);
  // Match the real one-time installation guide. Command-line sideloading initially
  // works with Developer mode off, but Chromium disables it on runtime.reload().
  const manager=await context.newPage();await manager.goto('chrome://extensions');
  const developerMode=manager.locator('#devMode');
  if(!await developerMode.evaluate(el=>el.checked))await developerMode.click();
  await manager.close();
  const url=`chrome-extension://${config.extensionId}/`,page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'sourcing.html');await page.waitForFunction(()=>document.getElementById('retailer').options.length===7);
  const manifest=await page.evaluate(()=>chrome.runtime.getManifest());assert.equal(manifest.version,JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.json'),'utf8')).version);
  await page.evaluate(async()=>{
   const source={title:'Browser test product',url:'https://www.carters.com/p/test/1',price:9,currency:'USD',brand:'Test',model:'123',gtins:['194135313606'],detailVerified:true};
   const candidate={...source,price:14.99,asin:'B012345678',url:'https://www.amazon.com/dp/B012345678',rank:'#12,345 in Toys & Games'};
   const job={id:'browser-test',retailer:'Test',category:'Synthetic browser test',createdAt:new Date().toISOString(),status:'complete',phase:'done',nextIndex:1,visited:[],events:[],engineVersion:'2.2',leads:[{id:'a',source,candidates:[candidate],selected:0,status:'matched'}]};
   await chrome.storage.local.set({sourcingIndex:[{id:job.id,retailer:'Test',category:job.category,count:1}],['sourcingJob:'+job.id]:job});
  });
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#results tr').length===1);
  await page.selectOption('#filter-kind','cheaper');await page.fill('#max-rank','10000');await page.waitForFunction(()=>document.getElementById('result-count').textContent==='0 shown');
  await page.fill('#max-rank','15000');await page.waitForFunction(()=>document.getElementById('result-count').textContent==='1 shown');
  await page.fill('#min-price','9.01');await page.waitForFunction(()=>document.getElementById('result-count').textContent==='0 shown');
  await page.fill('#min-price','9');await page.waitForFunction(()=>document.getElementById('result-count').textContent==='1 shown');
  await page.locator('#cost-details summary').click();await page.fill('[name="fba"]','3');await page.locator('#cost-form button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById('results').textContent.includes('$0.74'));
  await page.locator('.review-button').click();await page.getByRole('button',{name:'☆ Save opportunity',exact:true}).click();
  await page.getByRole('button',{name:'Save review',exact:true}).click();
  const exported=page.waitForEvent('download');await page.locator('#export').click();
  const download=await exported,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const csv=Buffer.concat(chunks).toString('utf8');assert.match(csv,/Browser test product/);assert.match(csv,/12345/);assert.match(csv,/0\.74/);
  // Let the user-triggered storage write resolve before exercising runtime.reload().
  await page.waitForFunction(async()=>(await chrome.storage.local.get('sourcingFilters')).sourcingFilters?.['max-rank']==='15000');
  const reopened=context.waitForEvent('page',{timeout:20000});
  await page.goto(url+'update.html').catch(e=>{if(!/closed|interrupted|ERR_ABORTED/.test(e.message))throw e});
  const desk=await reopened;await desk.waitForURL(url+'sourcing.html?updated=1',{timeout:20000});await desk.waitForFunction(()=>document.getElementById('result-count').textContent==='1 shown');
  assert.equal(await desk.inputValue('#max-rank'),'15000');assert.match(await desk.locator('#app-status').textContent(),/updated/);assert.deepEqual(errors,[]);
  assert.equal(await desk.inputValue('[name="fba"]'),'3');assert.match(await desk.locator('#results').textContent(),/★ Review/);
  await desk.locator('#clear-filters').click();assert.equal(await desk.inputValue('#max-rank'),'');
  console.log('PASS: packaged extension loads; price/rank boundaries, cost calculation, review, favorites and CSV export work; runtime reload preserves scans, filters and settings and reopens the desk.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

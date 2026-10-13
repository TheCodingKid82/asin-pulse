const test=require('node:test'),assert=require('node:assert/strict');global.Sourcing=require('../sourcing-core.js');const E=require('../sourcing-engine.js');
const source={title:'Skip Hop Magic Wand',brand:'Skip Hop',model:'9K176510',price:9,currency:'USD',gtins:['194135313606'],color:'Pink',url:'https://www.carters.com/p/magic-wand/V_9K176510'};
const amazon={...source,price:14.99,asin:'B08MAGIC01',url:'https://www.amazon.com/dp/B08MAGIC01',rank:'#12,345 in Toys & Games',missing:false};
class Reader{
 async open(url,kind){if(kind==='retail')return {isProduct:true,products:[{...source,url}],url};if(kind==='amazonSearch')return {products:[amazon],url};if(kind==='amazonProduct')return amazon;throw Error(kind)}
 async close(){this.closed=true}
}
test('complete match run verifies retail, compares exact product, preserves rank',async()=>{
 const reader=new Reader(),saved=[],job=E.newJob({url:source.url,retailer:'Carter’s',category:'test',products:[source]});await new E.Runner({reader,save:async j=>saved.push(j.nextIndex)}).run(job);
 assert.equal(job.status,'complete');assert.equal(job.leads[0].source.detailVerified,true);assert.equal(job.leads[0].candidates[0].match.level,'identifier');assert.equal(Sourcing.salesRank(job.leads[0].candidates[0].rank).value,12345);assert.equal(Sourcing.filterLead(job.leads[0],{kind:'cheaper',maxRank:15000}),true);assert(reader.closed);assert(saved.length>2);
});
test('challenge pauses with checkpoint; resume completes without duplicate rows',async()=>{
 const reader=new Reader();reader.open=async()=>{throw new E.ScanError('Page check','blocked')};const job=E.newJob({url:source.url,products:[source]});await new E.Runner({reader,save:async()=>{}}).run(job);
 assert.equal(job.status,'paused');assert.equal(job.nextIndex,0);assert.equal(job.leads[0].status,'queued');assert.equal(job.errorCode,'blocked');
 await new E.Runner({reader:new Reader(),save:async()=>{}}).run(job);assert.equal(job.status,'complete');assert.equal(job.leads.length,1);
});
test('category collection traverses next page and deduplicates shared listings',async()=>{
 const a={...source},b={...source,url:source.url+'2'};const reader=new Reader();reader.retailPage=async url=>({url,products:url.endsWith('2')?[a,b]:[a],expectedTotal:2,nextUrl:url.endsWith('2')?null:'https://www.carters.com/c/test2'});
 const job=E.newJob({url:'https://www.carters.com/c/test',retailer:'Carter’s',category:'test'});await new E.Runner({reader,save:async()=>{}}).run(job);assert.equal(job.leads.length,2);assert.equal(job.visited.length,2);assert.equal(job.discoveryComplete,true);assert.equal(job.status,'complete');
});
test('parent style compares each exposed exact size, not a random parent match',async()=>{
 const reader=new Reader(),variants=[{...source,url:source.url+'-small',size:'S'},{...source,url:source.url+'-large',size:'L'}];const open=reader.open.bind(reader);reader.open=async(url,kind)=>kind==='retail'&&url===source.url?{isProduct:true,products:[],variantProducts:variants,url}:kind==='retail'?{isProduct:true,products:[variants.find(v=>v.url===url)],url}:open(url,kind);
 const job=E.newJob({url:source.url,products:[source]});await new E.Runner({reader,save:async()=>{}}).run(job);assert.equal(job.status,'complete');assert.equal(job.leads.length,2);assert.deepEqual(job.leads.map(l=>l.source.size),['S','L']);assert(job.leads.every(l=>l.source.detailVerified));
});

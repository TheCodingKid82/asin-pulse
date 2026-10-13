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
test('reordered search title is inspected before rejecting an exact UPC product',async()=>{
 const item={...source,title:'19 PCS Realistic Dinosaur Figures & Trees for Toddlers, Dinosaur Toys with Activity Play Mat & Cage, Dino Playset Toys for Kids Boys Girls Gift 3-5',brand:'',model:'',gtins:['840494318812'],color:''};
 const candidate={...item,asin:'B0DDSW14H1',url:'https://www.amazon.com/dp/B0DDSW14H1',title:'JOYIN 19 PCS Dinosaur Toys with Activity Play Mat & Storage Cage, 6 Piece Large Soft Dinosaur Figures with an Educational Book, Realistic Dinosaur Figures & Trees for Toddlers Kids Ages 3-5'};
 assert.equal(Sourcing.match(item,{title:candidate.title}).level,'weak');
 const reader=new Reader();reader.open=async(url,kind)=>kind==='retail'?{isProduct:true,products:[item],url}:kind==='amazonSearch'?{products:url.includes('840494318812')?[]:[{title:candidate.title,asin:candidate.asin,url:candidate.url}],url}:candidate;
 const job=E.newJob({url:item.url,products:[item]});await new E.Runner({reader,save:async()=>{}}).run(job);
 assert.equal(job.leads[0].candidates[0].asin,candidate.asin);assert.equal(job.leads[0].candidates[0].match.level,'identifier');
});

test('browser reader follows Boscov numeric category aliases while rejecting unrelated product and host redirects',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 async function read(requested,actual){
  let clock=0;const page={url:actual,products:[{title:'LEGO Aircraft',url:'https://www.boscovs.com/product/lego/871052',price:14.99}]};
  const context={Sourcing:global.Sourcing,URL,Date:{now:()=>clock},setTimeout:(fn,ms)=>{clock+=ms;queueMicrotask(fn)},chrome:{tabs:{create:async()=>({id:1}),get:async()=>({url:actual}),update:async()=>({id:1})},scripting:{executeScript:async options=>options.files?[]:[{result:page}]}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sourcing-engine.js'),'utf8'),context);
  return new context.SourcingEngine.BrowserReader().open(requested,'retail');
 }
 const alias='https://www.boscovs.com/c/6170016',canonical='https://www.boscovs.com/category/building-sets-and-blocks';
 assert.equal((await read(alias,canonical)).products[0].price,14.99);
 await assert.rejects(read('https://www.boscovs.com/product/lego/1','https://www.boscovs.com/product/lego/2'),error=>error.code==='read');
 await assert.rejects(read(alias,'https://www.target.com/category/building-sets-and-blocks'),error=>error.code==='read');
});

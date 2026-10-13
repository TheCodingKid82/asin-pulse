const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
test('sourcing desk loads saved work, filters price/rank, exports matching CSV, and remembers filters',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../sourcing.html'),'utf8');const d=new JSDOM(html,{url:'https://extension.test/sourcing.html',runScripts:'outside-only'}),w=d.window;
 let download;w.Blob=Blob;w.URL.createObjectURL=blob=>(download=blob,'blob:test');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 const S=require('../sourcing-core.js');const a={title:'Magic Wand',brand:'Skip Hop',model:'9K176510',color:'Pink',price:9,currency:'USD',gtins:['194135313606'],detailVerified:true,url:'https://www.carters.com/p/magic-wand/1'};
 const b={...a,title:'Dinosaur',brand:'MEGA',model:'dino',color:'',price:21.99,url:'https://www.boscovs.com/product/dino/2'};
 const lead=(source,price,rank,id)=>{const p={...source,price,rank,asin:'B012345678',url:'https://www.amazon.com/dp/B012345678'};return {id,source,candidates:[{...p,match:S.match(source,p)}],status:'matched',selected:0}};
 const job={id:'test',retailer:'Test',category:'Saved scan',createdAt:new Date().toISOString(),status:'complete',phase:'done',nextIndex:2,visited:[],events:[],message:'Done',engineVersion:'2.2',leads:[lead(a,14.99,'#12,345 in Toys & Games','a'),lead(b,14.98,'#50,000 in Toys & Games','b')]};
 const data={sourcingIndex:[{id:'test',retailer:'Test',category:'Saved scan',count:2}],['sourcingJob:test']:job};
 w.chrome={runtime:{getManifest:()=>({version:'2.2.0',version_name:'2.2.0 (test)'})},storage:{local:{setAccessLevel:async()=>{},get:async()=>data,set:async v=>Object.assign(data,v),remove:async()=>{}}}};
 for(const f of ['core.js','sourcing-core.js','retailers.js','sourcing-engine.js','sourcing.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
 await new Promise(setImmediate);const $=id=>w.document.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'))};
 assert.equal($('retailer').options.length,7);assert.equal($('results').children.length,2);assert.equal($('stat-cheaper').textContent,'1');
 change('filter-kind','cheaper');assert.equal($('results').children.length,1);assert.match($('results').textContent,/#12,345/);$('export').click();assert(download);assert(!(await download.text()).includes('Dinosaur'));assert((await download.text()).includes('Magic Wand'));
 change('max-rank','10000');assert.equal($('results').children.length,0);change('max-rank','15000');assert.equal($('results').children.length,1);
 change('min-price','10');assert.equal($('results').children.length,0);change('min-price','9');assert.equal($('results').children.length,1);
 assert.equal(data.sourcingFilters['min-price'],'9');assert.equal(data.sourcingFilters['max-rank'],'15000');assert.match(w.document.querySelector('footer').textContent,/2.2.0 \(test\)/);d.window.close();
});

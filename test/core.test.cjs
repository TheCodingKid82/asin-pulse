const test=require('node:test'),assert=require('node:assert/strict'),S=require('../sourcing-core.js');
const product={title:'Skip Hop Magic Wand',brand:'Skip Hop',model:'9K176510',gtins:['194135313606'],price:9,currency:'USD',color:'Pink',detailVerified:true};
const target={...product,price:14.99,asin:'B08MAGIC01',rank:'#12,345 in Toys & Games (See Top 100 in Toys & Games) #35 in Magic Kits'};
const lead=()=>({source:{...product},candidates:[{...target,match:S.match(product,target)}],selected:0});
test('short retail titles retain their brand in the fallback search',()=>{
 assert.deepEqual(S.searchQueries({...product,title:'Magic Wand'}),['Skip Hop 9K176510','194135313606','Skip Hop Magic Wand']);
 assert.equal(S.searchQueries({...product,title:'Skip Hop Magic Wand'}).at(-1),'Skip Hop Magic Wand');
});
test('all requested retailer URLs accepted, unrelated/private URLs rejected',()=>{
 for(const h of ['walmart.com','target.com','kohls.com','carters.com','boscovs.com'])assert.equal(new URL(S.retailUrl(`https://${h}/p/a`)).hostname,`www.${h}`);
 for(const u of ['https://boscovs.com.evil.test/a','http://carters.com/p/a','https://localhost/a','https://user:pass@carters.com/p/a'])assert.equal(S.retailUrl(u),null);
});
test('matching UPCs do not override color, size, pack, model conflicts or unknown variants',()=>{
 assert.equal(S.match(product,target).level,'identifier');
 for(const change of [{color:'Blue'},{model:'OTHER'},{pack:2},{size:'6-9M'}]){const a={...product,pack:1,size:'0-3M'},b={...target,pack:1,size:'0-3M',...change};assert.equal(S.match(a,b).level,'conflict');}
 assert.equal(S.match(product,{...target,color:''}).level,'review');
 assert.equal(S.match(product,{...target,variantUnresolved:true}).level,'review');
 assert.equal(S.match(product,{...target,gtins:['194735379385']}).level,'conflict');
});
test('primary Amazon sales rank preserves category and never turns missing rank into zero',()=>{
 assert.deepEqual(S.salesRank(target.rank),{value:12345,category:'Toys & Games',text:target.rank});
 for(const r of ['',null,'Not available','#0 in Toys','4.8 out of 5 stars'])assert.equal(S.salesRank(r),null);
 assert.equal(S.salesRank('#1 in Clothing, Shoes & Jewelry').value,1);
});
test('price and rank boundaries work together, missing values fail active filters',()=>{
 const l=lead();assert(S.filterLead(l,{kind:'cheaper',minPrice:9,maxPrice:9,maxRank:12345,rankCategory:'Toys & Games',minSpread:5.99}));
 for(const f of [{minPrice:9.01},{maxPrice:8.99},{maxRank:12344},{minRank:12346},{rankCategory:'Books'},{minSpread:6},{priceSource:'amazon',maxPrice:14.98}])assert.equal(S.filterLead(l,f),false,JSON.stringify(f));
 assert(S.filterLead(l,{priceSource:'amazon',minPrice:14.99,maxPrice:14.99}));
 l.candidates[0].rank='';assert.equal(S.filterLead(l,{maxRank:100000}),false);assert(S.filterLead(l,{}));
 l.source.price=null;assert.equal(S.filterLead(l,{maxPrice:100}),false);
});
test('unverified, conflicted, out-of-stock and uncertain matches are not price opportunities',()=>{
 for(const change of [l=>l.source.detailVerified=false,l=>delete l.source.detailVerified,l=>l.candidates[0].match.level='conflict',l=>l.candidates[0].match.level='review',l=>l.source.availability='out']){const l=lead();change(l);assert.equal(S.filterLead(l,{kind:'cheaper'}),false);}
});
test('lower retail price is available without invented FBA fees',()=>{
 const l=lead(),c=S.costs(product,target);assert.equal(c.spread,5.99);assert.equal(c.ready,false);assert(S.filterLead(l,{kind:'cheaper'}));assert.equal(S.filterLead(l,{kind:'profit'}),false);
 const known=S.costs(product,target,{fba:3});assert.equal(known.profit,.74);assert.equal(known.acquisition,9);assert.equal(known.referral,2.25);
});
test('CSV imports both new retailers and exports formula-safe cells',()=>{
 const r=S.importCsv('title,url,price,currency,upc\nMagic Wand,https://carters.com/p/magic-wand/1,9,USD,194135313606\nDinosaur,https://boscovs.com/product/dino/2,21.99,USD,194735379385');assert.equal(r.products.length,2);assert.equal(r.errors.length,0);assert.match(S.csvExport([['=HYPERLINK("bad")']]),/\'=HYPERLINK/);
});

test('equivalent baby-size and gray/grey spellings match',()=>{assert.equal(S.match({...product,size:'0-3M',color:'Grey'},{...target,size:'0-3 Months',color:'Gray'}).level,'identifier');});

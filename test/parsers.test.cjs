const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function page(file,url){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'fixtures',file),'utf8'),{url,runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}]};
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){const c=this.cloneNode(true);for(const e of c.querySelectorAll('div,p,li,h1,h2'))e.append('\n');return c.textContent}});
 for(const f of ['core.js','scanner.js','sourcing-core.js','retail-scan.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
 return w;
}
test('live Carter category markup yields sale prices and Load More, without MSRP contamination',()=>{
 const w=page('carters-category.html','https://www.carters.com/c/baby-gear'),r=w.SourcingPage.retail();
 assert.equal(r.products.length,2);assert.equal(r.products[0].price,9);assert.equal(r.products[1].price,38);assert.equal(r.expectedTotal,391);assert.equal(r.loadMore,true);w.close();
});
test('current Target price module reads sale price and exact UPC, not MSRP or recommendations',()=>{
 const w=page('target-product.html','https://www.target.com/p/power-charge-spider-man/-/A-94855993'),r=w.SourcingPage.retail();
 assert.equal(r.products.length,1);assert.equal(r.products[0].price,33.99);assert.deepEqual([...r.products[0].gtins],['195166348551']);assert.equal(r.products[0].availability,'in');w.close();
});
test('live Carter product has exact UPC, model and color',()=>{
 const w=page('carters-product.html','https://www.carters.com/p/magic-wand/V_9K176510'),r=w.SourcingPage.retail(),p=r.products[0];
 assert.equal(p.price,9);assert.equal(p.brand,'Skip Hop');assert.equal(p.model,'9K176510');assert.deepEqual([...p.gtins],['194135313606']);assert.equal(p.color,'Pink');assert.equal(p.availability,'in');w.close();
});
test('Carter parent style expands all four exact sizes with separate UPCs',()=>{
 const base='https://www.carters.com/p/baby-sheep-striped-fleece-sleep-bag-grey/';let w=page('carters-variants.html',base+'V_1W142010'),r=w.SourcingPage.retail();
 assert.equal(r.products.length,0);assert.equal(r.variantProducts.length,4);assert.deepEqual(Array.from(r.variantProducts,p=>p.size),['0-3M','3-6M','6-9M','9-12M']);assert.equal(new Set(r.variantProducts.map(p=>p.gtins[0])).size,4);w.close();
 w=page('carters-variants.html',base+'198807135800');r=w.SourcingPage.retail();assert.equal(r.products.length,1);assert.equal(r.products[0].size,'3-6M');assert.equal(r.variantProducts.length,0);w.close();
});
test('live Boscov category extracts distinct products and next-page control',()=>{
 const w=page('boscovs-category.html','https://www.boscovs.com/category/all-toys'),r=w.SourcingPage.retail();
 assert.equal(r.products.length,2);assert.equal(r.products[0].price,21.99);assert.equal(r.products[1].price,7.99);assert.equal(r.expectedTotal,2042);assert.equal(r.nextButton,true);assert.equal(r.nextUrl,null);w.close();
});
test('Boscov product parses first-party data, never stock count as a sales rank',()=>{
 const w=page('boscovs-product.html','https://www.boscovs.com/product/mega-bloks-by-fisher-price-chomp-dinosaur-blocks/992740'),p=w.SourcingPage.retail().products[0];
 assert.equal(p.price,21.99);assert.equal(p.brand,'MEGA BLOKS');assert.equal(p.gtins[0],'194735379385');assert.equal(p.variantUnresolved,false);assert.equal(p.availability,'in');assert.equal(p.rank,undefined);w.close();
});
test('interrupted Amazon request is blocked, not an empty successful search',()=>{
 const w=page('carters-product.html','https://www.amazon.com/s?k=123');w.document.title='Sorry! Something went wrong!';w.document.body.textContent='Sorry! Something went wrong! Please try again.';assert.equal(w.SourcingPage.amazonSearch().blocked,true);w.close();
});
test('press and hold in a toy description is not a CAPTCHA',()=>{
 const w=page('carters-product.html','https://www.amazon.com/dp/B0CSQK1F8N');w.document.title='Green Goblin Electronic Pumpkin';w.document.body.innerHTML='<h1 id="productTitle">Green Goblin Electronic Pumpkin</h1><ul><li>Press and hold the button for lights and sounds.</li></ul>';
 assert.equal(w.SourcingPage.amazonProduct().blocked,false);
 w.document.title='Robot or human?';w.document.body.innerHTML='<h1>Press and hold</h1>Verify you are human';assert.equal(w.SourcingPage.amazonProduct().blocked,true);w.close();
});

test('Walmart cards use clean visible titles and current prices without treating an entire item stack as one product',()=>{
 const w=page('walmart-category.html','https://www.walmart.com/browse/toys/4171/'),r=w.SourcingPage.retail();
 assert.equal(r.products.length,2);assert.equal(r.products[0].title,'Apple AirPods 4');assert.equal(r.products[0].price,99);assert.equal(r.products[1].price,19.97);w.close();
});

test('Walmart selected product reads visible hero price, exact UPC and model, never recommendation prices',()=>{
 const w=page('walmart-product.html','https://www.walmart.com/ip/Apple-AirPods-4/11381374703'),p=w.SourcingPage.retail().products[0];
 assert.equal(p.title,'Apple AirPods 4');assert.equal(p.price,99);assert.equal(p.gtins[0],'195949688522');assert.equal(p.model,'MXP63LL/A');assert.equal(p.availability,'in');
 w.document.querySelector('[data-seo-id="hero-price"]').remove();assert.equal(w.SourcingPage.retail().products[0].price,null);
 w.close();
});

test('Kohl landing pages discover both catalog.jsp and catalog/category subcategories',()=>{
 const w=page('walmart-category.html','https://www.kohls.com/catalog/toys.jsp?CN=Department:Toys');w.document.body.innerHTML='<main><h1>Toys</h1><a href="/catalog.jsp?CN=Assortment:Top%20Toys">Top Toys</a><a href="/catalog/lego.jsp">LEGO</a></main>';
 const r=w.SourcingPage.retail();assert.equal(r.categoryLinks.length,2);assert.equal(r.department,true);w.close();
});

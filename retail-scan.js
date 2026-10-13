(function(){
  'use strict';
  const S=globalThis.Sourcing;
  const stores={'target.com':'Target','walmart.com':'Walmart','kohls.com':"Kohl’s",'carters.com':"Carter’s",'boscovs.com':"Boscov’s",'macys.com':"Macy’s",'jcpenney.com':'JCPenney'};
  const host=location.hostname.replace(/^www\./,'');
  const seenVisible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[hidden]');
  const text=el=>S.clean(el?.innerText??el?.textContent);
  function blocked(){
    if([...document.querySelectorAll('iframe#px-captcha-modal, #px-captcha, iframe[title*="challenge" i]')].some(seenVisible))return true;
    const t=S.clean(document.title+' '+document.body?.innerText?.slice(0,4500));
    // "Press and hold" is also a normal instruction on electronic toy pages.
    // Treat it as a challenge only when the page heading identifies a check.
    const heading=S.clean(document.title+' '+text(document.querySelector('h1')));
    if(/press (?:&|and) hold/i.test(heading)&&/human|robot|security|verify/i.test(t))return true;
    return /robot or human|verify (?:that )?you(?:'re| are) (?:a )?human|enter the characters you see|sorry, we just need to make sure|access denied|attention required|sorry!?.{0,20}something went wrong|unusual traffic|pardon our interruption|automated access/i.test(t);
  }
  function structured(){
    const objects=[];
    function walk(v,depth=0){if(!v||typeof v!=='object'||depth>12)return;if(Array.isArray(v)){v.slice(0,10000).forEach(x=>walk(x,depth+1));return;}if([v['@type']].flat().includes('ProductGroup')&&Array.isArray(v.hasVariant)){
        for(const child of v.hasVariant)objects.push({...child,brand:child.brand||v.brand,model:child.model||v.model,mpn:child.mpn||v.productGroupID,color:child.color||v.color,additionalProperty:child.additionalProperty||v.additionalProperty,gtin:child.gtin||(host==='carters.com'&&S.gtin(child.sku)?child.sku:undefined)});
        return;
      }
      if([v['@type']].flat().some(x=>/^(Product|IndividualProduct|ProductModel)$/.test(x)))objects.push(v);for(const k of ['@graph','itemListElement','item','mainEntity','hasVariant'])if(v[k])walk(v[k],depth+1);}
    for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{walk(JSON.parse(script.textContent));}catch{}}
    return objects;
  }
  function ldProduct(p){
    const offers=Array.isArray(p.offers)?p.offers:[p.offers];const offer=offers.find(o=>o&&o.price!==undefined)||offers.find(o=>o&&o.lowPrice!==undefined&&String(o.lowPrice)===String(o.highPrice))||{};
    let url=S.safeUrl(p.url||offer.url||location.href,location.href);if(!url||new URL(url).hostname.replace(/^www\./,'')!==host)return null;
    const identifiers=[p.gtin,p.gtin8,p.gtin12,p.gtin13,p.gtin14,p.upc,p.ean].filter(Boolean).map(String).filter(S.gtin);
    const prop=name=>(p.additionalProperty||[]).find(x=>new RegExp('^'+name+'$','i').test(x.name||''))?.value;
    const scalar=v=>typeof v==='object'?S.clean(v?.name||v?.value):S.clean(v);
    return {title:S.clean(p.name),url,price:S.price(offer.price??offer.lowPrice),currency:offer.priceCurrency?.toUpperCase()||null,brand:scalar(p.brand),model:scalar(p.model||p.mpn).replace(/^V_/, ''),gtins:identifiers,color:scalar(p.color||prop('Colou?r')),size:scalar(p.size||prop('Size')),variantUnresolved:offers.length>1||Boolean(p.hasVariant),image:S.safeUrl(typeof p.image==='string'?p.image:Array.isArray(p.image)?p.image[0]:p.image?.url,location.href),availability:/OutOfStock|SoldOut|Discontinued/i.test(offer.availability||'')?'out':/InStock|LimitedAvailability/i.test(offer.availability||'')?'in':'unknown',origin:'Retailer product data'};
  }
  const cardSelectors={
    'target.com':'[data-test="@web/site-top-of-funnel/ProductCardWrapper"], [data-test="product-card"], [data-test="product-card-default"], [data-test="product-card-container"]',
    'walmart.com':'[data-item-id], [data-testid="item-stack"]',
    'kohls.com':'.products_grid .products_grid-item, .prod_grid_block, .product-tile, [data-testid="product-tile"]',
    'macys.com':'li.product-thumbnail, .productThumbnail, [data-testid="product-thumbnail"], .product-thumbnail',
    'carters.com':'.product-tile-link-container',
    'boscovs.com':'.mz-productlist-item',
    'jcpenney.com':'[data-automation-id="productTile"], [data-automation-id="product-grid-item"], [data-testid="product-card"], .productCard'
  };
  const productPath={
    'target.com':/\/p\//,'walmart.com':/\/ip\//,'kohls.com':/\/product\//,'carters.com':/\/p\//,'boscovs.com':/\/product\//,'macys.com':/\/shop\/product\//,'jcpenney.com':/\/p\//
  };
  function cardProduct(el){
    if(el.closest('header,nav,[role="search"],[role="listbox"],[data-test*="search-suggestion"],[class*="SearchSuggestion"],[class*="trending"]'))return null;
    if(el.closest('[aria-roledescription="carousel"],[class*="Carousel"],[class*="carousel"],[data-test*="carousel"]'))return null;
    const links=[...el.querySelectorAll('a[href]')];const a=links.find(a=>productPath[host]?.test(a.getAttribute('href')))||links.find(a=>a.querySelector('img'));
    const url=S.safeUrl(a?.getAttribute('href'),location.href);if(!url||new URL(url).hostname.replace(/^www\./,'')!==host)return null;
    const title=text(el.querySelector('[data-automation-id="product-title"], [data-test="product-title"], [data-test="product-title-link"], [data-testid="product-title"], .prod_nameBlock, .productDescription, .product-title, .product-tile-name, .mz-productlisting-title, h3, h2'))||S.clean(a?.getAttribute('aria-label'))||S.clean(a?.querySelector('img')?.alt)||text(a);
    if(!title||title.length<5||/^(?:trending searches|recommended for you|recently viewed)$/i.test(title))return null;
    const priceEl=el.querySelector('[data-automation-id="product-price"], [data-test="current-price"], [data-test="product-price"], [data-testid="product-price"], .prod_price_amount, .price .discount, .discount, .sale-price, .current-price, .product-tile-price p:first-child, .mz-pricestack.actual-price [itemprop="price"], [itemprop="price"]');
    let value=priceEl?.getAttribute('content')||text(priceEl);
    if(!value){const parts=(el.innerText||el.textContent||'').split('\n').map(S.clean);value=parts.find(t=>/^(?:Now\s+|Sale\s+|current price\s+)?\$\d/.test(t)&&!/(?:\/mo|\bwas\b|\borig\b|reg\.)/i.test(t))||'';}
    const img=el.querySelector('img');const attrs={};for(const k of ['data-upc','data-gtin','data-ean'])if(el.getAttribute(k))attrs[k]=el.getAttribute(k);
    return {title:title.slice(0,500),url,price:S.price(value),currency:stores[host]?'USD':null,brand:'',model:'',gtins:Object.values(attrs).filter(S.gtin),image:S.safeUrl(img?.currentSrc||img?.src,location.href),availability:/out of stock|sold out/i.test(text(el))?'out':'unknown',origin:'Retail category card'};
  }
  function pagination(){
    const links=[...document.querySelectorAll('a[rel="next"], a[aria-label], button[aria-label], [data-testid*="next"], [data-test*="next"], a, button')];
    const next=links.find(e=>seenVisible(e)&&!e.closest('[aria-roledescription="carousel"],[class*="Carousel"],[class*="carousel"],[class*="slider"],[data-test*="carousel"]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&(/^(?:go to )?next(?: page)?(?:\s*[›»→])?$/i.test(S.clean(e.getAttribute('aria-label')||text(e)))||e.getAttribute('rel')==='next'));
    const more=[...document.querySelectorAll('button,a')].find(e=>seenVisible(e)&&!e.disabled&&/^(?:load|show|view) more(?: products| results| items)?$/i.test(text(e)));
    const nextUrl=next?.tagName==='A'?S.safeUrl(next.href,location.href):null;
    return {nextUrl:nextUrl&&new URL(nextUrl).origin===location.origin?nextUrl:null,nextButton:!!next&&!nextUrl,loadMore:!!more};
  }
  function retail(){
    if(blocked())return {blocked:true,url:location.href,products:[],message:'This retailer is asking for a page check. The scan is paused.'};
    const out=new Map();const isProduct=productPath[host]?.test(location.pathname);
    const list=structured().map(ldProduct).filter(Boolean);
    const headline=text(document.querySelector('h1'));
    const variantProducts=isProduct&&host==='carters.com'?list.filter(p=>new URL(p.url).pathname.split('/').slice(0,-1).join('/')===location.pathname.split('/').slice(0,-1).join('/')&&new URL(p.url).pathname!==location.pathname):[];
    for(const p of list)if(p.title&&(isProduct||p.url!==location.href)){
      if(isProduct&&new URL(p.url).pathname!==location.pathname)continue;
      if(isProduct&&headline&&S.match({title:headline},p).level==='conflict')continue;
      if(out.has(p.url)){out.get(p.url).variantUnresolved=true;out.get(p.url).price=null;out.get(p.url).gtins=[];}else out.set(p.url,p);
    }
    // Target sometimes renders no Product JSON-LD. Read only the main product's
    // price and specification fields, never recommendations or an arbitrary dollar amount.
    if(isProduct&&host==='target.com'&&headline){
      const priceEl=[...document.querySelectorAll('[data-test="product-price"], [data-test="productPrice"], [data-test="module-product-detail-price-v2"] [data-test="price-cdui-row"]')].find(e=>seenVisible(e)&&!e.closest(cardSelectors[host]));
      const visiblePrice=S.price(text(priceEl));
      const specifications=[...document.querySelectorAll('[data-test*="specification" i], [data-test="item-details-specifications"], [id*="Specifications"]')].map(text).join(' ');
      const codes=[...new Set([...specifications.matchAll(/\b(?:UPC|GTIN|EAN)\s*:\s*(\d{8,14})\b/gi)].map(m=>m[1]).filter(S.gtin))];
      const previous=[...out.values()][0];
      if(previous||visiblePrice){
        const identity=S.identity({title:headline});
        const p={title:headline,url:location.href,currency:'USD',brand:identity.brand,model:identity.model,gtins:codes,price:visiblePrice,availability:'unknown',origin:'Retail product page',...previous};
        if(visiblePrice)p.price=visiblePrice;
        if(codes.length)p.gtins=codes;
        const fulfillment=[...document.querySelectorAll('[data-test="shippingButton"], [data-test="orderPickupButton"], [data-test="shipItButton"]')];
        if(fulfillment.some(e=>seenVisible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'))p.availability='in';
        out.clear();out.set(p.url,p);
      }
    }
    if(isProduct&&host==='carters.com'){
      const primary=[...out.values()][0];
      if(primary){
        const codes=[...document.querySelectorAll('p')].filter(e=>/^UPC\s*[#:]?\s*\d/i.test(text(e))).flatMap(e=>text(e).match(/\d{8,14}/g)||[]).filter(S.gtin);
        if(codes.length)primary.gtins=[...new Set(codes)];
        const visiblePrice=S.price(text(document.querySelector('[data-testid="atc-price"]')));if(visiblePrice)primary.price=visiblePrice;
        // Apparel has a size selector. An unselected size cannot be priced as an exact SKU.
        const sizeGroup=document.querySelector('[role="radiogroup"][aria-label*="size" i], [data-testid="size-selector"]');
        if(sizeGroup){const selected=sizeGroup.querySelector('[aria-checked="true"], [aria-pressed="true"], option:checked');primary.size=text(selected);if(!primary.size)primary.variantUnresolved=true;}
      }
    }
    if(isProduct&&host==='boscovs.com'){
      try{
        const data=JSON.parse(document.querySelector('#data-mz-preload-product')?.textContent||'null');
        if(data&&String(data.productCode)===location.pathname.split('/').filter(Boolean).at(-1)){
          const decode=value=>{const el=document.createElement('textarea');el.innerHTML=value||'';return el.value;};
          const options=data.options||[],chosen={},unresolved=options.some(o=>{
            const choices=(o.values||[]).filter(v=>v.isEnabled!==false),v=choices.find(v=>v.isSelected)||(choices.length===1?choices[0]:null);
            if(v)chosen[o.attributeFQN]=v.stringValue||v.value;
            return o.isRequired&& !v;
          });
          const property=re=>{const v=(data.properties||[]).find(v=>re.test(v.attributeFQN));return v?.values?.[0]?.stringValue||v?.values?.[0]?.value||'';};
          const displayed=S.price(text(document.querySelector('.mz-productdetail-price .actual-price [itemprop="price"]')));
          const price=displayed||(!data.hasPriceRange?S.price(data.price?.salePrice??data.price?.price):null);
          const color=chosen['tenant~color'];const size=chosen['tenant~size'];
          const product={title:headline||decode(data.content?.productName),url:location.href,price,currency:'USD',brand:decode(property(/(?:^|~)brand$/i)),model:decode(data.mfgPartNumber),gtins:unresolved?[]:[...new Set([data.upc,...(data.upCs||[])].filter(S.gtin))],color:/^no[ -]?color$/i.test(color||'')?'':color||'',size:/^no[ -]?size$/i.test(size||'')?'':size||'',variantUnresolved:unresolved||Boolean(data.hasPriceRange),image:S.safeUrl(data.mainImage?.src||data.content?.productImages?.[0]?.src,location.href),availability:data.isActive===false||data.inventoryInfo?.onlineStockAvailable===0?'out':data.inventoryInfo?.onlineStockAvailable>0?'in':'unknown',origin:'Retailer product data'};
          out.clear();out.set(product.url,product);
        }
      }catch{}
    }
    if(!isProduct)for(const el of document.querySelectorAll(cardSelectors[host]||'[itemtype$="/Product"]')){if(!seenVisible(el))continue;const p=cardProduct(el);if(p&&!out.has(p.url))out.set(p.url,p);}
    // A retailer may change wrapper names. Product links still identify cards; never use a whole category's text as one product.
    if(!isProduct&&out.size===0&&productPath[host]){
      for(const a of document.querySelectorAll('main a[href], [role="main"] a[href], #page-content a[href]')){
        if(!productPath[host].test(a.getAttribute('href')||''))continue;
        if(a.closest('[aria-roledescription="carousel"],[class*="Carousel"],[class*="carousel"],[data-test*="carousel"],header,nav,[role="listbox"]'))continue;
        let card=a;for(let i=0;i<5&&card.parentElement;i++){if(card.querySelector('img')&&/\$\s*\d/.test(text(card)))break;card=card.parentElement;}
        if([...card.querySelectorAll('a[href]')].filter(x=>productPath[host].test(x.href)).length>8)continue;
        const p=cardProduct(card);if(p&&p.price!==null&&!out.has(p.url))out.set(p.url,p);
      }
    }
    const pageText=text(document.querySelector('main,[role="main"],#page-content')||document.body).slice(0,25000);
    const totalMatch=pageText.match(/\b(?:of|out of)\s+([\d,]+)\s+(?:results|items|products)\b/i)||pageText.match(/\b([\d,]+)\s+(?:results|items|products)\b/i);
    const expectedTotal=totalMatch?Number(totalMatch[1].replace(/,/g,'')):null;
    const products=[...out.values()].map(p=>({...p,retailer:stores[host]||host,observedAt:new Date().toISOString()}));
    const categoryPaths={'target.com':/^\/c\//,'walmart.com':/^\/browse\//,'kohls.com':/^\/catalog\//,'carters.com':/^\/c\//,'boscovs.com':/^\/(?:category|c)\//,'macys.com':/^\/shop\/(?!product)/,'jcpenney.com':/^\/g\//};
    const categoryLinks=[];
    if(!isProduct&&(host==='target.com'||!products.length)){
      const selectors=host==='target.com'?'a[data-lnk^="c_bubcat_"]':'main a[href], [role="main"] a[href], #page-content a[href]';
      for(const a of document.querySelectorAll(selectors)){
        if(a.closest('header,footer,[aria-label*="readcrumb"],[class*="breadcrumb"]'))continue;
        const url=S.safeUrl(a.href),name=text(a)||a.querySelector('img')?.alt;
        if(url&&name&&new URL(url).origin===location.origin&&url!==location.href&&categoryPaths[host]?.test(new URL(url).pathname)&&!categoryLinks.some(l=>l.url===url))categoryLinks.push({url,title:name});
      }
    }
    const expandCategories=host==='target.com'&&!![...document.querySelectorAll('[data-test="loadMoreRecommendations"]')].find(e=>seenVisible(e)&&/^Show all \d+$/i.test(text(e)));
    const department=!isProduct&&categoryLinks.length>0&&!expectedTotal;
    const diagnostic=isProduct?{headline,structuredProducts:list.map(p=>({title:p.title,url:p.url,price:p.price,gtins:p.gtins,model:p.model})),priceElements:[...document.querySelectorAll('[data-test="product-price"], [data-test="productPrice"]')].slice(0,4).map(text)}:undefined;
    return {blocked:false,url:location.href,title:document.title,retailer:stores[host]||host,isProduct:Boolean(isProduct),products,variantProducts:products.length?[]:variantProducts.map(p=>({...p,retailer:stores[host],observedAt:new Date().toISOString()})),expectedTotal,categoryLinks,expandCategories,department,diagnostic,...pagination()};
  }
  function advance(kind){
    if(blocked())return false;
    if(kind==='categories'){const e=[...document.querySelectorAll('[data-test="loadMoreRecommendations"]')].find(e=>seenVisible(e)&&/^Show all \d+$/i.test(text(e))&&e.parentElement?.parentElement?.querySelector('a[data-lnk^="c_bubcat_"]'));if(!e)return false;e.click();return true;}
    const candidates=[...document.querySelectorAll('a,button,[role="button"]')];
    const re=kind==='more'?/^(?:load|show|view) more(?: products| results| items)?$/i:/^(?:go to )?next(?: page)?(?:\s*[›»→])?$/i;
    const e=candidates.find(e=>seenVisible(e)&&!e.closest('[aria-roledescription="carousel"],[class*="Carousel"],[class*="carousel"],[class*="slider"],[data-test*="carousel"]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&(re.test(S.clean(e.getAttribute('aria-label')||text(e)))||(kind==='next'&&e.getAttribute('rel')==='next')));
    if(!e)return false;e.click();return true;
  }
  function prepareDetails(){
    if(blocked()||host!=='target.com'||!productPath[host]?.test(location.pathname)||globalThis.__asinPulsePreparedUrl===location.href)return false;
    const button=[...document.querySelectorAll('button')].find(e=>/^Specifications$/i.test(text(e)));
    if(!button)return false;
    globalThis.__asinPulsePreparedUrl=location.href;
    if(button.getAttribute('aria-expanded')==='true')return false;
    button.click();return true;
  }
  function amazonSearch(){
    if(blocked())return {blocked:true,products:[],url:location.href};
    const out=[];for(const card of document.querySelectorAll('[data-component-type="s-search-result"][data-asin]')){
      const asin=card.getAttribute('data-asin');if(!/^[A-Z0-9]{10}$/.test(asin))continue;
      // Search cards can have a short brand h2 followed by the actual product h2.
      const headings=[...card.querySelectorAll('h2')].flatMap(e=>[S.clean(e.getAttribute('aria-label')),text(e)]).filter(Boolean);
      const title=headings.sort((a,b)=>b.length-a.length)[0]||S.clean(card.querySelector('img.s-image')?.alt);if(!title)continue;
      const brand=headings.some(t=>/^LEGO$/i.test(t))&&!/compatible|light(?:ing)? kit|model not included/i.test(title)?'LEGO':'';
      out.push({asin,title,brand,url:`https://www.amazon.com/dp/${asin}`,price:S.price(text(card.querySelector('.a-price .a-offscreen'))),currency:'USD'});
    }return {blocked:false,products:out,url:location.href,emptyResults:!!document.querySelector('.s-no-outline')&&/no results for|did not match any products/i.test(text(document.querySelector('.s-main-slot')||document.querySelector('main')))};
  }
  function amazonProduct(){
    if(blocked())return {blocked:true,url:location.href};
    const p=globalThis.AsinPulseScan?.();if(!p||!document.querySelector('#productTitle'))return {blocked:false,missing:true,url:location.href};
    const details={};for(const row of document.querySelectorAll('#productDetails_techSpec_section_1 tr,#productDetails_detailBullets_sections1 tr,#productDetails_db_sections tr,#prodDetails tr,#detailBullets_feature_div li,#productOverview_feature_div tr')){
      const cells=row.querySelectorAll('th,td');if(cells.length>=2)details[text(cells[0]).replace(/:$/,'')]=text(cells[1]);else{const t=text(row),m=t.match(/^([^:]{2,60})\s*:\s*(.+)/);if(m)details[m[1].trim()]=m[2].trim();}
    }
    const lookup=re=>Object.entries(details).find(([k])=>re.test(k))?.[1]||'';
    const codes=lookup(/^(?:UPC|EAN|GTIN)$/i).match(/\d{8,14}/g)||[];
    const price=S.price(p.price),size=lookup(/^Size$/i)||text(document.querySelector('#variation_size_name .selection')),color=lookup(/^Colou?r$/i)||text(document.querySelector('#variation_color_name .selection'));
    return {...p,salesRank:S.salesRank(p.rank),documentUrl:location.href,price,currency:p.market==='US'?'USD':null,gtins:codes.filter(S.gtin),brand:lookup(/^Brand(?: Name)?$/i)||text(document.querySelector('#bylineInfo')).replace(/^Visit the (.+) Store$/i,'$1').replace(/^Brand:\s*/i,''),model:lookup(/^(?:Item )?Model(?: Number| Name)?$/i),color,size,variantUnresolved:!!document.querySelector('#variation_size_name')&&!size,pack:S.number(lookup(/^Item Package Quantity$/i)),image:S.safeUrl(document.querySelector('#landingImage')?.src),availability:/currently unavailable|temporarily out of stock/i.test(text(document.querySelector('#availability')))?'out':/in stock/i.test(text(document.querySelector('#availability')))?'in':'unknown',condition:/\bused\b/i.test(text(document.querySelector('#condition')))?'used':'unknown',blocked:false};
  }
  globalThis.SourcingPage={retail,advance,prepareDetails,amazonSearch,amazonProduct};
})();

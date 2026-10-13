(function(root){
  'use strict';
  const S=root.Sourcing;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  class ScanError extends Error{constructor(message,code='scan'){super(message);this.code=code;}}
  class BrowserReader{
    constructor({onTab=()=>{},shouldStop=()=>false}={}){this.tabId=null;this.onTab=onTab;this.shouldStop=shouldStop;this.metrics={pages:0,totalMs:0,recent:[]};}
    async check(){if(this.shouldStop())throw new ScanError('Paused by you.','pause');}
    async script(action,arg){
      await this.check();
      try{const out=await chrome.scripting.executeScript({target:{tabId:this.tabId},injectImmediately:true,func:(action,arg)=>{
        if(action==='top'){window.scrollTo(0,0);return true;}
        if(action==='scroll'){window.scrollBy(0,innerHeight*.85);return {height:document.documentElement.scrollHeight,top:scrollY,bottom:scrollY+innerHeight>=document.documentElement.scrollHeight-10};}
        return globalThis.SourcingPage[action](arg);
      },args:[action,arg??null]});return out[0]?.result;}catch(error){throw new ScanError('The scan page could not be read. Open the scan tab, check the page, and resume.','read');}
    }
    async inject(){await chrome.scripting.executeScript({target:{tabId:this.tabId},injectImmediately:true,files:['core.js','scanner.js','sourcing-core.js','retail-scan.js']});}
    async open(url,kind){
      await this.check();if(!S.safeUrl(url))throw new ScanError('Only public HTTPS product and category URLs are supported.','url');
      if(this.tabId===null){const tab=await chrome.tabs.create({url:'about:blank',active:true});this.tabId=tab.id;this.onTab(tab.id);await wait(250);}
      // Target's virtual product grid does not render in a background tab.
      try{const current=await chrome.tabs.get(this.tabId);if(!this.reuseCurrent||current.url!==url)await chrome.tabs.update(this.tabId,{url,active:true});else await chrome.tabs.update(this.tabId,{active:true});this.reuseCurrent=false;}catch{throw new ScanError('The scan tab was closed. Resume to create a new scan tab.','closed');}
      const start=Date.now();
      let result=null,lastSignature='',stable=0,readyObserved=false;
      // Read the product as soon as its data settles; ads may never finish loading.
      while(Date.now()-start<20000){
        await this.check();await wait(650);
        try{await chrome.tabs.get(this.tabId);}catch{throw new ScanError('The scan tab was closed.','closed');}
        try{
          await this.inject();const next=await this.script(kind);
          const actual=next?.url?new URL(next.documentUrl||next.url):null,requested=new URL(url);
          if(!actual||actual.hostname.replace(/^www\./,'')!==requested.hostname.replace(/^www\./,'')||actual.pathname!==requested.pathname||kind==='amazonSearch'&&actual.searchParams.get('k')!==requested.searchParams.get('k'))continue;
          if(next.blocked)throw new ScanError('A page check is required. Open the scan tab, then resume.','blocked');
          result=next;
          if(kind==='retail'&&next.isProduct&&await this.script('prepareDetails')){stable=0;continue;}
          const ready=kind==='amazonProduct'?!next.missing&&next.title:next.products?.some(p=>p.price>0)||next.variantProducts?.some(p=>p.price>0)||next.categoryLinks?.length||next.emptyResults;
          readyObserved=Boolean(ready);
          const signature=JSON.stringify(kind==='amazonProduct'?[next.asin,next.title,next.price,next.model,next.gtins]:[next.products?.map(p=>[p.url,p.price]),next.categoryLinks]);
          stable=ready&&signature===lastSignature?stable+1:0;lastSignature=signature;
          if(stable>=1&&Date.now()-start>=1300)break;
        }catch(error){if(['blocked','pause','closed'].includes(error.code))throw error;}
      }
      if(!result||!readyObserved)throw new ScanError('The page did not become readable within 20 seconds. Open the scan tab and resume.','read');
      const ms=Date.now()-start;this.metrics.pages++;this.metrics.totalMs+=ms;this.metrics.recent.push({url,kind,ms,products:result.products?.length,missing:result.missing});this.metrics.recent=this.metrics.recent.slice(-40);
      return result;
    }
    async retailPage(url,{continueCurrent=false,maxProducts=0}={}){
      let result=continueCurrent?await this.script('retail'):await this.open(url,'retail');
      if(result.blocked)throw new ScanError('A retailer page check is required.','blocked');
      // Some retailers retain the old scroll position when Next swaps the grid.
      // Start at the top so virtualized cards in the new page are all observed.
      await this.script('top');await wait(400);result=await this.script('retail');
      if(result.blocked)throw new ScanError('A retailer page check is required.','blocked');
      if(result.expandCategories&&result.department){await this.script('advance','categories');await wait(650);result=await this.script('retail');}
      if(result.department&&result.categoryLinks?.length||!result.products?.length&&result.categoryLinks?.length)return result;
      if(result.isProduct)return result.variantProducts?.length?{...result,products:result.variantProducts}:result;
      const merged=new Map((result.products||[]).map(p=>[p.url,p]));let still=0,lastHeight=0;
      if(maxProducts&&merged.size>=maxProducts)return {...result,products:[...merged.values()]};
      // Load lazy cards and retailer Load more controls before looking for Next.
      for(let i=0;i<120;i++){
        await this.check();
        const position=await this.script('scroll');
        if(result.loadMore)await this.script('advance','more');
        await wait(result.loadMore?1300:650);
        const next=await this.script('retail');if(next.blocked)throw new ScanError('A retailer page check is required.','blocked');
        const before=merged.size;for(const p of next.products||[])merged.set(p.url,p);
        if(maxProducts&&merged.size>=maxProducts)return {...next,products:[...merged.values()]};
        still=merged.size===before&&position.height===lastHeight&&position.bottom?still+1:0;lastHeight=position.height;result=next;
        if(still>=3&&!result.loadMore)break;
        if(i===119)return {...result,products:[...merged.values()],incompleteReason:'The page is still loading after 120 scroll steps. Discovery is incomplete. Use a narrower category or paginated results.'};
      }
      return {...result,products:[...merged.values()]};
    }
    async nextButton(){
      const before=await this.script('retail');const old=before.products.map(p=>p.url).sort().join('|');
      if(!await this.script('advance','next'))throw new ScanError('The next-page control could not be found. Category discovery is incomplete.','incomplete');
      for(let i=0;i<25;i++){await wait(600);await this.check();try{await this.inject();const next=await this.script('retail');if(next.blocked)throw new ScanError('A retailer page check is required.','blocked');if(next.products.map(p=>p.url).sort().join('|')!==old&&next.products.length)return this.retailPage(next.url,{continueCurrent:true});}catch(error){if(error.code==='blocked'||error.code==='pause')throw error;}}
      throw new ScanError('Next page did not load new products. Category discovery is incomplete.','incomplete');
    }
    async close(){if(this.tabId!==null){try{await chrome.tabs.remove(this.tabId);}catch{}this.tabId=null;this.onTab(null);}}
  }
  function newJob({url,retailer,category,products=[],limit=0}){
    return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),retailer,category,url,limit:Number(limit)||0,status:'ready',phase:products.length?'match':'discover',pageUrl:url,visited:[],expectedTotal:null,discoveryComplete:false,suppliedProducts:Boolean(products.length),message:'Ready to scan',leads:products.map(source=>({id:crypto.randomUUID(),source,status:'queued',candidates:[],selected:0,confirmed:false,saved:false})),nextIndex:0,events:[]};
  }
  class Runner{
    constructor({reader,save,onChange=()=>{},shouldStop=()=>false}){this.reader=reader;this.save=save;this.onChange=onChange;this.shouldStop=shouldStop;this.asinCache=new Map();}
    async checkpoint(job){job.updatedAt=new Date().toISOString();job.engineVersion='2.2';if(this.reader.metrics)job.metrics=this.reader.metrics;await this.save(job);this.onChange(job);}
    async amazon(url){const asin=url.match(/\/dp\/([A-Z0-9]{10})/)?.[1];if(asin&&this.asinCache.has(asin))return this.asinCache.get(asin);const p=await this.reader.open(url,'amazonProduct');if(!p.missing&&p.asin)this.asinCache.set(p.asin,p);return p;}
    async run(job){
      job.status='running';await this.checkpoint(job);
      try{
        if(job.phase==='discover')await this.discover(job);
        if(this.shouldStop())throw new ScanError('Paused by you.','pause');
        if(job.phase==='match')await this.matchAll(job);
        job.status='complete';job.phase='done';job.message=`Finished checking ${job.leads.length} collected products.${job.suppliedProducts?' This was a supplied product list.':job.discoveryComplete?'':' Category discovery was incomplete; see the scan log.'}`;
        await this.reader.close();
      }catch(error){job.status='paused';job.message=error.message;job.errorCode=error.code||'scan';job.events.push({time:new Date().toISOString(),text:error.message});if(job.events.length>100)job.events.shift();}
      await this.checkpoint(job);return job;
    }
    async discover(job){
      let page=null;const known=new Set(job.leads.map(l=>l.source.url));
      job.pendingCategories=job.pendingCategories||[];job.expandedCategories=job.expandedCategories||[];job.coverageIssues=job.coverageIssues||[];
      job.branch=job.branch||{url:job.pageUrl,urls:[],pages:[],expected:0};
      const nextCategory=()=>{const next=job.pendingCategories.shift();if(!next)return false;job.pageUrl=next.url;job.branch={url:next.url,title:next.title,urls:[],pages:[],expected:0};page=null;return true;};
      while(true){
        if(this.shouldStop())throw new ScanError('Paused by you.','pause');
        job.message=`Collecting ${job.branch.title||job.category}: ${job.leads.length} products, ${job.visited.length} category pages${job.pendingCategories.length?', '+job.pendingCategories.length+' subcategories waiting':''}.`;await this.checkpoint(job);
        if(!page)page=await this.reader.retailPage(job.pageUrl,{maxProducts:job.limit?Math.max(0,job.limit-job.leads.length):0});
        if(page.department||!page.products?.length){
          if(page.categoryLinks?.length){
            if(!job.expandedCategories.includes(page.url)){
              job.expandedCategories.push(page.url);
              const children=page.categoryLinks.filter(link=>!job.expandedCategories.includes(link.url)&&!job.pendingCategories.some(l=>l.url===link.url)&&!job.visited.some(v=>v.url===link.url));
              job.pendingCategories=[...children,...job.pendingCategories];
              job.events.push({time:new Date().toISOString(),text:`Following ${page.categoryLinks.length} linked subcategories from ${page.title||page.url}. Products appearing in several categories are counted once.`});
            }
            if(nextCategory()){await this.checkpoint(job);continue;}
          }
          throw new ScanError('No product results or new subcategories were readable. Open the scan tab and check the category. Discovery remains incomplete.','incomplete');
        }
        const pageSignature=page.products.map(p=>p.url).sort().join('|');
        if(job.branch.pages.some(v=>v.signature===pageSignature&&v.url!==page.url))throw new ScanError('The retailer returned a category page already scanned. Discovery stopped to avoid a pagination loop.','incomplete');
        for(const source of page.products){if(known.has(source.url))continue;known.add(source.url);job.leads.push({id:crypto.randomUUID(),source,status:'queued',candidates:[],selected:0,confirmed:false,saved:false});}
        job.branch.urls=[...new Set([...job.branch.urls,...page.products.map(p=>p.url)])];job.branch.expected=Math.max(job.branch.expected,page.expectedTotal||0);
        if(!job.expandedCategories.length)job.expectedTotal=job.branch.expected||null;else job.expectedTotal=null;
        if(!job.branch.pages.some(v=>v.signature===pageSignature&&v.url===page.url)){job.branch.pages.push({url:page.url,signature:pageSignature});job.visited.push({url:page.url,signature:pageSignature});}job.pageUrl=page.url;
        await this.checkpoint(job);
        if(page.incompleteReason)throw new ScanError(page.incompleteReason,'incomplete');
        if(job.limit&&job.leads.length>=job.limit){job.leads=job.leads.slice(0,job.limit);job.discoveryComplete=false;job.events.push({time:new Date().toISOString(),text:`Stopped at your ${job.limit}-product limit; this is a limited scan.`});break;}
        if(page.nextUrl){if(job.branch.pages.some(v=>v.url===page.nextUrl))throw new ScanError('The Next link points to a page already scanned. Category discovery is incomplete.','incomplete');job.pageUrl=page.nextUrl;page=null;await this.checkpoint(job);}
        else if(page.nextButton){await this.checkpoint(job);page=await this.reader.nextButton();job.pageUrl=page.url;}
        else{
          if(job.branch.expected&&job.branch.urls.length<job.branch.expected&&!page.isProduct){const issue=`Retailer reports ${job.branch.expected} products for ${job.branch.title||job.category} but only ${job.branch.urls.length} were collected. No next-page control was readable. Category coverage is incomplete.`;job.coverageIssues.push(issue);job.events.push({time:new Date().toISOString(),text:issue});}
          if(nextCategory()){await this.checkpoint(job);continue;}
          job.discoveryComplete=job.coverageIssues.length===0;
          break;
        }
        if(job.visited.length%500===0)throw new ScanError('500 category pages collected. Resume to continue discovery.','checkpoint');
      }
      job.phase='match';job.nextIndex=0;await this.checkpoint(job);
    }
    async matchAll(job){
      for(let i=job.nextIndex||0;i<job.leads.length;i++){
        if(this.shouldStop())throw new ScanError('Paused by you.','pause');
        const lead=job.leads[i],started=Date.now();job.nextIndex=i;job.message=`Matching ${i+1} of ${job.leads.length}: ${lead.source.title}`;lead.status='checking';await this.checkpoint(job);
        try{
          const detail=await this.reader.open(lead.source.url,'retail');
          const canonical=new URL(lead.source.url).pathname;
          // A clothing style can expose distinct, priced SKU variants. Compare each
          // exact size/color instead of assigning a parent style's price to a random ASIN.
          const variants=detail.variantProducts||[];
          if(variants.length){
            const known=new Set(job.leads.map(l=>l.source.url));
            for(const source of variants.slice(1))if(!known.has(source.url)){known.add(source.url);job.leads.push({id:crypto.randomUUID(),source:{...source,parentUrl:lead.source.url},status:'queued',candidates:[],selected:0,confirmed:false,saved:false});}
          }
          const item=variants[0]||detail.products?.find(p=>new URL(p.url).pathname===canonical)|| (detail.isProduct&&detail.products?.length===1?detail.products[0]:null);
          lead.retailDiagnostic=detail.diagnostic;
          if(item){lead.source={...lead.source,...item,detailVerified:item.price>0,gtins:item.gtins?.length?item.gtins:lead.source.gtins,brand:item.brand||lead.source.brand,model:item.model||lead.source.model};}
          else {lead.source.detailVerified=false;lead.note='Retail product details could not be verified; category price is only a lead.';}
          if(lead.source.availability==='out'){lead.status='out';lead.note='Retailer shows out of stock.';}
          else{
            const candidates=[];const seen=new Set();
            lead.searches=[];
            if(lead.source.asin){const p=await this.amazon(`https://www.amazon.com/dp/${lead.source.asin}`);if(!p.missing){candidates.push({...p,match:S.match(lead.source,p)});seen.add(p.asin);}}
            else for(const query of S.searchQueries(lead.source)){
              const found=await this.reader.open(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`,'amazonSearch');
              const all=(found.products||[]).map(p=>({...p,pre:S.match(lead.source,p)})).sort((a,b)=>b.pre.score-a.pre.score);
              lead.searches.push({query,total:all.length,rejected:all.filter(p=>p.pre.level==='conflict').length,top:all.slice(0,4).map(p=>({asin:p.asin,title:p.title,match:p.pre}))});
              const identifierQuery=Boolean(S.gtin(query));
              // Search titles often omit brand/attributes and reorder long toy
              // names. Inspect a promising title candidate on its detail page;
              // only the final identity checks can make it comparable.
              const ranked=all.filter(p=>p.pre.level!=='conflict'&&(p.pre.level!=='weak'||p.pre.score>=50||identifierQuery&&p.pre.score>=24));
              for(const result of ranked.slice(0,2)){
                if(seen.has(result.asin))continue;seen.add(result.asin);
                const p=await this.amazon(result.url);if(p.missing)continue;
                candidates.push({...p,match:S.match(lead.source,p)});
                if(candidates.some(p=>['identifier','model'].includes(p.match.level)))break;
              }
              if(candidates.some(p=>['identifier','model'].includes(p.match.level))||seen.size>=3)break;
            }
            lead.candidates=candidates.sort((a,b)=>b.match.score-a.match.score).slice(0,6);lead.selected=0;
            lead.status=candidates.length?'matched':'unmatched';if(lead.source.detailVerified!==false)lead.note=candidates.length?'':'No Amazon result passed the product identity checks.';
          }
        }catch(error){
          if(['blocked','permission','closed','pause','read'].includes(error.code)){lead.status='queued';throw error;}
          lead.status='error';lead.note=error.message;
        }
        lead.elapsedMs=Date.now()-started;job.nextIndex=i+1;await this.checkpoint(job);
      }
    }
  }
  root.SourcingEngine={BrowserReader,Runner,newJob,ScanError};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.SourcingEngine;
})(globalThis);

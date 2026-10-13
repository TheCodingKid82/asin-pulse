(function(root){
  'use strict';
  const clean=v=>String(v??'').replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
  const number=v=>v===null||v===undefined||typeof v==='string'&&!v.trim()?null:Number.isFinite(Number(v))?Number(v):null;
  const money=v=>Math.round((v+Number.EPSILON)*100)/100;
  function safeUrl(value,base){
    if(typeof value!=='string'||!value.trim())return null;
    try{const u=new URL(value,base);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.includes(':'))return null;u.hash='';return u.href;}catch{return null;}
  }
  function retailUrl(value){const u=safeUrl(value);if(!u)return null;const url=new URL(u);const host=url.hostname.replace(/^www\./,'');if(!['target.com','walmart.com','kohls.com','carters.com','boscovs.com','macys.com','jcpenney.com'].includes(host))return null;url.hostname='www.'+host;return url.href;}
  function gtin(value){
    const s=String(value??'').replace(/[\s-]/g,'');if(!/^\d{8}$|^\d{12,14}$/.test(s)||/^0+$/.test(s))return null;
    let sum=0;for(let i=s.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(s[i])*weight;
    return (10-sum%10)%10===Number(s.at(-1))?s.padStart(14,'0'):null;
  }
  function price(value){
    if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;
    const s=clean(value);if(!s||/\bfrom\b|\bstarting\b|\$[\d,.]+\s*[-–]\s*\$?\d/i.test(s))return null;
    const m=s.match(/(?:USD\s*|\$\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d.])/i) || s.match(/^(\d+(?:\.\d{1,2})?)$/);
    return m&&Number(m[1].replace(/,/g,''))>0?Number(m[1].replace(/,/g,'')):null;
  }
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const words=v=>new Set(clean(v).toLowerCase().replace(/[^a-z0-9.]+/g,' ').split(' ').filter(w=>w.length>1&&!['the','and','with','for','of','in','by','new','a','an','to','from','on'].includes(w)));
  function identity(p){
    const title=clean(p.title),accessory=/\b(?:lighting kit|light kit|LED light|light accessories|display case|replacement parts?|model not included|compatible with|fits (?:the )?lego)\b/i.test(title);
    const brand=clean(p.brand)||(!accessory&&/^LEGO\b/i.test(title)?'LEGO':'');
    const lego=norm(brand)==='lego';
    // LEGO set numbers are stable product identifiers; ages, years and piece counts are not.
    const codes=lego?[...title.matchAll(/\b(\d{5,6})\b/g)].filter(m=>!/^\s*(?:pieces?|pcs?|parts?)\b/i.test(title.slice(m.index+m[0].length))).map(m=>m[1]):[];
    const rawModel=clean(p.model),modelCodes=lego?[...rawModel.matchAll(/(?:^|[^\d])(\d{5,6})(?!\d)/g)].map(m=>m[1]):[];
    const model=lego&&modelCodes.length===1?modelCodes[0]:lego&&codes.length===1?codes[0]:rawModel&&norm(rawModel)!==norm(brand)?rawModel:codes.length===1?codes[0]:'';
    const edition=title.match(/\b(?:advent calendar|calendar)\s*(20\d{2})\b/i)?.[1]||title.match(/\b(20\d{2})\s*(?:advent calendar|calendar)\b/i)?.[1]||'';
    return {brand,model,accessory,edition,lego};
  }
  function attributes(p){
    const title=clean(p.title).toLowerCase();
    const pack=number(p.pack) || number(title.match(/\bpack\s+of\s+(\d+)\b/)?.[1]) || number(title.match(/\b(\d+)\s*[- ]?(?:packs?|pk)\b/)?.[1]);
    const sizes=[...title.matchAll(/\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|ounces?|oz|pounds?|lbs?|grams?|kg|g|ml|liters?|litres?|l|quarts?|qt|gallons?|gal|count|ct|inches?|inch|in)\b/g)].map(m=>{
      let unit=m[2].replace(/[.\s]/g,'');let value=Number(m[1]);
      const units={ounces:'oz',ounce:'oz',pounds:'lb',pound:'lb',lbs:'lb',grams:'g',gram:'g',liters:'l',liter:'l',litres:'l',litre:'l',quarts:'qt',quart:'qt',gallons:'gal',gallon:'gal',count:'ct',inches:'in',inch:'in'};unit=units[unit]||unit;
      if(unit==='l'){unit='ml';value*=1000;}if(unit==='kg'){unit='g';value*=1000;}if(unit==='lb'){unit='oz';value*=16;}
      return `${value}:${unit}`;
    });
    const explicit=clean(p.color).toLowerCase();
    const rawSize=norm(String(p.size||title.match(/\bsize\s+(\d+(?:\.\d+)?|[2-5]?x[sl]|xx[sl]|small|medium|large|[sml])\b/i)?.[1]||'').replace(/\bmonths?\b/gi,'m').replace(/\byears?\b/gi,'y'));
    const size=({small:'s',medium:'m',large:'l',xsmall:'xs',xlarge:'xl',xxsmall:'xxs',xxlarge:'xxl','2xl':'xxl','2xs':'xxs','3xl':'xxxl'})[rawSize]||rawSize;
    return {pack,sizes:[...new Set(sizes)].sort(),size:size||null,color:explicit?norm(explicit.replace(/\bgray\b/g,'grey')):null};
  }
  function match(source,target){
    const si=identity(source),ti=identity(target);
    const a=(source.gtins||[source.upc]).map(gtin).filter(Boolean),b=(target.gtins||[target.upc]).map(gtin).filter(Boolean);
    const id=a.some(v=>b.includes(v));const reasons=[];const sa=attributes(source),ta=attributes(target);
    if(a.length&&b.length&&!id)return {level:'conflict',score:0,reasons:['Different valid UPC / GTIN identifiers']};
    if(sa.pack&&ta.pack&&sa.pack!==ta.pack)reasons.push(`Different pack quantities (${sa.pack} vs ${ta.pack})`);
    if(sa.sizes.length&&ta.sizes.length&&sa.sizes.join('|')!==ta.sizes.join('|'))reasons.push('Different size or contents stated in the titles');
    if(sa.color&&ta.color&&sa.color!==ta.color)reasons.push('Different colors');
    if(sa.size&&ta.size&&sa.size!==ta.size)reasons.push('Different clothing / selected sizes');
    if(si.accessory!==ti.accessory)reasons.push('Accessory / compatible item instead of the complete product');
    if(si.edition&&ti.edition&&si.edition!==ti.edition)reasons.push(`Different calendar years (${si.edition} vs ${ti.edition})`);
    if(si.brand&&ti.brand&&norm(si.brand)!==norm(ti.brand))reasons.push('Different brands');
    if(si.model&&ti.model&&norm(si.model)!==norm(ti.model))reasons.push(`Different model numbers (${si.model} vs ${ti.model})`);
    if(reasons.length)return {level:'conflict',score:0,reasons};
    const unknownPack=Boolean((sa.pack||ta.pack)&&sa.pack!==ta.pack || (sa.size||ta.size)&&sa.size!==ta.size);
    const unknownColor=Boolean((sa.color||ta.color)&&sa.color!==ta.color);
    if(id&&!unknownPack&&!unknownColor&&!source.variantUnresolved&&!target.variantUnresolved)return {level:'identifier',score:100,reasons:['Matching valid UPC / GTIN; no detected attribute conflicts']};
    const aw=words(source.title),bw=words(target.title);const intersection=[...aw].filter(w=>bw.has(w)).length;
    const similarity=aw.size&&bw.size?2*intersection/(aw.size+bw.size):0;
    const contained=aw.size>=4&&intersection/aw.size>=.8;
    const model=si.model&&ti.model&&norm(si.model)===norm(ti.model);
    const fixedLegoColor=si.lego&&ti.lego&&[sa.color,ta.color].every(c=>!c||/^multi(colou?re?d?)?$/.test(c));
    if(model&&si.brand&&norm(si.brand)===norm(ti.brand)&&!unknownPack&&(!unknownColor||fixedLegoColor)&&!source.variantUnresolved&&!target.variantUnresolved)return {level:'model',score:95,reasons:[`Matching brand and model (${si.brand} ${si.model}); no detected variation conflicts`, 'UPC match not established; verify packaging before purchase']};
    if(id)reasons.push('Matching identifier; variation details need review');
    else if(model)reasons.push('Matching model number; UPC match not established');
    else reasons.push('Title similarity only; inspect both listings');
    if(unknownPack||unknownColor)reasons.push('Pack quantity, size, or color is missing on one listing');
    if(source.variantUnresolved||target.variantUnresolved)reasons.push('The exact selected variation is unresolved');
    return {level:id||model||similarity>=.7||contained?'review':'weak',score:id?90:model?85:Math.round(Math.max(similarity,contained?.7:0)*80),reasons};
  }
  const defaults={discount:0,tax:0,retailShipping:0,prep:0,inbound:0,referral:15,minReferral:0.3,fba:null,other:0};
  function costs(source,target,settings={}){
    const s={...defaults,...settings};const errors=[];
    if(source.currency!=='USD'||target?.currency!=='USD')errors.push('Both prices must be confirmed USD');
    const buy=number(source.price),sell=number(target?.price);
    if(!(buy>0)||!(sell>0))errors.push('Current retail and Amazon prices are required');
    for(const k of ['discount','tax','referral'])if(number(s[k])===null||number(s[k])<0||number(s[k])>100)errors.push(`Invalid ${k} percentage`);
    for(const k of ['retailShipping','prep','inbound','minReferral','other'])if(number(s[k])===null||number(s[k])<0)errors.push(`Invalid ${k} cost`);
    const fee=number(s.fba);if(fee===null||fee<0)errors.push('Enter the FBA fulfillment fee or your estimate');
    const spread=buy>0&&sell>0&&source.currency==='USD'&&target?.currency==='USD'?money(sell-buy):null;
    if(errors.length)return {ready:false,spread,errors};
    const discounted=buy*(1-s.discount/100),tax=discounted*s.tax/100;
    const acquisition=discounted+tax+Number(s.retailShipping)+Number(s.prep)+Number(s.inbound);
    const referral=Math.max(sell*s.referral/100,Number(s.minReferral));
    const profit=sell-acquisition-referral-fee-Number(s.other);
    // Break-even is piecewise because the minimum referral fee may bind.
    const fixed=acquisition+fee+Number(s.other);const rate=s.referral/100;
    const percentBreak=rate<1?fixed/(1-rate):Infinity;
    const minimumBreak=fixed+Number(s.minReferral);
    const breakEven=minimumBreak*rate<=s.minReferral?minimumBreak:percentBreak;
    return {ready:true,spread,acquisition:money(acquisition),referral:money(referral),fba:fee,other:Number(s.other),profit:money(profit),roi:acquisition>0?Math.round(profit/acquisition*10000)/100:null,margin:Math.round(profit/sell*10000)/100,breakEven:Number.isFinite(breakEven)?money(breakEven):null,errors:[]};
  }
  function csvRows(text){
    const rows=[];let row=[],cell='',quoted=false;const s=String(text).replace(/^\uFEFF/,'');
    for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
    if(quoted)throw new Error('CSV has an unclosed quoted field.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
  }
  function importCsv(text){
    const rows=csvRows(text);if(rows.length<2)throw new Error('Add a header row and at least one product.');
    const headers=rows.shift().map(h=>clean(h).toLowerCase().replace(/[ -]/g,'_'));const products=[],errors=[];
    rows.slice(0,500).forEach((r,i)=>{
      const data=Object.fromEntries(headers.map((h,j)=>[h,clean(r[j])]));
      const title=data.title||data.product_name||data.name;const url=retailUrl(data.url||data.retail_url||data.source_url);const p=price(data.price||data.retail_price||data.cost);
      if(!title||!url||p===null){errors.push(`Row ${i+2}: title, HTTPS URL at a supported retailer, and positive price required.`);return;}
      const upc=data.upc||data.gtin||data.ean;
      if(upc&&!gtin(upc)){errors.push(`Row ${i+2}: invalid UPC / GTIN checksum.`);return;}
      if(data.pack&&(!Number.isInteger(Number(data.pack))||Number(data.pack)<1)){errors.push(`Row ${i+2}: pack must be a positive whole number.`);return;}
      const asin=(data.asin||data.amazon_asin||'').toUpperCase();if(asin&&!/^[A-Z0-9]{10}$/.test(asin)){errors.push(`Row ${i+2}: invalid ASIN.`);return;}
      products.push({title:title.slice(0,500),url,price:p,currency:(data.currency||'').toUpperCase(),gtins:upc?[upc]:[],brand:data.brand,model:data.model,pack:number(data.pack),color:data.color,size:data.size,asin:asin||null,retailer:new URL(url).hostname,observedAt:new Date().toISOString(),origin:'CSV import',availability:'unknown'});
    });
    if(rows.length>500)errors.push('Only the first 500 rows were imported.');return {products,errors};
  }
  function csvExport(rows){return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
  function searchQueries(p){
    const id=identity(p),title=clean(p.title).split(' ').slice(0,15).join(' ');
    // Retail titles can be as short as "Magic Wand". Keep the known brand in
    // the fallback search rather than replacing it with a generic toy query.
    const brandedTitle=id.brand&&!norm(title).includes(norm(id.brand))?`${id.brand} ${title}`:title;
    return [...new Set([id.brand&&id.model?`${id.brand} ${id.model}`:'',...(p.gtins||[]).filter(gtin).map(v=>String(v).replace(/[\s-]/g,'')),brandedTitle].filter(Boolean))].slice(0,3);
  }
  function salesRank(value){
    if(value && typeof value==='object' && Number.isSafeInteger(value.value)&&value.value>0)return {value:value.value,category:clean(value.category),text:clean(value.text)};
    const raw=clean(value),m=raw.match(/#\s*([\d,]+)\s+in\s+(.+?)(?=\s*\(|\s*#|$)/i);
    if(!m)return null;
    const rank=Number(m[1].replace(/,/g,''));
    return Number.isSafeInteger(rank)&&rank>0?{value:rank,category:clean(m[2]),text:raw}:null;
  }
  function filterLead(lead,filters={},settings={}){
    const p=lead.candidates?.[lead.selected||0],eligible=comparable(lead);
    const c=eligible?costs(lead.source,p,{...settings,...lead.fees}):{ready:false,spread:null};
    const kind=filters.kind||'all';
    if(filters.text&&!`${lead.source.title} ${lead.source.brand||''} ${p?.asin||''} ${p?.title||''}`.toLowerCase().includes(filters.text.toLowerCase()))return false;
    if(kind==='saved'&&!lead.saved||kind==='confirmed'&&!lead.confirmed||kind==='identifier'&&p?.match?.level!=='identifier'||kind==='model'&&p?.match?.level!=='model'||kind==='review'&&(!p||lead.confirmed||['identifier','model'].includes(p.match?.level)))return false;
    if(kind==='cheaper'&&!(eligible&&c.spread>0)||kind==='profit'&&!(eligible&&c.ready&&c.profit>0))return false;
    const price=filters.priceSource==='amazon'?(p?.currency==='USD'?number(p.price):null):(lead.source.currency==='USD'?number(lead.source.price):null);
    const rank=salesRank(p?.salesRank||p?.rank);
    const bounds=[['minPrice',price,1],['maxPrice',price,-1],['minSpread',eligible?c.spread:null,1],['minRank',rank?.value,1],['maxRank',rank?.value,-1],['minProfit',c.ready?c.profit:null,1],['minRoi',c.ready?c.roi:null,1]];
    for(const [key,value,direction] of bounds){const n=number(filters[key]);if(n!==null&&(value==null||!Number.isFinite(value)||(direction===1?value<n:value>n)))return false;}
    if(filters.rankCategory&&(!rank||!rank.category.toLowerCase().includes(filters.rankCategory.toLowerCase())))return false;
    return true;
  }
  function comparable(lead){const p=lead.candidates?.[lead.selected||0];return Boolean(p&&p.match?.level!=='conflict'&&(['identifier','model'].includes(p.match?.level)||lead.confirmed)&&p.availability!=='out'&&lead.source.availability!=='out'&&p.condition!=='used'&&lead.source.detailVerified===true);}
  root.Sourcing={clean,number,money,safeUrl,retailUrl,gtin,price,norm,identity,attributes,match,comparable,costs,defaults,csvRows,importCsv,csvExport,searchQueries,salesRank,filterLead};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.Sourcing;
})(globalThis);

// NOAA Atom entries carry the region in <title>; bulletin category is in summary/feed.
const clean=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const tag=(s,n)=>{const m=s.match(new RegExp('<(?:[\\w-]+:)?'+n+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+n+'>','i'));return m?clean(m[1]):'';};
export function parseTsunamiAtom(xml,source){
 const feed=xml.split(/<(?:[\w-]+:)?entry\b/i)[0],feedTitle=tag(feed,'title');
 return [...xml.matchAll(/<(?:[\w-]+:)?entry\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?entry>/gi)].flatMap(([,entry])=>{
  const summary=tag(entry,'summary')||tag(entry,'content'),region=tag(entry,'title'),time=Date.parse(tag(entry,'updated')||tag(entry,'published'));
  if(!Number.isFinite(time))return [];
  const category=summary.match(/Category:\s*(Warning|Watch|Advisory|Information|Cancellation|Cancel(?:led)?)/i)?.[1]||feedTitle;
  const text=category.toLowerCase(),cancelled=/cancel|no tsunami warning|warning.*ended/.test(text),information=cancelled||/information/.test(text);
  const warningLevel=cancelled?'Encerrado':information?'Informativo':/warning/.test(text)?'Aviso':/watch/.test(text)?'Vigilância':/advisory/.test(text)?'Atenção':'Informativo';
  const warning=['Aviso','Vigilância','Atenção'].includes(warningLevel);
  const lat=Number(tag(entry,'lat')),lng=Number(tag(entry,'long'));
  const coords=tag(entry,'lat')&&tag(entry,'long')&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lng,lat]:null;
  const links=[...entry.matchAll(/<link\b([^>]*)>/gi)].map(([,attrs])=>({rel:attrs.match(/rel=["']([^"']*)/i)?.[1],url:attrs.match(/href=["']([^"']*)/i)?.[1]}));
  const link=links.find(l=>l.rel==='alternate')?.url||links.find(l=>l.url)?.url||'https://www.tsunami.gov/';
  const bulletinId=tag(entry,'id')||link;
  return [{id:'TS-'+source+'-'+bulletinId,source,type:'tsunami',title:feedTitle||'Boletim de tsunami',place:region||'Área do boletim oficial',description:summary,detail:summary,link,time,coords,hazardNature:warning?'warning':'bulletin',warningLevel,severityLabel:warningLevel,displayLabel:'Tsunami · '+warningLevel,sev:warningLevel==='Aviso'?4:warningLevel==='Vigilância'?3:warning?2:0,cancelled,official:true}];
 });
}
export function parseTsunamiProduct(text,code){
 // These official products are JSON object literals in a JS assignment. Never execute them.
 const first=text.indexOf('{'),last=text.lastIndexOf('}');if(first<0||last<first)throw Error('Produto inválido');
 const p=JSON.parse(text.slice(first,last+1));
 const time=Date.parse(p.bulletinIssueTime);if(!Number.isFinite(time))throw Error('Data inválida');
 const area=(p.alerts?.areaList||[]).flat(Infinity).filter(a=>a&&typeof a==='object'&&a.zone);
 const segments=p.segments||[],categories=[...area,...segments].map(a=>String(a.category||''));
 const threat=categories.some(c=>!/cancel|no threat|no tsunami/i.test(c)&&/meters|metres|warning|watch|advisory|threat/i.test(c));
 const cancelled=!threat&&categories.some(c=>/cancel|no threat|no tsunami/i.test(c));
 const label=cancelled?'Encerrado':threat?'Ameaça oficial':'Informativo';
 const lat=Number(p.eventLat),lng=Number(p.eventLon),coords=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lng,lat]:null;
 const details=area.map(a=>clean(a.zone)+': '+clean(a.category));
 const dir=String(p.eventDir||'');if(!/^\/events\/PHEB\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9_-]+\/\d+\/[A-Z0-9]+\/$/.test(dir))throw Error('Caminho inválido');
 const source='PTWC',feedKey='PTWC-'+code;
 return [{id:'TS-'+feedKey+'-'+p.twcEventID+'-'+p.bulletinNr,feedKey,source,type:'tsunami',title:'PTWC · '+label,place:area.length?[...new Set(area.map(a=>clean(a.zone)))].join(' · '):clean(p.quakeLocation)||'Região do boletim PTWC',time,coords,originTime:Date.parse(p.originTime),affectedAreas:area.map(a=>({name:clean(a.zone),category:clean(a.category)})),detail:(threat?'Ameaça de tsunami estimada pelo PTWC. Autoridades locais definem as medidas para cada costa. ':'Boletim informativo do PTWC. ')+(details.length?'Faixas previstas no boletim: '+details.join('; ')+'. ':segments.map(a=>clean(a.recommendedActions||a.headline)).join(' ')),link:'https://www.tsunami.gov'+dir+code+'.txt',hazardNature:threat?'warning':'bulletin',warningLevel:label,displayLabel:'Tsunami · '+label,severityLabel:label,sev:threat?4:0,cancelled,official:true}];
}
let cache=null,inflight=null;
export async function getOfficialTsunamis(){
 if(cache&&Date.now()-cache.at<20000)return cache.data;
 if(inflight)return inflight;
 inflight=(async()=>{
  const definitions=[['PTWC','PHEB',false],['NTWC','PAAQ',false],...['WEPA40','WEPA42','WECA41','WECA43'].map(code=>['PTWC',code,true])];
  const sources=await Promise.all(definitions.map(async([source,code,product])=>{
   const feedKey=product?'PTWC-'+code:source+'-General';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{const r=await fetch(product?'https://www.tsunami.gov/events/js/PHEB'+code+'.js':'https://www.tsunami.gov/events/xml/'+code+'Atom.xml',{signal:controller.signal,headers:{Accept:'application/atom+xml'}});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();if(!product&&!/<(?:[\w-]+:)?feed\b/i.test(text))throw Error('Feed inválido');const items=(product?parseTsunamiProduct(text,code):parseTsunamiAtom(text,source)).map(item=>({...item,feedKey}));return {source,feedKey,ok:true,items:items.filter(item=>Date.now()-item.time<=72*3600000)};}
   catch(e){return {source,feedKey,ok:false,items:[],error:e.message};}finally{clearTimeout(timer);}
  }));
  const data={source:'TSUNAMI-GOV',ok:sources.some(s=>s.ok),sources,items:sources.flatMap(s=>s.items).sort((a,b)=>b.time-a.time)};
  cache={at:Date.now(),data};return data;
 })().finally(()=>inflight=null);return inflight;
}

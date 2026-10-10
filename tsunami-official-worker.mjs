import './js/tsunami-link.js';
// NOAA Atom entries carry the region in <title>; bulletin category is in summary/feed.
const clean=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const tag=(s,n)=>{const m=s.match(new RegExp('<(?:[\\w-]+:)?'+n+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+n+'>','i'));return m?clean(m[1]):'';};
const numeric=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
function originText(text){
 // Read only the origin field and its continuation lines, not the issuance date.
 const field=text.match(/ORIGIN TIME\s+([^\n]+(?:\n[ \t]+\d[^\n]*)*)/i)?.[1]||'';
 const offsets={UTC:0,CHST:10,HST:-10,AKDT:-8,AKST:-9,PDT:-7,PST:-8};
 const matches=[...field.matchAll(/(\d{1,2})(\d{2})(?::?(\d{2}))?\s*(AM|PM)?\s+(UTC|CHST|HST|AKDT|AKST|PDT|PST)\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})/gi)];
 const m=matches.find(m=>m[5].toUpperCase()==='UTC')||matches[0];if(!m)return null;
 const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],month=months.indexOf(m[6].toUpperCase());
 let hour=Number(m[1]);
 if(month<0||hour>23||Number(m[2])>59||Number(m[3]||0)>59||Number(m[7])<1||Number(m[7])>31)return null;
 if(m[4]){if(hour<1||hour>12)return null;hour=hour%12+(m[4].toUpperCase()==='PM'?12:0);}
 const local=Date.UTC(Number(m[8]),month,Number(m[7]),hour,Number(m[2]),Number(m[3]||0));
 return new Date(local).getUTCMonth()===month?local-offsets[m[5].toUpperCase()]*3600000:null;
}
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
  const officialEventId=link.match(/\/events\/(PHEB|PAAQ)\/\d{4}\/\d{2}\/\d{2}\/([^/]+)\//)?.slice(1).join(':')||null;
  const originMag=numeric(summary.match(/(?:Preliminary )?Magnitude:\s*(\d+(?:\.\d+)?)/i)?.[1]);
  return [{id:'TS-'+source+'-'+bulletinId,source,type:'tsunami',title:feedTitle||'Boletim de tsunami',place:region||'Área do boletim oficial',description:summary,detail:summary,link,time,coords,coordinateRole:'earthquake-origin',originTime:originText(summary),originMag,officialEventId,hazardNature:warning?'warning':'bulletin',warningLevel,severityLabel:warningLevel,displayLabel:'Tsunami · '+warningLevel,sev:warningLevel==='Aviso'?4:warningLevel==='Vigilância'?3:warning?2:0,cancelled,official:true}];
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
 const lat=numeric(p.eventLat),lng=numeric(p.eventLon),coords=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lng,lat]:null;
 const details=area.map(a=>clean(a.zone)+': '+clean(a.category));
 const dir=String(p.eventDir||'');if(!/^\/events\/PHEB\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9_-]+\/\d+\/[A-Z0-9]+\/$/.test(dir))throw Error('Caminho inválido');
 const source='PTWC',feedKey='PTWC-'+code;
 return [{id:'TS-'+feedKey+'-'+p.twcEventID+'-'+p.bulletinNr,feedKey,source,type:'tsunami',title:'PTWC · '+label,place:area.length?[...new Set(area.map(a=>clean(a.zone)))].join(' · '):clean(p.quakeLocation)||'Região do boletim PTWC',time,coords,coordinateRole:'earthquake-origin',originTime:Date.parse(p.originTime),originMag:numeric(p.eventMagnitude),officialEventId:'PHEB:'+p.twcEventID,affectedAreas:area.map(a=>({name:clean(a.zone),category:clean(a.category)})),detail:(threat?'Ameaça de tsunami estimada pelo PTWC. Autoridades locais definem as medidas para cada costa. ':'Boletim informativo do PTWC. ')+(details.length?'Faixas previstas no boletim: '+details.join('; ')+'. ':segments.map(a=>clean(a.recommendedActions||a.headline)).join(' ')),link:'https://www.tsunami.gov'+dir+code+'.txt',hazardNature:threat?'warning':'bulletin',warningLevel:label,displayLabel:'Tsunami · '+label,severityLabel:label,sev:threat?4:0,cancelled,official:true}];
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
  if(sources.some(s=>!s.ok))sources.push(...await getNwsTsunamis());
  const data={source:'TSUNAMI-GOV',ok:sources.some(s=>s.ok),sources,items:globalThis.TsunamiLink.latest(sources.flatMap(s=>s.items))};
  cache={at:Date.now(),data};return data;
 })().finally(()=>inflight=null);return inflight;
}

// NWS republishes PTWC/NTWC text products on a separate official infrastructure.
// Read the latest bulletin for each product, never replay a superseded warning.
export function parseNwsTsunamiProduct(p){
 const source=p.issuingOffice==='PHEB'?'PTWC':p.issuingOffice==='PAAQ'?'NTWC':null;
 const time=Date.parse(p.issuanceTime),text=String(p.productText||'');
 if(!source||!Number.isFinite(time)||!text.trim()||!/^\w{6}$/.test(p.wmoCollectiveId||''))throw Error('Boletim NWS inválido');
 const evaluation=clean(text.split(/EVALUATION\s*\n[-]+/i)[1]?.split(/\n[A-Z][A-Z .-]+\n[-]+/)[0]||text.slice(0,1800));
 const cancelled=p.productCode!=='TIB'&&/THREAT HAS (?:NOW )?PASSED|NO (?:LONGER A |FURTHER )?TSUNAMI THREAT|(?:WARNING|WATCH|ADVISORY)[\s\S]{0,60}(?:CANCELLED|CANCELED)|FINAL (?:TSUNAMI )?MESSAGE/i.test(evaluation);
 const threat=!cancelled&&/HAZARDOUS TSUNAMI WAVES (?:ARE|FROM)|TSUNAMI (?:WARNING|WATCH|ADVISORY) (?:IS|IN EFFECT|REMAINS)|WIDESPREAD\s+HAZARDOUS TSUNAMI WAVES/i.test(evaluation);
 const level=cancelled?'Encerrado':threat?'Ameaça oficial':'Informativo';
 const match=text.match(/COORDINATES\s+(\d+(?:\.\d+)?)\s+(NORTH|SOUTH)\s+(\d+(?:\.\d+)?)\s+(EAST|WEST)/i);
 const coords=match?[Number(match[3])*(match[4].toUpperCase()==='WEST'?-1:1),Number(match[1])*(match[2].toUpperCase()==='SOUTH'?-1:1)]:null;
 const forecast=text.split(/TSUNAMI THREAT FORECAST[^\n]*\n[-]+/i)[1]?.split(/RECOMMENDED ACTIONS/)[0]||evaluation;
 const location=text.match(/\* LOCATION\s+([^\n]+)/i)?.[1]?.trim().replace(/^in\s+/i,'')||'Área do boletim oficial';
 return [{id:'TS-NWS-'+p.id,feedKey:source+'-'+p.wmoCollectiveId,source,type:'tsunami',title:source+' · '+level,place:location,time,coords,coordinateRole:'earthquake-origin',originTime:originText(text),originMag:numeric(text.match(/\* MAGNITUDE\s+(\d+(?:\.\d+)?)/i)?.[1]),detail:'Boletim oficial '+source+', republicado pelo NWS. '+clean(forecast)+' Autoridades nacionais definem as medidas para cada costa.',description:clean(text),link:'https://api.weather.gov/products/'+p.id,bulletinUrl:'https://api.weather.gov/products/'+p.id,hazardNature:threat?'warning':'bulletin',warningLevel:level,severityLabel:level,displayLabel:'Tsunami · '+level,sev:threat?4:0,cancelled,official:true}];
}
async function nwsJson(url){const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/geo+json','User-Agent':'MonitorGlobal (https://monitorglobal.top)'}});if(!r.ok)throw Error('NWS HTTP '+r.status);return r.json();}
export async function getNwsTsunamis(){
 const catalogs=await Promise.all(['TSU','TIB'].map(async type=>{try{return {ok:true,entries:(await nwsJson('https://api.weather.gov/products/types/'+type))['@graph']||[]};}catch(e){return {ok:false,error:e.message,entries:[]};}}));
 const latest=new Map();
 for(const p of catalogs.flatMap(c=>c.entries).sort((a,b)=>Date.parse(b.issuanceTime)-Date.parse(a.issuanceTime))){if(!['PHEB','PAAQ'].includes(p.issuingOffice)||Date.now()-Date.parse(p.issuanceTime)>72*3600000||!/^[a-f\d-]{36}$/.test(p.id))continue;const key=p.issuingOffice+'-'+p.wmoCollectiveId;if(!latest.has(key))latest.set(key,p);}
 const sources=await Promise.all([...latest.values()].slice(0,12).map(async p=>{const source=p.issuingOffice==='PHEB'?'PTWC':'NTWC',feedKey=source+'-'+p.wmoCollectiveId;try{return {source,feedKey,ok:true,items:parseNwsTsunamiProduct(await nwsJson('https://api.weather.gov/products/'+p.id))};}catch(e){return {source,feedKey,ok:false,items:[],error:e.message};}}));
 if(!sources.length)sources.push({source:'PTWC',feedKey:'PTWC-NWS',ok:catalogs.every(c=>c.ok),items:[],error:catalogs.find(c=>!c.ok)?.error});
 return sources;
}

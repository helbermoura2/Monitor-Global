/** Official video metadata. Never infer faulting from place or depth. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {distanceKm,parsePagerXML} from '../population-exposure-worker.mjs';
import {validImageExposure} from '../seismic-image-data.mjs';
const run=promisify(execFile);
async function remote(url){const parsed=new URL(url);if(parsed.protocol!=='https:'||!['earthquake.usgs.gov','www.seismicportal.eu'].includes(parsed.hostname))throw new Error('Unexpected official product URL');return(await run('curl',['-fsS','--max-time','20',url],{maxBuffer:8*1024*1024})).stdout;}
const products=(p,name)=>(p?.[name]||[]).filter(x=>x.status!=='DELETE').sort((a,b)=>Number(b.preferredWeight||0)-Number(a.preferredWeight||0)||Number(b.updateTime||0)-Number(a.updateTime||0));
const number=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x))?Number(x):null;
function mechanism(rake,provider){const kind=rake>=45&&rake<=135?'reverse':rake<=-45&&rake>=-135?'normal':'strike-slip';return {kind,label:{reverse:'Inversa',normal:'Normal','strike-slip':'Transcorrente'}[kind],rake,provider,note:'Classificação por rake da solução focal; não indica o movimento de toda a placa.'};}
const originTime=value=>typeof value==='number'?value:typeof value==='string'?Date.parse(value.replace(/ UTC$/,'Z').replace(' ','T')):NaN;
function sameOrigin(event,lat,lon,time,mag){return [event.lat,event.lon,event.time,event.mag,lat,lon,time,mag].every(Number.isFinite)&&Math.abs(time-event.time)<=30000&&distanceKm(event.lat,event.lon,lat,lon)<=80&&Math.abs(mag-event.mag)<=1;}
/** A unique, nearby origin is required; never pick an arbitrary aftershock. */
export function emscEventId(event,catalog){
 const ids=new Set((catalog?.features||[]).filter(f=>{const p=f.properties||{};return sameOrigin(event,number(p.lat),number(p.lon),originTime(p.time),number(p.mag));}).map(f=>f.properties?.unid||f.id).filter(id=>/^\d{8}_\d{7}$/.test(id)));
 return ids.size===1?[...ids][0]:null;
}
export function emscMechanism(event,eventid,solutions){
 if(!/^\d{8}_\d{7}$/.test(eventid)||!Array.isArray(solutions))return null;
 const valid=solutions.filter(s=>s.ev_unid===eventid&&sameOrigin(event,number(s.ev_latitude),number(s.ev_longitude),originTime(s.ev_event_time),number(s.ev_mag_value))&&number(s.mt_rake_1)!==null&&Math.abs(number(s.mt_rake_1))<=180&&typeof s.mt_source_catalog==='string'&&/^[A-Z0-9_-]{1,20}$/i.test(s.mt_source_catalog));
 valid.sort((a,b)=>Number(b.mt_preferred===true)-Number(a.mt_preferred===true)||String(a.mt_source_catalog).localeCompare(String(b.mt_source_catalog)));
 return valid.length?{...mechanism(number(valid[0].mt_rake_1),valid[0].mt_source_catalog+' via EMSC'),eventid}:null;
}
export async function fetchEmscMechanism(event,read=remote){
 if(![event.lat,event.lon,event.time,event.mag].every(Number.isFinite))return null;
 try{
  const params=new URLSearchParams({format:'json',starttime:new Date(event.time-30000).toISOString(),endtime:new Date(event.time+30000).toISOString(),limit:'100'});
  const id=emscEventId(event,JSON.parse(await read('https://www.seismicportal.eu/fdsnws/event/1/query?'+params)));
  if(!id)return null;
  return emscMechanism(event,id,JSON.parse(await read('https://www.seismicportal.eu/mtws/api/search?'+new URLSearchParams({eventid:id,format:'json'}))));
 }catch{return null;}
}
export function officialVideoMetadata(event,detail){
 const coords=detail.geometry?.coordinates,p=detail.properties;
 const base={exposure:validImageExposure(event.imageExposure||event.exposure)?(event.imageExposure||event.exposure):{status:'unavailable'},mechanism:null,reports:null};
 if(!coords||!p||![event.lat,event.lon,event.time,event.mag,coords[0],coords[1]].every(Number.isFinite)||distanceKm(event.lat,event.lon,coords[1],coords[0])>80||number(p.time)===null||Math.abs(p.time-event.time)>300000||number(p.mag)===null||Math.abs(p.mag-event.mag)>1.5)return base;
 const pr=p.products||{},reports=number(products(pr,'dyfi')[0]?.properties?.['num-responses']);
 if(reports!==null&&Number.isInteger(reports)&&reports>=0)base.reports=reports;
 const product=[...products(pr,'moment-tensor'),...products(pr,'focal-mechanism')].find(x=>{const rake=number(x.properties?.['nodal-plane-1-rake']);return rake!==null&&Math.abs(rake)<=180;});
 if(product){const rake=number(product.properties['nodal-plane-1-rake']),kind=rake>=45&&rake<=135?'reverse':rake<=-45&&rake>=-135?'normal':'strike-slip';base.mechanism={kind,label:{reverse:'Inversa',normal:'Normal','strike-slip':'Transcorrente'}[kind],rake,provider:'USGS',note:'Classificação por rake da solução focal; não indica o movimento de toda a placa.'};}
 base.pagerURL=products(pr,'losspager').find(x=>x.contents?.['pager.xml']?.url)?.contents['pager.xml'].url||null;
 return base;
}
export async function enrichVideoEvents(events){
 return Promise.all(events.map(async event=>{
  let metadata={exposure:validImageExposure(event.imageExposure||event.exposure)?(event.imageExposure||event.exposure):{status:'unavailable'},mechanism:null,reports:null};
  const id=String(event.id||'').replace(/^USGS-(?:RT-)?/i,'');
  if(/^[a-z0-9_-]{2,100}$/i.test(id))try{
   const detail=JSON.parse(await remote('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(id)));metadata=officialVideoMetadata(event,detail);
   if(metadata.pagerURL)try{metadata.exposure={status:'available',method:'pager',provider:'USGS PAGER',...parsePagerXML(await remote(metadata.pagerURL))};}catch{}
  }catch{}
  if(!metadata.mechanism)metadata.mechanism=await fetchEmscMechanism(event);
  delete metadata.pagerURL;return{...event,...metadata};
 }));
}

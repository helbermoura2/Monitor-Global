/** Official video metadata. Never infer faulting from place or depth. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {distanceKm,parsePagerXML} from '../population-exposure-worker.mjs';
import {validImageExposure} from '../seismic-image-data.mjs';
const run=promisify(execFile);
async function remote(url){const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='earthquake.usgs.gov')throw new Error('Unexpected USGS product URL');return(await run('curl',['-fsS','--max-time','20',url],{maxBuffer:8*1024*1024})).stdout;}
const products=(p,name)=>(p?.[name]||[]).filter(x=>x.status!=='DELETE').sort((a,b)=>Number(b.preferredWeight||0)-Number(a.preferredWeight||0)||Number(b.updateTime||0)-Number(a.updateTime||0));
const number=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x))?Number(x):null;
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
  delete metadata.pagerURL;return{...event,...metadata};
 }));
}

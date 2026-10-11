/** The same land-clipped attenuation model and palette as the live map. */
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hasFiniteRupture} from '../rupture-shaking-worker.mjs';
import {distanceKm} from '../population-exposure-worker.mjs';
import polygonClipping from '../js/vendor/polygon-clipping.min.js';
import '../js/rupture-shaking-model.js';
import '../js/seismic-impact-model.js';
globalThis.polygonClipping=polygonClipping;
const run=promisify(execFile);
async function json(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='earthquake.usgs.gov'||u.username||u.password)throw Error('Unexpected ShakeMap host');return JSON.parse((await run('curl',['-fsS','--max-time','20',url],{maxBuffer:2*1024*1024})).stdout);}
export async function publishedVideoShaking(event,read=json){
 const id=String(event.id||'').replace(/^USGS-(?:RT-)?/i,'');
 if(!/^[a-z0-9_-]{2,100}$/i.test(id)||event.mag<0)return null;
 try{
  const detail=await read('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(id)),p=detail.properties,c=detail.geometry?.coordinates;
  if(!c||![c[0],c[1],p?.time,p?.mag,event.time,event.lat,event.lon,event.mag].every(Number.isFinite)||Math.abs(p.time-event.time)>300000||distanceKm(event.lat,event.lon,c[1],c[0])>80||Math.abs(p.mag-event.mag)>1.5)return null;
  const product=(p.products?.shakemap||[]).filter(p=>p.status!=='DELETE').sort((a,b)=>Number(b.preferredWeight||0)-Number(a.preferredWeight||0)||Number(b.updateTime||0)-Number(a.updateTime||0))[0];
  const ruptureURL=product?.contents?.['download/rupture.json']?.url,gridURL=product?.contents?.['download/coverage_mmi_low_res.covjson']?.url;
  if(!gridURL)return null;
  let finite=false;if(ruptureURL)try{finite=hasFiniteRupture(await read(ruptureURL));}catch{}
  const grid=globalThis.RuptureShakingModel.normalize(await read(gridURL));
  return grid&&globalThis.RuptureShakingModel.sample(grid,c[0],c[1])!==null?{grid,method:finite?'usgs-shakemap-finite':'usgs-shakemap-grid'}:null;
 }catch{return null;}
}
export async function prepareVideoPaint(events,{official=false}={}){
 const geo=JSON.parse(await readFile(new URL('../assets/seismic/ne-50m-land.geojson',import.meta.url),'utf8'));
 const land=geo.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
 return Promise.all(events.map(async event=>{
  if(![event.lat,event.lon,event.mag,event.depthKm].every(Number.isFinite)||Math.abs(event.lat)>90||Math.abs(event.lon)>180)return {...event,paint:null};
  const context={lat:event.lat,lng:event.lon,mag:event.mag,depth:event.depthKm};
  if(globalThis.RuptureShakingModel.valid(event.shaking?.grid))context.shaking=event.shaking;
  else if(official)context.shaking=await publishedVideoShaking(event);
  const geometry=globalThis.SeismicImpactModel.geometry(context,land);
  const radius=Math.max(80,globalThis.SeismicImpactModel.extent(event.mag,event.depthKm,11)*1.25);
  const cosine=Math.max(.26,Math.cos(event.lat*Math.PI/180));
  const scale=Math.min(4/660,2*radius/(6371*cosine*390));
  return {...event,paint:geometry,paintSource:context.shaking?'USGS ShakeMap · intensidade estimada':'Intensidade estimada · modelo do mapa ao vivo',videoCamera:{lon:event.lon,lat:Math.max(-75,Math.min(75,event.lat)),scale}};
 }));
}

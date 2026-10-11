/** Preload the existing site's Esri satellite and reference tiles before recording. */
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),merc=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-75,Math.min(75,lat))*Math.PI/360));
const valid=e=>Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180;
const world={lon:0,lat:18,scale:6.7/660},camera=e=>valid(e)?{lon:e.lon,lat:e.lat,scale:.24/660}:world;
const ease=t=>t*t*(3-2*t);
function mix(a,b,t){const delta=((b.lon-a.lon+540)%360)-180;return{lon:a.lon+delta*t,lat:a.lat+(b.lat-a.lat)*t,scale:Math.exp(Math.log(a.scale)*(1-t)+Math.log(b.scale)*t)};}
export function satellitePlan(events){
 const duration=2+events.length*4+3,cameras=[],keys=new Set();
 for(let frame=0;frame<=Math.ceil(duration*25);frame++){
  const time=frame/25,index=Math.min(events.length-1,Math.max(0,Math.floor((time-2)/4)));let cam=world;
  if(time>=2&&time<2+events.length*4)cam=mix(index?camera(events[index-1]):world,camera(events[index]),ease(Math.min(1,(time-2-index*4)/1.4)));
  if(time>=2+events.length*4)cam=mix(camera(events.at(-1)),world,ease(Math.min(1,(time-2-events.length*4)/1.4)));
  cam.z=Math.max(2,Math.min(6,Math.round(Math.log2(2*Math.PI/(256*cam.scale)))));
  const n=2**cam.z,unit=2*Math.PI/n,x=(cam.lon*Math.PI/180+Math.PI)/unit,y=(Math.PI-merc(cam.lat))/unit,rx=330*cam.scale/unit,ry=280*cam.scale/unit;
  for(let tx=Math.floor(x-rx);tx<=Math.floor(x+rx);tx++)for(let ty=Math.max(0,Math.floor(y-ry));ty<=Math.min(n-1,Math.floor(y+ry));ty++)keys.add(`${cam.z}/${ty}/${((tx%n)+n)%n}`);
  cameras.push(cam);
 }
 return{cameras,keys:[...keys]};
}
export async function preloadSatellite(events,cache){
 const plan=satellitePlan(events);await mkdir(cache,{recursive:true});const tiles={},queue=plan.keys.flatMap(key=>['imagery','labels'].map(layer=>({key,layer})));let index=0;
 async function worker(){while(index<queue.length){const {key,layer}=queue[index++],path=resolve(cache,layer+'-'+key.replaceAll('/','-')),service=layer==='imagery'?'World_Imagery':'Reference/World_Boundaries_and_Places';let bytes;
  try{bytes=await readFile(path);}catch{await run('curl',['-fsS','--retry','2','--max-time','25','-o',path,`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/${key}`]);bytes=await readFile(path);}
  const jpg=bytes[0]===255&&bytes[1]===216,png=bytes[0]===137&&bytes[1]===80;if(!jpg&&!png)throw new Error('Invalid Esri tile '+layer+'/'+key);
  (tiles[key]??={})[layer]='data:image/'+(jpg?'jpeg':'png')+';base64,'+bytes.toString('base64');
 }}
 console.log(`Preloading ${plan.keys.length} map tiles (${queue.length} imagery/labels files).`);
 await Promise.all(Array.from({length:6},worker));return{cameras:plan.cameras,tiles};
}

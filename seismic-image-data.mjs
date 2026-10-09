import './js/seismic-impact-model.js';
import {handlePopulationExposure} from './population-exposure-worker.mjs';
const model=globalThis.SeismicImpactModel;
export function imageMapFrame(ev,width,height,anchorY=350){
 let radius=80;
 if(Number(ev.mag)>=5){let lo=0,hi=5000;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(model.pga(Number(ev.mag),Number(ev.depth)||0,mid)>=11)lo=mid;else hi=mid;}radius=Math.max(80,lo*1.25);}
 // Keep the affected region in the clear map area above the statistics.
 const zoom=Math.max(3,Math.min(7,Math.floor(Math.log2(2*180*111.32*Math.min(anchorY,width/2)/(Math.max(80,radius)*width)))));
 const span=180/2**zoom;
 return {zoom,width,height,anchorX:width/2,anchorY,minLon:Number(ev.lon)-span,maxLon:Number(ev.lon)+span,minLat:Number(ev.lat)-2*span*(height-anchorY)/width,maxLat:Number(ev.lat)+2*span*anchorY/width};
}
export function imageProject(frame,lng,lat){return [(lng-frame.minLon)/(frame.maxLon-frame.minLon)*frame.width,(frame.maxLat-lat)/(frame.maxLat-frame.minLat)*frame.height];}
export function imageMetersPerPixel(frame,lat){return distance(lat,frame.minLon,lat,frame.minLon+(frame.maxLon-frame.minLon)/frame.width)*1000;}
let landPromise;
async function land(){
 if(!landPromise){landPromise=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),5000);try{const r=await fetch('https://monitorglobal.top/assets/seismic/ne-50m-land.geojson?v=50m1',{signal:c.signal});if(!r.ok)throw Error('Coastlines');const d=await r.json();return d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);}finally{clearTimeout(timer);}})().catch(e=>{landPromise=null;throw e;});}
 return landPromise;
}
const distance=(a,b,c,d)=>{const rad=Math.PI/180,x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));};
// Scanline land mask, including holes. Paint only on land, at a bounded 4px grid.
export function paintImageIntensity(rgba,frame,ev,polygons){
 const {width:W,height:H}=frame,rows=Math.min(H,480),step=4,mask=new Uint8Array(W*rows);
 for(const polygon of polygons)for(const shift of [-360,0,360]){
  const rings=polygon.map(r=>r.map(([lng,lat])=>imageProject(frame,lng+shift,lat))),xs=rings[0].map(p=>p[0]),ys=rings[0].map(p=>p[1]);
  if(Math.max(...xs)<0||Math.min(...xs)>W||Math.max(...ys)<0||Math.min(...ys)>rows)continue;
  for(let y=Math.max(0,Math.floor(Math.min(...ys)/step)*step);y<Math.min(rows,Math.max(...ys));y+=step){
   const hits=[],scan=y+step/2;
   for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];if((a[1]>scan)!==(b[1]>scan))hits.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2)mask.fill(1,y*W+Math.max(0,Math.ceil(hits[i]/step)*step),y*W+Math.min(W,Math.floor(hits[i+1]/step)*step));
  }
 }
 let painted=0;
 for(let y=0;y<rows;y+=step)for(let x=0;x<W;x+=step){
  if(!mask[y*W+x])continue;
  const lng=frame.minLon+(x+step/2)/W*(frame.maxLon-frame.minLon),lat=frame.maxLat-(y+step/2)/H*(frame.maxLat-frame.minLat);
  const pga=model.pga(Number(ev.mag),Number(ev.depth)||0,distance(Number(ev.lat),Number(ev.lon),lat,lng));if(pga<.5)continue;
  const rgb=model.color(pga).match(/\d+/g).map(Number);painted++;
  for(let yy=y;yy<Math.min(rows,y+step);yy++)for(let xx=x;xx<Math.min(W,x+step);xx++){const i=(yy*W+xx)*4;for(let c=0;c<3;c++)rgba[i+c]=Math.round(rgba[i+c]*.44+rgb[c]*.56);}
 }
 return painted;
}
export async function overlayImageIntensity(rgba,frame,ev){if(Number(ev.mag)<5)return false;try{return paintImageIntensity(rgba,frame,ev,await land())>0;}catch{return false;}}
export function validImageExposure(data){return data?.status==='available'&&['pager','worldpop'].includes(data.method)&&data.ranges?.length===3&&data.ranges.every((r,i)=>r.population!==null&&Number.isFinite(Number(r.population))&&Number(r.population)>=0&&(!i||Number(r.population)<=Number(data.ranges[i-1].population)));}
export async function queryImageExposure(ev,env){
 const url=new URL('https://internal/population-exposure');
 const provider=ev.provider||ev.source||'',eventId=/^(USGS|US|PT)$/i.test(provider)?String(ev.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
 for(const [k,v] of Object.entries({lat:ev.lat,lng:ev.lon,mag:ev.mag,depth:ev.depth??0,time:Date.parse(ev.timeIso),...(eventId?{eventId}:{})}))url.searchParams.set(k,String(v));
 const job=handlePopulationExposure(new Request(url),env||{}).then(r=>r.json());
 if(env?.IMAGE_WAIT_UNTIL)env.IMAGE_WAIT_UNTIL(job);
 let timer;try{return await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'pending'}),2500);})]);}catch{return {status:'unavailable'};}finally{clearTimeout(timer);}
}
export const exposureVersion=data=>validImageExposure(data)?JSON.stringify([data.method,data.partial,data.ranges.map(r=>r.population)]):data?.status||'pending';

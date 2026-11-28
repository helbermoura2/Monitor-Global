// Manual diagnostic. Reports real metadata and PNG header, never marks stale data as current.
import {discover,ATTRIBUTION} from '../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
const regions=[['São Paulo',[-48,-25,-45,-22]],['Sul',[-57,-32,-48,-23]],['Sudeste',[-49,-25,-40,-17]],['Centro-Oeste',[-58,-22,-48,-12]],['Nordeste',[-43,-13,-34,-3]],['Norte',[-65,-9,-55,1]]];
const archive=process.argv.includes('--archive');
const now=archive?Date.parse('2026-11-19T16:00:00Z'):Date.now();
try{
 let result,frames=[],region;
 for(const [name,bounds] of archive?regions.slice(0,1):regions){
  try{
   const data=await discover(bounds,{now});
   const candidates=data.radars.flatMap(r=>r.frames);
   console.log(JSON.stringify({region:name,mode:archive?'historical':'recent',frames:candidates.length,thumbnails:candidates.filter(f=>f.products.thumbnail).length,partial:data.partial}));
   if(candidates.some(f=>f.products.thumbnail)){result=data;frames=candidates;region=name;break;}
  }catch(e){console.log(JSON.stringify({region:name,error:e.message}));}
 }
 if(!result)throw Error('No recent validated PNG metadata in sampled regions; keep RainViewer.');

 console.log(JSON.stringify({source:ATTRIBUTION,region,mode:archive?'historical reference only':'recent',at:new Date(now).toISOString(),radars:result.radars.map(r=>({radar:r.radar,owner:r.owner,frames:r.frames.map(f=>({id:f.id,time:new Date(f.time).toISOString(),bounds:f.bounds,products:Object.keys(f.products).filter(k=>f.products[k])}))})),rejected:result.rejected,stale:result.stale,partial:result.partial},null,2));
 if(!frames.length)throw Error('No validated metadata within requested period; keep RainViewer.');
 const f=frames.find(f=>f.products.thumbnail);
 if(!f)throw Error('No PNG thumbnail in available radar frames.');
 const response=await fetch(f.products.thumbnail.href,{signal:AbortSignal.timeout(20000),redirect:'error',credentials:'omit'});
 if(!response.ok)throw Error('PNG HTTP '+response.status);
 if(!response.body)throw Error('Missing PNG response');
 const reader=response.body.getReader();const max=4*1024*1024;let bytes=0,head=new Uint8Array(33),filled=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw Error('PNG exceeds mobile budget');}const n=Math.min(33-filled,value.length);head.set(value.subarray(0,n),filled);filled+=n;}}finally{reader.releaseLock();}
 if(filled!==33||!head.subarray(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])||String.fromCharCode(...head.subarray(12,16))!=='IHDR')throw Error('Invalid PNG header');
 const view=new DataView(head.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(width!==500||height!==500)throw Error('PNG dimensions differ from INPE specification: '+width+'x'+height);
 console.log(JSON.stringify({png:'verified header and byte budget',id:f.id,width,height,bytes,colorType:head[25],georeferencing:'pending pixel alignment verification',mode:archive?'historical reference only':'recent'}));
}catch(e){console.error('INPE diagnostic:',e.message);process.exitCode=1;}

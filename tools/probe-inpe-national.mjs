// Bounded national diagnostic, run only by explicit development checks.
// Product availability differs across radar networks. Never infer NetCDF from a thumbnail.
import {discover} from '../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
import {writeFileSync} from 'node:fs';
const regions=[
 ['Sul',[-57,-32,-48,-23]],['Sudeste',[-49,-25,-40,-17]],
 ['Centro-Oeste',[-58,-22,-48,-12]],['Nordeste',[-43,-13,-34,-3]],
 ['Norte',[-65,-9,-55,1]]
];
const now=Date.now(), samples={};
for(const [name,bounds] of regions){
 try{
  const all=await discover(bounds,{now});
  console.log(JSON.stringify({region:name,radars:all.radars.map(r=>({radar:r.radar,owner:r.owner,products:[...new Set(r.frames.flatMap(f=>Object.keys(f.products).filter(k=>f.products[k])))]})),partial:all.partial}));
  for(const product of ['cappi15l','cappi3km']){
   if(samples[product])continue;
   const f=all.radars.flatMap(r=>r.frames).filter(f=>f.products[product]).sort((a,b)=>b.time-a.time)[0];
   if(f)samples[product]=f;
  }
 }catch(e){console.log(JSON.stringify({region:name,error:e.message}));}
}
for(const product of ['cappi15l','cappi3km']){
 if(samples[product])continue;
 // The INPE documentation explicitly describes this STAC query extension.
 // Known historical date and Chapecó area are a schema fallback, not current weather.
 for(const date of [now,Date.parse('2026-10-12T18:00:00Z')]){
  for(const [name,bounds] of regions){
   if(samples[product])break;
   try{
    const result=await discover(bounds,{now:date,product});
    const f=result.radars.flatMap(r=>r.frames).filter(f=>f.products[product]).sort((a,b)=>b.time-a.time)[0];
    console.log(JSON.stringify({region:name,product,reference:new Date(date).toISOString(),matched:!!f}));
    if(f)samples[product]=f;
   }catch(e){console.log(JSON.stringify({region:name,product,error:e.message}));}
  }
  if(samples[product])break;
 }
}
const found=Object.keys(samples);
for(const product of found)writeFileSync('/tmp/argos-inpe-'+product+'.json',JSON.stringify({...samples[product],products:{[product]:samples[product].products[product],thumbnail:samples[product].products.thumbnail}}));
console.log(JSON.stringify({found,missing:['cappi15l','cappi3km'].filter(p=>!samples[p]),status:found.length===2?'samples ready for verification':'coverage incomplete; no altitude release'}));
if(found.length!==2)process.exitCode=2;

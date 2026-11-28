import {discover} from '../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
import {selectCappi,fetchCappi} from '../android-mobile/app/src/main/assets/inpe-radar-layer-model.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const root='/tmp/argos-storm-sequences';await mkdir(root,{recursive:true});
const regions=[['Sudeste',[-48,-25,-45,-22]],['Sul',[-57,-32,-48,-23]],['Nordeste',[-43,-13,-34,-3]],['Norte',[-65,-9,-55,1]],['Centro-Oeste',[-58,-22,-48,-12]],['Sudeste leste',[-49,-25,-40,-17]]];
const now=Date.now(),cases=[...regions.map(([region,bounds])=>({region,bounds,now,mode:'recent'})),{region:'São Paulo',bounds:regions[0][1],now:Date.parse('2026-11-19T16:00:00Z'),mode:'historical'}];
cases.push({region:'Sul',bounds:regions[1][1],now:Date.parse('2026-10-12T18:00:00Z'),mode:'historical'});
const sequences=[],seen=new Set();let downloads=0;
for(const c of cases){
 if(sequences.length>=6||downloads+3>18)break;
 try{
  // The optional server-side product filter returned HTTP 500 in every sampled region.
  // Use the already validated plain STAC query and filter actual assets locally.
  const data=await discover(c.bounds,{now:c.now});const candidates=[];
  for(const radar of data.radars){
   const frames=radar.frames.filter(f=>f.time<=c.now&&selectCappi(f,3000,c.now)?.product==='cappi3km');
   for(let i=frames.length-3;i>=0;i--){
    const seq=frames.slice(i,i+3);
    if(seq.length!==3||seq.slice(1).some((f,j)=>f.time-seq[j].time<180000||f.time-seq[j].time>1200000))continue;
    const key=seq.map(f=>f.id).join('|');if(!seen.has(key)){candidates.push(seq);seen.add(key);}break;
   }
  }
  console.log(JSON.stringify({region:c.region,mode:c.mode,candidates:candidates.length,partial:data.partial}));
  for(const seq of candidates.slice(0,2)){
   if(sequences.length>=6||downloads+3>18)break;
   try{
    const files=[];
    for(let i=0;i<3;i++){
     const f=seq[i],selected=selectCappi(f,3000,c.now);downloads++;
     const bytes=await fetchCappi(selected.href,AbortSignal.timeout(45000));
     const file=root+'/'+sequences.length+'-'+i+'.nc';await writeFile(file,new Uint8Array(bytes));files.push({file,id:f.id,time:f.time});
    }
    sequences.push({radar:seq[0].radar,owner:seq[0].owner,product:'cappi3km',altitude:3000,mode:c.mode,region:c.region,now:c.now,frames:files});
   }catch(e){console.log(JSON.stringify({region:c.region,status:'sequence_unavailable',reason:e.message}));}
  }
 }catch(e){console.log(JSON.stringify({region:c.region,status:'unavailable',reason:e.message}));}
}
await writeFile(root+'/manifest.json',JSON.stringify(sequences));
if(!sequences.length)throw Error('No real three-frame sequence; validation pending');
console.log(JSON.stringify({sequences:sequences.length,downloads}));

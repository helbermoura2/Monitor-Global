/* GlobalQuake iasp91 travel-time tables and interpolation, MIT © xspanger3770.
 * Provenance/license: assets/seismic/README.md and GLOBALQUAKE-LICENSE.txt.
 * The packed tables preserve every original Float32 bit. No speed multiplier,
 * magnitude cap, or constant-speed fallback is used. */
(function(root){
 'use strict';
 const NO_ARRIVAL=-999,EARTH_CIRCUMFERENCE=40082,EARTH_RADIUS=6379;
 const phases={p:{name:'p_travel_table',min:0,max:150},s:{name:'s_travel_table',min:0,max:150},pkp:{name:'pkp_travel_table',min:140,max:180},pkikp:{name:'pkikp_travel_table',min:0,max:180}};
 let tables=null,promise=null,status='idle';
 const url=new URL('../assets/seismic/globalquake-iasp91.bin.gz?v=00d63afa',document.currentScript?.src||new URL('js/globalquake-travel.js',document.baseURI));
 function unpack(buffer){
  const bytes=new Uint8Array(buffer);
  if(new TextDecoder().decode(bytes.subarray(0,8))!=='GQTT0001')throw new Error('Invalid seismic table');
  const size=new DataView(buffer).getUint32(8,true),metadata=JSON.parse(new TextDecoder().decode(bytes.subarray(12,12+size))),result={};let offset=12+size;
  for(const [name,m] of Object.entries(metadata)){
   const count=m.rows*m.cols;if(m.rows!==751||m.bytes!==count*4||offset+m.bytes>bytes.length)throw new Error('Invalid seismic dimensions');
   const words=new Uint32Array(count);let previous=0;
   for(let i=0;i<count;i++){if(i%m.cols===0)previous=0;const delta=(bytes[offset+i]|bytes[offset+count+i]<<8|bytes[offset+2*count+i]<<16|bytes[offset+3*count+i]<<24)>>>0;words[i]=previous=(previous^delta)>>>0;}
   result[name]={...m,values:new Float32Array(words.buffer)};offset+=m.bytes;
  }
  if(offset!==bytes.length||Object.values(phases).some(p=>!result[p.name]))throw new Error('Incomplete seismic table');
  return result;
 }
 function load(){
  if(promise&&status!=='error')return promise;status='loading';
  promise=(async()=>{
   const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('Seismic model unavailable');
   let buffer=await response.arrayBuffer();
   // Some hosts transparently decode .gz assets; accept either representation.
   if(new Uint8Array(buffer)[0]===31){if(!root.DecompressionStream)throw new Error('Seismic decompression unavailable');buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
   tables=unpack(buffer);status='ready';return api;
  })().catch(error=>{status='error';throw error;});return promise;
 }
 function travelTime(phase,depth,angle){
  const p=phases[phase],table=p&&tables?.[p.name];if(!table||!Number.isFinite(depth)||!Number.isFinite(angle))return NO_ARRIVAL;
  const x=depth/750*(table.rows-1),y=(angle-p.min)/(p.max-p.min)*(table.cols-1);
  if(x<0||y<0||x>table.rows-1||y>table.cols-1)return NO_ARRIVAL;
  const x0=Math.floor(x),x1=Math.min(x0+1,table.rows-1),y0=Math.floor(y),y1=Math.min(y0+1,table.cols-1),v=table.values,c=table.cols;
  const q11=v[x0*c+y0],q21=v[x1*c+y0],q12=v[x0*c+y1],q22=v[x1*c+y1];
  if([q11,q21,q12,q22].some(q=>q<0))return NO_ARRIVAL;
  const tx=x-x0,ty=y-y0;return (1-tx)*(1-ty)*q11+tx*(1-ty)*q21+(1-tx)*ty*q12+tx*ty*q22;
 }
 function angle(phase,depth,time){
  const p=phases[phase],table=p&&tables?.[p.name];if(!table||!Number.isFinite(time)||time<0)return null;
  if((phase==='p'||phase==='s')&&time>table.values[table.cols-1])return null;
  let left=p.min,right=p.max,midValue=0;
  while(right-left>1e-4){const mid=left+(right-left)/2;midValue=travelTime(phase,depth,mid);if(midValue===NO_ARRIVAL)return null;if(midValue<time)left=mid;else right=mid;}
  return Math.abs(time-midValue)>.5?null:(left+right)/2;
 }
 function endTime(phase,depth){const p=phases[phase],table=p&&tables?.[p.name];if(!table)return null;const t=travelTime(phase,depth,p.max);return t===NO_ARRIVAL?null:((phase==='p'||phase==='s')?Math.min(t,table.values[table.cols-1]):t);}
 function radius(phase,depth,time){const a=angle(phase,depth,time);return a===null?null:a/360*EARTH_CIRCUMFERENCE;}
 const api={load,travelTime,angle,radius,endTime,status:()=>status,model:'iasp91',revision:'00d63afae10fcb910f7609873bf85c8d80566eaa',EARTH_RADIUS,EARTH_CIRCUMFERENCE};
 root.GlobalQuakeTravel=api;
 // Start once, cache locally, and omit fronts if loading fails: never invent a radius.
 load().catch(()=>{});
})(window);

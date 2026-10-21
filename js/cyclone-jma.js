/* On-demand official JMA forecasts. Fixed endpoint, exact name + position/time match. */
(function(){'use strict';
const base='https://www.jma.go.jp/bosai/typhoon/data/',cache=new Map(),jobs=new Map();let target=null;
async function json(url){const r=await fetchWithCorsFallback(url,8000);if(!r.ok)throw Error('JMA '+r.status);return r.json();}
async function load(q){
 if(q?.type!=='hurricane'||q.coneUrl||!CycloneRouteModel.point(q.coords)||q.coords[0]<95||q.coords[0]>180||q.coords[1]<0)return null;
 const key=q.id+'|'+q.place,hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.data;if(jobs.has(key))return jobs.get(key);if(jobs.size>=2)return null;
 const task=(async()=>{try{
  if(!target||target.until<Date.now()){const list=await json(base+'targetTc.json');target={list:Array.isArray(list)?list.slice(0,6):[],until:Date.now()+20*60000};}
  for(const tc of target.list.slice(0,4)){if(!/^TC\d{4,8}$/.test(tc.tropicalCyclone||''))continue;const issue=Date.parse(tc.issue||'');if(!Number.isFinite(issue)||Date.now()-issue>12*3600000)continue;
   const data=await json(base+tc.tropicalCyclone+'/forecast.json'),parsed=CycloneRouteModel.jma(data,q);if(parsed){cache.delete(key);cache.set(key,{until:Date.now()+20*60000,data:parsed});while(cache.size>4)cache.delete(cache.keys().next().value);return parsed;}
  }
 }catch(error){console.warn('[trajetória JMA]',error.message);}cache.delete(key);cache.set(key,{until:Date.now()+10*60000,data:null});while(cache.size>4)cache.delete(cache.keys().next().value);return null;})();jobs.set(key,task);try{return await task;}finally{jobs.delete(key);}
}
window.CycloneJMA={load};
})();

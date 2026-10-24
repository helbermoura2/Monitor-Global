import './js/tsunami-link.js';
import './js/quake-tsunami-status.js';
import {getOfficialTsunamis} from './tsunami-official-worker.mjs';
export const imageTsunamiVersion=status=>status?.version||'unconfirmed';
export async function queryImageTsunami(ev,previous=ev.imageTsunami,read=getOfficialTsunamis){
 const quake={...ev,id:ev.id||'image-quake',type:'earthquake',coords:[ev.lon,ev.lat],time:Number.isFinite(ev.time)?ev.time:Date.parse(ev.timeIso)};
 let feed={ok:false,items:[]};
 // Reuse the existing official collector and its bounded cache, without a new DO or cron.
 if(Number(ev.mag)>=5.5)try{feed=await read();}catch{}
 return globalThis.QuakeTsunamiStatus.resolve(quake,{...feed,checkedAt:Date.now()},previous);
}

/* Shared matching rules: a coastal warning polygon is never an earthquake origin. */
(function(root){
 'use strict';
 const HOUR=3600000;
 function located(item){return Array.isArray(item?.coords)&&item.coords.length>=2&&item.coords.slice(0,2).every(Number.isFinite)&&Math.abs(item.coords[0])<=180&&Math.abs(item.coords[1])<=90;}
 function origin(item){return located(item)&&item.coordinateRole!=='warning-area';}
 function distance(a,b){const r=Math.PI/180,dl=(a[0]-b[0])*r,dp=(a[1]-b[1])*r,s=Math.sin(dp/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dl/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,s)));}
 function official(item){return item?.type==='tsunami'&&(item.official===true||['PTWC','NTWC','NWS/NOAA'].includes(item.source));}
 function current(item,now){return official(item)&&Number.isFinite(item.time)&&item.time<=now+300000&&now-item.time<=72*HOUR&&(!Number.isFinite(item.expiresAt)||item.expiresAt>now);}
 function sameEvent(a,b){
  if(a.officialEventId&&b.officialEventId)return a.officialEventId===b.officialEventId;
  if(!origin(a)||!origin(b)||distance(a.coords,b.coords)>100)return false;
  if(Number.isFinite(a.originTime)&&Number.isFinite(b.originTime))return Math.abs(a.originTime-b.originTime)<=10*60000;
  // Publication time alone cannot identify a revision after another nearby quake.
  return false;
 }
 function product(item){return item.feedKey||item.source;}
 function latest(items,now=Date.now()){
  const rows=[];
  for(const item of (items||[]).filter(a=>current(a,now)).slice().sort((a,b)=>b.time-a.time)){
   if(!rows.some(a=>product(a)===product(item)&&(sameEvent(a,item)||a.id===item.id)))rows.push(item);
  }
  return rows;
 }
 function candidates(alert,quakes){
  if(!origin(alert))return [];
  const precise=Number.isFinite(alert.originTime);
  return (quakes||[]).filter(q=>q?.type==='earthquake'&&origin(q)&&Number.isFinite(q.time)).flatMap(q=>{
   const km=distance(alert.coords,q.coords),dt=precise?Math.abs(q.time-alert.originTime):alert.time-q.time;
   if(km>100||(precise?dt>10*60000:dt< -120000||dt>2*HOUR))return [];
   if(Number.isFinite(alert.originMag)&&Number.isFinite(q.mag)&&Math.abs(alert.originMag-q.mag)>1.5)return [];
   return [{quake:q,distanceKm:km,timeDifferenceMs:dt,score:Math.abs(dt)/60000+km/10,kind:precise?'origin':'probable'}];
  }).sort((a,b)=>a.score-b.score);
 }
 function match(alert,quakes){
  const rows=candidates(alert,quakes);if(!rows.length)return null;
  // Without an origin time, two nearby tremors cannot be distinguished safely.
  if(rows.length>1&&(rows[0].kind==='probable'||rows[1].score-rows[0].score<3))return null;
  return rows[0];
 }
 function forQuake(quake,alerts,quakes=[quake],now=Date.now()){
  return latest(alerts,now).flatMap(alert=>{const relation=match(alert,quakes);return relation?.quake.id===quake.id?[{alert,...relation}]:[];}).sort((a,b)=>(b.alert.sev||0)-(a.alert.sev||0)||b.alert.time-a.alert.time);
 }
 const api={located,origin,distance,official,current,sameEvent,latest,match,forQuake};root.TsunamiLink=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

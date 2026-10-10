/* Catalog association, not an official aftershock classification. */
(function(root){
 'use strict';
 const WINDOW=72*3600000;
 function valid(q,now){return q?.type==='earthquake'&&q.id!=null&&Number.isFinite(q.mag)&&Number.isFinite(q.time)&&q.time>=now-WINDOW&&q.time<=now+60000&&Array.isArray(q.coords)&&q.coords.length===2&&q.coords.every(Number.isFinite)&&Math.abs(q.coords[1])<=90&&Math.abs(q.coords[0])<=180;}
 function distance(a,b){const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlng=(b[0]-a[0])*rad,s=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlng/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,s)));}
 // Broad empirical rupture-length scale, used only as a bounded search radius.
 function radius(mag){return Math.min(200,Math.max(25,2*Math.pow(10,-2.44+.59*mag)));}
 function compatible(main,q){
  if(main.id===q.id||main.mag<5||main.mag-q.mag<.099||q.time<=main.time||q.time-main.time>WINDOW)return null;
  const km=distance(main.coords,q.coords),limit=radius(main.mag);
  if(km>limit||!Number.isFinite(main.depth)||!Number.isFinite(q.depth)||main.depth<0||q.depth<0||Math.abs(main.depth-q.depth)>75)return null;
  // Do not relabel likely duplicate reports or near-simultaneous origins.
  if(q.time-main.time<120000)return null;
  return {main,distanceKm:km,score:km/limit};
 }
 function build(catalog,now=Date.now()){
  const unique=new Map();for(const q of catalog||[])if(valid(q,now))unique.set(q.id,q);
  const items=[...unique.values()].sort((a,b)=>a.time-b.time||b.mag-a.mag||String(a.id).localeCompare(String(b.id)));
  const mains=items.filter(q=>q.mag>=5),parents=new Map(),groups=new Map();
  for(const q of items){
   const candidates=mains.map(m=>compatible(m,q)).filter(Boolean).sort((a,b)=>b.main.mag-a.main.mag||a.score-b.score);
   if(!candidates.length)continue;
   const top=candidates[0],rival=candidates.find(c=>c.main.id!==top.main.id&&Math.abs(c.main.mag-top.main.mag)<.3&&!parents.has(c.main.id));
   if(rival&&Math.max(top.score,rival.score)<Math.max(.1,Math.min(top.score,rival.score)*1.5))continue;
   // Each event belongs to one root; a smaller successor cannot steal the group.
   const rootId=parents.get(top.main.id)||top.main.id,main=unique.get(rootId);
   if(!compatible(main,q))continue;
   parents.set(q.id,rootId);if(!groups.has(rootId))groups.set(rootId,{main,children:[],radiusKm:radius(main.mag)});groups.get(rootId).children.push(q);
  }
  for(const group of groups.values())group.children.sort((a,b)=>b.time-a.time||b.mag-a.mag);
  return {groups,parents,forEvent(id){return groups.get(parents.get(id)||id)||null;}};
 }
 const api={build,distance,radius,WINDOW};root.AftershockModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

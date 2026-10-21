/* Nearby individual markers only. Aftershock sequences own their separate hub. */
(function(root){
 'use strict';
 const MIN_ZOOM=6,LIMIT=160;let boundMap=null;
 function updateVisibility(zoom){document.body.classList.toggle('map-far-view',zoom<MIN_ZOOM);}
 function visibleIds(items,selected,zoom,project,width,height,centerLng=0){
  const keep=new Set(),near=[];
  for(const item of items){
   if(!Array.isArray(item.coords)||item.coords.length<2||!item.coords.slice(0,2).every(Number.isFinite)||Math.abs(item.coords[0])>180||Math.abs(item.coords[1])>90)continue;
   if(item.id===selected){keep.add(item.id);continue;}
   if(zoom<MIN_ZOOM)continue;
   const lng=centerLng+((item.coords[0]-centerLng+540)%360)-180,p=project([lng,item.coords[1]]);
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>width||p.y<0||p.y>height)continue;
   near.push({item,distance:Math.hypot(p.x-width/2,p.y-height/2)});
  }
  near.sort((a,b)=>a.distance-b.distance||(Number(b.item.mag)||0)-(Number(a.item.mag)||0)||(Number(b.item.time)||0)-(Number(a.item.time)||0));
  for(const {item}of near.slice(0,Math.max(0,LIMIT-keep.size)))keep.add(item.id);
  return keep;
 }
 function sync(items,selected,zoom){
  if(boundMap!==map){boundMap=map;map.on('zoom',()=>updateVisibility(map.getZoom()));}updateVisibility(zoom);
  const container=map.getContainer(),keep=visibleIds(items,selected,zoom,p=>map.project(p),container.clientWidth,container.clientHeight,map.getCenter().lng);
  return new Set(items.filter(item=>!keep.has(item.id)).map(item=>item.id));
 }
 root.MobileMapClusters={visibleIds,sync,MIN_ZOOM,LIMIT};
})(typeof window==='undefined'?globalThis:window);

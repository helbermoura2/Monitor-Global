/* Spatial groups for distant mobile views. The selected epicenter stays individual. */
(function(root){
 'use strict';
 function group(items,selected,zoom){
  const cells=new Map(),size=64/(512*2**Math.floor(zoom));
  for(const item of items){
   if(item.id===selected)continue;
   if(!Array.isArray(item.coords)||item.coords.length<2||!item.coords.slice(0,2).every(Number.isFinite)||Math.abs(item.coords[0])>180||Math.abs(item.coords[1])>90)continue;
   const [lng,lat]=item.coords,clamped=Math.max(-85,Math.min(85,lat))*Math.PI/180;
   const x=(lng+180)/360,y=(1-Math.log(Math.tan(Math.PI/4+clamped/2))/Math.PI)/2;
   const key=item.type+':'+Math.floor(x/size)+':'+Math.floor(y/size);
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);
  }
  const hidden=new Set(),groups=[];
  for(const [key,members] of cells){if(members.length<2)continue;
   members.forEach(item=>hidden.add(item.id));
   groups.push({key,type:members[0].type,count:members.length,coords:[members.reduce((n,i)=>n+i.coords[0],0)/members.length,members.reduce((n,i)=>n+i.coords[1],0)/members.length]});
  }
  return {hidden,groups};
 }
 const markers=new Map();
 function sync(items,selected,zoom){
  const enabled=matchMedia('(max-width:900px)').matches&&zoom<5;
  const selectedItem=items.find(item=>item.id===selected);
  const result=enabled?group(items,selected,zoom):{hidden:new Set(),groups:[]},wanted=new Set();
  for(const entry of result.groups){
   wanted.add(entry.key);let marker=markers.get(entry.key);
   if(!marker){
    const el=document.createElement('button');el.type='button';el.className='mg-mobile-cluster';
    marker=new maplibregl.Marker({element:el}).setLngLat(entry.coords).addTo(map);
    el.addEventListener('click',event=>{event.stopPropagation();stopMapCamera();map.easeTo({center:marker.getLngLat(),zoom:Math.min(8,map.getZoom()+2),duration:1000});});
    markers.set(entry.key,marker);
   }
   if(selectedItem){const a=map.project(selectedItem.coords),b=map.project(entry.coords);marker.setOffset(Math.hypot(a.x-b.x,a.y-b.y)<60?[48,48]:[0,0]);}else marker.setOffset([0,0]);
   const el=marker.getElement();if(el.textContent!==String(entry.count))el.textContent=entry.count;
   el.setAttribute('aria-label',entry.count+' '+(entry.type==='earthquake'?'sismos':'eventos')+' próximos. Aproximar para explorar');
   const pos=marker.getLngLat();if(pos.lng!==entry.coords[0]||pos.lat!==entry.coords[1])marker.setLngLat(entry.coords);
  }
  for(const [key,marker]of markers)if(!wanted.has(key)){marker.remove();markers.delete(key);}
  return result.hidden;
 }
 root.MobileMapClusters={group,sync};
})(typeof window==='undefined'?globalThis:window);

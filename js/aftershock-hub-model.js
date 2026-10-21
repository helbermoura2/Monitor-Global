/* Display geometry only; association stays in AftershockModel. */
(function(root){
 'use strict';
 function geometry(a,b){
  const end=a[0]+((b[0]-a[0]+540)%360)-180;
  if(end>=-180&&end<=180)return {type:'LineString',coordinates:[a,[end,b[1]]]};
  const edge=end>180?180:-180,t=(edge-a[0])/(end-a[0]),lat=a[1]+t*(b[1]-a[1]);
  return {type:'MultiLineString',coordinates:[[a,[edge,lat]],[[-edge,lat],[end>180?end-360:end+360,b[1]]]]};
 }
 function links(main,targets,selected){return {type:'FeatureCollection',features:(targets||[]).filter(t=>t.id!==main.id).slice(0,40).map(t=>({type:'Feature',properties:{id:String(t.id),selected:t.id===selected,nature:'Associação estimada'},geometry:geometry(main.coords,t.coords)}))};}
 function elapsed(main,q){const m=Math.max(0,Math.floor((q.time-main.time)/60000));return m<60?'+'+m+' min':m<1440?'+'+Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':''):'+'+Math.floor(m/1440)+' d '+Math.floor(m%1440/60)+' h';}
 function rows(group,selected,limit=40){const sorted=[...group.children].sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id))),children=sorted.slice(-Math.min(200,limit));const q=sorted.find(q=>q.id===selected);if(q&&!children.includes(q))children.unshift(q);return {items:[group.main,...children],omitted:sorted.length-children.length};}
 function camera(bounds,view){
  const y=lat=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))/Math.PI)/2;
  const [a,b]=bounds,n=y(b[1]),s=y(a[1]),dx=Math.max(1e-7,(b[0]-a[0])/360),dy=Math.max(1e-7,s-n);
  const freeW=Math.max(64,view.right-view.left-40),freeH=Math.max(64,view.bottom-view.top-40);
  const zoom=Math.max(view.minZoom||0,Math.min(8,Math.log2(Math.min(freeW/(512*dx),freeH/(512*dy))))),world=512*2**zoom;
  const cx=(a[0]+b[0]+360)/720+(view.width/2-(view.left+view.right)/2)/world,cy=(n+s)/2+(view.height/2-(view.top+view.bottom)/2)/world;
  return {zoom,center:[((cx*360-180+540)%360)-180,Math.atan(Math.sinh(Math.PI*(1-2*cy)))*180/Math.PI],padding:{top:0,right:0,bottom:0,left:0},bearing:0,pitch:0};
 }
 const api={geometry,links,elapsed,rows,camera};root.AftershockHubModel=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

/* Presentation only: anchored labels, bounded layout work, no model changes. */
(function(root){'use strict';
function distanceKm(a,b){const rad=Math.PI/180,x=(b[1]-a[1])*rad/2,y=(b[0]-a[0])*rad/2,v=Math.sin(x)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(y)**2;return 12742*Math.asin(Math.sqrt(Math.max(0,Math.min(1,v))));}
function info(f,point,c){const p=f.properties,n=p.official?distanceKm([c.lng,c.lat],point):Number(p.distanceKm),distance=Number.isFinite(n)?(n>0&&n<.1?'<0,1':n.toLocaleString('pt-BR',{maximumFractionDigits:1}))+' km':'Distância indisponível';return {heading:'MMI '+p.roman+' · '+p.description,distance:p.official?'Trecho · '+distance+' do epicentro':'Raio · '+distance,official:!!p.official};}
function candidates(f,limit=24){
 const lines=f.geometry.coordinates,result=[],total=lines.reduce((n,line)=>n+line.length,0),count=Math.min(limit,total);
 if(!count)return result;
 // Sample the complete contour, including a single continuous ring. Every
 // option remains an actual published/model vertex, with no invented radius.
 const indices=Array.from({length:count},(_,i)=>Math.floor(i*total/count));let lineIndex=0,start=0;
 for(const index of indices){while(lineIndex<lines.length-1&&index>=start+lines[lineIndex].length)start+=lines[lineIndex++].length;const p=lines[lineIndex][index-start];if(p?.every(Number.isFinite))result.push(p);}
 return result;
}
const overlaps=(a,b,gap=7)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
function place(points,width,height,viewport,blocked){for(const p of points){const box={left:p.x-width/2,right:p.x+width/2,top:p.y-height/2,bottom:p.y+height/2};if(box.left<8||box.right>viewport.width-8||box.top<8||box.bottom>viewport.height-8||blocked.some(b=>overlaps(box,b)))continue;return {point:p,box};}return null;}
function create(map,scene,isVisible){let rows=[],raf=0,timer=0,last=0,observer=null;
 function clear(){observer?.disconnect();observer=null;cancelAnimationFrame(raf);clearTimeout(timer);raf=timer=0;for(const r of rows)r.marker.remove();rows=[];map.off('move',schedule);map.off('resize',schedule);map.off('moveend',schedule);}
 function schedule(){if(raf||timer||!rows.length)return;const wait=Math.max(0,150-(performance.now()-last));if(wait){timer=setTimeout(()=>{timer=0;schedule();},wait);return;}raf=requestAnimationFrame(()=>{raf=0;last=performance.now();layout();});}
 function layout(){const c=scene(),container=map.getContainer(),host=container.getBoundingClientRect(),viewport={width:container.clientWidth,height:container.clientHeight},blocked=[];
  const addBox=r=>{if(r.width>0&&r.height>0)blocked.push({left:r.left-host.left,right:r.right-host.left,top:r.top-host.top,bottom:r.bottom-host.top});};
  for(const el of document.querySelectorAll('#top-strip,#ux-controlbar,#latest-event-ticker,#painel-direito,#sidebar-left,#sequence-hub,#mobile-notice-stack,#map-recovery,.seismic-impact-status,.aftershock-pin:not(.sequence-compact),.event-pin-glass,.seismic-epicenter-detail')){const style=getComputedStyle(el);if(el.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;addBox(el.getBoundingClientRect());}
  if(c){const p=map.project([c.lng,c.lat]);blocked.push({left:p.x-48,right:p.x+48,top:p.y-60,bottom:p.y+24});}
  for(const row of rows){const within=c&&(c.full||row.feature.properties.distanceKm<=c.radius),near=map.getZoom()>=4;if(!c||!isVisible()||!within||!near||document.hidden){row.el.style.visibility='hidden';continue;}
   const order=row.current==null?row.points.map((_,i)=>i):[row.current,...row.points.map((_,i)=>i).filter(i=>i!==row.current)];const measured=row.el.getBoundingClientRect(),width=Math.min(Math.max(measured.width,170),viewport.width*.58),height=Math.max(measured.height,48),options=order.map(i=>{const p=map.project(row.points[i]);return {x:p.x,y:p.y,index:i};}).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
   const fit=place(options,width,height,viewport,blocked);if(!fit){row.el.style.visibility='hidden';continue;}
   const i=fit.point.index;if(row.current!==i){const text=info(row.feature,row.points[i],c);row.subtitle.textContent=text.distance;row.el.setAttribute('aria-label',text.heading+' · '+text.distance);row.marker.setLngLat(row.points[i]);row.current=i;}row.el.style.visibility='visible';blocked.push(fit.box);
  }
 }
 function show(contours){clear();const c=scene();if(!c)return;for(const f of [...contours.features].sort((a,b)=>b.properties.mmi-a.properties.mmi)){const points=candidates(f);if(!points.length)continue;const el=document.createElement('span'),title=document.createElement('strong'),subtitle=document.createElement('span'),text=info(f,points[0],c);el.className='seismic-contour-label';el.style.setProperty('--mmi-tone',f.properties.color);el.style.visibility='hidden';el.dataset.mmi=f.properties.roman;el.dataset.official=String(text.official);title.textContent=text.heading;subtitle.className='seismic-contour-label-distance';subtitle.textContent=text.distance;el.append(title,subtitle);el.title=text.official?'Distância deste trecho do contorno oficial ao epicentro; não é um raio único.':'Raio do contorno estimado; intensidade não confirma danos.';const marker=new root.maplibregl.Marker({element:el,anchor:'center'}).setLngLat(points[0]).addTo(map);rows.push({el,subtitle,marker,points,feature:f,current:null});}map.on('move',schedule);map.on('resize',schedule);map.on('moveend',schedule);observer=new MutationObserver(changes=>{const ui='#mobile-notice-stack,#map-recovery,#painel-direito,#sidebar-left,#sequence-hub,#latest-event-ticker';if(changes.some(change=>change.target===document.body||change.target.closest?.(ui)||[...change.addedNodes,...change.removedNodes].some(node=>node.matches?.(ui)||node.querySelector?.(ui))))schedule();});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});schedule();}
 return {show,clear,schedule};
}
const api={distanceKm,info,candidates,place,create};root.SeismicContourLabels=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

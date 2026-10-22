/* Frame the actual painted land, epicenter and associated catalog events. */
(function(){
 let cached=null,blocked=null,lastId=null,lastFit=null;
 function frame(c){
  const bounds=window.SeismicImpact?.bounds(c.id),points=window.SeismicScenarioDemo?.framePoints(c.id)||window.AftershockSequence?.framePoints(c.id)||null;
  const key=[c.id,c.lng,c.lat,c.mag,c.depth,innerWidth,innerHeight,map.getProjection()?.type].join('|');
  // Fit from scratch on layout changes; never derive the target from current zoom.
  const layout=typeof getEventoTelaFrac==='function'?JSON.stringify(getEventoTelaFrac()):'';
  if(cached?.key===key&&cached.bounds===bounds&&cached.points===points&&cached.layout===layout)return cached.camera;
  let camera;
  if(bounds){
   let [w,s,e,n]=bounds;const unwrap=x=>c.lng+((x-c.lng+540)%360)-180;
   const include=([x,y])=>{x=unwrap(x);w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);};include([c.lng,c.lat]);for(const p of points||[])include(p);
   // Fit symmetrically about the epicenter; an asymmetric published grid must
   // not drag the epicenter away while the camera opens.
   const dx=Math.max(c.lng-w,e-c.lng),y=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360)),cy=y(c.lat),dy=Math.max(cy-y(s),y(n)-cy),inv=v=>(2*Math.atan(Math.exp(v))-Math.PI/2)*180/Math.PI;
   const zoom=zoomParaAreaPintada(c.lng,c.lat,1,[c.lng-dx,inv(cy-dy),c.lng+dx,inv(cy+dy)]);camera={zoom,center:centroCompensado(c.lng,c.lat,zoom),bounds:[w,s,e,n]};
  }else{const zoom=zoomParaAreaPintada(c.lng,c.lat,Math.max(10,SeismicImpactModel.extent(c.mag,c.depth,2.1)));camera={zoom,center:centroCompensado(c.lng,c.lat,zoom)};}
  camera.anchor=[c.lng,c.lat];cached={key,bounds,points,layout,camera};return camera;
 }
 function ready(c){
  if(window.SeismicPaintTour?.owns(c.id)){window.SeismicPaintTour.ready(c);return;}
  const wave=window.__mgWaveFrontState;
  // Active propagation owns the camera; a settled final frame can fit new evidence.
  const waveOwnsCamera=wave?.id===c.id&&(wave.stage!=='returning'||Date.now()<wave.phaseUntil-10000);
  if(window.SeismicScenarioDemo?.isActive()||document.hidden||blocked===c.id||typeof eventoSelecionadoId==='undefined'||eventoSelecionadoId!==c.id||window.TsunamiMap?.isPreview()||waveOwnsCamera||window.TsunamiPresentation?.ownsCamera(c.id))return;
  const camera=frame(c),signature=[c.id,...camera.center,camera.zoom].join('|');
  if(signature===lastFit)return;lastFit=signature;
  const center=map.getCenter();
  if(Math.abs(map.getZoom()-camera.zoom)<.005&&Math.abs(((center.lng-camera.center[0]+540)%360)-180)<.00001&&Math.abs(center.lat-camera.center[1])<.00001)return;
  map.easeTo({...camera,padding:{top:0,right:0,bottom:0,left:0},bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:3500,essential:true});
 }
 window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId){lastId=p.id;blocked=null;cached=null;lastFit=null;}});
 function install(){if(typeof map==='undefined'||!map)return;for(const event of ['dragstart','wheel','touchstart'])map.on(event,e=>{if(e?.originalEvent)blocked=typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;});}
 if(typeof map!=='undefined'&&map)install();else window.addEventListener('load',install,{once:true});
 document.addEventListener('click',e=>{if(e.target.closest?.('#pd-focus-btn')){blocked=null;cached=null;lastFit=null;}},true);
 function epicenter(c,zoom){return {center:centroCompensado(c.lng,c.lat,zoom),zoom,anchor:[c.lng,c.lat]};}
 function padding(point){
  const box=map.getContainer(),frac=getEventoTelaFrac(),p=point||{x:box.clientWidth*frac.x,y:box.clientHeight*frac.y};
  return {left:Math.max(0,2*p.x-box.clientWidth),right:Math.max(0,box.clientWidth-2*p.x),top:Math.max(0,2*p.y-box.clientHeight),bottom:Math.max(0,box.clientHeight-2*p.y)};
 }
 function move(c,camera,duration,preservePoint=false){
  const p=preservePoint?map.project([c.lng,c.lat]):null,box=map.getContainer(),valid=p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=box.clientWidth&&p.y>=0&&p.y<=box.clientHeight;
  const optical=padding(valid?p:null);
  map.stop();map.easeTo({center:[c.lng,c.lat],zoom:camera.zoom,padding:optical,bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:duration,essential:true,easing:t=>t*t*(3-2*t)});
 }
 window.SeismicFocus={frame,ready,epicenter,move,padding,pause(){blocked=typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;}};
})();

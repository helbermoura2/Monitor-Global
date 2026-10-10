/* Frame the actual painted land, epicenter and associated catalog events. */
(function(){
 let cached=null,blocked=null,lastId=null,lastFit=null;
 function frame(c){
  const bounds=window.SeismicImpact?.bounds(c.id),points=window.AftershockSequence?.framePoints(c.id)||null;
  const key=[c.id,c.lng,c.lat,c.mag,c.depth,innerWidth,innerHeight].join('|');
  // Fit from scratch on layout changes; never derive the target from current zoom.
  const layout=typeof getEventoTelaFrac==='function'?JSON.stringify(getEventoTelaFrac()):'';
  if(cached?.key===key&&cached.bounds===bounds&&cached.points===points&&cached.layout===layout)return cached.camera;
  let camera;
  if(bounds){
   let [w,s,e,n]=bounds;const unwrap=x=>c.lng+((x-c.lng+540)%360)-180;
   const include=([x,y])=>{x=unwrap(x);w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);};include([c.lng,c.lat]);for(const p of points||[])include(p);
   const fit=map.cameraForBounds([[w,s],[e,n]],{padding:0,bearing:0,maxZoom:15}),lng=fit.center.lng,lat=fit.center.lat;
   const zoom=zoomParaAreaPintada(lng,lat,1,[w,s,e,n]);camera={zoom,center:centroCompensado(lng,lat,zoom),bounds:[w,s,e,n]};
  }else{const zoom=zoomParaAreaPintada(c.lng,c.lat,Math.max(10,SeismicImpactModel.extent(c.mag,c.depth,2.1)));camera={zoom,center:centroCompensado(c.lng,c.lat,zoom)};}
  cached={key,bounds,points,layout,camera};return camera;
 }
 function ready(c){if(document.hidden||blocked===c.id||typeof eventoSelecionadoId==='undefined'||eventoSelecionadoId!==c.id||window.TsunamiMap?.isPreview()||window.__mgWaveFrontState?.id===c.id||window.TsunamiPresentation?.ownsCamera(c.id))return;const camera=frame(c),signature=[c.id,...camera.center,camera.zoom].join('|');if(signature===lastFit)return;lastFit=signature;map.easeTo({...camera,padding:0,bearing:0,pitch:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:3500,essential:true});}
 window.EventStore?.subscribe((reason,p)=>{if(reason==='select'&&p.id!==lastId){lastId=p.id;blocked=null;cached=null;lastFit=null;}});
 function install(){if(typeof map==='undefined'||!map)return;for(const event of ['dragstart','wheel','touchstart'])map.on(event,e=>{if(e?.originalEvent)blocked=typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;});}
 if(typeof map!=='undefined'&&map)install();else window.addEventListener('load',install,{once:true});
 document.addEventListener('click',e=>{if(e.target.closest?.('#pd-focus-btn')){blocked=null;cached=null;lastFit=null;}},true);
 window.SeismicFocus={frame,ready};
})();

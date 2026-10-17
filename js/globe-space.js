/* Decorative stars only: no astronomy download or map input handlers. */
(function(){'use strict';
 let canvas,ctx,timer,frame,epoch=0,lastDraw=0,active=false;
 const stars=[];let seed=71837;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<650;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-z*z);stars.push({direction:[r*Math.cos(a),r*Math.sin(a),z],size:rand()<.07?1.25:.35+rand()*.6,alpha:.25+rand()*.55});}
 function stop(){active=false;clearInterval(timer);cancelAnimationFrame(frame);frame=null;map?.off('render',schedule);canvas?.remove();canvas=ctx=null;epoch=0;lastDraw=0;}
 function start(){
  stop();active=true;
  canvas=document.createElement('canvas');canvas.id='globe-space-canvas';canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');map.getContainer().append(canvas);
  map.on('render',schedule);timer=setInterval(schedule,1000);schedule();
 }
 function schedule(){if(!active||!ctx||document.hidden||frame)return;frame=requestAnimationFrame(draw);}
 function draw(now){
  frame=null;if(!active||!canvas||document.hidden)return;
  if(now-lastDraw<45)return;lastDraw=now;
  const w=map.getContainer().clientWidth,h=map.getContainer().clientHeight,dpr=Math.min(devicePixelRatio||1,1.5),zoom=map.getZoom();
  const alpha=Math.max(0,Math.min(1,(3.6-zoom)/1.1));canvas.style.opacity=alpha;
  if(!alpha||map.getPitch()>5){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  epoch=Date.now();
  const sidereal=GlobeSpaceModel.siderealTime(epoch),center=map.getCenter(),pixel=map.project(center),s=GlobeSpaceModel.sphere(zoom,center.lat,h,map.getVerticalFieldOfView());
  const view={...s,x:pixel.x,y:pixel.y,lng:center.lng,lat:center.lat,bearing:map.getBearing()};
  // Sparse, deterministic decorative stars, anchored in the equatorial frame.
  for(const star of stars.slice(0,w<600?350:650)){
   const p=GlobeSpaceModel.project(star.direction,sidereal,view,6);if(!p||p.x<0||p.x>w||p.y<0||p.y>h||Math.hypot(p.x-view.x,p.y-view.y)<s.radius+6)continue;
   ctx.fillStyle=`rgba(210,230,255,${star.alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,star.size,0,Math.PI*2);ctx.fill();
  }
  const mr=map.getContainer().getBoundingClientRect(),blocked=[];
  for(const id of ['top-strip','latest-event-ticker','sidebar-left','painel-direito','globe-preview-status','globe-space-note','mobile-notice-stack']){
   const el=document.getElementById(id);if(!el)continue;const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')continue;const b=el.getBoundingClientRect();if(b.width&&b.height)blocked.push({x:b.left-mr.left,y:b.top-mr.top,w:b.width,h:b.height});
  }
  // Space stays outside the Earth; never cover satellite tiles or seismic painting.
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(view.x,view.y,s.radius+3,0,Math.PI*2);ctx.fill();for(const b of blocked)ctx.clearRect(b.x-2,b.y-2,b.w+4,b.h+4);ctx.restore();

  canvas.dataset.epoch=String(epoch);canvas.dataset.bodies='';
 }
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted&&window.GlobePreview?.state().testing)start();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 window.GlobeSpace={start,stop,state:()=>({active,epoch,bodies:[]})};
})();

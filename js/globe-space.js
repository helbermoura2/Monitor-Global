/* Lightweight celestial overlay: no network ephemerides, no map input handlers. */
(function(){'use strict';
 let canvas,ctx,note,timer,frame,loading,data,lastDraw=0,active=false,generation=0;
 const stars=[];let seed=71837;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<650;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-z*z);stars.push({direction:[r*Math.cos(a),r*Math.sin(a),z],size:rand()<.07?1.25:.35+rand()*.6,alpha:.25+rand()*.55});}
 function load(){return loading||(loading=new Promise((resolve,reject)=>{
  if(window.Astronomy){resolve();return;}
  const script=document.createElement('script');script.src='vendor/astronomy-engine-2.1.19.min.js';script.onload=resolve;script.onerror=()=>{script.remove();loading=null;reject(Error('Cálculo celeste indisponível'));};document.head.append(script);
 }));}
 function stop(){active=false;generation++;clearInterval(timer);cancelAnimationFrame(frame);frame=null;map?.off('render',schedule);canvas?.remove();note?.remove();canvas=ctx=note=null;data=null;}
 async function start(){
  stop();active=true;const token=generation;
  try{await load();}catch(_){return;}
  if(!active||token!==generation)return;
  canvas=document.createElement('canvas');canvas.id='globe-space-canvas';canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');map.getContainer().append(canvas);
  note=document.createElement('small');note.id='globe-space-note';(document.getElementById('globe-preview-status')||document.body).append(note);
  map.on('render',schedule);timer=setInterval(schedule,1000);schedule();
 }
 function schedule(){if(!active||!ctx||document.hidden||frame)return;frame=requestAnimationFrame(draw);}
 function disc(x,y,r,color,kind,phase=1,sunAngle=0){
  ctx.save();ctx.translate(x,y);
  if(kind==='Sun'){
   const g=ctx.createRadialGradient(0,0,r*.5,0,0,r*3.8);g.addColorStop(0,'#ffd78caa');g.addColorStop(.32,'#ffb63b4a');g.addColorStop(1,'#ff9a2000');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*3.8,0,Math.PI*2);ctx.fill();
  }
  if(kind==='Saturn'){ctx.save();ctx.rotate(-.35);ctx.strokeStyle='#bba779a8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,r*1.85,r*.58,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  const g=ctx.createRadialGradient(-r*.35,-r*.4,0,0,0,r*1.25);g.addColorStop(0,kind==='Sun'?'#fff4c8':color);g.addColorStop(.5,color);g.addColorStop(1,kind==='Sun'?'#e78b20':'#14202e');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  if(kind==='Moon'){
   ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
   ctx.fillStyle='#57647155';for(const [a,b,s]of [[-.4,-.22,.19],[.3,.25,.24],[.05,-.5,.13],[-.23,.5,.1]]){ctx.beginPath();ctx.arc(a*r,b*r,s*r,0,Math.PI*2);ctx.fill();}
   // Phase is the illuminated fraction. Rotate the terminator toward the Sun.
   ctx.rotate(sunAngle);const k=2*phase-1;ctx.fillStyle='#06101de8';ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2,true);ctx.ellipse(0,0,Math.abs(k)*r,r,0,Math.PI/2,Math.PI*1.5,k<0);ctx.closePath();ctx.fill();ctx.restore();
  }
  if(kind==='Jupiter'){ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#8c684344';for(const y of [-.45,.1,.45])ctx.fillRect(-r,y*r,r*2,r*.15);ctx.restore();}
  ctx.restore();
 }
 function draw(now){
  frame=null;if(!active||!canvas||document.hidden)return;
  if(now-lastDraw<45)return;lastDraw=now;
  const w=map.getContainer().clientWidth,h=map.getContainer().clientHeight,dpr=Math.min(devicePixelRatio||1,1.5),zoom=map.getZoom();
  const alpha=Math.max(0,Math.min(1,(3.6-zoom)/1.1));canvas.style.opacity=alpha;note.hidden=alpha<.2||map.getPitch()>5;
  if(!alpha||map.getPitch()>5){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const epoch=Date.now();if(!data||Math.abs(epoch-data.epoch)>=60000)data=GlobeSpaceModel.ephemeris(Astronomy,epoch);
  const sidereal=Astronomy.SiderealTime(new Date(epoch)),center=map.getCenter(),pixel=map.project(center),s=GlobeSpaceModel.sphere(zoom,center.lat,h,map.getVerticalFieldOfView());
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
  const labels=[],visible=[],sun=data.bodies.find(b=>b.id==='Sun'),sunPoint=GlobeSpaceModel.project(sun.direction,sidereal,view);
  for(const body of data.bodies){
   const p=GlobeSpaceModel.project(body.direction,sidereal,view),r=body.size*(w<600?.85:1);
   if(!p||p.x<r+4||p.x>w-r-4||p.y<r+4||p.y>h-r-4||Math.hypot(p.x-view.x,p.y-view.y)<s.radius+r+8)continue;
   const extent=r*(body.id==='Saturn'?2:1)+4;
   if(blocked.some(b=>p.x+extent>b.x&&p.x-extent<b.x+b.w&&p.y+extent>b.y&&p.y-extent<b.y+b.h))continue;
   disc(p.x,p.y,r,body.color,body.id,body.phase,sunPoint?Math.atan2(sunPoint.y-p.y,sunPoint.x-p.x):0);visible.push({id:body.id,x:p.x,y:p.y});
   const box={x:p.x-r-3,y:p.y+r+5,w:Math.max(35,body.name.length*7),h:15};
   if(box.x+box.w<w-8&&box.y+15<h&&!blocked.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y)&&!labels.some(b=>Math.abs(b.x-box.x)<Math.max(b.w,box.w)&&Math.abs(b.y-box.y)<18)){
    ctx.font='11px Arial';ctx.lineWidth=3;ctx.strokeStyle='#030b17';ctx.strokeText(body.name,box.x,box.y+11);ctx.fillStyle='#d4e3ef';ctx.fillText(body.name,box.x,box.y+11);labels.push(box);
   }
  }
  // Space stays outside the Earth; never cover satellite tiles or seismic painting.
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(view.x,view.y,s.radius+3,0,Math.PI*2);ctx.fill();for(const b of blocked)ctx.clearRect(b.x-2,b.y-2,b.w+4,b.h+4);ctx.restore();
  note.textContent='Céu · '+new Date(epoch).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' BRT · direções calculadas; escala ilustrativa';
  canvas.dataset.epoch=String(epoch);canvas.dataset.bodies=visible.map(b=>b.id).join(',');
 }
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted&&window.GlobePreview?.state().testing)start();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 window.GlobeSpace={start,stop,state:()=>({active,epoch:data?.epoch||null,bodies:data?.bodies.map(b=>({id:b.id,phase:b.phase,direction:b.direction}))||[]})};
})();

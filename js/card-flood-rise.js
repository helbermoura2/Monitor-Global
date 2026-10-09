/* One rising flood surface, using the existing native footage behind real text.
   Decorative buoyancy shares the scene clock; no copied frames or extra timers. */
(function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function level(t){const p=clamp((t-.4)/10,0,1);return 1.035-.97*(p*p*(3-2*p));}
 function create(cfg,mobile,panel,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material pd-flood-rise-contact';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return null;
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses';lensLayer.setAttribute('aria-hidden','true');
  const background=document.createElement('canvas');background.className='pd-flood-reserve';background.setAttribute('aria-hidden','true');const reserve=background.getContext('2d');
  let w=1,h=1,groups=[],measureAt=-1,dead=false;const states=new WeakMap();
  const debris=Array.from({length:mobile?14:24},(_,i)=>({x:Math.random(),y:Math.random(),size:3+Math.random()*7,phase:i*2.399}));
  detail.track(debris);
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,1.35)*detail.resolution;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);background.width=Math.max(1,Math.round(w*.5*detail.resolution));background.height=Math.max(1,Math.round(h*.5*detail.resolution));measureAt=-1;}
  function measure(t){
   if(t<measureAt)return;measureAt=t+.7;for(const g of groups)for(const l of g.letters)l.el.style.removeProperty('transform');
   const pr=panel.getBoundingClientRect(),sy=h/Math.max(1,pr.height),sx=w/Math.max(1,pr.width);
   groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{const r=el.getBoundingClientRect();return {el,title:el.id==='pd-local',y:(r.top-pr.top+r.height*.5)*sy/h,letters:Array.from(el.querySelectorAll('.pd-fx-windletter'),span=>{let s=states.get(span);if(!s){s={el:span,x:0,y:0,r:0,vx:0,vy:0,vr:0};states.set(span,s);}const rr=span.getBoundingClientRect();s.left=Math.max(0,(rr.left-pr.left)*sx-6);s.right=Math.max(0,w-6-(rr.right-pr.left)*sx);return s;})};});
  }
  function spring(s,k,v,target,dt){s[v]+=((target-s[k])*48-s[v]*11)*dt;s[k]+=s[v]*dt;}
  function draw(t,dt,envelope,current={}){
   if(dead)return;measure(t);const top=level(t),recovery=1-clamp((t-14)/1.6,0,1),host=background.parentElement;
   const points=[];for(let i=0;i<=24;i++){const x=i/24,y=top+(.006*Math.sin(x*14-t*2.2)+.003*Math.sin(x*37+t*3))*Math.min(1,t);points.push((x*100).toFixed(2)+'% '+(y*100).toFixed(3)+'%');}
   if(host)host.style.clipPath='polygon('+points.join(',')+',100% 100%,0% 100%)';
   panel.style.setProperty('--pd-water-top',(top*100).toFixed(3)+'%');
   for(const g of groups){const wet=clamp((g.y-top+.015)/.07,0,1)*recovery;g.el.classList.toggle('pd-water-submerged',wet>.05);g.letters.forEach((s,i)=>{const phase=i*.68+g.y*8,amp=wet*(g.title?1:.48),ripple=Math.sin(t*2.8-phase);
    spring(s,'x','vx',clamp((16+Math.sin(t*.85+phase)*12+ripple*3)*amp,-s.left,s.right),dt);
    spring(s,'y','vy',(-7+Math.cos(t*2.3-phase)*7)*amp,dt);spring(s,'r','vr',(ripple*14+Math.sin(t+phase)*4)*amp,dt);
    if(amp>0||Math.abs(s.x)+Math.abs(s.y)+Math.abs(s.r)>.05)s.el.style.transform='translate3d('+s.x.toFixed(2)+'px,'+s.y.toFixed(2)+'px,0) rotate('+s.r.toFixed(2)+'deg)';else s.el.style.removeProperty('transform');
   });}
   background.style.display=current.fallback?'block':'none';
   if(current.fallback&&reserve){const bw=background.width,bh=background.height,g=reserve.createLinearGradient(0,0,0,bh);g.addColorStop(0,'#6f7560');g.addColorStop(.45,'#4d5949');g.addColorStop(1,'#273e38');reserve.fillStyle=g;reserve.fillRect(0,0,bw,bh);for(let i=0;i<160;i++){const x=((i*.618+t*.12)%1)*bw,y=((i*.381+t*.043)%1)*bh;reserve.strokeStyle=i%3?'rgba(175,173,133,.18)':'rgba(26,43,32,.24)';reserve.lineWidth=1+i%3;reserve.beginPath();reserve.ellipse(x,y,8+i%13,1.5,Math.sin(t+i)*.15,0,Math.PI*2);reserve.stroke();}}
   ctx.clearRect(0,0,w,h);ctx.globalAlpha=envelope;
   // A broken meniscus, thin glints and floating fragments, never a second sea.
   for(let i=0;i<72;i++){const x=((i*.618+t*.032)%1)*w,y=(top+.006*Math.sin(x/w*14-t*2.2)+.003*Math.sin(x/w*37+t*3))*h;if(y<0||y>h)continue;ctx.strokeStyle='rgba(213,218,181,'+(.12+(i%5)*.035)+')';ctx.lineWidth=.55+i%3*.28;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+3,y-1.5,x+6+i%5,y+.8);ctx.stroke();}
   for(const p of debris){p.x+=dt*(.045+.025*Math.sin(t+p.phase));if(p.x>1.08)p.x=-.08;const y=(top+(1-top)*p.y)*h;if(y>h)continue;ctx.save();ctx.translate(p.x*w,y);ctx.rotate(Math.sin(t*1.4+p.phase)*.35);ctx.fillStyle='rgba(175,159,115,.38)';ctx.fillRect(-p.size*.5,0,p.size,1.3);ctx.strokeStyle='rgba(215,218,185,.14)';ctx.beginPath();ctx.moveTo(-p.size-4,3);ctx.quadraticCurveTo(-2,4,p.size*.5,2.5);ctx.stroke();ctx.restore();}ctx.globalAlpha=1;
  }
  function destroy(){dead=true;for(const g of groups){g.el.classList.remove('pd-water-submerged');for(const s of g.letters)s.el.style.removeProperty('transform');}canvas.remove();background.remove();lensLayer.remove();groups=[];}
  return {canvas,lensLayer,background,resize,draw,destroy};
 }
 window.CardFloodRise={create,level};
})();

/* Passive illustration on original glyphs and words. The cinematic clock owns
   every reaction; event data, layout slots, controls and accessibility stay intact. */
(function(){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),rand=(a,b)=>a+Math.random()*(b-a),ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
 function mode(cfg){return cfg.type==='volcano'?(cfg.lava?'lava':cfg.ash?'ash':'monitoring'):cfg.type==='hurricane'?(cfg.cycloneStage==='mature'?'cyclone':'tropical'):cfg.type;}
 function create(cfg,mobile,panel){
  if(cfg.type==='wind')return null;
  const canvas=document.createElement('canvas');canvas.className='pd-letter-fragments';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return null;
  let w=1,h=1,groups=[],nextMeasure=-1,dead=false,currentMode=mode(cfg);const memory=new WeakMap(),touched=new Set(),fragments=[];
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);nextMeasure=-1;}
  function measure(t){
   if(t<nextMeasure)return;nextMeasure=t+.55;
   for(const el of touched)el.style.removeProperty('transform');
   const pr=panel.getBoundingClientRect(),sx=w/Math.max(pr.width,1),sy=h/Math.max(pr.height,1);
   groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{
    const nodes=Array.from(el.querySelectorAll(currentMode==='tsunami'?'.pd-fx-windword':'.pd-fx-windletter'));
    const items=nodes.map(node=>{let s=memory.get(node);if(!s){s={el:node,ticket:Math.random(),phase:rand(0,6.28),spin:rand(-1,1),at:null};memory.set(node,s);}const r=node.getBoundingClientRect();s.x=(r.left-pr.left)*sx;s.y=(r.top-pr.top)*sy;s.width=r.width*sx;s.height=r.height*sy;return s;});
    const chosen=items.slice().sort((a,b)=>a.ticket-b.ticket).slice(0,Math.max(1,Math.floor(items.length*(currentMode==='tsunami'?.35:el.id==='pd-local'?.34:.20))));
    for(const s of items)s.chosen=chosen.includes(s);
    return {el,title:el.id==='pd-local',items};
   });
  }
  function scatter(s,t,burning){
   const count=mobile?7:12;for(let i=0;i<count&&fragments.length<(mobile?130:220);i++)fragments.push({x:s.x+rand(0,s.width),y:s.y+rand(0,s.height),at:t,ttl:rand(.7,1.8),vx:rand(12,75),vy:burning?rand(-65,-18):rand(-20,35),r:rand(.5,1.7),burning});
  }
  function draw(t,dt,envelope,signals={}){
   if(dead)return;currentMode=mode(signals.cfg||cfg);measure(t);ctx.clearRect(0,0,w,h);
   for(const g of groups)for(const s of g.items){
    const m=currentMode,y=clamp(s.y/h,0,1),p=s.phase;let x=0,dy=0,rotation=0,opacity=1,scale=1,reaction='';
    if(m==='monitoring'){
     // Quiet monitoring keeps full text; no fictional ash, lava or damage.
     dy=Math.sin(t*1.2+p)*.65;reaction='monitoring';
    }else if(m==='storm'){
     const wet=ease((t-1-y)/2);x=Math.sin(t*3+p)*wet*1.2;dy=(2+Math.sin(t*2+p))*wet*2;rotation=Math.sin(t*2+p)*wet*3;reaction='rain-heavy';
     if(s.chosen&&t>3+y*2+s.ticket){s.at??=t;const age=t-s.at;x=age*22;dy=age*age*(h*.20+20);rotation=s.spin*age*24;opacity=age>3.2?0:1;reaction='rain-slide';}
     s.el.style.textShadow=signals.flash>.03?'0 0 7px rgba(235,247,255,.95)':'';
    }else if(m==='cyclone'||m==='tropical'||m==='tornado'){
     if(s.chosen&&t>1.7+y*.8+s.ticket*1.2){s.at??=t;const age=t-s.at,orbit=age*(m==='tornado'?7.5:4.2)*(m==='cyclone'?(signals.cfg?.rotationDirection||cfg.rotationDirection||1):1),radius=(m==='tornado'?18:10)+age*(m==='tornado'?42:28);
      x=Math.sin(orbit+p)*radius+age*(m==='tropical'?w*.72+50:34);dy=m==='tropical'?age*age*20-Math.sin(orbit)*8:-age*(m==='tornado'?h*.6+120:h*.45+60)+Math.cos(orbit+p)*radius*.38;
      rotation=s.spin*age*(m==='tornado'?300:160);scale=m==='tornado'?Math.max(.3,1-age*.18):1;opacity=age>(m==='tornado'?2.2:3)?0:1;reaction=m==='tropical'?'squall-slip':m==='tornado'?'vortex-lift':'spiral-flight';
     }else continue;
    }else if(m==='tsunami'){
     const front=window.CardTsunamiSurge?.front(t,clamp(s.x/w,0,1))??.5;
     if(s.chosen&&(Math.abs(y-front)<.15||t>4+y)){s.at??=t;}
     if(s.at===null)continue;const age=t-s.at;
     // The complete original word tumbles as a unit when the bore reaches it.
     for(const child of s.el.querySelectorAll('.pd-fx-windletter')){child.style.removeProperty('transform');touched.add(child);}
     x=age*age*35+Math.sin(age*3+p)*age*8;dy=age*95+Math.sin(age*4+p)*8;rotation=s.spin*age*50;opacity=age>3.5?0:1;reaction='word-wash';
    }else if(m==='flood'){
     const top=signals.waterTop??1;if(s.chosen&&y>top+.025){s.at??=t;}
     if(s.at===null)continue;const age=t-s.at;
     x=age*17+Math.sin(t*2+p)*5;dy=-(y-top)*h*.30+Math.sin(t*2.6+p)*7;rotation=Math.sin(t*1.5+p)*18;
     if(s.ticket<.18&&age>2.5){dy+=(age-2.5)*70;opacity=1-ease((age-2.5)/1.5);reaction='sunken';}else reaction='floating';
    }else if(m==='fire'||m==='lava'||m==='ash'){
     const heat=ease((t-.6)/2);x=Math.sin(t*3+p)*heat*(m==='ash'?1.2:2);dy=Math.sin(t*2.2+p)*heat*1.8;rotation=Math.sin(t*1.7+p)*heat*2;
     reaction=m==='ash'?'ash-cover':'heat-haze';
     if(s.chosen&&t>2.8+y*2+s.ticket*2){if(s.at===null){s.at=t;scatter(s,t,m!=='ash');}const age=t-s.at,progress=ease(age/2);
      const edge=Array.from({length:9},(_,j)=>(j*12.5)+'% '+clamp(progress*100+Math.sin(p+j*2.3)*Math.sin(progress*Math.PI)*12,0,100).toFixed(1)+'%');s.el.style.clipPath='polygon('+edge.join(',')+',100% 100%,0 100%)';
      s.el.style.filter=m==='ash'?'grayscale(1) brightness('+(.8-progress*.5).toFixed(2)+')':'brightness('+(1-progress*.8).toFixed(2)+') sepia('+progress.toFixed(2)+')';
      s.el.style.textShadow=m==='ash'?'0 -1px 2px #a6a79d':'0 -1px 3px #ff7918,0 1px 6px rgba(255,88,9,.65)';
      dy-=age*(m==='ash'?12:3);x+=age*(m==='ash'?12:2);opacity=age>=2?0:1;reaction=m==='ash'?'ash-break':m==='lava'?'ember-break':'charred';
     }
    }else if(m==='earthquake'){
     const impact=Math.exp(-t*.30),arrival=y*.3;dy=Math.sin((t-arrival)*32+p)*impact*3;x=Math.cos((t-arrival)*27+p)*impact*2;rotation=Math.sin(t*19+p)*impact*3;reaction='seismic-shift';
     if(s.chosen&&t>1.2+y*1.3+s.ticket){s.at??=t;const age=t-s.at;dy=age*age*65;x=age*s.spin*14;rotation=age*s.spin*70;opacity=s.y+dy>h+40?0:1;reaction='fallen';}
    }
    touched.add(s.el);s.el.dataset.eventReaction=reaction;s.el.style.opacity=String(opacity);s.el.style.transform='translate3d('+x.toFixed(2)+'px,'+dy.toFixed(2)+'px,0) rotate('+rotation.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
   }
   for(let i=fragments.length-1;i>=0;i--){const f=fragments[i],age=t-f.at;if(age>=f.ttl){fragments.splice(i,1);continue;}const x=f.x+f.vx*age,y=f.y+f.vy*age+(f.burning?-4:16)*age*age;ctx.globalAlpha=(1-age/f.ttl)*envelope;
    if(f.burning){ctx.shadowBlur=5;ctx.shadowColor='#ff792d';ctx.fillStyle='#fbb66c';}else{ctx.shadowBlur=0;ctx.fillStyle='#a9a99c';}ctx.fillRect(x,y,f.r*(f.burning?1:2),f.r);}
   ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  function destroy(){dead=true;for(const el of touched){for(const key of ['transform','opacity','filter','clip-path','text-shadow'])el.style.removeProperty(key);delete el.dataset.eventReaction;}canvas.remove();groups=[];touched.clear();fragments.length=0;}
  return {canvas,resize,draw,destroy};
 }
 window.CardEventTypography={create,mode};
})();

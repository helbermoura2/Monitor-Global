/* One near-camera gale field. The wind carries matter; it is never drawn as lines.
   Shared pressure drives vegetation grading, card load and the original glyphs. */
(function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a);
 const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 function pressure(t,x=0){
  // Uneven attacks, sustained load and longer decays; successive fronts differ.
  const delayed=Math.max(0,t-x*.32),cycle=Math.floor(delayed/11.8),phase=delayed%11.8;
  const peak=.86+.12*Math.sin(cycle*2.17+1.1),second=.58+.12*Math.sin(cycle*1.73+2.4);
  const front=(start,hold,end)=>ease((phase-start)/.75)*(1-ease((phase-hold)/(end-hold)));
  const load=front(.4,2.1,4.8)*peak+front(6.4,7.7,10.7)*second;
  return clamp(.105+load*(1+.06*Math.sin(t*7.1-x*3)+.025*Math.sin(t*13.7+x*5)),.075,1);
 }
 function leafTexture(kind,blur){
  const c=document.createElement('canvas');c.width=96;c.height=72;const g=c.getContext('2d');
  const body=new Path2D();body.moveTo(9,40);body.bezierCurveTo(23,28,21,7,44,10);body.lineTo(50,15);body.lineTo(59,11);body.bezierCurveTo(62,23,75,16,86,32);body.lineTo(78,38);body.lineTo(82,43);body.bezierCurveTo(63,51,51,66,35,57);body.lineTo(32,49);body.lineTo(23,52);body.closePath();
  const shade=g.createLinearGradient(14,10,70,61);shade.addColorStop(0,kind%2?'#8d7953':'#797445');shade.addColorStop(.43,'#625536');shade.addColorStop(.49,'#a09164');shade.addColorStop(.56,'#493e29');shade.addColorStop(1,'#302d20');
  g.fillStyle=shade;g.fill(body);g.save();g.clip(body);
  // Uneven translucent mottling and a folded ridge, not a flat leaf icon.
  for(let i=0;i<340;i++){g.fillStyle=i%3?'rgba(25,23,16,.15)':'rgba(199,181,119,.21)';g.fillRect(rand(8,88),rand(8,64),rand(.5,2),rand(.4,1.4));}
  g.strokeStyle='rgba(214,194,140,.38)';g.lineWidth=.8;g.beginPath();g.moveTo(11,41);g.bezierCurveTo(35,35,64,38,84,32);g.stroke();
  for(let j=0;j<6;j++){const x=25+j*8;g.strokeStyle='rgba(42,34,21,.4)';g.lineWidth=.6;g.beginPath();g.moveTo(x,38);g.lineTo(x+7,17+j*2);g.moveTo(x,38);g.lineTo(x+10,56-j);g.stroke();}g.restore();
  if(!blur)return c;
  const out=document.createElement('canvas');out.width=96;out.height=72;const b=out.getContext('2d');b.filter='blur('+blur+'px)';b.drawImage(c,0,0);c.width=c.height=1;return out;
 }
 function create(cfg,mobile,panel,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  if(cfg.type!=='wind')return null;
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material pd-gale-field';canvas.setAttribute('aria-hidden','true');canvas.dataset.material='inertial-debris';
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses';lensLayer.setAttribute('aria-hidden','true');
  const leaves=Array.from({length:mobile?17:27},(_,i)=>({x:rand(-.25,1.1),y:rand(-.1,1.1),z:rand(.18,1),vx:0,vy:0,angle:rand(0,TAU),spin:rand(-4,4),phase:rand(0,TAU),kind:i%3,size:rand(11,24)}));
  detail.track(leaves);
  const grains=Array.from({length:mobile?105:175},()=>({x:rand(-.1,1.1),y:Math.random(),z:rand(.05,1),vx:0,vy:0,phase:rand(0,TAU)}));
  detail.track(grains);
  const sprites=Array.from({length:3},(_,i)=>[leafTexture(i,0),leafTexture(i,1.7)]);
  let w=1,h=1,dead=false,measureAt=-1,groups=[],travel=0,drag=0,velocity=0,roll=0,rollVelocity=0;
  const strength=.72+.28*cfg.strength,letterDynamics=new WeakMap();
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35)*detail.resolution;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);measureAt=-1;}
  function measure(t){
   if(t<measureAt)return;measureAt=t+.6;
   // Clear only our glyph transforms to measure their original, current layout.
   for(const g of groups)for(const {el} of g.letters)el.style.removeProperty('transform');
   const bounds=panel.getBoundingClientRect();
   groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{
    const rect=el.getBoundingClientRect(),title=el.id==='pd-local';
    const letters=Array.from(el.querySelectorAll('.pd-fx-windletter'),span=>{const r=span.getBoundingClientRect();let l=letterDynamics.get(span);if(!l){l={el:span,x:0,vx:0,y:0,vy:0,roll:0,vr:0,ticket:Math.random(),selected:false,launch:null};letterDynamics.set(span,l);}l.room=Math.max(0,w-15-(r.right-bounds.left));return l;});
    const chosen=letters.slice().sort((a,b)=>a.ticket-b.ticket).slice(0,Math.max(1,Math.floor(letters.length*(title?.33:.20))));for(const l of letters)l.selected=chosen.includes(l);
    return {el,title,offset:clamp((rect.top-bounds.top)/h,0,1),letters};
   });
  }
  function load(t,dt,envelope){
   if(dead)return {pressure:0,travel};measure(t);
   const force=pressure(t,.45)*strength*envelope;
   travel+=dt*(.24+force*1.6);
   const buffet=(Math.sin(t*8.7)*.36+Math.sin(t*14.3)*.17)*force*force;
   velocity+=((force*(mobile?7:11.5)+buffet-drag)*64-velocity*12.8)*dt;drag=clamp(drag+velocity*dt,-1,mobile?8:12);
   rollVelocity+=((force*(mobile?.68:.95)+buffet*.08-roll)*46-rollVelocity*11)*dt;roll=clamp(roll+rollVelocity*dt,-.1,1.1);
   panel.style.setProperty('--pd-wind-x',drag.toFixed(3)+'px');panel.style.setProperty('--pd-wind-y',(-force*1.8+buffet*.25).toFixed(3)+'px');panel.style.setProperty('--pd-wind-roll',roll.toFixed(3)+'deg');panel.style.setProperty('--pd-wind-pressure',force.toFixed(3));panel.style.setProperty('--pd-wind-flex',(drag*.3).toFixed(3)+'px');
   for(const g of groups){
    const count=Math.max(1,g.letters.length-1);
    g.letters.forEach((letter,i)=>{
     const fraction=i/count,local=pressure(t-g.offset*.24,fraction)*strength*envelope;
     const gust=Math.pow(clamp((local-.14)/.75,0,1),1.15),flutter=Math.sin(t*(7.8+fraction*2.5)-i*.39-g.offset*3)*gust*gust;
     // A few original glyphs tear loose; their layout slots and accessible text stay intact.
     const phase=t%11.8,attack=phase>=1&&phase<2.1||phase>=7&&phase<7.9;
     if(!letter.launch&&letter.selected&&attack&&local>.48+letter.ticket*.12){
      letter.launch={at:t,x:letter.x,y:letter.y,roll:letter.roll,exit:Math.max(w*.8,letter.room+90),lift:rand(45,100),spin:rand(145,230)*(Math.random()<.5?-1:1)};
     }
     if(letter.launch){
      const flight=letter.launch,age=t-flight.at,progress=clamp(age/1.05,0,1),out=ease(progress);
      // One-way departure: the glyph stays absent until the entire scene stops.
      const distance=flight.exit*(progress*progress*.8+progress*.2);
      letter.x=flight.x+distance;letter.y=flight.y-flight.lift*out-Math.sin(Math.min(age,1.05)*5+i)*out*12;
      letter.roll=flight.roll+flight.spin*Math.min(age,1.05)+90*out;
      letter.el.dataset.galeFlight=age>=1.05?'away':'flying';letter.el.style.opacity=age>=1.05?'0':'1';
      letter.el.style.transform='translate3d('+letter.x.toFixed(2)+'px,'+letter.y.toFixed(2)+'px,0) rotate('+letter.roll.toFixed(2)+'deg)';
      return;
     }
     const desired=Math.min(letter.room,gust*(g.title?(17+fraction*15)*(mobile?.85:1):3+fraction*5)+flutter*(g.title?3:.65));
     letter.vx+=((desired-letter.x)*75-letter.vx*11.8)*dt;letter.x+=letter.vx*dt;
     const lift=-letter.x*(g.title?.28:.19)+flutter*(g.title?1.7:.3);
     letter.vy+=((lift-letter.y)*56-letter.vy*10.8)*dt;letter.y+=letter.vy*dt;
     letter.vr+=((letter.x*(g.title?.7:.4)+flutter*(g.title?1.6:.4)-letter.roll)*48-letter.vr*10)*dt;letter.roll+=letter.vr*dt;
     letter.el.style.transform='translate3d('+letter.x.toFixed(2)+'px,'+letter.y.toFixed(2)+'px,0) rotate('+letter.roll.toFixed(2)+'deg)';
    });
   }
   return {pressure:force,travel};
  }
  function advect(p,t,dt,force,leaf){
   // Small grains follow the air immediately; broadside leaves resist and tumble.
   const eddy=Math.sin(p.y*6-t*1.6+p.phase)+.35*Math.sin(p.x*11+t*2.2);
   const speed=(170+force*1400)*(.18+p.z*.95),response=1-Math.exp(-dt*(leaf?3.6:11));
   p.vx+=(speed-p.vx)*response;p.vy+=((-speed*.10+eddy*force*(leaf?140:58)+(leaf?38*p.z:2))-p.vy)*response;
   p.x+=p.vx*dt/w;p.y+=p.vy*dt/h;
   if(p.x>1.2||p.y<-.2||p.y>1.2){p.x=rand(-.4,-.04);p.y=rand(-.06,1.1);}
  }
  function draw(t,dt,envelope,current){
   if(dead)return;ctx.clearRect(0,0,w,h);const force=current.pressure||0;
   if(current.fallback){
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#394641');sky.addColorStop(.5,'#25312a');sky.addColorStop(1,'#101d17');ctx.globalAlpha=envelope;ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
   }
   for(const p of grains){
    advect(p,t,dt,force,false);const fade=ease(p.x/.1)*ease((1-p.x)/.1),alpha=envelope*fade*(.06+p.z*.13)*(.6+force*.4);
    ctx.fillStyle='rgba(195,184,153,'+alpha.toFixed(3)+')';const r=.3+p.z*.75;
    // A dust mote has a short exposure, not a continuous white speed stripe.
    ctx.beginPath();ctx.ellipse(p.x*w,p.y*h,r*(1+Math.min(1.5,p.vx*.0008)),r,Math.atan2(p.vy,p.vx),0,TAU);ctx.fill();
   }
   for(const p of leaves){
    advect(p,t,dt,force,true);p.spin+=((force*Math.sin(t*2.3+p.phase)*6-p.spin)*dt*2.8);p.angle+=p.spin*dt;
    const fade=ease(p.x/.09)*ease((1-p.x)/.09),face=Math.sin(p.angle*1.7+p.phase),size=p.size*(.3+p.z*1.8),opacity=envelope*fade*(.21+p.z*.48);
    ctx.save();ctx.translate(p.x*w,p.y*h);ctx.rotate(Math.atan2(p.vy,p.vx)+p.angle);ctx.scale(1,.16+.84*Math.abs(face));
    // Foreground leaves are defocused; far matter is small. Exposure integrates
    // several positions of the same leaf, never another copy of the film.
    const sprite=sprites[p.kind][p.z>.73?1:0],samples=p.z>.55?3:1;
    for(let j=samples-1;j>=0;j--){ctx.globalAlpha=opacity/(j?6:1);const lag=j*.0038;ctx.drawImage(sprite,-size*.5-p.vx*lag,-size*.375-p.vy*lag,size,size*.75);}
    ctx.restore();
   }
   ctx.globalAlpha=1;
  }
  function destroy(){if(dead)return;dead=true;canvas.remove();lensLayer.remove();for(const g of groups)for(const l of g.letters){l.el.style.removeProperty('transform');l.el.style.removeProperty('opacity');delete l.el.dataset.galeFlight;}for(const variants of sprites)for(const s of variants)s.width=s.height=1;groups=[];leaves.length=grains.length=0;}
  return {canvas,lensLayer,resize,load,draw,destroy};
 }
 window.CardGaleField={create,pressure};
})();

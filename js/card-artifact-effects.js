/* Randomized visual reactions, driven and cleaned up by the cinematic scene. */
(function(){
'use strict';
const rand=(a,b)=>a+Math.random()*(b-a),clamp=x=>Math.max(0,Math.min(1,x));
function create(cfg,mobile,panel,quality){
 const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
 const canvas=document.createElement('canvas');canvas.className='pd-letter-fragments';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return null;
 const dry=cfg.alertEffect==='dry',alarm=cfg.alertEffect==='alert',quiet=cfg.type==='volcano'&&!cfg.hot&&!cfg.ash&&!cfg.lava;
 let w=1,h=1,dead=false;
 const candidates=Array.from(panel.querySelectorAll('#pd-gauge,#pd-mag,#pd-flag'));
 const selected=candidates.map(el=>({el,ticket:Math.random()})).sort((a,b)=>a.ticket-b.ticket).slice(0,Math.min(candidates.length,Math.floor(rand(2,4))));
 const actors=selected.map(({el})=>({el,at:rand(.7,4.8),vx:rand(-75,75),lift:rand(30,90),spin:rand(-85,85),phase:rand(0,Math.PI*2),variant:Math.floor(rand(0,3)),saved:['transform','opacity','filter','pointer-events'].map(key=>[key,el.style.getPropertyValue(key),el.style.getPropertyPriority(key)])}));
 const dust=Array.from({length:mobile?45:75},()=>({x:Math.random(),y:Math.random(),speed:rand(8,40),phase:rand(0,6.28),r:rand(.4,1.7)}));
  detail.track(dust);
 const cracks=Array.from({length:Math.floor(rand(5,10))},()=>({x:Math.random(),y:Math.random(),at:rand(1,8),angle:rand(-3,3),length:rand(25,110),bend:rand(-25,25)}));
 const direction=Math.random()<.5?-1:1,scanRate=rand(.12,.25),color=cfg.alertColor||'#fb923c';
 function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35)*detail.resolution;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
 function draw(t,dt,envelope){if(dead)return;ctx.clearRect(0,0,w,h);
  if(dry){const glow=ctx.createLinearGradient(0,h,0,0);glow.addColorStop(0,'rgba(194,108,28,'+(.16*envelope)+')');glow.addColorStop(1,'rgba(235,190,72,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
   ctx.lineWidth=.7;for(const c of cracks){const age=clamp((t-c.at)/3);if(!age)continue;ctx.strokeStyle='rgba(240,188,108,'+(.30*age*envelope)+')';ctx.beginPath();ctx.moveTo(c.x*w,c.y*h);ctx.lineTo(c.x*w+Math.cos(c.angle)*c.length*age,c.y*h+Math.sin(c.angle)*c.length*age);ctx.lineTo(c.x*w+Math.cos(c.angle)*c.length*age+c.bend,c.y*h+Math.sin(c.angle)*c.length*age+15);ctx.stroke();}
   for(const d of dust){ctx.fillStyle='rgba(220,184,131,'+(.4*envelope)+')';ctx.fillRect((d.x*w+t*d.speed*direction+w*10)%w,d.y*h+Math.sin(t+d.phase)*8,d.r,d.r);}
  }else if(alarm){const y=((t*scanRate)%1)*h,beam=ctx.createLinearGradient(0,y-70,0,y+70);beam.addColorStop(0,'transparent');beam.addColorStop(.5,color);beam.addColorStop(1,'transparent');ctx.globalAlpha=.16*envelope;ctx.fillStyle=beam;ctx.fillRect(0,y-70,w,140);ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.globalAlpha=.35*envelope;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.globalAlpha=1;}
  for(const a of actors){const age=t-a.at;if(age<0)continue;let x=0,y=0,rotate=0,opacity=1,filter='';
   if(quiet){x=Math.sin(t+a.phase)*1.5;y=Math.cos(t+a.phase);}
   else if(alarm){x=Math.sin(age*12+a.phase)*(2+a.variant);rotate=Math.sin(age*5+a.phase)*2;filter='drop-shadow(0 0 '+(3+Math.sin(age*3)*2)+'px '+color+')';if(a.variant===2&&age>2){x=direction*(age-2)*w*.45;opacity=age>4?0:1;}}
   else if(dry||cfg.hot||cfg.ash){x=Math.sin(t*3+a.phase)*3;y=age*randFixed(a);rotate=Math.sin(age+a.phase)*3;filter='sepia('+clamp(age/4)+') brightness('+(1-clamp(age/6)*.6)+')';opacity=1-clamp((age-(2+a.variant))/1.7);}
   else if(cfg.type==='flood'){x=age*a.vx*.35;y=-age*a.lift*.25+Math.sin(t*2+a.phase)*9;rotate=Math.sin(age+a.phase)*13;opacity=age>6?0:1;}
   else if(cfg.type==='storm'){x=age*a.vx*.2;y=age*age*a.lift*.25;rotate=age*a.spin*.2;opacity=y>h?0:1;}
   else if(cfg.type==='earthquake'){x=age*a.vx*.3;y=age*age*a.lift;rotate=age*a.spin*.4;opacity=y>h?0:1;}
   else{x=direction*age*age*w*.15+Math.sin(age*4+a.phase)*15;y=cfg.type==='tsunami'?age*age*a.lift:-age*a.lift;rotate=age*a.spin;opacity=age>4?0:1;}
   a.el.style.pointerEvents='none';a.el.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) rotate('+rotate.toFixed(2)+'deg)';a.el.style.opacity=String(opacity);if(filter)a.el.style.filter=filter;a.el.dataset.cardReaction=dry?'dry-fracture':alarm?'alert-scan':quiet?'monitoring':cfg.type;
  }
 }
 function randFixed(a){return a.lift*.04;}
 function destroy(){dead=true;for(const a of actors){for(const [key,value,priority] of a.saved){if(value)a.el.style.setProperty(key,value,priority);else a.el.style.removeProperty(key);}delete a.el.dataset.cardReaction;}canvas.remove();}
 return {canvas,draw,resize,destroy};
}
window.CardArtifactEffects={create};
})();

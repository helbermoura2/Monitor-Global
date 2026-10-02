/* Illustrative atmosphere inside the glass card. No map, feed, voice or camera writes. */
(function(){
 'use strict';
 const TYPES=new Set(['storm','hurricane','tornado','fire','volcano','flood','tsunami','earthquake','wind']);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let scene=null,ghost=null,ghostTimer=0,raf=0,idleTimer=0,serial=0;
 const rand=(a,b)=>a+Math.random()*(b-a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const panel=()=>document.getElementById('painel-direito');
 function profile(item){
  if(!item||!TYPES.has(item.type)||item.hazardNature==='bulletin')return null;
  const text=[item.eruptionStatus,item.activityStatus,item.vulcanicActivity,item.ashStatus,item.detail].filter(Boolean).join(' ');
  const quiet=/no eruptive|not erupt|sem (?:atividade eruptiva|erup)|não.*erup|nao.*erup|no ash|eruption (?:ended|ceased)|erup(?:ç|c)[aã]o.*(?:encerrada|cessou|histórica|historica)|dormant|extinct/i.test(text);
  const eruptive=!quiet&&/erupting|eruption ongoing|eruption continues|ongoing eruption|em erup(?:ç|c)[aã]o|erup(?:ç|c)[aã]o.*(?:em andamento|ativa)|ash emission|emiss[aã]o.*cinza/i.test(text);
  let strength=.48;
  if(item.type==='earthquake'&&Number.isFinite(Number(item.mag)))strength=clamp((Number(item.mag)-1)/6,.15,1);
  else if(Number.isFinite(Number(item.windKmh))&&Number(item.windKmh)>0)strength=clamp(Number(item.windKmh)/180,.3,1);
  else if(Number(item.sev)>0)strength=clamp(Number(item.sev)/3,.3,1);
  const hot=item.type==='fire'||item.type==='volcano'&&eruptive;
  const ash=item.type==='volcano'&&!quiet&&(eruptive||/ash|cinza/i.test(text));
  return {type:item.type,strength,hot,ash,rain:['storm','hurricane'].includes(item.type),mist:['hurricane','tornado','wind'].includes(item.type)||hot||ash,water:['flood','tsunami'].includes(item.type)};
 }
 function removeGhost(){clearTimeout(ghostTimer);ghost?.remove();ghost=null;}
 function stop(){
  serial++;cancelAnimationFrame(raf);clearTimeout(idleTimer);idleTimer=0;raf=0;
  if(scene){scene.observer.disconnect();scene.host.remove();scene=null;}
  panel()?.classList.remove('pd-cinema-active');removeGhost();
 }
 function fogTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  for(let i=0;i<9;i++){const x=rand(35,92),y=rand(35,92),r=rand(21,42),g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(213,224,230,.19)');g.addColorStop(.5,'rgba(182,199,210,.09)');g.addColorStop(1,'rgba(182,199,210,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);}
  return c;
 }
 function heatFilter(host){
  // Narrow, moving lenses; SVG displacement is progressive enhancement for supporting browsers.
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('class','pd-cinema-filter');svg.setAttribute('aria-hidden','true');
  const defs=document.createElementNS(ns,'defs'),filter=document.createElementNS(ns,'filter');filter.id='pd-cinema-heat-filter';filter.setAttribute('x','-15%');filter.setAttribute('y','-15%');filter.setAttribute('width','130%');filter.setAttribute('height','130%');
  const noise=document.createElementNS(ns,'feTurbulence');noise.setAttribute('type','fractalNoise');noise.setAttribute('baseFrequency','.018 .09');noise.setAttribute('numOctaves','1');noise.setAttribute('seed','4');noise.setAttribute('result','heat');filter.append(noise);
  const displacement=document.createElementNS(ns,'feDisplacementMap');displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','heat');displacement.setAttribute('scale','2');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');filter.append(displacement);defs.append(filter);svg.append(defs);host.append(svg);
  for(const side of ['left','right']){const lens=document.createElement('div');lens.className='pd-cinema-heat pd-cinema-heat-'+side;host.append(lens);}
 }
 function start(item,duration=10000){
  const p=panel(),cfg=profile(item);let snapshot=null;
  if(cfg&&scene&&!reduced.matches){snapshot=scene.canvas.cloneNode();snapshot.getContext('2d')?.drawImage(scene.canvas,0,0);}
  stop();if(!p||!cfg||reduced.matches)return false;
  if(snapshot){ghost=document.createElement('div');ghost.className='pd-cinema-afterglow';ghost.setAttribute('aria-hidden','true');ghost.append(snapshot);p.append(ghost);ghostTimer=setTimeout(removeGhost,420);}
  const host=document.createElement('div');host.className='pd-cinema-layer';host.setAttribute('aria-hidden','true');host.dataset.scene=cfg.type;
  const canvas=document.createElement('canvas');host.append(canvas);const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){host.remove();return false;}
  const mobile=matchMedia('(max-width:900px)').matches,now=performance.now();
  const s={id:++serial,itemId:item.id,cfg,host,canvas,ctx,start:now,last:now,paintAt:0,duration,width:0,height:0,mobile,fog:fogTexture(),rain:[],smoke:[],particles:[],beads:[]};
  if(cfg.hot)heatFilter(host);
  if(cfg.rain){
   for(let i=0;i<(mobile?42:72);i++)s.rain.push({x:Math.random(),y:Math.random(),depth:rand(.15,1),phase:rand(0,6.3)});
   const lenses=document.createElement('div');lenses.className='pd-cinema-lenses';host.append(lenses);
   for(let i=0;i<(mobile?12:18);i++){const el=document.createElement('i');el.className='pd-cinema-drop';lenses.append(el);s.beads.push({x:Math.random()<.5?rand(.025,.14):rand(.86,.97),y:rand(.08,.8),r:rand(1,3),vy:0,el});}
  }
  if(cfg.mist)for(let i=0;i<(mobile?6:9);i++)s.smoke.push({x:Math.random()<.5?rand(-.12,.1):rand(.9,1.1),y:Math.random(),depth:rand(.45,1),phase:rand(0,6.3)});
  const particleCount=cfg.type==='fire'||cfg.hot?mobile?16:26:cfg.ash?mobile?18:30:['tornado','wind','earthquake'].includes(cfg.type)?mobile?12:20:0;
  for(let i=0;i<particleCount;i++)s.particles.push({x:Math.random(),y:Math.random(),depth:rand(.2,1),phase:rand(0,6.3),speed:rand(.6,1.5),ash:cfg.ash&&(i%3!==0||!cfg.hot)});
  p.append(host);p.classList.add('pd-cinema-active');scene=s;
  function resize(){if(scene!==s)return;const w=p.clientWidth,h=p.clientHeight,dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.5);if(!w||!h)return;s.width=w;s.height=h;s.canvas.width=Math.round(w*dpr);s.canvas.height=Math.round(h*dpr);s.ctx.setTransform(dpr,0,0,dpr,0,0);}
  s.observer=new ResizeObserver(resize);s.observer.observe(p);resize();raf=requestAnimationFrame(frame);return true;
 }
 function edge(x,w){return .28+.72*Math.pow(Math.abs(x/w-.5)*2,1.5);}
 function illuminate(s,t,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  let color=cfg.hot?'255,139,61':cfg.water?'134,222,238':'176,215,239';
  const rhythm=.7+.16*Math.sin(t*1.17)+.11*Math.sin(t*2.31+.4);
  for(const x of [-w*.1,w*1.1]){const g=ctx.createRadialGradient(x,h*.65,0,x,h*.65,w*.65);g.addColorStop(0,'rgba('+color+','+((cfg.hot?.19:.09)*rhythm*envelope).toFixed(3)+')');g.addColorStop(1,'rgba('+color+',0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  if(cfg.type==='earthquake'){
   const pulse=Math.exp(-t*.75)*(.5+.5*Math.sin(t*16));ctx.strokeStyle='rgba(205,229,245,'+(.25*pulse*cfg.strength*envelope).toFixed(3)+')';ctx.lineWidth=1;ctx.strokeRect(1,1,w-2,h-2);
  }
 }
 function rainfall(s,t,dt,envelope){
  const {ctx,width:w,height:h,cfg}=s;const gust=cfg.type==='hurricane'?85+75*Math.sin(t*.85)+40*Math.sin(t*1.9):8+22*Math.sin(t*.67);
  for(const drop of s.rain){
   const speed=(130+drop.depth*300)*(1+cfg.strength*.35);drop.y+=speed*dt/h;drop.x+=gust*dt/w*(.5+drop.depth);if(drop.y>1.06){drop.y=-.08;drop.x=Math.random();}if(drop.x>1.08)drop.x=-.08;if(drop.x<-.08)drop.x=1.08;
   const x=drop.x*w,y=drop.y*h,len=5+drop.depth*18;ctx.strokeStyle='rgba(210,231,246,'+((.04+drop.depth*.2)*envelope*edge(x,w)).toFixed(3)+')';ctx.lineWidth=.45+drop.depth*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-gust/speed*len,y-len);ctx.stroke();
  }
  // Gravity starts after a droplet accumulates mass. Nearby drops merge by volume.
  for(const b of s.beads){b.r+=dt*(.14+cfg.strength*.12);if(b.r>2.65)b.vy=Math.min(80,(b.vy+dt*20)*(1+dt*.4));b.y+=b.vy*dt/h;
   if(b.y>1.04){b.y=rand(-.05,.05);b.r=rand(.9,1.6);b.vy=0;}
   for(const q of s.beads){if(q===b||q.r<.2)continue;const dx=(b.x-q.x)*w,dy=(b.y-q.y)*h;if(dx*dx+dy*dy<Math.pow((b.r+q.r)*.72,2)){b.r=Math.min(6.5,Math.cbrt(b.r**3+q.r**3));q.y=rand(-.06,.04);q.r=rand(.7,1.2);q.vy=0;b.vy=Math.max(b.vy,8);}}
   const x=b.x*w,y=b.y*h,stretch=1+Math.min(.5,b.vy/140);b.el.style.width=(b.r*2).toFixed(1)+'px';b.el.style.height=(b.r*2*stretch).toFixed(1)+'px';b.el.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';
   if(b.vy>5){ctx.strokeStyle='rgba(209,232,245,'+(.12*envelope).toFixed(3)+')';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-Math.min(35,b.vy*.4));ctx.stroke();}
  }
 }
 function atmosphere(s,t,dt,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  for(const puff of s.smoke){
   if(cfg.hot||cfg.ash){puff.y-=dt*(.04+puff.depth*.03);if(puff.y<-.2)puff.y=1.2;}
   else if(cfg.type==='tornado'){puff.y=(puff.y+dt*.06)%1;}
   else{puff.x+=dt*(cfg.type==='hurricane'?.09:.04)*(1+cfg.strength);if(puff.x>1.2)puff.x=-.2;}
   let x=puff.x*w+Math.sin(t*.7+puff.phase)*12,y=puff.y*h,size=55+90*puff.depth;
   if(cfg.type==='tornado'){const a=t*2+puff.phase;x=w*(.09+.05*Math.sin(a))+(1-puff.y)*13;y=puff.y*h;size=35+(1-puff.y)*65;}
   ctx.globalAlpha=envelope*(cfg.hot?.5:.55)*edge(x,w);ctx.drawImage(s.fog,x-size*.5,y-size*.5,size,size*(cfg.type==='hurricane'?.8:1.35));ctx.globalAlpha=1;
  }
  if(cfg.hot){
   ctx.strokeStyle='rgba(255,215,175,'+(.035*envelope).toFixed(3)+')';ctx.lineWidth=2;
   for(const side of [0,1])for(let k=0;k<3;k++){ctx.beginPath();for(let y=0;y<h;y+=16){const x=(side?w-12:12)+Math.sin(y*.045-t*2+k)*5+Math.sin(y*.025+t)*3;k===0&&y===0?ctx.moveTo(x,y):y===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
  }
 }
 function debris(s,t,dt,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  for(const p of s.particles){
   let x,y;
   if(cfg.type==='tornado'){const angle=t*(1.6+p.depth)+p.phase,radius=8+(1-p.y)*w*.13;x=w*.09+Math.cos(angle)*radius;y=p.y*h+Math.sin(angle)*8;p.y-=dt*.06*p.speed;if(p.y<-.05)p.y=1.05;}
   else{const rising=cfg.hot&&!p.ash;p.y+=(rising?-1:1)*dt*(cfg.type==='earthquake'?.08:.035)*p.speed;if(p.y<-.1)p.y=1.1;if(p.y>1.1)p.y=-.1;if(cfg.type==='wind'){p.x+=dt*.4*p.speed;if(p.x>1.1)p.x=-.1;}x=p.x*w+Math.sin(t*(.8+p.depth)+p.phase)*(cfg.hot?12:5);y=p.y*h;}
   const r=.45+p.depth*(cfg.hot?1.2:.7),alpha=envelope*edge(x,w)*(cfg.type==='earthquake'?Math.exp(-t*.6)*.4:.6);
   ctx.fillStyle=cfg.hot&&!p.ash?'rgba(255,174,79,'+alpha.toFixed(3)+')':p.ash?'rgba(210,206,199,'+(alpha*.65).toFixed(3)+')':'rgba(194,220,228,'+(alpha*.4).toFixed(3)+')';
   if(cfg.hot&&!p.ash){ctx.shadowColor='rgba(255,145,60,.6)';ctx.shadowBlur=4;}ctx.beginPath();ctx.ellipse(x,y,r,r*.55,t+p.phase,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
 }
 function water(s,t,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  // Decorative reflection only: no inferred water level, arrival time or flood depth.
  const tsunami=cfg.type==='tsunami',travel=tsunami?(t<2?-t*9:Math.min(80,(t-2)*17)):Math.sin(t*.45)*5;
  const base=h*.9-travel;
  ctx.save();ctx.beginPath();ctx.rect(0,h*.65,w,h*.35);ctx.clip();
  // Broad translucent reflections, with broken highlights rather than a solid wall of water.
  const reflection=ctx.createLinearGradient(0,base-9,0,h);
  reflection.addColorStop(0,'rgba(178,231,241,'+(.08*envelope).toFixed(3)+')');
  reflection.addColorStop(.35,'rgba(101,177,204,'+(.045*envelope).toFixed(3)+')');
  reflection.addColorStop(1,'rgba(67,127,158,0)');
  ctx.beginPath();for(let x=-10;x<=w+10;x+=6){const y=base+Math.sin(x*.04+t*(tsunami?1.5:.75))*(tsunami?7:3);x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y);}
  ctx.lineTo(w+10,h);ctx.lineTo(-10,h);ctx.closePath();ctx.fillStyle=reflection;ctx.fill();
  for(let n=0;n<6;n++){
   ctx.beginPath();for(let x=-10;x<=w+10;x+=6){const y=base+n*9+Math.sin(x*.04+t*(tsunami?1.5:.75)+n*.9)*(tsunami?7:3)+Math.sin(x*.075-t*.6)*2;x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y);}
   ctx.strokeStyle='rgba(174,233,241,'+((tsunami?.18:.12)*envelope*(1-n/8)).toFixed(3)+')';ctx.lineWidth=tsunami&&n===0?1.3:.65;ctx.setLineDash(n===0?[]:[11+n*3,19+n*5]);ctx.lineDashOffset=t*(n%2?-7:9);ctx.stroke();ctx.setLineDash([]);
  }
  if(tsunami){for(let i=0;i<30;i++){const x=(i*w/29+Math.sin(t+i)*3),y=base+Math.sin(x*.04+t*1.5)*7;ctx.fillStyle='rgba(226,247,250,'+(.22*envelope).toFixed(3)+')';ctx.beginPath();ctx.ellipse(x,y,1.2,.65,0,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
 }
 function frame(now){
  const s=scene;if(!s)return;const t=(now-s.start)/1000;
  if(t*1000>=s.duration){stop();return;}
  if(document.hidden){raf=0;return;}
  const p=panel(),hidden=p?.classList.contains('pd-flip-girado')||matchMedia('(max-width:900px)').matches&&!document.body.classList.contains('mobile-details-mid')&&!document.body.classList.contains('mobile-details-open');
  if(hidden){raf=0;idleTimer=setTimeout(()=>{idleTimer=0;if(scene===s){s.last=performance.now();raf=requestAnimationFrame(frame);}},120);return;}
  const fps=s.mobile?24:30;if(now-s.paintAt>=1000/fps&&s.width&&s.height){
   const dt=Math.min(.06,(now-s.last)/1000);s.last=now;s.paintAt=now;
   const fadeIn=clamp(t/.55,0,1),fadeOut=clamp((s.duration/1000-t)/.85,0,1),envelope=Math.min(fadeIn,fadeOut);s.host.style.opacity=envelope.toFixed(3);
   s.ctx.clearRect(0,0,s.width,s.height);illuminate(s,t,envelope);if(s.cfg.rain)rainfall(s,t,dt,envelope);if(s.cfg.mist)atmosphere(s,t,dt,envelope);if(s.particles.length)debris(s,t,dt,envelope);if(s.cfg.water)water(s,t,envelope);
  }
  raf=requestAnimationFrame(frame);
 }
 reduced.addEventListener('change',()=>{if(reduced.matches){stop();window.restoreWindLetters?.();window.stopIconSpin?.();window.stopRainEffect?.();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&scene&&!raf){scene.last=performance.now();raf=requestAnimationFrame(frame);}});
 window.addEventListener('pagehide',stop);
 window.CinematicCard={start,stop,isActive:()=>!!scene};
})();

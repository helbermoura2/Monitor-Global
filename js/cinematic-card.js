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
  const quiet=/no eruptive|not erupt|sem (?:atividade eruptiva|erup)|não.*erup|nao.*erup|eruption (?:ended|ceased)|erup(?:ç|c)[aã]o.*(?:encerrada|cessou|histórica|historica)|dormant|extinct/i.test(text);
  const eruptive=!quiet&&/erupting|eruption ongoing|eruption continues|ongoing eruption|em erup(?:ç|c)[aã]o|erup(?:ç|c)[aã]o.*(?:em andamento|ativa)|ash emission|emiss[aã]o.*cinza/i.test(text);
  const lava=!quiet&&/lava|effusive|efusiv|molten/i.test(text)&&!/no (?:lava|effusiv)|sem (?:fluxo de |escoamento de |atividade )?(?:lava|efusiv)|lava (?:flow )?(?:ended|ceased)|lava.*(?:cessou|encerrad)/i.test(text);
  let strength=.48;
  if(item.type==='earthquake'&&Number.isFinite(Number(item.mag)))strength=clamp((Number(item.mag)-1)/6,.15,1);
  else if(Number.isFinite(Number(item.windKmh))&&Number(item.windKmh)>0)strength=clamp(Number(item.windKmh)/180,.3,1);
  else if(Number(item.sev)>0)strength=clamp(Number(item.sev)/3,.3,1);
  const hot=item.type==='fire'||item.type==='volcano'&&(eruptive||lava);
  const ash=item.type==='volcano'&&!quiet&&!/no ash|sem cinzas/i.test(text)&&(eruptive||/ash|cinza/i.test(text));
  const category=[item.category,item.classification,item.cycloneType,item.warningEvent,item.detail,item.place].filter(Boolean).join(' ');
  const cycloneStage=/depress|depression/i.test(category)?'depression':/tempestade tropical|tropical storm/i.test(category)?'tropical-storm':'mature';
  return {type:item.type,cycloneStage,strength,hot,ash,lava:item.type==='volcano'&&lava,rain:['storm','hurricane'].includes(item.type),mist:['hurricane','tornado','wind'].includes(item.type)||hot||ash,water:['flood','tsunami'].includes(item.type)};
 }
 function removeGhost(){clearTimeout(ghostTimer);ghost?.remove();ghost=null;}
 function stop(){
  serial++;cancelAnimationFrame(raf);clearTimeout(idleTimer);idleTimer=0;raf=0;
  if(scene){scene.observer.disconnect();panel()?.removeEventListener('scroll',scene.scroll);scene.front?.remove();window.restoreWindLetters?.();panel()?.style.removeProperty("--pd-water-top");panel()?.style.removeProperty("--pd-gust");scene.film?.destroy();scene.footage?.destroy();scene.host.remove();panel()?.classList.remove('pd-fx-'+scene.cfg.type);scene=null;}
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
 const symbolPaths={
  fire:'M32 4 C34 17 49 20 47 35 C45 50 20 57 15 41 C10 27 24 20 23 11 C28 18 29 24 32 25 C38 17 32 13 32 4 Z M30 35 C23 44 29 51 35 48 C40 44 35 40 34 36',
  volcano:'M6 50 L24 24 L29 29 L35 25 L58 50 Z M22 24 C18 18 27 16 24 10 M37 22 C43 16 33 12 39 5 M25 38 L31 31 L40 44',
  hurricane:'M32 21 C13 4 4 32 18 42 C35 54 59 33 45 20 C31 8 10 24 22 36 C33 47 50 30 38 25 C29 19 22 28 28 34 M21 14 L29 7 M44 44 L36 55',
  tornado:'M8 13 C23 7 43 7 56 13 M11 23 C28 18 43 19 51 23 M18 34 C29 30 38 30 46 34 M25 44 C31 42 37 42 40 44 M32 53 L36 52',
  wind:'M5 22 L43 22 C57 22 54 6 44 11 M5 33 L51 33 C63 33 60 49 50 45 M10 44 L29 44 C40 44 39 57 31 54',
  flood:'M5 30 C13 23 19 23 27 30 C35 37 43 23 51 29 L59 32 M5 42 C13 35 19 35 27 42 C35 49 43 35 51 41 L59 44 M5 54 C13 47 19 47 27 54 C35 61 43 47 51 53 L59 56',
  tsunami:'M5 50 C18 27 34 17 44 25 C52 32 45 40 35 33 C27 27 21 42 29 48 M5 55 L58 55 M47 44 L59 48'
 };
 function prepareSymbol(item){
  if(!item||item.hazardNature==='bulletin'||!symbolPaths[item.type])return;
  const el=document.getElementById('pd-mag');if(!el)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('class','pd-cinema-symbol');svg.setAttribute('role','img');svg.setAttribute('aria-label','Ilustração do evento');const path=document.createElementNS(ns,'path');path.setAttribute('d',symbolPaths[item.type]);svg.append(path);el.replaceChildren(svg);
 }
 function start(item,duration=Infinity){
  if(!item?.__cinemaDemo)window.CardEffectDemo?.cancelForRealEvent();
  if(!item?.__cinemaDemo)prepareSymbol(item);
  const p=panel(),cfg=profile(item);let snapshot=null;
  if(cfg&&scene&&!reduced.matches){snapshot=scene.canvas.cloneNode();const snap=snapshot.getContext('2d');if(scene.film)snap?.drawImage(scene.film.canvas,0,0,snapshot.width,snapshot.height);snap?.drawImage(scene.canvas,0,0);}
  stop();if(!p||!cfg||reduced.matches)return false;
  if(snapshot){ghost=document.createElement('div');ghost.className='pd-cinema-afterglow';ghost.setAttribute('aria-hidden','true');ghost.append(snapshot);ghost.style.transform='translate3d(0,'+p.scrollTop+'px,0)';p.append(ghost);ghostTimer=setTimeout(removeGhost,420);}
  const host=document.createElement('div');host.className='pd-cinema-layer';host.setAttribute('aria-hidden','true');host.dataset.scene=cfg.type;host.dataset.activity=cfg.type==='volcano'?(cfg.hot?'eruptive':cfg.ash?'ash':'monitoring'):'illustration';host.dataset.material=cfg.lava?'lava':cfg.type==='flood'?'muddy-current':cfg.type;host.dataset.demo=!!item.__cinemaDemo;
  const canvas=document.createElement('canvas');canvas.className='pd-cinema-particles';host.append(canvas);const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){host.remove();return false;}
  const mobile=matchMedia('(max-width:900px)').matches,now=performance.now();
  const film=window.CardCinemaFilm?.create(cfg,mobile);if(film)host.append(film.canvas);host.dataset.renderer=film?'film':'layers';
  const footage=window.CardCinemaFilm?.footage(cfg);if(footage)host.append(footage.video);
  const s={film,footage,id:++serial,itemId:item.id,cfg,host,canvas,ctx,start:now,last:now,paintAt:0,duration,width:0,height:0,mobile,fog:fogTexture(),rain:[],smoke:[],particles:[],beads:[],floating:[],boltCycle:0,demoLightning:!!item.__cinemaDemo&&cfg.type==='storm'};
  if(s.demoLightning&&typeof window.naturalLightning==='function'){
   s.demoBolt=document.createElementNS('http://www.w3.org/2000/svg','svg');s.demoBolt.setAttribute('viewBox','0 0 100 400');s.demoBolt.setAttribute('class','pd-cinema-demo-bolt');s.demoBolt.setAttribute('preserveAspectRatio','none');window.naturalLightning(s.demoBolt);host.append(s.demoBolt);
  }
  if(cfg.hot)heatFilter(host);
  if(cfg.rain){
   for(let i=0;i<(mobile?76:128);i++)s.rain.push({x:Math.random(),y:Math.random(),depth:rand(.15,1),phase:rand(0,6.3)});
   const lenses=document.createElement('div');lenses.className='pd-cinema-lenses';host.append(lenses);
   for(let i=0;i<(mobile?12:18);i++){const el=document.createElement('i');el.className='pd-cinema-drop';lenses.append(el);s.beads.push({x:Math.random()<.5?rand(.025,.14):rand(.86,.97),y:rand(.08,.8),r:rand(1,3),vy:0,el});}
  }
  if(cfg.mist)for(let i=0;i<(mobile?6:9);i++)s.smoke.push({x:Math.random()<.5?rand(-.12,.1):rand(.9,1.1),y:Math.random(),depth:rand(.45,1),phase:rand(0,6.3)});
  const particleCount=cfg.type==='fire'||cfg.hot?mobile?28:44:cfg.ash?mobile?18:30:['tornado','wind','earthquake'].includes(cfg.type)?mobile?12:20:0;
  for(let i=0;i<particleCount;i++)s.particles.push({x:Math.random(),y:Math.random(),depth:rand(.2,1),phase:rand(0,6.3),speed:rand(.6,1.5),ash:cfg.ash&&(i%3!==0||!cfg.hot)});
  if(cfg.water)for(let i=0;i<(mobile?16:28);i++)s.floating.push({x:Math.random(),y:Math.random(),phase:rand(0,6.3),speed:rand(.4,1),r:rand(1.5,4),foam:i%3!==0});
  const front=document.createElement('div');front.className='pd-cinema-contact';front.setAttribute('aria-hidden','true');const contact=document.createElement('canvas');front.append(contact);const lenses=host.querySelector('.pd-cinema-lenses');if(lenses)front.append(lenses);p.append(front);s.front=front;s.contact=contact;s.contactCtx=contact.getContext('2d');
  if(['wind','hurricane','storm','tornado'].includes(cfg.type))window.triggerWindLetters?.(Infinity);
  p.append(host);p.classList.add('pd-cinema-active','pd-fx-'+cfg.type);scene=s;
  function resize(){if(scene!==s)return;const w=p.clientWidth,h=p.clientHeight,dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.5);if(!w||!h)return;s.width=w;s.height=h;s.canvas.width=Math.round(w*dpr);s.canvas.height=Math.round(h*dpr);s.ctx.setTransform(dpr,0,0,dpr,0,0);s.contact.width=s.canvas.width;s.contact.height=s.canvas.height;s.contactCtx?.setTransform(dpr,0,0,dpr,0,0);s.film?.resize(w,h);s.footage?.resize(w,h);}
  s.scroll=()=>{s.host.style.transform=s.front.style.transform='translate3d(0,'+p.scrollTop+'px,0)';};p.addEventListener('scroll',s.scroll,{passive:true});s.scroll();s.observer=new ResizeObserver(resize);s.observer.observe(p);resize();raf=requestAnimationFrame(frame);return true;
 }
 function edge(x,w){return .28+.72*Math.pow(Math.abs(x/w-.5)*2,1.5);}
 function illuminate(s,t,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  let color=cfg.hot?'255,139,61':cfg.type==='flood'?'202,176,128':cfg.water?'134,222,238':'176,215,239';
  const rhythm=.7+.16*Math.sin(t*1.17)+.11*Math.sin(t*2.31+.4);
  for(const x of [-w*.1,w*1.1]){const g=ctx.createRadialGradient(x,h*.65,0,x,h*.65,w*.65);g.addColorStop(0,'rgba('+color+','+((cfg.hot?.30:cfg.type==='volcano'?.17:.12)*rhythm*envelope).toFixed(3)+')');g.addColorStop(1,'rgba('+color+',0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  if(cfg.type==='earthquake'){
   const pulse=Math.exp(-t*.75)*(.5+.5*Math.sin(t*16));ctx.strokeStyle='rgba(205,229,245,'+(.25*pulse*cfg.strength*envelope).toFixed(3)+')';ctx.lineWidth=1;ctx.strokeRect(1,1,w-2,h-2);
  }
 }
 function rainfall(s,t,dt,envelope){
  const {ctx,width:w,height:h,cfg}=s;const gust=cfg.type==='hurricane'?85+75*Math.sin(t*.85)+40*Math.sin(t*1.9):8+22*Math.sin(t*.67);
  for(const drop of s.rain){
   const speed=(220+drop.depth*460)*(1+cfg.strength*.35);drop.y+=speed*dt/h;drop.x+=gust*dt/w*(.5+drop.depth);if(drop.y>1.06){drop.y=-.08;drop.x=Math.random();}if(drop.x>1.08)drop.x=-.08;if(drop.x<-.08)drop.x=1.08;
   const x=drop.x*w,y=drop.y*h,len=8+drop.depth*25;ctx.strokeStyle='rgba(210,231,246,'+((.14+drop.depth*.38)*envelope*edge(x,w)).toFixed(3)+')';ctx.lineWidth=.45+drop.depth*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-gust/speed*len,y-len);ctx.stroke();
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
   let x=puff.x*w+Math.sin(t*.7+puff.phase)*12,y=puff.y*h,size=75+115*puff.depth;
   if(cfg.type==='tornado'){const a=t*2+puff.phase;x=w*(.09+.05*Math.sin(a))+(1-puff.y)*13;y=puff.y*h;size=35+(1-puff.y)*65;}
   ctx.globalAlpha=envelope*(cfg.hot?.78:.70)*edge(x,w);ctx.drawImage(s.fog,x-size*.5,y-size*.5,size,size*(cfg.type==='hurricane'?.8:1.35));ctx.globalAlpha=1;
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
   const r=.65+p.depth*(cfg.hot?2:cfg.type==='wind'||cfg.type==='tornado'?3:.9),alpha=envelope*edge(x,w)*(cfg.type==='earthquake'?Math.exp(-t*.32)*.6:.9);
   ctx.fillStyle=cfg.hot&&!p.ash?'rgba(255,174,79,'+alpha.toFixed(3)+')':p.ash?'rgba(210,206,199,'+(alpha*.65).toFixed(3)+')':'rgba(194,220,228,'+(alpha*.4).toFixed(3)+')';
   if(cfg.hot&&!p.ash){ctx.shadowColor='rgba(255,145,60,.6)';ctx.shadowBlur=4;}
   if(cfg.type==='wind'||cfg.type==='tornado'){ctx.fillStyle='rgba(119,113,91,'+(alpha*.75).toFixed(3)+')';ctx.save();ctx.translate(x,y);ctx.rotate(t*(.8+p.depth)+p.phase);ctx.beginPath();ctx.moveTo(-r*2,0);ctx.quadraticCurveTo(0,-r,r*2,0);ctx.quadraticCurveTo(0,r*.6,-r*2,0);ctx.fill();ctx.restore();}
   else{ctx.beginPath();ctx.ellipse(x,y,r,r*.55,t+p.phase,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  }
 }
 function water(s,t,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  // Decorative reflection only: no inferred water level, arrival time or flood depth.
  const tsunami=cfg.type==='tsunami',phase=t%12,travel=tsunami?(phase<2?-phase*9:phase<7?Math.min(h*.2,(phase-2)*h*.04):h*.2*(12-phase)/5):Math.sin(t*.45)*5;
  const base=h*(s.mobile?.72:.84)-travel;
  ctx.save();ctx.beginPath();ctx.rect(0,h*.48,w,h*.52);ctx.clip();
  // Broad translucent reflections, with broken highlights rather than a solid wall of water.
  const reflection=ctx.createLinearGradient(0,base-9,0,h);
  reflection.addColorStop(0,'rgba(178,231,241,'+(.16*envelope).toFixed(3)+')');
  reflection.addColorStop(.35,'rgba(101,177,204,'+(.08*envelope).toFixed(3)+')');
  reflection.addColorStop(1,'rgba(67,127,158,0)');
  ctx.beginPath();for(let x=-10;x<=w+10;x+=6){const y=base+Math.sin(x*.04+t*(tsunami?1.5:.75))*(tsunami?7:3);x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y);}
  ctx.lineTo(w+10,h);ctx.lineTo(-10,h);ctx.closePath();ctx.fillStyle=reflection;ctx.fill();
  for(let n=0;n<6;n++){
   ctx.beginPath();for(let x=-10;x<=w+10;x+=6){const y=base+n*9+Math.sin(x*.04+t*(tsunami?1.5:.75)+n*.9)*(tsunami?7:3)+Math.sin(x*.075-t*.6)*2;x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y);}
   ctx.strokeStyle='rgba(174,233,241,'+((tsunami?.32:.25)*envelope*(1-n/8)).toFixed(3)+')';ctx.lineWidth=tsunami&&n===0?1.3:.65;ctx.setLineDash(n===0?[]:[11+n*3,19+n*5]);ctx.lineDashOffset=t*(n%2?-7:9);ctx.stroke();ctx.setLineDash([]);
  }
  if(tsunami){for(let i=0;i<30;i++){const x=(i*w/29+Math.sin(t+i)*3),y=base+Math.sin(x*.04+t*1.5)*7;ctx.fillStyle='rgba(226,247,250,'+(.22*envelope).toFixed(3)+')';ctx.beginPath();ctx.ellipse(x,y,1.2,.65,0,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
 }
 function surfaceDebris(s,t,dt,envelope){
  const {ctx,width:w,height:h,cfg}=s;
  for(const p of s.floating){
   const speed=(cfg.type==='flood'?.10:.07)*p.speed;
   p.x+=dt*speed;p.y+=dt*speed*.5;if(p.x>1.05){p.x=-.05;p.y=Math.random();}if(p.y>1.05)p.y=-.05;
   const x=p.x*w+Math.sin(t*.8+p.phase)*9,y=p.y*h+Math.sin(t+p.phase)*3;
   ctx.save();ctx.translate(x,y);ctx.rotate(.35+Math.sin(t*.5+p.phase)*.35);
   ctx.globalAlpha=envelope*edge(x,w)*(p.foam?.23:.4);
   if(p.foam){ctx.strokeStyle=cfg.type==='flood'?'#e0d9c3':'#d5eef1';ctx.lineWidth=.6;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(k*p.r*2,Math.sin(p.phase+k)*2,p.r*2,p.r*.35,0,0,Math.PI);ctx.stroke();}}
   else{ctx.fillStyle=cfg.type==='flood'?'#30261d':'#506267';ctx.beginPath();ctx.moveTo(-p.r*2,0);ctx.quadraticCurveTo(0,-p.r,p.r*2,0);ctx.quadraticCurveTo(0,p.r*.6,-p.r*2,0);ctx.fill();}
   ctx.restore();
  }
 }
 // Foreground contact uses the same video decoder and geometry as the scene.
 function contactSurface(s,t,dt,envelope){
  const ctx=s.contactCtx;if(!ctx)return;const {width:w,height:h,cfg}=s;
  ctx.clearRect(0,0,w,h);const p=panel();
  const gust=(.5+.5*Math.sin(t*.9))*cfg.strength;
  p?.style.setProperty('--pd-gust',String(gust));
  if(cfg.rain){
   const old=s.ctx;s.ctx=ctx;rainfall(s,t,dt,envelope);s.ctx=old;
   // Splashes hit the card's lower glass, rather than rain behind the words.
   ctx.strokeStyle='rgba(217,237,247,.22)';ctx.lineWidth=.8;
   for(let i=0;i<(s.mobile?9:16);i++){const phase=(t*1.8+i*.618)%1,x=((i*.381)%1)*w,y=h*(.78+.18*((i*.217)%1));ctx.globalAlpha=(1-phase)*envelope;ctx.beginPath();ctx.ellipse(x,y,phase*12,phase*3,0,Math.PI,2*Math.PI);ctx.stroke();}ctx.globalAlpha=1;
  }
  if(cfg.type==='wind'||cfg.type==='hurricane'){
   ctx.strokeStyle='rgba(201,220,226,.13)';ctx.lineWidth=.7;
   for(let i=0;i<18;i++){const x=((t*(.20+gust*.25)+i*.618)%1)*w,y=((i*.381)%1)*h;ctx.beginPath();ctx.moveTo(x-55,y+5);ctx.quadraticCurveTo(x-18,y-8,x,y);ctx.stroke();}
  }
  if(cfg.type==='flood'){
   // Illustrative rise, unrelated to measured flood depth. Recede gently after crest.
   const phase=t%26,rise=phase<12?phase/12:phase<18?1:1-(phase-18)/8;
   const top=h*(.88-.48*rise);p?.style.setProperty('--pd-water-top',(top/h*100).toFixed(2)+'%');
   ctx.save();ctx.beginPath();for(let x=0;x<=w+6;x+=6){const y=top+Math.sin(x*.035+t*1.2)*5+Math.sin(x*.08-t)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.clip();
   if(s.footage?.isReady()){ctx.globalAlpha=.27*envelope;ctx.drawImage(s.footage.video,0,0,w,h);}
   const tint=ctx.createLinearGradient(0,top,0,h);tint.addColorStop(0,'rgba(148,163,144,.10)');tint.addColorStop(1,'rgba(36,57,57,.24)');ctx.globalAlpha=envelope;ctx.fillStyle=tint;ctx.fillRect(0,top-8,w,h);
   ctx.strokeStyle='rgba(208,222,207,.36)';for(let i=0;i<7;i++){ctx.beginPath();for(let x=0;x<=w+6;x+=6){const y=top+i*10+Math.sin(x*.035+t*1.2+i)*5;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.lineWidth=i? .6:1.5;ctx.stroke();}ctx.restore();
  }
 }
 function frame(now){
  const s=scene;if(!s)return;// O timestamp do primeiro RAF pode preceder performance.now() do start.
  // Tempos negativos geram raios inválidos nos respingos e interrompem a cena.
  const t=Math.max(0,(now-s.start)/1000);
  if(t*1000>=s.duration){stop();return;}
  if(document.hidden){s.footage?.pause();raf=0;return;}
  const p=panel(),hidden=!p?.clientWidth||p?.classList.contains('pd-flip-girado')||matchMedia('(max-width:900px)').matches&&!document.body.classList.contains('mobile-details-mid')&&!document.body.classList.contains('mobile-details-open');
  if(hidden){s.footage?.pause();raf=0;idleTimer=setTimeout(()=>{idleTimer=0;if(scene===s){s.last=performance.now();raf=requestAnimationFrame(frame);}},120);return;}
  s.footage?.play();
  if(s.cfg.type==='storm'&&(s.demoLightning||p?.dataset.lightning==='on')){
   const cycle=Math.floor(t/10);if(cycle!==s.boltCycle&&typeof window.naturalLightning==='function'){s.boltCycle=cycle;if(s.demoBolt)window.naturalLightning(s.demoBolt);else p.querySelectorAll('.pd-fx-bolt').forEach(window.naturalLightning);}
   if(s.demoBolt){const phase=t%10,flash=Math.exp(-Math.pow((phase-.61)*23,2))+Math.exp(-Math.pow((phase-4.3)*26,2))+Math.exp(-Math.pow((phase-8.3)*24,2));s.demoBolt.style.opacity=String(Math.min(.85,flash*.85));}
  }
  const fps=s.mobile?24:30;if(now-s.paintAt>=1000/fps&&s.width&&s.height){
   const dt=Math.min(.06,(now-s.last)/1000);s.last=now;s.paintAt=now;
   const fadeIn=clamp(t/.55,0,1),fadeOut=Number.isFinite(s.duration)?clamp((s.duration/1000-t)/.85,0,1):1,envelope=Math.min(fadeIn,fadeOut);s.host.style.opacity=envelope.toFixed(3);
   s.ctx.clearRect(0,0,s.width,s.height);illuminate(s,t,envelope);contactSurface(s,t,dt,envelope);if(s.cfg.mist&&!s.film)atmosphere(s,t,dt,envelope);if(s.particles.length)debris(s,t,dt,envelope);if(s.cfg.water&&!s.film)water(s,t,envelope);if(s.floating.length)surfaceDebris(s,t,dt,envelope);s.film?.draw(t,s.cfg,(s.demoLightning||p?.dataset.lightning==='on')&&s.cfg.type==='storm',s.footage?.isReady());
  }
  raf=requestAnimationFrame(frame);
 }
 reduced.addEventListener('change',()=>{if(reduced.matches){stop();window.restoreWindLetters?.();window.stopIconSpin?.();window.stopRainEffect?.();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&scene&&!raf){scene.last=performance.now();raf=requestAnimationFrame(frame);}});
 window.addEventListener('pagehide',stop);
 function refresh(item){
  prepareSymbol(item);
  if(!scene||scene.itemId!==item?.id)return;
  const cfg=profile(item);if(!cfg){stop();return;}
  if(cfg.type!==scene.cfg.type||['hot','ash','lava','rain','mist','water','cycloneStage'].some(k=>cfg[k]!==scene.cfg[k])){start(item,scene.duration);return;}
  scene.cfg=cfg;
 }
 window.CinematicCard={start,stop,refresh,prepareSymbol,isActive:()=>!!scene};
})();


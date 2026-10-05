/* Illustrative atmosphere inside the glass card. No map, feed, voice or camera writes. */
(function(){
 'use strict';
 const TYPES=new Set(['storm','hurricane','tornado','fire','volcano','flood','tsunami','earthquake','wind']);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let scene=null,ghost=null,ghostTimer=0,raf=0,idleTimer=0,serial=0;
 const rand=(a,b)=>a+Math.random()*(b-a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const panel=()=>document.getElementById('painel-direito');
 function cycloneStage(item){
  // Feed classifications win over historical mentions in a description or name.
  const classify=value=>{
   const text=String(value||'').trim();
   if(/\bTD\b|depress/i.test(text))return 'depression';
   if(/\b(?:TS|STS)\b|tempestade tropical|t\.?\s*tropical|tropical storm/i.test(text))return 'tropical-storm';
   if(/\b(?:HU|TY|STY)\b|hurricane|typhoon|furac|tuf[aã]o/i.test(text))return 'mature';
   return null;
  };
  for(const value of [item.classification,item.category,item.cycloneType,item.cycloneLabel,item.displayLabel]){
   const stage=classify(value);if(stage)return stage;
  }
  const wind=Number(item.windKmh);
  if(Number.isFinite(wind)&&wind>0)return wind<63?'depression':wind<119?'tropical-storm':'mature';
  return classify(item.warningEvent)||classify(item.detail)||'mature';
 }
 function volcanoActivity(item){
  // The same feed profile serves the menu and real records. VAAC often uses
  // aviation shorthand (VA TO FL150), while showAlertDetails translates USGS
  // text before calling us. Alert colours and a VONA alone do not prove lava.
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const fields=[item.eruptionStatus,item.activityStatus,item.vulcanicActivity,item.ashStatus,item.vonaRemarks,item.detail].map(normalize).filter(Boolean);
  const uncertain=/\bpossible\b|\bpossivel\b|\bpotential\b|\bsuspeit|\bhistor|\bprevious\b|\blast eruption\b|\bultima erupcao\b|\b(?:new activity|nova atividade eruptiva)\s*\/\s*unrest/;
  // Keep negations inside a clause and attached to their material. Repeated
  // qualifiers cover "sem evidências de emissão de cinzas ou fluxo de lava".
  const qualifiers='(?:(?:visible|observed|active|ongoing|volcanic|evidence of|signs of|evidencias? de|sinais de|emiss(?:ao|oes) de|pluma de|nuvem de|fluxos? de|escoamento de|atividade)\\s+)*';
  const absence='\\b(?:no|without|sem|nao ha|ausencia de)\\s+'+qualifiers;
  const coordinated=other=>'(?:(?:'+other+')\\s+(?:or|and|ou|e)\\s+'+qualifiers+')?';
  const ashAbsent=new RegExp(absence+coordinated('lava(?: flows?)?|fluxos? de lava|effusive activity|atividade efusiva')+'(?:ash\\b|cinzas?\\b|va\\b)');
  const lavaAbsent=new RegExp(absence+coordinated('ash(?: emissions?)?|cinzas?')+'(?:lava\\b|effusiv|efusiv)');
  const eruptionAbsent=new RegExp(absence+'(?:eruption\\b|erupcao\\b|eruptive activity\\b|atividade eruptiva\\b|eruptivo atividade\\b)');
  const quiet=text=>eruptionAbsent.test(text)||/\bno eruptivo\b|\bnot erupt|\bnao\b.{0,24}\berup|\b(?:eruption|erupcao|eruptive activity|atividade eruptiva|eruptivo atividade)(?:\s+(?:has|have|is|was|currently|now|activity|foi|esta|se|encontra|atividade|ja)){0,4}\s+(?:ended|ceased|stopped|inactive|no longer active|not (?:been )?(?:obs|detec|confirmed)|nao (?:foi |foram )?(?:observ|detect|confirm)|encerrad|cessou|terminad|inativ)|\bdormant\b|\bextinct\b|\bdormente\b|\bextinto\b/.test(text);
  const ashDenied=text=>ashAbsent.test(text)||/\b(?:ash|va|cinzas?)\b.{0,36}\b(?:not (?:been )?(?:obs|ident|detec|seen|report)|nao (?:foram |foi |sao )?(?:observ|detect|ident|vist|relat)|dissipat|dissipad|ceased|ended|cessou|encerrad)|\b(?:ash advisory|aviso de cinzas)\b.{0,20}\b(?:terminated|ended|encerrad)/.test(text);
  const lavaDenied=text=>lavaAbsent.test(text)||/\b(?:inactive|no longer active|inativ[oa]s?)\s+(?:lava\b|effusiv|efusiv)|\b(?:lava|effusiv\w*|efusiv\w*)\b.{0,36}\b(?:ended|ceased|stopped|not (?:been )?(?:resumed|obs|detec|active)|inactive|no longer active|nao (?:foi |foram )?(?:observ|detect)|cessou|encerrad|terminad|inativ)/.test(text);
  const clauses=fields.flatMap(text=>text.split(/[;,\n·.]+|\b(?:but|mas|porem|however)\b/)).map(text=>text.trim()).filter(text=>text&&!uncertain.test(text));
  const isQuiet=clauses.some(quiet);
  const eruptionConfirmed=clauses.some(text=>/\berupting\b|\b(?:ongoing|continuing|active) eruption\b|\beruption\b.{0,28}\b(?:ongoing|continues|continuing|started|observed)\b|\bem erupcao\b|\berupcao\b.{0,28}\b(?:continua|em andamento|ativa|inici|ocorr)|\b(?:active )?eruptive activity\b|\batividade eruptiva\b|\beruptiv[oa] atividade\b/.test(text)&&!quiet(text));
  const ashEmission=clauses.some(text=>/\bash emissions?\b|\bemiss(?:ao|oes)\b.{0,25}\bcinzas?\b|\bva\b.{0,15}\b(?:eruptions?|emissions?)\b/.test(text)&&!ashDenied(text));
  const eruptive=!isQuiet&&(eruptionConfirmed||ashEmission||/^(?:eruption|erupcao|erupting)$/.test(normalize(item.eruptionStatus)));
  const lava=!isQuiet&&clauses.some(text=>/\blava\b|\beffusiv|\befusiv|\bmolten\b/.test(text)&&!lavaDenied(text));
  const observedAsh=clauses.some(text=>/\bash\b|\bcinzas?\b|\bva\s+(?:plume|cld|cloud|to\b|emissions?|eruptions?|obs\b|at\b)/.test(text)&&!ashDenied(text));
  const height=normalize(item.ashHeight);
  const ashHeight=!uncertain.test(height)&&!ashDenied(height)&&(/\bfl\s*[1-9]\d*\b|\b[1-9]\d*(?:[.,]\d+)?\s*(?:m(?:eters?|etros?)?|km|ft|feet)\b/.test(height)||Number(height)>0);
  return {eruptive,lava,ash:observedAsh||ashHeight||eruptive&&!clauses.some(ashDenied)};
 }
 function profile(item){
  if(!item||!TYPES.has(item.type)||item.hazardNature==='bulletin')return null;
  const activity=item.type==='volcano'?volcanoActivity(item):{eruptive:false,lava:false,ash:false};
  let strength=.48;
  if(item.type==='earthquake'&&Number.isFinite(Number(item.mag)))strength=clamp((Number(item.mag)-1)/6,.15,1);
  else if(Number.isFinite(Number(item.windKmh))&&Number(item.windKmh)>0)strength=clamp(Number(item.windKmh)/180,.3,1);
  else if(Number(item.sev)>0)strength=clamp(Number(item.sev)/3,.3,1);
  const hot=item.type==='fire'||activity.eruptive||activity.lava;
  const ash=activity.ash;
  const rotationDirection=Number(item.coords?.[1])<0?-1:1;
  return {type:item.type,cycloneStage:cycloneStage(item),rotationDirection,strength,hot,ash,lava:activity.lava,rain:['storm','hurricane'].includes(item.type),mist:['storm','hurricane','tornado','wind'].includes(item.type)||hot||ash,water:['flood','tsunami'].includes(item.type)};
 }
 function removeGhost(){clearTimeout(ghostTimer);ghost?.remove();ghost=null;}
 const WIND_PROPERTIES=['--pd-wind-x','--pd-wind-y','--pd-wind-roll','--pd-wind-pressure','--pd-wind-flex','--pd-storm-flash'];
 function clearWind(){const p=panel();for(const key of WIND_PROPERTIES)p?.style.removeProperty(key);}
 function stop(){
  clearWind();
  serial++;cancelAnimationFrame(raf);clearTimeout(idleTimer);idleTimer=0;raf=0;
  if(scene){scene.physics?.destroy();scene.monitor?.destroy();scene.observer.disconnect();panel()?.removeEventListener('scroll',scene.scroll);scene.front?.remove();window.restoreWindLetters?.();panel()?.style.removeProperty("--pd-water-top");panel()?.style.removeProperty("--pd-gust");scene.film?.destroy();scene.footage?.destroy();scene.host.remove();panel()?.classList.remove('pd-fx-'+scene.cfg.type);scene=null;}
  panel()?.classList.remove('pd-cinema-active','pd-volcano-monitoring');removeGhost();
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
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('class','pd-cinema-symbol');svg.setAttribute('role','img');svg.setAttribute('aria-label','Ilustração do evento');const path=document.createElementNS(ns,'path');const activity=item.type==='volcano'?volcanoActivity(item):null;
  const monitoring=activity&&!activity.eruptive&&!activity.ash&&!activity.lava;
  path.setAttribute('d',monitoring?'M7 28 C7 14 57 14 57 28 C57 46 7 46 7 28 Z M15 27 C15 20 49 20 49 27 C49 36 15 36 15 27 Z M7 29 L10 44 C20 55 45 53 55 43 L57 29 M19 30 C23 41 41 41 46 30':symbolPaths[item.type]);svg.append(path);el.replaceChildren(svg);
 }
 function start(item,duration=Infinity){
  if(!item?.__cinemaDemo)window.CardEffectDemo?.cancelForRealEvent();
  if(!item?.__cinemaDemo)prepareSymbol(item);
  const p=panel(),cfg=profile(item);let snapshot=null;
  if(cfg&&scene&&!reduced.matches){snapshot=scene.canvas.cloneNode();const snap=snapshot.getContext('2d');if(scene.film)snap?.drawImage(scene.film.canvas,0,0,snapshot.width,snapshot.height);snap?.drawImage(scene.canvas,0,0);}
  stop();if(!p||!cfg||reduced.matches)return false;
  if(snapshot){ghost=document.createElement('div');ghost.className='pd-cinema-afterglow';ghost.setAttribute('aria-hidden','true');ghost.append(snapshot);ghost.style.transform='translate3d(0,'+p.scrollTop+'px,0)';p.append(ghost);ghostTimer=setTimeout(removeGhost,420);}
  const host=document.createElement('div');host.className='pd-cinema-layer';host.setAttribute('aria-hidden','true');host.dataset.scene=cfg.type;host.dataset.activity=cfg.type==='volcano'?(cfg.hot?'eruptive':cfg.ash?'ash':'monitoring'):'illustration';host.dataset.material=cfg.lava?'lava':cfg.type==='flood'?'muddy-current':cfg.type;host.dataset.demo=!!item.__cinemaDemo;
  if(cfg.type==='hurricane'){host.dataset.cycloneStage=cfg.cycloneStage;host.dataset.rotationDirection=cfg.rotationDirection;}
  const canvas=document.createElement('canvas');canvas.className='pd-cinema-particles';host.append(canvas);const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){host.remove();return false;}
  const mobile=matchMedia('(max-width:900px)').matches,now=performance.now();
  const film=window.CardCinemaFilm?.create(cfg,mobile);if(film)host.append(film.canvas);host.dataset.renderer=film?'film':'layers';
  const footage=window.CardCinemaFilm?.footage(cfg);if(footage)host.append(footage.video);
  const monitor=window.CardVolcanoMonitoring?.create(cfg,mobile);if(monitor){host.append(monitor.canvas);host.dataset.material='crater';host.dataset.renderer='crater';p.classList.add('pd-volcano-monitoring');}
  const s={film,footage,monitor,id:++serial,itemId:item.id,cfg,host,canvas,ctx,start:now,last:now,paintAt:0,duration,width:0,height:0,mobile,fog:fogTexture(),rain:[],smoke:[],particles:[],beads:[],floating:[],boltCycle:0,demoLightning:!!item.__cinemaDemo&&cfg.type==='storm'};
  if(cfg.type==='storm'&&typeof window.naturalLightning==='function'){
   s.demoBolt=document.createElementNS('http://www.w3.org/2000/svg','svg');s.demoBolt.setAttribute('viewBox','0 0 100 400');s.demoBolt.setAttribute('class','pd-cinema-demo-bolt pd-cinema-storm-bolt');s.demoBolt.setAttribute('preserveAspectRatio','none');window.naturalLightning(s.demoBolt,{heavy:true});host.append(s.demoBolt);
  }
  if(cfg.hot)heatFilter(host);
  if(cfg.rain){
   for(let i=0;i<(cfg.type==='storm'?(mobile?160:240):(mobile?76:128));i++)s.rain.push({x:Math.random(),y:Math.random(),depth:rand(.15,1),vx:0,vy:0,phase:rand(0,6.3)});
   const lenses=document.createElement('div');lenses.className='pd-cinema-lenses';host.append(lenses);
   for(let i=0;i<(cfg.type==='storm'?(mobile?20:32):(mobile?12:18));i++){const el=document.createElement('i');el.className='pd-cinema-drop';lenses.append(el);s.beads.push({x:['storm','hurricane'].includes(cfg.type)&&i%3===0?rand(.18,.82):Math.random()<.5?rand(.025,.14):rand(.86,.97),y:rand(.08,.8),r:rand(1,3),vy:0,el});}
  }
  if(cfg.mist)for(let i=0;i<(mobile?6:9);i++)s.smoke.push({x:Math.random()<.5?rand(-.12,.1):rand(.9,1.1),y:Math.random(),depth:rand(.45,1),phase:rand(0,6.3)});
  const particleCount=cfg.type==='fire'||cfg.hot?mobile?28:44:cfg.ash?mobile?18:30:cfg.type==='wind'?mobile?110:170:['tornado','earthquake'].includes(cfg.type)?mobile?12:20:0;
  for(let i=0;i<particleCount;i++)s.particles.push({x:Math.random(),y:Math.random(),depth:rand(.2,1),phase:rand(0,6.3),speed:rand(.6,1.5),vx:0,vy:0,leaf:cfg.type==='wind'&&i%10===0,ash:cfg.ash&&(i%3!==0||!cfg.hot)});
  if(cfg.water)for(let i=0;i<(mobile?16:28);i++)s.floating.push({x:Math.random(),y:Math.random(),phase:rand(0,6.3),speed:rand(.4,1),r:rand(1.5,4),foam:i%3!==0});
  const front=document.createElement('div');front.className='pd-cinema-contact';front.setAttribute('aria-hidden','true');const contact=document.createElement('canvas');front.append(contact);const lenses=host.querySelector('.pd-cinema-lenses');if(lenses)front.append(lenses);p.append(front);s.front=front;s.contact=contact;s.contactCtx=contact.getContext('2d');
  if(['wind','storm','tornado','hurricane','flood','tsunami'].includes(cfg.type))window.triggerWindLetters?.(Infinity,{controlled:cfg.type!=='tornado',allText:cfg.type!=='tornado'});
  if(['wind','storm','hurricane'].includes(cfg.type))s.wind={x:0,vx:0,roll:0,vr:0,travel:0,pressure:0,letters:new WeakMap(),groups:[]};
  s.physics=window.CardWeatherPhysics?.create(cfg,mobile,p);if(s.physics){front.append(s.physics.canvas,s.physics.lensLayer);host.dataset.weatherMaterial=cfg.water?'refractive-current':cfg.type==='wind'?'turbulent-air':'wet-glass';}
  p.append(host);p.classList.add('pd-cinema-active','pd-fx-'+cfg.type);scene=s;
  function resize(){
   if(scene!==s)return;
   const w=p.clientWidth,h=p.clientHeight,dpr=Math.min(devicePixelRatio||1,mobile?1.25:1.5);if(!w||!h)return;
   s.width=w;s.height=h;s.canvas.width=Math.round(w*dpr);s.canvas.height=Math.round(h*dpr);
   s.ctx.setTransform(dpr,0,0,dpr,0,0);s.contact.width=s.canvas.width;s.contact.height=s.canvas.height;s.contactCtx?.setTransform(dpr,0,0,dpr,0,0);
   s.film?.resize(w,h);s.footage?.resize(w,h);s.physics?.resize(w,h);s.monitor?.resize(w,h);
   // Resizing clears a canvas. Paint now so expansion never exposes a blank frame.
   const time=Math.max(0,(performance.now()-s.start)/1000);
   s.film?.draw(time,{...s.cfg,gust:s.wind?.pressure||0,windTravel:s.wind?.travel??time*.25,flash:s.flash||0,waterTop:s.waterTop??.90},(s.demoLightning||p.dataset.lightning==='on')&&s.cfg.type==='storm',s.footage?.isReady());
  }
  s.scroll=()=>{s.host.style.transform=s.front.style.transform='translate3d(0,'+p.scrollTop+'px,0)';};p.addEventListener('scroll',s.scroll,{passive:true});s.scroll();s.observer=new ResizeObserver(resize);s.observer.observe(p);resize();raf=requestAnimationFrame(frame);return true;
 }

 // One pressure wave drives the suspended glass, text, haze and airborne matter.
 function windPressure(t,x=0){
  const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a),0,1);return v*v*(3-2*v);};
  const delayed=Math.max(0,t-x*.42),cycle=Math.floor(delayed/9.6),phase=delayed%9.6;
  const pulse=(start,hold,end)=>smooth(start,start+.55,phase)*(1-smooth(hold,end,phase));
  const burst=pulse(.65,1.55,3.85)+pulse(5.9,6.65,8.45)*.72;
  const turbulence=1+.065*Math.sin(t*12.3-x*4)+.035*Math.sin(t*21.7+x*3);
  return clamp(burst*(.88+.12*Math.sin(cycle*2.17+.9))*turbulence,0,1.1);
 }
 function pressureAt(s,t,x=0){
  // Cyclone rainbands bring sustained wind, with lulls between stronger gusts.
  // A gale never becomes still: two fast squalls pass over the steady air stream.
  if(s.cfg.type==='wind')return clamp(.11+.92*windPressure(t,x)+.018*Math.sin(t*4.1-x*3),.08,1);
  return s.cfg.type==='hurricane'?.16+.84*windPressure(t,x):windPressure(t,x);
 }
 function windResponse(s,t,dt,envelope){
  const state=s.wind,p=panel();if(!state||!p)return;
  const cyclone=s.cfg.type==='hurricane',gale=s.cfg.type==='wind';
  // Unknown wind speeds still look like a gale, while reported severity modulates it.
  const strength=gale?.7+.3*s.cfg.strength:s.cfg.strength;
  const pressure=pressureAt(s,t,.45)*strength*(s.cfg.type==='storm'?.72:1)*envelope;
  state.pressure=pressure;state.travel+=dt*(gale?.24+pressure*1.85:.08+pressure*.80);
  // Damped springs resist the gust, then settle rather than vibrating forever.
  const buffeting=cyclone?Math.sin(t*17.2)*pressure*pressure*.65:gale?(Math.sin(t*14.7)*.7+Math.sin(t*23.3)*.35)*pressure*pressure:0;
  state.vx+=((pressure*(s.mobile?(gale?6.5:cyclone?5:4):(gale?11.5:cyclone?9:7))+buffeting-state.x)*78-state.vx*13)*dt;state.x+=state.vx*dt;
  if(gale)state.x=clamp(state.x,-2,s.mobile?7:12);
  state.vr+=((pressure*(gale?(s.mobile?.65:.9):cyclone?.76:.48)+(gale?buffeting*.07:0)-state.roll)*62-state.vr*12)*dt;state.roll+=state.vr*dt;
  p.style.setProperty('--pd-wind-x',state.x.toFixed(3)+'px');
  p.style.setProperty('--pd-wind-y',(-Math.abs(state.x)*.13).toFixed(3)+'px');
  p.style.setProperty('--pd-wind-roll',state.roll.toFixed(3)+'deg');
  p.style.setProperty('--pd-wind-pressure',pressure.toFixed(3));
  p.style.setProperty('--pd-wind-flex',(state.x*.35).toFixed(3)+'px');
  if(cyclone||gale||s.cfg.type==='storm'){
   if(!state.nextGroups||t>=state.nextGroups){
    state.nextGroups=t+.25;
    state.groups=Array.from(p.querySelectorAll('[data-cyclone-text]'),el=>({el,spans:Array.from(el.querySelectorAll('.pd-fx-windletter')),offset:(el.offsetTop||0)/Math.max(s.height,1)}));
   }
   for(const group of state.groups){
    const title=group.el.id==='pd-local',length=Math.max(1,group.spans.length-1);
    group.spans.forEach((el,i)=>{
     let letter=state.letters.get(el);if(!letter){letter={x:0,v:0};state.letters.set(el,letter);}
     const fraction=i/length,local=pressureAt(s,t-group.offset*.20,fraction)*strength*envelope;
     // The wave reaches each word in sequence; springs return the actual glyphs.
     const gust=gale?Math.pow(clamp((local-.13)/.68,0,1),1.25):local;
     const flutter=Math.sin(t*(gale?13.5+fraction*3.1:9.5+fraction*2.1)-i*.52-group.offset*5)*gust*gust;
     const target=gale?(gust*(title?(8+fraction*11)*(s.mobile?.78:1):2+fraction*4)+flutter*(title?3.5:.8)):local*(title?6+fraction*8:1.4+fraction*3.2)+flutter*(title?1.5:.5);
     const load=s.physics?(title?1.6:1.25):1;
     letter.v+=((target*load-letter.x)*105-letter.v*14)*dt;letter.x+=letter.v*dt;
     const lift=-letter.x*(gale?.30:.24)+flutter*(title?(gale?1.2:.85):.25),roll=letter.x*(gale?.72:.85)+flutter*(gale?2:1.4);
     el.style.transform='translate3d('+letter.x.toFixed(2)+'px,'+lift.toFixed(2)+'px,0) rotate('+roll.toFixed(2)+'deg)';
    });
   }
   return;
  }
  const spans=p.querySelectorAll('#pd-local .pd-fx-windletter'),length=Math.max(1,spans.length-1);
  spans.forEach((el,i)=>{
   let letter=state.letters.get(el);if(!letter){letter={x:0,v:0};state.letters.set(el,letter);}
   const local=windPressure(t,i/length)*s.cfg.strength*(s.cfg.type==='storm'?.65:1)*envelope;
   const target=local*(4.5+3.5*i/length);
   letter.v+=((target-letter.x)*105-letter.v*14)*dt;letter.x+=letter.v*dt;
   const lift=-letter.x*.24+Math.sin(t*13-i*.45)*local*.28;
   el.style.transform='translate3d('+letter.x.toFixed(2)+'px,'+lift.toFixed(2)+'px,0) rotate('+(letter.x*.7).toFixed(2)+'deg)';
  });
 }
 function windMatter(s,t,dt,envelope){
  const ctx=s.contactCtx,{width:w,height:h}=s;if(!ctx)return;
  for(let i=0;i<s.particles.length;i++){
   const p=s.particles[i],pressure=pressureAt(s,t,clamp(p.x,0,1))*(.7+.3*s.cfg.strength);
   // Near dust moves much faster than distant haze; broadside leaves lag the air.
   const speed=(130+pressure*1550)*(.28+p.depth*.94);
   const response=1-Math.exp(-dt*(p.leaf?4.5:13));
   p.vx+=(speed-p.vx)*response;
   p.vy+=((-p.vx*.13+Math.sin(t*5.2+p.phase)*pressure*(p.leaf?115:46)+(p.leaf?20:3))-p.vy)*response;
   p.x+=p.vx*dt/w;p.y+=p.vy*dt/h;
   if(p.x>1.12||p.y<-.12||p.y>1.12){p.x=rand(-.25,-.05);p.y=Math.random();}
   const x=p.x*w,y=p.y*h,alpha=envelope*(.14+p.depth*.29)*(.55+pressure*.45)*edge(p.x*w,w);
   ctx.save();ctx.translate(x,y);
   if(p.leaf){
    const angle=Math.atan2(p.vy,p.vx)+Math.sin(t*(3+p.depth*5)+p.phase)*1.15;
    ctx.rotate(angle);ctx.scale(1,.3+.7*Math.abs(Math.sin(t*8.4+p.phase)));const r=2+p.depth*4;
    ctx.fillStyle='rgba(142,132,99,'+alpha.toFixed(3)+')';
    ctx.beginPath();ctx.moveTo(-r,0);ctx.quadraticCurveTo(0,-r*.7,r,0);ctx.quadraticCurveTo(0,r*.45,-r,0);ctx.fill();
    ctx.strokeStyle='rgba(198,181,132,'+(alpha*.7).toFixed(3)+')';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.stroke();
   }else{
    // Short exposure streaks belong to dust, never to the invisible air.
    const length=Math.min(28,Math.max(1.2,p.vx*.019));
    const spray=i%4===0;
    ctx.strokeStyle=(spray?'rgba(223,234,232,':'rgba(207,204,189,')+alpha.toFixed(3)+')';ctx.lineWidth= spray?.6+p.depth:.3+p.depth*.55;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-length,-p.vy*.019);ctx.stroke();
   }
   ctx.restore();
  }
 }


 function stormLight(s,t){
  const cycle=Math.floor(t/14.7),phase=t%14.7,jitter=Math.sin(cycle*2.41)*.55;
  const times=[2.3+jitter,9.1+jitter*.6];
  // A return stroke lights the channels twice, then the cloud glow decays.
  const pulse=d=>d>=0&&d<.42?Math.exp(-d*22)+.56*(d>.12?Math.exp(-(d-.12)*31):0):0;
  const enabled=s.demoLightning||panel()?.dataset.lightning==='on';
  s.flash=enabled?Math.min(1,pulse(phase-times[0])+pulse(phase-times[1])):0;
  panel()?.style.setProperty('--pd-storm-flash',s.flash.toFixed(3));
  if(s.demoBolt){
   const strike=cycle*2+(phase>=times[1]?1:0);
   if(s.flash>.01&&s.lastStrike!==strike){
    s.lastStrike=strike;window.naturalLightning?.(s.demoBolt,{heavy:true});
    s.demoBolt.style.left='0';
   }
   s.demoBolt.style.opacity=(s.flash*.96).toFixed(3);
  }
 }
 function stormRain(s,t,dt,envelope,front){
  const ctx=front?s.contactCtx:s.ctx,{width:w,height:h}=s;if(!ctx)return;
  for(const d of s.rain){
   if((d.depth>=.58)!==front)continue;
   const force=windPressure(t,clamp(d.x,0,1))*(.45+.55*s.cfg.strength);
   const turbulence=Math.sin(t*4.2+d.phase+d.y*6)*force;
   const speed=370+d.depth*830+turbulence*55;
   const target=(65+force*450+turbulence*65)*(.3+d.depth*.7);
   d.vx+=(target-d.vx)*(1-Math.exp(-dt*9));
   d.vy+=(speed-d.vy)*(1-Math.exp(-dt*11));
   d.y+=d.vy*dt/h;d.x+=d.vx*dt/w;
   if(d.y>1.09){d.y=rand(-.15,-.03);d.x=Math.random();}
   if(d.x>1.1)d.x=-.1;
   const exposure=.007+d.depth*.014,x=d.x*w,y=d.y*h;
   const alpha=(front?.075+d.depth*.15:.045+d.depth*.095)*envelope*(1+(s.flash||0)*.9);
   ctx.strokeStyle='rgba(216,230,237,'+alpha.toFixed(3)+')';ctx.lineWidth=.3+d.depth*.95;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-d.vx*exposure,y-d.vy*exposure);ctx.stroke();
  }
 }
 function stormSpray(s,t,envelope){
  const ctx=s.contactCtx,{width:w,height:h}=s,force=s.wind?.pressure||0;
  // Low drifting water mist and highlights scatter the stroke over wet glass.
  for(let i=0;i<(s.mobile?3:5);i++){
   const progress=((s.wind?.travel||t*.2)*(.9+i*.17)+i*.281)%1;
   const size=w*(.8+i*.08),x=(progress*1.8-.4)*w,y=h*(.54+((i*.163)%1)*.4);
   ctx.globalAlpha=envelope*(.035+force*.11+(s.flash||0)*.14);
   ctx.drawImage(s.fog,x-size*.5,y-size*.15,size,size*.3);
  }
  ctx.globalAlpha=1;
 }
 function cycloneRain(s,t,dt,envelope,front){
  const ctx=front?s.contactCtx:s.ctx,{width:w,height:h}=s;if(!ctx)return;
  for(const drop of s.rain){
   if((drop.depth>=.58)!==front)continue;
   const force=pressureAt(s,t,clamp(drop.x,0,1))*s.cfg.strength;
   const response=1-Math.exp(-dt*7);
   const turbulence=Math.sin(t*4.6+drop.phase+drop.y*5)*force;
   drop.vx+=((95+force*640)*(.35+drop.depth*.65)-drop.vx)*response;
   drop.vy+=((170+drop.depth*410+turbulence*50)-drop.vy)*response;
   drop.x+=drop.vx*dt/w;drop.y+=drop.vy*dt/h;
   if(drop.x>1.12||drop.y>1.12){
    if(Math.random()<.58){drop.x=rand(-.18,-.03);drop.y=Math.random();}
    else{drop.y=rand(-.16,-.02);drop.x=Math.random();}
   }
   const exposure=.018+drop.depth*.022,x=drop.x*w,y=drop.y*h;
   const alpha=(front?.11+drop.depth*.16:.045+drop.depth*.08)*envelope;
   ctx.strokeStyle='rgba(218,232,239,'+alpha.toFixed(3)+')';ctx.lineWidth=.35+drop.depth*.85;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-drop.vx*exposure,y-drop.vy*exposure);ctx.stroke();
  }
 }
 function cycloneSpray(s,t,envelope){
  const ctx=s.contactCtx,{width:w,height:h}=s,force=s.wind?.pressure||0;
  // Thin wind-blown spray passes in front of the wet glass, with no opaque veil.
  for(let i=0;i<(s.mobile?3:5);i++){
   const progress=((s.wind?.travel||t*.2)*(.85+i*.11)+i*.317)%1;
   const x=(progress*1.8-.4)*w,y=h*(.12+((i*.283)%1))+Math.sin(t*.8+i)*18;
   const size=w*(.6+i*.06);
   ctx.globalAlpha=envelope*(.025+force*.12);
   ctx.drawImage(s.fog,x-size*.5,y-size*.15,size,size*.3);
  }
  ctx.globalAlpha=1;
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
  const {ctx,width:w,height:h,cfg}=s;const gust=cfg.type==='hurricane'?110+28*Math.sin(t*.31)+16*Math.sin(t*.73):8+22*Math.sin(t*.67);
  if(cfg.type==='storm')stormRain(s,t,dt,envelope,true);
  if(cfg.type==='hurricane')cycloneRain(s,t,dt,envelope,true);
  for(const drop of ['storm','hurricane'].includes(cfg.type)?[]:s.rain){
   const speed=(220+drop.depth*460)*(1+cfg.strength*.35);drop.y+=speed*dt/h;drop.x+=gust*dt/w*(.5+drop.depth);if(drop.y>1.06){drop.y=-.08;drop.x=Math.random();}if(drop.x>1.08)drop.x=-.08;if(drop.x<-.08)drop.x=1.08;
   const x=drop.x*w,y=drop.y*h,len=8+drop.depth*25;ctx.strokeStyle='rgba(210,231,246,'+((cfg.type==='hurricane'?.06+drop.depth*.20:.14+drop.depth*.38)*envelope*edge(x,w)).toFixed(3)+')';ctx.lineWidth=.45+drop.depth*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-gust/speed*len,y-len);ctx.stroke();
  }
  // Gravity starts after a droplet accumulates mass. Nearby drops merge by volume.
  for(const b of s.beads){if(['storm','hurricane'].includes(cfg.type))b.x=clamp(b.x+dt*(s.wind?.pressure||0)*(cfg.type==='hurricane'?.018:.014),.015,.985);b.r+=dt*(cfg.type==='storm'?.32+cfg.strength*.2:.14+cfg.strength*.12);if(b.r>2.65)b.vy=Math.min(cfg.type==='storm'?115:80,(b.vy+dt*(cfg.type==='storm'?32:20))*(1+dt*.4));b.y+=b.vy*dt/h;
   if(b.y>1.04){b.y=rand(-.05,.05);b.r=rand(.9,1.6);b.vy=0;}
   for(const q of s.beads){if(q===b||q.r<.2)continue;const dx=(b.x-q.x)*w,dy=(b.y-q.y)*h;if(dx*dx+dy*dy<Math.pow((b.r+q.r)*.72,2)){b.r=Math.min(6.5,Math.cbrt(b.r**3+q.r**3));q.y=rand(-.06,.04);q.r=rand(.7,1.2);q.vy=0;b.vy=Math.max(b.vy,8);}}
   const x=b.x*w,y=b.y*h,stretch=1+Math.min(.5,b.vy/140);b.el.style.width=(b.r*2).toFixed(1)+'px';b.el.style.height=(b.r*2*stretch).toFixed(1)+'px';b.el.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';
   if(b.vy>5){const tail=Math.min(35,b.vy*.4);ctx.strokeStyle='rgba(209,232,245,'+(.12*envelope).toFixed(3)+')';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-(cfg.type==='hurricane'?(s.wind?.pressure||0)*tail*.25:0),y-tail);ctx.stroke();}
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
  if(cfg.type==='flood'){
   const current=ctx.createLinearGradient(0,0,w,h);current.addColorStop(0,'rgba(116,96,65,.94)');current.addColorStop(1,'rgba(46,42,31,.94)');ctx.fillStyle=current;ctx.fillRect(0,0,w,h);return;
  }
  // Full-frame reserve only; no calm beach, lower-half mask or inferred depth.
  const surge=ctx.createLinearGradient(0,0,w,h);surge.addColorStop(0,'rgba(101,109,99,.94)');surge.addColorStop(1,'rgba(37,46,41,.94)');ctx.fillStyle=surge;ctx.fillRect(0,0,w,h);
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
  if(cfg.type==='hurricane')cycloneSpray(s,t,envelope);
  if(cfg.type==='storm')stormSpray(s,t,envelope);
  if(cfg.type==='wind')windMatter(s,t,dt,envelope);
  if(cfg.water){
   // One continuous full-card current; no second framing or moving cut line.
   s.waterTop=0;p?.style.setProperty('--pd-water-top','0%');
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
  const fps=s.mobile?24:30;if(now-s.paintAt>=1000/fps&&s.width&&s.height){
   const dt=Math.max(0,Math.min(.06,(now-s.last)/1000));s.last=now;s.paintAt=now;
   const fadeIn=clamp(t/.55,0,1),fadeOut=Number.isFinite(s.duration)?clamp((s.duration/1000-t)/.85,0,1):1,envelope=Math.min(fadeIn,fadeOut);s.host.style.opacity=envelope.toFixed(3);
   if(s.wind)windResponse(s,t,dt,envelope);
   if(s.cfg.type==='storm')stormLight(s,t);
   s.ctx.clearRect(0,0,s.width,s.height);illuminate(s,t,envelope);
   if(s.cfg.type==='storm')stormRain(s,t,dt,envelope,false);
   if(s.cfg.type==='hurricane')cycloneRain(s,t,dt,envelope,false);
   contactSurface(s,t,dt,envelope);
   if(s.cfg.mist&&!s.film)atmosphere(s,t,dt,envelope);
   if(s.particles.length&&!s.wind)debris(s,t,dt,envelope);
   if(s.cfg.water&&!s.film&&!s.physics&&!s.footage?.isReady())water(s,t,envelope);
   if(s.floating.length&&!s.physics&&!s.footage?.isReady())surfaceDebris(s,t,dt,envelope);
   s.monitor?.draw(t);
   const ready=s.footage?.isReady();
   s.physics?.draw(t,dt,envelope,{pressure:s.wind?.pressure||0,flash:s.flash||0,waterTop:s.waterTop,fallback:!ready&&!s.film});
   s.film?.draw(t,{...s.cfg,gust:s.wind?.pressure||0,windTravel:s.wind?.travel??t*.25,flash:s.flash||0,waterTop:s.waterTop},(s.demoLightning||p.dataset.lightning==='on')&&s.cfg.type==='storm',ready);
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
  if(cfg.type==='hurricane')scene.host.dataset.rotationDirection=cfg.rotationDirection;
 }
 window.CinematicCard={start,stop,refresh,prepareSymbol,isActive:()=>!!scene};
})();

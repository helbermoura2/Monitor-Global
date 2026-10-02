/* Seismic presentation, independent of feeds, audio and map camera.
   Full scenes: new/manual M6+. Rotation: brief card vibration only.
   Demonstrations never write events or change the selected record. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const knownIntensity=new Map();let job=null,seq=0,dialog=null,previewBar=null;
 const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const roman=n=>['I','II','III','IV','V','VI','VII','VIII','IX','X'][clamp(Math.round(n),1,10)-1];
 // Same hypocentral model as population-exposure-worker.mjs (Allen et al., 2012).
 // This is the epicentral estimate, not shaking at the viewer's location.
 function estimate(mag,depth,distance=0){
  const hypo=Math.hypot(Math.max(0,distance),depth>0?Math.max(1,depth):10);
  const smoothing=-.209+2.042*Math.exp(mag-5);
  return clamp(2.085+1.428*mag-1.402*Math.log(Math.hypot(hypo,smoothing))+(hypo>50?.078*Math.log(hypo/50):0),1,10);
 }
 function profile(item,mode='manual'){
  const mag=clamp(Number(item.mag)||0,0,10),depth=Number.isFinite(Number(item.depth))?Math.max(0,Number(item.depth)):10;
  const known=knownIntensity.get(item.id);
  const reported=[known?.value,item.maxmmi,item.mmi].find(x=>x!=null&&Number.isFinite(Number(x))&&Number(x)>0);
  const mmi=reported!=null?clamp(Number(reported),1,10):estimate(mag,depth);
  const full=mag>=6&&mode!=='auto',strength=clamp((mmi-2)/6,0,1);
  const tier=mag>=8?3:mag>=7?2:mag>=6?1:0;
  const duration=full?[0,10000,13000,16000][tier]:mode==='auto'?1300:600+strength*2300;
  return {mag,depth,mmi,source:reported!=null?(known?.source||'MMI fornecido pela fonte'):'Estimativa epicentral · Allen et al. (2012)',mode,full,tier,strength,duration,
   amplitude:full?3+strength*(tier===3?37:tier===2?29:22):mode==='auto'?Math.min(1.4,.3+strength*1.1):.25+strength*4.5,
   rotation:full?(tier===3?.65:tier===2?.48:.34):.045,
   pieces:full?Math.round((tier===3?24:tier===2?18:12)*(.35+.65*strength)):0};
 }
 function envelope(t,p){
  const attack=1-Math.exp(-t*12),decay=Math.pow(Math.max(0,1-t/(p.duration/1000)),p.full?.85:1.5);
  const primary=Math.exp(-Math.pow((t-.8)/.65,2));
  const secondary=p.full?.68*Math.exp(-Math.pow((t-3)/1.2,2))+.42*Math.exp(-Math.pow((t-5.6)/1.3,2)):0;
  return attack*decay*(p.full?.25:.18)+attack*decay*(.82*primary+secondary);
 }
 function keyframes(p){
  const frames=[],seed=Math.random()*6.28,n=Math.ceil(p.duration/25);
  for(let i=0;i<=n;i++){
   const t=i*p.duration/n/1000,e=envelope(t,p);
   const x=(Math.sin(t*38+seed)*.42+Math.sin(t*61)*.2+Math.sin(t*9)*.38)*p.amplitude*e;
   const y=(Math.sin(t*42+seed)*.55+Math.sin(t*16)*.45)*p.amplitude*e*(p.full?.65:.42);
   frames.push({offset:i/n,translate:`${x.toFixed(3)}px ${y.toFixed(3)}px`,rotate:`${(Math.sin(t*8+seed)*e*p.rotation*p.strength).toFixed(4)}deg`});
  }
  frames[0]={offset:0,translate:'0px 0px',rotate:'0deg'};frames[n]={offset:1,translate:'0px 0px',rotate:'0deg'};return frames;
 }
 function stop(){
  if(job){cancelAnimationFrame(job.raf);clearTimeout(job.timer);job.animations.forEach(a=>a.cancel());job.layer?.remove();
  job.swayTargets.forEach(el=>el.removeAttribute('data-seismic-sway'));
  job.target?.removeAttribute('data-seismic-motion');job=null;}
  if(previewBar){previewBar.remove();previewBar=null;}
 }
 function pieceCandidates(p){
  const selectors=['.mg-logo-icon','#kpi-temp','#kpi-wind','#kpi-brent-label','#chips-row .chip','#pd-flag'];
  if(p.tier>=2)selectors.push('#events .event-mag','#painel-direito .stat-card');
  const list=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))].filter(el=>{
   const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.visibility!=='hidden'&&Number(cs.opacity)>0&&r.width>5&&r.height>5&&r.width<innerWidth*.7&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&!el.closest('#seismic-demo-dialog');
  });
  for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list.slice(0,p.pieces);
 }
 function copyPiece(el,index,total,p,layer){
  const rect=el.getBoundingClientRect(),cs=getComputedStyle(el),shell=document.createElement('div'),copy=el.cloneNode(true);
  shell.className='seismic-piece';shell.setAttribute('aria-hidden','true');shell.inert=true;
  for(const node of [copy,...copy.querySelectorAll('*')]){
   node.removeAttribute('id');for(const a of [...node.attributes])if(/^on/i.test(a.name))node.removeAttribute(a.name);
   node.setAttribute('tabindex','-1');
  }
  Object.assign(copy.style,{margin:'0',font:cs.font,color:cs.color,background:cs.background,border:cs.border,borderRadius:cs.borderRadius,boxShadow:cs.boxShadow,width:rect.width+'px',height:rect.height+'px',position:'static',animation:'none',transform:'none'});
  shell.append(copy);Object.assign(shell.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});layer.append(shell);
  return {el:shell,x:rect.left,y:rect.top,w:rect.width,h:rect.height,start:.55+index/Math.max(1,total)*(p.duration/1000-3)+Math.random()*.22,
   vx:(Math.random()-.5)*(45+p.tier*20),spin:(Math.random()-.5)*(60+p.tier*45),depth:.65+Math.random()*.65};
 }
 function createScene(p){
  const layer=document.createElement('div');layer.className='seismic-scene';layer.dataset.tier=p.tier;layer.setAttribute('aria-hidden','true');layer.inert=true;
  const canvas=document.createElement('canvas');canvas.className='seismic-atmosphere';layer.append(canvas);
  const ctx=canvas.getContext('2d'),w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);ctx?.scale(dpr,dpr);
  const targets=pieceCandidates(p);const pieces=targets.map((el,i)=>copyPiece(el,i,targets.length,p,layer));
  // A reusable soft particle makes drifting dust volumetric without expensive
  // per-frame CSS blurs. Clear centres leave the event text readable.
  const plume=document.createElement('canvas');plume.width=plume.height=96;
  const pc=plume.getContext('2d');if(pc){const g=pc.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,'rgba(191,178,156,.5)');g.addColorStop(.35,'rgba(168,154,132,.25)');g.addColorStop(1,'rgba(143,129,107,0)');pc.fillStyle=g;pc.fillRect(0,0,96,96);}
  const dust=Array.from({length:innerWidth<700?90:180},()=>({x:Math.random()*w,y:Math.random()*h,r:.6+Math.random()*2.6,z:.25+Math.random()*.75,phase:Math.random()*6.28}));
  const clouds=Array.from({length:innerWidth<700?12:20},()=>({x:Math.random()<.5?Math.random()*w*.12:w*(.88+Math.random()*.12),y:Math.random()*h,r:60+Math.random()*100,z:.4+Math.random()*.6,phase:Math.random()*6.28}));
  const shards=Array.from({length:Math.round((innerWidth<700?18:32)*(.4+.6*p.strength)*p.tier)},(_,i)=>{
   const source=pieces[i%Math.max(1,pieces.length)],x=source?source.x+source.w*Math.random():Math.random()*w;
   return {x,y:source?source.y+source.h*.5:Math.random()*h*.2,start:.25+Math.random()*(p.duration/1000-4),vx:(Math.random()-.5)*110,g:220+Math.random()*200,spin:(Math.random()-.5)*10,r:2+Math.random()*5,points:[[-.8,-.3],[.4,-.9],[1,.3],[-.2,.7]],tone:Math.random()<.45?'#748a92':'#263e49'};
  });
  document.body.append(layer);return {layer,ctx,w,h,pieces,dust,clouds,shards,plume};
 }
 function draw(scene,t,p){
  const {ctx,w,h,dust,pieces,clouds,shards,plume}=scene,fade=Math.min(1,t*2)*clamp((p.duration/1000-t)/2,0,1);
  if(ctx){
   ctx.clearRect(0,0,w,h);
   // Soft drifting occlusion around the perimeter, rather than black flashes.
   const shade=ctx.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.75);
   shade.addColorStop(0,'rgba(6,10,14,0)');shade.addColorStop(1,`rgba(6,10,14,${fade*(.12+p.strength*.13)})`);ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   for(const c of clouds){
    const x=c.x+Math.sin(t*.7+c.phase)*22*c.z,y=c.y+t*12*c.z,size=c.r*(1+t*.04);
    ctx.globalAlpha=fade*(.22+.26*p.strength)*c.z;ctx.drawImage(plume,x-size,y-size,size*2,size*2);
   }
   for(const d of dust){
    const x=d.x+Math.sin(t*1.1+d.phase)*18*d.z+t*12*d.z,y=d.y+t*24*d.z;
    const edge=Math.pow(Math.abs(x-w/2)/(w/2),1.5);ctx.globalAlpha=fade*(.07+.3*edge)*d.z*p.strength;
    ctx.fillStyle='#d4cec2';ctx.beginPath();ctx.ellipse(x%w,y%h,d.r,d.r*.6,.2,0,Math.PI*2);ctx.fill();
   }
   for(const s of shards){
    const age=t-s.start;if(age<0||age>3.2)continue;
    const x=s.x+s.vx*age,y=s.y+.5*s.g*age*age;
    ctx.save();ctx.translate(x,y);ctx.rotate(s.spin*age);ctx.globalAlpha=fade*clamp((3.2-age)/.8,0,.85);ctx.fillStyle=s.tone;ctx.beginPath();s.points.forEach((pt,i)=>i?ctx.lineTo(pt[0]*s.r,pt[1]*s.r):ctx.moveTo(pt[0]*s.r,pt[1]*s.r));ctx.closePath();ctx.fill();ctx.strokeStyle='#bcc9ca';ctx.globalAlpha*=.35;ctx.lineWidth=.6;ctx.stroke();ctx.restore();
   }ctx.globalAlpha=1;
  }
  for(const piece of pieces){
   const age=t-piece.start;if(age<0){piece.el.style.opacity='0';continue;}
   const travel=Math.min(age,3.2),g=260+90*piece.depth,floor=Math.max(0,h-piece.y-piece.h-8),hit=Math.sqrt(2*floor/g),after=Math.max(0,travel-hit);
   const dy=travel<hit?.5*g*travel*travel:floor-Math.abs(Math.sin(after*7))*Math.min(50,Math.sqrt(2*g*floor)*.14)*Math.exp(-after*4);
   piece.el.style.opacity=String(clamp(1-Math.max(0,age-2.2),0,1));
   piece.el.style.transform=`translate3d(${(piece.vx*travel).toFixed(1)}px,${dy.toFixed(1)}px,0) rotate(${(piece.spin*travel*travel*.3).toFixed(1)}deg)`;
  }
 }
 function play(item,mode='manual',demo=false){
  stop();const p=profile(item,mode);
  const target=document.getElementById(p.full?'app':'painel-direito');
  if(!target)return p;
  // Reduced-motion users see the explanation/preview label, with no shake or debris.
  if(reduced()){if(demo)showPreviewBar(p,true);return p;}
  const scene=p.full?createScene(p):null;
  target.dataset.seismicMotion=p.full?'full':'discreet';
  const animations=[],swayTargets=[];
  const animate=(el,pr)=>{if(typeof el.animate==='function')animations.push(el.animate(keyframes(pr),{duration:p.duration,easing:'linear',fill:'none'}));};
  animate(target,p);
  if(p.full){for(const [id,factor] of [['top-strip',.22],['painel-direito',.32],['events',.18]]){
   const el=document.getElementById(id);if(!el||!el.getClientRects().length)continue;
   el.dataset.seismicSway='true';swayTargets.push(el);animate(el,{...p,amplitude:p.amplitude*factor,rotation:p.rotation*factor});
  }}
  const token=++seq;job={token,target,animations,swayTargets,layer:scene?.layer,raf:0,timer:null,profile:p,demo};
  const start=performance.now();
  if(scene){const tick=now=>{if(job?.token!==token)return;draw(scene,(now-start)/1000,p);job.raf=requestAnimationFrame(tick);};job.raf=requestAnimationFrame(tick);}
  if(demo)showPreviewBar(p,false);
  job.timer=setTimeout(()=>{if(job?.token!==token)return;stop();if(demo)showPreviewBar(p,false,true);},p.duration+50);
  return p;
 }
 function showPreviewBar(p,motionOff,done=false){
  previewBar?.remove();const bar=document.createElement('aside');bar.id='seismic-demo-status';bar.setAttribute('aria-live','polite');
  const text=document.createElement('span');text.textContent=`DEMONSTRAÇÃO · M${p.mag.toFixed(1)} · ${p.full?'Tela inteira':'Discreto'} · MMI ${roman(p.mmi)} EST${motionOff?' · Movimento reduzido':done?' · Concluída':''}`;
  const edit=document.createElement('button');edit.type='button';edit.textContent='Trocar';edit.onclick=()=>{stop();bar.remove();openDemo();};
  const end=document.createElement('button');end.type='button';end.textContent=done||motionOff?'Fechar':'Parar';end.onclick=()=>{stop();bar.remove();};bar.append(text,edit,end);document.body.append(bar);previewBar=bar;
 }
 function openDemo(){
  stop();dialog?.remove();dialog=document.createElement('section');dialog.id='seismic-demo-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Demonstração de efeitos sísmicos');
  dialog.innerHTML='<button type="button" class="seismic-demo-close" aria-label="Fechar demonstração">×</button><h3>Efeitos sísmicos · demonstração</h3><p>Compare os efeitos na tela atual. Sem criar evento, mover a câmera ou tocar alarme.</p><label>Magnitude<select id="seismic-demo-mag"><option value="2">M2.0 · Vibração leve</option><option value="5.9">M5.9 · Cartão</option><option value="6.1" selected>M6.1 · Tela inteira</option><option value="6.5">M6.5 · Tela inteira</option><option value="7.5">M7.5 · Caos</option><option value="8.2">M8.2 · Caos intenso</option></select></label><label>Profundidade<select id="seismic-demo-depth"><option value="10">10 km · Raso</option><option value="43">43 km · Comparar com o vídeo</option><option value="100">100 km · Intermediário</option><option value="500">500 km · Profundo</option></select></label><label>Apresentação<select id="seismic-demo-mode"><option value="manual">Evento novo / clique manual</option><option value="auto">Ciclo aleatório · discreto</option></select></label><p class="seismic-demo-intensity"></p><p class="seismic-demo-note">Intensidade estimada na região do epicentro. As quedas são uma ilustração, não confirmação de danos.</p><button type="button" id="seismic-demo-play">Reproduzir efeito</button>';
  const close=()=>{dialog?.remove();dialog=null;document.getElementById('fab-menu')?.focus();};dialog.querySelector('.seismic-demo-close').onclick=close;
  const current=()=>({mag:Number(dialog.querySelector('#seismic-demo-mag').value),depth:Number(dialog.querySelector('#seismic-demo-depth').value)});
  const update=()=>{const p=profile(current(),dialog.querySelector('#seismic-demo-mode').value);dialog.querySelector('.seismic-demo-intensity').textContent=`MMI ${roman(p.mmi)} estimado · ${p.full?'Tela inteira':'Cartão'} · ${(p.duration/1000).toFixed(1)} s`;};
  dialog.querySelectorAll('select').forEach(s=>s.onchange=update);dialog.querySelector('#seismic-demo-play').onclick=()=>{const item=current(),mode=dialog.querySelector('#seismic-demo-mode').value;close();play(item,mode,true);};
  document.body.append(dialog);update();dialog.querySelector('#seismic-demo-mag').focus();
 }
 const api={profile,estimate,play,stop,openDemo,intensitySummary(item){const p=profile(item,'auto'),n=clamp(Math.round(p.mmi),1,10);return {nivel:roman(p.mmi),desc:['Não perceptível','Muito fraco','Fraco','Leve','Moderado','Forte','Muito forte','Severo','Violento','Extremo'][n-1]+'.',cor:n<3?'#4ade80':n<5?'#facc15':n<7?'#fb923c':'#ef4444'};},state:()=>job?{...job.profile,demo:job.demo}:null,
  recordIntensity(id,value,source){if(id!=null&&Number.isFinite(Number(value))&&Number(value)>0){knownIntensity.set(id,{value:Number(value),source});if(knownIntensity.size>200)knownIntensity.delete(knownIntensity.keys().next().value);}}};
 root.SeismicCinema=api;
 root.triggerSiteChaos=(mag,context={})=>play(context.item||{mag,depth:10},context.mode||'manual');
 document.documentElement.classList.add('mg-seismic-managed');
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){stop();dialog?.remove();dialog=null;previewBar?.remove();previewBar=null;}});
 root.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{if(e.matches)stop();});
})(window);

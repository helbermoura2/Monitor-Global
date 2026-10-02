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
  const duration=full?[0,7200,10000,12500][tier]:mode==='auto'?1300:600+strength*2300;
  return {mag,depth,mmi,source:reported!=null?(known?.source||'MMI fornecido pela fonte'):'Estimativa epicentral · Allen et al. (2012)',mode,full,tier,strength,duration,
   amplitude:full?1.5+strength*(tier===3?11:tier===2?8:5):mode==='auto'?Math.min(1.4,.3+strength*1.1):.25+strength*4.5,
   pieces:full?Math.round((tier===3?22:tier===2?14:6)*(.3+.7*strength)):0};
 }
 function envelope(t,p){
  const attack=1-Math.exp(-t*12),decay=Math.pow(Math.max(0,1-t/(p.duration/1000)),1.5);
  const primary=Math.exp(-Math.pow((t-.8)/.65,2));
  const secondary=p.full?.42*Math.exp(-Math.pow((t-2.7)/.8,2)):0;
  return attack*decay*(.18+.82*primary+secondary);
 }
 function keyframes(p){
  const frames=[],seed=Math.random()*6.28,n=Math.ceil(p.duration/35);
  for(let i=0;i<=n;i++){
   const t=i*p.duration/n/1000,e=envelope(t,p);
   const x=(Math.sin(t*79+seed)*.42+Math.sin(t*113)*.25+Math.sin(t*17)*.33)*p.amplitude*e;
   const y=(Math.sin(t*61+seed)*.65+Math.sin(t*11)*.35)*p.amplitude*e*.42;
   frames.push({offset:i/n,translate:`${x.toFixed(3)}px ${y.toFixed(3)}px`,rotate:`${(Math.sin(t*13+seed)*e*(p.full?.16:.045)*p.strength).toFixed(4)}deg`});
  }
  frames[0]={offset:0,translate:'0px 0px',rotate:'0deg'};frames[n]={offset:1,translate:'0px 0px',rotate:'0deg'};return frames;
 }
 function stop(){
  if(job){cancelAnimationFrame(job.raf);clearTimeout(job.timer);job.animation?.cancel();job.layer?.remove();
  job.target?.removeAttribute('data-seismic-motion');job=null;}
  if(previewBar){previewBar.remove();previewBar=null;}
 }
 function pieceCandidates(p){
  const selectors=p.tier>=2?['.mg-logo-icon','#kpi-temp','#kpi-wind','#kpi-brent-label','#chips-row .chip','#events .event .event-mag','#pd-flag','.stat-card']:
   ['.mg-logo-icon','#kpi-temp','#kpi-wind','#chips-row .chip','#pd-flag'];
  const list=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))].filter(el=>{
   const r=el.getBoundingClientRect();return r.width>5&&r.height>5&&r.width<innerWidth*.7&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&!el.closest('#seismic-demo-dialog');
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
  const dust=Array.from({length:innerWidth<700?45:90},()=>({x:Math.random()*w,y:Math.random()*h,r:.5+Math.random()*1.8,z:.25+Math.random()*.75,phase:Math.random()*6.28}));
  document.body.append(layer);return {layer,ctx,w,h,pieces,dust};
 }
 function draw(scene,t,p){
  const {ctx,w,h,dust,pieces}=scene,fade=Math.min(1,t*2)*clamp((p.duration/1000-t)/1.7,0,1);
  if(ctx){
   ctx.clearRect(0,0,w,h);
   // Soft drifting occlusion around the perimeter, rather than black flashes.
   const shade=ctx.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.75);
   shade.addColorStop(0,'rgba(6,10,14,0)');shade.addColorStop(1,`rgba(6,10,14,${fade*(.12+p.strength*.13)})`);ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   for(const d of dust){
    const x=d.x+Math.sin(t*1.1+d.phase)*12*d.z+t*8*d.z,y=d.y+t*19*d.z;
    const edge=Math.pow(Math.abs(x-w/2)/(w/2),1.5);ctx.globalAlpha=fade*(.025+.13*edge)*d.z*p.strength;
    ctx.fillStyle='#d4cec2';ctx.beginPath();ctx.ellipse(x%w,y%h,d.r,d.r*.6,.2,0,Math.PI*2);ctx.fill();
   }ctx.globalAlpha=1;
  }
  for(const piece of pieces){
   const age=t-piece.start;if(age<0){piece.el.style.opacity='0';continue;}
   const travel=Math.min(age,2.5),dy=.5*(260+90*piece.depth)*travel*travel;
   piece.el.style.opacity=String(clamp(1-Math.max(0,age-1.3)/1.2,0,1));
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
  const animation=typeof target.animate==='function'?target.animate(keyframes(p),{duration:p.duration,easing:'linear',fill:'none'}):null;
  const token=++seq;job={token,target,animation,layer:scene?.layer,raf:0,timer:null,profile:p,demo};
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
  dialog.innerHTML='<button type="button" class="seismic-demo-close" aria-label="Fechar demonstração">×</button><h3>Efeitos sísmicos · demonstração</h3><p>Compare os efeitos na tela atual. Sem criar evento, mover a câmera ou tocar alarme.</p><label>Magnitude<select id="seismic-demo-mag"><option value="2">M2.0 · Vibração leve</option><option value="5.9">M5.9 · Cartão</option><option value="6.5" selected>M6.5 · Tela inteira</option><option value="7.5">M7.5 · Caos</option><option value="8.2">M8.2 · Caos intenso</option></select></label><label>Profundidade<select id="seismic-demo-depth"><option value="10">10 km · Raso</option><option value="100">100 km · Intermediário</option><option value="500">500 km · Profundo</option></select></label><label>Apresentação<select id="seismic-demo-mode"><option value="manual">Evento novo / clique manual</option><option value="auto">Ciclo aleatório · discreto</option></select></label><p class="seismic-demo-intensity"></p><p class="seismic-demo-note">Intensidade estimada na região do epicentro. As quedas são uma ilustração, não confirmação de danos.</p><button type="button" id="seismic-demo-play">Reproduzir efeito</button>';
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

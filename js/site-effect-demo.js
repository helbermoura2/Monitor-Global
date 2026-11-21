/* Shared previews and approved live overlays. No feeds, audio or camera writes. */
(function(){
 'use strict';
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let scene=null;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=(a,b,x)=>{const k=clamp((x-a)/(b-a),0,1);return k*k*(3-2*k);};
 const durationFor=kind=>kind==='quake'?24000:kind==='tsunami'?20000:10000;
 function stop(){
  if(scene){cancelAnimationFrame(scene.frame);clearTimeout(scene.timer);scene.animations.forEach(a=>a.cancel());for(const p of scene.fragments||[])p.source.classList.remove('site-effect-swept');scene.floatLayer?.remove();if(scene.kind==='quake'&&!scene.live)window.SeismicCinema?.stop();scene.canvas.remove();scene=null;}
  document.body.classList.remove('site-effect-demo-active');
 }
 function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 function texture(rand,water){
  const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');
  for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const n=rand();c.fillStyle=water?'rgba(168,218,221,'+(n*.16)+')':'rgba(38,12,3,'+(n*.7)+')';c.fillRect(x,y,2,2);}
  return tile;
 }
 function foamTexture(rand){
  const tile=document.createElement('canvas');tile.width=tile.height=64;const c=tile.getContext('2d');
  for(let i=0;i<600;i++){const x=rand()*64,y=rand()*64,d=Math.hypot(x-32,y-32)/32;if(d>1)continue;c.fillStyle=`rgba(238,245,226,${(1-d)*(.25+rand()*.65)})`;c.beginPath();c.ellipse(x,y,.35+rand()*1.6,.3+rand(),rand()*6.28,0,Math.PI*2);c.fill();}
  return tile;
 }
 function targets(kind){
  const selectors=kind==='quake'?['header','#sidebar-left','#painel-direito','#mapContainer']:['header','#sidebar-left','#painel-direito','#mobile-fab-bar'];
  return selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});
 }
 function movePage(s){
  if(s.kind==='quake'&&s.live)return;
  if(s.kind==='quake'){window.SeismicCinema?.play({mag:8.2,depth:10},'manual',true,{duration:s.duration,recordPieces:true,slowPieces:true,quietControls:true});return;}
  if(s.kind!=='tsunami')return;
  for(const [i,el] of targets(s.kind).entries()){
   const frames=[];
    const r=el.getBoundingClientRect(),arrival=arrivalAt(s,r.left);
    for(let n=0;n<=120;n++){
     const t=n/6,push=smooth(arrival,arrival+3,t)*(1-smooth(18,20,t));
     frames.push({offset:t/20,translate:`${push*s.width*1.35}px ${Math.sin(t*1.8+i)*push*18}px`,rotate:`${push*(i%2?7:-5)}deg`,opacity:1-push*.82});
    }
   frames[0]={offset:0,translate:'0px 0px',rotate:'0deg',opacity:1};
   frames[frames.length-1]={offset:1,translate:'0px 0px',rotate:'0deg',opacity:1};
   s.animations.push(el.animate(frames,{duration:s.duration,easing:'linear',fill:'none'}));
  }
 }
 function frontAt(s,t){return s.width*(t<=13?-.15+smooth(.8,9.5,t)*1.5:1.35-smooth(13,19,t)*1.65);}
 function arrivalAt(s,x){for(let t=.8;t<=10;t+=.1)if(frontAt(s,t)>=x)return t;return 10;}
 function fragments(s){
  const layer=document.createElement('div');layer.className='site-effect-floats';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);s.floatLayer=layer;s.fragments=[];
  const candidates=[...document.querySelectorAll('#sidebar-left .event,#painel-direito .stat-card,#pd-local,#events-label,#chips-row .chip')].filter(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.visibility!=='hidden'&&r.width>12&&r.height>8&&r.width<s.width*.9&&r.top<s.height&&r.bottom>0;}).slice(0,s.mobile?10:18);
  for(const [i,source] of candidates.entries()){
   const r=source.getBoundingClientRect(),copy=source.cloneNode(true),shell=document.createElement('div'),cs=getComputedStyle(source);
   const originals=[source,...source.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
   originals.forEach((original,i)=>{const style=getComputedStyle(original);for(const property of style)copies[i].style.setProperty(property,style.getPropertyValue(property));});
   for(const node of [copy,...copy.querySelectorAll('*')]){node.removeAttribute('id');node.setAttribute('tabindex','-1');for(const a of [...node.attributes])if(/^on/i.test(a.name))node.removeAttribute(a.name);node.style.setProperty('animation','none','important');node.style.setProperty('transition','none','important');}
   copy.querySelectorAll('video,iframe').forEach(el=>el.remove());
   Object.assign(copy.style,{position:'static',margin:'0',width:r.width+'px',height:r.height+'px',font:cs.font,color:cs.color,background:cs.background,border:cs.border,borderRadius:cs.borderRadius,boxSizing:'border-box'});
   shell.className='site-effect-fragment';shell.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;shell.append(copy);layer.append(shell);
   s.fragments.push({source,shell,x:r.left,y:r.top,w:r.width,h:r.height,arrival:arrivalAt(s,r.left+r.width*.25),spin:(i%2?1:-1)*(3+i%4)});
  }
 }
 function size(s){
  s.width=innerWidth;s.height=innerHeight;const dpr=Math.min(devicePixelRatio||1,s.mobile?1.25:1.5);
  s.canvas.width=Math.round(s.width*dpr);s.canvas.height=Math.round(s.height*dpr);s.ctx.setTransform(dpr,0,0,dpr,0,0);
 }
 function lava(s,t,fade){
  const c=s.ctx,w=s.width,h=s.height;
  const glow=c.createLinearGradient(0,0,0,h*.45);glow.addColorStop(0,'rgba(255,77,9,'+(fade*.17)+')');glow.addColorStop(1,'rgba(255,50,0,0)');c.fillStyle=glow;c.fillRect(0,0,w,h*.45);
  for(const p of s.particles){
   const age=t-p.delay;if(age<0)continue;const speed=h*.19+p.speed*h*.12,life=(h+100)/speed;
   const a=age%life,x=p.x*w+Math.sin(a*1.2+p.phase)*16+p.drift*a,y=-40+speed*a+17*a*a;
   if(y>h+70)continue;
   const r=p.radius*(s.mobile?.72:1),heat=.72+.28*Math.sin(age*7+p.phase);
   c.save();c.globalAlpha=fade;c.translate(x,y);c.rotate(p.phase+a*p.spin);
   const halo=c.createRadialGradient(0,0,1,0,0,r*4);halo.addColorStop(0,`rgba(255,153,23,${.55*heat})`);halo.addColorStop(.35,'rgba(255,62,2,.25)');halo.addColorStop(1,'rgba(255,41,0,0)');c.fillStyle=halo;c.fillRect(-r*4,-r*4,r*8,r*8);
   c.beginPath();for(let j=0;j<7;j++){const angle=j/7*Math.PI*2,rr=r*p.edges[j];j?c.lineTo(Math.cos(angle)*rr,Math.sin(angle)*rr):c.moveTo(Math.cos(angle)*rr,Math.sin(angle)*rr);}c.closePath();
   const molten=c.createLinearGradient(-r,-r,r,r);molten.addColorStop(0,'#ffd779');molten.addColorStop(.32,'#ff9d25');molten.addColorStop(.7,'#e84807');molten.addColorStop(1,'#69210e');c.fillStyle=molten;c.fill();
   c.save();c.clip();c.fillStyle=s.crust;c.fillRect(-r,-r,r*2,r*2);c.strokeStyle='#35140deb';c.lineWidth=Math.max(1,r*.24);c.beginPath();c.moveTo(-r,-r*.3);c.lineTo(-r*.1,r*.2);c.lineTo(r*.3,-r*.1);c.lineTo(r,r*.4);c.stroke();c.restore();c.restore();
   c.strokeStyle=`rgba(255,131,29,${fade*.28})`;c.lineWidth=1;c.beginPath();c.moveTo(x,y-r);c.lineTo(x-p.drift*.12,y-r-18-p.radius*2);c.stroke();
  }
 }
 function rain(s,t,fade){
  const c=s.ctx,w=s.width,h=s.height;
  const mist=c.createLinearGradient(0,0,0,h);mist.addColorStop(0,`rgba(89,122,140,${fade*.08})`);mist.addColorStop(1,`rgba(150,197,210,${fade*.14})`);c.fillStyle=mist;c.fillRect(0,0,w,h);
  for(const p of s.particles){
   const depth=.35+p.speed*.65,fall=h*(.8+depth*.9),y=((t*fall+p.y*h)%(h+90))-50,x=(p.x*w+t*40*depth)%(w+50)-20;
   c.strokeStyle=`rgba(221,241,245,${fade*(.12+depth*.4)})`;c.lineWidth=.5+depth*.9;c.beginPath();c.moveTo(x,y);c.lineTo(x-4*depth,y-(10+depth*26));c.stroke();
   c.strokeStyle=`rgba(68,111,134,${fade*.25})`;c.lineWidth=2;c.beginPath();c.moveTo(x+1,y);c.lineTo(x+1-4*depth,y-14*depth);c.stroke();
  }
  for(let i=0;i<(s.mobile?12:22);i++){
   const p=s.particles[i],phase=(t*.9+p.phase)%1,x=p.x*w,y=h-10-p.y*20;
   c.strokeStyle=`rgba(191,229,238,${fade*(1-phase)*.38})`;c.lineWidth=.8;c.beginPath();c.ellipse(x,y,phase*22+1,phase*4+.5,0,0,Math.PI*2);c.stroke();
  }
  // Foreground lenses refract the scene without a heavy full-screen filter.
  for(let i=0;i<12;i++){
   const p=s.particles[i],r=2+p.radius*.28,x=p.x*w,y=(p.y*h+t*(8+p.speed*7))%h;
   const lens=c.createRadialGradient(x-r*.3,y-r*.5,0,x,y,r*1.8);lens.addColorStop(0,`rgba(243,253,255,${fade*.32})`);lens.addColorStop(.45,'rgba(164,205,220,.04)');lens.addColorStop(1,`rgba(13,41,60,${fade*.18})`);c.fillStyle=lens;c.beginPath();c.ellipse(x,y,r,r*1.8,-.12,0,Math.PI*2);c.fill();
  }
  // Two irregular, isolated lightning strikes, not a continuous strobe.
  const pulse=(at)=>{const a=t-at;return a>=0&&a<.45?Math.exp(-a*13)*(a<.08?1:.52):0;};
  const flash=(!s.live||s.lightning)?pulse(2.25)+pulse(6.65):0;s.canvas.dataset.lightning=flash>.05?'flash':'off';
  if(flash>.005){const light=c.createRadialGradient(w*.7,0,0,w*.7,0,Math.max(w,h));light.addColorStop(0,`rgba(227,242,255,${flash*.38})`);light.addColorStop(1,`rgba(196,219,248,${flash*.1})`);c.fillStyle=light;c.fillRect(0,0,w,h);c.strokeStyle=`rgba(243,250,255,${flash*.72})`;c.lineWidth=1.2;c.beginPath();c.moveTo(w*.72,0);c.lineTo(w*.70,h*.08);c.lineTo(w*.73,h*.12);c.lineTo(w*.68,h*.22);c.lineTo(w*.70,h*.26);c.lineTo(w*.66,h*.34);c.stroke();}
 }
 function noise(s,x,y){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy),x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
  return (s.noise[y0+x0]*(1-a)+s.noise[y0+x1]*a)*(1-b)+(s.noise[y1+x0]*(1-a)+s.noise[y1+x1]*a)*b;
 }
 function field(s,x,y){return noise(s,x,y)*.57+noise(s,x*2.1+4,y*2.1+9)*.29+noise(s,x*4.3+13,y*4.3)*.14;}
 function waterField(s,t,front){
  const {width:w,height:h}=s.surface,{data}=s.surfacePixels,fn=front/s.width;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const u=x/w,v=y/h,qx=u*8-t*.65+Math.sin(v*7+t*.6)*.6,qy=v*10+Math.sin(u*8-t*.8)*.5,mass=field(s,qx,qy),slope=field(s,qx+.055,qy)-mass;
   const crest=Math.exp(-Math.pow((u-fn)*23,2)),cells=noise(s,qx*5,qy*5),veins=clamp((.055-Math.abs(cells-.51))/.055,0,1),foam=clamp((mass-.58)*3+veins*crest*.78,0,.92),shade=clamp(.65+slope*9,.28,1.2),i=(y*w+x)*4;
   data[i]=(17+mass*38)*shade*(1-foam)+214*foam;data[i+1]=(38+mass*44)*shade*(1-foam)+228*foam;data[i+2]=(40+mass*35)*shade*(1-foam)+216*foam;data[i+3]=240;
  }
  s.surfaceContext.putImageData(s.surfacePixels,0,0);
 }
 function tsunami(s,t,fade){
  const c=s.ctx,w=s.width,h=s.height,front=frontAt(s,t),depth=Math.min(w*.58,560),withdraw=smooth(18.5,20,t);
  const edge=y=>front+Math.sin(y*.009-t*2.3)*28+Math.sin(y*.027+t*3)*11+Math.sin(y*.061-t*4)*5;
  c.save();c.globalAlpha=fade*(1-withdraw*.92);c.beginPath();c.moveTo(-40,0);c.lineTo(edge(0),0);
  for(let y=0;y<=h+20;y+=12)c.lineTo(edge(y),y);c.lineTo(-40,h);c.closePath();c.clip();
  const water=c.createLinearGradient(front-depth,0,front+25,0);water.addColorStop(0,'rgba(9,38,44,.72)');water.addColorStop(.4,'rgba(32,66,69,.9)');water.addColorStop(.78,'rgba(72,116,114,.95)');water.addColorStop(.95,'rgba(142,179,167,.94)');water.addColorStop(1,'rgba(219,234,220,.87)');c.fillStyle=water;c.fillRect(0,0,w,h);
  if(!s.lastWater||t-s.lastWater>=1/18){waterField(s,t,front);s.lastWater=t;}c.drawImage(s.surface,0,0,w,h);
  c.save();c.globalAlpha*=.2;c.fillStyle=s.water;c.translate(t*35%128,t*15%128);c.fillRect(-128,-128,w+256,h+256);c.restore();
  for(let i=0;i<45;i++){
   const p=s.particles[i],x=front-depth*p.x,y=(p.y*h+t*25*(p.speed+.2))%h;
   c.strokeStyle=`rgba(180,226,224,${.06+p.speed*.14})`;c.lineWidth=.5+p.speed*1.7;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+30,y-12,x+65,y+15,x+100,y-6);c.stroke();
  }
  c.restore();
  // Breaking crest: overlapping eddies, shadow under the lip, aerated foam.
  c.save();c.globalAlpha=fade*(1-withdraw);c.lineCap='round';
  for(const p of s.particles){
   const y=p.y*h+Math.sin(t*2+p.phase)*6,x=edge(y),churn=.5+.5*Math.sin(y*.071-t*5+p.phase),r=5+p.radius*1.4;
   c.save();c.translate(x-7-r*churn,y);c.rotate(p.phase+t*.2);c.globalAlpha*=.65+churn*.35;c.drawImage(s.foam,-r*2,-r*2,r*4,r*4);c.restore();
  }
  for(const p of s.particles){
   const phase=(t*(.7+p.speed)+p.phase)%1,y=p.y*h,x=edge(y)+phase*(24+p.radius*6);
   c.fillStyle=`rgba(239,249,242,${(1-phase)*.65})`;c.beginPath();c.ellipse(x,y+Math.sin(t*3+p.phase)*9,1+p.radius*.25,(1+p.radius*.2)*(1-phase*.6),p.phase,0,Math.PI*2);c.fill();
  }
  c.restore();
  for(const p of s.fragments){
   const age=t-p.arrival;if(age<0){p.shell.style.opacity='0';continue;}
   const restore=smooth(18,20,t),travel=Math.min(age,10),pull=t>13?-(t-13)*w*.16:0;
   if(restore>=.99)p.source.classList.remove('site-effect-swept');else p.source.classList.add('site-effect-swept');
   p.shell.style.opacity=String(smooth(0,.25,age)*(1-restore));p.shell.style.transform=`translate3d(${travel*w*.15+pull}px,${Math.sin(age*1.4+p.x)*22}px,0) rotate(${Math.sin(age*.7)*p.spin+age*p.spin*.35}deg)`;
  }
 }
 function quake(s,t,fade){
  const c=s.ctx,w=s.width,h=s.height,breakup=smooth(.5,3,t),settle=1-smooth(19,24,t);
  for(const crack of s.cracks){
   c.save();c.globalAlpha=fade*settle;const points=crack.points;c.beginPath();c.moveTo(points[0][0]*w,points[0][1]*h);
   const n=Math.max(1,Math.floor(points.length*breakup));for(let i=1;i<n;i++)c.lineTo(points[i][0]*w,points[i][1]*h);
   c.strokeStyle='rgba(0,9,15,.8)';c.lineWidth=3.2;c.stroke();c.translate(1.1,-1);c.strokeStyle='rgba(213,232,239,.32)';c.lineWidth=.8;c.stroke();c.restore();
  }
  for(const p of s.particles){
   const age=t-p.delay;if(age<0)continue;const y=p.y*h+age*age*95,x=p.x*w+p.drift*age;
   if(y>h+40)continue;c.save();c.globalAlpha=fade*settle*.7;c.translate(x,y);c.rotate(p.phase+age*p.spin);c.fillStyle=p.speed>.5?'#8199a7':'#173645';c.beginPath();c.moveTo(-p.radius,0);c.lineTo(0,-p.radius*.7);c.lineTo(p.radius,p.radius*.3);c.lineTo(-p.radius*.3,p.radius);c.closePath();c.fill();c.strokeStyle='#d3e6ee44';c.lineWidth=.6;c.stroke();c.restore();
  }
  const dust=c.createLinearGradient(0,h*.45,0,h);dust.addColorStop(0,'rgba(138,151,157,0)');dust.addColorStop(1,`rgba(138,151,157,${fade*settle*breakup*.27})`);c.fillStyle=dust;c.fillRect(0,0,w,h);
 }
 function start(kind,options={}){
  stop();if(motion.matches||document.hidden||!['lava','rain','quake','tsunami'].includes(kind))return false;
  const canvas=document.createElement('canvas');canvas.id='site-effect-demo-canvas';canvas.setAttribute('aria-hidden','true');canvas.dataset.scene=kind;canvas.dataset.live=String(!!options.live);document.body.append(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){canvas.remove();return false;}
  const variant=Number(options.variant)||1;
  const rand=random(81729+variant*100),mobile=innerWidth<900,s=scene={canvas,ctx,kind,variant,mobile,live:!!options.live,lightning:!!options.lightning,rate:Number(options.rate)||0,duration:durationFor(kind),animations:[],particles:[],cracks:[],frame:0,timer:0,start:performance.now(),last:0};size(s);
  s.crust=ctx.createPattern(texture(rand,false),'repeat');s.water=ctx.createPattern(texture(rand,true),'repeat');s.foam=foamTexture(rand);
  if(kind==='tsunami'){s.noise=Float32Array.from({length:4096},rand);s.surface=document.createElement('canvas');s.surface.width=mobile?96:144;s.surface.height=Math.min(180,Math.ceil(s.surface.width*s.height/s.width));s.surfaceContext=s.surface.getContext('2d');s.surfacePixels=s.surfaceContext.createImageData(s.surface.width,s.surface.height);fragments(s);}
  const baseCount=kind==='rain'?(mobile?160:280):kind==='tsunami'?(mobile?100:180):kind==='lava'?(mobile?42:70):(mobile?32:55);
  const count=kind==='rain'&&s.live?Math.max(20,Math.round(baseCount*(s.rate<2.5?.25:s.rate<7.5?.6:1))):baseCount;
  for(let i=0;i<count;i++)s.particles.push({x:rand(),y:rand(),speed:rand(),radius:kind==='lava'?3+rand()*10:2+rand()*6,delay:rand()*3,drift:(rand()-.5)*45,spin:(rand()-.5)*2,phase:rand()*6.28,edges:Array.from({length:7},()=>.65+rand()*.4)});
  for(let i=0;i<8;i++){let x=rand(),y=rand()*.4;const points=[[x,y]];for(let n=0;n<14;n++){x+=(rand()-.5)*.1;y+=.035+rand()*.025;points.push([x,y]);}s.cracks.push({points});}
  document.body.classList.add('site-effect-demo-active');movePage(s);
  function frame(now){
   if(scene!==s)return;if(document.hidden||motion.matches){stop();return;}
   s.frame=requestAnimationFrame(frame);if(now-s.last<(mobile?40:33))return;s.last=now;
   const t=(now-s.start)/1000;if(t>=s.duration/1000){stop();return;}
   if(s.width!==innerWidth||s.height!==innerHeight)size(s);
   ctx.clearRect(0,0,s.width,s.height);const end=s.duration/1000,fade=smooth(0,.45,t)*(1-smooth(end-1.5,end,t));
   ({lava,rain,quake,tsunami})[kind](s,t,fade);
  }
  s.frame=requestAnimationFrame(frame);s.timer=setTimeout(stop,s.duration);return true;
 }
 motion.addEventListener('change',()=>{if(motion.matches)stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',stop);
 window.SiteEffectDemo={start,stop,durationFor,isActive:()=>!!scene,state:()=>scene?{kind:scene.kind,live:scene.live}:null};
})();

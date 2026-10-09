/* Illustrative near-camera circulation. One field carries dust and debris and
   loads the original text. It does not infer wind speed, damage or rotation from
   a location. The photographic tornado is rendered once by the native video. */
(function(){
 'use strict';
 const TAU=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function circulation(t){
  const band=.5+.5*Math.sin(t*.73-.8),surge=Math.pow(.5+.5*Math.sin(t*1.39+.2),3);
  return {pressure:clamp(.38+.36*band+.26*surge,.35,1),angle:t*.88+.21*Math.sin(t*.47)};
 }
 function chipTexture(kind,blur){
  const c=document.createElement('canvas');c.width=80;c.height=64;const g=c.getContext('2d');
  const body=new Path2D();
  if(kind===0){body.moveTo(6,25);body.lineTo(65,20);body.lineTo(74,32);body.lineTo(68,37);body.lineTo(11,41);body.lineTo(16,33);}
  else if(kind===1){body.moveTo(11,42);body.bezierCurveTo(30,32,29,9,52,13);body.lineTo(58,20);body.lineTo(67,23);body.bezierCurveTo(64,44,44,55,27,49);}
  else{body.moveTo(16,15);body.lineTo(42,17);body.lineTo(61,12);body.lineTo(67,40);body.lineTo(51,37);body.lineTo(42,52);body.lineTo(19,43);body.lineTo(24,29);}
  body.closePath();const light=g.createLinearGradient(12,15,64,51);
  light.addColorStop(0,kind===2?'#aaa393':'#84745a');light.addColorStop(.45,kind===2?'#777565':'#5c4b36');light.addColorStop(.50,kind===2?'#c3bbaa':'#9a8565');light.addColorStop(.58,'#514a3d');light.addColorStop(1,'#342e24');g.fillStyle=light;g.fill(body);
  g.save();g.clip(body);for(let j=0;j<100;j++){g.fillStyle=j%2?'rgba(20,16,10,.2)':'rgba(229,210,170,.12)';g.fillRect(rand(5,75),rand(10,55),rand(.5,3),.7);}g.restore();
  if(!blur)return c;const out=document.createElement('canvas');out.width=80;out.height=64;const b=out.getContext('2d');b.filter='blur(1.5px)';b.drawImage(c,0,0);c.width=c.height=1;return out;
 }
 function dustTexture(){
  const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
  for(let i=0;i<14;i++){const x=rand(28,68),y=rand(26,70),r=rand(17,30),v=g.createRadialGradient(x,y,0,x,y,r);v.addColorStop(0,'rgba(143,127,105,.12)');v.addColorStop(.55,'rgba(105,96,81,.055)');v.addColorStop(1,'rgba(85,79,70,0)');g.fillStyle=v;g.fillRect(0,0,96,96);}return c;
 }
 function create(cfg,mobile,panel,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  if(cfg.type!=='tornado')return null;
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material pd-tornado-field';canvas.dataset.material='helical-debris';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return null;
  const background=document.createElement('canvas');background.className='pd-tornado-reserve';background.setAttribute('aria-hidden','true');const bg=background.getContext('2d');let poster=null,posterRequested=false;
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses';lensLayer.setAttribute('aria-hidden','true');
  const sprites=Array.from({length:3},(_,i)=>[chipTexture(i,false),chipTexture(i,true)]),dust=dustTexture();
  const matter=Array.from({length:mobile?150:230},(_,i)=>({angle:rand(0,TAU),height:rand(0,1.1),radius:rand(.18,1),speed:rand(.65,1.45),phase:rand(0,TAU),roll:rand(0,TAU),spin:rand(-3,3),kind:i%3,chip:i<(mobile?22:34),size:rand(7,19),previous:null}));
  detail.track(matter);
  const clouds=Array.from({length:mobile?16:24},()=>({angle:rand(0,TAU),height:rand(0,.38),radius:rand(.6,1.2),phase:rand(0,TAU),size:rand(35,85)}));
  detail.track(clouds);
  let w=1,h=1,dead=false,groups=[],measureAt=-1,x=0,vx=0,roll=0,vr=0,travel=0,force=.4;
  const dynamics=new WeakMap();
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35)*detail.resolution;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);background.width=Math.round(w*detail.resolution);background.height=Math.round(h*detail.resolution);bg.setTransform(detail.resolution,0,0,detail.resolution,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);measureAt=-1;for(const p of matter)p.previous=null;}
  function measure(t){
   if(t<measureAt)return;measureAt=t+.65;
   for(const g of groups)for(const l of g.letters)l.el.style.removeProperty('transform');
   const bounds=panel.getBoundingClientRect();
   groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{
    const rect=el.getBoundingClientRect();const letters=Array.from(el.querySelectorAll('.pd-fx-windletter'),span=>{const r=span.getBoundingClientRect();let l=dynamics.get(span);if(!l){l={el:span,x:0,vx:0,y:0,vy:0,r:0,vr:0};dynamics.set(span,l);}l.left=Math.max(0,r.left-bounds.left-12);l.right=Math.max(0,w-12-(r.right-bounds.left));return l;});
    return {title:el.id==='pd-local',offset:clamp((rect.top-bounds.top)/h,0,1),letters};
   });
  }
  function spring(p,key,speed,target,dt,k=62,damping=11.8){p[speed]+=((target-p[key])*k-p[speed]*damping)*dt;p[key]+=p[speed]*dt;}
  function load(t,dt,envelope,current=cfg){
   if(dead)return {pressure:0,travel};measure(t);const flow=circulation(t),strength=.74+.26*clamp(current.strength||.48,0,1);force=flow.pressure*strength*envelope;travel+=dt*(.3+force);
   const buffet=(Math.sin(t*10.3)*.32+Math.sin(t*16.1)*.12)*force*force;
   vx+=((Math.sin(flow.angle)*force*(mobile?4:6)+buffet-x)*60-vx*12)*dt;x=clamp(x+vx*dt,mobile?-4.4:-6.4,mobile?4.4:6.4);
   vr+=((Math.sin(flow.angle-.55)*force*(mobile?.40:.64)-roll)*50-vr*11.5)*dt;roll=clamp(roll+vr*dt,-.7,.7);
   panel.style.setProperty('--pd-wind-x',x.toFixed(3)+'px');panel.style.setProperty('--pd-wind-y',(-force*2.4+Math.sin(flow.angle)*force).toFixed(3)+'px');panel.style.setProperty('--pd-wind-roll',roll.toFixed(3)+'deg');panel.style.setProperty('--pd-wind-pressure',force.toFixed(3));panel.style.setProperty('--pd-wind-flex',(Math.sin(flow.angle+.6)*force*3).toFixed(3)+'px');
   for(const g of groups){const count=Math.max(1,g.letters.length-1);g.letters.forEach((l,i)=>{
    const f=i/count,angle=flow.angle-g.offset*.85-f*.76,flutter=Math.sin(t*7.3-i*.37)*force*force;
    const amplitude=g.title?(mobile?21:28):5.5,target=clamp(Math.sin(angle)*amplitude*force+flutter*(g.title?1.8:.4),-l.left,l.right);
    spring(l,'x','vx',target,dt);spring(l,'y','vy',(-Math.cos(angle)*(g.title?8:1.8)-force*(g.title?3:.8))*force,dt,52,11);
    spring(l,'r','vr',(Math.sin(angle-.45)*(g.title?27:8)+flutter*2)*force,dt,48,10.8);
    l.el.style.transform='translate3d('+l.x.toFixed(2)+'px,'+l.y.toFixed(2)+'px,0) rotate('+l.r.toFixed(2)+'deg)';
   });}
   return {pressure:force,travel};
  }
  function project(p,t){
   // A three-dimensional helix: depth changes scale, opacity and occlusion.
   const z=Math.sin(p.angle),perspective=1/(1-z*.23),altitude=p.height;
   const axis=.52+Math.sin(t*.23+altitude*3.2)*.025,spread=(.10+altitude*.22)*p.radius;
   const center=w*(axis+Math.cos(p.angle)*spread*perspective)+Math.sin(t*1.2+p.phase)*5;
   return {x:center,y:h*(.97-altitude*.88)+z*(12+altitude*25)*perspective,z,scale:perspective*(.38+(z+1)*.42)};
  }
  function reserve(){
   // Reserve sky only when the native film and GPU are both unavailable.
   if(!bg)return;
   if(!posterRequested){posterRequested=true;const image=new Image();image.onload=()=>{if(!dead)poster=image;};image.src='media/card-fx/tornado-vortex.jpg';}
   if(poster){const scale=Math.max(w/poster.naturalWidth,h/poster.naturalHeight),pw=poster.naturalWidth*scale,ph=poster.naturalHeight*scale;bg.drawImage(poster,(w-pw)*.5,(h-ph)*.5,pw,ph);bg.fillStyle='rgba(10,13,12,.28)';bg.fillRect(0,0,w,h);return;}
   const sky=bg.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#343737');sky.addColorStop(.67,'#76776e');sky.addColorStop(.80,'#514d3d');sky.addColorStop(1,'#282920');bg.fillStyle=sky;bg.fillRect(0,0,w,h);
  }
  function draw(t,dt,envelope,current){
   if(dead)return;ctx.clearRect(0,0,w,h);bg?.clearRect(0,0,w,h);if(current.fallback)reserve();
   // Dust rolls out of the ground circulation and is stretched by shear.
   for(const p of clouds){p.angle+=dt*(.8+force*1.7);p.height+=dt*(.015+force*.028);if(p.height>.48){p.height=rand(-.04,.06);p.angle=rand(0,TAU);}const pos=project(p,t),fade=clamp(p.height/.05,0,1)*clamp((.48-p.height)/.14,0,1);ctx.save();ctx.globalAlpha=envelope*fade*(.13+.16*(pos.z+1)/2);ctx.translate(pos.x,pos.y);ctx.rotate(-.3*Math.cos(p.angle));ctx.drawImage(dust,-p.size,-p.size*.5,p.size*2,p.size);ctx.restore();}
   const projected=[];
   for(const p of matter){
    p.angle+=dt*(1.0+force*(p.chip?2.4:3.1))*p.speed/(.7+p.radius*.6);p.height+=dt*(.018+force*(p.chip?.048:.076))*p.speed;p.radius=Math.max(.12,p.radius-dt*.012*force);
    if(p.height>1.12){p.height=rand(-.05,.03);p.radius=rand(.65,1.2);p.angle=rand(0,TAU);p.previous=null;}
    p.spin+=dt*(Math.sin(t*1.8+p.phase)*force*5-p.spin)*2;p.roll+=p.spin*dt;projected.push({p,...project(p,t)});
   }
   projected.sort((a,b)=>a.z-b.z);
   for(const pos of projected){const p=pos.p,fade=clamp(p.height/.07,0,1)*clamp((1.12-p.height)/.16,0,1),front=(pos.z+1)*.5;
    const opacity=envelope*fade*(p.chip?.24+front*.34:.07+front*.15)*(pos.z<-.2?.40:1);
    if(p.chip){
     const size=p.size*pos.scale,flat=.16+.84*Math.abs(Math.cos(p.roll*1.6+p.phase));
     ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(p.roll);ctx.scale(1,flat);ctx.globalAlpha=opacity;ctx.drawImage(sprites[p.kind][front>.8?1:0],-size*.5,-size*.4,size,size*.8);ctx.restore();
     // One exposure tail per object, rather than a second orbit or film.
     if(p.previous&&front>.65){ctx.save();ctx.globalAlpha=opacity*.10;ctx.translate(pos.x-(pos.x-p.previous.x)*.26,pos.y-(pos.y-p.previous.y)*.26);ctx.rotate(p.roll);ctx.scale(1,flat);ctx.drawImage(sprites[p.kind][1],-size*.5,-size*.4,size,size*.8);ctx.restore();}
    }else{ctx.fillStyle='rgba(175,160,131,'+opacity.toFixed(3)+')';ctx.beginPath();ctx.ellipse(pos.x,pos.y,.3+pos.scale*.65,.3+pos.scale*.42,p.angle,0,TAU);ctx.fill();}
    p.previous={x:pos.x,y:pos.y};
   }
   ctx.globalAlpha=1;
  }
  function destroy(){if(dead)return;dead=true;canvas.remove();background.remove();poster=null;lensLayer.remove();for(const g of groups)for(const l of g.letters)l.el.style.removeProperty('transform');for(const variants of sprites)for(const s of variants)s.width=s.height=1;dust.width=dust.height=1;groups=[];matter.length=clouds.length=0;}
  return {canvas,lensLayer,background,resize,load,draw,destroy};
 }
 window.CardTornadoField={create,circulation};
})();

/* Heliocentric ecliptic view. Positions in AU; physical radii in km, no size exaggeration. */
(function(){'use strict';
const AU=149597870.7;
// Equatorial radii (km), NASA planetary fact sheets; Sun nominal IAU radius.
const bodies=[['Sun','Sol',695700,'#ffd16a'],['Mercury','Mercúrio',2439.7,'#aca8a2'],['Venus','Vênus',6051.8,'#edce92'],['Earth','Terra',6378.137,'#62cbe6'],['Moon','Lua',1738.1,'#d1d9df'],['Mars','Marte',3396.2,'#ed9678'],['Jupiter','Júpiter',71492,'#dcb58f'],['Saturn','Saturno',60268,'#e1ce9f'],['Uranus','Urano',25559,'#a3e3e6'],['Neptune','Netuno',24764,'#719ce5']];
let panel,canvas,ctx,frame,timer,epoch,rows=[],radius=34,center=[0,0],selected='Sun',drag=null,previousFocus,request=0,orbits=[];
function calculate(A,time){return bodies.map(([id,name,km,color])=>{
 const v=id==='Sun'?{x:0,y:0,z:0}:A.RotateVector(A.Rotation_EQJ_ECL(),A.HelioVector(id,new Date(time)));
 return {id,name,km,color,x:v.x,y:v.y,z:v.z,distance:Math.hypot(v.x,v.y,v.z),radiusAU:km/AU};
});}
function orbitalPaths(A,time){
 const periods={Mercury:87.969,Venus:224.701,Earth:365.256,Mars:686.98,Jupiter:4332.589,Saturn:10759.22,Uranus:30685.4,Neptune:60189};
 return Object.entries(periods).map(([id,days])=>({id,points:Array.from({length:97},(_,i)=>{const v=A.RotateVector(A.Rotation_EQJ_ECL(),A.HelioVector(id,new Date(time+days*86400000*i/96)));return {x:v.x,y:v.y};})}));
}
function close(){request++;cancelAnimationFrame(frame);clearInterval(timer);frame=null;panel?.remove();panel=canvas=ctx=null;drag=null;rows=[];orbits=[];epoch=null;previousFocus?.focus?.();}
function schedule(){if(panel&&!frame)frame=requestAnimationFrame(()=>{frame=null;draw();});}
function setZoom(value){radius=Math.max(.000001,Math.min(100,value));schedule();}
function focus(id){selected=id;const b=rows.find(b=>b.id===id);if(!b)return;center=[b.x,b.y];setZoom(Math.max(b.radiusAU*18,id==='Earth'?.003:id==='Sun'?.018:.00003));}
function draw(){
 if(!panel||!ctx)return;const box=canvas.getBoundingClientRect(),w=box.width,h=box.height,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#030e1b';ctx.fillRect(0,0,w,h);const scale=Math.min(w,h)*.43/radius,cx=w/2,cy=h/2;
 const project=b=>[cx+(b.x-center[0])*scale,cy-(b.y-center[1])*scale];
 ctx.strokeStyle='#8be1ee15';ctx.lineWidth=1;const step=10**Math.floor(Math.log10(radius));
 for(let a=Math.ceil((center[0]-w/2/scale)/step)*step;a<center[0]+w/2/scale;a+=step){const x=cx+(a-center[0])*scale;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
 for(let a=Math.ceil((center[1]-h/2/scale)/step)*step;a<center[1]+h/2/scale;a+=step){const y=cy-(a-center[1])*scale;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.strokeStyle='#81c8df24';ctx.lineWidth=.8;
 for(const orbit of orbits){ctx.beginPath();orbit.points.forEach((p,i)=>{const [x,y]=project(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
 const labels=[];for(const b of [...rows].sort((a,b)=>(b.id===selected)-(a.id===selected))){
 const [x,y]=project(b),r=b.radiusAU*scale;if(x+r<0||x-r>w||y+r<0||y-r>h)continue;
 if(r<4){ctx.strokeStyle=b.color+'88';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();} // Locator outline, not the physical disc.
 ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 const ly=y+Math.max(r,7)+16,lw=b.name.length*8;if(ly<h-30&&!labels.some(l=>Math.abs(l.y-ly)<19&&Math.abs(l.x-x)<(l.w+lw)/2+8)){ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#e4f5fa';ctx.fillText(b.name,x,ly);labels.push({x,y:ly,w:lw});}
 }
 const b=rows.find(b=>b.id===selected),info=panel.querySelector('[data-solar-info]');
 info.textContent=b.name+' · raio '+Math.round(b.km).toLocaleString('pt-BR')+' km · distância ao Sol '+b.distance.toLocaleString('pt-BR',{maximumFractionDigits:5})+' UA';
 panel.querySelector('[data-solar-time]').textContent=new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' BRT';
 const length=step*scale;ctx.strokeStyle='#7bdde4';ctx.beginPath();ctx.moveTo(20,h-24);ctx.lineTo(20+length,h-24);ctx.stroke();ctx.fillStyle='#b6d6df';ctx.textAlign='left';ctx.font='11px system-ui';ctx.fillText(step.toLocaleString('pt-BR',{maximumFractionDigits:9})+' UA',20,h-32);
 canvas.dataset.radiusAU=String(radius);canvas.dataset.epoch=String(epoch);
}
async function open(){
 close();const token=request;previousFocus=document.activeElement;
 panel=document.createElement('section');panel.id='solar-system-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Sistema Solar em escala real');
 panel.innerHTML='<header><div><h2>Sistema Solar</h2><p>Visão de cima do plano orbital · posições e tamanhos na mesma escala</p></div><button type="button" data-solar-close aria-label="Fechar Sistema Solar">×</button></header><div class="solar-toolbar"><button type="button" data-solar-all>Todos os planetas</button><button type="button" data-solar-inner>Planetas internos</button><button type="button" data-solar-plus aria-label="Aproximar Sistema Solar">＋</button><button type="button" data-solar-minus aria-label="Afastar Sistema Solar">−</button><select aria-label="Explorar astro"></select></div><canvas aria-label="Posições heliocêntricas dos planetas e da Lua"></canvas><footer><strong data-solar-info>Calculando posições…</strong><span data-solar-time></span><small>Discos em escala física; círculos finos são indicadores de localização. Arraste para navegar. 1 UA ≈ 149,6 milhões de km. A altura acima do plano orbital é projetada nesta vista.</small></footer>';
 document.body.append(panel);canvas=panel.querySelector('canvas');ctx=canvas.getContext('2d');
 const select=panel.querySelector('select');for(const [id,name]of bodies){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}select.onchange=()=>focus(select.value);
 panel.querySelector('[data-solar-close]').onclick=close;panel.querySelector('[data-solar-plus]').onclick=()=>setZoom(radius/2);panel.querySelector('[data-solar-minus]').onclick=()=>setZoom(radius*2);
 const fit=value=>{center=[0,0];selected='Sun';select.value='Sun';setZoom(value);};panel.querySelector('[data-solar-all]').onclick=()=>fit(34);panel.querySelector('[data-solar-inner]').onclick=()=>fit(1.9);
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(radius*Math.exp(Math.max(-.3,Math.min(.3,e.deltaY*.002))));},{passive:false});
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,center:[...center]};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const scale=Math.min(canvas.clientWidth,canvas.clientHeight)*.43/radius;center=[drag.center[0]-(e.clientX-drag.x)/scale,drag.center[1]+(e.clientY-drag.y)/scale];schedule();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button,select')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 panel.querySelector('[data-solar-close]').focus();
 try{await GlobeSpace.load();if(token!==request||!panel)return;orbits=orbitalPaths(Astronomy,Date.now());const update=()=>{epoch=Date.now();rows=calculate(Astronomy,epoch);if(selected!=='Sun'){const b=rows.find(b=>b.id===selected);center=[b.x,b.y];}schedule();};radius=34;center=[0,0];selected='Sun';update();timer=setInterval(()=>{if(Date.now()-epoch>=60000)update();else if(!document.hidden)schedule();},1000);}catch(_){if(panel)panel.querySelector('[data-solar-info]').textContent='Não foi possível carregar o cálculo astronômico. Feche e tente novamente.';}
}
window.addEventListener('resize',schedule);window.addEventListener('pagehide',close);
window.SolarSystem={open,close,calculate,AU,bodies,state:()=>({open:!!panel,epoch,radius,center:[...center],selected,rows})};
})();

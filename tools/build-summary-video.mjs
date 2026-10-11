/** Offline video preview. No Telegram delivery and no production API calls. */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
import {SUMMARY_MAP_LAND} from '../summary-editorial-assets.mjs';
import {SUMMARY_FLAGS} from '../summary-flags.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const input=resolve(process.argv[2]||resolve(root,'tests/fixtures/daily-summary/2026-10-01-usgs.json'));
const output=resolve(process.argv[3]||'/tmp/monitor-global-resumo.mp4');
const data=JSON.parse(await readFile(input,'utf8'));
if(!/^\d{4}-\d{2}-\d{2}$/.test(data.day)||!Array.isArray(data.events))throw new Error('Expected daily summary JSON: {day,events}');
let source=await readFile(resolve(root,'monitor-global-worker-7_7_0.js'),'utf8');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(pathToFileURL(resolve(root,p)).href));
const helpers=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {summaryPlace,summaryCountry,getHexColorFromMag};').toString('base64'));
const events=data.events.filter(e=>Number.isFinite(e.mag)&&Number.isFinite(e.time)).sort((a,b)=>b.mag-a.mag||a.time-b.time).slice(0,5).map((e,i)=>({...e,rank:i+1,location:helpers.summaryPlace(e.place||'Local não informado').title,country:helpers.summaryCountry(e.place||'').label,color:helpers.getHexColorFromMag(e.mag),when:new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hourCycle:'h23'}),depth:Number.isFinite(e.depth)?Math.round(Math.max(0,e.depth))+' km':'Não informada'}));
for(const event of events){const country=helpers.summaryCountry(event.place||'');event.code=country.code;const suffix=event.location.slice(event.location.lastIndexOf(',')+1).trim();if(event.location.includes(',')&&suffix.toLocaleUpperCase('pt-BR')===event.country)event.location=event.location.slice(0,event.location.lastIndexOf(','));}
if(!events.length)throw new Error('No dated earthquakes to render');
const fonts=await Promise.all(['CormorantGaramond','Inter'].map(async name=>({name,url:'data:font/ttf;base64,'+(await readFile(resolve(root,'assets/summary-fonts/'+name+'.ttf'))).toString('base64')})));
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--disable-dev-shm-usage']});
const temp=await mkdtemp(resolve(tmpdir(),'monitor-video-'));
try{
 const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
 await page.setContent('<canvas id="video" width="720" height="1280"></canvas>');
 const result=await page.evaluate(async({events,day,land,fonts,flags})=>{
  for(const f of fonts){const face=new FontFace(f.name,'url('+f.url+')',{weight:'100 900'});await face.load();document.fonts.add(face);}
  const flagImage=new Image();flagImage.src='data:image/png;base64,'+flags.b64;await flagImage.decode();
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),W=720,H=1280,bg='#02101f',white='#e8ecee',cyan='#98e7e8',muted='#95acbb';
  const merc=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-75,Math.min(75,lat))*Math.PI/360));
  const valid=e=>Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180;
  const world={lon:0,lat:18,scale:6.7/660},date=day.split('-').reverse().join('/');
  const duration=2+events.length*4+3,ease=t=>t*t*(3-2*t);
  const camera=e=>valid(e)?{lon:e.lon,lat:e.lat,scale:.6/660}:world;
  const mix=(a,b,t)=>{let delta=((b.lon-a.lon+540)%360)-180;return {lon:a.lon+delta*t,lat:a.lat+(b.lat-a.lat)*t,scale:Math.exp(Math.log(a.scale)*(1-t)+Math.log(b.scale)*t)};};
  const color=e=>'rgb('+e.color.join(',')+')';
  function text(s,x,y,size=20,fill=white,family='Inter',weight=400){ctx.fillStyle=fill;ctx.font=weight+' '+size+'px '+family;ctx.fillText(s,x,y);}
  function lines(s,width,size,maxLines=3){ctx.font='400 '+size+'px Inter';const out=[];let line='';for(const word of s.split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){out.push(line);line=word;}else line=next;}if(line)out.push(line);if(out.length>maxLines){out.length=maxLines;let last=out[maxLines-1];while(ctx.measureText(last+'…').width>width)last=last.slice(0,-1);out[maxLines-1]=last+'…';}return out;}
  function circle(x,y,r,fill,stroke,width=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function drawMap(cam,active,time){
   const box={x:30,y:340,w:660,h:440},cy=merc(cam.lat),cx=cam.lon*Math.PI/180;
   const project=(lon,lat)=>{let delta=lon*Math.PI/180-cx;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;return [box.x+box.w/2+delta/cam.scale,box.y+box.h/2-(merc(lat)-cy)/cam.scale];};
   ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();
   ctx.fillStyle=bg;ctx.fillRect(box.x,box.y,box.w,box.h);
   ctx.strokeStyle='#183149';ctx.lineWidth=.7;
   for(let lon=-180;lon<180;lon+=20){const [x]=project(lon,0);ctx.beginPath();ctx.moveTo(x,box.y);ctx.lineTo(x,box.y+box.h);ctx.stroke();}
   for(let lat=-60;lat<=60;lat+=20){const [,y]=project(cam.lon,lat);ctx.beginPath();ctx.moveTo(box.x,y);ctx.lineTo(box.x+box.w,y);ctx.stroke();}
   for(const polygon of land){ctx.beginPath();for(const ring of polygon){let previous=null;for(const [lon,lat]of ring){const point=project(lon,lat);if(!previous||Math.abs(point[0]-previous[0])>box.w*2)ctx.moveTo(...point);else ctx.lineTo(...point);previous=point;}ctx.closePath();}ctx.fillStyle='#142b40';ctx.fill('evenodd');ctx.strokeStyle='#294b60';ctx.lineWidth=.7;ctx.stroke();}
   for(const e of events.filter(valid)){const [x,y]=project(e.lon,e.lat),c=color(e),selected=e.rank===active?.rank;ctx.globalAlpha=selected||!active?1:.5;circle(x,y,selected?25+Math.sin(time*2)*3:14,null,c,1.5);circle(x,y,selected?7:5,c);if(selected||!active){circle(x+20,y-22,13,bg,c);text(String(e.rank),x+15,y-17,14,c);}}
   ctx.restore();ctx.globalAlpha=1;
  }
  function draw(time){
   ctx.clearRect(0,0,W,H);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
   const index=Math.min(events.length-1,Math.max(0,Math.floor((time-2)/4))),event=events[index],closing=time>=2+events.length*4,intro=time<2;
   let cam=world;
   if(!intro&&!closing){const local=time-2-index*4,from=index?camera(events[index-1]):world;cam=mix(from,camera(event),ease(Math.min(1,local/1.4)));}
   if(closing)cam=mix(camera(events.at(-1)),world,ease(Math.min(1,(time-2-events.length*4)/1.4)));
   circle(56,62,24,null,cyan);circle(56,62,16,null,cyan);circle(56,62,8,null,cyan);circle(56,62,3,cyan);
   text('MONITOR GLOBAL',98,69,23,white);text('AMOSTRA · '+date+' · BRT',30,113,15,muted);
   text('Resumo sísmico',30,203,76,white,'CormorantGaramond',600);text('diário.',30,282,76,cyan,'CormorantGaramond',600);
   text('OS '+events.length+' MAIORES SISMOS DO DIA',32,323,17,muted);
   drawMap(cam,intro||closing?null:event,time);
   if(intro||closing){text(closing?'Os epicentros do dia':'Cinco sismos. Um panorama global.',32,864,28);text('Magnitudes e dados sujeitos a revisão.',32,913,19,muted);text('Fonte: USGS',32,954,19,muted);}
   else{
    const c=color(event);text('DESTAQUE '+event.rank+' DE '+events.length,32,815,16,muted);
    const flag=flags.map[event.code];if(flag){const [sx,sw,sh]=flag;ctx.drawImage(flagImage,sx,0,sw,sh,625,859,45,30);}
    ctx.beginPath();ctx.arc(106,910,65,Math.PI,Math.PI*2);ctx.strokeStyle='#203344';ctx.lineWidth=8;ctx.stroke();
    ctx.beginPath();ctx.arc(106,910,65,Math.PI,Math.PI+Math.PI*Math.min(1,event.mag/8));ctx.strokeStyle=c;ctx.stroke();
    text('M'+event.mag.toFixed(1).replace('.',','),208,917,77,c);
    const title=lines(event.location,650,31,2);title.forEach((s,i)=>text(s,32,980+i*38,31));
    text(event.country,32,1068,18,cyan);text('PROFUNDIDADE',32,1110,13,muted);text(event.depth,32,1143,24);
    text('HORÁRIO · BRT',390,1110,13,muted);text(event.when,390,1143,24);
    if(!valid(event))text('Epicentro sem coordenadas disponíveis',32,755,16,muted);
   }
   for(let i=0;i<events.length;i++)circle(310+i*24,1190,4,intro||closing?muted:i===index?color(event):'#294052');
   text('Fonte: USGS · Dados sujeitos a revisão',30,1250,14,muted);ctx.font='400 17px Inter';text('monitorglobal.top',W-30-ctx.measureText('monitorglobal.top').width,1250,17,cyan);
  }
  draw(0);
  const stream=canvas.captureStream(25),mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw new Error('Browser lacks WebM recorder');
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start(1000);
  const start=performance.now();await new Promise(resolve=>{const frame=now=>{const elapsed=(now-start)/1000;draw(Math.min(duration,elapsed));if(elapsed<duration)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
  const bytes=new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {b64:btoa(binary),duration};
 },{events,day:data.day,land:SUMMARY_MAP_LAND,fonts,flags:SUMMARY_FLAGS});
 await mkdir(dirname(output),{recursive:true});await writeFile(resolve(temp,'preview.webm'),Buffer.from(result.b64,'base64'));
 const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-i',resolve(temp,'preview.webm'),'-an','-vf','fps=25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',output],{encoding:'utf8'});
 if(encoded.status!==0)throw new Error(encoded.stderr||'ffmpeg encoding failed');
 const verified=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,avg_frame_rate:format=duration,size','-of','json',output],{encoding:'utf8'});
 if(verified.status!==0)throw new Error(verified.stderr);
 const metadata=JSON.parse(verified.stdout),video=metadata.streams[0];if(video.codec_name!=='h264'||video.width!==720||video.height!==1280||Math.abs(Number(metadata.format.duration)-result.duration)>1)throw new Error('Unexpected video properties');
 console.log(JSON.stringify({output,day:data.day,events:events.map(e=>({rank:e.rank,id:e.id,mag:e.mag})),...metadata},null,2));
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}

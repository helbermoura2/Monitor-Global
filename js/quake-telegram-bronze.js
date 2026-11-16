/* Telegram M6+ · Imperial Bronze. Source-informed fields and georeferenced map. */
(function(){
 const MAP_Y=284,MAP_HEIGHT=750,ANCHOR_Y=376;
 const CONTEXT={x:0,y:0,width:0,height:0,imageX:0,imageY:0,imageWidth:0,imageHeight:0};
 const GOLD='#bc8d66',IVORY='#ead0a5',DARK='#201915',STONE='#38291f',BLACK='#130f0d',DIM='#b8a187',RED='#dd8c6b';
 // Same archived tsunami strip as the original glass renderer (930..1076).
 const TSUNAMI_Y=930,TSUNAMI_HEIGHT=132;
 function telegramFrame(ev){
  const f=globalThis.QuakeCardLayout.frame(ev),span=f.maxLon-f.minLon;
  return {...f,height:MAP_HEIGHT,anchorY:ANCHOR_Y,minLat:Number(ev.lat)-span*(MAP_HEIGHT-ANCHOR_Y)/800,maxLat:Number(ev.lat)+span*ANCHOR_Y/800};
 }
 function fit(p,v,size,max,bold=false){
  let s=String(v??'').replace(/\s+/g,' ').trim();
  while(s.length>3&&p.measure(s,size,bold)>max)s=s.slice(0,-4)+'...';
  return s;
 }
 function label(p,s,x,y,size=20,color=IVORY,bold=false,max=760){p.text(fit(p,s,size,max,bold),x,y,size,color,bold);}
 function frame(p,x,y,w,h){
  p.roundRect(x,y,w,h,GOLD);p.roundRect(x+2,y+2,w-4,h-4,BLACK);
  p.roundRect(x+5,y+5,w-10,h-10,STONE);p.rect(x+9,y+8,w-18,1,'#78543b');
 }
 function key(p){
  for(const [y,dy]of [[8,1],[1424,-1]]){
   p.rect(10,y,780,3,GOLD);
   for(let x=12;x<780;x+=30){p.rect(x,y+dy*5,26,2,GOLD);
    p.rect(x,y+dy*5,2,dy>0?15:2,GOLD);
    p.rect(x+24,y+dy*5,2,dy>0?15:2,GOLD);
    p.rect(x+7,y+dy*13,16,2,'#806044');
   }
  }
  p.rect(10,11,3,1410,GOLD);p.rect(787,11,3,1410,GOLD);
  for(let y=35;y<1400;y+=38){p.rect(15,y,8,2,'#806044');p.rect(777,y,8,2,'#806044');}
 }
 function countryName(code){
  if(!/^[A-Z]{2}$/.test(code||''))return '';
  try{return new Intl.DisplayNames(['pt-BR'],{type:'region'}).of(code)||'';}catch{return '';}
 }
 function heading(p,ev){
  const raw=String(globalThis.EventPortuguese?.place?.(ev.place)||ev.place||'Local não informado').replace(/\s+/g,' ').trim();
  const country=countryName(ev.imageCountryCode);let title=raw;
  if(country&&!title.toLocaleLowerCase('pt-BR').endsWith(country.toLocaleLowerCase('pt-BR'))){
   if(/,\s*(Indonesia|Japan|Chile|Peru|Brazil|Philippines|Russia|Fiji)\s*$/i.test(title))
    title=title.replace(/,\s*[^,]+$/i,', '+country);
   else if(!title.toLocaleLowerCase('pt-BR').includes(country.toLocaleLowerCase('pt-BR')))title+=', '+country;
  }
  const haveFlag=!!ev.imageCountryCode,max=haveFlag?640:725;
  let size=30;while(size>19&&p.measure(title,size,true)>max*2-65)size--;
  const words=title.split(/\s+/),lines=[];let row='';
  for(const word of words){const next=row?row+' '+word:word;if(row&&p.measure(next,size,true)>max){lines.push(row);row=word;}else row=next;}
  if(row)lines.push(row);
  if(lines.length>2){const omitted=lines.slice(1).join(' ');lines.splice(1,lines.length-1,fit(p,omitted,size,max,true));}
  frame(p,32,178,736,99);
  const dy=lines.length>1?34:0;
  lines.forEach((ln,i)=>label(p,ln,50,201+i*dy,size,IVORY,true,max));
  if(haveFlag){
   const last=lines.at(-1)||'',fx=50+p.measure(last,size,true)+11;
   if(fx+41<756)p.flag?.('country',ev.imageCountryCode,fx,201+(lines.length-1)*dy,41,27);
   else p.flag?.('country',ev.imageCountryCode,707,237,41,27);
  }
 }
 function realDate(ev){
  const d=ev.timeIso?new Date(ev.timeIso):null;
  if(d&&Number.isFinite(d.getTime()))return {date:d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}),hour:d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false})+' BRT'};
  return {date:'Não informada',hour:''};
 }
 function drawTsunami(p,ts){
  const groups=(ts?.regionalGroups||[]).filter(g=>!g.stale&&['warning','watch','advisory'].includes(g.state));
  const active=(!ts?.stale&&['warning','watch','advisory'].includes(ts?.state))||groups.length>0;
  if(!active)return;
  frame(p,215,TSUNAMI_Y,555,TSUNAMI_HEIGHT);
  p.rect(221,TSUNAMI_Y+7,6,TSUNAMI_HEIGHT-14,'#a74232');
  label(p,'AVISO OFICIAL DE TSUNAMI',240,TSUNAMI_Y+12,22,RED,true,516);
  const area=groups.map(g=>g.regions?.join(' · ')).filter(Boolean).join(' / ')||ts.areas||'Consulte boletins oficiais.';
  label(p,area,240,TSUNAMI_Y+48,17,IVORY,false,513);
  label(p,ts.source||groups[0]?.source||'Autoridade oficial',240,TSUNAMI_Y+82,14,DIM,false,511);
  label(p,'Siga as orientações das autoridades locais.',240,TSUNAMI_Y+105,12,DIM,false,516);
 }
 function draw(p,ev){
  const m=Number(ev.mag),mag=Number.isFinite(m)?'M'+m.toFixed(1).replace('.',','):'M—';
  p.gradient(0,0,800,MAP_Y,'#38291f','#201915');
  p.gradient(0,1037,800,403,'#2a201a','#211812');key(p);
  p.officialLogo?.(52,46,193,108);
  label(p,'ARGOS ORBIS',282,73,48,IVORY,true,477);p.rect(265,53,2,104,GOLD);
  heading(p,ev);
  frame(p,36,297,241,104);label(p,mag,55,308,77,IVORY,true,205);
  if(ev.test)label(p,'SIMULAÇÃO',305,326,19,RED,true,205);
  const y=MAP_Y+ANCHOR_Y;
  for(const radius of [24,47,71,96,123,150,180])p.arc(400,y,radius,1.2,0,360,radius<50?IVORY:GOLD);
  p.dot(400,y,9,GOLD);p.dot(400,y,6,IVORY);
  if(!ev.imageMapAvailable)label(p,'Mapa indisponível na fonte',250,703,17,DIM,true,333);
  const cx=400,cy=980;p.arc(cx,cy,32,1,0,360,GOLD);
  p.rect(cx-2,cy-27,4,54,GOLD);p.rect(cx-27,cy-2,54,4,GOLD);
  for(const [s,x,yy]of [['N',cx-8,cy-57],['S',cx-7,cy+41],['O',cx-55,cy-12],['L',cx+42,cy-12]])label(p,s,x,yy,16,IVORY,true,35);
  drawTsunami(p,ev.imageTsunami);
  frame(p,34,1080,732,257);
  for(let x=57;x<740;x+=24){p.rect(x,1085,14,2,'#75533b');p.rect(x,1329,14,2,'#75533b');}
  const when=realDate(ev);
  label(p,'DATA · BRT',60,1110,16,DIM,true,224);
  label(p,when.date,60,1145,23,IVORY,true,236);
  label(p,when.hour,60,1178,21,IVORY,false,230);
  p.rect(306,1110,2,92,GOLD);
  label(p,'PROFUNDIDADE',331,1110,16,DIM,true,220);
  const depth=ev.depth!=null&&ev.depth!==''&&Number.isFinite(Number(ev.depth))?Math.abs(Number(ev.depth)).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km':'Não informada';
  label(p,depth,331,1150,27,IVORY,true,214);
  p.rect(556,1110,2,92,GOLD);
  label(p,'FONTE',579,1110,16,DIM,true,160);
  label(p,ev.source||'Não informada',579,1150,22,IVORY,true,167);
  p.rect(58,1215,680,2,GOLD);
  const revision=ev.reviewed?'Revisado':ev.reviewStatus==='unknown'?'Revisão não informada':'Registro automático';
  label(p,revision,59,1235,19,IVORY,false,306);
  p.rect(387,1231,2,77,GOLD);
  const official=ev.shaking?.status==='available',intensity=ev.mmi&&ev.mmi!=='—'?String(ev.mmi):'indisponível';
  label(p,'Intensidade '+(official?'oficial':'estimada')+' '+intensity,414,1234,20,IVORY,true,315);
  label(p,'Estimativa não confirma danos.',414,1275,15,DIM,false,320);
  p.rect(36,1351,728,3,GOLD);
  label(p,'argosorbis.com.br',60,1371,23,IVORY,true,295);
  p.rect(395,1368,2,39,'#866347');
  // Small bronze paper plane to the immediate left of the single, contiguous handle.
  p.telegramIcon?.(452,1386);
  label(p,'@argosorbis',478,1370,23,IVORY,true,260);
 }
 globalThis.QuakeTelegramBronzeLayout={version:'telegram-imperial-bronze-v1',MAP_Y,MAP_HEIGHT,ANCHOR_Y,CONTEXT,TSUNAMI_Y,TSUNAMI_HEIGHT,showScale:false,telegramFrame,draw,drawTsunami};
})();

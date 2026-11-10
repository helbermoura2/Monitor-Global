/* Imagem ESTÁTICA exclusiva do site: conceito 6, independente do Telegram.
   Usa os mapas/estimativas já existentes; qualquer magnitude pode ser exportada. */
(function(root){
 'use strict';
 const W=800,H=1440,MAP_Y=191,MAP_HEIGHT=1005,ANCHOR_Y=466;
 const CONTEXT={x:28,y:248,width:223,height:182,imageX:35,imageY:282,imageWidth:209,imageHeight:138};
 const bg='#071a26',navy='#061b29',cyan='#38d9f7',white='#f1f8ff',muted='#b8d3e1',red='#ff5265';
 const names={I:'Não perceptível',II:'Muito fraca',III:'Fraca',IV:'Leve',V:'Moderada',VI:'Forte',VII:'Muito forte',VIII:'Severa',IX:'Violenta',X:'Extrema',XI:'Extrema',XII:'Extrema'};
 function frame(ev){
  const base=root.QuakeCardLayout.frame(ev);
  const lon=Number(ev.lon),lat=Number(ev.lat),span=(base.maxLon-base.minLon)/2;
  return {...base,width:W,height:MAP_HEIGHT,anchorX:400,anchorY:ANCHOR_Y,
   minLon:lon-span,maxLon:lon+span,minLat:lat-2*span*(MAP_HEIGHT-ANCHOR_Y)/W,maxLat:lat+2*span*ANCHOR_Y/W};
 }
 const contextFrame=ev=>root.QuakeCardLayout.contextFrame(ev);
 const textFit=(p,value,size,width,bold=false)=>{
  let s=String(value??'—');
  while(s.length>3&&p.measure(s,size,bold)>width)s=s.slice(0,-2).trimEnd()+'…';
  return s;
 };
 const box=(p,x,y,w,h,color)=>(p.roundRect||p.rect)(x,y,w,h,color);
 function drawContext(p){
  box(p,CONTEXT.x,CONTEXT.y,CONTEXT.width,CONTEXT.height,'#071b2b');
  p.rect(CONTEXT.x+8,CONTEXT.y+7,4,18,cyan);
  p.text('CONTEXTO REGIONAL',CONTEXT.x+20,CONTEXT.y+7,15,white,true);
 }
 function header(p,ev,mag,place){
  p.rect(0,0,W,MAP_Y,bg);
  for(const radius of [27,19,10])p.arc(55,39,radius,1.4,-90,295,'#188bbd');
  p.dot(55,39,3,cyan);
  (p.brandText||p.text)('MONITOR GLOBAL',101,21,30,white,true);
  p.text(ev.test?'SIMULAÇÃO':ev.revisionText||ev._deltaTxt?'REVISADO':'REGISTRO SÍSMICO',textRight(p,ev.test?'SIMULAÇÃO':ev.revisionText||ev._deltaTxt?'REVISADO':'REGISTRO SÍSMICO',14),26,14,muted,true);
  p.rect(26,78,748,1,'#345468');
  p.rect(28,100,5,69,cyan);
  p.text('SISMO',45,96,30,white,true);
  p.text(textFit(p,place,25,263,true),45,135,25,white,true);
  box(p,335,102,212,77,'#341827');p.rect(335,101,212,2,red);
  p.text('M'+mag,358,109,52,white,true);
  p.rect(567,107,1,68,'#476470');
  const flags=ev.imageFlags||{};
  if(flags.countryCode){
   const start=flags.stateCode?594:671;
   p.flag?.('country',flags.countryCode,start,111,71,47);
   if(flags.stateCode)p.flag?.('state',flags.stateCode,679,111,71,47);
  }else p.text('🌐',692,113,32,muted);
 }
 function textRight(p,string,size){return 772-p.measure(string,size,true);}
 function tsLabel(t){
  const state=t?.state;
  if(state==='warning')return 'Aviso por região';
  if(state==='watch'||state==='advisory')return 'Atenção por região';
  if(state==='noThreat')return 'Sem ameaça (boletim)';
  if(state==='cancelled'||state==='ended')return 'Aviso encerrado';
  return 'Não confirmado';
 }
 function draw(p,ev){
  const pt=root.EventPortuguese,mag=Number.isFinite(Number(ev.mag))?pt?.number?.(ev.mag,1)||Number(ev.mag).toFixed(1).replace('.',','):'—';
  const place=pt?.place?.(ev.place)||String(ev.place||'Local não informado');
  p.rect(0,MAP_Y+MAP_HEIGHT,800,H-MAP_Y-MAP_HEIGHT,bg);
  header(p,ev,mag,place);
  const cx=400,cy=MAP_Y+ANCHOR_Y;
  // Anéis decorativos de localização, NÃO ondas P/S nem raio de dano.
  for(const r of [29,61,101])p.arc(cx,cy,r,1.5,0,360,'#d85160');
  p.dot(cx,cy,11,'#ffffff');p.dot(cx,cy,7,red);
  box(p,298,cy+24,204,37,'#092939');
  p.text('EPICENTRO · M'+mag,309,cy+32,17,white,true);
  if(!ev.imageMapAvailable){box(p,262,MAP_Y+175,340,45,'#132935');p.text('Mapa de satélite indisponível',275,MAP_Y+185,17,muted,true);}
  // Painel flutuante sobre a borda inferior do mapa.
  box(p,22,1140,756,274,'#092735');
  p.rect(36,1154,728,2,cyan);
  p.text(textFit(p,ev.when||'Horário não informado',20,452,true),46,1175,20,white,true);
  p.text(textFit(p,ev.sourceLabel||ev.source||'Fonte não informada',18,210,true),539,1178,18,white,true);
  p.rect(44,1215,711,1,'#537280');
  const mmi=String(ev.mmi||'—'),intensity=mmi==='—'?'Indisponível':mmi+' · '+(names[mmi]||'Estimativa');
  const depth=Number.isFinite(Number(ev.depth))&&ev.depth!==null?String(Math.round(Math.max(0,Number(ev.depth))))+' km':'—';
  const entries=[
   {label:'PROFUNDIDADE',value:depth,x:47,width:210},
   {label:'INTENSIDADE EST.',value:intensity,x:288,width:260},
   {label:'TSUNAMI',value:tsLabel(ev.imageTsunami),x:568,width:192}
  ];
  entries.forEach((e,i)=>{
   if(i)p.rect(e.x-14,1237,1,64,'#5f8090');
   p.text(e.label,e.x,1237,14,cyan,true);
   const size=i===2?16:19; // O texto de boletins de tsunami deve caber inteiro.
   p.text(textFit(p,e.value,size,e.width,true),e.x,1265,size,white,true);
  });
  p.text('Sismo: mapa e intensidade são estimativas; anéis não indicam propagação.',45,1311,11,muted);
  p.rect(42,1338,716,1,'#4b8095');
  p.text('monitorglobal.top',47,1356,21,white,true);
  p.text('Telegram · @monitor_global',422,1358,18,white,true);
 }
 root.QuakeSiteCard={frame,contextFrame,draw,drawContext,CONTEXT,MAP_Y,MAP_HEIGHT,ANCHOR_Y,version:'site-concept6-v1'};
})(window);

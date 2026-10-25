/* Shared editorial earthquake bulletin: Telegram and site export (800 × 1440). */
(function(){
 const MAP_Y=180,MAP_HEIGHT=430,ANCHOR_Y=MAP_HEIGHT/2,TSUNAMI_Y=998,TSUNAMI_HEIGHT=180;
 const CONTEXT={x:32,y:454,width:186,height:144,imageX:38,imageY:482,imageWidth:174,imageHeight:108};
 const white='#edf6fa',muted='#b4c9ce',line='#304950',bg='#101f27',panel='#142a33';
 const box=(p,x,y,w,h,c=panel)=>(p.roundRect||p.rect)(x,y,w,h,c);
 const fit=(p,text,size,max,bold=false)=>{text=String(text||'');while(p.measure(text,size,bold)>max&&text.length>3)text=text.slice(0,-4)+'...';return text;};
 function wrap(p,text,size,max,limit=2){const result=[];let current='';for(const word of String(text||'').split(/\s+/)){const next=(current+' '+word).trim();if(p.measure(next,size)>max&&current){result.push(current);current=word;}else current=next;}if(current)result.push(current);if(result.length>limit)result[limit-1]=fit(p,result.slice(limit-1).join(' '),size,max);return result.slice(0,limit);}
 const names={I:'Não perceptível',II:'Muito fraca',III:'Fraca',IV:'Leve',V:'Moderada',VI:'Forte',VII:'Muito forte',VIII:'Severa',IX:'Violenta',X:'Extrema',XI:'Extrema',XII:'Extrema'};
 function frame(ev){
  const model=globalThis.SeismicImpactModel;
  const magnitude=Number(ev.mag),depth=Math.max(0,Number(ev.depth)||0);
  const threshold=magnitude>=5?11:model.pga(magnitude,depth,0)>=2.1?2.1:.5;
  const radius=Math.max(magnitude>=5?80:5,model.extent(magnitude,depth,threshold)*1.25);
  let zoom=Math.max(3,Math.min(magnitude>=5?7:10,Math.floor(Math.log2(180*111.32/radius))));
  const grid=globalThis.RuptureShakingModel?.valid(ev.shaking?.grid)?ev.shaking.grid:null;
  if(grid){
   let spanNeeded=0,found=false;const preferred=magnitude>=5?4:3,maximum=Math.max(...grid.values.filter(v=>v!=null));const threshold=maximum>=preferred?preferred:(globalThis.RuptureShakingModel.minimumMmi||3);
   for(let y=0;y<grid.ny;y++)for(let x=0;x<grid.nx;x++){
    const mmi=grid.values[y*grid.nx+x];if(mmi===null||mmi<threshold)continue;
    let lng=grid.x0+x*(grid.x1-grid.x0)/(grid.nx-1),lat=grid.y0+y*(grid.y1-grid.y0)/(grid.ny-1);
    lng+=360*Math.round((Number(ev.lon)-lng)/360);const dy=lat-Number(ev.lat);
    spanNeeded=Math.max(spanNeeded,Math.abs(lng-Number(ev.lon)),Math.abs(dy)*800/(2*(dy>=0?ANCHOR_Y:MAP_HEIGHT-ANCHOR_Y)));found=true;
   }
   if(found)zoom=Math.max(3,Math.min(10,Math.floor(Math.log2(180/Math.max(.03,spanNeeded*1.12)))));
  }
  const span=180/2**zoom;
  return {width:800,height:MAP_HEIGHT,zoom,anchorX:400,anchorY:ANCHOR_Y,minLon:Number(ev.lon)-span,maxLon:Number(ev.lon)+span,minLat:Number(ev.lat)-2*span*(MAP_HEIGHT-ANCHOR_Y)/800,maxLat:Number(ev.lat)+2*span*ANCHOR_Y/800};
 }
 function validExposure(e){
  if(e?.status!=='available'||!['pager','worldpop','geonames-localities'].includes(e.method)||e.ranges?.length!==3)return false;
  const reserve=e.method==='geonames-localities';if(reserve&&(!e.partial||!(Number(e.ranges[0].population)>0)||!Number.isInteger(e.ranges[0].localities)||e.ranges[0].localities<1))return false;
  return e.ranges.every((r,i)=>reserve&&i&&r.population===null||r.population!=null&&Number.isFinite(Number(r.population))&&Number(r.population)>=0&&(!i||Number(r.population)<=Number(e.ranges[i-1].population)));
 }
 function drawLegacyTsunami(p,status){
  const white='#edf6fa',muted='#b4ceda',box=(...args)=>(p.roundRect||p.rect)(...args);
  const ts=status||{state:'unknown',headline:'TSUNAMI: SITUAÇÃO NÃO CONFIRMADA',areas:'Ausência de boletim não significa ausência de risco.'};
  const tc={warning:'#ff867c',watch:'#ffb15e',advisory:'#ffe078',cancelled:'#8bd8bd',noThreat:'#8bd8bd'}[ts.state]||muted;
  const fit=(text,size,max=690)=>{text=String(text||'');while(p.measure(text,size)>max&&text.length>3)text=text.slice(0,-4)+'...';return text;};
  box(32,615,736,116,'#071722');p.rect(32,623,4,100,tc);const groups=ts.regionalGroups||[],mixed=new Set(groups.map(g=>g.state)).size>1;
  p.text(fit(mixed?'TSUNAMI · SITUAÇÃO POR REGIÃO':(ts.stale&&ts.state!=='unknown'?'ÚLTIMO BOLETIM · ':'')+ts.headline,18),48,626,18,tc,true);
  const issued=Number.isFinite(ts.issuedAt)?new Date(ts.issuedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' BRT':'';
  p.text(fit([ts.source,issued,ts.stale?'Atualização indisponível':''].filter(Boolean).join(' · '),13),48,654,13,muted);
  if(groups.length){for(const [i,g]of groups.slice(0,2).entries()){const when=Number.isFinite(g.issuedAt)?new Date(g.issuedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' BRT':'';const status=g.state==='warning'?'Aviso':g.state==='noThreat'?'Sem ameaça':g.label;const line=[g.source,when,g.stale?'Última informação':''].filter(Boolean).join(' ')+' · '+status+': '+g.regions.join(' · ');p.text(fit(line,14),48,675+i*20,14,g.color||white);}}else p.text(fit(ts.areas,14),48,677,14,white);
  p.text((groups.length>2?'Outras regiões no boletim. ':'')+'Cada situação vale só para as regiões citadas; siga a autoridade local.',48,718,10,muted);
 }
 function contextFrame(ev){const span=22.5,lat=Math.max(-65,Math.min(65,Number(ev.lat)));return {width:292,height:188,minLon:Number(ev.lon)-span,maxLon:Number(ev.lon)+span,minLat:lat-span*188/292,maxLat:lat+span*188/292};}
 function drawContext(p){box(p,CONTEXT.x,CONTEXT.y,CONTEXT.width,CONTEXT.height);p.text('CONTEXTO REGIONAL',CONTEXT.x+8,CONTEXT.y+9,12,white,true);}
 function contourRows(contours){return [...new Map([...contours].sort((a,b)=>a.level-b.level).map(a=>[a.level,a])).values()];}
 function drawContourLabels(p,contours){
  const occupied=[[CONTEXT.x,CONTEXT.y,CONTEXT.x+CONTEXT.width,CONTEXT.y+CONTEXT.height],[285,MAP_Y+ANCHOR_Y-15,590,MAP_Y+ANCHOR_Y+55],[550,MAP_Y+MAP_HEIGHT-60,784,MAP_Y+MAP_HEIGHT]];
  for(const a of contourRows(contours).slice(0,6)){
   if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.y<MAP_Y+15||a.y>MAP_Y+MAP_HEIGHT-15)continue;
   const label=a.roman+' · '+a.description,w=Math.min(220,p.measure(label,14,true)+20),h=28;
   const positions=[[a.x+10,a.y-34],[a.x-w-10,a.y-34],[a.x+10,a.y+10],[a.x-w-10,a.y+10]];
   const pos=positions.find(([x,y])=>x>=16&&x+w<=784&&y>=MAP_Y+12&&y+h<=MAP_Y+MAP_HEIGHT-12&&!occupied.some(([l,t,r,b])=>x<r&&x+w>l&&y<b&&y+h>t));
   if(!pos)continue;const [x,y]=pos;box(p,x,y,w,h);p.rect(x+5,y+5,3,h-10,a.color);p.text(label,x+13,y+6,14,white,true);p.dot(a.x,a.y,3,a.color);occupied.push([x,y,x+w,y+h]);
  }
 }
 function drawTsunami(p,status){
  const ts=status||{state:'unknown',headline:'Situação não confirmada',areas:'Ausência de boletim não significa ausência de risco.'};
  box(p,24,TSUNAMI_Y,752,TSUNAMI_HEIGHT,'#10232c');p.text('TSUNAMI · SITUAÇÃO POR REGIÃO',38,TSUNAMI_Y+12,17,white,true);
  const groups=ts.regionalGroups||[],color={warning:'#eda08a',watch:'#dfc58d',advisory:'#dfc58d',cancelled:'#9dcbbb',noThreat:'#9dcbbb'}[ts.state]||muted;
  if(groups.length){
   for(const [i,g]of groups.slice(0,2).entries()){
    const y=TSUNAMI_Y+42+i*51,when=Number.isFinite(g.issuedAt)?new Date(g.issuedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT':'';
    const state=g.state==='warning'?'Aviso: ondas perigosas possíveis':g.state==='noThreat'?'Sem ameaça segundo o boletim':g.label||'Informativo';
    p.dot(42,y+8,3,g.color||color);p.text(fit(p,state,15,710,true),54,y,15,g.color||color,true);
    p.text(fit(p,g.regions.join(' · '),14,710),38,y+19,14,white);
    p.text(fit(p,[g.source,when,g.stale?'Último boletim; atualização indisponível':''].filter(Boolean).join(' · '),11,710),38,y+36,11,muted);
   }
  }else{
   p.text(fit(p,(ts.stale&&ts.state!=='unknown'?'Último boletim · ':'')+(ts.headline||'Situação não confirmada'),16,710,true),38,TSUNAMI_Y+43,16,color,true);
   const issued=Number.isFinite(ts.issuedAt)?new Date(ts.issuedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' BRT':'';
   p.text(fit(p,[ts.source,issued,ts.stale?'Atualização indisponível':''].filter(Boolean).join(' · '),13,710),38,TSUNAMI_Y+68,13,muted);
   wrap(p,ts.areas||'Consulte os boletins oficiais atualizados.',15,710,2).forEach((s,i)=>p.text(s,38,TSUNAMI_Y+91+i*20,15,white));
  }
  p.text(groups.length>2?'Outras regiões: consulte o boletim oficial.':'Cada situação vale apenas para as regiões citadas.',38,TSUNAMI_Y+148,12,muted);
  p.text('Siga os boletins oficiais e as orientações das autoridades locais.',38,TSUNAMI_Y+164,11,muted);
 }
 function drawBrand(p,status='AO VIVO'){
  box(p,28,16,40,40,'#020816');
  for(const r of [17,11.5,6])p.arc(48,36,r,1.2,-90,360,'#1c6182');
  for(let r=1;r<=17;r++)p.arc(48,36,r,1.3,-90,45,'#38bdf8');
  p.dot(48,36,2.4,'#38bdf8');
  (p.brandText||p.text)('MONITOR GLOBAL',80,20,29,white,true);
  const size=13;p.text(status,774-p.measure(status,size,true),27,size,muted,true);
 }
 function drawFooter(p){p.text('monitorglobal.top',28,1410,13,muted);const channel='@monitor_global';p.text(channel,774-p.measure(channel,14,true),1409,14,'#38bdf8',true);}
 function draw(p,ev){
  const pt=globalThis.EventPortuguese,fmt=(n,d=0)=>pt?.number(n,d)??Number(n).toFixed(d).replace('.',',');
  const place=pt?.place(ev.place)||ev.place||'Local não informado',revision=pt?.revision(ev)||ev.revisionText||'';
  p.rect(0,0,800,MAP_Y,bg);p.rect(0,MAP_Y+MAP_HEIGHT,800,1440-MAP_Y-MAP_HEIGHT,bg);
  drawBrand(p,ev.test?'TESTE':revision?'ATUALIZADO':'AO VIVO');
  p.rect(24,66,752,1,line);
  p.text(fit(p,ev.imageRegion?pt?.place(ev.imageRegion)||ev.imageRegion:'SISMO',23,550,true),28,81,23,white,true);
  p.text('M'+fmt(ev.mag,1),624,77,40,Number(ev.mag)>=6?'#e79788':white,true);p.text('MAGNITUDE DO SISMO',621,126,10,muted);
  wrap(p,place,21,570,2).forEach((s,i)=>p.text(s,28,116+i*26,21,white));
  p.dot(400,MAP_Y+ANCHOR_Y,8,'#ffffff');p.dot(400,MAP_Y+ANCHOR_Y,5,'#ec8578');
  box(p,306,MAP_Y+ANCHOR_Y+17,188,29);p.text('EPICENTRO · M'+fmt(ev.mag,1),317,MAP_Y+ANCHOR_Y+24,15,white,true);
  drawContourLabels(p,ev.imageContours||[]);
  if(!ev.imageMapAvailable){box(p,238,MAP_Y+30,320,31);p.text('Mapa de contexto indisponível',250,MAP_Y+38,15,muted);}
  box(p,24,620,752,98);p.text('COMO LER O MAPA · INTENSIDADE LOCAL',38,631,16,white,true);
  const levels=contourRows(ev.imageContours||[]),visible=levels.slice(0,6);
  if(visible.length){visible.forEach((a,i)=>{const col=i%3,row=Math.floor(i/3),x=38+col*242,y=655+row*21;p.rect(x,y+7,20,3,a.color);p.text(fit(p,a.roman+' · '+a.description,13,210),x+27,y,13,white);});}
  else p.text(ev.imageMapAvailable?'Nenhum contorno visível neste enquadramento.':'Contornos indisponíveis nesta imagem; não significa ausência de tremor.',38,655,14,muted);
  p.text(ev.shaking?.status==='available'?'USGS ShakeMap · intensidade publicada':'Modelo estimado · não confirma tremor ou danos',38,695,11,muted);
  p.text('As linhas indicam o tremor em cada faixa; não representam ondas de tsunami.',38,739,13,muted);
  p.text(fit(p,ev.when||'Horário não informado',16,720),38,768,16,white);
  p.text(fit(p,ev.sourceLabel||ev.sourceLine||ev.source||'Fonte não informada',14,720),38,793,14,muted);
  const coords=Number.isFinite(Number(ev.lat))&&Number.isFinite(Number(ev.lon))?fmt(Math.abs(ev.lat),2)+'° '+(ev.lat<0?'S':'N')+' · '+fmt(Math.abs(ev.lon),2)+'° '+(ev.lon<0?'O':'L'):'';
  if(coords)p.text(coords,38,817,14,muted);
  if(revision)p.text(fit(p,'REVISÃO · '+revision,14,coords?352:720,true),coords?410:38,817,14,muted,true);
  box(p,24,846,752,140);const mmi=ev.mmi||'—',description=names[mmi];
  const stats=[['PROFUNDIDADE',Number.isFinite(Number(ev.depth))?fmt(Math.max(0,Number(ev.depth)))+' km':'—',Number(ev.depth)<70?'Raso':Number(ev.depth)<300?'Intermediário':'Profundo'],['MMI NO EPICENTRO',mmi+(description?' · '+description:''),ev.shaking?.status==='available'?'USGS ShakeMap':'Estimada'],['ENERGIA ESTIMADA',String(ev.energy||'—').replace(/(\d+)\.(\d+)(?=\s)/g,'$1,$2'),'Equivalente em TNT']];
  stats.forEach((s,i)=>{const x=38+i*247;if(i)p.rect(x-12,861,1,83,line);p.text(s[0],x,861,11,muted);p.text(fit(p,s[1],i===1?19:25,225,true),x,888,i===1?19:25,white,true);p.text(s[2],x,923,13,muted);});
  p.text('Magnitude: tamanho do sismo. Intensidade: força do tremor em cada local.',38,958,13,muted);
  p.text('Energia: conversão física; não indica danos.',38,975,11,muted);
  drawTsunami(p,ev.imageTsunami);
  box(p,24,1190,752,204);const e=ev.exposure,reserve=e?.method==='geonames-localities',valid=validExposure(e),count=n=>Math.round(Number(n)).toLocaleString('pt-BR');
  p.text(reserve?'POPULAÇÃO NAS LOCALIDADES DA ÁREA · EST':'POPULAÇÃO POTENCIALMENTE EXPOSTA · MMI III+',38,1205,13,muted);
  if(!reserve)p.text('MMI III+: área de tremor fraco ou maior.',38,1224,11,muted);
  if(valid&&reserve){const n=Number(e.ranges[0].population),scale=10**Math.max(0,Math.floor(Math.log10(n))-1);p.text('~ '+count(Math.round(n/scale)*scale)+' pessoas',38,1238,32,white,true);p.text('Estimativa preliminar · '+count(e.ranges[0].localities)+' localidades cadastradas',38,1283,14,muted);p.text('GeoNames · cobertura parcial · população rural incompleta',38,1308,14,muted);}
  else if(valid){p.text('~ '+count(e.ranges[0].population)+' pessoas',38,1238,32,white,true);p.text('MMI V+: ~ '+count(e.ranges[1].population)+' · MMI VI+: ~ '+count(e.ranges[2].population),38,1283,14,muted);p.text((e.method==='pager'?'USGS PAGER':'WorldPop 2020')+(e.partial?' · cobertura parcial':'')+' · faixas cumulativas',38,1308,14,muted);}
  else{p.text(e?.status==='pending'?'Estimativa em consulta':'Estimativa indisponível',38,1240,27,white,true);p.text(e?.status==='pending'?'A imagem será atualizada quando houver dados.':'Sem dados suficientes; não significa zero.',38,1283,14,muted);}
  p.text(reserve?'Pode haver sobreposição; cobertura incompleta.':'As faixas se sobrepõem; não some os valores.',38,1340,14,muted);
  p.text('Estimativa de exposição; não confirma quem sentiu ou danos.',38,1364,14,muted);
  drawFooter(p);
 }
 globalThis.QuakeCardLayout={frame,draw,drawBrand,drawFooter,validExposure,contextFrame,drawContext,drawContourLabels,drawTsunami,drawLegacyTsunami,MAP_Y,MAP_HEIGHT,ANCHOR_Y,CONTEXT,TSUNAMI_Y,TSUNAMI_HEIGHT,version:'editorial-v17'};
})();

/* One cartographic composition for Telegram and earthquake Stories (800 × 1440). */
(function(){
 const MAP_HEIGHT=820,ANCHOR_Y=550;
 function frame(ev){
  const model=globalThis.SeismicImpactModel;
  const radius=Math.max(80,Number(ev.mag)>=5?model.extent(Number(ev.mag),Number(ev.depth)||0,11)*1.25:80);
  const zoom=Math.max(3,Math.min(7,Math.floor(Math.log2(180*111.32/radius))));
  const span=180/2**zoom;
  return {width:800,height:MAP_HEIGHT,zoom,anchorX:400,anchorY:ANCHOR_Y,minLon:Number(ev.lon)-span,maxLon:Number(ev.lon)+span,minLat:Number(ev.lat)-2*span*(MAP_HEIGHT-ANCHOR_Y)/800,maxLat:Number(ev.lat)+2*span*ANCHOR_Y/800};
 }
 function draw(p,ev){
  ev={...ev,place:globalThis.EventPortuguese?.place(ev.place)||ev.place};
  const white='#edf6fa',muted='#b4ceda',line='#315365',red=Number(ev.mag)>=6?'#ff6151':Number(ev.mag)>=5?'#fb923c':Number(ev.mag)>=4?'#facc15':'#4ade80';
  const box=(...args)=>(p.roundRect||p.rect)(...args);
  if(p.gradient)p.gradient(0,820,800,620,'#102b3d','#06131f');else p.rect(0,820,800,620,'#0b2232');p.rect(0,820,800,1,line);
  p.text('MONITOR GLOBAL',32,30,19,white,true);
  p.text(ev.test?'TESTE':'AO VIVO',660,30,13,muted,true);
  p.dot(400,550,10,'#ffffff');p.dot(400,550,7,red);
  p.text('M'+Number(ev.mag).toFixed(1)+' · '+Math.round(Math.max(0,Number(ev.depth)))+' km',420,540,13,white,true);
  box(32,720,365,88,'#396274');box(33,721,363,86,'#071722');p.text('INTENSIDADE ESTIMADA DO TREMOR',50,734,12,muted,true);
  ['#93b8e4','#88d3eb','#68dc2c','#efef20','#ffb52b','#ff5540'].forEach((c,i)=>p.rect(50+i*54,760,54,9,c));
  p.text('Fraca',50,778,12,muted);p.text('Moderada',181,778,12,muted);p.text('Forte',344,778,12,muted);
  p.arc(98,916,50,9,180,180,'#294757');p.arc(98,916,50,9,180,180,red);
  p.text('MAGNITUDE DO SISMO',182,849,13,'#e5a996');p.text('M'+Number(ev.mag).toFixed(1),182,870,68,red,true);
  // Wrap long locations without allowing them into the statistics.
  const words=String(ev.place||'Local desconhecido').split(/\s+/),lines=[];let current='';
  for(const word of words){const next=(current+' '+word).trim();if(p.measure(next,26,true)>728&&current){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);
  lines.slice(0,2).forEach((s,i)=>p.text(s,36,954+i*32,26,white,true));
  p.text(ev.when||'Horário não informado',36,1024,15,muted);
  let source=ev.sourceLine||ev.source||'Fonte não informada';
  while(p.measure(source,15)>728&&source.length>3)source=source.slice(0,-4)+'...';p.text(source,36,1050,15,muted);
  p.rect(36,1093,728,1,line);p.rect(36,1209,728,1,line);
  const stats=[['PROFUNDIDADE',Math.round(Math.max(0,Number(ev.depth)))+' km',ev.depth<70?'Raso':ev.depth<300?'Intermediário':'Profundo'],['INTENSIDADE · MMI',ev.mmi||'—','Estimada'],['ENERGIA',ev.energy||'—','TNT equivalente']];
  stats.forEach((s,i)=>{const x=36+i*246;if(i)p.rect(x-12,1110,1,85,line);p.text(s[0],x,1114,11,muted);p.text(s[1],x,1138,25,white,true);p.text(s[2],x,1178,13,muted);});
  box(36,1228,728,163,'#416879');box(37,1229,726,161,'#0b2232');
  p.text('POPULAÇÃO POTENCIALMENTE EXPOSTA · III+',56,1246,12,muted);
  const e=ev.exposure,valid=e?.status==='available'&&['pager','worldpop'].includes(e.method)&&e.ranges?.length===3&&e.ranges.every((r,i)=>r.population!=null&&Number.isFinite(Number(r.population))&&Number(r.population)>=0&&(!i||Number(r.population)<=Number(e.ranges[i-1].population)));
  const count=n=>Math.round(Number(n)).toLocaleString('pt-BR');
  if(valid){p.text('~ '+count(e.ranges[0].population)+' pessoas',56,1272,31,'#ffe078',true);p.text('V+: ~ '+count(e.ranges[1].population)+' · VI+: ~ '+count(e.ranges[2].population),56,1315,13,muted);p.text((e.method==='pager'?'USGS PAGER':'WorldPop 2020')+(e.partial?' · cobertura parcial':'')+' · faixas cumulativas',56,1338,13,muted);}
  else{p.text(e?.status==='pending'?'Estimativa em consulta':'Estimativa indisponível',56,1277,25,'#ffe078',true);p.text(e?.status==='pending'?'A imagem será atualizada quando houver dados.':'Sem dados suficientes; não significa zero.',56,1320,13,muted);}
  p.text('Estimativa de exposição; não confirma quem sentiu ou danos.',56,1364,13,muted);
  p.text('monitorglobal.top',36,1410,12,'#79d4f0',true);p.text('Monitor Global',641,1410,12,muted);
 }
 globalThis.QuakeCardLayout={frame,draw,MAP_HEIGHT,ANCHOR_Y,version:'cartographic-v6-portuguese'};
})();

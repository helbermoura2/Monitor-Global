/* One cartographic composition for Telegram and earthquake Stories (800 × 1440). */
(function(){
 const MAP_HEIGHT=820,ANCHOR_Y=550;
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
 function draw(p,ev){
  const pt=globalThis.EventPortuguese,fmt=(n,d=0)=>pt?.number(n,d)??Number(n).toFixed(d).replace('.',',');
  ev={...ev,place:globalThis.EventPortuguese?.place(ev.place)||ev.place};
  const white='#edf6fa',muted='#b4ceda',line='#315365',red=Number(ev.mag)>=6?'#ff6151':Number(ev.mag)>=5?'#fb923c':Number(ev.mag)>=4?'#facc15':'#4ade80';
  const box=(...args)=>(p.roundRect||p.rect)(...args);
  if(p.gradient)p.gradient(0,820,800,620,'#102b3d','#06131f');else p.rect(0,820,800,620,'#0b2232');p.rect(0,820,800,1,line);
  box(24,20,225,38,'#102b3d');p.text('MONITOR GLOBAL',32,27,19,white,true);
  const revision=pt?.revision(ev)||ev.revisionText||'';
  box(revision?610:650,20,revision?170:126,35,'#102b3d');p.text(ev.test?'TESTE':revision?'ATUALIZADO':'AO VIVO',revision?620:660,30,13,revision?'#ffe078':muted,true);
  p.dot(400,550,10,'#ffffff');p.dot(400,550,7,red);
  box(420,553,170,31,'#102b3d');p.text('M'+fmt(ev.mag,1)+' · '+fmt(Math.max(0,Number(ev.depth)))+' km',430,558,16,white,true);
  box(32,708,465,100,'#396274');box(33,709,463,98,'#071722');p.text('INTENSIDADE ESTIMADA DO TREMOR',50,720,15,white,true);
  ['#93b8e4','#88d3eb','#68dc2c','#efef20','#ffb52b','#ff5540'].forEach((c,i)=>p.rect(50+i*66,749,66,9,c));
  p.text('Fraca',50,765,14,muted);p.text('Moderada',203,765,14,muted);p.text('Forte',402,765,14,muted);
  p.text(ev.shaking?.status==='available'?'USGS ShakeMap · intensidade publicada':'Modelo estimado · não indica danos',50,790,11,muted);
  p.arc(98,916,50,9,180,180,'#294757');p.arc(98,916,50,9,180,180,red);
  p.text('MAGNITUDE DO SISMO',182,849,13,'#e5a996');p.text('M'+fmt(ev.mag,1),182,870,68,red,true);
  // Wrap long locations without allowing them into the statistics.
  const words=String(ev.place||'Local desconhecido').split(/\s+/),lines=[];let current='';
  for(const word of words){const next=(current+' '+word).trim();if(p.measure(next,26,true)>728&&current){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);
  lines.slice(0,2).forEach((s,i)=>p.text(s,36,954+i*32,26,white,true));
  p.text(ev.when||'Horário não informado',36,1024,15,muted);
  let source=ev.sourceLine||ev.source||'Fonte não informada';
  while(p.measure(source,15)>728&&source.length>3)source=source.slice(0,-4)+'...';p.text(source,36,1050,15,muted);
  if(revision){let caption='REVISÃO · '+revision;while(p.measure(caption,13,true)>728&&caption.length>3)caption=caption.slice(0,-4)+'...';p.text(caption,36,1075,13,'#ffe078',true);}
  p.rect(36,1093,728,1,line);p.rect(36,1209,728,1,line);
  const stats=[['PROFUNDIDADE',fmt(Math.max(0,Number(ev.depth)))+' km',ev.depth<70?'Raso':ev.depth<300?'Intermediário':'Profundo'],['INTENSIDADE · MMI',ev.mmi||'—',ev.shaking?.status==='available'?'USGS ShakeMap':'Estimada'],['ENERGIA',String(ev.energy||'—').replace(/(\d+)\.(\d+)(?=\s)/g,'$1,$2'),'TNT equivalente']];
  stats.forEach((s,i)=>{const x=36+i*246;if(i)p.rect(x-12,1110,1,85,line);p.text(s[0],x,1114,11,muted);p.text(s[1],x,1138,25,white,true);p.text(s[2],x,1178,13,muted);});
  box(36,1228,728,163,'#416879');box(37,1229,726,161,'#0b2232');
  const e=ev.exposure,reserve=e?.method==='geonames-localities',valid=validExposure(e);
  p.text(reserve?'POPULAÇÃO NAS LOCALIDADES DA ÁREA · EST':'POPULAÇÃO POTENCIALMENTE EXPOSTA · III+',56,1246,12,muted);
  const count=n=>Math.round(Number(n)).toLocaleString('pt-BR');
  if(valid&&reserve){const n=Number(e.ranges[0].population),scale=10**Math.max(0,Math.floor(Math.log10(n))-1);p.text('~ '+count(Math.round(n/scale)*scale)+' pessoas',56,1272,31,'#ffe078',true);p.text('Estimativa preliminar · '+count(e.ranges[0].localities)+' localidades cadastradas',56,1315,13,muted);p.text('GeoNames · cobertura parcial · população rural incompleta',56,1338,13,muted);}
  else if(valid){p.text('~ '+count(e.ranges[0].population)+' pessoas',56,1272,31,'#ffe078',true);p.text('V+: ~ '+count(e.ranges[1].population)+' · VI+: ~ '+count(e.ranges[2].population),56,1315,13,muted);p.text((e.method==='pager'?'USGS PAGER':'WorldPop 2020')+(e.partial?' · cobertura parcial':'')+' · faixas cumulativas',56,1338,13,muted);}
  else{p.text(e?.status==='pending'?'Estimativa em consulta':'Estimativa indisponível',56,1277,25,'#ffe078',true);p.text(e?.status==='pending'?'A imagem será atualizada quando houver dados.':'Sem dados suficientes; não significa zero.',56,1320,13,muted);}
  p.text(reserve?'Pode haver sobreposição; não confirma quem sentiu ou danos.':'Estimativa de exposição; não confirma quem sentiu ou danos.',56,1364,13,muted);
  p.text('monitorglobal.top',36,1410,12,'#79d4f0',true);p.text('Monitor Global',641,1410,12,muted);
 }
 globalThis.QuakeCardLayout={frame,draw,validExposure,MAP_HEIGHT,ANCHOR_Y,version:'cartographic-v12-context'};
})();

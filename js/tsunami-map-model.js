/* Coastal references are not hazard or inundation boundaries. Shared with tests. */
(function(root){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={panama:'panama',brasil:'brazil',peru:'peru',equador:'ecuador',colombia:'colombia',mexico:'mexico',chile:'chile',japao:'japan',indonesia:'indonesia',filipinas:'philippines',novazelandia:'newzealand',australia:'australia',russia:'russia',polinesiafrancesa:'frenchpolynesia',novacaledonia:'newcaledonia',ilhascook:'cookislands',ilhassalomao:'solomonislands',marshalls:'marshallislands',micronesia:'federatedstatesofmicronesia',chuuk:'federatedstatesofmicronesia',kosrae:'federatedstatesofmicronesia',pohnpei:'federatedstatesofmicronesia',rota:'northernmarianaislands',tinian:'northernmarianaislands',saipan:'northernmarianaislands',northernmarianas:'northernmarianaislands',columbiabritanica:'britishcolumbia',havaí:'hawaii',havai:'hawaii',samoaamericana:'americansamoa',alasca:'alaska'};
 function status(item){
  const regional=root.TsunamiRegional?.rows(item);if(regional?.length){const active=regional.some(r=>r.active),noThreat=regional.every(r=>r.state==='noThreat'),ended=regional.every(r=>r.state==='ended');return {level:active?'warning':noThreat?'no-threat':ended?'ended':'information',title:active?'Aviso oficial para as regiões citadas':noThreat?'Sem ameaça nas regiões citadas':ended?'Aviso encerrado nas regiões citadas':'Situação de tsunami por região',message:'Cada situação vale somente para as regiões e a autoridade do boletim; outras costas podem ter situação diferente.'};}
  const text=[item.warningLevel,item.title,item.description,item.detail].filter(Boolean).join(' ');
  if(item.cancelled)return {level:'ended',title:'Boletim de tsunami encerrado',message:'Consulte as orientações finais da autoridade.'};
  if(item.hazardNature!=='warning'&&/no tsunami (?:threat|danger)|no existe peligro de tsunami|sem amea[cç]a|n[aã]o h[aá] amea[cç]a/i.test(text))return {level:'no-threat',title:'Sem ameaça de tsunami, segundo o boletim',message:'Não há ameaça indicada para as áreas avaliadas neste boletim. Isto não é um alerta de ameaça.'};
  if(item.hazardNature==='warning')return {level:'warning',title:'Aviso oficial de tsunami',message:'Siga as orientações da autoridade para as costas indicadas no boletim.'};
  return {level:'information',title:'Boletim informativo de tsunami',message:'Informativo não confirma ameaça nem ocorrência de tsunami. Consulte o boletim oficial.'};
 }
 const noticeWindows=new Map();
 function record(item,host){
  if(item.type!=='tsunami'||!root.document||!root.TsunamiLink?.official(item))return null;
  const state=root.DesktopRecords?.state?.(),now=Date.now();
  const arrival=typeof activeAlertingIds!=='undefined'?activeAlertingIds.get(item.id)||0:0;
  const announced=state&&!state.pinned&&state.ids.includes(item.id);
  let noticeWindow=noticeWindows.get(item.id);
  if((arrival||announced)&&(!noticeWindow||arrival&&noticeWindow.arrival!==arrival)){noticeWindow={arrival,until:arrival?Math.min(arrival,now+60000):now+60000};noticeWindows.set(item.id,noticeWindow);while(noticeWindows.size>256)noticeWindows.delete(noticeWindows.keys().next().value);}
  if(!noticeWindow||noticeWindow.until<=now)return null;
  const view=status(item),key=JSON.stringify([view,item.time,item.source,item.affectedAreas,item.coverageAreas,item.cancelled,noticeWindow.until]);
  if(host.__tsunamiNotice?.key===key)return host.__tsunamiNotice.node;
  const box=document.createElement('section');box.className='tsunami-record-notice';box.dataset.bulletinId=String(item.id);box.dataset.level=view.level;
  const add=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;box.append(el);return el;};
  add('strong',view.title);add('small',(item.source||'Fonte oficial')+' · '+(item.warningLevel||'Boletim oficial'));add('p',view.message);
  const groups=root.TsunamiRegional?.bundle(item,typeof globalAlerts==='undefined'?[]:globalAlerts,typeof globalEvents==='undefined'?[]:globalEvents)?.groups||[];for(const group of groups.slice(0,4))add('small',group.regions.join(' · ')+' · '+group.label+' · '+group.source);
  if(view.level==='warning'){
   const areas=[...item.affectedAreas||[],...item.coverageAreas||[]];
   for(const area of areas.slice(0,6))add('small',placeLabel(area.name)+' · '+category(area,item).label);
   if(!areas.length&&!item.warningGeometry)add('small','O boletim não fornece costas com contornos identificáveis. Consulte a fonte oficial.');
   else {const button=add('button','Ver costas do boletim');button.type='button';button.onclick=e=>{e.stopPropagation();root.TsunamiLinkedPanel?.open(item);Promise.resolve(root.TsunamiMap?.show(item)).then(()=>root.TsunamiMap?.fit());};}
   add('small','As faixas costeiras não representam inundação em terra.');
  }
  clearTimeout(host.__tsunamiNotice?.timer);
  const timer=setTimeout(()=>box.remove(),Math.max(1,noticeWindow.until-now));
  host.__tsunamiNotice={key,node:box,timer};return box;
 }
 function category(area,item){
  const value=String(area.category||item.warningLevel||'').replace(/\b(\d+)[.,]0+\b/g,'$1').replace(/\b0[.,]30+\b/g,'0.3');
  if(item.cancelled||/cancel|encerrad/i.test(value))return {color:'#94a3b8',label:'Encerrado',rank:0};
  if(/no (?:tsunami )?(?:threat|danger)|sem amea[cç]a/i.test(value))return {color:root.TsunamiRegional?.colors.noThreat||'#70c9b5',label:'Sem ameaça no boletim',rank:1};
  if(/information|informativ/i.test(value)||item.hazardNature==='bulletin')return {color:'#38bdf8',label:'Informativo',rank:1};
  if(/(?:less than|menos de|<)\s*0[.,]3/i.test(value))return {color:'#2dd4bf',label:'Previsão menor que 0,3 m',rank:2};
  if(/(?:greater than|more than|mais de|>|≥)\s*3|(?:(?:^|[^\d.,])3\s*(?:to|a|-)\s*\d)/i.test(value))return {color:'#ef4444',label:'Previsão acima de 3 m',rank:5};
  if(/1\s*(?:to|a|-)\s*3/i.test(value))return {color:'#fb7148',label:'Previsão de 1 a 3 m',rank:4};
  if(/0[.,]3\s*(?:to|a|-)\s*1/i.test(value))return {color:'#fbbf24',label:'Previsão de 0,3 a 1 m',rank:3};
  if(/watch|vigilancia|advisory|atencao/i.test(normalize(value)))return {color:'#fbbf24',label:item.warningLevel||'Atenção',rank:3};
  return {color:'#fb7148',label:item.warningLevel||'Aviso oficial',rank:4};
 }
 function build(item,regions){
  const features=[],entries=[],unmapped=[];

  if(['Polygon','MultiPolygon'].includes(item.warningGeometry?.type)){
   const c=category({},item);features.push({type:'Feature',geometry:item.warningGeometry,properties:{...c,name:item.place,kind:'official'}});entries.push(c);
  }
  const index=new Map();for(const f of regions?.features||[])for(const name of [f.properties.name,...f.properties.aliases||[]])index.set(normalize(name),f);
  const areas=[...(item.affectedAreas||[]),...(item.coverageAreas||[])];
  const chosen=new Map();
  for(const area of areas){const key=normalize(area.name),region=index.get(aliases[key]||key),c=category(area,item);
   if(!region){unmapped.push(area.name);continue;}
   const prev=chosen.get(region.properties.name);if(!prev||prev.c.rank<c.rank)chosen.set(region.properties.name,{region,c});
  }
  for(const {region,c} of chosen.values()){
   features.push({type:'Feature',geometry:region.geometry,properties:{...c,name:region.properties.name,kind:'reference',band:'outer'}});
   if(region.innerGeometry)features.push({type:'Feature',geometry:region.innerGeometry,properties:{...c,name:region.properties.name,kind:'reference',band:'inner'}});
   if(region.coastlineGeometry)features.push({type:'Feature',geometry:region.coastlineGeometry,properties:{...c,name:region.properties.name,kind:'reference',band:'shoreline'}});
   entries.push(c);
  }
  return {data:{type:'FeatureCollection',features},entries:[...new Map(entries.map(c=>[c.label,c])).values()].sort((a,b)=>b.rank-a.rank),unmapped};
 }
 function buildGroup(bundle,regions){
  const features=[],entries=[],unmapped=[];
  for(const item of bundle.bulletins){const own=bundle.rows.filter(r=>r.bulletinId===item.id);for(const row of own){const c={...item,hazardNature:row.active?'warning':'bulletin',cancelled:row.state==='ended',warningLevel:row.category,warningGeometry:own.indexOf(row)===0?item.warningGeometry:null,coverageAreas:[],affectedAreas:row.scoped?[{name:row.region,category:row.state==='noThreat'?'No tsunami threat':row.category}]:[]};const r=build(c,regions);for(const f of r.data.features)features.push({...f,properties:{...f.properties,regionalState:row.state,source:row.source,issuedAt:row.issuedAt,stale:row.stale}});entries.push(...r.entries);unmapped.push(...r.unmapped);}}
  features.sort((a,b)=>(a.properties.rank||0)-(b.properties.rank||0));
  return {data:{type:'FeatureCollection',features},entries:[...new Map(entries.map(c=>[c.label,c])).values()].sort((a,b)=>b.rank-a.rank),unmapped:[...new Set(unmapped)]};
 }
 function longitudeBounds(values){
  const xs=values.map(x=>(x%360+360)%360).sort((a,b)=>a-b);if(!xs.length)return [-180,180];
  let gap=-1,start=0,end=360;
  for(let i=0;i<xs.length;i++){const next=xs[(i+1)%xs.length]+(i===xs.length-1?360:0),size=next-xs[i];if(size>gap){gap=size;start=next%360;end=xs[i];if(end<start)end+=360;}}
  if(end-start>350)return [-180,180];if((start+end)/2>180){start-=360;end-=360;}
  return [start,end];
 }
 function placeLabel(name){return {kurilislands:'Ilhas Curilas',northeasternjapan:'Nordeste do Japão',aleutianislands:'Ilhas Aleutas',southernalaska:'Sul do Alasca',pacificcoastofrussia:'Costa pacífica da Rússia'}[normalize(name)]||root.EventPortuguese?.place(name)||name;}
 const api={build,buildGroup,category,normalize,longitudeBounds,placeLabel,status,record};root.TsunamiMapModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);

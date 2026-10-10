/* Coastal references are not hazard or inundation boundaries. Shared with tests. */
(function(root){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={panama:'panama',brasil:'brazil',peru:'peru',equador:'ecuador',colombia:'colombia',mexico:'mexico',chile:'chile',japao:'japan',indonesia:'indonesia',filipinas:'philippines',novazelandia:'newzealand',australia:'australia',russia:'russia',polinesiafrancesa:'frenchpolynesia',novacaledonia:'newcaledonia',ilhascook:'cookislands',ilhassalomao:'solomonislands',marshalls:'marshallislands',micronesia:'federatedstatesofmicronesia',chuuk:'federatedstatesofmicronesia',kosrae:'federatedstatesofmicronesia',pohnpei:'federatedstatesofmicronesia',rota:'northernmarianaislands',tinian:'northernmarianaislands',saipan:'northernmarianaislands',northernmarianas:'northernmarianaislands',columbiabritanica:'britishcolumbia',havaí:'hawaii',havai:'hawaii',samoaamericana:'americansamoa',alasca:'alaska'};
 function category(area,item){
  const value=String(area.category||item.warningLevel||'');
  if(item.cancelled||/cancel|encerrad|no (?:tsunami )?threat/i.test(value))return {color:'#94a3b8',label:'Encerrado',rank:0};
  if(/information|informativ/i.test(value)||item.hazardNature==='bulletin')return {color:'#38bdf8',label:'Informativo',rank:1};
  if(/(?:less than|menos de)\s*0[.,]3/i.test(value))return {color:'#2dd4bf',label:'Previsão menor que 0,3 m',rank:2};
  if(/(?:greater than|more than|mais de)\s*3|(?:(?:^|[^\d.,])3\s*(?:to|a|-)\s*\d)/i.test(value))return {color:'#ef4444',label:'Previsão acima de 3 m',rank:5};
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
  for(const {region,c} of chosen.values()){features.push({...region,properties:{...c,name:region.properties.name,kind:'reference'}});entries.push(c);}
  return {data:{type:'FeatureCollection',features},entries:[...new Map(entries.map(c=>[c.label,c])).values()].sort((a,b)=>b.rank-a.rank),unmapped};
 }
 function longitudeBounds(values){
  const xs=values.map(x=>(x%360+360)%360).sort((a,b)=>a-b);if(!xs.length)return [-180,180];
  let gap=-1,start=0,end=360;
  for(let i=0;i<xs.length;i++){const next=xs[(i+1)%xs.length]+(i===xs.length-1?360:0),size=next-xs[i];if(size>gap){gap=size;start=next%360;end=xs[i];if(end<start)end+=360;}}
  if(end-start>350)return [-180,180];if((start+end)/2>180){start-=360;end-=360;}
  return [start,end];
 }
 const api={build,category,normalize,longitudeBounds};root.TsunamiMapModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);

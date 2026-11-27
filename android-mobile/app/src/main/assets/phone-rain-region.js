/* Hourly rainfall totals sampled from a single global model. */
(function(root){
'use strict';
const MODEL='gfs_global',STEP=.25,RADIUS=4,SIDE=2*RADIUS+1,HOUR=3600000,SOURCE='argos-regional-rain',MAX_BYTES=550000;
const palette=[[.1,'#72c7f9'],[1,'#3190fa'],[4,'#31cbb3'],[10,'#ffdb67'],[25,'#ff8257'],[50,'#f288df']];
function grid(city){
 const lat=Math.round(city.lat/STEP)*STEP,lon=Math.round(city.lon/STEP)*STEP;
 const cells=[];
 for(let row=-RADIUS;row<=RADIUS;row++)for(let column=-RADIUS;column<=RADIUS;column++)cells.push({lat:lat+row*STEP,lon:lon+column*STEP});
 cells.push({lat:city.lat,lon:city.lon});
 return cells;
}
function url(cells){
 return 'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({
  latitude:cells.map(cell=>cell.lat).join(','),longitude:cells.map(cell=>cell.lon).join(','),
  hourly:'precipitation',timezone:'America/Sao_Paulo',forecast_days:'8',models:MODEL,cell_selection:'nearest'
 });
}
function parse(data,cells,firstDay){
 if(!Array.isArray(data)||data.length!==cells.length||!/^\d{4}-\d\d-\d\d$/.test(firstDay))return null;
 const midnight=Date.parse(firstDay+'T00:00Z');
 const times=data[0]?.hourly?.time;
 if(!Number.isFinite(midnight)||!Array.isArray(times)||times.length!==192||
    times.some((time,i)=>time!==new Date(midnight+i*HOUR).toISOString().slice(0,16)))return null;
 const amounts=[];
 for(let i=0;i<cells.length;i++){
  const row=data[i],hourly=row?.hourly,cell=cells[i];
  if(row?.timezone!=='America/Sao_Paulo'||!Number.isFinite(row.latitude)||!Number.isFinite(row.longitude)||
     Math.abs(row.latitude-cell.lat)>.18||Math.abs(row.longitude-cell.lon)>.18||
     !Array.isArray(hourly?.time)||hourly.time.length!==times.length||hourly.time.some((t,h)=>t!==times[h])||
     !Array.isArray(hourly.precipitation)||hourly.precipitation.length!==times.length||
     hourly.precipitation.some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>500)))return null;
  amounts.push(hourly.precipitation);
 }
 return {times,amounts,cells};
}
function frame(data,date,index){
 if(!data||!Number.isInteger(index)||index<0||index>23)return null;
 const dayStart=data.times.indexOf(date+'T00:00');
 const start=dayStart+index,end=start+1;
 if(dayStart<0||end>=data.times.length)return null;
 // The model timestamps accumulated rain at the end of the hour.
 const samples=data.amounts.slice(0,SIDE*SIDE).map(row=>row[end]);
 return {samples,point:data.amounts.at(-1)[end],coverage:samples.filter(Number.isFinite).length,
  from:data.times[start],to:data.times[end]};
}
function bounds(cells){
 const {lon:west,lat:south}=cells[0],{lon:east,lat:north}=cells[SIDE*SIDE-1];
 return {west,south,east,north};
}
function blend(a,b,fraction){
 if(fraction===0)return a;
 if(fraction===1)return b;
 return a===null||b===null?null:a+(b-a)*fraction;
}
function sample(samples,col,row){
 const x=Math.min(SIDE-2,Math.floor(col)),y=Math.min(SIDE-2,Math.floor(row));
 const i=y*SIDE+x,dx=col-x,dy=row-y;
 const south=blend(samples[i],samples[i+1],dx);
 const north=blend(samples[i+SIDE],samples[i+SIDE+1],dx);
 return blend(south,north,dy);
}
const colors=palette.map(([level,color])=>[level,[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16))]);
function paint(ctx,samples,area){
 const width=ctx.canvas.width,height=ctx.canvas.height,image=ctx.createImageData(width,height);
 const mercator=lat=>Math.asinh(Math.tan(lat*Math.PI/180));
 const top=mercator(area.north),bottom=mercator(area.south);
 for(let y=0;y<height;y++){
  const lat=Math.atan(Math.sinh(top+(bottom-top)*y/(height-1)))*180/Math.PI;
  const row=Math.max(0,Math.min(SIDE-1,(lat-area.south)/STEP));
  for(let x=0;x<width;x++){
   const amount=sample(samples,x*(SIDE-1)/(width-1),row);
   if(amount===null||amount<palette[0][0])continue;
   let lowIndex=0;
   while(lowIndex+1<colors.length&&colors[lowIndex+1][0]<=amount)lowIndex++;
   const [low,lo]=colors[lowIndex], [high,hi]=colors[Math.min(lowIndex+1,colors.length-1)];
   const mix=high===low?0:(amount-low)/(high-low),pixel=(y*width+x)*4;
   for(let c=0;c<3;c++)image.data[pixel+c]=lo[c]+mix*(hi[c]-lo[c]);
   image.data[pixel+3]=Math.round(Math.min(.77,(amount+.1)/(amount+.65))*255);
  }
 }
 ctx.putImageData(image,0,0);
}
function create(getMap,onBack,setMarker){
 const byId=id=>document.getElementById(id);
 const panel=byId('region-rain-panel'),date=byId('region-rain-day'),slider=byId('region-rain-frame'),
  status=byId('region-rain-status'),play=byId('region-rain-play'),retry=byId('region-rain-retry');
 let selected=null,data=null,request=null,pending=null,cache=null,timer=0,active=true,waitingMap=false;
 const surface=document.createElement('canvas');
 surface.width=256;surface.height=256;
 const ctx=surface.getContext('2d');
 const formatter=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
 const swatches=palette.map(([mm,color])=>{
  const mark=document.createElement('span'),swatch=document.createElement('i');
  swatch.style.background=color;mark.append(swatch,String(mm).replace('.',','));return mark;
 });
 byId('region-rain-scale').append(...swatches);
 function stop(){
  clearInterval(timer);timer=0;play.textContent='▶';play.setAttribute('aria-label','Animar chuva prevista');
 }
 function draw(){
  if(!active||!selected||!data)return;
  const map=getMap(),current=frame(data,date.value,Number(slider.value));
  if(!map||!current)return;
  const area=bounds(data.cells),source=map.getSource(SOURCE);
  if(source||map.isStyleLoaded()){
   paint(ctx,current.samples,area);
   const raster={url:surface.toDataURL(),coordinates:[[area.west,area.north],[area.east,area.north],[area.east,area.south],[area.west,area.south]]};
   if(source)source.updateImage(raster);
   else{
    map.addSource(SOURCE,{type:'image',...raster});
    map.addLayer({id:SOURCE,source:SOURCE,type:'raster',paint:{'raster-fade-duration':0}},map.getStyle().layers[1]?.id);
   }
  }else if(!waitingMap){waitingMap=true;map.once('idle',()=>{waitingMap=false;draw();});}
  const amount=current.point===null?'—':current.point>0&&current.point<.05?'< 0,1 mm':
   current.point.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' mm';
  setMarker(amount);
  const to=current.to.slice(0,10)!==date.value?'24:00':current.to.slice(11);
  const range=current.from.slice(11)+'–'+to+' BRT';
  slider.setAttribute('aria-valuetext',range);
  status.textContent=formatDate(date.value)+' · '+range+(current.coverage<SIDE*SIDE?' · cobertura parcial':
   !current.samples.some(n=>n>=.1)?' · abaixo de 0,1 mm na grade':'');
 }
 function formatDate(value){return formatter.format(new Date(value+'T00:00Z'));}
 function controls(enabled){slider.disabled=!enabled;play.disabled=!enabled;}
 async function load(){
  if(!active||!selected||request||data)return;
  const cells=grid(selected.city),key=JSON.stringify(selected.city)+'/'+selected.days[0];
  if(cache?.key===key&&Date.now()-cache.at<3*HOUR){data=cache.data;controls(true);draw();return;}
  const now=Date.now();
  let budget={day:selected.days[0],used:0,at:0};
  try{const saved=JSON.parse(localStorage.getItem('argos-rain-grid-budget'));if(saved?.day===budget.day)budget=saved;}catch{}
  if(budget.used>=2||now-budget.at<60000){
   status.textContent=budget.used>=2?'Limite de consultas regionais de hoje.':'Aguarde um minuto para consultar a grade novamente.';
   retry.hidden=false;return;
  }
  try{localStorage.setItem('argos-rain-grid-budget',JSON.stringify({day:budget.day,used:budget.used+1,at:now}));}catch{}
  retry.hidden=true;status.textContent='Consultando grade regional…';
  const controller=new AbortController(),target=selected;request=controller;
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url(cells),{signal:controller.signal,credentials:'omit',redirect:'error'});
   if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('grade indisponível');
   const raw=await response.text();
   if(raw.length>MAX_BYTES)throw Error('grade acima do limite');
   const parsed=parse(JSON.parse(raw),cells,target.days[0]);
   if(!parsed)throw Error('grade inválida');
   if(!active||request!==controller||target!==selected)return;
   cache={key,data:parsed,at:Date.now()};data=parsed;controls(true);draw();
  }catch{
   if(active&&request===controller){status.textContent='Não foi possível carregar a chuva prevista na região.';retry.hidden=false;}
  }finally{clearTimeout(timeout);if(request===controller)request=null;}
 }
 function open(city,days,day){
  close();selected={city,days};panel.hidden=false;document.body.classList.add('regional-rain-mode');
  byId('region-rain-place').textContent=city.name+' · '+city.uf;
  date.replaceChildren(...days.map(value=>new Option(formatDate(value),value)));date.value=day;slider.value='0';
  status.textContent='Consultando grade regional…';retry.hidden=true;controls(false);setMarker('—');
  position();load();
 }
 function position(){
  if(!selected)return;
  cancelAnimationFrame(pending);
  pending=requestAnimationFrame(()=>{
   const map=getMap();
   if(!map||!selected||!active)return;
   map.resize();
   const area=bounds(grid(selected.city));
   map.fitBounds([[area.west,area.south],[area.east,area.north]],{
    padding:{top:20,left:15,right:15,bottom:150},duration:0,maxZoom:7
   });
   draw();
  });
 }
 function close(){
  stop();cancelAnimationFrame(pending);request?.abort();request=null;
  selected=null;data=null;panel.hidden=true;document.body.classList.remove('regional-rain-mode');
  const map=getMap();
  if(map?.getLayer(SOURCE))map.removeLayer(SOURCE);
  if(map?.getSource(SOURCE))map.removeSource(SOURCE);
  setMarker(null);
 }
 panel.querySelector('#region-rain-back').addEventListener('click',()=>{close();onBack();});
 retry.addEventListener('click',load);
 date.addEventListener('change',()=>{stop();slider.value='0';draw();});
 slider.addEventListener('input',()=>{stop();draw();});
 play.addEventListener('click',()=>{
  if(timer){stop();return;}
  if(!data||!active)return;
  play.textContent='Ⅱ';play.setAttribute('aria-label','Pausar chuva prevista');
  timer=setInterval(()=>{slider.value=String((Number(slider.value)+1)%24);draw();},1100);
 });
 return {open,close,draw,position,get opened(){return !!selected;},setActive(value){
  active=!!value;
  if(!active){stop();request?.abort();request=null;}
  else if(selected){draw();if(!data)load();}
 }};
}
const comparisonModels=[['GFS','gfs_global'],['ICON','icon_global']];
function comparisonUrl(city){
 return 'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({
  latitude:city.lat,longitude:city.lon,timezone:'America/Sao_Paulo',forecast_days:'7',
  daily:'precipitation_sum',models:comparisonModels.map(([,id])=>id).join(',')
 });
}
function compare(data,day){
 const dates=data?.daily?.time;
 const index=Array.isArray(dates)?dates.indexOf(day):-1;
 if(data?.timezone!=='America/Sao_Paulo'||index<0)return [];
 return comparisonModels.flatMap(([name,id])=>{
  const value=data.daily['precipitation_sum_'+id]?.[index];
  return Number.isFinite(value)&&value>=0&&value<=3000?[{name,value}]:[];
 });
}
const api={grid,url,parse,frame,sample,create,comparisonUrl,compare};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneRainRegion=api;
})(typeof window==='undefined'?globalThis:window);

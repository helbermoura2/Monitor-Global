/* Capital weather is presentation data, never a hazard or a priority arrival. */
(()=>{'use strict';
 const capitals=[
 ['AC','Rio Branco',-67.81,-9.97,'SBRB'],['AL','Maceió',-35.74,-9.67,'SBMO'],['AP','Macapá',-51.05,.03,'SBMQ'],['AM','Manaus',-60.02,-3.10,'SBEG'],['BA','Salvador',-38.50,-12.97,'SBSV'],['CE','Fortaleza',-38.54,-3.73,'SBFZ'],['DF','Brasília',-47.88,-15.79,'SBBR'],['ES','Vitória',-40.31,-20.32,'SBVT'],['GO','Goiânia',-49.25,-16.68,'SBGO'],['MA','São Luís',-44.30,-2.53,'SBSL'],['MT','Cuiabá',-56.10,-15.60,'SBCY'],['MS','Campo Grande',-54.62,-20.47,'SBCG'],['MG','Belo Horizonte',-43.94,-19.92,'SBCF'],['PA','Belém',-48.50,-1.46,'SBBE'],['PB','João Pessoa',-34.86,-7.12,'SBJP'],['PR','Curitiba',-49.27,-25.43,'SBCT'],['PE','Recife',-34.88,-8.05,'SBRF'],['PI','Teresina',-42.80,-5.09,'SBTE'],['RJ','Rio de Janeiro',-43.21,-22.91,'SBGL'],['RN','Natal',-35.21,-5.80,'SBNT'],['RS','Porto Alegre',-51.23,-30.03,'SBPA'],['RO','Porto Velho',-63.90,-8.76,'SBPV'],['RR','Boa Vista',-60.67,2.82,'SBBV'],['SC','Florianópolis',-48.55,-27.60,'SBFL'],['SP','São Paulo',-46.63,-23.55,'SBSP'],['SE','Aracaju',-37.07,-10.91,'SBAR'],['TO','Palmas',-48.33,-10.18,'SBPJ']
 ].map(([uf,name,lng,lat,icao])=>({uf,name,lng,lat,icao}));
 const TTL=30*60000,MAX_AGE=90*60000,records=new Map();let fetchedAt=0,retryAt=0,inflight=null,cptecFlight=null,cptecAt=0,cptecRetry=0,cptecRows=[];
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))?Number(v):null;
 function condition(code){if(number(code)===null)return 'Condição não informada';const n=Number(code);return n===0?'Céu limpo':n<=2?'Parcialmente nublado':n===3?'Nublado':[45,48].includes(n)?'Nevoeiro':[95,96,99].includes(n)?'Trovoadas':[80,81,82].includes(n)?'Pancadas de chuva':[71,73,75,77,85,86].includes(n)?'Neve':[61,63,65,66,67].includes(n)?'Chuva':[51,53,55,56,57].includes(n)?'Chuvisco':'Condição não informada';}
 function ingest(rows,provider='CPTEC / INPE via BrasilAPI'){
  for(const row of rows||[]){const cap=capitals.find(c=>normalize(c.name)===normalize(row.cidade||row.nome)||c.icao===(row.codigo_icao||row.codigo));if(!cap)continue;
   const temp=number(row.temp??row.temperatura);if(temp===null||temp < -60||temp>60)continue;
   const at=Date.parse(row.atualizado_em||row.data||'');if(!Number.isFinite(at)||at>Date.now()+60000||Date.now()-at>MAX_AGE)continue;
   records.set(cap.uf,{id:'capital-weather-'+cap.uf,type:'capital-weather',uf:cap.uf,countryCode:'BR',place:cap.name+' · '+cap.uf,coords:[cap.lng,cap.lat],time:at,temperature:temp,feels: null,humidity:number(row.umidade),wind:number(row.vento),condition:row.condicao_desc||'Condição não informada',source:provider});
  }
 }
 async function fetchCptec(){
  if(cptecAt&&Date.now()-cptecAt<TTL)return cptecRows;if(cptecFlight)return cptecFlight;if(Date.now()<cptecRetry)throw Error('CPTEC em intervalo de recuperação');
  cptecFlight=(async()=>{try{const r=await fetch('https://brasilapi.com.br/api/cptec/v1/clima/capital',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Capitais indisponíveis');const d=await r.json();if(!Array.isArray(d))throw Error('Resposta inválida');cptecRows=d;cptecAt=Date.now();ingest(d);return d;}catch(e){cptecRetry=Date.now()+5*60000;throw e;}finally{cptecFlight=null;}})();return cptecFlight;
 }
 function fresh(){return [...records.values()].filter(r=>Date.now()-r.time<=MAX_AGE&&r.time<=Date.now()+60000);}
 function persist(){try{sessionStorage.setItem('mg-capitals-weather-v1',JSON.stringify({at:fetchedAt,records:[...records.values()]}));}catch{}}
 async function load(){
  if(document.hidden||fetchedAt&&Date.now()-fetchedAt<TTL||Date.now()<retryAt)return fresh();if(inflight)return inflight;
  inflight=(async()=>{try{
   try{await fetchCptec();}catch{}
   if(fresh().length<capitals.length){
    const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({latitude:capitals.map(c=>c.lat).join(','),longitude:capitals.map(c=>c.lng).join(','),current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',timeformat:'unixtime',timezone:'UTC',wind_speed_unit:'kmh'});
    const r=await fetch(u.href,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Temperaturas indisponíveis');const rows=await r.json();if(!Array.isArray(rows)||rows.length!==capitals.length)throw Error('Capitais incompletas');
    rows.forEach((d,i)=>{const c=capitals[i],v=d.current||{},temp=number(v.temperature_2m),at=number(v.time);if(records.has(c.uf)&&Date.now()-records.get(c.uf).time<=MAX_AGE&&records.get(c.uf).source.startsWith('CPTEC'))return;
     if(temp===null||temp < -60||temp>60||at===null||Math.abs(Date.now()-at*1000)>MAX_AGE||d.current_units?.temperature_2m!=='°C'||Math.abs(Number(d.latitude)-c.lat)>.25||Math.abs(Number(d.longitude)-c.lng)>.25)return;
     records.set(c.uf,{id:'capital-weather-'+c.uf,type:'capital-weather',uf:c.uf,countryCode:'BR',place:c.name+' · '+c.uf,coords:[c.lng,c.lat],time:at*1000,temperature:temp,feels:number(v.apparent_temperature),humidity:number(v.relative_humidity_2m),wind:d.current_units?.wind_speed_10m==='km/h'?number(v.wind_speed_10m):null,condition:condition(v.weather_code),source:'Open-Meteo · condições por modelo'});
    });
   }
   if(!fresh().length)throw Error('Nenhuma temperatura atual disponível');
   fetchedAt=Date.now();persist();return fresh();
  }catch(e){retryAt=Date.now()+5*60000;console.warn('[tempo nas capitais]',e.message);return fresh();}finally{inflight=null;}})();return inflight;
 }
 try{const cached=JSON.parse(sessionStorage.getItem('mg-capitals-weather-v1')||'null');if(cached&&Date.now()-cached.at<TTL&&cached.at<=Date.now()){for(const r of cached.records||[])if(capitals.some(c=>c.uf===r.uf)&&number(r.temperature)!==null&&Number.isFinite(r.time))records.set(r.uf,r);fetchedAt=cached.at;}}catch{}
 function pick(deck,avoid){void load();const rows=fresh();if(!rows.length)return null;const id=autoCycleDraw(deck,rows.map(r=>r.id),avoid);return rows.find(r=>r.id===id)||null;}
 function close(){document.getElementById('painel-direito')?.classList.remove('pd-capital-weather');if(marker){marker.remove();marker=null;}}
 let marker=null;
 function show(item){
  if(!item||Date.now()-item.time>MAX_AGE)return false;
  window.EventReplay?.stop(false);window.EventDetailsBack?.close();window.CinematicCard?.stop();window.FullScreenEffects?.stop();window.SeismicCinema?.stop();stopMapCamera();stopWaveFront();stopFeltZone();clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.returnCameraTimeout);window.PresentationLimits?.clear();
  close();const panel=document.getElementById('painel-direito');if(!panel)return false;
  let box=document.getElementById('pd-capital-weather');if(!box){box=document.createElement('section');box.id='pd-capital-weather';box.setAttribute('aria-label','Tempo na capital');panel.append(box);}
  box.replaceChildren();const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;box.append(el);return el;};
  const heading=node('h2','capital-weather-city',item.place);const flag=window.BrazilStateFlags?.image(item);if(flag)heading.prepend(flag);
  node('div','capital-weather-temperature',item.temperature.toLocaleString('pt-BR',{maximumFractionDigits:1})+' °C');node('p','capital-weather-condition',item.condition);
  const values=[['Sensação',item.feels,' °C'],['Umidade',item.humidity,'%'],['Vento',item.wind,' km/h']];const grid=node('dl','capital-weather-metrics','');for(const [label,value,unit]of values){const cell=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value===null?'Não informado':value.toLocaleString('pt-BR',{maximumFractionDigits:1})+unit;cell.append(dt,dd);grid.append(cell);}
  node('p','capital-weather-source',item.source);node('p','capital-weather-time','Atualizado em '+new Date(item.time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT');
  document.getElementById('pd-source').textContent='TEMPO NAS CAPITAIS · BRASIL';panel.classList.add('pd-capital-weather');panel.scrollTop=0;document.documentElement.dataset.mgThreat='none';
  window.__mgHoldMag=-Infinity;window.__mgQuakePresentationMode='auto';window.resetCardEventFx?.(item);
  window.__mgRevisionProtectedId=null;window.__mgRevisionProtectedUntil=0;window.__mgHoldEndsAt=0;EventStore.setSelected(item.id);
  if(matchMedia('(max-width:900px)').matches)document.body.classList.add('mobile-details-mid');
  if(typeof map!=='undefined'&&map){const el=document.createElement('div');el.className='capital-weather-map-pin';el.textContent=item.temperature.toLocaleString('pt-BR',{maximumFractionDigits:1})+' °C';el.setAttribute('aria-label',item.place+' '+el.textContent);marker=new maplibregl.Marker({element:el}).setLngLat(item.coords).addTo(map);window.EventCamera?EventCamera.enter(item.id,{center:centroCompensado(...item.coords,7),zoom:7}):softFlyToCoords(...item.coords,7,true);}
  scheduleNextAutoCycle(30000);return true;
 }
 window.CapitalWeather={capitals,fetchCptec,ingest,load,pick,show,close,get:id=>fresh().find(r=>r.id===id)||null,records:fresh};
})();

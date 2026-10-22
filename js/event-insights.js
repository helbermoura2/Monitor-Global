/* Event history and official reports. No automatic modal, audio or camera work. */
(function(){
'use strict';
const KEY='mg-event-evolution-v1';let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
const history=EventEvolutionModel.create(saved),coastCache=new Map(),coastJobs=new Map();let refreshFrame=0,saveTimer=null,dialog=null,view=null,token=0,selectedId=null,feltLayer=null,popup=null,coastTarget=null,focusId=null,coastShown=null;
const $=id=>document.getElementById(id),all=()=>[...(typeof globalEvents==='undefined'?[]:globalEvents),...(typeof globalAlerts==='undefined'?[]:globalAlerts)];
const selected=()=>window.EventStore?.getSelected(),number=EventEvolutionModel.number;
function node(host,tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;host.append(e);return e;}
function button(host,text,fn){const b=node(host,'button',text);b.type='button';b.onclick=fn;return b;}
function link(host,text,url){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=node(host,'a',text);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{}}
function date(time){return Number.isFinite(time)?new Date(time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT':'Não informado';}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const data=JSON.stringify(history.serialize());if(data.length<=600000)localStorage.setItem(KEY,data);}catch{}},1000);}
function ingest(){let changed=false;const rows=all().sort((a,b)=>b.time-a.time).slice(0,EventEvolutionModel.MAX_EVENTS-1).reverse(),current=selected();if(current&&!rows.some(q=>q.id===current.id))rows.push(current);for(const q of rows)changed=history.observe(q)||changed;if(changed)persist();}
function products(q,d){if(!d)return;q=window.EventStore?.getById(q.id)||q;history.observe(q);for(const[type,label]of [['shakemap','Mapa oficial de intensidade'],['dyfi','Relatos de percepção'],['losspager','Estimativa de impacto PAGER']]){
 const p=EventProducts.products(d,type)[0];if(p&&Number.isFinite(p.updateTime))history.add(q.id,{key:type+':'+p.code+':'+p.updateTime,at:p.updateTime,text:label+' · versão publicada',source:'USGS',clock:'source'});
 }persist();if(view==='evolution'&&dialog&&selectedId===q.id)renderEvolution(q);
}
function timeline(q){
 q=window.EventStore?.getById(q.id)||q;history.observe(q);const own=history.get(q.id),rows=[...(own?.rows||[])];
 if(q.type==='tsunami'){const relation=TsunamiLink.match(q,all().filter(e=>e.type==='earthquake'));if(relation?.kind==='origin'){const entry=history.get(relation.quake.id);for(const r of entry?.rows||[])if(r.key!=='first-seen')rows.push({...r,key:entry.id+':'+r.key});}}
 for(const e of history.all()){
  if(e.id===q.id||e.snapshot.type!=='tsunami')continue;const a=e.snapshot;
  const related=q.type==='tsunami'?TsunamiLink.sameEvent(q,a):q.type==='earthquake'&&TsunamiLink.match(a,[q])?.kind==='origin';
  if(!related)continue;
  for(const r of e.rows)if(r.key!=='first-seen')rows.push({...r,key:e.id+':'+r.key,text:'Tsunami · '+r.text});
 }
 return rows.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key)).slice(-90);
}
function renderEvolution(q){const host=$('event-insights-content');if(!host)return;host.replaceChildren();node(host,'p','Horários em Brasília. “Recebido no monitor” registra a observação neste dispositivo, sem atribuir essa hora à agência.','insights-note');const list=node(host,'ol',null,'event-evolution-list');
 for(const row of timeline(q)){const li=node(list,'li');node(li,'time',date(row.at));node(li,'strong',row.text);node(li,'small',row.source+' · '+(row.clock==='observed'?'Recebido no monitor':'Horário publicado pela fonte'));}
 node(host,'p','O histórico local começa quando este dispositivo recebe o evento. Revisões anteriores só aparecem se fornecidas pela fonte.','insights-note');
 if(q.type==='earthquake'){node(host,'p','Como ler a pintura: o mapa oficial mostra intensidade do tremor, não magnitude. Pode haver percepção fraca além da área exibida. O corte da grade não comprova ausência de tremor.','insights-note');link(host,'Entender o ShakeMap · USGS ↗','https://earthquake.usgs.gov/data/shakemap/');}
 if(!EventProducts.reportId(q))return;
 const retry=button(host,'Consultar produtos oficiais',async()=>{retry.disabled=true;try{const data=await EventProducts.detail(q);if(selectedId!==q.id||view!=='evolution')return;if(data)products(q,data);else node(host,'p','Sem produtos USGS associados com segurança a este registro.','insights-note');}catch{if(host.isConnected)node(host,'p','Consulta indisponível agora. O histórico recebido foi preservado.','insights-note');}finally{retry.disabled=false;}});
}
function coastalAlert(q){if(q.type==='tsunami')return q;return window.TsunamiLink?.forQuake(q,typeof globalAlerts==='undefined'?[]:globalAlerts,typeof globalEvents==='undefined'?[q]:globalEvents)[0]?.alert;}
function textURL(a){try{const u=new URL(a.bulletinUrl||a.link);if(u.protocol!=='https:'||u.port||u.username||u.password)return null;if(u.hostname==='api.weather.gov'&&/^\/products\/[a-f0-9-]{36}$/i.test(u.pathname))return {url:u.href,json:true};if(['www.tsunami.gov','tsunami.gov'].includes(u.hostname)&&/^\/events\/(?:PHEB|PAAQ)\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/\d+\/[A-Z0-9]+\/[A-Z0-9]+\.txt$/i.test(u.pathname))return {url:u.href,json:false};}catch{}return null;}
async function coastal(a){
 const key=a.id+'|'+a.time;if(coastCache.has(key))return coastCache.get(key);if(coastJobs.has(key))return coastJobs.get(key);
 const job=(async()=>{let data=TsunamiCoastalModel.parse(a.bulletinText||a.description||'',a.time);const source=textURL(a);
  if(source){const r=await fetch(source.url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Boletim indisponível');const raw=await r.text();if(raw.length>300000)throw Error('Boletim excessivo');const p=source.json?JSON.parse(raw):null;if(p&&p.id!==source.url.split('/').pop())throw Error('Boletim divergente');data=TsunamiCoastalModel.parse(p?p.productText:raw,a.time);}
  coastCache.set(key,data);if(coastCache.size>24)coastCache.delete(coastCache.keys().next().value);return data;
 })().finally(()=>coastJobs.delete(key));coastJobs.set(key,job);return job;
}
function table(host,headers,rows){const wrap=node(host,'div',null,'insights-table-scroll'),table=node(wrap,'table'),head=node(table,'thead'),tr=node(head,'tr');for(const h of headers)node(tr,'th',h);const body=node(table,'tbody');for(const row of rows){const tr=node(body,'tr');for(const val of row)node(tr,'td',val);}return table;}
async function renderCoasts(q){const host=$('event-insights-content'),a=coastalAlert(q),my=++token;if(!host)return;coastShown=a?a.id+'|'+a.time:'none';host.replaceChildren();if(!a){node(host,'p','Nenhum boletim de tsunami associado com segurança a este sismo.');return;}
 node(host,'p',coastTarget?'Região em foco: '+coastTarget:'Todas as regiões publicadas','insights-coastal-focus').id='insights-coastal-focus';
 node(host,'strong',(a.source||'Fonte oficial')+' · '+(a.warningLevel||'Boletim')+' · '+date(a.time));node(host,'p',a.cancelled?'Boletim encerrado. Os horários abaixo são registros desta publicação, não um novo aviso.':'As previsões e medições abaixo são as publicadas neste boletim. Siga as orientações das autoridades locais.','insights-note');
 const levels=node(host,'div',null,'coastal-level-list');for(const area of a.affectedAreas||[]){const c=TsunamiMapModel.category(area,a),row=node(levels,'p');row.style.setProperty('--coast-level',c.color);node(row,'strong',TsunamiMapModel.placeLabel(area.name));node(row,'span',c.label);}
 link(host,'Abrir boletim oficial ↗',a.bulletinUrl||a.link||'https://www.tsunami.gov/');const status=node(host,'p','Consultando horários e medições publicados…','insights-note');
 try{const data=await coastal(a);if(my!==token||!host.isConnected)return;status.remove();if(data.bulletinNumber)node(host,'p','Boletim nº '+data.bulletinNumber,'insights-note');
 node(host,'h3','Chegada prevista · primeira onda');
 if(data.forecasts.length)table(host,['Local / região','Chegada · BRT','Faixa prevista para a região'],data.forecasts.map(r=>{const area=(a.affectedAreas||[]).find(x=>TsunamiMapModel.normalize(x.name)===TsunamiMapModel.normalize(r.region));return [r.name+' · '+TsunamiMapModel.placeLabel(r.region),date(r.arrivalTime),area?TsunamiMapModel.category(area,a).label:'Não publicada nesta tabela'];}));else node(host,'p','Horários de chegada não publicados ou sem tabela reconhecível neste boletim.','insights-note');
 node(host,'p','O horário é uma previsão publicada, não uma contagem regressiva garantida. A primeira onda pode não ser a maior.','insights-note');
 node(host,'h3','Medições observadas · estações');
 if(data.observations.length)table(host,['Estação','Amplitude medida','Observação · BRT'],data.observations.map(r=>[r.name,r.heightM.toLocaleString('pt-BR',{maximumFractionDigits:2})+' m',date(r.time)]));else node(host,'p','Nenhuma medição de estação disponível nesta publicação. Isso não significa altura zero.','insights-note');
 node(host,'p','Amplitude na estação não é altura de inundação em terra. Pontos de previsão não definem toda a área de risco.','insights-note');
 }catch{if(my===token&&host.isConnected)status.textContent='Horários e medições indisponíveis na consulta. Consulte o boletim original; os níveis recebidos acima foram preservados.';}
}
function clearFelt(){popup?.remove();popup=null;try{for(const id of ['felt-reports-count','felt-reports-points'])if(map.getLayer(id))map.removeLayer(id);if(map.getSource('felt-reports'))map.removeSource('felt-reports');}catch{}$('felt-reports-legend')?.remove();feltLayer=null;}
function showFelt(q,result){clearFelt();if(!result.data?.features.length||selected()?.id!==q.id)return;
 map.addSource('felt-reports',{type:'geojson',data:result.data,cluster:true,clusterRadius:32,clusterMaxZoom:8});
 map.addLayer({id:'felt-reports-points',type:'circle',source:'felt-reports',paint:{'circle-color':['case',['has','point_count'],'#e879f9',['>=',['get','cdi'],2],'#e879f9','#94a3b8'],'circle-radius':['case',['has','point_count'],12,6],'circle-opacity':.88,'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
 feltLayer={id:q.id,result};const legend=node($('mapWrap'),'aside',null,'felt-reports-legend');legend.id='felt-reports-legend';node(legend,'strong','● Relatos agrupados · USGS / DYFI');node(legend,'small','Áreas de respostas, não pessoas ou danos. Cinza: sem tremor percebido; magenta: percepção relatada. Toque nos grupos maiores para aproximar.');button(legend,'Ocultar relatos',clearFelt);
 if(typeof userInteractingWithGlobe!=='undefined')userInteractingWithGlobe=true;
 window.EventCamera?.cancel();window.SeismicPaintTour?.stop();window.SeismicFocus?.pause();window.TsunamiPresentation?.pause();window.TsunamiMap?.pauseTour();if(typeof stopWaveFront==='function')stopWaveFront(true);if(typeof stopMapCamera==='function')stopMapCamera();map.stop();
 const points=result.data.features.map(f=>f.geometry.coordinates),longitudes=TsunamiMapModel.longitudeBounds(points.map(p=>p[0])),latitudes=points.map(p=>p[1]);const camera=window.WeatherWarningCamera?.frame([[longitudes[0],Math.min(...latitudes)],[longitudes[1],Math.max(...latitudes)]]);
 if(camera)map.flyTo({...camera,zoom:Math.min(7,camera.zoom),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:3500,essential:true});
 close();
}
async function renderReports(q){const host=$('event-insights-content'),my=++token;if(!host)return;host.replaceChildren();node(host,'p','Consultando relatos publicados…');
 try{const result=await EventProducts.felt(q);if(my!==token||!host.isConnected)return;host.replaceChildren();node(host,'strong',result.count===null?'Total de relatos não informado':result.count.toLocaleString('pt-BR')+' relatos recebidos · USGS');node(host,'p','Relatos são respostas recebidas pela fonte. Não são o total de pessoas que sentiram e não substituem a estimativa de população exposta.','insights-note');
 if(result.status==='available'){node(host,'p',result.data.features.length.toLocaleString('pt-BR')+' áreas agrupadas disponíveis · '+date(result.updatedAt));button(host,feltLayer?.id===q.id?'Atualizar relatos no mapa':'Mostrar onde foi sentido',()=>showFelt(q,result));node(host,'p','Camada magenta: centros das células geográficas publicadas pelo DYFI. A intensidade relatada por área fica disponível ao tocar ou passar o mouse.','insights-note');}
 else node(host,'p',result.status==='unsupported'?'Este registro não tem um evento USGS associado com segurança.':'Ainda não há áreas de relatos publicadas para exibir.','insights-note');
 if(result.url)link(host,'Ver relatos na fonte USGS ↗',result.url);
 const emsc=(q.reports||[]).find(r=>r.source==='EMSC')||(q.source==='EMSC'?q:null);if(emsc){const id=String(emsc.sourceEventId||'');if(/^\d+$/.test(id))link(host,'Consultar o evento e relatos no EMSC ↗','https://www.emsc-csem.org/Earthquake/earthquake.php?id='+id);}
 }catch{if(my===token&&host.isConnected){host.replaceChildren();node(host,'p','Consulta de relatos indisponível. Isso não significa que ninguém sentiu o sismo.','insights-note');button(host,'Tentar novamente',()=>renderReports(q));}}
}
function close(){token++;dialog?.close();dialog?.remove();dialog=null;view=null;coastShown=null;}
function open(mode,q=selected()){
 if(!q)return;window.EventReplay?.pause();close();history.observe(q);persist();selectedId=q.id;view=mode;
 dialog=document.createElement('dialog');dialog.id='event-insights-dialog';dialog.setAttribute('aria-label','Informações do evento');const header=node(dialog,'header');node(header,'h2',mode==='evolution'?'Evolução do evento':mode==='coasts'?'Tsunami · costas e estações':'Relatos de percepção');button(header,'Fechar',close);node(dialog,'p',q.place||'Evento selecionado','insights-location');if(mode==='reports'){const context=node(dialog,'div');context.innerHTML=window.DataContext?.markup('perception','RELATOS DE PERCEPÇÃO')||'';}const content=node(dialog,'section');content.id='event-insights-content';content.setAttribute('aria-live','polite');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();
 if(mode==='evolution')renderEvolution(q);else if(mode==='coasts')renderCoasts(q);else renderReports(q);
}
function render(q){
 $('pd-event-insights')?.remove();if(!q||q.__tsunamiMapDemo)return;if(focusId!==q.id){focusId=q.id;coastTarget=null;}history.observe(q);persist();const actions=document.createElement('nav');actions.id='pd-event-insights';actions.setAttribute('aria-label','Explorar informações do evento');button(actions,'Evolução',()=>open('evolution',q));
 if(q.type==='earthquake'||!q.type&&Number.isFinite(q.mag))button(actions,'Relatos',()=>open('reports',q));
 if(q.type==='tsunami'||coastalAlert(q))button(actions,'Costas e horários',()=>open('coasts',q));
 $('pd-horario')?.after(actions);window.MonitorWorkbench?.renderActions(q);
}
function refresh(){ingest();const q=selected();if(selectedId&&q?.id!==selectedId){close();selectedId=q?.id;clearFelt();}if(feltLayer&&q?.id!==feltLayer.id)clearFelt();render(q);if(dialog&&view==='evolution'&&q)renderEvolution(q);else if(dialog&&view==='coasts'&&q){const a=coastalAlert(q);if(coastShown!==(a?a.id+'|'+a.time:'none'))renderCoasts(q);}}
function initMap(){if(typeof map==='undefined'||!map)return;const show=e=>{const f=e.features?.[0];if(!f||f.properties.cluster)return;popup?.remove();const body=document.createElement('div');node(body,'strong',f.properties.name||'Área de relatos');node(body,'p',Number(f.properties.nresp).toLocaleString('pt-BR')+' respostas · intensidade relatada '+Number(f.properties.cdi).toLocaleString('pt-BR'));node(body,'small','USGS / DYFI · célula agregada, sem localização individual');const Popup=window.maplibregl?.Popup||(typeof GL!=='undefined'?GL.Popup:null);if(Popup)popup=new Popup({closeButton:true,maxWidth:'250px'}).setLngLat(f.geometry.coordinates).setDOMContent(body).addTo(map);};map.on('click','felt-reports-points',async e=>{const f=e.features?.[0];if(!f?.properties.cluster){show(e);return;}try{const zoom=await map.getSource('felt-reports').getClusterExpansionZoom(f.properties.cluster_id);if(feltLayer)map.easeTo({center:f.geometry.coordinates,zoom,duration:700});}catch{}});map.on('mouseenter','felt-reports-points',show);map.on('mouseleave','felt-reports-points',()=>{popup?.remove();popup=null;});}
window.addEventListener('load',initMap,{once:true});window.EventStore?.subscribe(reason=>{if(['select','replace','revise','filter'].includes(reason)&&!refreshFrame)refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh();});});window.addEventListener('pagehide',()=>{clearFelt();clearTimeout(saveTimer);try{localStorage.setItem(KEY,JSON.stringify(history.serialize()));}catch{}});
function mapProduct(q,data){history.observe(q);const at=number(data.updatedAt);history.add(q.id,{key:'map:'+data.version,at:at??Date.now(),text:data.status==='rupture-only'?'Modelo de ruptura publicado':'Mapa oficial disponível · '+(data.provider||data.source||'USGS'),source:data.provider||data.source||'USGS',clock:at===null?'observed':'source'});persist();}
 function setCoastTarget(name){coastTarget=name||null;const el=$('insights-coastal-focus');if(el)el.textContent=coastTarget?'Região em foco: '+coastTarget:'Todas as regiões publicadas';}
 window.EventInsights={render,refresh,open,close,isOpen:()=>!!dialog,history,products,mapProduct,setCoastTarget,coastal,timeline,clearFelt,feltState:()=>feltLayer?{id:feltLayer.id,areas:feltLayer.result.data.features.length}:null};
})();

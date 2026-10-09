/* Official warnings are kept distinct from observations, forecasts and reports. */
(function(){
 const sources=new Map(),maxAge=20*60000;
 const base=()=>typeof workerBaseUrl==='function'?workerBaseUrl():'https://black-sky-9ba0.terrestre.workers.dev';
 function validLink(value,hosts){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||!hosts.includes(u.hostname)||u.username||u.password)return null;u.protocol='https:';return u.href;}catch(e){return null;}}
 function eccc(feature,now=Date.now()){
  const p=feature?.properties||{},event=p.alert_name_en||'',type=HazardEvidence.warningType(event),expiresAt=Date.parse(p.expiration_datetime),time=Date.parse(p.publication_datetime);
  if(!type||!feature.id||!Number.isFinite(time)||time>now+300000||!(expiresAt>now)||/ended|cancel|expired|test/i.test(p.status_en||'')||!['warning','watch','advisory','statement'].includes(p.alert_type))return null;
  const coords=HazardEvidence.polygonPoint(feature.geometry),key=p.feature_id&&p.alert_code?p.feature_id+'-'+p.alert_code+'-'+p.alert_type:feature.id;
  return {id:'eccc-weather-'+key,type,place:p.feature_name_en||'Área do aviso — Canadá',...(coords?{coords}:{}),source:'ECCC / Environment Canada',bandeira:'🇨🇦',hazardNature:'warning',time,expiresAt,onset:Date.parse(p.validity_datetime),warningEvent:event,warningLevel:({warning:'Alerta',watch:'Atenção',advisory:'Aviso',statement:'Comunicado'})[p.alert_type],severity:p.impact_en,severityLabel:HazardEvidence.severityLabel(p.impact_en),riskColour:p.risk_colour_en,detail:event+' · '+(p.feature_name_en||'Canadá'),warningDescription:p.alert_text_en,link:'https://api.weather.gc.ca/collections/weather-alerts/items/'+encodeURIComponent(feature.id)+'?f=html',locationNote:coords?'Marcador representativo da área oficial; não indica ocorrência em toda a região.':'Sem coordenadas verificadas; consulte a área descrita no aviso.'};
 }
 function bom(xml,region,checkedAt=Date.now()){
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='rss'||!doc.querySelector('channel'))throw Error('RSS BOM inválido');
  const rows=[];
  for(const node of doc.querySelectorAll('item')){
   const text=tag=>node.getElementsByTagName(tag)[0]?.textContent?.trim()||'',title=text('title'),type=HazardEvidence.warningType(title);
   if(!type||/cancel|final warning|no warnings/i.test(title))continue;
   const link=validLink(text('link'),['www.bom.gov.au','reg.bom.gov.au']),time=Date.parse(text('pubDate'));
   if(!link||!Number.isFinite(time)||time>checkedAt+300000)continue;
   rows.push({id:'bom-weather-'+link,type,place:region+' — Austrália',source:'BOM / Bureau of Meteorology',bandeira:'🇦🇺',hazardNature:'warning',time,checkedAt,warningEvent:title,warningLevel:/Watch/i.test(title)?'Atenção':'Aviso',severityLabel:'Não informada pelo RSS',detail:title,link,locationNote:'RSS de avisos correntes. Área detalhada e validade devem ser conferidas no boletim oficial; sem coordenadas verificadas.'});
  }return rows;
 }
 function active(s,now=Date.now()){
  if(now-s.checkedAt>maxAge)return [];
  return (s.rows||[]).filter(x=>x.expiresAt?x.expiresAt>now:true);
 }
 function sync(){
  const rows=new Map();for(const s of sources.values())for(const x of active(s))if(Number.isFinite(x.time))rows.set(x.id,x);
  const ids=new Set(rows.keys());globalAlerts=globalAlerts.filter(x=>!x.officialWeatherManaged||ids.has(x.id));
  rows.forEach(x=>upsertAlert({...x,officialWeatherManaged:true,regionalWarning:!RecordPresentation.located(x)},{fonte:'official-weather',expiraMs:0}));
  marcarBooted('official-weather');if(typeof invalidateUnifiedFeedCache==='function')invalidateUnifiedFeedCache();applyFilters();
 }
 function set(key,label,rows,opts={}){
  const previous=sources.get(key);sources.set(key,opts.error?{...previous,label,error:opts.error,rows:previous?.rows||[],checkedAt:previous?.checkedAt||0}:{label,rows,checkedAt:opts.checkedAt||Date.now(),credit:opts.credit});
  try{setSource(opts.healthName||label,opts.error?'off':'ok',null,opts.error,{checkedAt:opts.checkedAt});}catch(e){}
  sync();render();
 }
 function render(){
  const parent=document.getElementById('weather-more');if(!parent)return;
  let host=document.getElementById('official-weather-warnings');if(!host){host=document.createElement('section');host.id='official-weather-warnings';parent.append(host);}const opened=new Set([...host.querySelectorAll('details[open]')].map(x=>x.dataset.source));host.replaceChildren();
  const title=document.createElement('h3');title.textContent='Avisos oficiais pelo mundo';host.append(title);
  const note=document.createElement('p');note.textContent='EUA, Canadá, Austrália e 16 países europeus. Avisos indicam uma área e um período; não confirmam ocorrência em cada local. Somente áreas com coordenadas verificadas entram no mapa.';host.append(note);
  for(const [key,s] of sources){
   const rows=[...new Map(active(s).map(x=>[x.id,x])).values()].sort((a,b)=>b.time-a.time),details=document.createElement('details'),summary=document.createElement('summary');details.dataset.source=key;details.open=opened.has(key);
   const stale=Date.now()-s.checkedAt>maxAge;summary.textContent=(window.EventPortuguese?.local(s.label)||s.label)+' · '+(s.error?'Consulta indisponível':stale?'Aguardando atualização':rows.length+' aviso(s) na fonte');details.append(summary);
   if(s.error||stale){const p=document.createElement('p');p.textContent=s.error?'A consulta falhou. '+(rows.length?'Os avisos abaixo são do último retorno válido.':'Isso não significa ausência de alertas.'):'Dados sem consulta recente; avisos retirados até novo retorno válido.';details.append(p);}
   if(s.checkedAt){const p=document.createElement('small');p.textContent='Consultado '+new Date(s.checkedAt).toLocaleString('pt-BR');details.append(p);}
   let shown=0;const append=()=>{rows.slice(shown,shown+20).forEach(raw=>{
    const x=window.EventPortuguese?.view(raw)||raw;
    const item=document.createElement('article'),heading=document.createElement('p');heading.textContent=(x.bandeira||'')+' '+(x.warningEvent||x.event||x.detail);item.append(heading);
    const area=document.createElement('p');area.textContent=x.place||x.area;item.append(area);
    const evidence=document.createElement('small');evidence.textContent='Aviso oficial · '+(x.warningLevel||'Aviso')+' · Severidade: '+(x.severityLabel||'Não informada');item.append(evidence);
    const dates=document.createElement('p');dates.textContent=(Number.isFinite(x.time)?'Emitido '+new Date(x.time).toLocaleString('pt-BR')+' · ':'')+(Number.isFinite(x.onset)&&x.onset>Date.now()?'Início previsto '+new Date(x.onset).toLocaleString('pt-BR')+' · ':'')+(x.expiresAt?'Válido até '+new Date(x.expiresAt).toLocaleString('pt-BR'):'Validade não informada pelo RSS; confira o boletim');item.append(dates);
    if(x.warningDescription){const d=document.createElement('details'),label=document.createElement('summary'),p=document.createElement('p');label.textContent='Boletim em português';p.textContent=x.warningDescription;d.append(label,p);d.addEventListener('toggle',()=>{if(d.open)window.EventPortuguese?.ensure(raw).then(()=>{p.textContent=window.EventPortuguese?.view(raw).warningDescription||x.warningDescription;});});item.append(d);}
    const link=document.createElement('a');link.href=x.link;link.target='_blank';link.rel='noopener';link.textContent='Abrir aviso oficial ↗';item.append(link);details.append(item);
   });shown+=20;};append();
   if(rows.length>shown){const more=document.createElement('button');more.type='button';more.textContent='Mostrar mais avisos';more.onclick=()=>{append();if(shown>=rows.length)more.remove();};details.append(more);}
   if(s.credit){const p=document.createElement('small');p.textContent=window.EventPortuguese?.local(s.credit)||s.credit;details.append(p);}host.append(details);
  }
 }
 async function loadEccc(){try{
  const r=await fetch(base()+'/official-weather-alerts?provider=eccc');if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!Array.isArray(d.features)||d.complete!==true||!Number.isFinite(d.checkedAt))throw Error('Catálogo ECCC incompleto');set('eccc','ECCC Canadá',d.features.map(x=>eccc(x)).filter(Boolean),{checkedAt:d.checkedAt,credit:'Environment and Climate Change Canada · MSC Open Data'});
 }catch(e){set('eccc','ECCC Canadá',[],{error:e.message});}}
 async function loadBom(){try{
  const r=await fetch(base()+'/official-weather-alerts?provider=bom');if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!Array.isArray(d.feeds)||!d.feeds.length||!Number.isFinite(d.checkedAt))throw Error('Feeds BOM inválidos');
  d.feeds.forEach(f=>{try{if(f.error)throw Error(f.error);set('bom-'+f.code,'BOM '+f.region,bom(f.xml,f.region,d.checkedAt),{checkedAt:d.checkedAt,credit:'Bureau of Meteorology, © Commonwealth of Australia · RSS público; títulos e links para a fonte'});}catch(e){set('bom-'+f.code,'BOM '+f.region,[],{error:e.message});}});
 }catch(e){for(const [code,region] of [['NSW-ACT','New South Wales / ACT'],['VIC','Victoria'],['QLD','Queensland'],['WA','Western Australia'],['SA','South Australia'],['TAS','Tasmania'],['NT','Northern Territory']])set('bom-'+code,'BOM '+region,[],{error:e.message});}}
 document.addEventListener('DOMContentLoaded',()=>{render();PeriodicScheduler.every('eccc-warnings',loadEccc,26000,300000);PeriodicScheduler.every('bom-warnings',loadBom,28000,600000);PeriodicScheduler.every('official-warning-expiry',()=>{sync();render();},60000,60000,'ui');});
 window.OfficialWeatherAlerts={eccc,bom,set,render,loadEccc,loadBom,validLink,sources};
})();

/* Provenance describes the product, not a statistical probability. */
(function(root){
 function classify(item){
  const source=String(item?.source||'');
  const nature=item?.hazardNature||(/Open-Meteo|WeatherAPI|GloFAS/i.test(source)?'forecast':/METAR|Aviation Weather/i.test(source)?'observed':/INMET|NWS|Meteoalarm/i.test(source)?'warning':/GDACS/i.test(source)?'report':null);
  const labels={bulletin:'Boletim oficial',forecast:'Estimativa de modelo',observed:'Observação local',warning:'Aviso oficial',report:'Evento reportado',river:'Nível de rio observado'};
  const notes={bulletin:'Boletim meteorológico municipal. Relatos e previsões referem-se ao texto e horário da publicação; não confirmam alagamentos.',forecast:'Condição calculada por modelo; não confirma ocorrência nem alagamentos.',observed:'Medição no aeródromo indicado; não representa toda a cidade.',warning:'Aviso para uma área e período; não significa ocorrência confirmada em cada local.',report:'Registro institucional regional; consulte o boletim para a área afetada.',river:'Subida da régua não confirma transbordamento sem a cota local de inundação.'};
  return {nature,label:labels[nature]||'Registro da fonte',note:notes[nature]||''};
 }
 function metar(station,now=Date.now()){
  if(!station||!Number.isFinite(station.updatedAt)||now-station.updatedAt>90*60000||station.updatedAt>now+5*60000)return [];
  const raw=String(station.raw||'').split(/\sTEMPO\s|\sBECMG\s|\sRMK\s/)[0];
  const wind=raw.match(/\b(?:\d{3}|VRB)\d{2,3}G(\d{2,3})(KT|MPS)\b/);
  const gust=wind?Math.round(Number(wind[1])*(wind[2]==='KT'?1.852:3.6)):null;
  const thunder=/(?:^|\s)[+-]?(?:VC)?TS(?:RA|GR|GS|SN)?(?:\s|$)/.test(raw);
  if(!Number.isFinite(station.lat)||!Number.isFinite(station.lng))return [];
  const base={place:station.icao+' — aeródromo',coords:[station.lng,station.lat],time:station.updatedAt,dataAt:station.updatedAt,hazardNature:'observed',source:'NOAA METAR',link:'https://aviationweather.gov/data/metar/?id='+station.icao,expiresAt:station.updatedAt+90*60000};
  const rows=[];
  if(gust>=70)rows.push({...base,id:'metar-wind-'+station.icao,type:'wind',windKmh:gust,detail:'Rajada observada de '+gust+' km/h · '+station.icao});
  if(thunder)rows.push({...base,id:'metar-storm-'+station.icao,type:'storm',detail:raw.includes('VCTS')?'Trovoada reportada nas proximidades do aeródromo':'Trovoada reportada no aeródromo'});
  return rows;
 }
 function warningType(event){if(/wind chill/i.test(event))return null;return /flood|storm surge/i.test(event)?'flood':/wind|gale/i.test(event)?'wind':/thunder|tornado|rain|storm|hurricane|typhoon|cyclone/i.test(event)?'storm':null;}
 function severityLabel(value){return ({Extreme:'Extrema',Severe:'Severa',Moderate:'Moderada',Minor:'Baixa',Unknown:'Não informada',High:'Alta',Low:'Baixa'})[value]||'Não informada';}
 function polygonPoint(g){
  const ring=g?.type==='Polygon'?g.coordinates?.[0]:g?.type==='MultiPolygon'?g.coordinates?.[0]?.[0]:null;
  if(!Array.isArray(ring)||ring.length<3||ring.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||!Number.isFinite(x[1])||Math.abs(x[0])>180||Math.abs(x[1])>90))return null;
  const pts=ring.length>3&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;
  const origin=pts[0][0],lon=pts.reduce((s,p)=>s+(p[0]-origin>180?p[0]-360:p[0]-origin < -180?p[0]+360:p[0]),0)/pts.length;
  return [((lon+540)%360)-180,pts.reduce((s,p)=>s+p[1],0)/pts.length];
 }
 function nws(feature,now=Date.now()){
  const p=feature?.properties||{};
  if(p.status!=='Actual'||p.messageType==='Cancel'||p.scope==='Private'||!(Date.parse(p.expires)>now)||!Number.isFinite(Date.parse(p.sent))||Date.parse(p.sent)>now+300000)return null;
  const type=warningType(p.event);
  if(!type)return null;
  const coords=polygonPoint(feature.geometry),id=feature.id||p.id;if(!id)return null;
  return {id:'nws-weather-'+id,type,place:p.areaDesc||p.event,...(coords?{coords}:{}),source:'NWS / NOAA',bandeira:'🇺🇸',hazardNature:'warning',time:Date.parse(p.sent),onset:Date.parse(p.onset),expiresAt:Date.parse(p.expires),severity:p.severity,severityLabel:severityLabel(p.severity),warningEvent:p.event,warningLevel:/Watch/i.test(p.event)?'Atenção':/Advisory/i.test(p.event)?'Aviso':'Alerta',detail:p.headline||p.event,warningDescription:p.description,warningInstruction:p.instruction,link:/^https:\/\/api\.weather\.gov\/alerts\//.test(id)?id:'https://www.weather.gov/',locationNote:coords?'Marcador representativo do polígono do aviso; não é um epicentro.':'Sem coordenadas verificadas; aviso disponível na lista de Meteorologia.'};
 }
 const api={classify,metar,nws,warningType,severityLabel,polygonPoint};root.HazardEvidence=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

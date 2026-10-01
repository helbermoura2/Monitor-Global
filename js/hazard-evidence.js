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
 function nws(feature,now=Date.now()){
  const p=feature?.properties||{};
  if(p.status!=='Actual'||p.messageType==='Cancel'||!(Date.parse(p.expires)>now))return null;
  const type=/Flood Warning/.test(p.event)?'flood':/High Wind Warning/.test(p.event)?'wind':/Severe Thunderstorm Warning/.test(p.event)?'storm':null;
  if(!type)return null;
  const g=feature.geometry;
  const rings=g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
  const pts=rings.flat().filter(x=>Array.isArray(x)&&Number.isFinite(x[0])&&Number.isFinite(x[1]));
  if(!pts.length)return null; // Never invent a city's coordinates from an area name.
  const coords=[0,0];pts.forEach(x=>{coords[0]+=x[0]/pts.length;coords[1]+=x[1]/pts.length;});
  return {id:'nws-weather-'+(feature.id||p.id),type,place:p.areaDesc||p.event,coords,source:'NWS / NOAA',bandeira:'🇺🇸',hazardNature:'warning',time:Date.parse(p.sent),expiresAt:Date.parse(p.expires),detail:p.headline||p.event,warningDescription:p.description,warningInstruction:p.instruction,link:'https://alerts.weather.gov/search?area=US',locationNote:'Marcador representativo do polígono do aviso; não é um epicentro.'};
 }
 const api={classify,metar,nws};root.HazardEvidence=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

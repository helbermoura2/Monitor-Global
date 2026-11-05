/* GOES infrared imagery, not precipitation intensity. Mercator is preserved end to end. */
(function(root){'use strict';
 const LAYER='GOES-East_ABI_Band13_Clean_Infrared',BASE='https://gibs.earthdata.nasa.gov/',BOUNDS=[-75,-35,-28,6],SIZE=1200,STEP=600000,MAX_AGE=90*60000;
 const iso=t=>new Date(t).toISOString().replace(/\.\d{3}Z$/,'Z');
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 function point(lon,lat,size=SIZE){return [(lon-BOUNDS[0])/(BOUNDS[2]-BOUNDS[0])*size,(merc(BOUNDS[3])-merc(lat))/(merc(BOUNDS[3])-merc(BOUNDS[1]))*size];}
 function domainUrl(now=Date.now()){return BASE+'wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=DescribeDomains&VERSION=1.0.0&LAYER='+LAYER+'&TILEMATRIXSET=GoogleMapsCompatible_Level7&TIME='+iso(now-4*3600000)+'/'+iso(now);}
 function frames(xml,now=Date.now()){
  if(typeof xml!=='string'||xml.length>300000)throw Error('Resposta de horários inválida');const times=new Set();
  for(const match of xml.matchAll(/<(?:[\w-]+:)?Domain(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?Domain>/g))for(const part of match[1].trim().split(',')){
   const p=part.trim().split('/');if(!p[0]||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p[0]))continue;
   const start=Date.parse(p[0]),end=p.length>1?Date.parse(p[1]):start;if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end>now+60000)continue;
   if(p.length>2&&!['PT10M','PT600S'].includes(p[2]))continue;
   for(let i=0;i<6;i++){const t=end-i*STEP;if(t<start||now-t>MAX_AGE||t>now)break;times.add(t);}
  }
  const result=[...times].sort((a,b)=>a-b).slice(-6);if(!result.length)throw Error('Nenhum quadro recente confirmado pela fonte');return result;
 }
 function imageUrl(time){if(!Number.isFinite(time))throw Error('Horário inválido');const q=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:LAYER,STYLES:'',SRS:'EPSG:3857',BBOX:'-8348961.81,-4163881.14,-3116945.74,669141.06',WIDTH:String(SIZE),HEIGHT:String(SIZE),FORMAT:'image/png',TRANSPARENT:'TRUE',TIME:iso(time)});return BASE+'wms/epsg3857/best/wms.cgi?'+q;}
 function intersects(b){let w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth();if(n<BOUNDS[1]||s>BOUNDS[3])return false;if(e-w>=360)return true;for(let shift=-360;shift<=360;shift+=360){const left=w+shift,right=(e<w?e+360:e)+shift;if(right>=BOUNDS[0]&&left<=BOUNDS[2])return true;}return false;}
 function clip(ctx,border){if(border?.type!=='MultiPolygon'||!Array.isArray(border.coordinates))throw Error('Recorte do Brasil indisponível');ctx.beginPath();let count=0;for(const polygon of border.coordinates)for(const ring of polygon){for(let i=0;i<ring.length;i++){const c=ring[i];if(!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>85)throw Error('Contorno inválido');const [x,y]=point(c[0],c[1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);count++;}ctx.closePath();}if(count<4)throw Error('Contorno vazio');ctx.clip('evenodd');}
 const api={LAYER,BASE,BOUNDS,SIZE,STEP,MAX_AGE,coordinates:[[BOUNDS[0],BOUNDS[3]],[BOUNDS[2],BOUNDS[3]],[BOUNDS[2],BOUNDS[1]],[BOUNDS[0],BOUNDS[1]]],iso,point,domainUrl,frames,imageUrl,intersects,clip};
 root.BrazilSatelliteModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

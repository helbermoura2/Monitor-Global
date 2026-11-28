/* Mobile-only GOES imagery. Shared site implementation remains unchanged. */
(function(root){'use strict';
 const PRODUCTS=Object.freeze({
  ir:Object.freeze({layer:'GOES-East_ABI_Band13_Clean_Infrared',matrix:'GoogleMapsCompatible_Level6',label:'Infravermelho',description:'Temperatura de brilho · °C. Não mede intensidade da chuva.'}),
  color:Object.freeze({layer:'GOES-East_ABI_GeoColor',matrix:'GoogleMapsCompatible_Level7',label:'GeoColor',description:'Composição multiespectral diurna e noturna. Não representa intensidade da chuva.'}),
  b08:Object.freeze({band:'B08',label:'Vapor d’água · B08',description:'Canal superior 6,2 µm · temperatura de brilho, não umidade relativa.'}),
  b09:Object.freeze({band:'B09',label:'Vapor d’água · B09',description:'Canal intermediário 6,9 µm · temperatura de brilho, não umidade relativa.'}),
  b10:Object.freeze({band:'B10',label:'Vapor d’água · B10',description:'Canal inferior 7,3 µm · temperatura de brilho, não umidade relativa.'}),
  air:Object.freeze({layer:'GOES-East_ABI_Air_Mass',matrix:'GoogleMapsCompatible_Level6',label:'RGB Air Mass',description:'Composição de massas de ar. Cores qualitativas, não temperatura nem previsão.'})
 });
 const LAYER=PRODUCTS.ir.layer,BASE='https://gibs.earthdata.nasa.gov/',BOUNDS=[-75,-35,-28,6],SIZE=1200,STEP=600000,MAX_AGE=90*60000;
 const iso=t=>new Date(t).toISOString().replace(/\.\d{3}Z$/,'Z');
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 function point(lon,lat,size=SIZE){return [(lon-BOUNDS[0])/(BOUNDS[2]-BOUNDS[0])*size,(merc(BOUNDS[3])-merc(lat))/(merc(BOUNDS[3])-merc(BOUNDS[1]))*size];}
 function product(key){if(!Object.hasOwn(PRODUCTS,key))throw Error('Produto GOES inválido');return PRODUCTS[key];}
 function domainUrl(now=Date.now(),key='ir'){const p=product(key);if(p.band)throw Error('Use catálogo INPE');return BASE+'wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=DescribeDomains&VERSION=1.0.0&LAYER='+p.layer+'&TILEMATRIXSET='+p.matrix+'&TIME='+iso(now-4*3600000)+'/'+iso(now);}
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
 function imageUrl(time,key='ir'){if(!Number.isFinite(time)||product(key).band)throw Error('Horário ou produto inválido');const q=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:product(key).layer,STYLES:'',SRS:'EPSG:3857',BBOX:'-8348961.81,-4163881.14,-3116945.74,669141.06',WIDTH:String(SIZE),HEIGHT:String(SIZE),FORMAT:'image/png',TRANSPARENT:'TRUE',TIME:iso(time)});return BASE+'wms/epsg3857/best/wms.cgi?'+q.toString().replace(/%3A/gi,':').replace(/%2F/gi,'/').replace(/%2C/gi,',');}
 function intersects(b){let w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth();if(n<BOUNDS[1]||s>BOUNDS[3])return false;if(e-w>=360)return true;for(let shift=-360;shift<=360;shift+=360){const left=w+shift,right=(e<w?e+360:e)+shift;if(right>=BOUNDS[0]&&left<=BOUNDS[2])return true;}return false;}
 function clip(ctx,border){if(border?.type!=='MultiPolygon'||!Array.isArray(border.coordinates))throw Error('Recorte do Brasil indisponível');ctx.beginPath();let count=0;for(const polygon of border.coordinates)for(const ring of polygon){for(let i=0;i<ring.length;i++){const c=ring[i];if(!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>85)throw Error('Contorno inválido');const [x,y]=point(c[0],c[1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);count++;}ctx.closePath();}if(count<4)throw Error('Contorno vazio');ctx.clip('evenodd');}
 const INPE='https://data.inpe.br/bdc/stac/v1/search',COLLECTION='GOES19-L2-CMI-1',VAPOR_SIZE=300,MAX_VAPOR_BYTES=32*1024*1024;
 function vaporUrl(now=Date.now()){if(!Number.isFinite(now))throw Error('Horário inválido');const u=new URL(INPE);u.searchParams.set('collections',COLLECTION);u.searchParams.set('datetime',iso(now-MAX_AGE)+'/'+iso(now));u.searchParams.set('limit','10');return u.href;}
 function vaporFrames(data,key,now=Date.now()){
  const band=product(key).band;if(!band||!Array.isArray(data?.features)||data.features.length>10)throw Error('Catálogo GOES inválido');
  const out=new Map();
  for(const item of data.features){
   const time=Date.parse(item?.properties?.datetime),asset=item?.assets?.[band];
   if(item.collection!==COLLECTION||!Number.isFinite(time)||time>now||now-time>MAX_AGE||!asset||asset.type!=='application/x-netcdf'||typeof asset.href!=='string')continue;
   try{const url=new URL(asset.href);if(url.protocol!=='https:'||url.hostname!=='data.inpe.br'||url.username||url.password||url.port||url.search||url.hash||!new RegExp('^/bdc/data/GOES19-L2-CMI/ch'+band.slice(1)+'/[0-9]{4}/(0[1-9]|1[0-2])/[A-Za-z0-9_-]{1,100}[.]nc$').test(url.pathname))continue;out.set(time,url.href);}catch{}
  }
  return [...out].sort((a,b)=>b[0]-a[0]).slice(0,1);
 }
 // Independent qualitative colour ramp for brightness temperature; not rainfall.
 const VAPOR_COLORS=[[-80,255,255,255],[-60,157,210,255],[-40,54,124,207],[-20,38,72,124],[0,64,56,76],[20,187,120,51],[40,235,172,91]];
 function vaporRGBA(temperature,quality){if(!(temperature instanceof Float32Array)||!(quality instanceof Uint8Array)||temperature.length!==VAPOR_SIZE**2||quality.length!==temperature.length)throw Error('Grade inválida');
  const rgba=new Uint8ClampedArray(temperature.length*4);
  for(let i=0;i<temperature.length;i++){const t=temperature[i];if(!Number.isFinite(t)||t< -120||t>80||quality[i]>1)continue;const n=Math.max(-80,Math.min(40,t));let j=1;while(j<VAPOR_COLORS.length-1&&n>VAPOR_COLORS[j][0])j++;const lo=VAPOR_COLORS[j-1],hi=VAPOR_COLORS[j],f=(n-lo[0])/(hi[0]-lo[0]);for(let c=0;c<3;c++)rgba[4*i+c]=Math.round(lo[c+1]+f*(hi[c+1]-lo[c+1]));rgba[4*i+3]=quality[i]===0?255:200;}
  return rgba;
 }
 const api={VAPOR_SIZE,MAX_VAPOR_BYTES,vaporUrl,vaporFrames,vaporRGBA,PRODUCTS,product,LAYER,BASE,BOUNDS,SIZE,STEP,MAX_AGE,coordinates:[[BOUNDS[0],BOUNDS[3]],[BOUNDS[2],BOUNDS[3]],[BOUNDS[2],BOUNDS[1]],[BOUNDS[0],BOUNDS[1]]],iso,point,domainUrl,frames,imageUrl,intersects,clip};
 root.BrazilSatelliteModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

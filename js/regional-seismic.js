/* Official public catalogues, read as data; embedded scripts are never executed. */
(function(root){
 const number=v=>v==null||String(v).trim()===''?NaN:Number(String(v).trim().replace(',','.'));
 function event(source,lat,lon,mag,depth,time,place,now=Date.now()){
  if(![lat,lon,mag,depth,time].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||mag<0||mag>10||depth<0||depth>800||time<now-36*3600000||time>now+300000)return null;
  return {id:source+'-'+time+'-'+lat.toFixed(4)+'-'+lon.toFixed(4),type:'earthquake',source,coords:[lon,lat],mag,depth,time,place,quality:'A'};
 }
 function localTime(date,hour,offset){return Date.parse(date+'T'+hour+offset);}
 function geofon(text,now=Date.now()){
  const lines=String(text).trim().split(/\r?\n/);if(!/^#EventID\|Time\|Latitude\|Longitude\|Depth\/km/.test(lines[0]))throw Error('GEOFON: catálogo FDSN não reconhecido');
  return lines.slice(1).map(line=>{const c=line.split('|');const e=event('GEOFON',number(c[2]),number(c[3]),number(c[10]),number(c[4]),Date.parse(/Z$/.test(c[1])?c[1]:c[1]+'Z'),c[12],now);if(e){e.id='GEOFON-'+c[0];e.sourceEventId=c[0];e.detailUrl='https://geofon.gfz-potsdam.de/eqinfo/event.php?id='+encodeURIComponent(c[0]);}return e;}).filter(Boolean);
 }
 function ovsicori(html,now=Date.now()){
  if(!/OVSICORI/i.test(html)||!/L\.marker\(/.test(html))throw Error('OVSICORI: mapa não reconhecido');
  const out=[];
  for(const m of String(html).matchAll(/L\.marker\(\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\][\s\S]*?\.bindPopup\('([\s\S]*?)',\{minWidth/g)){
   const doc=new DOMParser().parseFromString(m[3],'text/html'),fields={};doc.querySelectorAll('tr').forEach(tr=>{const c=tr.querySelectorAll('td');if(c.length===2)fields[c[0].textContent.trim()]=c[1].textContent.trim();});
   const dt=fields['Fecha y Hora Local:']?.split(' '),e=event('OVSICORI',number(m[1]),number(m[2]),number(fields['Magnitud:']),number(fields['Prof. [km]:']),dt?localTime(dt[0],dt[1],'-06:00'):NaN,(fields['Ubicacion:']||'Costa Rica')+', Costa Rica',now);
   if(e){e.pais='Costa Rica';e.bandeira='🇨🇷';e.detailUrl='https://www.ovsicori.una.ac.cr/sistemas/mapa_sismicidad/mapa_sismos_inicio.php';out.push(e);}
  }return out;
 }
 function marn(html,now=Date.now()){
  const doc=new DOMParser().parseFromString(html,'text/html'),table=[...doc.querySelectorAll('table')].find(t=>/Latitud/.test(t.textContent)&&/Magnitud/.test(t.textContent)&&/Profundidad/.test(t.textContent));if(!table)throw Error('MARN: tabela sísmica não reconhecida');
  return [...table.querySelectorAll('tr')].map(tr=>{const c=[...tr.querySelectorAll('td')].map(x=>x.textContent.trim());if(c.length!==9||!/^\d{4}-\d{2}-\d{2}$/.test(c[1]))return null;const e=event('MARN-SV',number(c[3]),number(c[4]),number(c[7]),number(c[8]),localTime(c[1],c[2],'-06:00'),c[5]+', América Central',now);if(e){e.detailUrl='https://www.snet.gob.sv/ver/sismologia/monitoreo/sismos+reportados/ultimos+10+sismos/';}return e;}).filter(Boolean);
 }
 root.RegionalSeismic={geofon,ovsicori,marn};
})(globalThis);
async function fetchOVSICORIData(){const r=await fetchWithCorsFallback('https://www.ovsicori.una.ac.cr/sistemas/mapa_sismicidad/mapa_sismos_inicio.php',15000);return RegionalSeismic.ovsicori(await r.text()).filter(e=>e.mag>=minMagnitude);}
async function fetchMARNSismos(){const r=await fetchWithCorsFallback('https://www.snet.gob.sv/ver/sismologia/monitoreo/sismos+reportados/ultimos+10+sismos/',15000);return RegionalSeismic.marn(await r.text()).filter(e=>e.mag>=minMagnitude);}

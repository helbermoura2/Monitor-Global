/* International capital cards. No hazard feeds, priority queue or Durable calls. */
(()=>{'use strict';
 const TTL=30*60000,MAX_AGE=90*60000,BATCH=6,LIMIT=48,records=new Map(),unavailable=new Map();
 let capitals=[],cataloguePromise=null,catalogueRetry=0,inflight=null,retryAt=0;
 const fresh=entry=>!!entry&&Number.isFinite(entry.record?.time)&&Date.now()-entry.record.time<=MAX_AGE&&entry.record.time<=Date.now()+60000;
 function persist(){try{sessionStorage.setItem('mg-world-capitals-v1',JSON.stringify([...records]));}catch{}}
 try{for(const [code,e]of JSON.parse(sessionStorage.getItem('mg-world-capitals-v1')||'[]'))if(/^[A-Z]{2}$/.test(code)&&code!=='BR'&&fresh(e)&&Number.isFinite(e.at)&&e.at<=Date.now()&&Number.isFinite(e.record.temperature)){records.set(code,e);if(records.size>=LIMIT)break;}}catch{}
 async function catalogue(){
  if(capitals.length)return capitals;if(cataloguePromise)return cataloguePromise;if(document.hidden||Date.now()<catalogueRetry)return [];
  cataloguePromise=fetch('assets/weather/world-capitals.json').then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json();}).then(rows=>{const seen=new Set();capitals=rows.filter(c=>{if(!/^[A-Z]{2}$/.test(c.countryCode)||c.countryCode==='BR'||seen.has(c.countryCode)||!c.name||!c.country||!Number.isFinite(c.lat)||!Number.isFinite(c.lng)||Math.abs(c.lat)>90||Math.abs(c.lng)>180)return false;seen.add(c.countryCode);return true;});return capitals;}).catch(e=>{catalogueRetry=Date.now()+5*60000;console.warn('[capitais do mundo]',e.message);return [];}).finally(()=>{cataloguePromise=null;});return cataloguePromise;
 }
 function prepare(deck,avoid){
  if(!capitals.length)return;
  const valid=new Set(capitals.map(c=>c.countryCode));
  deck.remaining=(deck.remaining||[]).filter(c=>valid.has(c)&&(unavailable.get(c)||0)<=Date.now());
  if(!deck.remaining.length){deck.remaining=capitals.map(c=>c.countryCode).filter(c=>(unavailable.get(c)||0)<=Date.now());for(let i=deck.remaining.length-1;i>0;i--){const j=autoCycleRandomInt(i+1);[deck.remaining[i],deck.remaining[j]]=[deck.remaining[j],deck.remaining[i]];}}
  const previous=String(avoid||'').replace('world-capital-weather-','');if(deck.remaining[0]===previous&&deck.remaining.length>1)[deck.remaining[0],deck.remaining[1]]=[deck.remaining[1],deck.remaining[0]];
 }
 async function warm(deck,avoid){
  if(document.hidden)return;await catalogue();if(document.hidden)return;prepare(deck,avoid);if(!deck.remaining?.length||Date.now()<retryAt)return;
  const first=records.get(deck.remaining[0]);if(fresh(first)&&Date.now()-first.at<TTL)return;
  if(inflight)return inflight;
  const batch=deck.remaining.slice(0,BATCH).map(code=>capitals.find(c=>c.countryCode===code));
  inflight=(async()=>{try{
   const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({latitude:batch.map(c=>c.lat).join(','),longitude:batch.map(c=>c.lng).join(','),current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',timeformat:'unixtime',timezone:'UTC',wind_speed_unit:'kmh'});
   const r=await fetch(u.href,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Temperaturas internacionais indisponíveis');const data=await r.json(),rows=Array.isArray(data)?data:[data];if(rows.length!==batch.length)throw Error('Lote internacional incompleto');
   rows.forEach((d,i)=>{const c=batch[i],record=window.CapitalWeather?.modelRecord(c,d);if(!record){unavailable.set(c.countryCode,Date.now()+TTL);return;}records.delete(c.countryCode);records.set(c.countryCode,{at:Date.now(),record});unavailable.delete(c.countryCode);});
   while(records.size>LIMIT)records.delete(records.keys().next().value);persist();
  }catch(e){retryAt=Date.now()+5*60000;console.warn('[tempo nas capitais do mundo]',e.message);}finally{inflight=null;}})();return inflight;
 }
 function pick(deck,avoid){void warm(deck,avoid);prepare(deck,avoid);const previous=String(avoid||'').replace('world-capital-weather-','');const index=(deck.remaining||[]).findIndex(code=>code!==previous&&fresh(records.get(code)));if(index<0)return null;const code=deck.remaining.splice(index,1)[0];return records.get(code).record;}
 function get(id){const code=String(id||'').replace('world-capital-weather-',''),entry=records.get(code);return fresh(entry)?entry.record:null;}
 window.WorldCapitalWeather={warm,pick,get,catalogue};
})();

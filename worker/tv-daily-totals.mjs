// The television and Telegram count the SAME deduplicated full-day seismic events.
// This module only summarizes verified input; it must never count just the top five.
export function dailySeismicTotals(quakes){
 if(!quakes||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quakes.day||'')||!Array.isArray(quakes.events))throw Error('Boletim diário sem catálogo completo');
 if(quakes.events.length>20000)throw Error('Catálogo excede o limite previsto');
 const bands={m6:0,m5:0,m4:0,below4:0};
 const seen=new Set();
 for(const event of quakes.events){
  if(!event||!Number.isFinite(event.mag)||event.mag>10||!Number.isFinite(event.time))throw Error('Registro sísmico incompleto');
  if(event.mag>=6)bands.m6++;
  else if(event.mag>=5)bands.m5++;
  else if(event.mag>=4)bands.m4++;
  else bands.below4++;
  if(event.id){const key=(event.provider||'')+':'+event.id;if(seen.has(key))throw Error('Identificador duplicado no resumo');seen.add(key);}
 }
 return {day:quakes.day,total:quakes.events.length,...bands,
  partial:Boolean(quakes.brazilFailedSources?.length||quakes.globalFailedSources?.length)};
}

// Optional phone notices, using only the existing protected public weather/history routes.
const KEY='mobile-notices-v1',MIN=60000,HOUR=3600000;
export const NOTICE_TOPICS={rain:'monitor_global_rain_v1',weather:'monitor_global_weather_v1',daily:'monitor_global_daily_v1'};
const num=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const point=d=>finite(d?.loc?.lat,-90,90)&&finite(d?.loc?.lng,-180,180)&&Math.abs(d.loc.lat+23.555)<.002&&Math.abs(d.loc.lng+46.635)<.002;
export function rainFacts(d,now){
 if(!d?.ok||d.version!=='tv-rain-v1'||d.area!=='liberdade'||!point(d)||!finite(d.at,1,now+MIN)||now-d.at>20*MIN||!finite(d.expiresAt,now+1,d.at+10*MIN)||!Array.isArray(d.forecast)||d.forecast.length<60||d.forecast.length>300)return null;
 const rows=d.forecast;let current=-1,amount=0,first=-1,end=-1;
 for(let i=0;i<rows.length;i++){const p=rows[i];if(!finite(p.start,1,Number.MAX_SAFE_INTEGER)||p.end-p.start!==MIN||i>0&&p.start!==rows[i-1].end||!finite(p.rate,0,1000)||!['rain','snow','mixed','no_precipitation'].includes(p.type))return null;if(p.start<=now&&p.end>now)current=i;amount+=p.rate*Math.max(0,Math.min(p.end,now+HOUR)-Math.max(p.start,now))/HOUR;}
 if(current<0||rows.at(-1).end<now+HOUR)return null;
 const wet=p=>p.rate>=.1&&p.type!=='no_precipitation';
 for(let i=current;i<rows.length;i++)if(wet(rows[i])){first=i;break;}
 if(first>=0)for(let i=first+1;i<=rows.length-10;i++)if(rows.slice(i,i+10).every(p=>!wet(p))){end=i;break;}
 const arrival=first<0?-1:Math.max(0,Math.ceil((rows[first].start-now)/MIN)),active=first>=0&&arrival<=60,rate=active?rows[first].rate:0,level=rate<2.5?0:rate<7.5?1:rate<50?2:3;
 return {active,now:wet(rows[current]),arrival,rate,amount,level,ending:active&&end>=0?Math.ceil((rows[end].start-now)/MIN):-1,duration:active&&end>=0?Math.ceil((rows[end].start-Math.max(now,rows[first].start))/MIN):-1,snow:active&&rows[first].type==='snow'};
}
function weatherText(d,now){
 const p=d?.current;if(!d?.ok||d.version!=='tv-weather-v1'||d.area!=='liberdade'||!point(d)||!finite(d.at,1,now+MIN)||now-d.at>HOUR||!finite(d.generatedAt,1,now+MIN)||now-d.generatedAt>90*MIN||!finite(d.expiresAt,now+1,d.at+HOUR)||!p||!finite(p.start,1,now)||p.start+HOUR<=now||!finite(p.temperature,-100,70))return null;
 const names={Clear:'Céu limpo',MostlyClear:'Predomínio de céu limpo',PartlyCloudy:'Parcialmente nublado',MostlyCloudy:'Nublado',Cloudy:'Nublado',Foggy:'Nevoeiro',Haze:'Névoa',Drizzle:'Garoa',Rain:'Chuva',HeavyRain:'Chuva forte',Thunderstorms:'Trovoadas',StrongStorms:'Trovoadas',ScatteredThunderstorms:'Trovoadas isoladas',IsolatedThunderstorms:'Trovoadas isoladas',Snow:'Neve',HeavySnow:'Neve forte'};
 let text=`${Math.round(p.temperature)}°C`;if(finite(p.feels,-120,100))text+=` · sensação ${Math.round(p.feels)}°C`;if(names[p.condition])text+=` · ${names[p.condition]}`;
 if(finite(p.humidity,0,100))text+=`\nUmidade ${Math.round(p.humidity)}%`;if(finite(p.wind,0,540))text+=` · vento ${Math.round(p.wind)} km/h`;if(finite(p.gust,0,540))text+=` · rajadas ${Math.round(p.gust)} km/h`;
 return text+'\nPrevisão de modelo · Rainbow Weather · Liberdade, SP.';
}
const civil=now=>new Date(now-3*HOUR).toISOString();
function notice(kind,id,title,body,now){const n={schema:'monitor-notice-v1',kind,id,version:id,title:title.slice(0,140),body:body.slice(0,1000),issuedAt:now,expiresAt:now+(kind==='rain'?10*MIN:HOUR)};while(new TextEncoder().encode(JSON.stringify(n)).length>2800&&n.body.length>100)n.body=n.body.slice(0,-50);return n;}
export function createNoticeDispatcher({storage,read,send,clock=Date.now}){
 return async()=>{
  const now=clock(),stamp=civil(now),day=stamp.slice(0,10),hour=stamp.slice(0,13),minute=Number(stamp.slice(14,16));let state=await storage.get(KEY)||{rainNext:0,weatherHour:'',dailyDay:''};let sent=0;
  async function deliver(n){const raw=JSON.stringify(n);if(new TextEncoder().encode(raw).length>3000)throw Error('Notice exceeds payload bound');await send({topic:NOTICE_TOPICS[n.kind],data:{notice:raw},android:{priority:n.kind==='rain'?'HIGH':'NORMAL',ttl:n.kind==='rain'?'600s':'3600s'}});sent++;}
  // Shared cached collector: at most one rain read every five minutes, including outages.
  if(now>=(state.rainNext||0)){
   state.rainNext=now+5*MIN;await storage.put(KEY,state);
   const facts=rainFacts(await read('tv-rain?area=liberdade').catch(()=>null),now);
   if(facts){const old=state.rain||{},change=facts.active&&(!old.active||facts.now&&!old.now||facts.level>old.level),reminder=facts.active&&now-(old.lastSent||0)>=HOUR;
    if((change&&now-(old.lastSent||0)>=10*MIN)||reminder){const episode=old.active&&old.episode?old.episode:now,id=`rain:${episode}:${now}`;let body=`${num(facts.amount)} mm previstos nos próximos 60 min · ${['fraca','moderada','forte','muito forte'][facts.level]} (${num(facts.rate)} mm/h)`;body+=facts.duration>0?`\nDuração prevista ~${facts.duration} min`:'\nDuração ainda sem estimativa';if(facts.ending>0)body+=` · pode terminar em ~${facts.ending} min`;body+='\nEstimativa para Liberdade, SP · Rainbow Weather.';await deliver(notice('rain',id,`${facts.snow?'Neve':'Chuva'} ${facts.now?'estimada agora':`prevista em ~${facts.arrival} min`} · Liberdade`,body,now));state.rain={...facts,episode,lastSent:now};}
    else if(!facts.active&&old.active){await deliver(notice('rain',`rain-dry:${now}`,'Sem chuva estimada · Liberdade','A previsão atual não indica chuva nos próximos 60 min. Isso não confirma que a chuva observada no local terminou.\nRainbow Weather · estimativa para um ponto.',now));state.rain={...facts,lastSent:old.lastSent||0};}
    else state.rain={...old,...facts};await storage.put(KEY,state);
   }
  }
  // No stale hourly catch-up, and midnight remains reserved for the completed-day summary.
  if(Number(stamp.slice(11,13))!==0&&minute<15&&state.weatherHour!==hour){const body=weatherText(await read('tv-weather').catch(()=>null),now);if(body){await deliver(notice('weather',`weather:${hour}`,'Boletim do tempo · Liberdade',body,now));state.weatherHour=hour;await storage.put(KEY,state);}}
  if(Number(stamp.slice(11,13))===0&&minute>=5&&minute<30&&state.dailyDay!==day){
   const d=await read('tv-alerts?view=completed&policy=telegram-v1').catch(()=>null),previous=civil(now-24*HOUR).slice(0,10),start=Date.parse(previous+'T00:00:00-03:00');
   if(d?.version==='tv-alerts-v1'&&d.view==='completed'&&d.complete===true&&d.day===previous&&d.sources?.earthquake===true&&finite(d.serverTime,now-10*MIN,now+MIN)&&Array.isArray(d.alerts)&&d.alerts.length<=5&&d.alerts.every(a=>a.kind==='earthquake'&&finite(a.magnitude,-5,12)&&finite(a.eventTime,start,start+24*HOUR-1)&&typeof a.title==='string'&&a.title.length<=240)){
    const body=d.alerts.length?d.alerts.map(a=>a.title).join('\n'):'Nenhum registro disponível nas fontes para este período.';await deliver(notice('daily',`daily:${previous}`,`Resumo diário · ${previous.split('-').reverse().join('/')}`,body+'\nAté cinco maiores registros disponíveis · dia em Brasília. Não representa a contagem total de sismos.',now));state.dailyDay=day;await storage.put(KEY,state);
   }
  }
  return {sent};
 };
}

/* Phone-only precipitation model. No synthetic map frames or AI-generated weather. */
(function(root){
'use strict';
const MINUTE=60000,wet=p=>p.rate>=.1&&p.type!=='no_precipitation';
function forecast(data,now=Date.now()){
 if(!data||data.ok!==true||data.version!=='tv-rain-v1'||data.area!=='liberdade'||!data.loc||!Number.isFinite(data.loc.lat)||!Number.isFinite(data.loc.lng)||Math.abs(data.loc.lat+23.555)>.002||Math.abs(data.loc.lng+46.635)>.002)return null;
 if(!Number.isFinite(data.at)||data.at<=0||data.at>now+MINUTE||now-data.at>20*MINUTE||!Number.isFinite(data.expiresAt)||data.expiresAt<=now||data.expiresAt>data.at+10*MINUTE)return null;
 const all=data.forecast;if(!Array.isArray(all)||all.length<60||all.length>300)return null;
 let end=0;
 for(const p of all){if(!p||!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.end-p.start!==MINUTE||(end&&p.start!==end)||!Number.isFinite(p.rate)||p.rate<0||p.rate>1000||!['rain','mixed','snow','no_precipitation'].includes(p.type))return null;end=p.end;}
 if(!all.some(p=>p.start<=now&&p.end>now)||end<now+60*MINUTE)return null;
 const until=Math.min(now+120*MINUTE,end),points=all.filter(p=>p.end>now&&p.start<until),minutes=Math.floor((until-now)/MINUTE);
 let amount=0;for(const p of points)amount+=p.rate*Math.max(0,Math.min(p.end,until)-Math.max(p.start,now))/3600000;
 const first=points.findIndex(wet),arrival=first<0?-1:Math.max(0,Math.ceil((points[first].start-now)/MINUTE)),noun=first>=0&&points[first].type==='snow'?'Neve':'Chuva';
 const period=minutes>=120?'2 horas':minutes+' min';
 let headline=first<0?'Sem chuva estimada nas próximas '+period:arrival===0?noun+' estimada agora':noun+' prevista em cerca de '+arrival+' min';
 // A five-minute sustained increase avoids promoting a single noisy minute.
 let increase=-1;const baseline=points.slice(0,5).reduce((s,p)=>s+(wet(p)?p.rate:0),0)/5;
 if(first===0)for(let i=5;i<=points.length-5;i++){const group=points.slice(i,i+5),threshold=Math.max(baseline*1.5,baseline+1);if(group.every(p=>wet(p)&&p.rate>=threshold)){increase=Math.ceil((points[i].start-now)/MINUTE);break;}}
 if(increase>0)headline='A chuva pode aumentar em cerca de '+increase+' min';
 let stop=-1; if(first>=0)for(let i=first+1;i<=points.length-10;i++)if(points.slice(i,i+10).every(p=>!wet(p))){stop=Math.ceil((points[i].start-now)/MINUTE);break;}
 const duration=stop<0?-1:stop-arrival;
 return {points,now,until,minutes,amount,headline,arrival,duration,stop,increase,at:data.at,expiresAt:data.expiresAt,peak:Math.max(...points.map(p=>p.rate))};
}
function frames(data,now=Date.now()){
 if(!data||data.ok!==true||!Number.isSafeInteger(data.snapshot)||data.snapshot%600||data.snapshot*1000>now+60000||now>=mapExpiresAt(data))return [];
 return [-60,-40,-20,0,20,40,60,80,100,120].map(offset=>({offset,snapshot:data.snapshot+Math.min(0,offset)*60,forecast:Math.max(0,offset)*60,time:(data.snapshot+offset*60)*1000}));
}
function mapExpiresAt(data){if(!data||!Number.isSafeInteger(data.snapshot))return 0;const maximum=data.snapshot*1000+1800000;return Number.isFinite(data.expiresAt)?Math.min(maximum,data.expiresAt):maximum;}
const model={forecast,frames,mapExpiresAt};if(typeof module!=='undefined'&&module.exports)module.exports=model;else root.PhoneRainModel=model;
})(typeof window==='undefined'?globalThis:window);

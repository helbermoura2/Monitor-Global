import {test} from 'node:test';import assert from 'node:assert/strict';
import {briefingContext,parseBriefingSelection,handleWeatherBriefingInObject as handle,BRIEFING_LIMITS,BRIEFING_MODEL} from '../../worker/weather-briefing.mjs';
const now=Date.parse('2026-11-05T15:20:00Z');
const weather=()=>({ok:true,version:'tv-weather-v1',area:'liberdade',loc:{lat:-23.555,lng:-46.635},at:now,generatedAt:now-600000,expiresAt:now+1200000,current:{start:Math.floor(now/3600000)*3600000,temperature:28,feels:30,humidity:92,wind:1,gust:3,condition:'Cloudy'}});
const rain=(wet=true)=>({ok:true,version:'tv-rain-v1',area:'liberdade',loc:{lat:-23.555,lng:-46.635},at:now,expiresAt:now+600000,forecast:Array.from({length:180},(_,i)=>({start:now+i*60000,end:now+(i+1)*60000,rate:wet&&i<30?3:0,type:wet&&i<30?'rain':'no_precipitation'}))});
const store=()=>{const m=new Map();return {m,get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),delete:async k=>m.delete(k)};};
const req=(kind='hourly')=>new Request('https://worker.test/weather-briefing?kind='+kind);
function setup(value=weather(),kind='hourly',response){const storage=store(),jobs=[];let calls=0;const env={AI:{run:async(model,input)=>{calls++;assert.equal(model,BRIEFING_MODEL);assert.equal(input.response_format,undefined);assert.match(input.messages[1].content,/SOMENTE JSON/);assert.equal(storage.m.get('briefing:budget').daily,calls);assert.equal(input.max_tokens,96);return response||{response:JSON.stringify({facts:kind==='rain'?['pause']:['humidCalm']})};}}};const options={now,waitUntil:p=>jobs.push(p),readWeather:async()=>Response.json(value),readRain:async()=>Response.json(value)};return {storage,env,options,jobs,calls:()=>calls};}
test('only verified fixed-point fresh source facts can be summarized',()=>{assert.ok(briefingContext('hourly',weather(),now));for(const change of [d=>d.ok=false,d=>d.loc.lat=0,d=>d.expiresAt=now,d=>d.generatedAt=now-10000000,d=>d.current.temperature=null]){const d=weather();change(d);assert.equal(briefingContext('hourly',d,now),null);}assert.equal(briefingContext('rain',rain(false),now).notApplicable,true);const broken=rain();broken.forecast[4].start++;assert.equal(briefingContext('rain',broken,now),null);});
test('AI selects verified insight IDs only: arbitrary prose and invented facts are rejected',()=>{
 const c=briefingContext('hourly',weather(),now);
 assert.deepEqual(c.keys,['humidCalm']);
 assert.deepEqual(parseBriefingSelection({response:'{"facts":["humidCalm"]}'},c),['humidCalm']);
 assert.deepEqual(parseBriefingSelection({response:['humidCalm']},c),['humidCalm']);
 for(const response of ['{"facts":["temperature"]}','{"facts":["tornado"]}','{"facts":["humidCalm"],"text":"30 victims"}','{"facts":["humidCalm","humidCalm"]}','It will rain'])
  assert.equal(parseBriefingSelection({response},c),null);
});
test('pending work returns before generation; shared persisted result avoids another AI call',async()=>{const s=setup();let release;const waiting=new Promise(resolve=>release=resolve);s.env.AI.run=async()=>{assert.equal(s.storage.m.get('briefing:budget').daily,1);await waiting;return {response:'{"facts":["humidCalm"]}'};};assert.equal((await(await handle(req(),s.env,s.storage,s.options)).json()).status,'pending');assert.equal((await(await handle(req(),s.env,s.storage,s.options)).json()).status,'pending');assert.equal(s.jobs.length,1);release();await Promise.all(s.jobs);const ready=await(await handle(req(),s.env,s.storage,s.options)).json();assert.equal(ready.status,'ready');assert.match(ready.text,/muito úmido/);assert.match(ready.text,/vento praticamente parado/);assert.doesNotMatch(ready.text,/28 °C|92%|1 km\/h|3 km\/h/);assert.equal(s.jobs.length,1);assert.equal(s.storage.m.get('briefing:budget').daily,1);});
test('rain source is grounded and dry weather does not spend AI budget',async()=>{const dry=setup(rain(false),'rain');assert.equal((await(await handle(req('rain'),dry.env,dry.storage,dry.options)).json()).status,'not_applicable');assert.equal(dry.calls(),0);const s=setup(rain(),'rain');await handle(req('rain'),s.env,s.storage,s.options);await Promise.all(s.jobs);const ready=await(await handle(req('rain'),s.env,s.storage,s.options)).json();assert.equal(ready.rainState,'now');assert.match(ready.text,/possível pausa/);assert.doesNotMatch(ready.text,/mm\/h|mm no ponto/);assert.equal(s.calls(),1);});
test('hard daily/monthly limits, unavailable storage and failed inference never block ordinary forecasts',async()=>{for(const budget of [{day:new Date(now).toISOString().slice(0,10),month:'2026-11',daily:BRIEFING_LIMITS.day,monthly:64},{day:'2026-11-05',month:'2026-11',daily:0,monthly:BRIEFING_LIMITS.month}]){const s=setup();s.storage.m.set('briefing:budget',budget);assert.equal((await(await handle(req(),s.env,s.storage,s.options)).json()).status,'limited');assert.equal(s.calls(),0);}const s=setup(weather(),'hourly',{response:'invented forecast'});await handle(req(),s.env,s.storage,s.options);await Promise.all(s.jobs);const failure=await(await handle(req(),s.env,s.storage,s.options)).json();assert.equal(failure.status,'unavailable');assert.equal(failure.reason,'invalid-selection');assert.equal(s.calls(),1);const result=await handle(req(),s.env,{get:async()=>{throw Error('offline')}},s.options);assert.equal((await result.json()).status,'unavailable');assert.equal(s.calls(),1);});
test('no arbitrary coordinates, prompts, POST or kinds reach the model',async()=>{const s=setup();for(const request of [new Request('https://x/weather-briefing?kind=hourly&prompt=evil'),req('other'),new Request(req(),{method:'POST'})])assert.equal((await(await handle(request,s.env,s.storage,s.options)).json()).status,'unavailable');assert.equal(s.calls(),0);});

test('photo scenario receives an interpretation rather than reading the temperature and wind aloud',()=>{
 const d=weather();d.current.temperature=21;d.current.feels=22;d.current.humidity=92;d.current.wind=1;d.current.gust=3;
 const context=briefingContext('hourly',d,now);
 assert.deepEqual(context.keys,['humidCalm']);
 assert.match(context.facts.humidCalm,/Umidade alta, sozinha, não indica chuva/);
 assert.doesNotMatch(context.facts.humidCalm,/21|22|92|1 km|3 km|nublado/);
});

test('ordinary conditions produce no duplicate AI line and do not consume model budget',async()=>{
 const d=weather();d.current.humidity=58;d.current.wind=12;d.current.gust=18;d.current.feels=28;
 const ctx=briefingContext('hourly',d,now);assert.equal(ctx.notApplicable,true);
 const s=setup(d);const status=await(await handle(req(),s.env,s.storage,s.options)).json();
 assert.equal(status.status,'not_applicable');
 assert.equal(s.calls(),0);assert.equal(s.jobs.length,0);
});

test('derived warnings are conditional on thresholds and never invent weather events',()=>{
 const d=weather();d.current.humidity=25;d.current.wind=42;d.current.gust=65;d.current.condition='Thunderstorms';d.current.feels=34;
 const ctx=briefingContext('hourly',d,now);
 assert.deepEqual(ctx.keys,['dry','heat','gusts','storm']);
 assert(ctx.keys.every(k=>!/temperature|humidity|condition/.test(k)));
 assert.deepEqual(parseBriefingSelection({response:'{"facts":["gusts","storm"]}'},ctx),['gusts','storm']);
 assert.equal(parseBriefingSelection({response:'{"facts":["dry","heat","gusts"]}'},ctx),null);
 assert.equal(parseBriefingSelection({response:'{"facts":["tornado"]}'},ctx),null);
});

test('rainy forecast highlights evolution instead of repeating rates or amounts',()=>{
 const d=rain();const ctx=briefingContext('rain',d,now);
 assert.deepEqual(ctx.keys,['pause']);
 assert.match(ctx.facts.pause,/possível pausa/);
 assert.doesNotMatch(ctx.facts.pause,/\d+ mm|intensidade estimada/);
});

test('does not claim a rain pause next hour when only a much later pause exists',()=>{
 const d=rain();
 d.forecast=Array.from({length:180},(_,i)=>({start:now+i*60000,end:now+(i+1)*60000,rate:i<120?3:0,type:i<120?'rain':'no_precipitation'}));
 const ctx=briefingContext('rain',d,now);
 assert.deepEqual(ctx.keys,['persistent']);
 assert.doesNotMatch(ctx.facts.persistent,/pausa|\d+ mm/);
});

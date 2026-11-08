import {test} from 'node:test';import assert from 'node:assert/strict';
import {project30,handleRainOutlook,handleSeismicInsightInObject} from '../../worker/ai-science.mjs';
import {BRIEFING_MODEL} from '../../worker/weather-briefing.mjs';
const now=Date.parse('2026-11-08T20:35:00Z'),MIN=60000;
const stamp=Math.floor(now/MIN)*MIN;
function rain(){
 return {version:'tv-rain-v1',ok:true,area:'liberdade',loc:{lat:-23.555,lng:-46.635},
  at:now,expiresAt:now+6*MIN,forecast:Array.from({length:60},(_,i)=>({
   start:stamp+i*MIN,end:stamp+(i+1)*MIN,
   rate:i<10?0:i<20?1.5:9,type:i<10?'no_precipitation':'rain'
  }))};
}
const getRain=()=>new Request('https://test/weather-outlook?area=liberdade');
test('strict 30-minute nowcast calculates 3 ten-minute windows and mm only from source',()=>{
 const d=rain(),v=project30(d,now);assert.equal(v.horizonMinutes,30);
 assert.deepEqual(v.groups.map(x=>x.level),['sem precipitação','chuva fraca','chuva forte']);
 assert.equal(v.totalMm,1.8);
 assert.equal(v.trend,'intensificação');
 assert.match(v.text,/próximos 30 min|Próximos 30 min/);
 assert.match(v.text,/Rainbow Weather/);
 assert.equal(v.basedAt,d.at);
 assert.equal(v.expiresAt,d.expiresAt);
});
test('missing minute, stale, invalid location, and malformed rate are not projected',()=>{
 for(const change of [d=>{d.forecast[9].start+=MIN;},d=>{d.at-=11*MIN;},
 d=>{d.loc.lat=0;},d=>{d.forecast[0].rate=Infinity;},
 d=>{d.forecast.length=20;},d=>{d.forecast[3].rate=-1;}]){const d=rain();change(d);assert.equal(project30(d,now),null);}
});
test('endpoint enforces fixed Liberdade area and does not claim healthy data on failures',async()=>{
 const env={},readRain=async()=>Response.json(rain());
 const good=await(await handleRainOutlook(getRain(),env,{now,readRain})).json();
 assert.equal(good.ok,true);assert.equal(good.area,'liberdade');
 for(const q of ['?area=SP','?area=liberdade&lat=1','?area=liberdade&prompt=system']){
  const r=await handleRainOutlook(new Request('https://test/weather-outlook'+q),env,{now,readRain});
  assert.equal(r.status,400);
 }
 const broken=await(await handleRainOutlook(getRain(),env,{now,readRain:async()=>Response.json({ok:false})})).json();
 assert.equal(broken.ok,false);
});
const quake=(over={})=>({kind:'earthquake',id:'USGS:us7000test',eligible:true,
 title:'M6,4 · Costa do Chile',magnitude:6.4,depth:29.6,source:'USGS',
 eventTime:now-120000,tsunamiSummary:'',...over});
const feed=(events=[quake()])=>({version:'tv-alerts-v1',sources:{earthquake:true,tsunami:true},alerts:events});
const reading=snap=>async()=>Response.json(snap);
const store=()=>{const m=new Map();return {m,get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),delete:async k=>m.delete(k)};};
const req=(q='')=>new Request('https://test/seismic-insight'+q);
test('scientific interpretation has source lineage and no unverified damages or tsunami threats',async()=>{
 const storage=store(),options={now,waitUntil:()=>{},readFeed:reading(feed())};
 const result=await(await handleSeismicInsightInObject(req(),{},storage,options)).json();
 assert.equal(result.status,'ready');assert.equal(result.source,'USGS');assert.equal(result.model,'validated-science-v1');
 assert.equal(result.sections.length,6);
 assert.match(result.sections.find(s=>s.id==='depth').text,/29,6 km/);
 assert.match(result.sections.find(s=>s.id==='tsunami').text,/NÃO comprova ausência de ameaça/);
 assert.ok(result.sections.every(s=>!s.text.includes('vítimas confirmadas')));
 assert.ok(result.disclaimer.includes('não é previsão sísmica'));
});
test('AI selects ONLY emphasis IDs; explanations remain source-verified even on model failure',async()=>{
 const storage=store(),jobs=[];let calls=0;
 const env={AI:{run:async(model,args)=>{calls++;assert.equal(model,BRIEFING_MODEL);assert.match(args.messages[1].content,/IDs permitidos/);return {response:'{"facts":["depth","shaking"]}'};}}};
 const options={now,waitUntil:j=>jobs.push(j),readFeed:reading(feed())};
 let r=await(await handleSeismicInsightInObject(req('?id=USGS%3Aus7000test'),env,storage,options)).json();
 assert.equal(r.status,'pending');assert.equal(jobs.length,1);
 await Promise.all(jobs);
 r=await(await handleSeismicInsightInObject(req('?id=USGS%3Aus7000test'),env,storage,options)).json();
 assert.equal(r.status,'ready');assert.equal(r.model,BRIEFING_MODEL);assert.equal(calls,1);
 assert.ok(r.sections.find(s=>s.id==='depth').focus);
 assert.ok(r.sections.find(s=>s.id==='shaking').focus);
 assert.ok(!r.sections.find(s=>s.id==='size').focus);
});
test('unknown IDs cannot call models; unfinished/untrusted feed does not create analysis',async()=>{
 const storage=store();let calls=0;
 const env={AI:{run:async()=>{calls++;return {};}}};
 const opt={now,waitUntil:()=>{},readFeed:reading(feed())};
 const unknown=await(await handleSeismicInsightInObject(req('?id=invalid'),env,storage,opt)).json();
 assert.equal(unknown.status,'unavailable');assert.equal(unknown.reason,'no-matching-fresh-event');
 for(const q of ['?id=bad&inject=1','?prompt=quake','?id=x']){
  const r=await handleSeismicInsightInObject(req(q),env,storage,opt);
  assert.equal(r.status,400);
 }
 const stale=await(await handleSeismicInsightInObject(req(),env,storage,{...opt,readFeed:reading(feed([quake({eventTime:now-80*3600000})]))})).json();
 assert.equal(stale.status,'unavailable');assert.equal(calls,0);
});
test('seismic source priority and budget do not affect alert state machine or issue a push',async()=>{
 const storage=store(),jobs=[],env={AI:{run:async()=>({response:'{"facts":["size"]}'})}};
 storage.m.set('seismic-insight:budget',{day:'2026-11-08',month:'2026-11',daily:24,monthly:24});
 const r=await(await handleSeismicInsightInObject(req(),env,storage,{now,readFeed:reading(feed()),waitUntil:p=>jobs.push(p)})).json();
 assert.equal(r.status,'ready');assert.equal(r.model,'validated-science-v1');assert.equal(r.limited,true);assert.equal(jobs.length,0);
});

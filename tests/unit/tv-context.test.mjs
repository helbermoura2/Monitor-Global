import test from 'node:test';import assert from 'node:assert/strict';
import {contextSummary,createTvEnricher} from '../../worker/tv-context.mjs';
const ev={lat:0,lon:0};const place=(n,lat)=>({name:n,lat,lon:0});
const exposure={status:'available',method:'pager',ranges:[{population:5000},{population:100},{population:0}]};
test('context sorts and deduplicates at most five references; labels exposure separately from victims',()=>{
 const s=contextSummary(ev,exposure,[place('D',4),place('B',2),place('A',1),place('C',3),place('E',5),place('F',6),place('A',1)]);
 assert.match(s.populationSummary,/5\.000/);assert.match(s.populationSummary,/MMI III\+/);assert.match(s.populationSummary,/Não é contagem de vítimas/);assert(s.nearbySummary.indexOf('A —')<s.nearbySummary.indexOf('B —'));assert(!s.nearbySummary.includes('F —'));assert.equal(s.nearbySummary.match(/A —/g).length,1);
 assert.match(contextSummary(ev,null,[place('Only',1)]).nearbySummary,/1 disponíveis/);assert.match(contextSummary(ev,null,[]).populationSummary,/indisponível/);
});
test('optional context is cached, bounded to three quakes and never modifies versions/eligibility',async()=>{
 let count=0;const enrich=createTvEnricher({exposure:async()=>{count++;return exposure;},places:async()=>[place('A',1)]});
 const features=Array.from({length:4},(_,i)=>({id:String(i),geometry:{coordinates:[0,0,10]}}));
 const snapshot=()=>({alerts:features.map(f=>({id:'USGS:'+f.id,kind:'earthquake',eligible:true,version:'original',magnitude:6,depth:10,eventTime:Date.now()}))});
 const a=await enrich(snapshot(),features,{});await enrich(snapshot(),features,{});assert.equal(count,3);assert(a.alerts.slice(0,3).every(a=>a.populationSummary));assert(a.alerts.every(a=>a.version==='original'&&a.eligible));assert(!a.alerts[3].populationSummary);
});
test('optional timeout returns explicit absence and deduplicates in-flight work',async()=>{
 let release,count=0;const enrich=createTvEnricher({budgetMs:5,exposure:()=>{count++;return new Promise(r=>release=r);},places:async()=>[]});
 const snapshot=()=>({alerts:[{id:'USGS:x',kind:'earthquake',eligible:true,magnitude:6,depth:10,eventTime:1}]}),features=[{id:'x',geometry:{coordinates:[0,0,10]}}];
 const a=await enrich(snapshot(),features,{});assert.match(a.alerts[0].populationSummary,/indisponível/);await enrich(snapshot(),features,{});assert.equal(count,1);release(exposure);
});

test('official response never waits for optional population; later snapshots reuse completed context',async()=>{
 let release,calls=0;const jobs=[];
 const enrich=createTvEnricher({exposure:()=>{calls++;return new Promise(r=>release=r);},places:async()=>[]});
 const snapshot=()=>({sources:{earthquake:true,tsunami:true},alerts:[{id:'USGS:x',kind:'earthquake',eligible:true,version:'official',magnitude:6,depth:10,eventTime:1}]}),features=[{id:'x',geometry:{coordinates:[0,0,10]}}],env={TV_WAIT_UNTIL:p=>jobs.push(p)};
 const first=await enrich(snapshot(),features,env);assert.match(first.alerts[0].populationSummary,/indisponível/);assert.equal(first.alerts[0].version,'official');assert(first.sources.tsunami);
 await enrich(snapshot(),features,env);assert.equal(calls,1);release(exposure);await Promise.all(jobs);
 const next=await enrich(snapshot(),features,env);assert.match(next.alerts[0].populationSummary,/ESTIMATIVA/);assert.match(next.alerts[0].populationSummary,/5\.000/);
});
test('failing optional providers keep official alert eligibility and never fabricate population zero',async()=>{
 const enrich=createTvEnricher({exposure:()=>{throw Error('offline');},places:()=>Promise.reject(Error('offline'))});
 const a={id:'USGS:x',kind:'earthquake',eligible:true,version:'official',magnitude:6,depth:10,eventTime:1};
 await enrich({alerts:[a]},[{id:'x',geometry:{coordinates:[0,0,10]}}],{});
 assert(a.eligible);assert.equal(a.version,'official');assert.match(a.populationSummary,/indisponível/);assert(!a.populationSummary.includes('~0'));
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {handlePopulationExposure,populationTtl} from '../../population-exposure-worker.mjs';
const available={status:'available',method:'worldpop',ranges:[{population:100},{population:20},{population:2}]};
const storage=()=>{const values=new Map();return {values,get:async k=>values.get(k),put:async(k,v)=>values.set(k,v),setAlarm:async()=>{}};};
function req(extra=''){return new Request('https://worker.test/population-exposure?lat=-22&lng=-45&mag=4&depth=10&time='+(Date.now()-13*3600000)+extra);}
test('WorldPop stable retention is seven days, recent one day; PAGER always revalidates in five minutes',()=>{const old={time:Date.now()-13*3600000},recent={time:Date.now()-3600000};assert.equal(populationTtl(old,available),604800);assert.equal(populationTtl(recent,available),86400);assert.equal(populationTtl(old,{status:'available',method:'pager'}),300);assert.equal(populationTtl(old,{status:'unavailable'}),900);});
test('old WorldPop is calculated once, reused on refocus and a new magnitude recalculates',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({data:{total_population:10}});};
 try{const request=req(),env={};const first=await handlePopulationExposure(request,env);assert.equal((await first.json()).method,'worldpop');const initial=calls;assert(initial>0&&initial<=3);const again=await handlePopulationExposure(request,env);assert.equal((await again.json()).status,'available');assert.equal(calls,initial);assert(Number(again.headers.get('X-Monitor-Population-Cache-Until'))>Date.now()+6*86400000);await handlePopulationExposure(new Request(request.url.replace('mag=4','mag=4.2')),env);assert(calls>initial);}finally{globalThis.fetch=original;}
});
test('a cached WorldPop with a USGS identifier still checks for emerging PAGER in five minutes',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({});};
 try{const s=storage();s.values.set('population-state',{until:Date.now()+7*86400000,value:available});const r=await handlePopulationExposure(req('&eventId=us-reuse'),{},s);assert.equal((await r.json()).method,'worldpop');assert.equal(calls,1);assert(Number(r.headers.get('X-Monitor-Population-Cache-Until'))<=Date.now()+300000);}finally{globalThis.fetch=original;}
});
test('unsupported data is retained fifteen minutes without converting it to zero or writing KV',async()=>{
 const s=storage(),r=await handlePopulationExposure(new Request(req().url.replace('depth=10','depth=100')), {TTS_USAGE:{put(){throw Error('KV forbidden');}}},s);const data=await r.json();assert.equal(data.status,'unsupported');assert.equal(data.ranges,undefined);const entry=s.values.get('population-state');assert(entry.until>Date.now()+899000&&entry.until<=Date.now()+900000);
});

test('PAGER cache expires after five minutes and accepts a later product even for an old earthquake',async()=>{
 const original=fetch,originalNow=Date.now;let now=originalNow(),calls=0;Date.now=()=>now;
 const request=req('&eventId=us-pager-refresh'),origin=Number(new URL(request.url).searchParams.get('time')),s=storage();s.values.set('population-state',{until:now+300000,value:{...available,method:'pager',updatedAt:now-1000}});
 globalThis.fetch=async url=>{calls++;if(String(url).includes('fdsnws'))return Response.json({geometry:{coordinates:[-45,-22,10]},properties:{mag:4,time:origin,products:{losspager:[{updateTime:now,contents:{'pager.xml':{url:'https://earthquake.usgs.gov/product/reuse/pager.xml'}}}]}}});return new Response('<pager>'+Array.from({length:11},(_,i)=>`<exposure dmin="${i}" dmax="${i+1}" exposure="50" rangeInsideMap="1"/>`).join('')+'</pager>');};
 try{assert.equal((await(await handlePopulationExposure(request,{},s)).json()).method,'pager');assert.equal(calls,0);now+=300001;const updated=await(await handlePopulationExposure(request,{},s)).json();assert.equal(updated.method,'pager');assert.equal(updated.updatedAt,now);assert.equal(calls,2);}finally{globalThis.fetch=original;Date.now=originalNow;}
});

test('a response whose absolute expiry already passed is not renewed by the edge coordinator',async()=>{
 let calls=0;const coordinator={idFromName:x=>x,get:()=>({fetch:async()=>{calls++;return Response.json(available,{headers:{'X-Monitor-Population-Cache-Until':String(Date.now()-1)}});}})};const request=req(),env={EARTHQUAKE_ALERTS:coordinator};await handlePopulationExposure(request,env);await handlePopulationExposure(request,env);assert.equal(calls,2);
});

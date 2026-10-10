import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleRainbowProductInObject as handle,handleRainbowProducts,normalizeWeather} from '../../rainbow-products-worker.mjs';
const now=Date.now(),start=Math.floor(now/3600000)*3600000,loc={lat:-23.555,lng:-46.635};
function payload(){return {units:{temperature:'celsius',windSpeed:'meter_per_second',precipitationAmount:'millimeters',humidity:'percent',precipitationChance:'percent'},location:{lat:loc.lat,lon:loc.lng},generatedAtTimestamp:Math.floor(now/1000),timelines:{hourly:Array.from({length:48},(_,i)=>({startTimestamp:(start+i*3600000)/1000,temperature:22,feelsLikeTemperature:21,humidity:70,windSpeed:5,windGust:10,precipitationAmount:2,precipitationChance:80,uvIndex:2,pressure:1010})),daily:Array.from({length:5},(_,i)=>({startTimestamp:(start+i*86400000)/1000,temperatureMin:18,temperatureMax:25,precipitationAmount:5,precipitationChance:80,condition:'Rain'}))}};}
function storage(){const m=new Map();return {m,get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),delete:async k=>m.delete(k)};}
const req=(path='/rain-weather?lat=-23.555&lng=-46.635')=>new Request('https://worker.test'+path),env={RAINBOW_API_KEY:'private-secret'};
test('Weather validates units, time and GPS; converts m/s and preserves unknown values',()=>{
 const d=normalizeWeather(payload(),loc,now);assert.equal(d.hourly[0].wind,18);assert.equal(d.hourly[0].gust,36);
 const p=payload();p.timelines.hourly[0].humidity=null;assert.equal(normalizeWeather(p,loc,now).hourly[0].humidity,null);
 p.units.windSpeed='km/h';assert.throws(()=>normalizeWeather(p,loc,now));p.units.windSpeed='meter_per_second';p.location.lat=0;assert.throws(()=>normalizeWeather(p,loc,now));
 const old=payload();old.generatedAtTimestamp-=20000;assert.throws(()=>normalizeWeather(old,loc,now));
});
test('persistent budget is reserved before provider request and cached response is shared',async()=>{
 const store=storage();let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(store.m.get('weather:budget').used,1);assert.equal(options.headers['Ocp-Apim-Subscription-Key'],'private-secret');assert.equal(options.redirect,'manual');assert.match(url,/weather\/v1\/forecast\/-46.635\/-23.555/);return Response.json(payload());};
 const first=await (await handle(req(),env,store,{now,fetcher})).json();assert.equal(first.ok,true);await handle(req(),env,store,{now:now+1000,fetcher});assert.equal(calls,1);assert.ok(!JSON.stringify(first).includes('private-secret'));
});
test('quota and failed storage stop calls, provider errors consume budget and back off',async()=>{
 const store=storage();let calls=0;const fetcher=async()=>{calls++;return new Response('private provider body',{status:403});};
 const result=await (await handle(req(),env,store,{now,fetcher})).json();assert.equal(result.ok,false);assert.equal(result.httpStatus,403);assert.ok(!JSON.stringify(result).includes('private provider body'));
 await handle(req(),env,store,{now:now+1000,fetcher});assert.equal(calls,1);assert.equal(store.m.get('weather:budget').used,1);
 store.m.delete('weather:pause');store.m.get('weather:budget').used=4500;await handle(req(),env,store,{now,fetcher});assert.equal(calls,1);
 await handle(req(),env,{get:async()=>{throw Error('offline');}},{now,fetcher});assert.equal(calls,1);
 assert.equal((await (await handleRainbowProducts(req(),{})).json()).reason,'storage_unavailable');
});
test('Tiles validate snapshot and coordinates, persist PNG cache and count metadata too',async()=>{
 const store=storage(),snapshot=Math.floor(now/600000)*600;let calls=0;
 const fetcher=async url=>{calls++;return url.includes('snapshot?')?Response.json({snapshot}):new Response(Uint8Array.from([137,80,78,71,13,10,26,10,0]),{headers:{'Content-Type':'image/png'}});};
 const meta=await (await handle(req('/rainbow-snapshot'),env,store,{now,fetcher})).json();assert.equal(meta.snapshot,snapshot);
 const path=`/rainbow-tile/${snapshot}/7/10/20`,png=await handle(req(path),env,store,{now,fetcher});assert.equal(png.headers.get('Content-Type'),'image/png');assert.equal((await png.arrayBuffer()).byteLength,9);
 await handle(req(path),env,store,{now:now+1,fetcher});assert.equal(calls,2);assert.equal(store.m.get('tiles:budget').used,2);
 for(const path of [`/rainbow-tile/${snapshot}/8/1/1`,`/rainbow-tile/${snapshot}/7/128/1`,`/rainbow-tile/${snapshot-7800}/7/1/1`,`/rainbow-tile/${snapshot+6000}/7/1/1`])assert.equal((await handle(req(path),env,store,{now,fetcher})).status,400);
 assert.equal(calls,2);
});
test('bad PNGs and provider redirects cannot forward secret or masquerade as rain',async()=>{
 const store=storage(),snapshot=Math.floor(now/600000)*600;let calls=0;
 const response=await handle(req(`/rainbow-tile/${snapshot}/1/0/0`),env,store,{now,fetcher:async()=>{calls++;return new Response('<html>key</html>');}});assert.equal(response.status,503);assert.equal(calls,1);
 const redirect=await handle(req(),env,storage(),{now,fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://elsewhere.test'}})});assert.equal((await redirect.json()).ok,false);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {brentSession,parseBrentQuote,handleTvBrent} from '../../worker/tv-brent.mjs';
const date=str=>Date.parse(str),H=3600000;
const example=(now,options={})=>({chart:{result:[{meta:{
 symbol:'BZ=F',currency:'USD',regularMarketPrice:78.35,
 chartPreviousClose:77.50,regularMarketTime:Math.floor((now-4*60000)/1000),
 ...options},timestamp:[Math.floor((now-5*60000)/1000)]}],error:null}});
test('regular NYMEX BZ hours gate Sunday opening and Friday close',()=>{
 assert.equal(brentSession(date('2026-11-08T22:59:00Z')),false);
 assert.equal(brentSession(date('2026-11-08T23:00:00Z')),true);
 assert.equal(brentSession(date('2026-11-09T00:15:00Z')),true);
 assert.equal(brentSession(date('2026-11-09T01:00:00Z')),true);
 assert.equal(brentSession(date('2026-11-13T21:59:00Z')),true);
 assert.equal(brentSession(date('2026-11-13T22:00:00Z')),false);
 assert.equal(brentSession(date('2026-11-14T12:00:00Z')),false);
 assert.equal(brentSession(date('2026-11-15T22:59:00Z')),false);
 assert.equal(brentSession(date('2026-11-15T23:00:00Z')),true);
});
test('New York DST makes Sunday 18:00 local open at 22:00 UTC in July',()=>{
 assert.equal(brentSession(date('2026-07-05T21:59:00Z')),false);
 assert.equal(brentSession(date('2026-07-05T22:00:00Z')),true);
 assert.equal(brentSession(date('2026-07-10T20:59:00Z')),true);
 assert.equal(brentSession(date('2026-07-10T21:00:00Z')),false);
});
test('source-derived USD/barrel value, last update and variation are not fabricated',()=>{
 const now=date('2026-11-10T11:00:00Z');
 const data=parseBrentQuote(example(now),now);
 assert.equal(data.ok,true);assert.equal(data.price,78.35);
 assert.equal(data.change,0.85);assert.equal(data.percent,1.10);
 assert.equal(data.symbol,'BZ=F');assert.equal(data.currency,'USD');
 assert.ok(data.asOf<now);assert.equal(data.source,'Yahoo Finance');
});
test('stale quotes, different symbols, invalid source data and marketState never produce a card',()=>{
 const now=date('2026-11-10T11:00:00Z');
 for(const changes of [
  {symbol:'CL=F'},{currency:'BRL'},{regularMarketPrice:0},{regularMarketPrice:Infinity},
  {regularMarketTime:Math.floor((now-3*H)/1000)},{regularMarketTime:Math.floor((now+5*60000)/1000)},
  {marketState:'CLOSED'},{chartPreviousClose:2,previousClose:2}
 ]){
  const d=example(now,changes);
  if(changes.chartPreviousClose===2){const valid=parseBrentQuote(d,now);assert.equal(valid?.previousClose,null);continue;}
  // An older valid chart timestamp does not mask a stale last trade.
  if(changes.regularMarketTime&&changes.regularMarketTime<now/1000-H)d.chart.result[0].timestamp=[];
  assert.equal(parseBrentQuote(d,now),null,JSON.stringify(changes));
 }
 assert.equal(parseBrentQuote({chart:{result:[]}},now),null);
});
test('source failure or closed NYMEX session never triggers invented quote or upstream traffic',async()=>{
 const now=date('2026-11-14T14:00:00Z');let calls=0;
 const request=new Request('https://test/tv-brent');
 const closed=await(await handleTvBrent(request,{}, {now,get:()=>{calls++;throw Error('No request weekends');}})).json();
 assert.equal(calls,0);assert.equal(closed.marketOpen,false);assert.equal(closed.ok,false);
 const weekday=date('2026-11-11T15:00:00Z');
 const fail=await(await handleTvBrent(request,{}, {now:weekday,get:async()=>new Response('unavailable',{status:503})})).json();
 assert.equal(fail.ok,false);assert.equal(fail.marketOpen,true);
 const valid=await(await handleTvBrent(request,{}, {now:weekday,get:async()=>Response.json(example(weekday))})).json();
 assert.equal(valid.ok,true);assert.equal(valid.price,78.35);
 const invalid=await handleTvBrent(new Request('https://test/tv-brent?lat=1'),{}, {now:weekday,get:async()=>{throw Error('should not call');}});
 assert.equal(invalid.status,400);
});

test('query2 Yahoo backup is attempted only if query1 fails and has fresh BZ=F data',async()=>{
 const now=date('2026-11-11T15:00:00Z'),urls=[];
 const response=await(await handleTvBrent(new Request('https://test/tv-brent'),{},{
  now,get:async url=>{urls.push(url);if(url.includes('query1'))return new Response('unavailable',{status:429});return Response.json(example(now));}
 })).json();
 assert.equal(response.ok,true);assert.equal(response.price,78.35);assert.equal(urls.length,2);
 assert.ok(urls[0].includes('query1.finance.yahoo.com'));
 assert.ok(urls[1].includes('query2.finance.yahoo.com'));
});
test('no invented Brent price if both Yahoo chart hosts are stale or unavailable',async()=>{
 const now=date('2026-11-11T15:00:00Z'),urls=[];
 const stale=await(await handleTvBrent(new Request('https://test/tv-brent'),{},{
  now,get:async url=>{urls.push(url);return Response.json(example(now,{regularMarketTime:Math.floor((now-3*H)/1000)}));}
 })).json();
 assert.equal(urls.length,2);assert.equal(stale.ok,false);
 assert.equal(stale.reason,'source-stale-or-invalid');
 const unavailable=await(await handleTvBrent(new Request('https://test/tv-brent'),{},{
  now,get:async()=>new Response('unavailable',{status:503})
 })).json();
 assert.equal(unavailable.ok,false);assert.equal(unavailable.reason,'source-unavailable');
});

test('fresh Yahoo chart 1-minute candle is legitimate only with matched timestamp and price',()=>{
 const now=date('2026-11-11T15:00:00Z'),recent=Math.floor((now-5*60000)/1000);
 const old=Math.floor((now-4*H)/1000);
 const raw=example(now,{regularMarketTime:old});
 raw.chart.result[0].timestamp=[recent];
 raw.chart.result[0].indicators={quote:[{close:[79.12]}]};
 const parsed=parseBrentQuote(raw,now);
 assert.equal(parsed?.price,79.12);
 assert.equal(parsed?.asOf,recent*1000);
 assert.equal(parsed?.quoteKind,'observed-minute-candle');
 const missing=structuredClone(raw);delete missing.chart.result[0].indicators;
 assert.equal(parseBrentQuote(missing,now),null);
 const invalid=structuredClone(raw);invalid.chart.result[0].indicators.quote[0].close=[null];
 assert.equal(parseBrentQuote(invalid,now),null);
 const mismatched=structuredClone(raw);mismatched.chart.result[0].indicators.quote[0].close=[79.12,80];
 assert.equal(parseBrentQuote(mismatched,now),null);
 const wrongTicker=structuredClone(raw);wrongTicker.chart.result[0].meta.symbol='CL=F';
 assert.equal(parseBrentQuote(wrongTicker,now),null);
});
test('a recent chart timestamp by itself never refreshes stale Brent headline prices',()=>{
 const now=date('2026-11-11T15:00:00Z');
 const input=example(now,{regularMarketTime:Math.floor((now-3*H)/1000)});
 assert.equal(parseBrentQuote(input,now),null);
});


test('daily pause and reopening never reuse previous session price',()=>{
 const pause=date('2026-11-11T22:30:00Z'),reopen=date('2026-11-11T23:05:00Z');
 assert.equal(brentSession(pause),false);assert.equal(brentSession(reopen),true);
 assert.equal(parseBrentQuote(example(reopen,{regularMarketTime:date('2026-11-11T21:59:00Z')/1000}),reopen),null);
});
test('provider holiday closure overrides regular session without invented prices',async()=>{
 const now=date('2026-11-26T19:00:00Z');const response=await(await handleTvBrent(new Request('https://test/tv-brent'),{},{now,get:async()=>Response.json(example(now,{marketState:'CLOSED'}))})).json();
 assert.equal(response.marketOpen,false);assert.equal(response.marketState,'CLOSED');assert.equal(response.reason,'market-closed-from-source');assert.equal(response.price,undefined);
});

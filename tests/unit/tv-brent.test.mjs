import {test} from 'node:test';import assert from 'node:assert/strict';
import {londonSession,parseBrentQuote,handleTvBrent} from '../../worker/tv-brent.mjs';
const date=str=>Date.parse(str),H=3600000;
const example=(now,options={})=>({chart:{result:[{meta:{
 symbol:'BZ=F',currency:'USD',regularMarketPrice:78.35,
 chartPreviousClose:77.50,regularMarketTime:Math.floor((now-4*60000)/1000),
 ...options},timestamp:[Math.floor((now-5*60000)/1000)]}],error:null}});
test('regular ICE Brent London hours gate Sunday opening and Friday close',()=>{
 assert.equal(londonSession(date('2026-11-08T22:59:00Z')),false);
 assert.equal(londonSession(date('2026-11-08T23:00:00Z')),true);
 assert.equal(londonSession(date('2026-11-09T00:15:00Z')),false);
 assert.equal(londonSession(date('2026-11-09T01:00:00Z')),true);
 assert.equal(londonSession(date('2026-11-13T22:59:00Z')),true);
 assert.equal(londonSession(date('2026-11-13T23:00:00Z')),false);
 assert.equal(londonSession(date('2026-11-14T12:00:00Z')),false);
 assert.equal(londonSession(date('2026-11-15T22:59:00Z')),false);
 assert.equal(londonSession(date('2026-11-15T23:00:00Z')),true);
});
test('London DST makes Sunday 23:00 local open at 22:00 UTC in July',()=>{
 assert.equal(londonSession(date('2026-07-05T21:59:00Z')),false);
 assert.equal(londonSession(date('2026-07-05T22:00:00Z')),true);
 assert.equal(londonSession(date('2026-07-10T21:59:00Z')),true);
 assert.equal(londonSession(date('2026-07-10T22:00:00Z')),false);
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
test('source failure or closed ICE session never triggers invented quote or upstream traffic',async()=>{
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

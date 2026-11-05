'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../app/src/main/assets/phone-rain-model.js');
const now=1800000000000;
function data(rate=i=>i>=75&&i<100?3:0){return {ok:true,version:'tv-rain-v1',area:'liberdade',loc:{lat:-23.555,lng:-46.635},at:now,expiresAt:now+600000,forecast:Array.from({length:180},(_,i)=>({start:now+i*60000,end:now+(i+1)*60000,rate:rate(i),type:rate(i)>0?'rain':'no_precipitation'}))};}
test('future arrival after the old one-hour horizon, real accumulation and ten-minute dry termination',()=>{
 const value=M.forecast(data(),now);assert.equal(value.arrival,75);assert.equal(value.duration,25);assert.match(value.headline,/75 min/);assert.equal(value.minutes,120);assert.ok(Math.abs(value.amount-1.25)<1e-9);assert.equal(value.peak,3);
});
test('sustained strengthening uses source values; one noisy minute does not create the trend',()=>{
 assert.equal(M.forecast(data(i=>i>=40?5:1),now).increase,40);assert.equal(M.forecast(data(i=>i===40?10:1),now).increase,-1);
});
test('invalid, incomplete, expired and foreign coordinates cannot masquerade as dry',()=>{
 for(const change of [d=>d.ok=false,d=>d.expiresAt=now,d=>d.at=now-1800000,d=>d.loc.lat=0,d=>d.forecast[5].rate=-1,d=>d.forecast[5].rate=NaN,d=>d.forecast[5].start++,d=>d.forecast.splice(30)]){const d=data();change(d);assert.equal(M.forecast(d,now),null);}
 const d=data(()=>0);assert.match(M.forecast(d,now).headline,/2 horas/);d.forecast.length=90;const short=M.forecast(d,now);assert.equal(short.minutes,90);assert.match(short.headline,/90 min/);assert.doesNotMatch(short.headline,/2 horas/);
});
test('frames use real historical snapshots and forecast offsets, never future snapshot timestamps',()=>{
 const snapshot=Math.floor(now/600000)*600,frames=M.frames({ok:true,snapshot},now);assert.equal(frames.length,10);assert.equal(frames[0].snapshot,snapshot-3600);assert.equal(frames[0].forecast,0);assert.equal(frames.at(-1).snapshot,snapshot);assert.equal(frames.at(-1).forecast,7200);assert.equal(frames.at(-1).time,(snapshot+7200)*1000);
 assert.deepEqual(M.frames({ok:true,snapshot:snapshot+600},now),[]);assert.deepEqual(M.frames({ok:true,snapshot:snapshot-2400},now),[]);
});

test('map expiry follows producer TTL and timeline steps stay proportional',()=>{const snapshot=Math.floor(now/600000)*600,d={ok:true,snapshot,expiresAt:now+600000};const frames=M.frames(d,now);assert.equal(frames[3].offset,0);for(let i=1;i<frames.length;i++)assert.equal(frames[i].time-frames[i-1].time,20*60000);assert.deepEqual(M.frames(d,now+600000),[]);assert.equal(M.mapExpiresAt(d),now+600000);});

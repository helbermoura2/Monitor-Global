import test from 'node:test';import assert from 'node:assert/strict';
import {identify,track,extrapolate,distance} from '../../android-mobile/app/src/main/assets/phone-storm-tracker.mjs';
const now=Date.parse('2026-11-28T14:00:00Z'),N=64;
function frame(time,boxes,{radar='radar-a',owner='inpe',altitude=3000,product='cappi3km',reverse=false,missing=[]}={}){
 const lon=Array.from({length:N},(_,i)=>-47+i*.01),lat=Array.from({length:N},(_,i)=>-24+(reverse?N-1-i:i)*.01),values=new Array(N*N).fill(10);
 for(const [x,y,w,h,z=48] of boxes)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)values[(reverse?N-1-j:j)*N+i]=z;
 for(const [x,y] of missing)values[(reverse?N-1-y:y)*N+x]=null;
 return {time,radar,owner,altitude,product,lon,lat,values};
}
test('known eastward displacement and actual coordinates',()=>{
 const a=frame(now-10*60000,[[15,20,4,4]]),b=frame(now,[[20,20,4,4,55]]);
 const result=track(a,b,now);assert.equal(result.tracks.length,1);
 const t=result.tracks[0];assert(t.speedKmh>29&&t.speedKmh<32);assert(Math.abs(t.bearingDeg-90)<1);assert.equal(t.peakDbz,55);assert.equal(t.intervalMinutes,10);
 const forecast=extrapolate(t,20);assert.equal(forecast.uncertainty,'not_calibrated');assert(Math.abs(distance(t.current,forecast.center)-t.speedKmh/3)<1e-6);
 assert.equal(extrapolate(t,60),null);
});
test('latitude orientation does not change observed displacement',()=>{
 const a=frame(now-10*60000,[[15,20,4,4]],{reverse:true}),b=frame(now,[[20,20,4,4]],{reverse:true});
 assert.equal(track(a,b,now).tracks.length,1);
});
test('splits and merges suppress extrapolation',()=>{
 const old=frame(now-10*60000,[[20,20,10,4]]),split=frame(now,[[18,20,4,4],[27,20,4,4]]);
 assert.equal(track(old,split,now).tracks.length,0);
 assert.equal(track({...split,time:now-10*60000},{...old,time:now},now).tracks.length,0);
});
test('missing and edge-truncated cores remain observations only',()=>{
 const a=frame(now-10*60000,[[0,15,4,4]]),b=frame(now,[[2,15,4,4]],{missing:[[1,16]]});
 assert.equal(identify(a).objects[0].truncated,true);assert.equal(identify(b).objects[0].truncated,true);assert.equal(track(a,b,now).tracks.length,0);
});
test('unmatched radar, altitude, product, timestamps and grid never produce tracks',()=>{
 const a=frame(now-10*60000,[[15,20,4,4]]),b=frame(now,[[20,20,4,4]]);
 for(const bad of [{...b,radar:'other'},{...b,owner:'other'},{...b,altitude:4000},{...b,product:'cappi15l'},{...b,time:now+1},{...b,time:a.time+1000},{...b,time:now-3*3600000}])assert.equal(track(a,bad,now).status,'incompatible');
 assert.equal(track(a,{...b,lon:b.lon.map(v=>v+.1)},now).status,'different_grid');
 assert.equal(track({...a,time:now-100*60000},b,now).status,'incompatible');
});
test('tiny or absent echoes and excessively fast displacements do not create tracks',()=>{
 assert.equal(identify(frame(now,[[5,5,2,2]])).objects.length,0);
 assert.equal(identify(frame(now,[])).objects.length,0);
 assert.equal(track(frame(now-5*60000,[[3,20,4,4]]),frame(now,[[40,20,4,4]]),now).tracks.length,0);
});
test('stationary core has no asserted direction',()=>{
 const a=frame(now-10*60000,[[20,20,4,4]]),b=frame(now,[[20,20,4,4]]);
 const t=track(a,b,now).tracks[0];assert.equal(t.speedKmh,0);assert.equal(t.bearingDeg,null);assert.equal(extrapolate(t,15),null);
});

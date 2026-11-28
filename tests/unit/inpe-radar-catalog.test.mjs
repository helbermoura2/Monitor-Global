import test from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTION,searchUrl,normalize,discover,MAX_BYTES} from '../../android-mobile/app/src/main/assets/inpe-radar-catalog.mjs';
const now=Date.parse('2026-11-28T09:00:00Z'),bounds=[-48,-25,-45,-22];
const item=(over={})=>({id:'frame1',collection:COLLECTION,bbox:[-49,-26,-44,-21],properties:{radar:'fixture',owner:'fixture-agency',datetime:'2026-11-28T08:45:00Z'},assets:{thumbnail:{type:'image/png',href:'https://data.inpe.br/example.png'}},...over});
const fc=(features,links=[])=>({type:'FeatureCollection',features,links});
test('bounded official query has no credential',()=>{const u=new URL(searchUrl(bounds,now));assert.equal(u.hostname,'data.inpe.br');assert.equal(u.searchParams.get('collections'),COLLECTION);assert.equal(u.searchParams.has('api_key'),false);assert.throws(()=>searchUrl([-80,-35,-30,5],now));});
test('sort and limit frames per radar, reject stale/future/outside/untrusted assets',()=>{
 const frames=Array.from({length:8},(_,i)=>item({id:'f'+i,properties:{radar:'fixture',owner:'fixture-agency',datetime:new Date(now-i*600000).toISOString()}}));
 const out=normalize(fc([...frames,item({id:'stale',properties:{radar:'r',owner:'o',datetime:'2026-11-28T05:00:00Z'}}),item({id:'future',properties:{radar:'r',owner:'o',datetime:'2026-11-28T10:00:00Z'}}),item({id:'outside',bbox:[-10,10,-5,15]}),item({id:'unsafe',assets:{thumbnail:{type:'image/png',href:'https://inpe.br.example.com/x.png'}}})],[{rel:'next'}]),bounds,now);
 assert.equal(out.radars.length,1);assert.equal(out.radars[0].frames.length,6);assert.equal(out.radars[0].frames.at(-1).time,now);assert.equal(out.stale,1);assert.equal(out.rejected,3);assert.equal(out.partial,true);
});
test('missing images and available levels are not fabricated',()=>{const o=normalize(fc([item({assets:{cappi15l:{type:'application/netcdf',href:'https://data.inpe.br/example.nc'}}})]),bounds,now);assert.equal(o.radars[0].frames[0].products.thumbnail,null);assert.ok(o.radars[0].frames[0].products.cappi15l);assert.equal(o.radars[0].frames[0].products.cappi3km,null);});
test('empty catalog is not dry weather; errors and size bounds fail explicitly',async()=>{
 const f=async()=>new Response(JSON.stringify(fc([])));assert.deepEqual((await discover(bounds,{fetcher:f,now})).radars,[]);
 await assert.rejects(discover(bounds,{fetcher:async()=>new Response('bad',{status:503}),now}),/503/);
 await assert.rejects(discover(bounds,{fetcher:async()=>new Response('x'.repeat(MAX_BYTES+1)),now}),/too large/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {tvTargetArea,tvTargetAreas,TV_TARGET_AREAS,TV_TARGET_POLICY} from '../../worker/tv-target-areas.mjs';
import {tvSnapshot} from '../../worker/tv-snapshot.mjs';
test('populated watch areas use bounded geography and a raw M5 threshold, not rounded values or country strings',()=>{
 for(const [name,lat,lon]of TV_TARGET_AREAS)assert.equal(typeof tvTargetArea(lon,lat,5.4,12),'string'),assert(tvTargetArea(lon,lat,5.4,12),name);
 assert.match(tvTargetArea(85.32,27.72,5,70),/Katmandu/);assert.equal(tvTargetArea(85.32,27.72,4.99,12),'');assert.equal(tvTargetArea(85.32,27.72,6,12),'');assert.equal(tvTargetArea(85.32,27.72,5.4,70.01),'');assert.equal(tvTargetArea(85.32,27.72,5.4,null),'');assert.equal(tvTargetArea(0,0,5.4,10),'');assert.equal(tvTargetArea(181,27.72,5.4,10),'');
});
test('a target is separate from primary eligibility, Brazil and M6+ keep their rules',()=>{
 const now=Date.now(),q=(id,mag,lon=85.32,lat=27.72,depth=12,extra={})=>({id,...extra,properties:{mag,time:now-1000,updated:now,place:'Test',type:'earthquake'},geometry:{coordinates:[lon,lat,depth]}});
 const s=tvSnapshot({features:[q('target',5),q('big',6),q('deep',5.4,85.32,27.72,80),q('missing',5.4,85.32,27.72,null),q('ocean',5.4,0,0),q('br',2,-46,-23,10,{brazil:true})]},{ok:true,items:[]},now);
 assert.equal(s.targetPolicy,TV_TARGET_POLICY);const a=Object.fromEntries(s.alerts.map(a=>[a.id.split(':')[1],a]));assert(a.target.targetArea);assert.equal(a.target.eligible,false);assert.equal(a.big.eligible,true);assert.equal(a.big.targetArea,'');assert.equal(a.deep.targetArea,'');assert.equal(a.missing.targetArea,'');assert.equal(a.ocean.targetArea,'');assert.equal(a.br.eligible,true);assert.equal(a.br.targetArea,'');
});
test('the TV list displayed to the owner matches the authoritative geographic list',()=>{
 const java=fs.readFileSync(new URL('../../android-tv/app/src/main/java/top/monitorglobal/tv/TargetAreaNames.java',import.meta.url),'utf8');for(const [name]of TV_TARGET_AREAS)assert(java.includes(JSON.stringify(name)),name);assert.equal(TV_TARGET_AREAS.length,32);
});

test("overlapping watch areas retain every match so selecting one area cannot hide another",()=>{const matches=tvTargetAreas(168,-16.5,5.4,12);assert(matches.length>=2);assert(matches.some(n=>n.includes("Port Vila")));assert(matches.some(n=>n.includes("Luganville")));});

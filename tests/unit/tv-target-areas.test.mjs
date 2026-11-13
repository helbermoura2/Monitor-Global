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
 const java=fs.readFileSync(new URL('../../android-tv/app/src/main/java/top/monitorglobal/tv/TargetAreaNames.java',import.meta.url),'utf8');for(const [name]of TV_TARGET_AREAS)assert(java.includes(JSON.stringify(name)),name);assert.equal(TV_TARGET_AREAS.length,60);
 const displayed=[...java.matchAll(/"([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(displayed,TV_TARGET_AREAS.map(a=>a[0]));
});

test("overlapping watch areas retain every match so selecting one area cannot hide another",()=>{const matches=tvTargetAreas(168,-16.5,5.4,12);assert(matches.length>=2);assert(matches.some(n=>n.includes("Port Vila")));assert(matches.some(n=>n.includes("Luganville")));});

test('every added area has its own bounded M5 coverage without changing primary thresholds',()=>{
 const added=[["São Francisco · Estados Unidos",37.77,-122.42,180],["Los Angeles · Estados Unidos",34.05,-118.24,180],["Seattle / Vancouver · Estados Unidos e Canadá",48.45,-122.8,210],["Anchorage · Alasca",61.22,-149.9,200],["Atenas · Grécia",37.98,23.73,200],["Creta · Grécia",35.24,24.9,180],["Itália central",42.75,13,180],["Sicília / Calábria · Itália",38.5,15.5,210],["Guatemala / San Salvador · América Central",14.15,-89.85,190],["Manágua / San José · Nicarágua e Costa Rica",11.07,-85.16,220],["Santo Domingo · República Dominicana",18.49,-69.93,180],["San Juan · Porto Rico",18.47,-66.11,180],["Guayaquil · Equador",-2.17,-79.92,200],["Iquique / Antofagasta · Chile",-22.01,-70.14,220],["Sendai · Japão",38.27,140.87,200],["Sapporo / Hokkaido · Japão",42.9,142.2,220],["Chengdu / Sichuan · China",30.67,104.07,230],["Kunming / Yunnan · China",25.04,102.71,220],["Port Moresby · Papua-Nova Guiné",-9.48,147.15,180],["Lae · Papua-Nova Guiné",-6.73,147,200],["Rabaul / Kokopo · Papua-Nova Guiné",-4.25,152.2,200],["Honiara · Ilhas Salomão",-9.43,159.95,200],["Nuku'alofa · Tonga",-21.14,-175.2,220],["Lisboa · Portugal",38.72,-9.14,180],["São Miguel / Terceira · Açores",38.15,-26.5,200],["Faial / Flores · Açores",39,-30,180],["Marrakech / Agadir · Marrocos",31,-8.8,180],["Argel · Argélia",36.75,3.06,180]];
 for(const [name,lat,lon,radius]of added){
  assert(tvTargetAreas(lon,lat,5,70).includes(name),name);
  assert(!tvTargetAreas(lon,lat,4.999,12).includes(name));
  assert(!tvTargetAreas(lon,lat,6,12).includes(name));
  assert(!tvTargetAreas(lon,lat,5.9,70.01).includes(name));
  assert(radius>=160&&radius<=230);
  const delta=(radius+20)/111.195;
  assert(!tvTargetAreas(lon,lat+delta,5.4,12).includes(name),name+' outside circle');
 }
 assert.equal(new Set(TV_TARGET_AREAS.map(a=>a[0])).size,TV_TARGET_AREAS.length);
});
test('combined city labels include both named cities; western Pacific and Azores coordinates use the correct longitude',()=>{
 for(const [lat,lon,expected]of [
 [47.61,-122.33,'Seattle'],[49.28,-123.12,'Seattle'],[14.63,-90.51,'Guatemala'],[13.69,-89.19,'Guatemala'],
 [12.14,-86.25,'Manágua'],[9.93,-84.08,'Manágua'],[-20.21,-70.15,'Iquique'],[-23.65,-70.4,'Iquique'],
 [37.5,15.09,'Sicília'],[38.11,15.65,'Sicília'],[37.74,-25.67,'São Miguel'],[38.65,-27.22,'São Miguel'],
 [38.53,-28.63,'Faial'],[39.45,-31.13,'Faial'],[-21.14,-175.2,"Nuku'alofa"]
 ])assert(tvTargetAreas(lon,lat,5.4,12).some(name=>name.includes(expected)),expected);
});

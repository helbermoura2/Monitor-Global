import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const scope={module:{exports:{}},URLSearchParams};
runInNewContext(readFileSync(new URL('../../android-mobile/app/src/main/assets/phone-brazil-model.js',import.meta.url),'utf8'),scope);
const M=scope.module.exports;
const now=Date.parse('2026-11-08T12:30:00Z');
function valid(){
 const times=Array.from({length:72},(_,i)=>new Date(Date.parse('2026-11-08T00:00:00Z')+i*3600000).toISOString().slice(0,16));
 return M.PLACES.map(p=>({latitude:p.lat,longitude:p.lon,timezone:'America/Sao_Paulo',hourly:{time:times,
  temperature_2m:Array(72).fill(24),wind_speed_10m:Array(72).fill(18),wind_direction_10m:Array(72).fill(90),
  precipitation:Array(72).fill(.2),pressure_msl:Array(72).fill(1012)}}));
}
test('one multi-point request for Brazilian locations, no credentials or Worker',()=>{
 const url=new URL(M.url());
 assert.equal(url.hostname,'api.open-meteo.com');
 assert.equal(url.pathname,'/v1/forecast');
 assert.equal(url.searchParams.get('latitude').split(',').length,M.PLACES.length);
 assert.equal(url.searchParams.get('timezone'),'America/Sao_Paulo');
 assert.equal(url.searchParams.has('apikey'),false);
});
test('validated forecast provides hourly values without interpolating missing grid data',()=>{
 const rows=valid(),result=M.parse(rows,now);
 assert.ok(result);
 assert.equal(result.first,9);
 assert.equal(M.value(result,13,0,'temperature_2m'),24);
 assert.equal(M.value(result,13,8,'wind_speed_10m'),18);
 assert.equal(M.value(result,13,9,'wind_speed_10m'),null);
 assert.equal(M.value(result,13,0,'unknown'),null);
});
test('invalid location, time, source, values and coverage are rejected',()=>{
 let rows=valid();rows[0].latitude=50;assert.equal(M.parse(rows,now),null);
 rows=valid();rows[0].timezone='UTC';assert.equal(M.parse(rows,now),null);
 rows=valid();rows[0].hourly.precipitation[4]=null;assert.equal(M.parse(rows,now),null);
 rows=valid();rows[0].hourly.time[1]=rows[0].hourly.time[0];assert.equal(M.parse(rows,now),null);
 rows=valid();rows[1].hourly.wind_direction_10m[8]=400;assert.equal(M.parse(rows,now),null);
 rows=valid().slice(1);assert.equal(M.parse(rows,now),null);
});


test('Campinas and all IBGE-listed municipalities can be selected offline and forecast individually',()=>{
 const cities=JSON.parse(readFileSync(new URL('../../assets/weather/br-municipalities.json',import.meta.url),'utf8'));
 assert.ok(cities.length>5500);
 const c=cities.find(row=>row[1]==='Campinas'&&row[2]==='SP');
 assert.ok(c);
 const place={id:c[0],name:c[1],uf:c[2],lon:c[3],lat:c[4]};
 const response=valid()[0];response.latitude=place.lat;response.longitude=place.lon;
 const parsed=M.parse(response,now,[place]);
 assert.ok(parsed);
 assert.equal(parsed.places[0].name,'Campinas');
 assert.equal(M.value(parsed,0,0,'temperature_2m'),24);
 assert.equal(new URL(M.url([place])).searchParams.get('latitude'),String(place.lat));
 assert.equal(new URL(M.url([place])).searchParams.get('longitude'),String(place.lon));
 assert.equal(M.parse({...response,latitude:0},now,[place]),null);
});


test('weather map keeps stale and partial lightning distinct from a fresh zero',()=>{
 const require=createRequire(import.meta.url);
 const severe=require('../../android-mobile/app/src/main/assets/phone-severe-weather.js');
 const now=1795360860000,packet={version:1,source:'NOAA GOES-19 GLM',start:now-900000,end:now,
  resolution:.25,files:44,expected:45,cells:[[-46.625,-23.625,15]]};
 assert.equal(severe.lightning(packet,now).collection.features[0].properties.count,15);
 assert.equal(severe.lightning(packet,now).partial,true);
 assert.equal(severe.lightning({...packet,files:45,cells:[]},now).collection.features.length,0);
 assert.equal(severe.lightning(packet,now+36*60000),null);
 assert.equal(severe.lightning({...packet,files:10},now),null);
 const notices=severe.notices({version:1,source:'https://painelalertas.cemaden.gov.br/wsAlertas2',checkedAt:now,
  alerts:[{status:1,lng:-46.6,lat:-23.5,city:'São Paulo',uf:'SP',level:'Alto',event:'Risco hidrológico'},
   {status:0,lng:-46.6,lat:-23.5,city:'São Paulo',uf:'SP',event:'Encerrado'}]},now);
 assert.equal(notices.collection.features.length,1);
 assert.equal(notices.collection.features[0].properties.severity,2);
});


test('storm evidence needs multiple pixels of calibrated radar echo',()=>{
 const require=createRequire(import.meta.url);
 const storms=require('../../android-mobile/app/src/main/assets/phone-storm-signals.js');
 assert.equal(storms.reflectivity(255,68,0,255),45);
 assert.equal(storms.reflectivity(255,68,0,120),null);
 const rgba=new Uint8Array(400);
 for(let i=0;i<4;i++)rgba.set([255,68,0,255],4*i);
 assert.equal(storms.peak(rgba,10,10,5,5),null);
 rgba.set([255,68,0,255],16);
 assert.equal(storms.peak(rgba,10,10,5,5),45);
});

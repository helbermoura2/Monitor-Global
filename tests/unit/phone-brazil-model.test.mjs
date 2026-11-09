import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const scope={module:{exports:{}}};
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

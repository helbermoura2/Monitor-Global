import assert from 'node:assert/strict';
import {handleWeatherObservations} from '../../weather-observations-worker.mjs';
const url=new URL('https://worker/metar-observed?ids=SBSP,SBGR');
const r=await handleWeatherObservations(url,async()=>Response.json([{icaoId:'SBSP',rawOb:'METAR SBSP CAVOK',obsTime:123,lat:-23.62,lon:-46.65},{icaoId:'XXXX',rawOb:'invalid',obsTime:123,lat:0,lon:0}]));
const d=await r.json();assert.equal(d.stations.length,1);assert.equal(d.stations[0].updatedAt,123000);assert.equal(r.headers.get('access-control-allow-origin'),'*');
assert.equal((await handleWeatherObservations(new URL('https://worker/metar-observed?ids=https://evil'),()=>{throw Error('Must not fetch')})).status,400);
assert.equal((await handleWeatherObservations(url,async()=>new Response('',{status:503}))).status,502);
console.log('PASS: public METAR backup, station allowlist, true observation timestamp, CORS and upstream failure');

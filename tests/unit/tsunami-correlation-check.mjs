import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let code=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');code=code.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now=Date.now(),origin=now-3600000;
const product={eventDir:'/events/PHEB/2026/10/09/quake/2/WEPA40/',bulletinIssueTime:new Date(now).toISOString(),originTime:new Date(origin).toISOString(),eventLat:7.54,eventLon:-80.75,eventMagnitude:7.6,twcEventID:'quake',bulletinNr:'2',alerts:{areaList:[[{zone:'Panama',category:'1-3 meters'}]]}};
const saved=globalThis.fetch;
globalThis.fetch=async url=>{url=String(url);if(url.endsWith('PHEBWEPA40.js'))return new Response('var PHEBWEPA40 = '+JSON.stringify(product));if(url.endsWith('.js'))return new Response('var product = '+JSON.stringify({...product,alerts:{areaList:[]}}));if(url.endsWith('Atom.xml'))return new Response('<feed></feed>');return Response.json({});};
try{
 const request=async time=>{const u=new URL('https://worker.test/correlate?mag=7.7&depth=13&lat=7.54&lon=-80.75');if(time!==null)u.searchParams.set('time',time);return (await worker.fetch(new Request(u),{})).json();};
 const yes=await request(origin);assert.equal(yes.tsunami.level,'ALERTA OFICIAL');assert.equal(yes.tsunami.officialAlerts.length,1);
 for(const time of [origin-17*3600000,null]){const no=await request(time);assert.equal(no.tsunami.officialAlerts.length,0);assert.notEqual(no.tsunami.level,'ALERTA OFICIAL');}
 console.log('PASS: backend correlation checks the earthquake origin time and never assigns an official warning to an older quake at the same coordinates');
}finally{globalThis.fetch=saved;}

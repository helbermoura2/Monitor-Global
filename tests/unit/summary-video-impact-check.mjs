import assert from 'node:assert/strict';
import {officialVideoMetadata,emscEventId,emscMechanism,fetchEmscMechanism} from '../../tools/summary-video-impact.mjs';
const event={id:'us-example',lat:35,lon:140,mag:6,time:1790857631864,depth:10};
const detail=products=>({geometry:{coordinates:[140,35,10]},properties:{time:event.time,mag:6,products}});
for(const [rake,label]of [[90,'Inversa'],[-90,'Normal'],[0,'Transcorrente'],[180,'Transcorrente']]){
 const out=officialVideoMetadata(event,detail({'moment-tensor':[{status:'UPDATE',preferredWeight:1,properties:{'nodal-plane-1-rake':rake}}]}));assert.equal(out.mechanism.label,label);assert.equal(out.exposure.status,'unavailable');assert.equal(out.reports,null);
}
for(const rake of [null,'',NaN,190,'unknown'])assert.equal(officialVideoMetadata(event,detail({'moment-tensor':[{properties:{'nodal-plane-1-rake':rake}}]})).mechanism,null);
const preferred=officialVideoMetadata(event,detail({'moment-tensor':[{status:'DELETE',preferredWeight:99,properties:{'nodal-plane-1-rake':90}},{preferredWeight:2,properties:{'nodal-plane-1-rake':-90}},{preferredWeight:1,properties:{'nodal-plane-1-rake':0}}],dyfi:[{properties:{'num-responses':'25'}}]}));assert.equal(preferred.mechanism.label,'Normal');assert.equal(preferred.reports,25);assert.equal(preferred.exposure.status,'unavailable');
for(const bad of [{...detail({}),geometry:{coordinates:[-70,-30]}},{...detail({}),geometry:{coordinates:[NaN,35]}},{geometry:detail({}).geometry,properties:{...detail({}).properties,time:event.time+3600000,products:{dyfi:[{properties:{'num-responses':25}}]}}}])assert.equal(officialVideoMetadata(event,bad).reports,null);
assert.equal(officialVideoMetadata(event,detail({dyfi:[{properties:{'num-responses':0}}]})).reports,0);
assert.equal(officialVideoMetadata(event,detail({})).mechanism,null,'Location and depth cannot establish focal mechanism');
console.log('PASS: video mechanism from valid official rake only, preferred/nondeleted products, identity checks, reports distinct from population and missing data preserved');
const unid='20261001_0000001';
const origin={id:unid,properties:{unid,lat:event.lat,lon:event.lon,time:new Date(event.time).toISOString(),mag:event.mag}};
assert.equal(emscEventId(event,{features:[origin]}),unid);
assert.equal(emscEventId(event,{features:[origin,{...origin,id:'20261001_0000002',properties:{...origin.properties,unid:'20261001_0000002'}}]}),null,'Ambiguous nearby earthquakes must not be associated');
assert.equal(emscEventId(event,{features:[{...origin,properties:{...origin.properties,time:new Date(event.time+60000).toISOString()}}]}),null);
const solution={ev_unid:unid,ev_latitude:35,ev_longitude:140,ev_event_time:new Date(event.time).toISOString().replace('T',' ').replace('Z',' UTC'),ev_mag_value:6,mt_source_catalog:'GFZ',mt_rake_1:90,mt_preferred:true};
assert.equal(emscMechanism(event,unid,[{...solution,mt_preferred:false,mt_rake_1:0},solution]).provider,'GFZ via EMSC');
assert.equal(emscMechanism(event,unid,[solution]).label,'Inversa');
for(const change of [{ev_unid:'20261001_0000002'},{ev_longitude:-70},{ev_event_time:'bad'},{mt_rake_1:null},{mt_rake_1:181},{mt_source_catalog:null}])assert.equal(emscMechanism(event,unid,[{...solution,...change}]),null);
assert.equal(emscMechanism(event,unid,{}),null);
let urls=[];
assert.equal((await fetchEmscMechanism(event,async url=>{urls.push(url);return JSON.stringify(url.includes('/mtws/')?[solution]:{features:[origin]});})).provider,'GFZ via EMSC');
assert.equal(new URL(urls[1]).searchParams.get('eventid'),unid);
assert.equal(await fetchEmscMechanism(event,async()=>{throw new Error('offline');}),null);
assert.equal(await fetchEmscMechanism(event,async url=>JSON.stringify(url.includes('/mtws/')?{}:{features:[origin]})),null);
console.log('PASS: EMSC exact UNID, origin validation, ambiguity rejection, preferred solution, source attribution, empty and failed responses');

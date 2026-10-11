import assert from 'node:assert/strict';
import {officialVideoMetadata} from '../../tools/summary-video-impact.mjs';
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

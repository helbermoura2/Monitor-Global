import test from 'node:test';
import assert from 'node:assert/strict';
import {regionBounds,describeRadar} from '../../android-mobile/app/src/main/assets/inpe-radar-panel-model.mjs';
test('regional queries work nationally, bounded to map centre',()=>{
 assert.deepEqual(regionBounds({lon:-46.6,lat:-23.5}),[-50,-26,-44,-20]);
 for(const center of [{lon:-60,lat:-3},{lon:-38,lat:-13},{lon:-56,lat:-16},{lon:-51,lat:-30}]){
  const b=regionBounds(center);assert.ok(b&&b[2]-b[0]<=6&&b[3]-b[1]<=6);
 }
 assert.equal(regionBounds({lon:0,lat:0}),null);
});
test('latest frame determines available products, never invents altitudes',()=>{
 const r=describeRadar({radar:'manaus',owner:'sipam',frames:[{time:1,products:{cappi15l:true}},{time:2,products:{thumbnail:true}}]});
 assert.deepEqual(r.products,['Imagem PNG']);assert.equal(r.time,2);
});

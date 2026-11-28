import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../../android-mobile/app/src/main/assets/phone-goes-model.js');
const now=Date.parse('2026-11-28T10:50:00Z');
test('only validated GIBS products use actual matrix and safe URLs',()=>{
 for(const [key,layer,matrix] of [['ir','GOES-East_ABI_Band13_Clean_Infrared','GoogleMapsCompatible_Level6'],['color','GOES-East_ABI_GeoColor','GoogleMapsCompatible_Level7'],['air','GOES-East_ABI_Air_Mass','GoogleMapsCompatible_Level6']]){
  const domain=new URL(M.domainUrl(now,key)),image=new URL(M.imageUrl(now,key));
  assert.equal(domain.searchParams.get('LAYER'),layer);assert.equal(domain.searchParams.get('TILEMATRIXSET'),matrix);
  assert.equal(image.searchParams.get('LAYERS'),layer);assert.equal(image.searchParams.get('SRS'),'EPSG:3857');
 }
 assert.throws(()=>M.domainUrl(now,'unknown'));assert.throws(()=>M.imageUrl(now,'__proto__'));
});

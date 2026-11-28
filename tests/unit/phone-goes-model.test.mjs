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

test('vapor catalog accepts only recent real INPE assets and expected bands',()=>{
 const href='https://data.inpe.br/bdc/data/GOES19-L2-CMI/ch08/2026/11/S10161308_202611281040.nc';
 const item={collection:'GOES19-L2-CMI-1',properties:{datetime:new Date(now-600000).toISOString()},assets:{B08:{type:'application/x-netcdf',href}}};
 assert.deepEqual(M.vaporFrames({features:[item]},'b08',now),[[now-600000,href]]);
 assert.deepEqual(M.vaporFrames({features:[{...item,properties:{datetime:new Date(now-91*60000).toISOString()}}]},'b08',now),[]);
 assert.deepEqual(M.vaporFrames({features:[{...item,assets:{B08:{type:'application/x-netcdf',href:href.replace('ch08','ch09')}}}]},'b08',now),[]);
 assert.throws(()=>M.imageUrl(now,'b08'));
 const q=new URL(M.vaporUrl(now));assert.equal(q.searchParams.get('collections'),'GOES19-L2-CMI-1');
 const temp=new Float32Array(90000).fill(-40),quality=new Uint8Array(90000);temp[1]=NaN;quality[2]=2;
 const pixels=M.vaporRGBA(temp,quality);assert.equal(pixels.length,360000);assert.equal(pixels[3],255);assert.equal(pixels[7],0);assert.equal(pixels[11],0);
});

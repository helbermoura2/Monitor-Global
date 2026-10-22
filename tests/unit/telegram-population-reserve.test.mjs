import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {decodeLocalities,calculateLocalityExposure} from '../../locality-exposure.mjs';
import {validImageExposure,exposureQuality,exposureVersionQuality} from '../../seismic-image-data.mjs';
import {imageRefreshInterval,imageRefreshDue,selectImageRefreshes} from '../../telegram-image-refresh.mjs';
const binary=rows=>{const b=new ArrayBuffer(16+rows.length*16),v=new DataView(b);new Uint8Array(b,0,4).set([77,71,80,49]);v.setUint32(4,rows.length,true);v.setUint32(8,16,true);v.setUint32(12,1,true);rows.sort((a,b)=>a[1]-b[1]).forEach((p,i)=>{const o=16+i*16;v.setUint32(o,p[0],true);v.setFloat32(o+4,p[1],true);v.setFloat32(o+8,p[2],true);v.setUint32(o+12,p[3],true);});return b;};
const quake={lat:0,lon:0,mag:6,depth:10};
test('registered locality populations use physical ranges; no matched towns is unknown, not zero',()=>{
 const c=decodeLocalities(binary([[1,0,0,1000],[2,0,.5,2000],[3,0,2,3000],[4,0,10,4000]])),r=calculateLocalityExposure(quake,c);
 assert.deepEqual(r.ranges.map(r=>r.population),[6000,3000,1000]);assert.equal(r.partial,true);assert.equal(validImageExposure(r),true);
 const partial=calculateLocalityExposure(quake,decodeLocalities(binary([[2,0,.5,2000]])));assert.equal(partial.ranges[2].population,null);assert(validImageExposure(partial));
 assert.equal(calculateLocalityExposure(quake,decodeLocalities(binary([[4,0,10,4000]]))),null);assert.equal(calculateLocalityExposure({...quake,depth:100},c),null);
});
test('official grid selects actual published intensity and does not extrapolate beyond coverage',()=>{
 const c=decodeLocalities(binary([[1,0,0,1000],[2,1,1,2000],[3,2,2,900000]]));const shaking={version:'qa',grid:{nx:2,ny:2,x0:0,x1:1,y0:0,y1:1,values:[3,5,7,8]}};
 assert.deepEqual(calculateLocalityExposure({...quake,shaking},c).ranges.map(r=>r.population),[3000,2000,2000]);
 assert.equal(calculateLocalityExposure({...quake,shaking:{...shaking,grid:{...shaking.grid,values:[null,5,7,8]}}},c),null);
});
test('dateline locality is included by geodesic distance; corrupt binary cannot produce a population',()=>{
 const r=calculateLocalityExposure({...quake,lon:179.9},decodeLocalities(binary([[1,0,-179.9,1000]])));assert.equal(r.ranges[0].population,1000);
 const b=binary([[1,0,0,1000]]);new DataView(b).setUint32(4,9999,true);assert.throws(()=>decodeLocalities(b));
});
test('real pinned reserve covers Panama and has bounded compact storage',()=>{
 const b=fs.readFileSync(new URL('../../assets/population/geonames-localities-v1.bin',import.meta.url));assert(b.length<3000000);const c=decodeLocalities(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert(c.count>170000);
 const r=calculateLocalityExposure({lat:7.7,lon:-81.5,mag:6.1,depth:10},c);assert(r.ranges[0].localities>500);assert(r.ranges[0].population>3000000);assert(r.ranges[0].population<4000000);assert.equal(exposureQuality(r),1);assert.equal(exposureVersionQuality('["pager",false,[1,1,1]]'),3);
});
test('M5.5+ images are eligible after one minute in first hour and five minutes later; fair queue and text exclusions',()=>{
 const now=Date.now(),photo=(id,age,checked)=>({id,mag:5.5,timeIso:new Date(now-age).toISOString(),imageShakingCheckedAt:now-checked,imageExposureCheckedAt:now-checked,imageExposureVersion:'unavailable',cardImageVersion:'cartographic-v12-context',delivery:'sent',messageType:'photo',messageId:1});
 assert.equal(imageRefreshInterval(photo('a',3599999,60000),now),60000);assert.equal(imageRefreshInterval(photo('b',3600000,60000),now),300000);
 assert.equal(imageRefreshDue(photo('a',120000,59999),now),false);assert.equal(imageRefreshDue(photo('a',120000,60000),now),true);assert.equal(imageRefreshDue(photo('b',3600000,60000),now),false);
 assert.equal(imageRefreshDue({...photo('a',120000,60000),messageType:'text'},now),false);assert.equal(imageRefreshDue(photo('old',86400000,600000),now),false);
 const records=[photo('new1',120000,60000),photo('new2',120000,70000),photo('late',7200000,900000),photo('new3',120000,80000)];assert.equal(selectImageRefreshes(records,now)[0].id,'late');assert.equal(selectImageRefreshes(records,now).length,3);
});
test('image lookup supplies a cached locality reserve when WorldPop is offline',async()=>{
 const {queryImageExposure}=await import('../../seismic-image-data.mjs');const before=globalThis.fetch;let catalogs=0;
 globalThis.fetch=async input=>{const url=new URL(input);if(url.hostname==='monitorglobal.top'&&url.pathname.endsWith('.bin')){catalogs++;return new Response(fs.readFileSync(new URL('../../assets/population/geonames-localities-v1.bin',import.meta.url)));}if(url.hostname==='api.worldpop.org')return new Response('Offline',{status:503});throw Error('Unexpected source '+url.hostname);};
 try{const ev={lat:7.7,lon:-81.5,mag:6.1,depth:10,provider:'EMSC',id:'reserve-integration',timeIso:new Date().toISOString()};const result=await queryImageExposure(ev);assert.equal(result.method,'geonames-localities');assert.equal(result.upstreamStatus,'unavailable');assert(validImageExposure(result));assert.equal(catalogs,1);assert(validImageExposure(await queryImageExposure({...ev,mag:6.2})));assert.equal(catalogs,1);}finally{globalThis.fetch=before;}
});

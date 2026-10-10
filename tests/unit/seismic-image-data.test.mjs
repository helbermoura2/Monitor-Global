import test from 'node:test';import assert from 'node:assert/strict';import {imageMapFrame,imageProject,paintImageIntensity,validImageExposure} from '../../seismic-image-data.mjs';
test('epicenter matches top map anchor at every longitude and latitude',()=>{
 for(const [lat,lon,mag] of [[7.54,-80.75,8],[-15.48,168.18,6.6],[70,179.7,7],[0,-179.5,2]]){
  const f=imageMapFrame({lat,lon,mag,depth:33},800,1440),[x,y]=imageProject(f,lon,lat);assert.ok(Math.abs(x-400)<1e-8);assert.ok(Math.abs(y-550)<1e-8);assert.notEqual(y,720);
 }
});
test('intensity painting respects land and holes, leaves ocean pixels unchanged',()=>{
 const f={width:80,height:80,minLon:-.1,maxLon:.1,minLat:-.1,maxLat:.1};
 const outer=[[-.05,-.05],[.05,-.05],[.05,.05],[-.05,.05],[-.05,-.05]],hole=[[-.02,-.02],[.02,-.02],[.02,.02],[-.02,.02],[-.02,-.02]];
 const pixels=new Uint8Array(80*80*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=10;pixels[i+1]=20;pixels[i+2]=30;pixels[i+3]=255;}
 assert.ok(paintImageIntensity(pixels,f,{lat:0,lon:0,mag:8,depth:10},[[outer,hole]])>0);
 const rgb=(x,y)=>[...pixels.slice((y*80+x)*4,(y*80+x)*4+3)];assert.deepEqual(rgb(0,0),[10,20,30]);assert.deepEqual(rgb(40,40),[10,20,30]);assert.ok(rgb(24,40)[0]>rgb(24,40)[1]);
});
test('population zero is valid but missing, negative and overlapping inconsistent totals are rejected',()=>{
 const data={status:'available',method:'pager',ranges:[{population:100},{population:10},{population:0}]};assert.equal(validImageExposure(data),true);
 for(const value of [null,undefined,NaN,-1,200])assert.equal(validImageExposure({...data,ranges:[data.ranges[0],{population:value},data.ranges[2]]}),false);
});
test('scale bar uses exported bbox pixels, rather than unrelated 256px tile scale',async()=>{
 const {imageMetersPerPixel}=await import('../../seismic-image-data.mjs');const f={width:800,minLon:-1,maxLon:1};assert.ok(Math.abs(imageMetersPerPixel(f,0)-6371000*Math.PI/180*2/800)<1e-6);assert.ok(imageMetersPerPixel(f,60)<imageMetersPerPixel(f,0)*.501);
});

test('share map brings epicenter close to the gauge while preserving its true location',()=>{const f=imageMapFrame({lat:7.72,lon:-81.47,mag:6.6,depth:10},800,1440);assert.equal(f.anchorY,550);assert.ok(f.zoom>=6);const [x,y]=imageProject(f,-81.47,7.72);assert.equal(x,400);assert.ok(Math.abs(y-550)<1e-8);});
test('offscreen land scanlines never spill into ocean pixels through negative array indices',()=>{
 const f={width:80,height:80,minLon:-.1,maxLon:.1,minLat:-.1,maxLat:.1};
 const farWest=[[-40,-.1],[-30,-.1],[-30,.1],[-40,.1],[-40,-.1]];
 const pixels=new Uint8Array(80*80*4).fill(90),before=pixels.slice();
 assert.equal(paintImageIntensity(pixels,f,{lat:0,lon:0,mag:8,depth:10},[[farWest]]),0);
 assert.deepEqual(pixels,before);
});

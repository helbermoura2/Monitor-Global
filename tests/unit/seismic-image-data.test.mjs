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
 const ev={lat:0,lon:0,mag:8,depth:10,shaking:{grid:{nx:2,ny:2,x0:-.1,x1:.1,y0:-.1,y1:.1,values:[3,9,3,9]}}};
 assert.ok(paintImageIntensity(pixels,f,ev,[[outer,hole]])>0);
 const rgb=(x,y)=>[...pixels.slice((y*80+x)*4,(y*80+x)*4+3)];assert.deepEqual(rgb(0,0),[10,20,30]);assert.deepEqual(rgb(40,40),[10,20,30]);assert.notDeepEqual(rgb(26,40),[10,20,30]);
 assert.deepEqual(rgb(22,40),[10,20,30],'Interior satellite pixels stay untouched');
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

test('Telegram overlay paints a shallow M3.4 instead of rejecting magnitudes below five',async()=>{
 const {overlayImageIntensity}=await import('../../seismic-image-data.mjs');
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({features:[{geometry:{type:'Polygon',coordinates:[[[-48,-21],[-47,-21],[-47,-20],[-48,-20],[-48,-21]]]}}]}));
 try{const ev={lat:-20.71,lon:-47.66,mag:3.4,depth:4},frame=imageMapFrame(ev),pixels=new Uint8Array(frame.width*frame.height*4).fill(90);
 assert.equal(await overlayImageIntensity(pixels,frame,ev),true);
 assert.ok(frame.zoom>7,'Small events need a closer view of their actual estimated footprint');
 assert.equal(await overlayImageIntensity(pixels,frame,{...ev,mag:null}),false);
 }finally{globalThis.fetch=original;}
});
test('official pixel intensity varies by the published grid, not distance; no extrapolation into NoData',()=>{
 const frame={width:80,height:80,minLon:-1,maxLon:1,minLat:-1,maxLat:1};
 const land=[[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]];
 const grid={nx:3,ny:3,x0:-1,x1:1,y0:-1,y1:1,values:[3,5,8,3,5,8,3,5,8]};
 const ev={mag:6,depth:10,lat:0,lon:0,shaking:{status:'available',method:'usgs-shakemap-grid',grid}};
 const pixels=new Uint8Array(80*80*4).fill(90);
 paintImageIntensity(pixels,frame,ev,land);
 const rgb=(x,y)=>[...pixels.slice((y*80+x)*4,(y*80+x)*4+3)];
 assert.notDeepEqual(rgb(20,40),rgb(60,40),'Equidistant points must retain differing official intensities');
 const missing=new Uint8Array(80*80*4).fill(90);
 paintImageIntensity(missing,frame,{...ev,shaking:{...ev.shaking,grid:{...grid,values:Array(9).fill(null)}}},land);
 assert(missing.every(v=>v===90),'NoData must not be filled with the radial estimate');
 const outside=new Uint8Array(80*80*4).fill(90);
 paintImageIntensity(outside,{...frame,minLon:2,maxLon:4},ev,[[[[2,-1],[4,-1],[4,1],[2,1],[2,-1]]]]);
 assert(outside.every(v=>v===90),'Do not invent intensity outside the official grid');
});
test('official camera retains epicenter anchor and covers non-circular strong footprint',()=>{
 const grid={nx:3,ny:3,x0:-82,x1:-79,y0:7,y1:9,values:[3,4,7,3,4,7,3,4,7]};
 const event={lat:7.6,lon:-81,mag:6,depth:10,shaking:{status:'available',grid}};
 const frame=imageMapFrame(event),point=imageProject(frame,event.lon,event.lat);
 assert.deepEqual(point.map(Math.round),[400,550]);
 assert(frame.minLon<=-81.5&&frame.maxLon>=-79&&frame.minLat<=7&&frame.maxLat>=9);
});
test('weak official grids below III still paint images, with blue tones and their actual extent',()=>{
 const grid={nx:3,ny:3,x0:-82,x1:-79,y0:7,y1:9,values:[1.6,2,2.5,1.6,2,2.5,1.6,2,2.5]};
 const event={mag:5.7,depth:269,lat:7.6,lon:-81,shaking:{status:'available',grid}};
 const frame={width:80,height:80,minLon:-82,maxLon:-79,minLat:7,maxLat:9};
 const pixels=new Uint8Array(80*80*4).fill(90),land=[[[[-82,7],[-79,7],[-79,9],[-82,9],[-82,7]]]];
 assert(paintImageIntensity(pixels,frame,event,land)>0);const i=(40*80+40)*4;assert(pixels[i+2]>pixels[i],'Weak published shaking remains blue');
 const f=imageMapFrame(event);assert(f.minLon<=grid.x0&&f.maxLon>=grid.x1&&f.minLat<=grid.y0&&f.maxLat>=grid.y1);
});

test('hollow contours change only narrow strokes and expose correctly named MMI levels',()=>{
 const frame={width:400,height:400,minLon:-2,maxLon:2,minLat:-2,maxLat:2},pixels=new Uint8Array(400*400*4).fill(90),labels=[];
 const land=[[[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]]]];
 assert(paintImageIntensity(pixels,frame,{lat:0,lon:0,mag:6,depth:10},land,labels)>0);
 let changed=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==90||pixels[i+1]!==90||pixels[i+2]!==90)changed++;
 assert(changed<400*400*.2,'At least 80% of map must remain completely unpainted');
 assert(labels.some(l=>l.level===5&&l.roman==='V'&&l.description==='Moderada'));
 assert(labels.every(l=>l.x>=0&&l.x<=800&&l.y>=0&&l.y<=820));
});
test('constant published intensity has no fabricated rings or grid-edge outline',()=>{
 const frame={width:80,height:80,minLon:-1,maxLon:1,minLat:-1,maxLat:1},pixels=new Uint8Array(80*80*4).fill(90);
 const ev={lat:0,lon:0,mag:7,depth:10,shaking:{grid:{nx:2,ny:2,x0:-.5,x1:.5,y0:-.5,y1:.5,values:[6,6,6,6]}}};
 assert.equal(paintImageIntensity(pixels,frame,ev,[[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]]),0);assert(pixels.every(v=>v===90));
});

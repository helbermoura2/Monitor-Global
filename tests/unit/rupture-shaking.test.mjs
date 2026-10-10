import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../../js/rupture-shaking-model.js';
import {handleRuptureShaking,hasFiniteRupture} from '../../rupture-shaking-worker.mjs';
const m=globalThis.RuptureShakingModel;
const coverage={type:'Coverage',domain:{axes:{x:{start:0,stop:2,num:3},y:{start:0,stop:2,num:3}},referencing:[{coordinates:['x','y'],system:{type:'GeographicCRS',id:'http://www.opengis.net/def/crs/OGC/1.3/CRS84'}}]},ranges:{MMI:{axisNames:['y','x'],shape:[3,3],values:[3,3,3,5,5,5,7,7,7]}}};
const finite={type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[0,0,0],[1,0,0],[1,1,10],[0,0,0]]]}}]};
test('geographic grid preserves axis order, samples and rejects projected/NoData values',()=>{
 const g=m.normalize(coverage);assert.equal(m.sample(g,1,0),3);assert.equal(m.sample(g,1,2),7);assert.equal(m.sample(g,1,1),5);assert.equal(m.sample(g,8,1),null);assert.equal(m.normalize({...coverage,domain:{...coverage.domain,referencing:[]}}),null);assert.equal(m.sample({...g,values:[null,...g.values.slice(1)]},0,0),null);assert.equal(m.valid({...g,nx:60001}),false);
});
test('only finite, closed and numeric rupture geometries qualify',()=>{assert(hasFiniteRupture(finite));assert.equal(hasFiniteRupture({type:'FeatureCollection',features:[{geometry:{type:'Point',coordinates:[0,0]}}]}),false);assert.equal(hasFiniteRupture({type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[1,0]]]}}]}),false);});
test('published intensity is clipped to land instead of using a magnitude-oriented ellipse',()=>{
 const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('js/vendor/polygon-clipping.min.js','utf8'),sandbox);globalThis.polygonClipping=sandbox.polygonClipping;
 const g=m.normalize(coverage),land=[[[[0,0],[1,0],[1,2],[0,2],[0,0]]]],features=[...m.bands({shaking:{grid:g}},land)];assert.equal(features.length,3);for(const f of features){assert.equal(f.properties.official,true);for(const p of f.geometry.coordinates)for(const r of p)for(const [x,y] of r){assert(x>=0&&x<=1);assert(y>=0&&y<=2);}}assert.equal(features.at(-1).properties.mmi,7);
});
test('official endpoint matches origins, rejects point sources and does not fetch arbitrary hosts',async()=>{
 const oldFetch=globalThis.fetch,time=Date.now()-3600000;let mode='finite',calls=0;
 globalThis.fetch=async input=>{calls++;const u=new URL(input);assert.equal(u.hostname,'earthquake.usgs.gov');let d;if(u.pathname.includes('/query'))d={id:'us-test',geometry:{coordinates:[1,1]},properties:{time:mode==='wrong'?time-3600000:time,mag:6,products:{shakemap:[{preferredWeight:2,code:'qa',updateTime:1,contents:{'download/rupture.json':{url:'https://earthquake.usgs.gov/rupture.json'},'download/coverage_mmi_low_res.covjson':{url:mode==='host'?'https://example.com/grid.json':'https://earthquake.usgs.gov/grid.json'}}}]}}};else if(u.pathname==='/rupture.json')d=mode==='point'?{type:'FeatureCollection',features:[{geometry:{type:'Point',coordinates:[1,1]}}]}:finite;else d=coverage;return new Response(JSON.stringify(d));};
 try{for(const state of ['finite','wrong','point','host']){mode=state;const r=await handleRuptureShaking(new Request('https://local/rupture-shaking?lat=1&lng=1&mag=6&time='+time+'&eventId=us-'+state));const d=await r.json();assert.equal(d.status,state==='finite'?'available':'unavailable');}const n=calls;assert.equal((await handleRuptureShaking(new Request('https://local/rupture-shaking?lat=NaN'))).status,400);assert.equal(calls,n);}finally{globalThis.fetch=oldFetch;}
});

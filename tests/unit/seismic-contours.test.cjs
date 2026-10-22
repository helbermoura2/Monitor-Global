const {test}=require('node:test'),assert=require('node:assert/strict');
require('../../js/seismic-impact-model.js');require('../../js/rupture-shaking-model.js');
const {contours}=require('../../js/seismic-contours-model.js');
const land=[[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]];
const q={lng:93.71,lat:32.34,mag:7,depth:18};
test('hollow radial MMI lines carry the correct thresholds and no filled geometry',()=>{
 const r=contours(q,land);assert.ok(r.features.length>=7);
 for(const f of r.features){assert.equal(f.geometry.type,'MultiLineString');assert.ok(Math.abs(SeismicImpactModel.pga(q.mag,q.depth,f.properties.distanceKm)-[0,.5,1,2.1,5,11,26,60,140,321.8,740,1702,3000][f.properties.mmi])<.001);assert.ok(f.properties.roman);assert.ok(f.properties.description);}
 assert.equal(r.features.find(f=>f.properties.mmi===7).properties.description,'Muito forte');
});
test('official uniform grids and missing cells never fabricate outline contours',()=>{
 const grid={nx:3,ny:3,x0:92,x1:94,y0:31,y1:33,values:Array(9).fill(6)};
 assert.equal(contours({...q,shaking:{grid}},land).features.length,0);
 grid.values=[2,4,6,null,null,null,2,4,6];assert.equal(contours({...q,shaking:{grid}},land).features.length,0);
});
test('official isolines follow the published field instead of radial circles',()=>{
 const grid={nx:3,ny:3,x0:92,x1:94,y0:31,y1:33,values:[2,4,6,2,4,6,2,4,6]};
 const r=contours({...q,shaking:{grid}},land),four=r.features.find(f=>f.properties.mmi===4);assert.ok(four);for(const line of four.geometry.coordinates)for(const p of line)assert.equal(p[0],93);
 assert.ok(r.features.every(f=>f.properties.official));assert.deepEqual(contours({...q,shaking:{status:'rupture-only'}},land).features,[]);
});
test('no land invents neither contours nor coast outlines; date-line segments stay short',()=>{
 assert.equal(contours(q,[]).features.length,0);const r=contours({...q,lng:179.9,lat:0},land);for(const f of r.features)for(const [a,b] of f.geometry.coordinates)assert.ok(Math.abs(a[0]-b[0])<180);
});

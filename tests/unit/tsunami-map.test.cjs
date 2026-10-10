const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../../js/tsunami-map-model.js');
const regions=JSON.parse(fs.readFileSync('assets/tsunami/ne-50m-coastal-regions.geojson'));
test('only published names map to coastal references, never the epicentre country',()=>{
 const item={type:'tsunami',place:'Panama',coords:[-80.8,7.5],hazardNature:'warning',affectedAreas:[{name:'PANAMA',category:'1 TO 3 METERS'},{name:'PERU',category:'LESS THAN 0.3 METERS'},{name:'unknown island',category:'Warning'}]};
 const r=M.build(item,regions);assert.equal(r.data.features.length,2);assert.equal(r.data.features[0].properties.color,'#fb7148');assert.equal(r.data.features[1].properties.color,'#2dd4bf');assert.deepEqual(r.unmapped,['unknown island']);
 assert.equal(M.build({...item,affectedAreas:[]},regions).data.features.length,0);
 assert(r.data.features.every(f=>f.geometry.type==='MultiLineString'));
 const panama=r.data.features[0].geometry.coordinates.flat();assert(panama.some(([x,y])=>x<-81&&y<8));assert(panama.every(([x,y])=>x>-84&&x<-77&&y>7&&y<10));
});
test('information and cancellation do not inherit threat colors; strongest category wins per coast',()=>{
 const a={hazardNature:'warning',affectedAreas:[{name:'Panama',category:'LESS THAN 0.3 METERS'},{name:'Panamá',category:'1-3 meters'}]};assert.equal(M.build(a,regions).data.features.length,1);assert.equal(M.build(a,regions).data.features[0].properties.rank,4);
 assert.equal(M.build({...a,hazardNature:'bulletin'},regions).data.features[0].properties.color,'#38bdf8');assert.equal(M.build({...a,cancelled:true},regions).data.features[0].properties.color,'#94a3b8');
 const r=M.build({hazardNature:'bulletin',coverageAreas:[{name:'Alaska',category:'Information'},{name:'British Columbia',category:'Information'},{name:'Washington',category:'Information'},{name:'Guam',category:'Information'}]},regions);assert.equal(r.data.features.length,4);
});
test('official polygons preserve the published coordinates, without geocoding or radius inference',()=>{
 const geometry={type:'Polygon',coordinates:[[[-123,45],[-124,45],[-124,46],[-123,45]]]};const r=M.build({hazardNature:'warning',warningLevel:'Aviso',warningGeometry:geometry,place:'Costa'},regions);assert.deepEqual(r.data.features[0].geometry,geometry);assert.equal(r.data.features[0].properties.kind,'official');
});

test('amplitude bands keep decimal 0.3–1 separate from 3+ metres',()=>{assert.equal(M.category({category:'0.3 TO 1 METERS'},{hazardNature:'warning'}).rank,3);assert.equal(M.category({category:'3 TO 5 METERS'},{hazardNature:'warning'}).rank,5);});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../../js/tsunami-map-model.js');
const regions=JSON.parse(fs.readFileSync('assets/tsunami/ne-50m-coastal-regions.geojson'));
test('only published names map to coastal references, never the epicentre country',()=>{
 const item={type:'tsunami',place:'Panama',coords:[-80.8,7.5],hazardNature:'warning',affectedAreas:[{name:'PANAMA',category:'1 TO 3 METERS'},{name:'PERU',category:'LESS THAN 0.3 METERS'},{name:'unknown island',category:'Warning'}]};
 const r=M.build(item,regions);assert.deepEqual([...new Set(r.data.features.map(f=>f.properties.name))],['Panama','Peru']);assert(r.data.features.filter(f=>f.properties.name==='Panama').every(f=>f.properties.color==='#fb7148'));assert(r.data.features.filter(f=>f.properties.name==='Peru').every(f=>f.properties.color==='#2dd4bf'));assert.deepEqual(r.unmapped,['unknown island']);
 assert.equal(M.build({...item,affectedAreas:[]},regions).data.features.length,0);
 assert(r.data.features.filter(f=>f.properties.band!=='shoreline').every(f=>f.geometry.type==='MultiPolygon'));assert(r.data.features.filter(f=>f.properties.band==='shoreline').every(f=>f.geometry.type==='MultiLineString'));assert(r.data.features.some(f=>f.properties.band==='inner'));assert(r.data.features.some(f=>f.properties.band==='outer'));
 const panama=r.data.features[0].geometry.coordinates.flat(2);assert(panama.some(([x,y])=>x<-81&&y<8));assert(panama.every(([x,y])=>x>-84&&x<-77&&y>7&&y<10));
});
test('information and cancellation do not inherit threat colors; strongest category wins per coast',()=>{
 const a={hazardNature:'warning',affectedAreas:[{name:'Panama',category:'LESS THAN 0.3 METERS'},{name:'Panamá',category:'1-3 meters'}]};assert.equal(new Set(M.build(a,regions).data.features.map(f=>f.properties.name)).size,1);assert.equal(M.build(a,regions).data.features[0].properties.rank,4);
 assert.equal(M.build({...a,hazardNature:'bulletin'},regions).data.features[0].properties.color,'#38bdf8');assert.equal(M.build({...a,cancelled:true},regions).data.features[0].properties.color,'#94a3b8');
 const r=M.build({hazardNature:'bulletin',coverageAreas:[{name:'Alaska',category:'Information'},{name:'British Columbia',category:'Information'},{name:'Washington',category:'Information'},{name:'Guam',category:'Information'}]},regions);assert.equal(new Set(r.data.features.map(f=>f.properties.name)).size,4);
});
test('official polygons preserve the published coordinates, without geocoding or radius inference',()=>{
 const geometry={type:'Polygon',coordinates:[[[-123,45],[-124,45],[-124,46],[-123,45]]]};const r=M.build({hazardNature:'warning',warningLevel:'Aviso',warningGeometry:geometry,place:'Costa'},regions);assert.deepEqual(r.data.features[0].geometry,geometry);assert.equal(r.data.features[0].properties.kind,'official');
});

test('amplitude bands keep decimal 0.3–1 separate from 3+ metres',()=>{assert.equal(M.category({category:'0.3 TO 1 METERS'},{hazardNature:'warning'}).rank,3);assert.equal(M.category({category:'3 TO 5 METERS'},{hazardNature:'warning'}).rank,5);});
test('Alaska and Aleutian references fit across the date line without opening the whole world',()=>{
 const [west,east]=M.longitudeBounds([170,179,-179,-150,-124]);assert.equal(east-west,66);assert(west<=-150&&east>=-124);assert.deepEqual(M.longitudeBounds([-83,-78]),[-83,-78]);
});

test('Russia/Pacific named sectors paint only those shores with published category colors',()=>{
 const item={hazardNature:'warning',coords:[157.4,51.9],affectedAreas:[{name:'Kamchatka',category:'GREATER THAN 3 METERS'},{name:'Kuril Islands',category:'1 TO 3 METERS'},{name:'Aleutian Islands',category:'0.3 TO 1 METERS'}]};
 const result=M.build(item,regions),names=[...new Set(result.data.features.map(f=>f.properties.name))];assert.deepEqual(names,['Kamchatka','Kuril Islands','Aleutian Islands']);assert.equal(result.unmapped.length,0);
 const kamchatka=result.data.features.filter(f=>f.properties.name==='Kamchatka');assert(kamchatka.every(f=>f.properties.color==='#ef4444'));assert(kamchatka.some(f=>f.geometry.type==='MultiPolygon'));assert(kamchatka.some(f=>f.geometry.type==='MultiLineString'));
 const points=kamchatka.filter(f=>f.geometry.type==='MultiPolygon').flatMap(f=>f.geometry.coordinates.flat(2));assert(points.every(([x,y])=>x>=155&&x<=164&&y>=50&&y<=61.5));
 const aleutians=result.data.features.filter(f=>f.properties.name==='Aleutian Islands'&&f.properties.band==='shoreline').flatMap(f=>f.geometry.coordinates.flat());const [w,e]=M.longitudeBounds(aleutians.map(p=>p[0]));assert(e-w<30);assert(aleutians.some(p=>p[0]>170)&&aleutians.some(p=>p[0]<-170));
 assert(!names.includes('Russia'));assert(!names.includes('Japan'));assert(!names.includes('Alaska'));
});
test('a geographic name with no source category does not import colors from a different region',()=>{
 const r=M.build({hazardNature:'warning',affectedAreas:[{name:'Kamchatka',category:'GREATER THAN 3 METERS'},{name:'Hokkaido',category:'LESS THAN 0.3 METERS'}]},regions);assert(r.data.features.filter(f=>f.properties.name==='Hokkaido').every(f=>f.properties.color==='#2dd4bf'));
});

test('official decimal and inequality category text keeps the right level; no-threat is informational',()=>{assert.equal(M.category({category:'3.0 TO 5.0 METERS'},{hazardNature:'warning'}).rank,5);assert.equal(M.category({category:'0.30 TO 1.00 METERS'},{hazardNature:'warning'}).rank,3);assert.equal(M.category({category:'<0.3 m'},{hazardNature:'warning'}).rank,2);assert.equal(M.category({category:'>3 m'},{hazardNature:'warning'}).rank,5);assert.equal(M.category({category:'NO TSUNAMI THREAT'},{hazardNature:'warning'}).label,'Sem ameaça no boletim');});
test('explicit no-threat bulletin has one status and paints no threat coasts',()=>{
 const item={hazardNature:'bulletin',warningLevel:'Informativo',description:'BASED ON ALL AVAILABLE DATA... THERE IS NO TSUNAMI THREAT FROM THIS EARTHQUAKE.',coverageAreas:[{name:'Hawaii',category:'Information'}]};
 assert.equal(M.status(item).level,'no-threat');assert.match(M.status(item).title,/Sem ameaça/);assert(M.build(item,regions).data.features.length>0);assert(M.build(item,regions).data.features.every(f=>f.properties.rank===1));
 assert.equal(M.status({...item,description:'Informativo ainda em avaliação'}).level,'information');
 assert.equal(M.status({...item,hazardNature:'warning',warningLevel:'Aviso'}).level,'warning');
 assert.equal(M.status({...item,cancelled:true}).level,'ended');
 assert(M.build({...item,hazardNature:'warning',affectedAreas:[{name:'Panama',category:'1 TO 3 METERS'}]},regions).data.features.some(f=>f.properties.color==='#fb7148'));
});

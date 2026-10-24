import test from 'node:test';import assert from 'node:assert/strict';
import '../../js/event-portuguese.js';import '../../js/seismic-impact-model.js';import '../../js/quake-card-layout.js';
const layout=globalThis.QuakeCardLayout;
test('approved M6.6 map uses the centered map projection',()=>{
 const f=layout.frame({mag:6.6,depth:10,lat:7.72,lon:-81.47});assert.equal(f.zoom,7);assert.equal(f.height,430);assert.equal(f.anchorY,215);assert.equal(f.minLon,-81.47-1.40625);
});
test('all summary text stays within the image for large exposure and long place names; no wave or mechanism block',()=>{
 const text=[],arcs=[],p={rect(){},dot(){},arc(...args){arcs.push(args)},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:7.7,depth:12.6,place:'12 km WSW of Pitaloza Arriba, Panama',source:'EMSC · USGS · GEOFON',exposure:{status:'available',method:'pager',partial:true,ranges:[{population:5992359},{population:4710437},{population:1520756}]}});
 assert(text.some(t=>t.s==='~ 5.992.359 pessoas'));assert(text.some(t=>t.s.includes('faixas cumulativas')));
 assert(text.every(t=>t.y+t.z<=1440));assert.equal(arcs.length,0);assert(!text.some(t=>/alcance da onda|mecanismo|cidades próximas/i.test(t.s)));
});

test('shared Telegram and image layout shows Portuguese numbers and actual revision differences',()=>{
 const text=[],p={rect(){},dot(){},arc(){},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:6.3,depth:12.647,place:'Panama',energy:'119.8 kt',_deltaTxt:'M6.6 → M6.3'});
 assert(text.some(t=>t.s==='M6,3'));assert(text.some(t=>t.s==='13 km'));assert(text.some(t=>t.s==='119,8 kt'));assert(text.some(t=>t.s==='ATUALIZADO'));assert(text.some(t=>t.s==='REVISÃO · M6,6 → M6,3'));assert(text.every(t=>t.y+t.z<=1440));
 text.length=0;layout.draw(p,{mag:6.3,depth:10,place:'Panamá',revisionText:'M6,6 → M6,3'});assert(text.some(t=>t.s==='REVISÃO · M6,6 → M6,3'));
});
test('locality reserve is visibly preliminary, rounded and partial, without fictitious zero intensity bands',()=>{
 const text=[],p={rect(){},dot(){},arc(){},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:6.1,depth:10,place:'Panamá',exposure:{status:'available',method:'geonames-localities',partial:true,ranges:[{population:3579788,localities:516},{population:118641,localities:55},{population:null,localities:0}]}});
 assert(text.some(t=>t.s==='~ 3.600.000 pessoas'));assert(text.some(t=>t.s.includes('Estimativa preliminar')));assert(text.some(t=>t.s.includes('GeoNames · cobertura parcial')));assert(!text.some(t=>t.s.includes('VI+: ~ 0')));assert(text.filter(t=>t.y>=1190&&t.y<1394).every(t=>t.x+p.measure(t.s,t.z)<=800));
});

test('hollow contour legends describe actual levels and fit inside the map',()=>{
 const labels=[],p={roundRect(){},rect(){},dot(){},measure:(s,z)=>s.length*z*.55,text:(s,x,y,size)=>labels.push({s,x,y,size})};
 layout.drawContourLabels(p,[{level:7,roman:'VII',description:'Muito forte',color:'#ffc800',x:550,y:300},{level:8,roman:'VIII',description:'Severa',color:'#ff7800',x:500,y:500}]);
 assert.deepEqual(labels.map(l=>l.s),['VII · Muito forte','VIII · Severa']);assert(labels.every(l=>l.x+p.measure(l.s,l.size)<=800&&l.y+l.size<700));
 labels.length=0;layout.drawContourLabels(p,[]);assert.equal(labels.length,0);
});

test('editorial bulletin preserves coordinates, revision and exposure without confusing the visible band with epicentral MMI',()=>{
 const text=[],p={rect(){},dot(){},arc(){},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:6.9,depth:10,lat:-14.06,lon:165.55,place:'197 km WNW of Port-Olry, Vanuatu',when:'23/10/2026 · 23:31:28 BRT',sourceLabel:'US · revisado',revisionText:'M7,2 → M6,9',energy:'337.6 kt',mmi:'VIII',shaking:{status:'available'},imageMapAvailable:true,imageContours:[{level:4,roman:'IV',description:'Leve',color:'#75caff',x:600,y:480}],exposure:{status:'available',method:'pager',partial:true,ranges:[{population:53298},{population:125},{population:0}]}});
 for(const s of ['M6,9','14,06° S · 165,55° L','US · revisado','REVISÃO · M7,2 → M6,9','VIII · Severa','IV · Leve','~ 53.298 pessoas','MMI V+: ~ 125 · MMI VI+: ~ 0','337,6 kt'])assert(text.some(t=>t.s===s),s);
 assert(text.some(t=>t.s==='IV · Leve'&&t.y<layout.MAP_Y+layout.MAP_HEIGHT));assert(text.some(t=>t.s==='VIII · Severa'&&t.y>layout.MAP_Y+layout.MAP_HEIGHT));
 assert(text.every(t=>t.x>=0&&t.x+p.measure(t.s,t.z)<=800&&t.y+t.z<=1440));
});

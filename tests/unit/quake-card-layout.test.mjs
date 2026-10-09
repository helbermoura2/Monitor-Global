import test from 'node:test';import assert from 'node:assert/strict';
import '../../js/event-portuguese.js';import '../../js/seismic-impact-model.js';import '../../js/quake-card-layout.js';
const layout=globalThis.QuakeCardLayout;
test('approved M6.6 map uses the exact preview projection and lower epicenter',()=>{
 const f=layout.frame({mag:6.6,depth:10,lat:7.72,lon:-81.47});assert.equal(f.zoom,7);assert.equal(f.height,820);assert.equal(f.anchorY,550);assert.equal(f.minLon,-81.47-1.40625);
});
test('all summary text stays within the image for large exposure and long place names; no wave or mechanism block',()=>{
 const text=[],arcs=[],p={rect(){},dot(){},arc(...args){arcs.push(args)},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:7.7,depth:12.6,place:'12 km WSW of Pitaloza Arriba, Panama',source:'EMSC · USGS · GEOFON',exposure:{status:'available',method:'pager',partial:true,ranges:[{population:5992359},{population:4710437},{population:1520756}]}});
 assert(text.some(t=>t.s==='~ 5.992.359 pessoas'));assert(text.some(t=>t.s.includes('faixas cumulativas')));
 assert(text.every(t=>t.y+t.z<=1440));assert(arcs.every(a=>a[1]>820));assert(!text.some(t=>/alcance da onda|mecanismo|cidades próximas/i.test(t.s)));
});

test('shared Telegram and image layout shows Portuguese numbers and actual revision differences',()=>{
 const text=[],p={rect(){},dot(){},arc(){},measure:(s,z)=>s.length*z*.55,text:(s,x,y,z)=>text.push({s,x,y,z})};
 layout.draw(p,{mag:6.3,depth:12.647,place:'Panama',energy:'119.8 kt',_deltaTxt:'M6.6 → M6.3'});
 assert(text.some(t=>t.s==='M6,3'));assert(text.some(t=>t.s==='13 km'));assert(text.some(t=>t.s==='119,8 kt'));assert(text.some(t=>t.s==='ATUALIZADO'));assert(text.some(t=>t.s==='REVISÃO · M6,6 → M6,3'));assert(text.every(t=>t.y+t.z<=1440));
 text.length=0;layout.draw(p,{mag:6.3,depth:10,place:'Panamá',revisionText:'M6,6 → M6,3'});assert(text.some(t=>t.s==='REVISÃO · M6,6 → M6,3'));
});

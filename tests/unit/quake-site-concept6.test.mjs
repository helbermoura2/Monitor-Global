import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window=globalThis;
await import('../../js/event-portuguese.js');
await import('../../js/seismic-impact-model.js');
await import('../../js/quake-card-layout.js');
await import('../../js/quake-site-card.js');
const layout=globalThis.QuakeSiteCard;

function painter(){
 const text=[],flags=[],rects=[],dots=[],arcs=[];
 const p={rect:(...a)=>rects.push(a),roundRect:(...a)=>rects.push(a),
  dot:(...a)=>dots.push(a),arc:(...a)=>arcs.push(a),flag:(...a)=>flags.push(a),
  measure:(s,z)=>String(s).length*z*.54,text:(s,x,y,z)=>text.push({s,x,y,z}),
  brandText:(s,x,y,z)=>text.push({s,x,y,z})};
 return {p,text,flags,rects,dots,arcs};
}
test('Concept 6 is for every quake magnitude, shows two flags only inside Brazil',()=>{
 for(const [mag,region,flags] of [[1.8,{countryCode:'BR',stateCode:'PE'},2],[4.2,{countryCode:'JP'},1],[7.1,{countryCode:'CL'},1]]){
  const out=painter();
  layout.draw(out.p,{mag,place:'Lajedo/PE',depth:0,when:'08/11/2026 · 02:26 BRT',sourceLabel:'USP',mmi:'I',imageFlags:region,imageMapAvailable:true});
  assert(out.text.some(t=>t.s==='M'+String(mag).replace('.',',')));
  assert.equal(out.flags.length,flags);
  assert(out.text.some(t=>t.s==='monitorglobal.top'));
  assert(out.text.some(t=>t.s==='Telegram · @monitor_global'));
  assert(out.text.some(t=>t.s==='Não confirmado'));
  assert(!out.text.some(t=>/Ver vídeo|Replay do mapa|Animação do sismo/i.test(t.s)));
  assert(out.text.every(t=>t.y+t.z<1440));
 }
});
test('source map fully covers the epicenter and its reference overview',()=>{
 const f=layout.frame({mag:6.6,lat:7.72,lon:-81.47,depth:10});
 assert.equal(f.height,layout.MAP_HEIGHT);assert.equal(f.width,800);
 assert.equal(f.anchorY,layout.ANCHOR_Y);assert(f.height>900);
 assert(Math.abs((f.minLon+f.maxLon)/2+81.47)<1e-7);
 const out=painter();layout.draw(out.p,{mag:6.6,place:'Panama',mmi:'IV',imageMapAvailable:false});
 assert(out.text.some(t=>t.s==='Mapa de satélite indisponível'));
 assert(out.dots.some(([x,y])=>x===400&&y===layout.MAP_Y+layout.ANCHOR_Y));
});
test('never turn absent tsunami information into a no-threat assertion',()=>{
 const a=painter(),b=painter();
 layout.draw(a.p,{mag:7,place:'Vanuatu'});
 layout.draw(b.p,{mag:7,place:'Vanuatu',imageTsunami:{state:'noThreat'}});
 assert(a.text.some(t=>t.s==='Não confirmado'));
 assert(b.text.some(t=>t.s==='Sem ameaça (boletim)'));
});
await import('../../js/quake-site-flags.js');
await import('../../js/quake-site-video.js');
test('only Brazil at any magnitude or M6+ elsewhere can record a separate video',()=>{
 const eligible=globalThis.QuakeSiteVideo.eligible;
 assert(eligible({type:'earthquake',mag:1.8,countryCode:'BR'}));
 assert(eligible({type:'earthquake',mag:6.2,countryCode:'JP'}));
 assert(!eligible({type:'earthquake',mag:4.1,countryCode:'JP'}));
 assert(!eligible({type:'volcano',mag:7,countryCode:'BR'}));
});
test('state flag is selected by coordinates, not by place naming',async()=>{
 globalThis.CountryBoundaries={ready:Promise.resolve(),lookup:(lat)=>({countryCode:lat<0?'BR':'JP'})};
 globalThis.fetch=async()=>({ok:true,json:async()=>({features:[{
  properties:{uf:'PE'},geometry:{type:'Polygon',coordinates:[[[-37,-10],[-35,-10],[-35,-7],[-37,-7],[-37,-10]]]}
 }]})});
 const flags=globalThis.QuakeSiteFlags;
 assert.deepEqual(await flags.resolve({coords:[-36.24,-8.67],place:'Lajedo/PE'}),{countryCode:'BR',stateCode:'PE',brazil:true});
 assert.deepEqual(await flags.resolve({coords:[139.69,35.68],place:'Tokyo/PE'}),{countryCode:'JP',stateCode:null,brazil:false});
});

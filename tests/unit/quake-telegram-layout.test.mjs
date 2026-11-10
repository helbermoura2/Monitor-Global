import test from 'node:test';
import assert from 'node:assert/strict';
import '../../js/event-portuguese.js';
import '../../js/seismic-impact-model.js';
import '../../js/quake-card-layout.js';
import '../../js/quake-telegram-layout.js';

const T=globalThis.QuakeTelegramLayout;
function painter(){
 const calls=[],boxes=[];
 const p={
  rect:(...args)=>boxes.push(args),roundRect:(...args)=>boxes.push(args),
  dot(){},arc(){},measure:(s,z)=>String(s).length*z*.53,
  text:(s,x,y,size,color,bold)=>calls.push({s,x,y,size,color,bold}),
  brandText:(s,x,y,size)=>calls.push({s,x,y,size,brand:true})
 };
 return {p,calls,boxes};
}
const fixture={mag:8.0,lat:38.2,lon:142.1,depth:24,place:'Honshu, Japão',source:'USGS',
 timeIso:'2026-11-08T14:27:00Z',imageMapAvailable:true,
 imageTsunami:{state:'unknown',source:'',areas:'Sem boletim oficial confirmado'}};

test('Telegram only: magnitude dominates, smaller metadata and unmodified site frame',()=>{
 const {p,calls}=painter();T.draw(p,{...fixture});
 const hero=calls.find(c=>c.s==='M8,0');
 assert(hero&&hero.size>=90);
 assert(calls.some(c=>c.s.includes('SISMO DE GRANDE MAGNITUDE')));
 const stats=calls.filter(c=>c.y>=1137&&c.y<1339);
 assert(stats.every(c=>c.size<=23),'Secondary figures must be smaller than magnitude');
 assert(calls.every(c=>c.x>=0&&c.x+p.measure(c.s,c.size)<=800&&c.y+c.size<=1440));
 assert.equal(globalThis.QuakeCardLayout.MAP_HEIGHT,430);
 assert.equal(globalThis.QuakeCardLayout.version,'editorial-v17');
 assert(T.MAP_Y>300&&T.MAP_HEIGHT>500);
});

test('magnitude M1,8 for any Brazilian quake and no fictitious impact/tsunami claims',()=>{
 const {p,calls}=painter();
 T.draw(p,{...fixture,mag:1.8,brazil:true,place:'Lajedo/PE, Brasil',depth:null,
  exposure:{status:'unavailable'},energy:'',mmi:'—',imageTsunami:undefined});
 assert(calls.some(c=>c.s==='M1,8'));
 assert(calls.some(c=>c.s==='SISMO REGISTRADO NO BRASIL'));
 assert(calls.some(c=>c.s==='SITUAÇÃO NÃO CONFIRMADA'));
 assert(!calls.some(c=>/RISCO DE TSUNAMI|SEM AMEAÇA SEGUNDO BOLETIM/.test(c.s)));
 assert(calls.some(c=>c.s==='Não informada'));
 assert(calls.some(c=>c.s==='Sem estimativa'));
});

test('tsunami labels change only when official status indicates warning or no threat',()=>{
 const {p,calls}=painter();
 const warnings=[
  [{state:'warning',source:'JMA',areas:'Costas citadas'},'AVISO OFICIAL DE TSUNAMI'],
  [{state:'noThreat',source:'PTWC',areas:'Costas citadas'},'SEM AMEAÇA SEGUNDO BOLETIM'],
  [{state:'watch',source:'JMA',areas:'Costas citadas'},'VIGILÂNCIA DE TSUNAMI'],
  [{state:'unknown'},'SITUAÇÃO NÃO CONFIRMADA']
 ];
 for(const [item,label] of warnings){
  calls.length=0;T.drawTsunami(p,item);
  assert(calls.some(c=>c.s===label));
  assert(calls.filter(c=>c.y>=T.TSUNAMI_Y&&c.y<T.TSUNAMI_Y+T.TSUNAMI_HEIGHT)
   .every(c=>c.x+p.measure(c.s,c.size)<=800));
 }
});

test('map and context have consistent placement inside the alert artwork',()=>{
 const f=T.telegramFrame(fixture);
 assert.equal(f.height,T.MAP_HEIGHT);
 assert.equal(f.anchorY,T.ANCHOR_Y);
 assert(f.minLat<fixture.lat&&f.maxLat>fixture.lat);
 assert(T.CONTEXT.y>T.MAP_Y&&T.CONTEXT.y+T.CONTEXT.height<T.MAP_Y+T.MAP_HEIGHT);
 const {p,boxes}=painter();T.draw(p,fixture);
 assert(!boxes.some(b=>b[0]===0&&b[1]===0&&b[2]===800&&b[3]===1440),
  'The already composited terrain pixels must remain visible');
});

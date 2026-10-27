const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(mobile=true){const handlers={},events={};const painter={_tileTextures:{},saveTileTexture(t){(this._tileTextures[t.size[0]]??=[]).push(t);return 'saved';},getTileTexture(size){return this._tileTextures[size]?.pop();}},map={painter,style:{},on:(name,fn)=>events[name]=fn};const original=painter.saveTileTexture;const c={window:null,map,document:{hidden:false,addEventListener:(name,fn)=>handlers[name]=fn},addEventListener:(name,fn)=>handlers[name]=fn,MobileEnergyBudget:{mobile:()=>mobile}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/map-render-budget.js','utf8'),c);c.MapRenderBudget.attach(map);return {c,map,handlers,events,original};}
function texture(size){return {size:[size,size],deleted:0,destroy(){this.deleted++;}};}
test('1000 spare returns obey 8 MiB mobile / 16 MiB desktop while checked-out textures stay alive',()=>{
 for(const mobile of [true,false]){const f=setup(mobile),p=f.map.painter,all=[];const active=texture(512);p.saveTileTexture(active);assert.equal(p.getTileTexture(512),active);
  for(let i=0;i<1000;i++){const t=texture(i%2?512:256);all.push(t);assert.equal(p.saveTileTexture(t),'saved');}
  const s=f.c.MapRenderBudget.stats();assert(s.estimatedSpareTextureBytes<=s.maxEstimatedSpareTextureBytes);assert(s.disposedSpareTextures>900);assert.equal(active.deleted,0);assert(all.every(t=>t.deleted<=1));
  for(const bin of Object.values(p._tileTextures))while(bin.length){const reused=p.getTileTexture(bin[0].size[0]);assert.equal(reused.deleted,0);}
 }
});
test('hidden/pagehide release only spares; repeated attach never stacks hooks and remove restores the painter',()=>{
 const f=setup(),p=f.map.painter;const wrapped=p.saveTileTexture;f.c.MapRenderBudget.attach(f.map);assert.equal(p.saveTileTexture,wrapped);const a=texture(512);p.saveTileTexture(a);f.c.document.hidden=true;f.handlers.visibilitychange();assert.equal(a.deleted,1);assert.equal(f.c.MapRenderBudget.stats().spareTextures,0);
 const b=texture(512);p.saveTileTexture(b);f.handlers.pagehide();assert.equal(b.deleted,1);f.events.remove();assert.equal(p.saveTileTexture,f.original);
});

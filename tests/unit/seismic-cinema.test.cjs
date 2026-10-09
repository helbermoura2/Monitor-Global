const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function engine(){const root={matchMedia:()=>({matches:false,addEventListener(){}})};const ctx=vm.createContext({window:root,document:{documentElement:{classList:{add(){}}},addEventListener(){}},Math,Map,Number});vm.runInContext(fs.readFileSync('js/seismic-cinema.js','utf8'),ctx);return root.SeismicCinema;}
test('M6+ novo/manual usa tela inteira, rotação usa apenas cartão sem quedas',()=>{
 const e=engine();for(const m of [6,6.9,7,7.9,8.2]){
  const full=e.profile({mag:m,depth:10},'new'),manual=e.profile({mag:m,depth:10},'manual'),auto=e.profile({mag:m,depth:10},'auto');
  assert.equal(full.full,true);assert.equal(manual.full,true);assert.equal(auto.full,false);assert.equal(auto.pieces,0);assert.ok(auto.amplitude<=16);assert.ok(auto.duration>=1200&&auto.duration<=4800);
 }
 assert.equal(e.profile({mag:5.9,depth:10},'manual').full,false);
});
test('profundidade regula força sem usar magnitude como confirmação de danos',()=>{
 const e=engine(),shallow=e.profile({mag:6.5,depth:10}),deep=e.profile({mag:6.5,depth:500});assert.ok(shallow.mmi>deep.mmi);assert.ok(shallow.amplitude>deep.amplitude);assert.ok(shallow.pieces>deep.pieces);
 const small=e.profile({mag:2,depth:10}),large=e.profile({mag:5.9,depth:10});assert.ok(small.amplitude<large.amplitude);assert.ok(small.duration<large.duration);assert.equal(e.estimate(6.5,0),e.estimate(6.5,10));
});
test('M6.1 a 43 km tem presença no modo completo e fica no cartão na rotação',()=>{
 const e=engine(),item={mag:6.1,depth:43},full=e.profile(item,'manual'),auto=e.profile(item,'auto');
 assert.ok(full.amplitude>=10);assert.ok(full.pieces>=6);assert.equal(full.duration,16000);
 assert.ok(auto.amplitude<=16);assert.ok(auto.duration>=1200&&auto.duration<=4800);assert.equal(auto.pieces,0);
});
test('modelo coincide com a exposição populacional existente',async()=>{
 const {intensityAt}=await import('../../population-exposure-worker.mjs');const e=engine();for(const mag of [2,5.9,6.5,7.5,8.2])for(const depth of [0,10,100,500])assert.ok(Math.abs(e.estimate(mag,depth)-Math.max(1,Math.min(10,intensityAt(mag,depth,0))))<1e-10);
});
test('MMI disponível tem precedência; registro tardio não inicia outra animação',()=>{
 const e=engine();e.recordIntensity('q',4,'ShakeMap USGS');const p=e.profile({id:'q',mag:7.5,depth:10});assert.equal(p.mmi,4);assert.equal(p.source,'ShakeMap USGS');assert.equal(e.state(),null);assert.equal(e.profile({mag:7.5,depth:10,maxmmi:5}).mmi,5);
});

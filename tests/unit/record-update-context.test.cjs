const{test}=require('node:test'),assert=require('node:assert/strict');require('../../js/event-portuguese.js');const api=require('../../js/record-update-context.js');
test('revision descriptions identify changed fields without mutating source records',()=>{const prev={type:'wind',windKmh:60.5,pressureMb:1002},next={type:'wind',windKmh:80.5,pressureMb:998};const before=JSON.stringify([prev,next]);assert.equal(api.describe(prev,next),'Vento: 60,5 → 80,5 km/h · Pressão: 1.002 → 998 hPa');assert.equal(JSON.stringify([prev,next]),before);assert.equal(api.describe({type:'volcano',ashStatus:'Sem cinzas'},{type:'volcano',ashStatus:'Cinzas observadas'}),'Cinzas: Sem cinzas → Cinzas observadas');assert.equal(api.describe({},{type:'wind',windKmh:0}),'Vento: não informado → 0 km/h');});
test('summaries label quake fields and honestly describe unspecified changes',()=>{assert.equal(api.summary({_deltaTxt:'M6.6 → M6.3 · 10 → 16 km'}),'Magnitude: M6,6 → M6,3 · Profundidade: 10 → 16 km');assert.equal(api.summary({_deltaTxt:'Dados revisados pela fonte'}),'Nova versão da fonte · alteração não detalhada');assert.equal(api.summary({_deltaTxt:'Fontes/Qualidade'}),'Fontes ou qualidade do registro atualizadas');assert.equal(api.summary({_deltaTxt:'Lava reportada pela fonte'}),'Lava reportada pela fonte');});

test('rapid and seismic USGS rows cannot manufacture review changes when their order alternates',()=>{
 const seismic={source:'USGS',sourceEventId:'us6000example',isPreliminary:false},rapid={source:'USGS',sourceEventId:'pt26293000',isPreliminary:true};
 const before={...seismic,mag:6.3,depth:16,reports:[rapid,seismic]};
 for(const reports of [[seismic,rapid],[rapid,seismic],[{...seismic,source:'USGS-RT'},rapid]]){
  const after={...before,source:reports[0].source,reports};assert.equal(api.classify(before,after).reviewChanged,false);assert.equal(api.classify(before,after).kind,'sources');
 }
 const automatic={...seismic,isPreliminary:true},prior={...automatic,reports:[rapid,automatic]};
 assert.equal(api.classify(prior,before).reviewChanged,true);
 assert.equal(api.classify(before,{...before,mag:6.2}).magChanged,true);
});

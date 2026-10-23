const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const depth=require('../../js/seismic-depth.js'),updates=require('../../js/record-update-context.js');require('../../js/seismic-impact-model.js');
test('unknown, zero, negative, sub-km and reported depth remain distinct from model assumptions',()=>{
 assert.equal(depth.describe({depth:10,depthReported:null}).status,'unknown');assert.equal(depth.describe({depth:0}).status,'zero');assert.equal(depth.describe({depth:-1}).status,'negative');assert.equal(depth.describe({depth:.4}).label,'0,4 km');assert.equal(depth.describe({depth:.001}).label,'<0,01 km');
 for(const d of [null,0,-1,undefined]){assert.equal(depth.describe({depth:d}).modelKm,10);assert.equal(SeismicImpactModel.extent(3,d),SeismicImpactModel.extent(3,10));}assert.equal(depth.describe({depth:18}).assumed,false);
});
test('source coverage and quality are distinct from physical revisions',()=>{
 for(const text of ['Fontes: USGS · EMSC · Qualidade B → A','Fontes/Qualidade','Qualidade B → A'])assert.equal(updates.kind({_deltaTxt:text}),'sources');
 for(const text of ['M6,3 → M6,6','10 → 16 km','preliminar → revisado','Fontes: USGS · M6,3 → M6,6'])assert.equal(updates.kind({_deltaTxt:text}),'physical');
});
test('rain divergence describes arrival disagreement even when the next hour rounds to zero',()=>{
 const root={window:{}};vm.runInNewContext(fs.readFileSync('js/rain-outlook.js','utf8'),root);const now=Date.parse('2026-10-23T00:20Z'),loc={lat:0,lng:0},hours=v=>v.map((mm,i)=>({end:Date.parse('2026-10-23T01:00Z')+i*3600000,mm}));
 const result=root.window.RainOutlook.summarize({forecast:{at:now,loc,rows:[{name:'GFS',hours:hours([0,0,.4,0,0,0])},{name:'ICON',hours:hours([0,0,0,0,0,0])}]},now,loc});assert.equal(result.status,'divergent');assert.equal(result.header,'Início da chuva incerto');assert.match(result.detail,/se\/quando/);assert.equal(result.range,'0,0 mm');
});
test('adding an agency and aggregated quality never implies physical revision or reviewed source status',()=>{
 const before={source:'USGS',sourceSummary:'USGS',mag:6.3,depth:16,quality:'C',isPreliminary:true,reports:[{source:'USGS',isPreliminary:true}]};
 const after={...before,sourceSummary:'USGS · EMSC',quality:'A',isPreliminary:false,reports:[...before.reports,{source:'EMSC',isPreliminary:false}]};assert.equal(updates.classify(before,after).kind,'sources');assert.equal(updates.classify(before,after).reviewChanged,false);
 assert.equal(updates.classify(before,{...after,mag:6.6}).kind,'physical');assert.equal(updates.classify(before,{...after,reports:[{source:'USGS',isPreliminary:false}]}).reviewChanged,true);
 assert.equal(updates.classify({source:'USGS',mag:3,depth:10,depthReported:null},{source:'USGS',mag:3,depth:30,depthReported:30}).depthChanged,false);
});

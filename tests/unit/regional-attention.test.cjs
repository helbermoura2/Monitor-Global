const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={};vm.runInNewContext(fs.readFileSync('js/regional-attention.js','utf8'),ctx);const evaluate=ctx.RegionalAttention.evaluate;
const quake=(coords,mag,depth)=>({type:'earthquake',coords,mag,depth});
test('regional locations, thresholds and depth are combined, never place text',()=>{
 for(const [coords,mag,depth,id] of [[[29,40.8],7,12,'marmara'],[[121,14.6],7,10,'manila'],[[51.4,35.7],7,10,'tehran'],[[85,28],8,20,'himalaya'],[[92,23],8,30,'indo-burma'],[[135,33],8,20,'nankai'],[[-125,46],8.7,20,'cascadia'],[[97,0],8.5,20,'sunda'],[[-79,-10],8.5,25,'andes'],[[-170,52],8.5,20,'alaska'],[[175,52],8.5,20,'alaska']])assert.ok(evaluate(quake(coords,mag,depth)).some(r=>r.id===id),id);
 assert.equal(evaluate({...quake([0,0],9,10),place:'Istambul / Nankai'}).length,0);
 assert.equal(evaluate(quake([29,40.8],6.9,10)).length,0);assert.equal(evaluate(quake([29,40.8],7,31)).length,0);
});
test('unknown depth, malformed data, unrelated event types and demos abstain',()=>{
 for(const depth of [undefined,null,0,-1,'12',NaN,Infinity])assert.equal(evaluate(quake([29,40.8],7,depth)).length,0);
 for(const change of [{coords:[181,40]},{mag:'7'},{type:'tsunami'},{__cinemaDemo:true}])assert.equal(evaluate({...quake([29,40.8],7,12),...change}).length,0);
});

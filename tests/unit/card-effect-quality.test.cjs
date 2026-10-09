const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{},navigator:{}};vm.runInNewContext(fs.readFileSync('js/card-effect-quality.js','utf8'),sandbox);
const create=sandbox.window.CardEffectQuality.create;
function frames(q,start,end,{cost=1,gap=1000/30}={}){let changes=0;for(let t=start;t<end;t+=gap)if(q.sample(t,cost,gap,30))changes++;return changes;}
test('unknown hardware and narrow screens retain full budgets; low hardware starts balanced',()=>{
 for(const mobile of [false,true]){const q=create(mobile,{});assert.equal(q.name,'full');assert.equal(q.count(300),300);assert.equal(q.resolution,1);assert.equal(q.fps(30),30);}
 for(const hints of [{deviceMemory:2},{hardwareConcurrency:2}])assert.equal(create(false,hints).name,'balanced');
 assert.equal(create(true,{deviceMemory:8,hardwareConcurrency:8}).name,'full');
});
test('sustained rendering load reduces particles and pixel area before frame rate',()=>{
 const q=create(false,{}),particles=q.track(Array.from({length:300},(_,i)=>({i}))),first=particles[0];
 assert.equal(frames(q,0,2600,{cost:30}),1);assert.equal(q.name,'balanced');assert.equal(particles.length,210);assert.equal(particles[0],first);assert.equal(q.fps(30),30);assert.ok(Math.abs(q.resolution**2-.64)<1e-10);
 assert.equal(frames(q,2600,5500,{cost:30}),1);assert.equal(q.name,'light');assert.equal(particles.length,135);assert.equal(q.fps(30),20);assert.equal(q.resolution,.6);
 assert.equal(frames(q,5500,15000,{cost:30}),0);assert.equal(create(false,{}).name,'full');
});
test('smooth frames, brief spikes and suspended tabs do not lower quality',()=>{
 const q=create(false,{});frames(q,0,10000);q.sample(10001,100,40,30);frames(q,10040,12000);assert.equal(q.name,'full');
 q.sample(40000,100,28000,30);frames(q,40040,44000);assert.equal(q.name,'full');q.reset();assert.equal(q.name,'full');
});
test('missed frame budgets are detected even when GPU submission is cheap',()=>{
 const q=create(false,{});assert.equal(frames(q,0,3000,{gap:100}),1);assert.equal(q.name,'balanced');
});

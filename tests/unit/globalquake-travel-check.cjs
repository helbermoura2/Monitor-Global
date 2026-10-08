const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const reference=JSON.parse(fs.readFileSync('tests/fixtures/globalquake-travel-reference.json','utf8'));
const packed=fs.readFileSync('assets/seismic/globalquake-iasp91.bin.gz');
async function model(fail=false){
 const c={URL,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,Uint32Array,Float32Array,DataView,document:{baseURI:'http://localhost/',currentScript:{src:'http://localhost/js/globalquake-travel.js'}},fetch:async()=>{if(fail)throw Error('offline');return new Response(packed);}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/globalquake-travel.js','utf8'),c);return c.GlobalQuakeTravel;
}
(async()=>{
 const m=await model();await m.load();let n=0;
 for(const row of reference)for(const [i,phase] of ['p','s','pkp','pkikp'].entries()){
  const expected=row.angles[i],actual=m.angle(phase,row.depth,row.time);
  if(expected===-999)assert.equal(actual,null,`${phase} ${row.depth} ${row.time}`);
  else{assert(Math.abs(actual-expected)<1e-10,`${phase} ${row.depth} ${row.time}: ${actual} vs ${expected}`);assert(Math.abs(m.radius(phase,row.depth,row.time)-expected/360*40082)<1e-7);}
  n++;
 }
 assert.notEqual(m.radius('p',10,230),m.radius('p',600,230));
 assert.equal(m.radius('p',751,230),null);assert.equal(m.radius('p',-1,230),null);assert.equal(m.radius('p',10,-1),null);assert.equal(m.radius('p',10,NaN),null);
 assert(m.radius('p',10,230)>865,'M4.9 artificial radius cap is gone');
 const failed=await model(true);await assert.rejects(failed.load());assert.equal(failed.status(),'error');assert.equal(failed.radius('p',10,230),null);
 console.log(`PASS: ${n} fronts agree with original Java GlobalQuake to <1e-10 degrees; depth, no-arrival, no cap and load failure checked`);
})().catch(e=>{console.error(e);process.exitCode=1;});

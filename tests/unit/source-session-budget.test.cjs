const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){let calls=[],fails=0,suppressed=0;const c={Map,Set,Date,Promise,Math,Number,console:{warn(){},error(){}},performance:{now:()=>0},workerBaseUrl:()=> 'https://worker.test',WORKER_PROXY:u=>'https://worker.test/?url='+encodeURIComponent(u),SourceHealth:{isOpen:()=>fails>=3,recordSuppressed:()=>suppressed++},fetch:async url=>{calls.push(url);return new Response('{}',{status:503});},setSource:(_,state)=>{if(state==='off')fails++;}};c.window=c;vm.createContext(c);for(const file of ['vulcao','tsunami-enchente'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c);return {c,get calls(){return calls},get suppressed(){return suppressed}};}
test('VAAC uses a stable product URL and suppresses attempts during a provider outage',async()=>{
 const f=setup();for(let i=0;i<100;i++)await f.c.fetchGlobalVolcanoAdvisories();
 assert.equal(f.calls.length,3);assert(f.calls.every(u=>u==='https://worker.test/global-volcano'));assert.equal(f.suppressed,97);
});
test('GDACS floods keep existing alerts during cooldown and do not bypass it with timestamps',async()=>{
 const f=setup();f.c.globalAlerts=[{id:'retained',type:'flood',source:'GDACS'}];
 for(let i=0;i<100;i++)await f.c.fetchGdacsFloods();
 assert.equal(f.calls.length,3);assert(f.calls.every(u=>u==='https://worker.test/gdacs-floods'));assert.equal(f.suppressed,97);assert.equal(f.c.globalAlerts.length,1);
});
test('USGS volcano collector uses one stable endpoint and respects an open source circuit',async()=>{
 const f=setup();f.c.fetch=async url=>{assert.equal(url,'https://worker.test/usgs-volcano');return Response.json({all:[],elevated:[]});};
 assert.equal((await f.c.fetchUSGSVolcanoProfessional()).all.length,0);
 f.c.SourceHealth.isOpen=()=>true;f.c.fetch=async()=>{throw Error('Must not call a cooling source');};
 assert.equal((await f.c.fetchUSGSVolcanoProfessional()).all.length,0);assert.equal(f.suppressed,1);
});

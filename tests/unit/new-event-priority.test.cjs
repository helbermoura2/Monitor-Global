const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const now=Date.now(),shown=[],timers=[],urgent=[];
 const c={window:null,document:{hidden:false},globalAlerts:[],globalEvents:[],eventoSelecionadoId:'historic',map:{},Date,console,protected:0,
  isWithinAutoCycleAge:a=>Number.isFinite(a?.time)&&a.time<=Date.now()&&Date.now()-a.time<=72*3600000,
  getAutoCycleProtectionRemaining:()=>c.protected,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},
  focusNextNewCameraQuake:()=>false,showAlertDetails:item=>{shown.push(item.id);c.eventoSelecionadoId=item.id},
  VolcanoPriority:{acceptsUrgent:item=>item.eruptionStatus==='explosive',enqueue:item=>urgent.push(item.id),focus:()=>false}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/new-event-priority.js','utf8'),c);
 return {c,shown,timers,urgent,alert:(id,sev=1,extra={})=>({id,type:'storm',coords:[1,2],time:now,sev,...extra})};
}
test('repeated severe weather arrivals remain in the catalog without taking the camera or polling',()=>{
 const {c,shown,timers,alert}=setup();c.globalAlerts=[alert('rain'),alert('wind',4,{type:'wind'}),alert('cyclone',4,{type:'cyclone'})];
 for(let i=0;i<10;i++){c.NewEventPriority.queue(c.globalAlerts);assert.equal(c.NewEventPriority.focus(),false);}
 assert.equal(c.NewEventPriority.hasPending(),false);assert.deepEqual(shown,[]);assert.deepEqual(timers,[]);assert.equal(c.globalAlerts.length,3);
});
test('new earthquake focus wins before volcanic escalation, without presenting ordinary weather',()=>{
 const {c,shown,urgent,alert}=setup();c.globalAlerts=[alert('rain'),alert('eruption',3,{type:'volcano',eruptionStatus:'explosive'})];
 c.NewEventPriority.queue(c.globalAlerts);assert.deepEqual(urgent,['eruption']);
 let volcanoCalls=0;c.VolcanoPriority.focus=()=>{volcanoCalls++;return true;};c.focusNextNewCameraQuake=min=>min===5;
 assert(c.NewEventPriority.focus());assert.equal(volcanoCalls,0);c.focusNextNewCameraQuake=()=>false;assert(c.NewEventPriority.focus());assert.equal(volcanoCalls,1);assert.deepEqual(shown,[]);
});
test('expired, future, old, forecast and model eruptions cannot enter urgent presentation; reconfirmation does not replay',()=>{
 const {c,urgent,alert}=setup(),now=Date.now(),eruption=(id,extra={})=>alert(id,3,{type:'volcano',eruptionStatus:'explosive',...extra});
 c.NewEventPriority.queue([null,eruption('old',{time:now-73*3600000}),eruption('expired',{expiresAt:now-1}),eruption('future',{inicioTs:now+60000}),eruption('forecast',{hazardNature:'forecast'}),eruption('model',{source:'MODELO LOCAL'}),eruption('live')]);
 assert.deepEqual(urgent,['live']);c.NewEventPriority.markPresented(eruption('live'));c.NewEventPriority.queue([eruption('live')]);assert.deepEqual(urgent,['live']);
});
test('cyclone source consolidation leaves its canonical record available for rotation without urgent focus',()=>{
 const {c,shown,alert}=setup(),item=alert('GDACS',3,{type:'cyclone'});c.globalAlerts=[item];c.NewEventPriority.queue([item]);item.id='NHC';
 assert.equal(c.NewEventPriority.focus(),false);assert.equal(c.globalAlerts[0].id,'NHC');assert.deepEqual(shown,[]);
});
test('source bootstrap is silent and post-boot weather rows stay stored and badged without interrupting',()=>{
 const {c,alert}=setup(),core=fs.readFileSync('js/nucleo-estado.js','utf8'),start=core.indexOf('function upsertAlert(');
 c.knownAlertIds=new Set();c.activeAlertingIds=new Map();c.activeUpdatedIds=new Map();c.booted=new Set();c.isNovoPosBoot=(source,id)=>c.booted.has(source)&&!c.knownAlertIds.has(id);c.marcarAtualizadoNoTopo=()=>{};
 vm.runInContext(core.slice(start,core.indexOf('\n}',start)+2),c);assert.equal(c.upsertAlert(alert('baseline'),{fonte:'INMET'}),false);
 c.booted.add('INMET');assert.equal(c.upsertAlert(alert('new-a'),{fonte:'INMET'}),true);assert.equal(c.upsertAlert(alert('new-b'),{fonte:'INMET'}),true);
 assert.equal(c.NewEventPriority.hasPending(),false);assert.equal(c.globalAlerts.length,3);assert(c.activeAlertingIds.has('new-a'));assert.equal(c.upsertAlert(alert('new-a'),{fonte:'INMET'}),false);
});
test('hidden weather arrivals remain stored without retry polling or takeover on resume',()=>{
 const {c,shown,timers,alert}=setup();c.document.hidden=true;c.globalAlerts=[alert('hidden-alert',3)];c.NewEventPriority.queue(c.globalAlerts);
 assert.deepEqual(timers,[]);assert.equal(c.NewEventPriority.focusAlert(),false);c.document.hidden=false;assert.equal(c.NewEventPriority.focusAlert(),false);assert.equal(c.globalAlerts.length,1);assert.deepEqual(shown,[]);
});

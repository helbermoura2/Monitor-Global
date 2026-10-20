const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('js/orquestrador-feeds.js','utf8').split('async function fetchGlobalFeeds()')[0];
function setup(current,protectedUntil=0){
 const shown=[],window={__mgRevisionProtectedId:current.id,__mgRevisionProtectedUntil:protectedUntil};
 const c=vm.createContext({document:{hidden:false},window,Date,map:{},globalEvents:[current],eventoSelecionadoId:current.id,showEventDetails(i,live){shown.push([c.globalEvents[i].id,live]);c.eventoSelecionadoId=c.globalEvents[i].id;window.__mgRevisionProtectedId=c.eventoSelecionadoId;window.__mgRevisionProtectedUntil=Date.now()+90000;},showPanelRevisionFocus(){},console});
 const panel=fs.readFileSync('js/painel-e-lista.js','utf8'),start=panel.indexOf('function isWithinAutoCycleAge(');vm.runInContext(panel.slice(start,panel.indexOf('\n}',start)+2),c);
 vm.runInContext(code,c);return {c,shown};
}
const q=(id,mag)=>({id,mag,time:Date.now()});
test('novo M3 interrompe M2 protegido imediatamente, sem esperar o ciclo',()=>{
 const {c,shown}=setup(q('old',2),Date.now()+90000);c.globalEvents.push(q('new',3));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['new',true]]);
});
test('maior do lote vence primeiro; menor aguarda a proteção e continua na fila',()=>{
 const {c,shown}=setup(q('old',2),Date.now()+90000);const items=[q('small',3),q('big',5.6),q('revision',7)];c.globalEvents.push(...items);c.queueQuakeRevisions([items[2]]);c.queueNewCameraQuakes(items.slice(0,2));assert.equal(c.focusNextQuakeRevision(),true);assert.deepEqual(shown,[['big',true]]);assert.equal(c.focusNextQuakeRevision(),false);assert.equal(vm.runInContext("pendingNewCameraQuakes.has('small')",c),true);c.window.__mgRevisionProtectedUntil=0;assert.equal(c.focusNextQuakeRevision(),true);assert.deepEqual(shown[1],['small',true]);
});
test('revisita automática maior não bloqueia chegada nova menor',()=>{
 const {c,shown}=setup(q('old',6));c.globalEvents.push(q('new',3));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['new',true]]);
});
test('chegadas iguais ou menores aguardam o sismo protegido sem perder a fila',()=>{
 const {c,shown}=setup(q('old',5),Date.now()+90000);c.globalEvents.push(q('equal',5),q('small',3));c.queueNewCameraQuakes(c.globalEvents.slice(1));assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(vm.runInContext('pendingNewCameraQuakes.size',c),2);c.window.__mgRevisionProtectedUntil=0;assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['equal',true]]);
});
test('duplicata selecionada ou registro removido não captura câmera novamente',()=>{
 const {c,shown}=setup(q('old',3));c.queueNewCameraQuakes([c.globalEvents[0],q('gone',6)]);assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(shown.length,0);
});
test('32h magnitude revision never competes as a new quake or blocks fresh M2.8',()=>{const {c,shown}=setup(q('current',1.8));const old={...q('old32h',4.8),time:Date.now()-32*3600000},fresh=q('fresh',2.8);c.globalEvents.push(old,fresh);c.queueQuakeRevisions([{...old,_previousMag:4.5}]);c.queueNewCameraQuakes([fresh]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['fresh',true]]);assert.equal(vm.runInContext("pendingQuakeRevisions.has('old32h')",c),true);});
test('M0.9 fresh badge recovers before protected historical M4.8, without higher-magnitude filter',()=>{
 const old={...q('historical',4.8),time:Date.now()-19*3600000};const {c,shown}=setup(old,Date.now()+90000);c.window.__mgQuakePresentationMode='auto';
 c.globalEvents.push(q('small',0.9));c.activeAlertingIds=new Map([['small',Date.now()+180000]]);
 assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['small',true]]);
});
test('pending quake survives its 30-minute window and is shown after protected M6 finishes',()=>{
 const {c,shown}=setup(q('strong',6),Date.now()+90000);const waiting={...q('waiting',1.2),time:Date.now()-31*60000};c.globalEvents.push(waiting);c.queueNewCameraQuakes([waiting]);
 assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(vm.runInContext("pendingNewCameraQuakes.has('waiting')",c),true);c.window.__mgRevisionProtectedUntil=0;
 assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['waiting',true]]);
});
test('all new magnitudes precede old revisits and greatest magnitude is selected first',()=>{
 const {c,shown}=setup({...q('historical',4.8),time:Date.now()-19*3600000},Date.now()+90000);
 const incoming=[q('tiny',0.9),q('medium',2.5),q('small',1.2)];c.globalEvents.push(...incoming);c.queueNewCameraQuakes(incoming);
 for(let i=0;i<3;i++){c.window.__mgRevisionProtectedUntil=0;assert.equal(c.focusNextNewCameraQuake(),true);}
 assert.deepEqual(shown.map(x=>x[0]),['medium','small','tiny']);
});
test('badge recovery saves every unpresented quake before the badges and 30-minute window expire',()=>{
 const now=Date.now(),{c,shown}=setup({...q('historic',4.8),time:now-19*3600000});let stamp=now;c.Date={now:()=>stamp};
 const arrivals=[{...q('big',2.5),time:now-7*60000},{...q('small',1.2),time:now-29*60000},{...q('tiny',0.9),time:now-3*60000}];c.globalEvents.push(...arrivals);c.activeAlertingIds=new Map(arrivals.map(e=>[e.id,now+180000]));
 assert(c.focusNextNewCameraQuake());assert.equal(vm.runInContext('pendingNewCameraQuakes.size',c),2);
 stamp+=4*60000;c.window.__mgRevisionProtectedUntil=0;assert(c.focusNextNewCameraQuake());c.window.__mgRevisionProtectedUntil=0;assert(c.focusNextNewCameraQuake());assert.deepEqual(shown.map(x=>x[0]),['big','small','tiny']);
});
test('hidden queued quakes are not consumed before the visible priority presentation',()=>{const{c,shown}=setup(q('old',1));c.document.hidden=true;c.globalEvents.push(q('new',6));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(vm.runInContext('pendingNewCameraQuakes.size',c),1);assert.equal(shown.length,0);c.document.hidden=false;assert(c.focusNextNewCameraQuake());assert.deepEqual(shown,[['new',true]]);});

test('ash volcano cannot block a new quake; lava holds only quakes below M5',()=>{
 for(const lava of [false,true])for(const mag of [3.5,5]){
  const {c,shown}=setup(q('old',2));c.globalEvents=[];c.globalAlerts=[{id:'volcano',type:'volcano'}];c.eventoSelecionadoId='volcano';
  c.getAlertSelectionProtectionRemaining=()=>60000;c.window.VolcanoPriority={evidence:()=>({lava}),presentationActive:()=>lava};
  c.globalEvents.push(q('new',mag));c.queueNewCameraQuakes(c.globalEvents);
  assert.equal(c.focusNextNewCameraQuake(),!lava||mag>=5);assert.equal(shown.length,!lava||mag>=5?1:0);
 }
});

test('Venezuela M2.6 immediately interrupts a protected M5.3 update, preserving live-stronger rules',()=>{
 const {c,shown}=setup(q('updated53',5.3),Date.now()+120000);c.window.__mgHoldEndsAt=Date.now()+120000;c.window.__mgQuakePresentationMode='manual';c.activeUpdatedIds=new Map([['updated53',Date.now()+180000]]);c.activeAlertingIds=new Map();c.globalEvents.push(q('venezuela26',2.6));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['venezuela26',true]]);
});
test('M6+ revision visits also yield immediately to a genuine lower arrival',()=>{const{c,shown}=setup(q('revision',6.2),Date.now()+120000);c.window.__mgQuakePresentationMode='revision';c.globalEvents.push(q('new',2.6));c.queueNewCameraQuakes([c.globalEvents[1]]);assert(c.focusNextNewCameraQuake());assert.deepEqual(shown,[['new',true]]);});
test('a second source cannot replay an already presented arrival at the same magnitude',()=>{const{c,shown}=setup(q('current',2));c.globalEvents.push(q('already',3));c.window.__mgQuakeCameraPresented=new Map([['already',3]]);c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(shown.length,0);assert.equal(vm.runInContext('pendingNewCameraQuakes.size',c),0);});
test('new-over-revision keeps tsunami M6 threshold and startup settle protection',()=>{
 const{c}=setup(q('revision',5.3),Date.now()+120000);c.window.__mgQuakePresentationMode='revision';c.globalEvents.push(q('small',2.6));c.queueNewCameraQuakes([c.globalEvents[1]]);c.isFirstLoad=true;c.window.__mgPageLoadAt=Date.now();assert.equal(c.focusNextNewCameraQuake(),false);c.isFirstLoad=false;c.window.TsunamiPriority={protectionRemaining:()=>60000};assert.equal(c.focusNextNewCameraQuake(),false);c.globalEvents.push(q('major',6.2));c.queueNewCameraQuakes([c.globalEvents[2]]);assert.equal(c.focusNextNewCameraQuake(6),true);assert.equal(c.eventoSelecionadoId,'major');
});

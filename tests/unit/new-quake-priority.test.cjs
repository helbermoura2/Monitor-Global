const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('js/orquestrador-feeds.js','utf8').split('async function fetchGlobalFeeds()')[0];
function setup(current,protectedUntil=0){
 const shown=[],window={__mgRevisionProtectedId:current.id,__mgRevisionProtectedUntil:protectedUntil};
 const c=vm.createContext({window,Date,map:{},globalEvents:[current],eventoSelecionadoId:current.id,showEventDetails(i,live){shown.push([c.globalEvents[i].id,live]);c.eventoSelecionadoId=c.globalEvents[i].id;window.__mgRevisionProtectedId=c.eventoSelecionadoId;window.__mgRevisionProtectedUntil=Date.now()+90000;},showPanelRevisionFocus(){},console});
 const panel=fs.readFileSync('js/painel-e-lista.js','utf8'),start=panel.indexOf('function isWithinAutoCycleAge(');vm.runInContext(panel.slice(start,panel.indexOf('\n}',start)+2),c);
 vm.runInContext(code,c);return {c,shown};
}
const q=(id,mag)=>({id,mag,time:Date.now()});
test('novo M3 interrompe M2 protegido imediatamente, sem esperar o ciclo',()=>{
 const {c,shown}=setup(q('old',2),Date.now()+90000);c.globalEvents.push(q('new',3));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['new',true]]);
});
test('maior do lote vence revisões e menores continuam na fila',()=>{
 const {c,shown}=setup(q('old',2),Date.now()+90000);const items=[q('small',3),q('big',5.6),q('revision',7)];c.globalEvents.push(...items);c.queueQuakeRevisions([items[2]]);c.queueNewCameraQuakes(items.slice(0,2));assert.equal(c.focusNextQuakeRevision(),true);assert.deepEqual(shown,[['big',true]]);assert.equal(c.focusNextQuakeRevision(),false);assert.equal(shown.length,1);c.window.__mgRevisionProtectedUntil=0;assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown[1],['small',true]);
});
test('revisita automática maior não bloqueia chegada nova menor',()=>{
 const {c,shown}=setup(q('old',6));c.globalEvents.push(q('new',3));c.queueNewCameraQuakes([c.globalEvents[1]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['new',true]]);
});
test('ao vivo/manual maior protege contra menores até o fim, mas admite maior',()=>{
 const {c,shown}=setup(q('old',5),Date.now()+90000);c.globalEvents.push(q('equal',5),q('small',3));c.queueNewCameraQuakes(c.globalEvents.slice(1));assert.equal(c.focusNextNewCameraQuake(),false);c.globalEvents.push(q('larger',6));c.queueNewCameraQuakes([c.globalEvents[3]]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['larger',true]]);
});
test('duplicata selecionada ou registro removido não captura câmera novamente',()=>{
 const {c,shown}=setup(q('old',3));c.queueNewCameraQuakes([c.globalEvents[0],q('gone',6)]);assert.equal(c.focusNextNewCameraQuake(),false);assert.equal(shown.length,0);
});
test('32h magnitude revision never competes as a new quake or blocks fresh M2.8',()=>{const {c,shown}=setup(q('current',1.8));const old={...q('old32h',4.8),time:Date.now()-32*3600000},fresh=q('fresh',2.8);c.globalEvents.push(old,fresh);c.queueQuakeRevisions([{...old,_previousMag:4.5}]);c.queueNewCameraQuakes([fresh]);assert.equal(c.focusNextNewCameraQuake(),true);assert.deepEqual(shown,[['fresh',true]]);assert.equal(vm.runInContext("pendingQuakeRevisions.has('old32h')",c),true);});

const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('js/painel-e-lista.js','utf8');
const names=['getPriorityCameraEarthquakes','autoCycleRandomInt','autoCycleDraw','getAutoCycleProtectionRemaining','selectNextAutoCycleItem','showNextAutoCycleItem','scheduleNextAutoCycle'];
const code=names.map(name=>{const start=source.indexOf('function '+name+'(');assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);}).join('\n');
const quake=id=>({id,type:'earthquake',mag:3,coords:[-70,-20]});
const alert=(id,type='fire',extra={})=>({id,type,coords:[-60,-10],time:Date.now(),...extra});
function setup(quakes=[],alerts=[]){
 const shown=[],timers=[];const c=vm.createContext({window:{},globalEvents:quakes,globalAlerts:alerts,eventoSelecionadoId:null,cycleTimeout:null,map:{isMoving:()=>false},console,
 setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){}});vm.runInContext(code,c);
 c.showEventDetails=i=>{shown.push(c.globalEvents[i]);c.eventoSelecionadoId=c.globalEvents[i].id;c.window.__mgSoftCycle=false;};c.showAlertDetails=item=>{shown.push(item);c.eventoSelecionadoId=item.id;c.window.__mgSoftCycle=false;};
 return {c,shown,timers,next(){c.showNextAutoCycleItem();return shown.at(-1);},tick(){c.scheduleNextAutoCycle(5000);timers.at(-1).fn();}};
}
test('dois sismos e um outro evento; todos os 80 sismos aparecem antes de repetir',()=>{
 const s=setup(Array.from({length:80},(_,i)=>quake('q'+i)),[alert('f')]);const seen=new Set();
 for(let i=0;i<120;i++){const item=s.next();assert.equal(item.type,i%3===2?'fire':'earthquake');if(item.type==='earthquake'){assert.ok(!seen.has(item.id));seen.add(item.id);}}
 assert.equal(seen.size,80);
});
test('categorias raras têm vez mesmo com centenas de incêndios; registros de cada tipo também não repetem',()=>{
 const types=['fire','hurricane','flood','tornado','wind','volcano','tsunami','storm'];
 const s=setup([quake('q1'),quake('q2')],[...Array.from({length:100},(_,i)=>alert('f'+i)),...types.slice(1).map(t=>alert(t,t))]);const categoryRounds=[],fireSeen=new Set();let round=[];
 for(let i=0;i<3*types.length*3;i++){const item=s.next();if(item.type==='earthquake')continue;round.push(item.type);if(item.type==='fire'){assert.ok(!fireSeen.has(item.id));fireSeen.add(item.id);}if(round.length===types.length){categoryRounds.push(round);round=[];}}
 for(const r of categoryRounds)assert.deepEqual(r.slice().sort(),types.slice().sort());assert.equal(fireSeen.size,3);
});
test('interrupções e reagendamentos preservam o slot e as filas restantes',()=>{
 const s=setup(Array.from({length:8},(_,i)=>quake('q'+i)),[alert('f'),alert('h','hurricane')]);s.next();const state=s.c.window.__mgAutoRotation,remaining=Array.from(state.quakes.remaining);assert.equal(state.phase,1);
 s.c.focusNextQuakeRevision=()=>true;s.tick();assert.equal(s.shown.length,1);assert.equal(state.phase,1);assert.deepEqual(Array.from(state.quakes.remaining),remaining);
 // New/manual display bypasses the rotation, just as arrival/revision handlers do.
 s.c.showEventDetails(0);s.c.scheduleNextAutoCycle(90000);assert.equal(state.phase,1);assert.equal(s.c.window.__mgAutoRotation,state);
 s.c.focusNextQuakeRevision=()=>false;s.tick();assert.equal(state.phase,2);assert.equal(s.shown.at(-1).type,'earthquake');s.tick();assert.notEqual(s.shown.at(-1).type,'earthquake');assert.equal(state.phase,0);
});
test('voo e exibição protegida aguardam sem consumir sorteios',()=>{
 const s=setup([quake('q1'),quake('q2')],[alert('f')]);s.c.eventoSelecionadoId='q1';s.c.window.__mgRevisionProtectedId='q1';s.c.window.__mgRevisionProtectedUntil=Date.now()+60000;s.tick();assert.equal(s.shown.length,0);assert.equal(s.c.window.__mgAutoRotation,undefined);assert.ok(s.timers.at(-1).ms>50000);
 s.c.window.__mgRevisionProtectedUntil=0;s.c.map.isMoving=()=>true;s.tick();assert.equal(s.timers.at(-1).ms,4000);assert.equal(s.c.window.__mgAutoRotation,undefined);
 s.c.map.isMoving=()=>false;s.tick();assert.equal(s.shown.length,1);
});
test('atualização da base usa dados atuais sem reiniciar o progresso, e remove IDs expirados',()=>{
 const s=setup([quake('q1'),quake('q2'),quake('q3')],[alert('f')]);s.next();const state=s.c.window.__mgAutoRotation;const target=state.quakes.remaining[0];s.c.globalEvents=s.c.globalEvents.filter(q=>q.id===target).map(q=>({...q,mag:5.6}));s.c.globalAlerts=[alert('f','fire',{detail:'nova versão'}),alert('h','hurricane')];const second=s.next();assert.equal(second.id,target);assert.equal(second.mag,5.6);assert.equal(state.phase,2);assert.equal(state.quakes.seen.length,1);assert.ok(!state.quakes.remaining.length);
 const other=s.next();assert.notEqual(other.type,'earthquake');if(other.id==='f')assert.equal(other.detail,'nova versão');assert.equal(state.phase,0);
});
test('sem uma categoria disponível usa as restantes, sem travar nem exibir modelos como ocorrências',()=>{
 const now=Date.now();const s=setup([],[alert('past','flood',{expiresAt:now-1}),alert('future','storm',{inicioTs:now+60000}),alert('model','wind',{hazardNature:'forecast'}),alert('no-coords','flood',{coords:null}),alert('ok','new-type')]);for(let i=0;i<6;i++)assert.equal(s.next().id,'ok');
 s.c.globalAlerts=[];s.c.globalEvents=[quake('q')];for(let i=0;i<5;i++)assert.equal(s.next().id,'q');s.c.globalEvents=[];assert.equal(s.c.selectNextAutoCycleItem(),null);
});
test('não repete imediatamente quando a fila vira, se há alternativas',()=>{
 const s=setup([quake('q1'),quake('q2')],[]);let last;for(let i=0;i<30;i++){const id=s.next().id;assert.notEqual(id,last);last=id;}
});
test('sorteio usa entropia do navegador e rejeita amostras enviesadas',()=>{
 const s=setup();let draws=0;s.c.window.crypto={getRandomValues:a=>{a[0]=draws++===0?4294967295:0;return a;}};assert.equal(s.c.autoCycleRandomInt(3),0);assert.equal(draws,2);
});

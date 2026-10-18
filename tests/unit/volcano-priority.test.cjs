const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(){const s={window:null,document:{hidden:false},activeAlertingIds:new Map(),activeUpdatedIds:new Map(),globalAlerts:[],globalEvents:[],eventoSelecionadoId:null,map:{},protectedMs:0,now:100000,focusCalls:[],sounds:[],toasts:[],shown:[],timers:[],Date:null,console,setTimeout:f=>{s.timers.push(f);return s.timers.length;},clearTimeout:()=>{},getAutoCycleProtectionRemaining:()=>s.protectedMs,playAlertTone:k=>s.sounds.push(k),showToast:m=>s.toasts.push(m),notificarNavegador:()=>{},marcarAtualizadoNoTopo:()=>{},focusNextNewCameraQuake:min=>{s.focusCalls.push(min);return false;},showAlertDetails:a=>{s.shown.push(a.id);s.eventoSelecionadoId=a.id;}};s.window=s;s.Date={now:()=>s.now,parse:Date.parse};vm.createContext(s);vm.runInContext(fs.readFileSync('js/volcano-priority.js','utf8'),s);return s;}
const volcano=(detail='Atividade monitorada')=>({id:'v',type:'volcano',place:'Teste',coords:[1,2],detail});
test('known volcano gains priority for lava once, reconfirmation and startup stay silent',()=>{const s=setup(),a=volcano();s.globalAlerts=[a];const before=s.VolcanoPriority.capture(s.globalAlerts);a.detail='New lava lake occupies crater from two vents';s.VolcanoPriority.observe(before,s.globalAlerts,false);assert.equal(s.sounds.length,0);s.VolcanoPriority.observe(before,s.globalAlerts,true);assert.equal(s.sounds.length,0);s.VolcanoPriority.focus();assert.equal(s.sounds.length,1);assert.deepEqual(s.shown,['v']);s.VolcanoPriority.observe(s.VolcanoPriority.capture(s.globalAlerts),s.globalAlerts,true);assert.equal(s.sounds.length,1);});
test('negated/historical/ended activity is not escalation, increased official level is',()=>{const s=setup(),p=s.VolcanoPriority;for(const text of ['No lava observed. No eruption in progress.','Last erupted in 1980','The eruption has ceased','Lava não observada','Lava not detected','Sem emissão de cinzas. Não há lava.']){const result=p.evidence(volcano(text));assert.equal(result.lava||result.erupting||result.ash,false,text);}const old=p.evidence(volcano()),next=p.evidence({...volcano(),aviationColor:'orange'});assert.equal(p.escalation(old,next),'Elevação do nível de alerta');assert.equal(p.escalation(next,next),'');});
test('only lava can interrupt a quake below M5; M5+ stays protected even after its hold ends',()=>{
 for(const mag of [3.5,4.9,5,5.2,6,7])for(const protectedMs of [0,60000]){
  const s=setup();s.globalAlerts=[volcano('Lava flow observed')];s.globalEvents=[{id:'q',mag}];s.eventoSelecionadoId='q';s.protectedMs=protectedMs;
  s.VolcanoPriority.enqueue(s.globalAlerts[0],'Lava');s.VolcanoPriority.focus();assert.equal(s.shown.length,mag>=5?0:1);assert.deepEqual(s.focusCalls,[5]);
  if(mag>=5){s.eventoSelecionadoId=null;s.VolcanoPriority.focus();assert.deepEqual(s.shown,['v']);}
 }
});
test('ash, generic eruption, explosion and red alert never preempt the Panama M3.5 quake',()=>{
 for(const item of [volcano('Ash plume observed'),volcano('Explosive eruption detected'),volcano('Erupção contínua de baixo nível'),{...volcano(),aviationColor:'red'}]){
  const s=setup();s.globalAlerts=[item];s.globalEvents=[{id:'panama',mag:3.5}];s.eventoSelecionadoId='panama';s.VolcanoPriority.enqueue(item,'Atualização');s.VolcanoPriority.focus();assert.deepEqual(s.shown,[]);assert.equal(s.eventoSelecionadoId,'panama');
 }
});
test('queued lava is rechecked when the latest bulletin contains ash only',()=>{
 const s=setup(),a=volcano('Lava flow observed');s.globalAlerts=[a];s.VolcanoPriority.enqueue(a,'Lava');a.detail='Ash plume observed';s.VolcanoPriority.focus();assert.deepEqual(s.shown,[]);
});
test('pending strong quake wins first, missing records are discarded, successive volcanoes get time',()=>{const s=setup();s.globalAlerts=[volcano('Lava flow observed'),{...volcano('Lava flow observed'),id:'v2'}];s.VolcanoPriority.enqueue(s.globalAlerts[0],'Lava');s.VolcanoPriority.enqueue(s.globalAlerts[1],'Cinzas');s.focusNextNewCameraQuake=min=>min===5;s.VolcanoPriority.focus();assert.equal(s.shown.length,0);s.focusNextNewCameraQuake=()=>false;s.VolcanoPriority.focus();assert.deepEqual(s.shown,['v']);s.VolcanoPriority.focus();assert.deepEqual(s.shown,['v']);s.now+=45001;s.VolcanoPriority.focus();assert.deepEqual(s.shown,['v','v2']);});
test('UI translations do not create repeated official-level escalation',()=>{const s=setup(),a={...volcano(),usgsAlertLevel:'WATCH'};s.globalAlerts=[a];s.VolcanoPriority.observe(new Map(),s.globalAlerts,false);a.usgsAlertLevel='VIGILÂNCIA';const before=s.VolcanoPriority.capture(s.globalAlerts);a.usgsAlertLevel='WATCH';s.VolcanoPriority.observe(before,s.globalAlerts,true);assert.equal(s.sounds.length,0);});
test('urgent polling rejects routine changes and accepts known or new eruptive activity',()=>{
 const p=setup().VolcanoPriority,old=volcano('Atividade monitorada');
 assert.equal(p.acceptsUrgent({...old,detail:'Monitoramento diário atualizado'},old),false);
 assert.equal(p.acceptsUrgent(volcano('Atividade monitorada'),null),false);
 assert.equal(p.acceptsUrgent(volcano('No explosive activity observed'),null),false);
 for(const detail of ['Lava eruption resumes','Ash plume observed','Explosive eruption detected'])assert.equal(p.acceptsUrgent(volcano(detail),old),true,detail);
 const active={...volcano('Explosive eruption detected'),time:100};
 assert.equal(p.acceptsUrgent(active,active),false);
 assert.equal(p.acceptsUrgent({...active,time:200},active),true);
});

test('a changed official ash bulletin marks known volcano NEW, reconfirmation is silent and older bulletins cannot escalate',()=>{
 const s=setup(),a={...volcano('Ash plume observed'),vulcanicActivity:'Ash plume to 3 km',noticeId:'A1',reportAt:100};s.globalAlerts=[a];
 const before=s.VolcanoPriority.capture(s.globalAlerts);Object.assign(a,{vulcanicActivity:'Ash plume to 8 km',noticeId:'A2',reportAt:200});s.VolcanoPriority.observe(before,s.globalAlerts,true);
 assert.equal(a._volcanoEscalation,'Novo boletim de cinzas vulcânicas');assert.equal(s.activeAlertingIds.get('v'),s.now+180000);s.VolcanoPriority.focus();assert.deepEqual(s.shown,[]);
 const p=s.VolcanoPriority;assert.equal(p.acceptsUrgent({...a,noticeId:'A3'},a),false);
 assert.equal(p.acceptsUrgent({...a,detail:'Explosive eruption',noticeId:'A0',reportAt:90},a),false);
});

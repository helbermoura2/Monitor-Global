const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const offline = fs.readFileSync('js/inmet-avisos.js','utf8');
const from = offline.indexOf('function formatCacheAge(');
const until = offline.indexOf('\nfunction inmetMeAtinge(', from);
assert(from >= 0 && until > from, 'offline snapshot functions must exist');
const offlineCode = offline.slice(from,until);

const orchestration = fs.readFileSync('js/orquestrador-feeds.js','utf8');
const markFrom = orchestration.indexOf('function markSeismicDataRetained(');
const markUntil = orchestration.indexOf('\n// Revisões aguardam', markFrom);
assert(markFrom >= 0 && markUntil > markFrom, 'retained-data helper must exist');

function makeHarness(now, initial) {
  const store = new Map();
  if (initial) store.set('monitor_offline_cache', JSON.stringify(initial));
  const listeners = {}, jobs = {}, calls = {resumed:0, seismic:0};
  const ctx = {
    Date:{now:()=>now},
    window:{
      addEventListener:(name,fn)=>{listeners[name]=fn;},
      __lastSismoSuccess:null,
      __sismoUsingCache:false
    },
    localStorage:{
      getItem:key=>store.get(key)||null,
      setItem:(key,value)=>{store.set(key,value);}
    },
    PeriodicScheduler:{every:(name,fn)=>{jobs[name]=fn;}},
    globalEvents:[], globalAlerts:[],
    knownEventIds:new Set(),knownAlertIds:new Set(),
    showToast:()=>{}, applyFilters:()=>{}, updateFreshnessUI:()=>{},
    updateFreshnessBar:()=>{},
    retomarBuscas:()=>{calls.resumed++;},
    fetchGlobalFeeds:()=>{calls.seismic++;},
    console
  };
  vm.runInNewContext(offlineCode,ctx);
  return {ctx,store,jobs,listeners,calls,now:value=>{now=value;},snapshot:()=>JSON.parse(store.get('monitor_offline_cache')||'null')};
}

const T=Date.UTC(2026,10,7,12,0,0),H=3600000;
const quake={id:'EQ-test',type:'earthquake',time:T-2*H,mag:4.5,coords:[-46.6,-23.5]};
const alert={id:'weather-test',type:'storm',time:T-60000};

test('periodic snapshots do not turn a two-hour-old quake into a fresh live event',()=>{
  const old=T-2*H;
  const h=makeHarness(T,{v:2,t:T-300000,sismoSuccess:old,events:[quake],alerts:[]});
  h.ctx.salvarCacheOffline();
  h.jobs['offline-snapshot']();
  const saved=h.snapshot();
  assert.equal(saved.v,3);
  assert.equal(saved.t,T,'the aggregate snapshot can be freshly saved');
  assert.equal(saved.quakeAt,old,'quake timestamp stays at the last confirmed fetch');
  assert.equal(saved.events.length,1,'offline quake data are not erased before a successful fetch');
  assert.equal(h.ctx.restaurarCacheOffline('offline'),true);
  assert.equal(h.ctx.globalEvents.length,1);
  assert.equal(h.ctx.window.__sismoCacheAt,old);
  assert.equal(h.ctx.window.__sismoCacheAgeMs,2*H);
  assert.equal(h.ctx.window.__sismoUsingCache,true);
});

test('network online event does not claim the old earthquake was confirmed',()=>{
  const old=T-H;
  const h=makeHarness(T,{v:3,t:T-20000,quakeAt:old,sismoSuccess:old,events:[quake],alerts:[]});
  assert.equal(h.ctx.restaurarCacheOffline('offline'),true);
  h.listeners.online();
  assert.equal(h.ctx.window.__sismoUsingCache,true);
  assert.equal(h.ctx.window.__sismoCacheAt,old);
  assert.equal(h.ctx.window.__offlineCacheReason,'reconnecting');
  assert.equal(h.calls.resumed,1);
  assert.equal(h.calls.seismic,1,'real seismic refresh is requested');
});

test('expired quake data stay excluded even if new weather alerts refresh the snapshot',()=>{
  const old=T-8*H;
  const h=makeHarness(T,{v:3,t:T-300000,quakeAt:old,sismoSuccess:old,events:[quake],alerts:[alert],weather:{temperature:25}});
  h.ctx.salvarCacheOffline();
  assert.equal(h.snapshot().quakeAt,old);
  assert.equal(h.snapshot().t,T);
  const reloaded=makeHarness(T,h.snapshot());
  assert.equal(reloaded.ctx.restaurarCacheOffline('offline'),true);
  assert.equal(reloaded.ctx.globalEvents.length,0,'eight-hour-old earthquakes are not revived');
  assert.equal(reloaded.ctx.globalAlerts.length,1,'recent cached alerts still restore');
  assert.equal(reloaded.ctx.window.__proWeather.temperature,25);
  assert.equal(reloaded.ctx.window.__sismoUsingCache,true,'no false live status');
});

test('a verified quake refresh updates the timestamp and replaces previous events',()=>{
  const old=T-3*H;
  const h=makeHarness(T,{v:3,t:T-100000,quakeAt:old,sismoSuccess:old,events:[quake],alerts:[]});
  h.ctx.globalEvents=[{...quake,id:'EQ-new',mag:5.2}];
  h.ctx.window.__lastSismoSuccess=T;
  h.ctx.window.__sismoUsingCache=false;
  h.ctx.salvarCacheOffline();
  assert.equal(h.snapshot().quakeAt,T);
  assert.equal(h.snapshot().events[0].id,'EQ-new');
  const reloaded=makeHarness(T+1000,h.snapshot());
  assert.equal(reloaded.ctx.restaurarCacheOffline('sources-off'),true);
  assert.equal(reloaded.ctx.globalEvents[0].id,'EQ-new');
  assert.equal(reloaded.ctx.window.__sismoCacheAgeMs,1000);
});

test('no verified timestamp is not silently replaced by Date.now()',()=>{
  const h=makeHarness(T,{v:2,t:T-1000,sismoSuccess:null,events:[quake],alerts:[]});
  h.ctx.salvarCacheOffline();
  assert.equal(h.snapshot().quakeAt,null,'invalid v2 snapshot cannot create trusted fresh data');
  const reload=makeHarness(T,h.snapshot());
  assert.equal(reload.ctx.restaurarCacheOffline('offline'),false);
  assert.equal(reload.ctx.globalEvents.length,0);
});

test('failed seismic refresh retains the last real timestamp, never stamps now',()=>{
  const ctx={window:{__sismoCacheAt:null,__lastSismoSuccess:T-4*H},
    Date:{now:()=>T},navigator:{onLine:true}};
  vm.runInNewContext(orchestration.slice(markFrom,markUntil)+ '\nmarkSeismicDataRetained("sources-off");',ctx);
  assert.equal(ctx.window.__sismoUsingCache,true);
  assert.equal(ctx.window.__sismoCacheAt,T-4*H);
  assert.equal(ctx.window.__offlineCacheReason,'sources-off');
  assert.equal(ctx.window.__sismoCacheAgeMs,4*H);
});

test('both freshness indicators remain warnings if cache age is unknown',()=>{
  const enhancements=fs.readFileSync('js/enhancements-4413.js','utf8');
  const start=enhancements.indexOf('function updateFreshnessUI()');
  const end=enhancements.indexOf('\n  function atualizarRiscoAlagamento()',start);
  assert(start>=0 && end>start);
  const meta={},window={__sismoUsingCache:true,__sismoCacheAt:null,__lastSismoSuccess:T-1000,__offlineCacheReason:'reconnecting'};
  vm.runInNewContext(enhancements.slice(start,end)+'\nupdateFreshnessUI();',
    {Date:{now:()=>T},window,document:{getElementById:id=>id==='ts-meta-fresh'?meta:null}});
  assert.match(meta.textContent,/cache sem horário confirmado/);
  assert.doesNotMatch(meta.textContent,/🟢/);

  const panel=fs.readFileSync('js/painel-e-lista.js','utf8');
  const from=panel.indexOf('function updateFreshnessBar()');
  const until=panel.indexOf('\nfunction applyFilters()',from);
  assert(from>=0&&until>from);
  const indicator={innerHTML:'',title:''};
  vm.runInNewContext(panel.slice(from,until)+'\nupdateFreshnessBar();',{
    Date:{now:()=>T},window:{...window,PRO:{sourceState:{}}},
    navigator:{onLine:true},document:{getElementById:id=>id==='fresh-sismo'?indicator:null}
  });
  assert.match(indicator.innerHTML,/class="warn"/);
  assert.match(indicator.innerHTML,/cache sem horário confirmado/);
});

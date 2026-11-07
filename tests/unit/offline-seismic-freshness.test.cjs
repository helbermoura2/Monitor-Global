const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

const inmet=fs.readFileSync('js/inmet-avisos.js','utf8');
const start=inmet.indexOf('function formatCacheAge('),end=inmet.indexOf('function inmetMeAtinge(',start);
assert(start>=0&&end>start,'offline cache helpers must exist');
const code=inmet.slice(start,end);

function fixture(){
 const time={now:Date.parse('2026-11-07T12:00:00Z')},storage=new Map(),handlers={},calls={save:0,refresh:0,apply:0};
 const FakeDate=class extends Date {static now(){return time.now;}};
 const w={__lastSismoSuccess:time.now-15*60000,addEventListener(name,fn){handlers[name]=fn;}};
 const c={
  window:w,Date:FakeDate,
  globalEvents:[{id:'quake-1',time:time.now-20*60000,type:'earthquake',mag:4.5}],
  globalAlerts:[],
  knownEventIds:new Set(),knownAlertIds:new Set(),
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  PeriodicScheduler:{every(_name,fn){calls.periodic=fn;}},
  applyFilters(){calls.apply++;},
  updateFreshnessUI(){},updateFreshnessBar(){},showToast(){},
  retomarBuscas(){calls.refresh++;},fetchGlobalFeeds(){calls.refresh++;}
 };
 vm.createContext(c);vm.runInContext(code,c);
 return {c,w,time,storage,handlers,calls,read:()=>JSON.parse(storage.get('monitor_offline_cache')||'null'),
  save:()=>vm.runInContext('salvarCacheOffline()',c),
  restore:reason=>vm.runInContext('restaurarCacheOffline('+JSON.stringify(reason)+')',c)};
}

test('cache timestamp tracks the last verified seismic response, not disk write time',()=>{
 const f=fixture(),realTime=f.w.__lastSismoSuccess;
 assert.equal(f.save(),true);
 const p=f.read();
 assert.equal(p.v,3);assert.equal(p.t,realTime);assert.equal(p.sismoSuccess,realTime);
 assert.equal(p.savedAt,f.time.now);
 assert.equal(p.events[0].id,'quake-1');
 f.time.now+=5*60000;
 assert.equal(f.restore('offline'),true);
 assert.equal(f.w.__sismoUsingCache,true);
 assert.equal(f.w.__sismoCacheAt,realTime);
 assert.equal(f.w.__sismoCacheAgeMs,20*60000);
});

test('offline and periodic saves cannot make retained events look newer',()=>{
 const f=fixture();assert.equal(f.save(),true);
 const original=f.storage.get('monitor_offline_cache');
 f.handlers.offline();assert.equal(f.w.__sismoUsingCache,true);
 f.time.now+=3*60000;f.calls.periodic();
 assert.equal(f.storage.get('monitor_offline_cache'),original);
 assert.equal(f.save(),false);
 f.time.now+=4*60000;assert.equal(f.restore('sources-off'),true);
 assert.equal(f.w.__sismoCacheAgeMs,22*60000);
});

test('online event keeps the cache marker until actual source success',()=>{
 const f=fixture();f.save();f.handlers.offline();
 const previous=f.w.__sismoCacheAt;
 f.handlers.online();
 assert.equal(f.w.__sismoUsingCache,true);
 assert.equal(f.w.__sismoCacheAt,previous);
 assert.equal(f.w.__offlineCacheReason,'reconnecting');
 assert(f.calls.refresh>=1,'reconnection triggers a fetch');
 // Model the eventual successful branch of fetchGlobalFeeds.
 f.w.__lastSismoSuccess=f.time.now;
 f.w.__sismoUsingCache=false;f.w.__sismoCacheAt=null;f.w.__offlineCacheReason=null;
 assert.equal(f.w.__sismoUsingCache,false);
});

test('legacy v2 snapshot uses verified source time and rejects too-old/future data',()=>{
 const f=fixture(),now=f.time.now;
 f.storage.set('monitor_offline_cache',JSON.stringify({v:2,t:now-60000,sismoSuccess:now-5*3600000,events:[{id:'old'}],alerts:[]}));
 f.c.globalEvents=[];
 assert.equal(f.restore('offline'),true);
 assert.equal(f.w.__sismoCacheAt,now-5*3600000);
 assert.equal(f.w.__sismoCacheAgeMs,5*3600000);
 f.time.now+=2*3600000;
 assert.equal(f.restore('offline'),false,'reject cache older than 6h based on last live data');
 f.time.now=now;
 f.storage.set('monitor_offline_cache',JSON.stringify({v:3,t:now+60000,savedAt:now+60000,sismoSuccess:now+60000,events:[{id:'future'}]}));
 assert.equal(f.restore('offline'),false);
});

test('failure without any confirmed seismic consultation cannot create a fresh cache',()=>{
 const f=fixture();
 f.w.__lastSismoSuccess=0;
 assert.equal(f.save(),false);
 assert.equal(f.read(),null);
 f.w.__lastSismoSuccess=f.time.now-7*3600000;
 assert.equal(f.save(),false);
 assert.equal(f.read(),null);
});

test('feed failure paths preserve known age and UI keeps the cache distinction',()=>{
 const orchestrator=fs.readFileSync('js/orquestrador-feeds.js','utf8');
 const indicator=fs.readFileSync('js/enhancements-4413.js','utf8');
 const bar=fs.readFileSync('js/painel-e-lista.js','utf8');
 assert.match(orchestrator,/Number\(window\.__lastSismoSuccess \|\| window\.__sismoCacheAt \|\| 0\) \|\| null/);
 assert.doesNotMatch(orchestrator,/Number\(window\.__lastSismoSuccess \|\| Date\.now\(\)\)/);
 assert.match(indicator,/window\.__offlineCacheReason === 'reconnecting'/);
 assert.match(bar,/if \(window\.__sismoUsingCache\) \{/);
});

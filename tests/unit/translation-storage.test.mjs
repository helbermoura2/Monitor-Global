import test from 'node:test';import assert from 'node:assert/strict';
import {translationStorage} from '../../translation-storage.mjs';
function store(){const data=new Map();return {data,get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix,limit,startAfter})=>new Map([...data].filter(([k])=>k.startsWith(prefix)&&(!startAfter||k>startAfter)).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit))};}
test('new translations and quota use no KV writes; cache persists across object restart',async()=>{
 let reads=0,writes=0;const s=store(),kv={get:async()=>{reads++;return null;},put:async()=>writes++},key='pt-translation-v2:new';
 let cache=translationStorage(s,kv);assert.equal(await cache.get(key),null);await cache.put(key,'Texto em português');await cache.put('pt-translation-chars:2026-10-14','120');
 cache=translationStorage(s,kv);assert.equal(await cache.get(key),'Texto em português');assert.equal(await cache.get('pt-translation-chars:2026-10-14'),120);assert.equal(await cache.get('pt-translation-chars:2026-10-15'),0);assert.equal(reads,1);assert.equal(writes,0);
});
test('legacy translation imports once and remains readable if KV is exhausted',async()=>{
 let reads=0;const s=store(),kv={get:async()=>{if(++reads>1)throw Error('KV exhausted');return 'Tradução existente';}},key='pt-translation-v2:legacy';
 assert.equal(await translationStorage(s,kv).get(key),'Tradução existente');assert.equal(await translationStorage(s,kv).get(key),'Tradução existente');assert.equal(reads,1);
 const fresh='pt-translation-v2:fresh',cache=translationStorage(s,kv);assert.equal(await cache.get(fresh),null);await cache.put(fresh,'Nova tradução');assert.equal(await cache.get(fresh),'Nova tradução');
});
test('failed legacy lookups are coalesced for five minutes with bounded local state',async()=>{
 let reads=0,now=Date.now();const s=store(),kv={get:async()=>{reads++;return null;}},key='pt-translation-v2:missing';
 for(let i=0;i<10;i++)assert.equal(await translationStorage(s,kv,()=>now).get(key),null);assert.equal(reads,1);
 now+=300001;await translationStorage(s,kv,()=>now).get(key);assert.equal(reads,2);
});
test('thirty-day expiry and bounded cursor cleanup remove only expired translations',async()=>{
 let now=Date.now();const s=store(),kv={get:async()=>null},cache=translationStorage(s,kv,()=>now),key='pt-translation-v2:new';
 for(let i=0;i<70;i++)s.data.set('pt-translation-cache:'+String(i).padStart(3,'0'),{value:'old',until:now-1});s.data.set('telegram-history:keep',{value:'keep',until:0});
 await cache.put(key,'válida');assert.equal([...s.data.keys()].filter(k=>/^pt-translation-cache:\d/.test(k)).length,38);
 await cache.put(key,'válida');assert.equal([...s.data.keys()].filter(k=>/^pt-translation-cache:\d/.test(k)).length,38);
 now+=3600001;await cache.put(key,'válida');assert.equal([...s.data.keys()].filter(k=>/^pt-translation-cache:\d/.test(k)).length,6);
 now+=3600001;await cache.put(key,'válida');assert.equal([...s.data.keys()].filter(k=>/^pt-translation-cache:\d/.test(k)).length,0);assert(s.data.has('telegram-history:keep'));
 now+=30*86400000+1;assert.equal(await cache.get(key),null);
});
test('translation cache works without a KV binding',async()=>{const cache=translationStorage(store(),undefined);await cache.put('pt-translation-v2:solo','Português');assert.equal(await cache.get('pt-translation-v2:solo'),'Português');});

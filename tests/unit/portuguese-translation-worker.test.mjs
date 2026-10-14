import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const source=(await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8')).replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../../'+path.slice(2),import.meta.url).href));const {default:worker,EarthquakeAlertDelivery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const request=texts=>new Request('https://worker.test/translate-pt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts})});
test('translation cache preserves numbers, rejects altered numeric facts and enforces daily allowance',async()=>{let calls=0;const data=new Map(),env={TTS_USAGE:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,v)},AI:{run:async(model,input)=>{calls++;assert.equal(model,'@cf/meta/m2m100-1.2b');assert.equal(input.target_lang,'pt');return {translated_text:input.text.includes('10')?'Profundidade: 10 km.':'Magnitude: 9.'};}}};
 let r=await (await worker.fetch(request(['Depth: 10 km.']),env)).json();assert.equal(r.translations[0],'Profundidade: 10 km.');r=await (await worker.fetch(request(['Depth: 10 km.']),env)).json();assert.equal(calls,1);
 r=await (await worker.fetch(request(['Magnitude: 6.3.']),env)).json();assert.equal(r.translations[0],null);
 data.set('pt-translation-chars:'+new Date().toISOString().slice(0,10),'50000');r=await (await worker.fetch(request(['Another bulletin']),env)).json();assert.equal(r.translations[0],null);assert.equal(calls,2);
 assert.equal((await worker.fetch(request(['x'.repeat(12001)]),env)).status,400);
 assert.equal((await worker.fetch(request(['Text']),{})).status,503);
});

test('separate sentences retain every instruction instead of dropping later sentences',async()=>{const input=[];const data=new Map(),env={TTS_USAGE:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,v)},AI:{run:async(model,args)=>{input.push(args.text);return {translated_text:args.text.startsWith('There')?'Não há ameaça de tsunami.':'Nenhuma ação é necessária.'};}}};const out=await (await worker.fetch(request(['There is no tsunami threat. No action is needed.']),env)).json();assert.equal(input.length,2);assert.equal(out.translations[0],'Não há ameaça de tsunami. Nenhuma ação é necessária.');});


test('real translation object preserves quota and survives KV exhaustion without KV writes',async()=>{
 const data=new Map(),storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v))};let reads=0,writes=0,calls=0;
 const env={TTS_USAGE:{get:async()=>{reads++;throw Error('KV quota exceeded');},put:async()=>{writes++;throw Error('KV quota exceeded');}},AI:{run:async()=>{calls++;return {translated_text:'Boletim em português.'};}}};
 let object=new EarthquakeAlertDelivery({storage},env);
 const bound={...env,EARTHQUAKE_ALERTS:{idFromName:name=>{assert.equal(name,'portuguese-translations-v1');return name;},get:()=>object}};
 const responses=await Promise.all(Array.from({length:5},()=>worker.fetch(request(['Current eruption bulletin']),bound)));
 for(const r of responses)assert.equal((await r.json()).translations[0],'Boletim em português.');assert.equal(calls,1);assert.equal(reads,1);assert.equal(writes,0);
 object=new EarthquakeAlertDelivery({storage},env);assert.equal((await (await worker.fetch(request(['Current eruption bulletin']),bound)).json()).translations[0],'Boletim em português.');assert.equal(calls,1);
 data.set('pt-translation-quota',{day:'pt-translation-chars:'+new Date().toISOString().slice(0,10),used:50000});
 assert.equal((await (await worker.fetch(request(['Another new bulletin']),bound)).json()).translations[0],null);assert.equal(calls,1);assert.equal(writes,0);
});

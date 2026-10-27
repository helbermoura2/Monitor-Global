import {test,afterEach} from 'node:test';import assert from 'node:assert/strict';import {proxyTarget,proxyText} from '../../worker/proxy-security.mjs';
const hosts=['earthquake.usgs.gov','www.jma.go.jp'],original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
test('rejects userinfo, nondefault port, local address and nested open proxy before network',()=>{for(const u of ['https://u:p@earthquake.usgs.gov/','https://earthquake.usgs.gov:8443/','http://earthquake.usgs.gov/','https://127.0.0.1/','https://api.allorigins.win/raw?url=https://other.test'])assert.throws(()=>proxyTarget(u,hosts));});
test('checks every redirect, including private targets and credentialed HTTPS; never fetches a rejected hop',async()=>{
 for(const destination of ['http://earthquake.usgs.gov/','https://127.0.0.1/','https://169.254.169.254/','https://attacker.invalid/','https://x:y@earthquake.usgs.gov/','https://earthquake.usgs.gov:8443/']){let calls=0;globalThis.fetch=async(u,o)=>{calls++;assert.equal(o.redirect,'manual');return new Response(null,{status:302,headers:{Location:destination}});};await assert.rejects(proxyText('https://earthquake.usgs.gov/start',hosts,{}),/Destino/);assert.equal(calls,1);}
});
test('relative and allowed official redirects work, loops stop, and server Retry-After survives',async()=>{
 let calls=0;globalThis.fetch=async(u)=>{calls++;return calls===1?new Response(null,{status:301,headers:{Location:'/next'}}):new Response('{}',{headers:{'Content-Type':'application/json','Retry-After':'30'}});};const r=await proxyText('https://earthquake.usgs.gov/start',hosts,{});assert.equal(r.text,'{}');assert.equal(r.retryAfter,'30');assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{Location:'/loop'}});};await assert.rejects(proxyText('https://earthquake.usgs.gov/',hosts,{}),/redirecionamentos/);assert.equal(calls,4);
});
test('stream byte limit rejects oversized and lying Content-Length bodies, cancelling the upstream',async()=>{
 for(const declared of [null,'1']){let cancelled=0;globalThis.fetch=async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(90));},cancel(){cancelled++;}}),{headers:declared?{'Content-Length':declared}:{}});await assert.rejects(proxyText('https://earthquake.usgs.gov/',hosts,{}, {maxBytes:100}),/limite/);assert.equal(cancelled,1);}
});
test('a stalled body cannot outlive the request deadline',async()=>{let cancelled=0;globalThis.fetch=async()=>new Response(new ReadableStream({pull(){},cancel(){cancelled++;}}));await assert.rejects(proxyText('https://earthquake.usgs.gov/',hosts,{}, {timeoutMs:20}),/excedido/);assert.equal(cancelled,1);});
test('bounded request reader rejects oversized chunked uploads and stalled bodies before JSON parsing',async()=>{
 const {readBoundedText}=await import('../../worker/http.mjs');let cancelled=0;
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(70));},cancel(){cancelled++;}});const req=new Request('https://worker.test/translate-pt',{method:'POST',body,duplex:'half'});
 await assert.rejects(readBoundedText(req,100),e=>e.status===413);assert.equal(cancelled,1);
 const slow=new Request('https://worker.test/translate-pt',{method:'POST',body:new ReadableStream({pull(){}}),duplex:'half'});await assert.rejects(readBoundedText(slow,100,20),e=>e.status===408);
 assert.equal(await readBoundedText(new Request('https://worker.test/',{method:'POST',body:'{"texts":["Depth: 10 km"]}'})),'{"texts":["Depth: 10 km"]}');
});

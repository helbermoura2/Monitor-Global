import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const endpoint='https://worker.test/telegram-admin-smoke';
test('public or wrong-token requests never reach Telegram smoke DO',async()=>{
 let calls=0;
 const env={ADMIN_TOKEN:'private',EARTHQUAKE_ALERTS:{idFromName:x=>x,get:()=>{calls++;return {fetch:()=>Response.json({ok:true})}}}};
 for(const headers of [{},{'X-Admin-Token':'incorrect'}]){
  const r=await worker.fetch(new Request(endpoint,{method:'POST',headers}),env);
  assert.equal(r.status,401);
 }
 assert.equal(calls,0);
});
test('approved POST forwards to isolated DO and returns readable no-store CORS response',async()=>{
 let received;
 const env={ADMIN_TOKEN:'private',EARTHQUAKE_ALERTS:{
  idFromName:x=>{assert.equal(x,'telegram-admin-smoke-v1');return x;},
  get:x=>({fetch:async req=>{received=req;return Response.json({ok:true,messageId:301,mode:'text'});}})
 }};
 const response=await worker.fetch(new Request(endpoint,{method:'POST',headers:{'X-Admin-Token':'private'}}),env);
 assert.equal(response.status,200);
 assert.equal(received.method,'POST');
 assert.equal(new URL(received.url).pathname,'/__telegram-admin-smoke');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
 assert.equal((await response.json()).messageId,301);
});
test('correct admin cannot accidentally GET the sending route; no DO returns 503',async()=>{
 const headers={'X-Admin-Token':'private'};
 assert.equal((await worker.fetch(new Request(endpoint,{headers}),{ADMIN_TOKEN:'private'})).status,405);
 assert.equal((await worker.fetch(new Request(endpoint,{method:'POST',headers}),{ADMIN_TOKEN:'private'})).status,503);
});

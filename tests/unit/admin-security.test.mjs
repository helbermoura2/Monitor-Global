import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const adminPaths=['/telegram-test','/telegram-daily-summary','/telegram-m6-check','/telegram-card-preview','/telegram-history','/telegram-history-preview','/telegram-history-detail','/source-health'];
test('administrative endpoints reject absent/wrong/headerless URL credentials before any I/O',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected network');};
 try{
  for(const path of adminPaths){
   for(const [suffix,headers,env] of [ ['',{},{}], ['',{}, {ADMIN_TOKEN:'private-test'}], ['?token=private-test',{}, {ADMIN_TOKEN:'private-test'}], ['',{'X-Admin-Token':'wrong'},{ADMIN_TOKEN:'private-test'}] ]){
    const response=await worker.fetch(new Request('https://worker.test'+path+suffix,{headers}),env);
    assert.equal(response.status,401,path+suffix);
    assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    assert(!((await response.text()).includes('private-test')));
   }
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('valid header reaches protected source handler without a binding or external calls',async()=>{
 const r=await worker.fetch(new Request('https://worker.test/source-health',{headers:{'X-Admin-Token':'private-test'}}),{ADMIN_TOKEN:'private-test'});
 assert.equal(r.status,503);
});
test('public proxy rejects unlisted hosts and non-HTTPS without contacting them',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected network');};
 try{
  for(const target of ['http://earthquake.usgs.gov/','https://127.0.0.1/','https://169.254.169.254/','https://earthquake.usgs.gov.attacker.invalid/','https://earthquake.usgs.gov@attacker.invalid/']){
   const r=await worker.fetch(new Request('https://worker.test/?url='+encodeURIComponent(target)),{});assert.equal(r.status,403,target);
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('public proxy rejects nested proxy/userinfo/ports, and remote HTML is served as inert text',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('<!DOCTYPE html><html><script>alert(1)</script></html>',{headers:{'Content-Type':'text/html'}});};
 try{
  for(const target of ['https://api.allorigins.win/raw?url=https://example.test','https://user:password@earthquake.usgs.gov/','https://earthquake.usgs.gov:8443/']){const r=await worker.fetch(new Request('https://worker.test/?url='+encodeURIComponent(target)),{});assert.equal(r.status,403);}
  assert.equal(calls,0);
  const r=await worker.fetch(new Request('https://worker.test/?url='+encodeURIComponent('https://www.cgesp.org/v3/noticias.jsp?id=1')),{});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/^text\/plain/);assert.match(r.headers.get('Content-Security-Policy'),/sandbox/);assert.equal(r.headers.get('X-Frame-Options'),'DENY');
 }finally{globalThis.fetch=previous;}
});

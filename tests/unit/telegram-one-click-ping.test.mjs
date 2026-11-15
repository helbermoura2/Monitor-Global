import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
source=source.replace(/from "(\\.\\/[^"\\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base='https://worker.test/telegram-ping';
const env={ADMIN_TOKEN:'private-test',TELEGRAM_BOT_TOKEN:'fake-test-bot-token',TELEGRAM_CHAT_ID:'-100123'};
test('one-click Telegram ping uses POST, requires admin header and sends only lightweight text',async()=>{
 const realFetch=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
   calls.push({url:String(url),method:options.method,body:options.body});
   assert.match(String(url),/^https:\/\/api\.telegram\.org\/botfake-test-bot-token\/sendMessage$/);
   assert.equal(options.method,'POST');
   const body=JSON.parse(options.body);
   assert.equal(String(body.chat_id),env.TELEGRAM_CHAT_ID);
   assert.match(body.text,/TESTE DE CONEXÃO/);
   assert.match(body.text,/@argosorbis/);
   assert.doesNotMatch(body.text,/M6,2|Valparaiso/);
   return Response.json({ok:true,result:{message_id:42}});
 };
 try{
   const req=(method,headers={})=>new Request(base,{method,headers});
   assert.equal((await worker.fetch(req('POST'),env)).status,401);
   assert.equal((await worker.fetch(req('POST',{'X-Admin-Token':'wrong'}),env)).status,401);
   assert.equal((await worker.fetch(req('GET',{'X-Admin-Token':'private-test'}),env)).status,405);
   assert.equal(calls.length,0,'Unauthorized/GET requests never send Telegram');
   const ok=await worker.fetch(req('POST',{'X-Admin-Token':'private-test'}),env);
   assert.equal(ok.status,200);
   const result=await ok.json();
   assert.equal(result.ok,true);
   assert.equal(result.messageId,42);
   assert.equal(calls.length,1);
 } finally{globalThis.fetch=realFetch;}
});
test('admin UI offers single-click confirmed action without putting secrets in URLs',async()=>{
 const ui=await readFile(new URL('../../js/telegram-history.js',import.meta.url),'utf8');
 assert.match(ui,/Enviar teste ao canal/);
 assert.match(ui,/request\('\/telegram-ping',false,'POST'\)/);
 assert.match(ui,/pingAttempted=true/);
 assert.match(ui,/window\.confirm/);
 assert.doesNotMatch(ui,/\?token=/);
});

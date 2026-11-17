import assert from 'node:assert/strict';
import test from 'node:test';
import {IMPERIAL_PREVIEW,handleImperialPreview,validateImperialPreview} from '../../worker/telegram-imperial-preview.mjs';

function fakePng(){
 const bytes=new Uint8Array(80),v=new DataView(bytes.buffer);
 bytes.set([137,80,78,71,13,10,26,10],0);
 v.setUint32(12,0x49484452);v.setUint32(16,1024);v.setUint32(20,1536);
 return bytes.buffer;
}
async function sample(){
 const bytes=fakePng();
 const expected=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const options={...IMPERIAL_PREVIEW,sha256:expected,maxBytes:4096,closesAt:Date.parse('2030-01-01')};
 return {bytes,options};
}
function storage(){
 const rows=new Map();
 return {rows,get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,structuredClone(v))};
}
function upload(bytes,filename='approved.png'){
 const form=new FormData();form.append('photo',new Blob([bytes],{type:'image/png'}),filename);
 return new Request('https://internal/__telegram-imperial-preview',{method:'POST',body:form});
}
const env={TELEGRAM_BOT_TOKEN:'dummy',TELEGRAM_CHAT_ID:'-100111'};
test('the production master is SHA pinned to the exact, owner-approved PNG',()=>{
 assert.equal(IMPERIAL_PREVIEW.sha256,'ed3cf9da86aa041673d98a40172649b498e879137da9a2b8a40810f6fe699a75');
 assert.equal(IMPERIAL_PREVIEW.width,1024);assert.equal(IMPERIAL_PREVIEW.height,1536);
});
test('rejects changed pixels, dimensions and non-PNG before send',async()=>{
 const {bytes,options}=await sample(),buf=bytes.slice(0);
 assert((await validateImperialPreview(bytes,options)).ok);
 new Uint8Array(buf)[40]^=1;
 assert.equal((await validateImperialPreview(buf,options)).ok,false);
 new DataView(buf).setUint32(16,640);
 assert.equal((await validateImperialPreview(buf,options)).ok,false);
 assert.equal((await validateImperialPreview(new ArrayBuffer(7),options)).ok,false);
 const st=storage(),sent=[];
 const r=await handleImperialPreview(st,env,upload(buf),{options,now:100,send:async(...args)=>sent.push(args)});
 assert.equal(r.status,422);assert.equal(sent.length,0);
});
test('exact PNG is posted once with Telegram confirmation and no duplicate',async()=>{
 const {bytes,options}=await sample(),st=storage();let sends=0,body;
 const send=async(_env,b)=>{sends++;body=b;return {ok:true,result:{message_id:616}};};
 const a=await handleImperialPreview(st,env,upload(bytes),{now:100,options,send});
 assert.equal(a.status,200);assert.equal((await a.json()).messageId,616);
 assert.equal(sends,1);assert.equal(body.byteLength,bytes.byteLength);
 const again=await handleImperialPreview(st,env,upload(bytes),{now:101,options,send});
 assert.equal((await again.json()).alreadySent,true);assert.equal(sends,1);
 const health=await handleImperialPreview(st,env,new Request('https://internal/__telegram-imperial-preview'),{options});
 assert.equal((await health.json()).messageId,616);
});
test('an uncertain Telegram response is never silently retried',async()=>{
 const {bytes,options}=await sample(),st=storage();let sends=0;
 const send=async()=>{sends++;throw Error('Timeout after possible Telegram acceptance');};
 assert.equal((await handleImperialPreview(st,env,upload(bytes),{now:100,options,send})).status,502);
 const b=await handleImperialPreview(st,env,upload(bytes),{now:200,options,send});
 assert.equal(b.status,409);assert.equal(sends,1);
});
test('missing bot, wrong file or expired authorization never publishes',async()=>{
 const {bytes,options}=await sample(),st=storage();let sends=0;
 const send=async()=>{sends++;return {ok:true,result:{message_id:22}};};
 assert.equal((await handleImperialPreview(st,{},upload(bytes),{now:100,options,send})).status,503);
 assert.equal((await handleImperialPreview(st,env,upload(bytes),{now:options.closesAt,options,send})).status,410);
 const req=new Request('https://internal/__telegram-imperial-preview',{method:'POST',body:'not image'});
 assert.equal((await handleImperialPreview(st,env,req,{now:100,options,send})).status,415);
 assert.equal(sends,0);
});

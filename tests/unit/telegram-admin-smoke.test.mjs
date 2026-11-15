import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTelegramAdminSmoke} from '../../worker/telegram-admin-smoke.mjs';
function fakeStore(){
 const rows=new Map();
 return {rows,get:async key=>rows.get(key),put:async(key,value)=>rows.set(key,structuredClone(value))};
}
const env={TELEGRAM_BOT_TOKEN:'fake-secret',TELEGRAM_CHAT_ID:'-100123'};
test('no credentials or unavailable storage never sends',async()=>{
 const store=fakeStore();let calls=0;
 assert.equal((await handleTelegramAdminSmoke(store,{},async()=>{calls++;})).status,503);
 store.get=async()=>{throw Error('storage limit');};
 assert.equal((await handleTelegramAdminSmoke(store,env,async()=>{calls++;})).status,503);
 assert.equal(calls,0);
});
test('sends a plain TESTE, never an earthquake, and enforces a durable cooldown',async()=>{
 const store=fakeStore();let count=0,body;
 const send=async(_env,text)=>{count++;body=text;return {ok:true,result:{message_id:231}};};
 const a=await handleTelegramAdminSmoke(store,env,send,1000000);
 assert.equal(a.status,200);assert.equal((await a.json()).messageId,231);
 assert.match(body,/TESTE DE ENVIO/);assert.match(body,/NÃO é um alerta/);assert.match(body,/@argosorbis/);assert.doesNotMatch(body,/M6|Valparaíso|magnitude 6/);
 const b=await handleTelegramAdminSmoke(store,env,send,1000001);
 assert.equal(b.status,429);assert.equal((await b.json()).reason,'cooldown');assert.equal(count,1);
 const c=await handleTelegramAdminSmoke(store,env,send,1000000+10*60000);
 assert.equal(c.status,200);assert.equal(count,2);
});
test('uncertain delivery is frozen for ten minutes, while explicit Telegram refusal can retry after a minute',async()=>{
 let store=fakeStore(),calls=0;
 let failing=async()=>{calls++;throw Error('connection dropped after remote send');};
 const uncertain=await handleTelegramAdminSmoke(store,env,failing,1000000);
 assert.equal(uncertain.status,502);assert.equal((await uncertain.json()).reason,'uncertain');
 assert.equal((await handleTelegramAdminSmoke(store,env,failing,1000001)).status,429);assert.equal(calls,1);
 store=fakeStore();calls=0;
 const reject=async()=>{calls++;let e=Error('Forbidden');e.telegramRejected=true;throw e;};
 assert.equal((await handleTelegramAdminSmoke(store,env,reject,1000000)).status,502);
 assert.equal((await handleTelegramAdminSmoke(store,env,reject,1000001)).status,429);
 assert.equal((await handleTelegramAdminSmoke(store,env,reject,1060001)).status,502);assert.equal(calls,2);
});
test('records before send to stop rapid duplicate posts even when Telegram never confirms',async()=>{
 const store=fakeStore();let calls=0;
 const send=async()=>{calls++;const p=await handleTelegramAdminSmoke(store,env,send,1000001);assert.equal(p.status,429);return {ok:true,result:{message_id:22}}};
 assert.equal((await handleTelegramAdminSmoke(store,env,send,1000000)).status,200);
 assert.equal(calls,1);
});

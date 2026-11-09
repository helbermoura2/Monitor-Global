import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAlexaRelay} from '../../worker/alexa-voice-bridge.mjs';

const base='https://black-sky-9ba0.terrestre.workers.dev/alexa/v1';
const now=Date.parse('2026-11-09T18:00:00Z');
const storage=()=>{const items=new Map();return {items,get:async k=>items.get(k),put:async(k,v)=>{items.set(k,v);},delete:async k=>items.delete(k)};};
const req=(path,method='POST',body={},token='',ip='192.0.2.12')=>new Request(base+path,{
 method,headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...(token?{Authorization:'Bearer '+token}:{})},
 ...(method==='GET'?{}:{body:JSON.stringify(body)})
});
async function api(s,path,method='POST',body={},token='',at=now,ip='192.0.2.12'){
 const r=await handleAlexaRelay(req(path,method,body,token,ip),s,{now:at});
 return {status:r.status,body:await r.json(),headers:r.headers};
}
test('private Alexa bridge: pair, command, poll, ack, replay resistance',async()=>{
 const s=storage();
 const register=await api(s,'/register');assert.equal(register.status,200);
 const {code,deviceToken}=register.body;
 assert.match(code,/^\d{6}$/);assert.match(deviceToken,/^[a-f0-9]{64}$/);
 assert.equal(register.headers.get('cache-control'),'no-store');
 assert.equal((await api(s,'/next','GET',{},deviceToken)).body.linked,false);
 assert.equal((await api(s,'/link','POST',{code:'123'})).status,400);
 const pairing=await api(s,'/link','POST',{code});
 assert.equal(pairing.status,200);const {skillToken}=pairing.body;assert.match(skillToken,/^[a-f0-9]{64}$/);
 assert.equal((await api(s,'/link','POST',{code})).status,404,'code is one-time');
 assert.equal((await api(s,'/command','POST',{command:'brent'},'0'.repeat(64))).status,401);
 assert.equal((await api(s,'/command','POST',{command:'unlock-door'},skillToken)).status,400,'only allowlisted cards');
 const accepted=await api(s,'/command','POST',{command:'brent'},skillToken,now+1000);
 assert.equal(accepted.status,200);assert.equal(accepted.body.accepted,true);
 const pending=await api(s,'/next','GET',{},deviceToken,now+2000);
 assert.equal(pending.body.linked,true);
 assert.equal(pending.body.command.type,'brent');
 assert.equal(pending.body.command.id,accepted.body.id);
 assert.equal((await api(s,'/ack','POST',{id:'not-valid'},deviceToken)).status,400);
 assert.equal((await api(s,'/ack','POST',{id:accepted.body.id},'0'.repeat(64))).status,401);
 assert.equal((await api(s,'/ack','POST',{id:accepted.body.id},deviceToken)).status,200);
 assert.equal((await api(s,'/next','GET',{},deviceToken)).body.command,null);
 const weather=await api(s,'/command','POST',{command:'weather'},skillToken,now+3000);
 assert.equal(weather.status,200);assert.equal((await api(s,'/next','GET',{},deviceToken,now+3001)).body.command.type,'weather');
 assert.equal((await api(s,'/next','GET',{},deviceToken,now+93001)).body.command,null,'commands expire');
});
test('link expiry, flood limits, and offline delivery',async()=>{
 const s=storage(),r=await api(s,'/register', 'POST',{},'',now,'192.0.2.13');
 assert.equal((await api(s,'/link','POST',{code:r.body.code},'',now+600001,'192.0.2.13')).status,404);
 const valid=await api(s,'/register','POST',{},'',now+800000,'192.0.2.14');
 const bound=await api(s,'/link','POST',{code:valid.body.code},'',now+800100,'192.0.2.14');
 assert.equal(bound.status,200);
 assert.equal((await api(s,'/command','POST',{command:'brazil'},bound.body.skillToken,now+800100+120001)).status,409,'offline TV cannot be promised a card');
 for(let i=0;i<8;i++)await api(s,'/link','POST',{code:'999999'},'',now,'192.0.2.15');
 assert.equal((await api(s,'/link','POST',{code:'999999'},'',now,'192.0.2.15')).status,429);
});
test('distinct paired devices have isolated commands without exposing their tokens',async()=>{
 const s=storage();const first=await api(s,'/register');const link1=await api(s,'/link','POST',{code:first.body.code});
 assert.equal(link1.status,200);
 const second=await api(s,'/register','POST',{},'',now+10000,'192.0.2.16');
 const link2=await api(s,'/link','POST',{code:second.body.code},'',now+10001,'192.0.2.16');
 assert.equal(link2.status,200);
 const queued=await api(s,'/command','POST',{command:'brazil'},link2.body.skillToken,now+12000);
 assert.equal(queued.status,200);
 assert(!JSON.stringify(queued.body).includes(second.body.deviceToken));
 assert.equal((await api(s,'/next','GET',{},second.body.deviceToken,now+13000)).body.command.type,'brazil');
 assert.equal((await api(s,'/next','GET',{},first.body.deviceToken,now+13000)).body.command,null);
});

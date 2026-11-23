import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCivilPhoneRelay} from '../../worker/civil-phone-relay.mjs';
class Memory {
 map=new Map();
 async get(k){return this.map.get(k)}
 async put(k,v){this.map.set(k,v)}
 async delete(k){this.map.delete(k)}
}
const URL='https://black-sky-9ba0.terrestre.workers.dev/civil-relay/v1/';
const call=async(storage,route,body,token='',time=1795386000000,ip='tester')=>{
 const args={method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':ip,...(token?{authorization:'Bearer '+token}:{})}};
 if(body!==undefined){args.body=JSON.stringify(body);args.headers['Content-Type']='application/json';}
 const response=await handleCivilPhoneRelay(new Request(URL+route,args),storage,{now:time});
 return {code:response.status,data:await response.json()};
};
async function setup(storage,now=1795386000000){
 const tv=await call(storage,'tv/register',{},'',now);
 assert.equal(tv.code,200);assert.match(tv.data.code,/^[0-9]{8}$/);
 const phone=await call(storage,'phone/pair',{code:tv.data.code},'',now);
 assert.equal(phone.code,200);
 return {tv:tv.data.tvToken,phone:phone.data.phoneToken};
}
const official='Alerta severo Defesa Civil: Chuva se espalhando pelas Zonas Oeste e Norte de São Paulo. Busque abrigo.';
test('secure pairing, two phones, private read; second attempt cannot reuse pair code',async()=>{
 const db=new Memory(),now=1795386000000;
 const t=await call(db,'tv/register',{},'',now);
 assert.match(t.data.tvToken,/^[0-9a-f]{64}$/);
 const p1=await call(db,'phone/pair',{code:t.data.code},'',now);
 assert.equal(p1.data.paired,true);
 assert.equal((await call(db,'phone/pair',{code:t.data.code},'',now)).code,404);
 const next=await call(db,'tv/code',{},t.data.tvToken,now);
 const p2=await call(db,'phone/pair',{code:next.data.code},'',now);
 assert.equal(p2.data.phones,2);
 const q=await call(db,'tv/poll',undefined,t.data.tvToken,now);
 assert.equal(q.data.pairedPhones,2);
 assert.equal((await call(db,'tv/poll',undefined,'1'.repeat(64),now)).code,401);
 assert.equal((await call(db,'phone/send',{test:true},t.data.tvToken,now)).code,401);
});
test('phone real Cell Broadcast observed: one distinct event per message, duplicate phones folded',async()=>{
 const db=new Memory(),now=1795386000000,{tv,phone}=await setup(db,now);
 const real={text:official,observedAt:now,severity:'Severe',source:'ACESSIBILIDADE',
  packageName:'com.samsung.android.cellbroadcastreceiver',test:false};
 assert.equal((await call(db,'phone/send',real,phone,now)).data.accepted,true);
 const same=await call(db,'phone/send',real,phone,now+1000);
 assert.equal(same.data.duplicate,true);
 const second=await call(db,'phone/send',{...real,text:official.replace('Oeste e Norte','Central e Leste'),observedAt:now+2000},phone,now+2000);
 assert.equal(second.data.accepted,true);
 const events=(await call(db,'tv/poll',undefined,tv,now+2000)).data.events;
 assert.equal(events.length,2);
 assert.ok(events.every(e=>e.type==='phone'));
 assert.equal((await call(db,'tv/poll',undefined,tv,now+5*60000+1000)).data.events.length,0);
});
test('manual simulation is separate and expires, real cannot fake own application or settings screen',async()=>{
 const db=new Memory(),now=1795386000000,{tv,phone}=await setup(db,now);
 const sim={test:true,text:'Alerta severo Defesa Civil: TESTE SIMULADO do Argos Orbis. Não é uma emergência.',severity:'Severe',
  source:'MANUAL_TEST',packageName:'top.monitorglobal.mobile.dev',observedAt:now};
 assert.equal((await call(db,'phone/send',sim,phone,now)).data.accepted,true);
 assert.equal((await call(db,'tv/poll',undefined,tv,now)).data.events[0].type,'test');
 assert.equal((await call(db,'tv/poll',undefined,tv,now+121000)).data.events.length,0);
 const invalid=[
  {...sim,test:false},
  {...sim,test:false,source:'ACESSIBILIDADE',packageName:'com.android.settings',text:official},
  {...sim,test:false,source:'ACESSIBILIDADE',packageName:'com.samsung.android.cellbroadcastreceiver',text:official,observedAt:now-130000},
  {...sim,test:false,source:'ACESSIBILIDADE',packageName:'com.samsung.android.cellbroadcastreceiver',text:official,observedAt:now+20000},
  {...sim,test:false,source:'NOTIFICACAO',packageName:'com.android.systemui',text:'Chuva forte com possibilidade de granizo'}
 ];
 for(const x of invalid)assert.equal((await call(db,'phone/send',x,phone,now)).code,400);
});
test('unpaired and invalid methods never expose events; missing/expired pair blocked',async()=>{
 const db=new Memory(),now=1795386000000;
 assert.equal((await call(db,'tv/poll',undefined,'a'.repeat(64),now)).code,401);
 const t=await call(db,'tv/register',{},'',now);
 assert.equal((await call(db,'phone/pair',{code:t.data.code},'',now+11*60000)).code,404);
});

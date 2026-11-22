import test from 'node:test';
import assert from 'node:assert/strict';
import {CIVIL_TOPIC,CIVIL_SOURCE,civilNotices,validCivilSnapshot,createCivilDispatcher} from '../../worker/mobile-civil.mjs';
const NOW=Date.parse('2026-11-22T22:57:00Z'),MIN=60000;
const record=(extras={})=>({id:'sp-cap-001',issuer:'Defesa Civil Estadual de São Paulo',
 severity:'Severe',message:'Chuva forte com raios e granizo. Busque abrigo.',
 sent:NOW-2*MIN,expires:NOW+30*MIN,...extras});
const snapshot=(extras={})=>({version:1,source:CIVIL_SOURCE,municipality:'3550308',
 checkedAt:NOW,updatedAt:NOW,alerts:[record()],...extras});
function harness(){let now=NOW,payload=snapshot(),fail=false;const values=new Map(),out=[];
 const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};
 const dispatch=createCivilDispatcher({storage,read:async()=>payload,clock:()=>now,send:async m=>{if(fail)throw Error('FCM unavailable');out.push(m);}});
 return {dispatch,out,time:x=>now=x,data:x=>payload=x,fail:x=>fail=x};
}
test('CAP severe and extreme messages are verified and sent to the independent civil topic',async()=>{
 const h=harness();h.data(snapshot({alerts:[record(),record({id:'sp-cap-002',severity:'Extreme',sent:NOW-3*MIN})]}));
 assert.equal((await h.dispatch()).sent,2);
 assert.deepEqual(h.out.map(x=>x.topic),[CIVIL_TOPIC,CIVIL_TOPIC]);
 const notices=h.out.map(x=>JSON.parse(x.data.notice));
 assert.equal(notices[0].kind,'civil');assert.equal(notices[0].source,CIVIL_SOURCE);
 assert.equal(notices[0].severity,'Severe');assert.equal(notices[1].severity,'Extreme');
 assert.equal(h.out[0].android.priority,'HIGH');
 assert.equal((await h.dispatch()).sent,0);
});
test('new CAP update of the same id is sent but history deduplicates unchanged editions',async()=>{
 const h=harness();await h.dispatch();
 h.data(snapshot({alerts:[record({message:'Nova atualização oficial do mesmo aviso'})]}));
 assert.equal((await h.dispatch()).sent,1);
 assert.equal((await h.dispatch()).sent,0);
});
test('no official feed or stale GitHub schedules never cause an invented emergency',async()=>{
 const h=harness();
 for(const item of [
  null,snapshot({alerts:[]}),snapshot({source:'https://fake.example/xml'}),
  snapshot({municipality:'9999999'}),snapshot({updatedAt:NOW-21*MIN,alerts:[]}),
  snapshot({checkedAt:NOW-11*MIN}),
  snapshot({alerts:[record({issuer:'Site de previsão'})]}),
  snapshot({alerts:[record({severity:'Moderate'})]}),
  snapshot({alerts:[record({sent:NOW-31*MIN})]}),
  snapshot({alerts:[record({expires:NOW-1000})]}),
  snapshot({alerts:[record({message:'x'.repeat(501)})]})
 ]){
  h.data(item);await h.dispatch();assert.equal(h.out.length,0);
 }
 assert.equal(validCivilSnapshot(snapshot(),NOW),true);
 assert.equal(civilNotices(snapshot(),NOW).length,1);
});
test('recent verified CAP notices may be delivered even when the Atom updated timestamp lags',async()=>{
 const h=harness();h.data(snapshot({updatedAt:NOW-3*3600000}));
 assert.equal((await h.dispatch()).sent,1);
 assert.equal(h.out[0].topic,CIVIL_TOPIC);
});
test('FCM failure does not mark a notice delivered and retries after restoration',async()=>{
 const h=harness();h.fail(true);await assert.rejects(h.dispatch());
 h.fail(false);assert.equal((await h.dispatch()).sent,1);assert.equal((await h.dispatch()).sent,0);
});

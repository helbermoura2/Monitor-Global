import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_REPOST_REQUEST,requestedDailyRepostReady,dailyRepostOnce} from '../../worker/telegram-daily-repost.mjs';
function mockStorage({original=true}={}){
 const entries=new Map();
 if(original){entries.set('delivery',{status:'sent'});entries.set('history',{status:'sent',messageId:456});}
 const tx={get:async key=>entries.get(key),put:async(key,val)=>entries.set(key,structuredClone(val))};
 return {entries,storage:{...tx,transaction:async callback=>callback(tx)}};
}
const day=DAILY_REPOST_REQUEST.day;
const quakes={day,events:[{mag:5.3,id:'us',time:Date.now()}],brazilFailedSources:[]};
function deps(storage,post=async form=>({result:{message_id:789}})){
 return {storage,day,chatId:'-100123',load:async()=>quakes,
  render:async()=>({png:new Uint8Array([137,80,78,71])}),
  post,caption:()=>('Reedição · '+day)};
}
test('one-time policy has explicit start/end and exact Rajdhani approved design',()=>{
 assert.equal(requestedDailyRepostReady(DAILY_REPOST_REQUEST.opensAt-1,DAILY_REPOST_REQUEST.design),false);
 assert.equal(requestedDailyRepostReady(DAILY_REPOST_REQUEST.opensAt+1,DAILY_REPOST_REQUEST.design),true);
 assert.equal(requestedDailyRepostReady(DAILY_REPOST_REQUEST.opensAt+1,'old-version'),false);
 assert.equal(requestedDailyRepostReady(DAILY_REPOST_REQUEST.closesAt,DAILY_REPOST_REQUEST.design),false);
});
test('reprint sends once with original date, explicit caption and the existing private chat',async()=>{
 const {entries,storage}=mockStorage();let calls=0,original;
 const p=async form=>{calls++;original=form;return {result:{message_id:789}};};
 const first=await dailyRepostOnce(deps(storage,p));
 assert.equal(first.resent,true);assert.equal(first.messageId,789);
 assert.equal(original.get('chat_id'),'-100123');
 assert.match(original.get('caption'),/Reedição/);
 assert.equal(original.get('photo').name,'monitor-global-resumo-novo-visual.png');
 assert.equal(entries.get('delivery').status,'sent');
 assert.equal(entries.get('history').messageId,456);
 const again=await dailyRepostOnce(deps(storage,p));
 assert(again.skipped);assert.equal(calls,1);
 assert.equal(entries.get('daily-repost:'+day).status,'sent');
});
test('reprint cannot start without confirmed original and never permits other dates',async()=>{
 const a=mockStorage({original:false});let calls=0;
 assert((await dailyRepostOnce({...deps(a.storage,async()=>{calls++;}),day:'2026-11-08'})).skipped);
 assert((await dailyRepostOnce(deps(a.storage,async()=>{calls++;}))).skipped);
 assert.equal(calls,0);
});
test('an ambiguous Telegram send is frozen permanently against accidental duplicates',async()=>{
 const {entries,storage}=mockStorage();let calls=0;
 const p=async()=>{calls++;throw Error('Network timeout after send may have happened');};
 const first=await dailyRepostOnce(deps(storage,p));
 assert(first.uncertain);assert.equal(entries.get('daily-repost:'+day).status,'uncertain');
 const retry=await dailyRepostOnce(deps(storage,p));assert(retry.skipped);assert.equal(calls,1);
});
test('explicit Telegram rejection can retry, but unconfirmed Brazil sources never send',async()=>{
 const a=mockStorage();let calls=0;
 const result=await dailyRepostOnce({...deps(a.storage,async()=>{calls++;return {result:{message_id:7}};}),load:async()=>({...quakes,brazilFailedSources:['USP']})});
 assert(!result.ok);assert.equal(calls,0);
 assert.equal(a.entries.get('daily-repost:'+day).status,'failed');
 const reject=async()=>{const e=Error('Bad Request');e.definitelyRejected=true;throw e;};
 const rejected=await dailyRepostOnce(deps(a.storage,reject));
 assert(!rejected.ok);assert.equal(a.entries.get('daily-repost:'+day).status,'failed');
 const success=await dailyRepostOnce(deps(a.storage));assert(success.resent);
});

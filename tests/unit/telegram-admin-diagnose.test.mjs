import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseTelegramAdmin} from '../../worker/telegram-admin-diagnose.mjs';
function api({username='ArgosOrbisBot',status='administrator',post=true,meStatus=200,chatStatus=200}={}){
 const methods=[];
 const fetcher=async(url,opts)=>{
  const method=url.split('/').at(-1);
  methods.push(method);
  assert.equal(opts.method,'POST');
  const payload=JSON.parse(opts.body);
  assert(!JSON.stringify(payload).includes('secret'));
  if(method==='getMe')return Response.json(meStatus===200?{ok:true,result:{id:77,username}}:{ok:false,description:'Unauthorized'},{status:meStatus});
  assert.equal(method,'getChatMember');
  assert.equal(payload.chat_id,'-100123');assert.equal(payload.user_id,77);
  return Response.json(chatStatus===200?{ok:true,result:{status,can_post_messages:post}}:{ok:false,description:'chat not found'},{status:chatStatus});
 };
 return {fetcher,methods};
}
const env={TELEGRAM_BOT_TOKEN:'sensitive-secret',TELEGRAM_CHAT_ID:'-100123'};
test('missing configuration does not call Telegram',async()=>{
 const r=await diagnoseTelegramAdmin({},()=>{throw Error('Should not call')});
 assert.equal(r.status,503);assert.equal((await r.json()).stage,'configuration');
});
test('correct bot with publishing rights is reported without disclosing tokens or channel id',async()=>{
 const mock=api();const r=await diagnoseTelegramAdmin(env,mock.fetcher);
 const body=await r.text();assert.equal(r.status,200);
 assert.deepEqual(mock.methods,['getMe','getChatMember']);
 assert.match(body,/@ArgosOrbisBot/);assert.match(body,/"canPost":true/);
 assert(!body.includes('sensitive-secret'));assert(!body.includes('-100123'));
});
test('old bot identity is reported without sending or looking up channel',async()=>{
 const mock=api({username:'MonitorGlobalTop_bot'});
 const r=await diagnoseTelegramAdmin(env,mock.fetcher);
 const result=await r.json();
 assert.equal(result.ok,false);assert.equal(result.stage,'bot');
 assert.match(result.error,/MonitorGlobalTop_bot/);
 assert.deepEqual(mock.methods,['getMe']);
});
test('revoked token and missing permission have actionable diagnostics',async()=>{
 let mock=api({meStatus:401});
 const a=await diagnoseTelegramAdmin(env,mock.fetcher);
 assert.match((await a.json()).error,/inválido ou revogado/);
 mock=api({status:'member'});
 const b=await diagnoseTelegramAdmin(env,mock.fetcher);
 assert.equal((await b.json()).stage,'permissions');
 mock=api({chatStatus:400});
 const c=await diagnoseTelegramAdmin(env,mock.fetcher);
 assert.equal((await c.json()).stage,'channel');
});
test('transient fetch failure never attempts a publish',async()=>{
 let attempts=0;
 const r=await diagnoseTelegramAdmin(env,async()=>{attempts++;throw Error('offline')});
 assert.equal(r.status,502);assert.equal(attempts,1);
 assert.match((await r.json()).error,/Não foi possível consultar/);
});

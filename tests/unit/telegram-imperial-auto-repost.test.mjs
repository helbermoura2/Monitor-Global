import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {IMPERIAL_PREVIEW} from '../../worker/telegram-imperial-preview.mjs';
import {APPROVED_IMPERIAL_URL,sendApprovedImperialOnce} from '../../worker/telegram-imperial-auto-repost.mjs';

const PNG=readFileSync(new URL('../../assets/telegram/m6/imperial-bronze-preview-2026-11-16-m6-6.png',import.meta.url));
const env={TELEGRAM_BOT_TOKEN:'mock-credential',TELEGRAM_CHAT_ID:'-100234'};
const time=Date.parse('2026-11-17T01:00:00Z');
const fixture=()=>{const map=new Map();return {map,get:async key=>map.get(key),put:async(key,value)=>map.set(key,structuredClone(value))};};
const response=(bytes=PNG,status=200)=>new Response(bytes,{status,headers:{'Content-Type':'image/png','Content-Length':String(bytes.length)}});
const send=async(_env,bytes)=>{assert.equal(Buffer.compare(Buffer.from(bytes),PNG),0);return {ok:true,result:{message_id:707}};};
test('exact committed poster file matches owner-approved PNG SHA, not a recompressed approximation',()=>{
 assert.equal(PNG.length,2906372);
 assert.equal(createHash('sha256').update(PNG).digest('hex'),IMPERIAL_PREVIEW.sha256);
 assert(APPROVED_IMPERIAL_URL.endsWith('imperial-bronze-preview-2026-11-16-m6-6.png'));
});
test('sends exactly one authentic poster, then blocks all repeated cron calls',async()=>{
 const store=fixture();let fetches=0,posts=0;
 const fetcher=async()=>{fetches++;return response();};
 const a=await sendApprovedImperialOnce(store,env,{now:time,fetcher,send:async(...args)=>{posts++;return send(...args)}});
 assert.equal(a.posted,true);assert.equal(a.messageId,707);assert.equal(a.origin,'verified-github-original');
 const b=await sendApprovedImperialOnce(store,env,{now:time+15*60000,fetcher,send:async()=>{posts++;throw Error('duplicate');}});
 assert.equal(b.skipped,true);assert.equal(b.reason,'sent');assert.equal(posts,1);assert.equal(fetches,1);
});
test('missing or altered upstream image never reaches Telegram; backoff reduces requests',async()=>{
 const store=fixture();let posts=0,fetches=0;
 const fake=async()=>{fetches++;return response(PNG,404);};
 const first=await sendApprovedImperialOnce(store,env,{now:time,fetcher:fake,send:async()=>{posts++;}});
 assert.equal(first.reason,'github-not-ready');
 const second=await sendApprovedImperialOnce(store,env,{now:time+60000,fetcher:fake,send:async()=>{posts++;}});
 assert.equal(second.reason,'backoff');assert.equal(fetches,1);
 const corrupt=Buffer.from(PNG);corrupt[500]^=1;
 const third=await sendApprovedImperialOnce(store,env,{now:time+15*60000,fetcher:async()=>response(corrupt),send:async()=>{posts++;}});
 assert.equal(third.reason,'hash-or-image-mismatch');assert.equal(posts,0);
});
test('expired window and absent Telegram bindings never post or fetch',async()=>{
 const st=fixture();let calls=0;const fetcher=async()=>{calls++;return response();};
 const expired=await sendApprovedImperialOnce(st,env,{now:IMPERIAL_PREVIEW.closesAt,fetcher});
 const noBot=await sendApprovedImperialOnce(st,{}, {now:time,fetcher});
 assert.equal(expired.reason,'expired');assert.equal(noBot.reason,'missing-telegram');assert.equal(calls,0);
});

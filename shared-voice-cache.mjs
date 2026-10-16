// A dedicated existing Durable Object shares audio and serializes the monthly budget.
import {activity} from './kv-operation-metrics.mjs';
const LIMIT=300000,TTL=7*86400000,MAX_CLIPS=64,CHUNK=60000,MAX_BYTES=8*CHUNK;
const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
const fail=(error,status=503)=>Response.json({ok:false,error},{status,headers});
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function remove(storage,item){await storage.delete('voice-audio:'+item.key+':meta');for(let i=0;i<item.parts;i++)await storage.delete('voice-audio:'+item.key+':'+i);}
export async function pruneVoiceCache(storage,now=Date.now()){
 const index=await storage.get('voice-cache-index');if(!index)return;
 const keep=[];for(const item of index){if(item.until<=now)await remove(storage,item);else keep.push(item);}
 if(keep.length!==index.length)await storage.put('voice-cache-index',keep);
 if(keep.length)await storage.setAlarm?.(Math.min(...keep.map(x=>x.until))+1000);
}
export async function handleSharedVoice(url,env,storage,synthesize,{voice,now=Date.now()}={}){
 const text=String(url.searchParams.get('text')||'').trim();
 if(!text)return fail('texto vazio',400);if(text.length>400)return fail('texto longo demais (máx. 400 caracteres)',400);
 activity(env,'voiceRequests');
 const key=await hash(JSON.stringify([voice,'neural','pt-BR','mp3',text])),prefix='voice-audio:'+key;
 const cached=await storage.get(prefix+':meta');
 if(cached?.until>now&&Number.isInteger(cached.parts)&&cached.parts>0&&cached.parts<=8&&Number.isSafeInteger(cached.bytes)&&cached.bytes>0&&cached.bytes<=MAX_BYTES){
  const chunks=await Promise.all(Array.from({length:cached.parts},(_,i)=>storage.get(prefix+':'+i)));
  if(chunks.every(x=>x instanceof ArrayBuffer||ArrayBuffer.isView(x))&&chunks.reduce((n,x)=>n+x.byteLength,0)===cached.bytes){
   const bytes=new Uint8Array(cached.bytes);let offset=0;for(const chunk of chunks){const a=chunk instanceof ArrayBuffer?new Uint8Array(chunk):new Uint8Array(chunk.buffer,chunk.byteOffset,chunk.byteLength);bytes.set(a,offset);offset+=a.length;}
   if(offset===cached.bytes){activity(env,'voiceCacheHits');return new Response(bytes,{headers:{...headers,'Content-Type':'audio/mpeg','X-Monitor-Voice-Cache':'hit'}});}
  }
 }
 if(!env.AWS_ACCESS_KEY_ID||!env.AWS_SECRET_ACCESS_KEY)return fail('AWS Polly não configurado',501);
 const pause=await storage.get('voice-provider-pause');if(pause>now)return fail('Síntese temporariamente indisponível; usando voz do navegador.');
 const month=new Date(now).toISOString().slice(0,7);let quota=await storage.get('voice-quota');
 if(quota?.month!==month){
  // Fail closed if the old budget cannot be read: never reset usage after a KV failure.
  let old;try{old=await env.TTS_USAGE?.get('usage-'+month);}catch{return fail('Cota de voz temporariamente indisponível.');}
  if(!env.TTS_USAGE)return fail('Cota de voz indisponível.');
  const used=old==null?0:Number(old);if(!Number.isSafeInteger(used)||used<0)return fail('Cota de voz inválida.');quota={month,used};
 }
 if(!Number.isSafeInteger(quota.used)||quota.used<0)return fail('Cota de voz inválida.');
 if(quota.used+text.length>LIMIT){activity(env,'voiceQuotaDenied');return fail('Limite mensal de segurança da voz atingido.',429);}
 // The class serializes requests. Reserve BEFORE calling Polly, including ambiguous failures.
 quota={month,used:quota.used+text.length};await storage.put('voice-quota',quota);activity(env,'voiceSyntheses');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let data;
 try{
  const response=await synthesize(text,env.AWS_ACCESS_KEY_ID,env.AWS_SECRET_ACCESS_KEY,{signal:controller.signal});
  if(!response.ok)throw Error('provider');
  data=new Uint8Array(await response.arrayBuffer());if(!data.length)throw Error('empty');
 }catch{await storage.put('voice-provider-pause',now+60000);return fail('Síntese temporariamente indisponível; usando voz do navegador.',502);}finally{clearTimeout(timer);}
 if(data.byteLength<=MAX_BYTES){
  try{
   let index=await storage.get('voice-cache-index')||[];const keep=[];
   for(const entry of index){if(entry.key===key||entry.until<=now)await remove(storage,entry);else keep.push(entry);}
   while(keep.length>=MAX_CLIPS)await remove(storage,keep.shift());
   const parts=Math.ceil(data.byteLength/CHUNK),until=now+TTL;
   for(let i=0;i<parts;i++)await storage.put(prefix+':'+i,data.slice(i*CHUNK,(i+1)*CHUNK).buffer);
   await storage.put(prefix+':meta',{parts,bytes:data.byteLength,until});keep.push({key,parts,until});await storage.put('voice-cache-index',keep);await storage.setAlarm?.(Math.min(...keep.map(x=>x.until))+1000);
  }catch{console.warn('Voz: áudio entregue sem confirmação de cache.');}
 }
 return new Response(data,{headers:{...headers,'Content-Type':'audio/mpeg','X-Monitor-Voice-Cache':'miss'}});
}

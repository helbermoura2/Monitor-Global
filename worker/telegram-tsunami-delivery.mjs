import {related,compactBulletin,reconcile,bulletinModel,updateHistory,bulletinCaption} from './tsunami-bulletin.mjs';
const KEY='telegram-tsunami-delivery-v1',TTL=72*3600000;
// Called inside the existing serialized EarthquakeAlertDelivery queue, not a new cron/DO.
export async function deliverTsunamiBulletins(env,{read,render,request=fetch,now=Date.now()}={}){
 const storage=env.TSUNAMI_STORAGE;if(!storage||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return {skipped:true};
 let feed;try{feed=await read();}catch{feed={ok:false,items:[]};}
 let records=(await storage.get(KEY)||[]).filter(r=>now-r.at<TTL).slice(-24),changed=false,sent=0,updated=0;
 const candidates=globalThis.TsunamiLink.latest(feed.items||[],now);
 const clusters=[];for(const a of candidates){let cluster=clusters.find(c=>c.some(b=>related(a,b)));if(!cluster){cluster=[];clusters.push(cluster);}cluster.push(a);}
 for(const cluster of clusters){const own=records.find(r=>r.chatId===String(env.TELEGRAM_CHAT_ID)&&(r.bulletins.length?r.bulletins:[r.seed].filter(Boolean)).some(a=>cluster.some(b=>related(a,b))));if(!own&&records.length<24&&cluster.some(a=>!a.cancelled&&a.hazardNature==='warning'&&now-a.time<6*3600000)){records.push({key:crypto.randomUUID(),at:now,chatId:String(env.TELEGRAM_CHAT_ID),bulletins:[],history:[],seed:compactBulletin(cluster[0]),status:'new'});changed=true;}}
 const save=async()=>{await storage.put(KEY,records);changed=false;};
 let actions=0;
 for(const record of records){if(record.chatId!==String(env.TELEGRAM_CHAT_ID)||['sending','uncertain'].includes(record.status))continue;
  const host=record.bulletins[0]||record.seed;if(!host)continue;
  const incoming=candidates.filter(a=>related(host,a)||a.id===host.id),items=reconcile(record.bulletins,{...feed,items:incoming},now),model=bulletinModel(items);
  if(!items.length)continue;if(record.version===model.version)continue;
  if(record.status==='new'&&!model.rows.some(r=>r.active&&!r.stale))continue;
  if(actions>=2)break;actions++;
  const history=updateHistory(record.history,record.bulletins,items);model.history=history;
  let png;try{png=await render(model);}catch{continue;}
  const editing=!!record.messageId,method=editing?'editMessageMedia':'sendPhoto',form=new FormData();form.append('chat_id',record.chatId);
  const caption=bulletinCaption(model),media={type:'photo',media:'attach://card',caption};
  if(editing){form.append('message_id',String(record.messageId));form.append('media',JSON.stringify(media));}else form.append('caption',caption);
  // The original link stays the same as revisions replace the image.
  if(env.ARCHIVE_TELEGRAM_IMAGE)try{record.originalImageKey=await env.ARCHIVE_TELEGRAM_IMAGE(png,record.originalImageKey);const {originalImageButton}=await import('../telegram-image-archive.mjs');form.append('reply_markup',JSON.stringify(originalImageButton(record.originalImageKey)));}catch{}
  form.append(editing?'card':'photo',new Blob([png],{type:'image/png'}),'monitor-global-tsunami.png');
  if(!editing){record.status='sending';await save();}
  try{
   const response=await request('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',body:form}),data=await response.json().catch(()=>({}));
   if((!response.ok||!data.ok)&&!(editing&&/message is not modified/i.test(data.description||''))){const error=Error('Telegram rejected bulletin');error.definite=response.status>=400&&response.status<500||data.ok===false;throw error;}
   if(!editing&&!Number.isSafeInteger(data.result?.message_id)){record.status='uncertain';await save();continue;}
   record.messageId=record.messageId||data.result.message_id;record.status='sent';record.version=model.version;record.bulletins=items.map(compactBulletin);record.history=history;record.at=now;delete record.seed;await save();editing?updated++:sent++;
  }catch(error){if(!editing){record.status=error.definite?'new':'uncertain';await save();}}
 }
 if(changed)await save();return {sent,updated};
}

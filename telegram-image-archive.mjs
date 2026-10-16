// Original PNGs are public only through the link on their public Telegram message.
const PREFIX='telegram-original:',INDEX=PREFIX+'index',CHUNK=65536,MAX_BYTES=6*1024*1024,MAX_IMAGES=64,TTL=72*3600000;
const validKey=key=>/^[a-f0-9-]{36}$/.test(key);
const chunkKey=(key,i)=>`${PREFIX}${key}:part:${i}`;
export function originalImageButton(key,day=null){if(day)return {inline_keyboard:[[{text:'Baixar resumo original em alta resolução',url:'https://black-sky-9ba0.terrestre.workers.dev/telegram-summary-image/'+day+'/'+key}]]};return {inline_keyboard:[[{text:'Baixar imagem original em Full HD',url:'https://black-sky-9ba0.terrestre.workers.dev/telegram-image/'+key}]]};}
export async function archiveTelegramOriginal(storage,png,key=crypto.randomUUID(),{summary=false}={}){
 if(!validKey(key)||!(png instanceof Uint8Array)||png.length<24||png.length>MAX_BYTES||!png.subarray(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))throw Error('PNG original inválido');
 const view=new DataView(png.buffer,png.byteOffset,png.byteLength);
 const width=view.getUint32(16),height=view.getUint32(20);
 if(summary?width!==1800||height<2688||height>12000:width!==1080||height!==1920)throw Error('Resolução original inválida');
 const now=Date.now(),parts=Math.ceil(png.length/CHUNK),meta={key,parts,bytes:png.length,width,height,until:now+TTL,updatedAt:now};
 const old=await storage.get(PREFIX+key),index=(await storage.get(INDEX))||[],all=[...index.filter(x=>x.key!==key),meta];
 const keep=all.filter(x=>x.until>now).slice(-MAX_IMAGES),remove=all.filter(x=>!keep.some(k=>k.key===x.key));
 const writes={[PREFIX+key]:meta,[INDEX]:keep};
 for(let i=0;i<parts;i++)writes[chunkKey(key,i)]=png.slice(i*CHUNK,(i+1)*CHUNK);
 await storage.put(writes);
 const deletes=[];
 if(old)for(let i=parts;i<old.parts;i++)deletes.push(chunkKey(key,i));
 for(const item of remove){deletes.push(PREFIX+item.key);for(let i=0;i<item.parts;i++)deletes.push(chunkKey(item.key,i));}
 for(let i=0;i<deletes.length;i+=128)await storage.delete(deletes.slice(i,i+128));
 return key;
}
export async function serveTelegramOriginal(request,storage){
 if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405,headers:{Allow:'GET, HEAD'}});
 const key=new URL(request.url).pathname.split('/').at(-1);
 if(!validKey(key))return new Response('Imagem não encontrada',{status:404});
 const meta=await storage.get(PREFIX+key);
 if(!meta||meta.until<Date.now())return new Response('O original não está mais disponível',{status:404});
 if(!Number.isInteger(meta.parts)||meta.parts<1||meta.parts>96||meta.bytes>MAX_BYTES)return new Response('Original indisponível',{status:503});
 const headers={'Content-Type':'image/png','Content-Disposition':'attachment; filename="monitor-global-full-hd.png"','Content-Length':String(meta.bytes),'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','X-Image-Resolution':meta.width+'x'+meta.height};
 if(request.method==='HEAD')return new Response(null,{headers});
 const keys=Array.from({length:meta.parts},(_,i)=>chunkKey(key,i)),chunks=await storage.get(keys),png=new Uint8Array(meta.bytes);
 for(let i=0;i<keys.length;i++){const bytes=chunks.get(keys[i]);if(!(bytes instanceof Uint8Array)||bytes.length!==Math.min(CHUNK,meta.bytes-i*CHUNK))return new Response('Original indisponível',{status:503});png.set(bytes,i*CHUNK);}
 return new Response(png,{headers});
}

// Daily objects do not receive another image the next day; expire their chunks
// by alarm while retaining the delivery/history records.
export async function pruneTelegramOriginals(storage,now=Date.now()){
 const index=(await storage.get(INDEX))||[],expired=index.filter(x=>x.until<=now),keep=index.filter(x=>x.until>now);
 const keys=expired.flatMap(x=>[PREFIX+x.key,...Array.from({length:x.parts},(_,i)=>chunkKey(x.key,i))]);
 for(let i=0;i<keys.length;i+=128)await storage.delete(keys.slice(i,i+128));
 await storage.put({[INDEX]:keep});
 if(keep.length&&storage.setAlarm)await storage.setAlarm(Math.min(...keep.map(x=>x.until))+1000);
 return expired.length;
}

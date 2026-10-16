import {test} from 'node:test';import assert from 'node:assert/strict';
import {archiveTelegramOriginal,serveTelegramOriginal,originalImageButton,pruneTelegramOriginals} from '../../telegram-image-archive.mjs';
class Storage{data=new Map();async get(key){if(Array.isArray(key))return new Map(key.filter(k=>this.data.has(k)).map(k=>[k,this.data.get(k)]));return this.data.get(key);}async put(values){assert(Object.keys(values).length<=128);for(const [k,v]of Object.entries(values)){if(v instanceof Uint8Array)assert(v.byteLength<=128*1024);this.data.set(k,v);}}async delete(keys){assert(keys.length<=128);for(const k of keys)this.data.delete(k);}}
function png(bytes=170000){const p=new Uint8Array(bytes).fill(42);p.set([137,80,78,71,13,10,26,10]);new DataView(p.buffer).setUint32(16,1080);new DataView(p.buffer).setUint32(20,1920);return p;}
const request=(key,method='GET')=>new Request('https://local/telegram-image/'+key,{method});
test('original PNG is returned byte-for-byte with Full HD dimensions and download headers',async()=>{
 const storage=new Storage(),image=png(),key=await archiveTelegramOriginal(storage,image),response=await serveTelegramOriginal(request(key),storage);
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.match(response.headers.get('Content-Disposition'),/attachment/);assert.equal(response.headers.get('X-Image-Resolution'),'1080x1920');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),image);
 assert.equal(originalImageButton(key).inline_keyboard[0][0].url,'https://black-sky-9ba0.terrestre.workers.dev/telegram-image/'+key);
 const head=await serveTelegramOriginal(request(key,'HEAD'),storage);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('Content-Length'),String(image.length));
});
test('revisions keep the original link and replace its bytes without leaving old chunks',async()=>{
 const storage=new Storage(),key=await archiveTelegramOriginal(storage,png());const revised=png(40);revised[30]=99;
 assert.equal(await archiveTelegramOriginal(storage,revised,key),key);assert(!storage.data.has('telegram-original:'+key+':part:1'));assert.deepEqual(new Uint8Array(await (await serveTelegramOriginal(request(key),storage)).arrayBuffer()),revised);
});
test('retention and 64-image limit prevent an unbounded archive; no public write or listing',async()=>{
 const storage=new Storage(),now=Date.now();let first;
 for(let i=0;i<65;i++){const key=await archiveTelegramOriginal(storage,png(40));first ||=key;}
 assert.equal(storage.data.get('telegram-original:index').length,64);assert.equal((await serveTelegramOriginal(request(first),storage)).status,404);
 const key=storage.data.get('telegram-original:index')[0].key;storage.data.get('telegram-original:'+key).until=now-1;
 assert.equal((await serveTelegramOriginal(request(key),storage)).status,404);
 assert.equal((await serveTelegramOriginal(request(key,'POST'),storage)).status,405);assert.equal((await serveTelegramOriginal(request('../index'),storage)).status,404);
 await assert.rejects(archiveTelegramOriginal(storage,new Uint8Array([137,80,78,71])));const wrong=png(40);new DataView(wrong.buffer).setUint32(16,800);await assert.rejects(archiveTelegramOriginal(storage,wrong));
});
test('daily summary original keeps its native 1800px width and variable height',async()=>{
 const storage=new Storage(),image=png(80000);new DataView(image.buffer).setUint32(16,1800);new DataView(image.buffer).setUint32(20,3000);
 const key=await archiveTelegramOriginal(storage,image,undefined,{summary:true});const response=await serveTelegramOriginal(request(key),storage);assert.equal(response.headers.get('X-Image-Resolution'),'1800x3000');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),image);assert.match(originalImageButton(key,'2026-10-15').inline_keyboard[0][0].url,/telegram-summary-image\/2026-10-15\//);await assert.rejects(archiveTelegramOriginal(storage,image));
});

test('daily archive expiry deletes image chunks but retains its delivery history',async()=>{
 const storage=new Storage(),key=await archiveTelegramOriginal(storage,png());storage.data.set('history',{status:'sent'});const until=storage.data.get('telegram-original:'+key).until;assert.equal(await pruneTelegramOriginals(storage,until+1),1);assert(!storage.data.has('telegram-original:'+key+':part:0'));assert.deepEqual(storage.data.get('history'),{status:'sent'});
});

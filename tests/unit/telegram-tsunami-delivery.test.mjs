import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {deliverTsunamiBulletins} from '../../worker/telegram-tsunami-delivery.mjs';
import {bulletinModel,coastalMap,related,reconcile} from '../../worker/tsunami-bulletin.mjs';
import {renderTsunamiImage} from '../../worker/tsunami-rendering.mjs';import {decodePng} from '../../worker/image-rendering.mjs';
const now=Date.now(),warning=(extra={})=>({id:'warning',feedKey:'PTWC-Pacific',source:'PTWC',time:now-60000,type:'tsunami',official:true,coords:[165.55,-14.06],coordinateRole:'earthquake-origin',originTime:now-120000,originMag:6.9,originDepth:10,officialEventId:'PHEB:event',hazardNature:'warning',warningLevel:'Aviso',affectedAreas:[{name:'Vanuatu',category:'Warning',radiusKm:300}],link:'https://www.tsunami.gov/',...extra});
const safe=warning({id:'safe',source:'NTWC',feedKey:'NTWC-General',officialEventId:'PAAQ:anotherId',hazardNature:'bulletin',affectedAreas:[{name:'Alaska',category:'No tsunami threat'}]});
class Storage{data=new Map();async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}}
function setup(){const storage=new Storage(),env={TSUNAMI_STORAGE:storage,TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_CHAT_ID:'qa'},messages=[],models=[];let feed={ok:true,items:[warning(),safe]},id=70;
 const options={now,read:async()=>feed,render:async model=>{models.push(model);return new Uint8Array([137,80,78,71]);},request:async(url,o)=>{messages.push({url,form:o.body});return Response.json({ok:true,result:{message_id:++id}});}};
 return {env,messages,models,options,setFeed:f=>feed=f,run:()=>deliverTsunamiBulletins(env,options)};}
test('one dedicated photo; independent regional no-threat and cancellation edit original, restart stays idempotent',async()=>{
 const s=setup();assert.deepEqual(await s.run(),{sent:1,updated:0});assert.equal(s.messages.length,1);assert.match(s.messages[0].url,/sendPhoto$/);assert.match(s.messages[0].form.get('caption'),/Vanuatu/);assert.match(s.messages[0].form.get('caption'),/Alasca/);assert.equal(s.models[0].groups.length,2);await s.run();assert.equal(s.messages.length,1);
 const cancel=warning({id:'cancel',time:now,cancelled:true,hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]});s.setFeed({ok:true,items:[cancel,safe]});await s.run();assert.match(s.messages[1].url,/editMessageMedia$/);assert.equal(s.messages[1].form.get('message_id'),'71');assert.equal(s.models[1].rows.find(r=>r.region==='Vanuatu').state,'ended');assert.equal(s.models[1].rows.find(r=>r.region==='Alaska').state,'noThreat');assert.equal(s.models[1].history.length,2);await deliverTsunamiBulletins(s.env,s.options);assert.equal(s.messages.length,2);
});
test('failed or out-of-order feed retains latest product as unavailable, never invents cancellation',async()=>{
 const s=setup();await s.run();s.setFeed({ok:false,items:[]});await s.run();assert(s.models.at(-1).rows.every(r=>r.stale));assert.equal(s.models.at(-1).state,'unknown');await s.run();assert.equal(s.messages.length,2);
 const cancel=warning({id:'cancel',time:now,cancelled:true,hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]});assert.equal(reconcile([cancel],{ok:true,items:[warning()]},now)[0].cancelled,true);
});
test('no-threat-only, old warnings and unlocated unrelated products do not create alarm photos',async()=>{
 const s=setup();s.setFeed({ok:true,items:[safe]});await s.run();assert.equal(s.messages.length,0);s.setFeed({ok:true,items:[warning({time:now-7*3600000})]});await s.run();assert.equal(s.messages.length,0);
 assert(!related(warning(),warning({id:'other',officialEventId:'other',coords:[-80,8],originTime:now-120000})));assert(!related(warning(),warning({id:'aftershock',officialEventId:'PHEB:different',originTime:now-90000})));assert(!related(warning(),warning({id:'coastal',officialEventId:'different',coordinateRole:'warning-area'})));
});
test('ambiguous initial send is never repeated, explicit rejection can retry, edits remain retryable',async()=>{
 const s=setup();s.options.request=async()=>{s.messages.push('timeout');throw Error('timeout');};await s.run();await s.run();assert.equal(s.messages.length,1);
 const r=setup();let count=0;r.options.request=async()=>{count++;return count===1?Response.json({ok:false},{status:400}):Response.json({ok:true,result:{message_id:5}});};await r.run();await r.run();await r.run();assert.equal(count,2);
});
test('map uses actual coastline references, applies official radius, excludes remote no-threat coasts and handles dateline',async()=>{
 const regions=JSON.parse(await readFile('assets/tsunami/ne-50m-coastal-regions.geojson','utf8')),model=bulletinModel([warning(),safe]),map=coastalMap(model,regions);assert(map.lines.length);assert(!map.unmapped.length);assert(map.frame.maxLon-map.frame.minLon<20);
 for(const l of map.lines)for(const p of l.points)assert(TsunamiLink.distance(warning().coords,p)<=300.001);
 const dateline=coastalMap(bulletinModel([warning({coords:[179.8,-16],affectedAreas:[{name:'Fiji',category:'Warning'}]})]),regions);assert(dateline.frame.maxLon-dateline.frame.minLon<30);
});
test('dedicated card renders Full HD offline with reference coasts and missing imagery, without earthquake rings',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('Offline',{status:503});try{
 const regions=JSON.parse(await readFile('assets/tsunami/ne-50m-coastal-regions.geojson','utf8')),model=bulletinModel([warning(),safe],[{time:now-60000,source:'PTWC',label:'Aviso',regions:['Vanuatu']},{time:now,source:'NTWC',label:'Sem ameaça',regions:['Alasca']}]);
 const png=await renderTsunamiImage(model,{regions}),image=await decodePng(png);assert.equal(image.width,1080);assert.equal(image.height,1920);assert(png.length>10000);await writeFile('/tmp/telegram-tsunami-coastal-qa.png',png);
 }finally{globalThis.fetch=old;}
});

test('cancellation with no repeated geography retains only its previous product scope; failed edits retry same ID',async()=>{
 const s=setup();await s.run();const cancel=warning({id:'empty-cancel',time:now,cancelled:true,hazardNature:'bulletin',affectedAreas:[]});s.setFeed({ok:true,items:[cancel,safe]});
 let requests=0;s.options.request=async(url,o)=>{requests++;s.messages.push({url,form:o.body});if(requests===1)throw Error('edit timeout');return Response.json({ok:true,result:{message_id:71}});};
 await s.run();await s.run();await s.run();assert.equal(requests,2);assert(s.messages.slice(1).every(m=>m.form.get('message_id')==='71'));assert(s.models.at(-1).rows.some(r=>r.region==='Vanuatu'&&r.state==='ended'));assert(s.models.at(-1).rows.some(r=>r.region==='Alaska'&&r.state==='noThreat'));
});

const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.use({serviceWorkers:'block'});
test('Concept 6 static composition exports every event family and missing-data states',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/404.html',{waitUntil:'domcontentloaded'});
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1080;c.height=1760;const x=c.getContext('2d');x.fillStyle='#274934';x.fillRect(0,0,1080,1760);for(let i=0;i<100;i++){x.strokeStyle=i%2?'#789f81':'#1b352b';x.beginPath();x.moveTo(i*31%1080,0);x.lineTo(i*57%1080,1760);x.stroke();}return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(fixture,'base64')}));
 await page.addScriptTag({url:'/js/event-portuguese.js'});await page.addScriptTag({url:'/js/quake-site-flags.js'});
 await page.addScriptTag({url:'/js/site-event-story.js'});
 const types=['earthquake','capital-weather','temperature','fire','storm','hurricane','tornado','tsunami','civil','wind','flood','volcano'];
 for(const type of types){
  const result=await page.evaluate(async(type)=>{
   const e={type,id:'qa-'+type,coords:[-36.24,-8.67],place:'Lajedo/PE · EXEMPLO',countryCode:'BR',uf:'PE',time:Date.UTC(2026,10,8,5,26),source:'QA · EXEMPLO',depth:0,mag:1.8,temperature:24,feels:25,humidity:70,wind:9,condition:type==='capital-weather'?'Condição de exemplo':'',windKmh:140,pressureMb:980};
   const texts=[],original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.width===1080&&this.canvas.height===1920)texts.push(String(t));return original.call(this,t,...a);};
   try{const c=await SiteEventStory.render(e);return {png:c.toDataURL(),texts,profile:SiteEventStory.profile(e)};}finally{CanvasRenderingContext2D.prototype.fillText=original;}
  },type);
  expect(result.texts.join(' ')).toContain('MONITOR GLOBAL');expect(result.texts.join(' ')).toContain('CONTEXTO REGIONAL');expect(result.texts.join(' ')).toContain('@monitor_global');expect(result.texts.join(' ')).toContain('08/11/2026');
  if(['temperature','capital-weather'].includes(type)){expect(result.profile.marker).toBe('LOCAL DA PREVISÃO');expect(result.texts.join(' ')).toContain('24 °C');expect(result.texts.join(' ')).not.toContain('EPICENTRO');expect(result.texts.join(' ')).not.toContain('PROFUNDIDADE');}
  if(type==='earthquake'){expect(result.profile.marker).toBe('EPICENTRO · M1,8');expect(result.texts.join(' ')).toContain('0 km');}
  const data=Buffer.from(result.png.split(',')[1],'base64');expect(data.readUInt32BE(16)).toBe(1080);expect(data.readUInt32BE(20)).toBe(1920);
  if(['earthquake','capital-weather','flood'].includes(type)){fs.mkdirSync('/tmp/share-concept6',{recursive:true});fs.writeFileSync('/tmp/share-concept6/'+type+'.png',data);}
 }
 const missing=await page.evaluate(async()=>{const texts=[],original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){texts.push(String(t));return original.call(this,t,...a);};try{await SiteEventStory.render({type:'temperature',coords:[],place:'Região sem ponto',temperature:0,feels:null,humidity:null,wind:null});return texts.join(' ');}finally{CanvasRenderingContext2D.prototype.fillText=original;}});
 const official=await page.evaluate(()=>{window.QuakeImagePaint={estimatedMmi:()=> 'I'};window.RuptureShakingModel={valid:()=>true,sample:()=>6};const e={type:'earthquake',mag:1.8,depth:0,coords:[-36.24,-8.67],shaking:{status:'available',grid:{}}};const known=SiteEventStory.profile(e).stats[1];RuptureShakingModel.sample=()=>null;return {known,missing:SiteEventStory.profile(e).stats[1]};});
 expect(official.known).toEqual(['INTENSIDADE · MMI','VI · Forte']);expect(official.missing[1]).toBe('Indisponível');
 expect(missing).toContain('localização pontual não informada');expect(missing).toContain('0 °C');expect(missing).toContain('Não informado');expect(missing).not.toContain('0 km/h');
});
test('Temperature image action resolves the selected weather record and exports Concept 6',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/?verify=share-concept6-all',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.CapitalWeather&&!!window.EventStore&&!!window.RecordPresentation);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);CapitalWeather.ingest([{cidade:'São Paulo',estado:'SP',temp:24,umidade:70,vento:9,atualizado_em:new Date().toISOString(),condicao_desc:'Condição de exemplo'}]);const row=CapitalWeather.records().find(r=>r.uf==='SP');if(!row)throw Error('Weather fixture missing');CapitalWeather.show(row);clearTimeout(cycleTimeout);Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});

 const mapFixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#274934';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(mapFixture,'base64')}));
 await expect(page.locator('#pd-share-btn')).toBeVisible();await expect(page.locator('#pd-video-btn')).toBeHidden();
 const download=page.waitForEvent('download');await page.locator('#pd-share-btn').click();const file=await download;
 expect(file.suggestedFilename()).toContain('evento-capital-weather-');expect(await page.evaluate(()=>SiteEventStory.version)).toBe('site-concept6-all-v4');await expect(page.locator('#pd-share-btn')).toBeEnabled();
});

test('Visual proof with bounded real satellite imagery and explicitly fictional event data',async({page})=>{
 test.skip(process.env.STORY_LIVE_PREVIEW!=='1','Live source proof is opt-in.');test.setTimeout(60000);
 const https=require('node:https');let count=0,loaded=0;
 const read=url=>new Promise((resolve,reject)=>{const req=https.get(url,{headers:{'User-Agent':'MonitorGlobal/site-sharing-layout-proof'}},res=>{if(res.statusCode!==200){res.resume();return reject(Error('Source HTTP '+res.statusCode));}const chunks=[];let length=0;res.on('data',b=>{length+=b.length;if(length>8000000){req.destroy();reject(Error('Source byte limit'));}else chunks.push(b);});res.on('end',()=>{const b=Buffer.concat(chunks);if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'&&b.subarray(0,2).toString('hex')!=='ffd8')return reject(Error('Source did not return imagery'));resolve(b);});});req.setTimeout(6000,()=>req.destroy(Error('Source timeout')));req.on('error',reject);});
 await page.route('https://server.arcgisonline.com/**',async r=>{if(++count>32)return r.abort();try{const png=await read(r.request().url());loaded++;await r.fulfill({contentType:png[0]===255?'image/jpeg':'image/png',headers:{'access-control-allow-origin':'*'},body:png});}catch(error){console.log('LIVE_IMAGE_SOURCE_UNAVAILABLE '+error.message);await r.abort();}});
 await page.goto('/404.html',{waitUntil:'domcontentloaded'});await page.addScriptTag({url:'/js/event-portuguese.js'});await page.addScriptTag({url:'/js/quake-site-flags.js'});await page.addScriptTag({url:'/js/site-event-story.js'});
 await page.evaluate(()=>{window.QuakeSiteCard={frame:({lon,lat})=>({minLon:lon-.17578125,maxLon:lon+.17578125,minLat:lat-.28645833,maxLat:lat+.28645833})};});
 for(const [type,coords,place]of [['earthquake',[-36.24,-8.67],'Lajedo/PE · EXEMPLO'],['capital-weather',[-46.63,-23.55],'São Paulo/SP · EXEMPLO'],['earthquake', [176.51,-37.83], '30 km south-a leste de Tauranga, Nova Zelândia · EXEMPLO']]){
  const png=await page.evaluate(async({type,coords,place})=>{const c=await SiteEventStory.render({type,coords,place,countryCode:coords[0]>0?'NZ':'BR',uf:coords[0]>0?undefined:type==='earthquake'?'PE':'SP',time:Date.now(),mag:1.8,depth:0,temperature:24,feels:25,humidity:70,wind:9,source:'DADOS DE EXEMPLO',detail:'PRÉVIA DE LAYOUT · evento fictício sobre imagem cartográfica real'});return c.toDataURL().split(',')[1];},{type,coords,place});
  fs.mkdirSync('/tmp/share-concept6',{recursive:true});fs.writeFileSync('/tmp/share-concept6/live-'+type+(coords[0]>0?'-nz':'')+'.png',Buffer.from(png,'base64'));
 }
 console.log('LIVE_IMAGE_PROOF '+JSON.stringify({requests:count,loaded}));expect(count).toBeLessThanOrEqual(32);
});

test('Fresh tsunami warnings are conditional and place typography outranks the category',async({page})=>{
 await page.goto('/404.html');await page.addScriptTag({url:'/js/site-event-story.js'});
 const result=await page.evaluate(()=>{
  const base={type:'earthquake',coords:[-36.24,-8.67],mag:1.8,depth:0};
  const states=['warning','watch','advisory','noThreat','cancelled','unknown'];
  return {fields:states.map(state=>({state,label:SiteEventStory.profile({...base,imageTsunami:{state,stale:false}}).stats[2][0]})),stale:SiteEventStory.profile({...base,imageTsunami:{state:'warning',stale:true}}).stats[2],absent:SiteEventStory.profile(base).stats[2]};
 });
 for(const r of result.fields)expect(r.label).toBe(['warning','watch','advisory'].includes(r.state)?'TSUNAMI':'COORDENADAS');
 expect(result.stale[0]).toBe('COORDENADAS');expect(result.absent).toEqual(['COORDENADAS','8,67° S · 36,24° O']);
});

test('Satellite tile recovery preserves the event frame; total failure rejects a blank export',async({page})=>{
 await page.goto('/404.html');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#496a32';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];});
 let tiles=0;
 await page.route('https://server.arcgisonline.com/**',r=>{if(!r.request().url().includes('/tile/'))return r.abort();tiles++;return r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(png,'base64')});});
 await page.addScriptTag({url:'/js/site-event-story.js'});
 const out=await page.evaluate(async()=>{
  const drawn=[],rotations=[],original=CanvasRenderingContext2D.prototype.fillText,rotate=CanvasRenderingContext2D.prototype.rotate;
  CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.width===1080&&this.canvas.height===1920)drawn.push({text:String(t),font:this.font});return original.call(this,t,...a);};
  CanvasRenderingContext2D.prototype.rotate=function(a){rotations.push(a);return rotate.call(this,a);};
  try{const c=await SiteEventStory.render({type:'earthquake',coords:[-36.24,-8.67],mag:1.8,place:'Lajedo/PE'});return {w:c.width,h:c.height,drawn,rotations};}finally{CanvasRenderingContext2D.prototype.fillText=original;CanvasRenderingContext2D.prototype.rotate=rotate;}
 });
 expect(tiles).toBeGreaterThan(0);expect(tiles).toBeLessThanOrEqual(12);expect(out.w).toBe(1080);expect(out.h).toBe(1920);expect(out.rotations).toEqual([]);
 const size=t=>parseInt(out.drawn.find(x=>x.text===t).font.match(/(\d+)px/)[1]);expect(size('Lajedo/PE')).toBeGreaterThan(size('SISMO'));
 await page.unroute('https://server.arcgisonline.com/**');await page.route('https://server.arcgisonline.com/**',r=>r.abort());
 // A new event frame must not reuse another location's cached image.
 const failure=await page.evaluate(async()=>{try{await SiteEventStory.render({type:'temperature',coords:[-46.63,-23.55],temperature:24});return 'blank accepted';}catch(e){return e.code;}});
 expect(failure).toBe('STORY_MAP_UNAVAILABLE');
});


test('Complete translated location occupies its own row without truncation or header collisions',async({page})=>{
 await page.goto('/404.html');
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(fixture,'base64')}));
 await page.addScriptTag({url:'/js/event-portuguese.js'});await page.addScriptTag({url:'/js/site-event-story.js'});
 const result=await page.evaluate(async()=>{
  const drawn=[],original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(t,x,y,...a){if(this.canvas.width===1080&&this.canvas.height===1920)drawn.push({text:String(t),x,y,font:this.font,width:this.measureText(t).width});return original.call(this,t,x,y,...a);};
  try{await SiteEventStory.render({type:'earthquake',coords:[176.51,-37.83],mag:1.9,depth:134.5,place:'30 km south-a leste de Tauranga, Nova Zelândia'});return drawn;}finally{CanvasRenderingContext2D.prototype.fillText=original;}
 });
 const location=result.filter(r=>r.y>=292&&r.y<415&&r.x===98);expect(location.map(r=>r.text).join(' ')).toBe('30 km a sudeste de Tauranga, Nova Zelândia');
 for(const row of location){expect(row.text).not.toContain('…');expect(row.x+row.width).toBeLessThanOrEqual(982);}
 const region=result.find(r=>r.text==='CONTEXTO REGIONAL');expect(region.y).toBeGreaterThan(location.at(-1).y+38);
 expect(result.filter(r=>r.x===764&&[1520,1557].includes(r.y)).map(r=>r.text)).toEqual(['37,83° S','176,51° L']);
 expect(parseInt(result.find(r=>r.text==='PROFUNDIDADE').font.match(/(\d+)px/)[1])).toBeGreaterThanOrEqual(18);
});

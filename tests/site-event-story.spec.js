const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.use({serviceWorkers:'block'});
test('the cartographic card static composition exports every event family and missing-data states',async({page})=>{
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
  expect(result.texts).toContain('Telegram · ARGOS ORBIS');expect(result.texts.join(' ')).toContain('08/11/2026');
  if(['temperature','capital-weather'].includes(type)){expect(result.profile.marker).toBe('LOCAL DA PREVISÃO');expect(result.texts.join(' ')).toContain('24 °C');expect(result.texts.join(' ')).not.toContain('EPICENTRO');expect(result.texts.join(' ')).not.toContain('PROFUNDIDADE');}
  if(type==='earthquake'){expect(result.profile.marker).toBeNull();expect(result.texts).toContain('M1,8');expect(result.texts.join(' ')).not.toContain('EPICENTRO');expect(result.texts.join(' ')).toContain('0 km');}
  const data=Buffer.from(result.png.split(',')[1],'base64');expect(data.readUInt32BE(16)).toBe(1080);expect(data.readUInt32BE(20)).toBe(1920);
  if(['earthquake','capital-weather','flood'].includes(type)){fs.mkdirSync('/tmp/share-concept6',{recursive:true});fs.writeFileSync('/tmp/share-concept6/'+type+'.png',data);}
 }
 const missing=await page.evaluate(async()=>{const texts=[],original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){texts.push(String(t));return original.call(this,t,...a);};try{await SiteEventStory.render({type:'temperature',coords:[],place:'Região sem ponto',temperature:0,feels:null,humidity:null,wind:null});return texts.join(' ');}finally{CanvasRenderingContext2D.prototype.fillText=original;}});
 const official=await page.evaluate(()=>{window.QuakeImagePaint={estimatedMmi:()=> 'I'};window.RuptureShakingModel={valid:()=>true,sample:()=>6};const e={type:'earthquake',mag:1.8,depth:0,coords:[-36.24,-8.67],shaking:{status:'available',grid:{}}};const known=SiteEventStory.profile(e).stats[1];RuptureShakingModel.sample=()=>null;return {known,missing:SiteEventStory.profile(e).stats[1]};});
 expect(official.known).toEqual(['INTENSIDADE · MMI','VI · Forte']);expect(official.missing[1]).toBe('Indisponível');
 expect(missing).toContain('localização pontual não informada');expect(missing).toContain('0 °C');expect(missing).toContain('Não informado');expect(missing).not.toContain('0 km/h');
});
test('Temperature image action resolves the selected weather record and exports the cartographic card',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/?verify=share-concept6-all',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.CapitalWeather&&!!window.EventStore&&!!window.RecordPresentation);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);CapitalWeather.ingest([{cidade:'São Paulo',estado:'SP',temp:24,umidade:70,vento:9,atualizado_em:new Date().toISOString(),condicao_desc:'Condição de exemplo'}]);const row=CapitalWeather.records().find(r=>r.uf==='SP');if(!row)throw Error('Weather fixture missing');CapitalWeather.show(row);clearTimeout(cycleTimeout);Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});

 const mapFixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#274934';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(mapFixture,'base64')}));
 await expect(page.locator('#pd-share-btn')).toBeVisible();await expect(page.locator('#pd-video-btn')).toBeHidden();
 const download=page.waitForEvent('download');await page.locator('#pd-share-btn').click();const file=await download;
 expect(file.suggestedFilename()).toContain('evento-capital-weather-');expect(await page.evaluate(()=>SiteEventStory.version)).toBe('argos-cartographic-v4');await expect(page.locator('#pd-share-btn')).toBeEnabled();
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

test('Fresh tsunami warnings are conditional and coordinates remain available for other events',async({page})=>{
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
 const size=t=>parseInt(out.drawn.find(x=>x.text===t).font.match(/(\d+)px/)[1]);expect(size('SISMO')).toBeGreaterThan(size('Lajedo/PE'));
 await page.unroute('https://server.arcgisonline.com/**');await page.route('https://server.arcgisonline.com/**',r=>r.abort());
 // A new event frame must not reuse another location's cached image.
 const failure=await page.evaluate(async()=>{try{await SiteEventStory.render({type:'temperature',coords:[-46.63,-23.55],temperature:24});return 'blank accepted';}catch(e){return e.code;}});
 expect(failure).toBe('STORY_MAP_UNAVAILABLE');
});


test('Complete translated location occupies its own row without truncation or header collisions',async({page})=>{
 await page.route('**/argos-share-engraving.webp',route=>route.abort());
 await page.goto('/404.html');
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(fixture,'base64')}));
 await page.addScriptTag({url:'/js/event-portuguese.js'});await page.addScriptTag({url:'/js/site-event-story.js'});
 const result=await page.evaluate(async()=>{
  const drawn=[],original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(t,x,y,...a){if(this.canvas.width===1080&&this.canvas.height===1920)drawn.push({text:String(t),x,y,font:this.font,width:this.measureText(t).width});return original.call(this,t,x,y,...a);};
  try{await SiteEventStory.render({type:'earthquake',coords:[176.51,-37.83],mag:1.9,depth:134.5,place:'30 km south-a leste de Tauranga, Nova Zelândia'});return drawn;}finally{CanvasRenderingContext2D.prototype.fillText=original;}
 });
 const location=result.filter(r=>r.y>=289&&r.y<379);expect(location.map(r=>r.text).join(' ')).toBe('30 km a sudeste de Tauranga, Nova Zelândia');
 expect(location[0].font).toMatch(/^(bold|700) /);expect(location[1].font).toMatch(/^500 /);
 for(const row of location){expect(row.text).not.toContain('…');expect(row.x+row.width).toBeLessThanOrEqual(1025);}
 const region=result.find(r=>r.text==='CONTEXTO REGIONAL');expect(region.y).toBeGreaterThan(location.at(-1).y+38);
 expect(result.filter(r=>r.x===764&&[1520,1557].includes(r.y)).map(r=>r.text)).toEqual(['37,83° S','176,51° L']);
 expect(parseInt(result.find(r=>r.text==='PROFUNDIDADE').font.match(/(\d+)px/)[1])).toBeGreaterThanOrEqual(18);
});

test('Storm card says TEMPESTADE, while general CGE reports stay informative',async({page})=>{
 await page.goto('/404.html');
 await page.addScriptTag({url:'/js/site-event-story.js'});
 await page.addScriptTag({url:'/js/cge-bulletins.js'});
 const result=await page.evaluate(()=>{
  const now=Date.now(),bulletin=CgeBulletins.fromBulletin({sourceId:'56051',title:'Sol entre nuvens',summary:'Temperatura amena',description:'Céu com nuvens',time:now-1000,displayUntil:now+3600000},now);
  return {bulletinType:bulletin.type,bulletinProfile:SiteEventStory.profile(bulletin),storm:SiteEventStory.profile({type:'storm',hazardNature:'warning',severityLabel:'Perigo',coords:[-46.6,-23.5]})};
 });
 expect(result.bulletinType).toBe('civil');
 expect(result.bulletinProfile.title).toBe('BOLETIM CGE');
 expect(result.bulletinProfile.metric).toBe('INFORMATIVO');
 expect(result.bulletinProfile.marker).toBe('REFERÊNCIA MUNICIPAL');
 expect(result.storm.title).toBe('TEMPESTADE');
 expect(result.storm.metric).toBe('TEMPESTADE');
 expect(result.storm.metric).not.toBe('REGISTRO');
});

test('Country flags sit next to the locality, and the main temperature is right-aligned',async({page})=>{
 await page.goto('/404.html',{waitUntil:'domcontentloaded'});
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(image,'base64')}));
 await page.addScriptTag({url:'/js/site-event-story.js'});
 const checked=await page.evaluate(async()=>{
  const flag=document.createElement('canvas');flag.width=90;flag.height=60;
  const fg=flag.getContext('2d');fg.fillStyle='#00aacc';fg.fillRect(0,0,90,60);
  window.QuakeSiteFlags={resolve:async()=>({countryCode:'BS'}),images:async()=>({country:flag})};
  const drawn=[],original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
   if(this.canvas.width===1080&&this.canvas.height===1920&&img===flag)drawn.push(args);
   return original.call(this,img,...args);
  };
  try{
   const c=await SiteEventStory.render({type:'temperature',coords:[-77.35,25.06],temperature:28.6,condition:'Céu limpo',place:'Nassau · Bahamas'});
   return {flags:drawn,width:c.width,height:c.height};
  }finally{CanvasRenderingContext2D.prototype.drawImage=original;}
 });
 expect(checked.flags).toHaveLength(1);
 expect(checked.flags[0][0]).toBeGreaterThan(350);
 expect(checked.flags[0][0]).toBeLessThan(650);
 expect(checked.flags[0][1]).toBeGreaterThan(280);
 expect(checked.flags[0][1]).toBeLessThan(360);
 expect(checked.flags[0].slice(2)).toEqual([90,60]);
});

test('Magnitude keeps the gold badge across severity bands',async({page})=>{
 await page.goto('/404.html',{waitUntil:'domcontentloaded'});
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(fixture,'base64')}));
 await page.addScriptTag({url:'/js/site-event-story.js'});
 const result=await page.evaluate(async()=>{
  const results=[];
  for(const mag of [2.1,4.2,5.5,6.6]){
   const traced=[],proto=CanvasRenderingContext2D.prototype,oldRound=proto.roundRect,oldStroke=proto.stroke;
   proto.roundRect=function(x,y,w,h,...rest){
    this.__metricTestLine=this.canvas.width===1080&&this.canvas.height===1920&&x===701&&y===172&&w===324&&h===96;
    if(this.canvas.width===1080&&this.canvas.height===1920&&x===45&&y===150&&w===990)traced.push('HEADER_CARD');
    return oldRound.call(this,x,y,w,h,...rest);
   };
   proto.stroke=function(...args){if(this.__metricTestLine)traced.push('METRIC:'+this.strokeStyle);return oldStroke.apply(this,args);};
   try{
    await SiteEventStory.render({type:'earthquake',coords:[-66.79,18.02],mag,place:'Guayanilla, Porto Rico',depth:8.3});
    results.push({mag,traced});
   }finally{proto.roundRect=oldRound;proto.stroke=oldStroke;}
  }
  return results;
 });
 expect(result.map(r=>r.traced.filter(t=>t.startsWith('METRIC:')).at(-1))).toEqual(Array(4).fill('METRIC:#725031'));
 expect(result.every(r=>!r.traced.includes('HEADER_CARD'))).toBe(true);
});

test('Android image bridge exports a tsunami bulletin without invented coordinates',async({page})=>{
 await page.goto('/mobile-event-image.html');
 const png=await page.evaluate(async()=>{
  await ArgosMobileImage.render({type:'tsunami',place:'Costa do Pacífico',statusLabel:'Aviso de tsunami',source:'PTWC'});
  const length=ArgosMobileImage.status();
  if(typeof length!=='number')throw Error(String(length));
  let data='';
  for(let offset=0;offset<length;offset+=64000)data+=ArgosMobileImage.chunk(offset);
  return data;
 });
 const bytes=Buffer.from(png,'base64');
 expect(bytes.readUInt32BE(16)).toBe(1080);
 expect(bytes.readUInt32BE(20)).toBe(1920);
});

test('A fresh click shares the PNG if generation outlasts the initial gesture',async({page})=>{
 await page.goto('/404.html');
 await page.addScriptTag({url:'/js/story-share.js'});
 await page.evaluate(()=>{
  window.SiteEventStory={render:async()=>Object.assign(document.createElement('canvas'),{width:1080,height:1920})};
  const activation=navigator.userActivation;
  Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});
  Object.defineProperty(navigator,'canShare',{value:({files})=>files[0].type==='image/png'});
  Object.defineProperty(navigator,'share',{value:async({files})=>{
   window.sharedFile={name:files[0].name,type:files[0].type,active:activation.isActive};
  }});
  void window.shareEventAsStory({id:'fixture',type:'tsunami',place:'Costa do Pacífico'});
 });
 const dialog=page.getByRole('dialog',{name:'Imagem do evento pronta'});
 await dialog.getByRole('button',{name:'Compartilhar'}).click();
 await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>window.sharedFile)).toEqual({name:'evento-tsunami-fixture.png',type:'image/png',active:true});
});

test('Brazil share map paints IBGE municipal boundaries and shades the edges',async({page})=>{
 await page.goto('/404.html');
 const tile=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=c.height=16;
  const ctx=c.getContext('2d');ctx.fillStyle='#a3975a';ctx.fillRect(0,0,16,16);
  return c.toDataURL().split(',')[1];
 });
 await page.route('https://server.arcgisonline.com/**',route=>route.fulfill({
  contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(tile,'base64')
 }));
 const requested=[];
 await page.route('https://servicodados.ibge.gov.br/api/v3/malhas/estados/**',route=>{
  const url=new URL(route.request().url());
  requested.push(url);
  const features=url.pathname.endsWith('/31')?[{type:'Feature',geometry:{
   type:'Polygon',coordinates:[[[-45.5,-19.1],[-45.1,-19.1],[-45.1,-19.5],[-45.5,-19.5],[-45.5,-19.1]]]
  }}]:[];
  return route.fulfill({json:{type:'FeatureCollection',features},headers:{'access-control-allow-origin':'*'}});
 });
 await page.addScriptTag({url:'/js/site-event-story.js'});
 for(const type of ['earthquake','flood','capital-weather']){
 const rendered=await page.evaluate(async type=>{
  const ctx=CanvasRenderingContext2D.prototype,stroke=ctx.stroke,fillText=ctx.fillText;
  const strokes=[],texts=[];
  ctx.stroke=function(...args){strokes.push(this.strokeStyle);return stroke.apply(this,args);};
  ctx.fillText=function(value,...args){texts.push(value);return fillText.call(this,value,...args);};
  try{
   const canvas=await SiteEventStory.render({type,coords:[-45.2,-19.3],mag:2.7,place:'Minas Gerais, Brasil'});
   const ctx=canvas.getContext('2d');
   return {strokes,texts,center:ctx.getImageData(680,875,1,1).data[0],edge:ctx.getImageData(985,1245,1,1).data[0]};
  }finally{ctx.stroke=stroke;ctx.fillText=fillText;}
 },type);
 expect(requested.some(url=>url.pathname.endsWith('/31')&&url.searchParams.get('intrarregiao')==='municipio')).toBe(true);
 expect(rendered.strokes).toContain('rgba(234, 218, 173, 0.76)');
 expect(rendered.texts.join(' ')).toContain('Limites municipais: IBGE');
 expect(rendered.center-rendered.edge).toBeGreaterThan(45);
 }
});

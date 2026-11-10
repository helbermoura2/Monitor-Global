const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.use({serviceWorkers:'block'});
test('Concept 6 static composition exports every event family and missing-data states',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/404.html',{waitUntil:'domcontentloaded'});
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1080;c.height=1760;const x=c.getContext('2d');x.fillStyle='#274934';x.fillRect(0,0,1080,1760);for(let i=0;i<100;i++){x.strokeStyle=i%2?'#789f81':'#1b352b';x.beginPath();x.moveTo(i*31%1080,0);x.lineTo(i*57%1080,1760);x.stroke();}return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from(fixture,'base64')}));
 await page.addScriptTag({url:'/js/quake-site-flags.js'});
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
 expect(missing).toContain('localização pontual não informada');expect(missing).toContain('0 °C');expect(missing).toContain('Não informado');expect(missing).not.toContain('0 km/h');
});
test('Temperature image action resolves the selected weather record and exports Concept 6',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/?verify=share-concept6-all',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.CapitalWeather&&!!window.EventStore&&!!window.RecordPresentation);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);CapitalWeather.ingest([{cidade:'São Paulo',estado:'SP',temp:24,umidade:70,vento:9,atualizado_em:new Date().toISOString(),condicao_desc:'Condição de exemplo'}]);const row=CapitalWeather.records().find(r=>r.uf==='SP');if(!row)throw Error('Weather fixture missing');CapitalWeather.show(row);clearTimeout(cycleTimeout);Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
 await expect(page.locator('#pd-share-btn')).toBeVisible();await expect(page.locator('#pd-video-btn')).toBeHidden();
 const download=page.waitForEvent('download');await page.locator('#pd-share-btn').click();const file=await download;
 expect(file.suggestedFilename()).toContain('evento-capital-weather-');expect(await page.evaluate(()=>SiteEventStory.version)).toBe('site-concept6-all-v2');await expect(page.locator('#pd-share-btn')).toBeEnabled();
});

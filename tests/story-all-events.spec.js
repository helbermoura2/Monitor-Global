const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('Story disponível e exportável para todos os eventos '+width,async({page})=>{
 test.setTimeout(180000);
 const origin=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?verify=20261009-story-all',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.RecordPresentation);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{
  pausarBuscas();clearTimeout(cycleTimeout);
  Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
  window.__storyTexts=[];
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===1080&&this.canvas.height===1920)__storyTexts.push(String(text));return fill.call(this,text,...args);};
 });
 const samples=[...['earthquake','fire','storm','hurricane','tornado','tsunami','civil','wind','flood','volcano'].map(type=>({type,coords:[-70,-20]})),
  {type:'hurricane',classification:'TY',cycloneLabel:'Tufão'},
  {type:'hurricane',classification:'TS',cycloneLabel:'Tempestade tropical'},
  {type:'wind',hazardNature:'warning',warningEvent:'Marine Wind Warning',severityLabel:'Perigo'},
  {type:'civil',hazardNature:'warning',severityLabel:'Perigo potencial',descOnly:'Baixa umidade',coords:[]},
  {type:'civil',hazardNature:'bulletin',source:'CGE',bulletinSummary:'Chuva observada nas zonas Norte e Leste.'}];
 for(const [i,extra] of samples.entries()){
  const id='story-'+i;
  await page.evaluate(({id,extra})=>{
   const item={id,type:extra.type,place:'Região de teste',time:Date.now(),mag:3.5,depth:14,source:'QA',detail:'Dados do evento selecionado',windKmh:140,...extra};
   __storyTexts=[];
   if(item.type==='earthquake'){globalEvents=[item];showEventDetails(0,false);}else{globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);}
   clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);
  },{id,extra});
  const button=page.locator('#pd-share-btn');await expect(button).toBeVisible();await expect(button).toBeEnabled();
  const downloaded=page.waitForEvent('download');await button.click();const download=await downloaded;
  expect(download.suggestedFilename()).toBe(`evento-${extra.type}-${id}.png`);
  const png=fs.readFileSync(await download.path());expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1920);
  await expect(button).toHaveText('📤 Story');await expect(button).toBeEnabled();
  const texts=await page.evaluate(()=>__storyTexts.join(' '));expect(texts).toContain('Região de teste');
  if(!extra.coords?.length){expect(texts).toContain('localização pontual não informada');expect(texts).not.toContain('Local aprox.');await expect(page.locator('#pd-focus-btn')).toBeHidden();}
  if(extra.cycloneLabel)expect(texts).toContain(extra.cycloneLabel.toUpperCase());
  if(extra.bulletinSummary)expect(texts).toContain('Chuva observada');
 }
});

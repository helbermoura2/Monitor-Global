const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function fixture(page){
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.addInitScript(()=>{
  const native=fetch.bind(window);window.__weatherCalls=0;window.__tileCalls=0;
  window.fetch=async(input,opts)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/rain-weather?')){
    window.__weatherCalls++;const now=Date.now(),start=Math.floor(now/3600000)*3600000,params=new URL(url).searchParams;
    return Response.json({ok:true,source:'Rainbow Weather',loc:{lat:Number(params.get('lat')),lng:Number(params.get('lng'))},at:now,generatedAt:now,expiresAt:now+3600000,
    hourly:Array.from({length:48},(_,i)=>({start:start+i*3600000,temperature:25,feels:27,humidity:75,amount:3,chance:80,wind:18,gust:36,uv:2,pressure:1010})),daily:Array.from({length:5},(_,i)=>({start:start+i*86400000,min:19,max:28,amount:10,chance:80,condition:'Rain'}))});
   }
   if(url.includes('/rainbow-snapshot')){window.__tileCalls++;return Response.json({ok:true,snapshot:Math.floor(Date.now()/600000)*600});}
   if(url.includes('rainviewer.com/public/weather-maps'))return Response.json({host:'https://tiles.reserve.test',radar:{past:[{path:'/frame',time:Math.floor(Date.now()/1000)}]}});
   return native(input,opts);
  };
 });
}
for(const [label,width,height]of [['desktop',1280,720],['mobile',390,844]])test('Weather hora/dias em português e cache compartilhado '+label,async({page})=>{
 await page.setViewportSize({width,height});await fixture(page);await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{await fetchProSP();await fetchSPForecast();});
 await expect(page.locator('#sp-live-temp')).toHaveText('25°');await expect(page.locator('#sp-live-gust')).toHaveText('36 km/h');
 await expect(page.locator('#weather-summary-meta')).toContainText('Rainbow Weather');await expect(page.locator('.fc-day')).toHaveCount(5);await expect(page.locator('.weather-hour')).toHaveCount(12);
 const calls=await page.evaluate(()=>window.__weatherCalls);await page.evaluate(async()=>{await Promise.all([fetchSPWeather(),fetchProSP(),fetchSPForecast()]);});expect(await page.evaluate(()=>window.__weatherCalls)).toBe(calls);
 await page.evaluate(()=>WeatherPanel.show());await expect(page.locator('#weather-brief')).toContainText('previsão horária');await expect(page.locator('#weather-brief')).toContainText('75%');
 expect(await page.evaluate(()=>window.__tileCalls)).toBe(0);
});
test('Radar manual Rainbow, tile failure uses reserve, off prevents late response',async({page})=>{
 await fixture(page);await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const sources=new Map(),layers=new Map(),handlers=new Map();let enabled=true;
  const m={getLayer:id=>layers.get(id),getSource:id=>sources.get(id),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),addSource:(id,s)=>sources.set(id,s),addLayer:s=>layers.set(s.id,s),on:(id,f)=>handlers.set(id,f),off:(id,f)=>{if(handlers.get(id)===f)handlers.delete(id);}};
  await RainbowRadar.on(m,()=>enabled);const primary=sources.get('pro-radar-source').tiles[0];
  handlers.get('error')({sourceId:'unrelated'});const stillPrimary=sources.get('pro-radar-source').tiles[0]===primary;
  handlers.get('error')({sourceId:'pro-radar-source'});await new Promise(r=>setTimeout(r,100));const reserve=sources.get('pro-radar-source').tiles[0];
  RainbowRadar.off();const removed=sources.size===0&&layers.size===0;
  const native=fetch;window.fetch=async(...args)=>{await new Promise(r=>setTimeout(r,100));return native(...args);};
  const pending=RainbowRadar.on(m,()=>enabled);enabled=false;RainbowRadar.off();await pending;
  return {primary,stillPrimary,reserve,removed,lateSources:sources.size};
 });
 expect(result.primary).toContain('/rainbow-tile/');expect(result.stillPrimary).toBe(true);expect(result.reserve).toContain('tiles.reserve.test');expect(result.removed).toBe(true);expect(result.lateSources).toBe(0);
});
test('nova atividade vulcânica explica o ocorrido na frente do cartão e limpa ao mudar evento',async({page})=>{
 await fixture(page);await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  const a={id:'volcano-fixture',type:'volcano',place:'Vulcão de teste',coords:[-90,14],source:'VAAC',time:Date.now(),detail:'Atividade monitorada'};
  globalAlerts.push(a);const before=VolcanoPriority.capture(globalAlerts);a.detail='Nova erupção com lava';a.vulcanicActivity='Nova erupção com lava';VolcanoPriority.observe(before,globalAlerts,true);applyFilters();showAlertDetails(a,false);
 });
 await expect(page.locator('#pd-volcano-activity')).toBeVisible();await expect(page.locator('#pd-volcano-activity')).toContainText('NOVA ATIVIDADE');await expect(page.locator('#pd-volcano-activity p')).toContainText('lava');
 await page.evaluate(()=>{const a={id:'storm-fixture',type:'storm',place:'Teste',coords:[-90,14],source:'NWS',time:Date.now(),detail:'Tempestade'};globalAlerts=[a];VolcanoPriority.focus();upsertAlert(a);applyFilters();showAlertDetails(a,false);clearTimeout(cycleTimeout);});
 await expect(page.locator('#pd-volcano-activity')).toBeHidden();
});

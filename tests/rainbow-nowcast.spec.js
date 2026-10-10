const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function fixture(page,{failure=false,delayed=false}={}){
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.addInitScript(({failure,delayed})=>{
  const native=window.fetch.bind(window);window.__rainbowRequests=[];
  window.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/rain-nowcast?')){
    const p=new URL(url).searchParams,loc={lat:Number(p.get('lat')),lng:Number(p.get('lng'))};window.__rainbowRequests.push(loc);
    if(delayed)await new Promise(r=>setTimeout(r,250));
    if(failure)return new Response(JSON.stringify({ok:false,reason:'monthly_limit',detail:'Previsão por minuto pausada até renovar a cota gratuita.',retryAt:Date.now()+86400000}),{headers:{'Content-Type':'application/json'}});
    const now=Date.now(),start=Math.floor(now/60000)*60000;
    return new Response(JSON.stringify({ok:true,loc,at:now,expiresAt:now+600000,source:'Rainbow Weather',forecast:Array.from({length:240},(_,i)=>({start:start+i*60000,end:start+(i+1)*60000,rate:i<25?12:0,type:'rain'}))}),{headers:{'Content-Type':'application/json'}});
   }
   if(url.includes('api.open-meteo.com/v1/forecast')&&new URL(url).searchParams.get('models')){
    const base=Math.floor(Date.now()/3600000)*3600000,time=Array.from({length:9},(_,i)=>new Date(base+i*3600000).toISOString().slice(0,16)),hourly={time};
    for(const key of ['ecmwf_ifs025','gfs_seamless','icon_seamless'])hourly['precipitation_'+key]=time.map((_,i)=>i===2?3:0);
    return new Response(JSON.stringify({hourly}),{headers:{'Content-Type':'application/json'}});
   }
   return native(input,init);
  };
 },{failure,delayed});
}
for(const [mode,width,height] of [['desktop',1280,720],['mobile',390,844]])test('Rainbow na barra e gráfico de 60 minutos '+mode,async({page})=>{
 await page.setViewportSize({width,height});await fixture(page);await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>WeatherEvidence.refresh());
 await expect(page.locator('#sp-rain-eta')).toHaveText('Chuva forte · agora');
 if(mode==='desktop')await page.locator('#sp-rain-eta-chip').click();else await page.evaluate(()=>showFcPopup());
 await expect(page.locator('#rainbow-rain-chart')).toBeVisible();await expect(page.locator('#rainbow-rain-chart svg')).toHaveAttribute('role','img');
 await expect(page.locator('#rainbow-rain-chart')).toContainText('Pode terminar em cerca de 25 min');
 await expect(page.locator('#rainbow-rain-chart')).toContainText('60 min');await expect(page.locator('#rainbow-rain-chart')).toContainText('mm/h');
 await expect(page.getByRole('link',{name:'Dados: Rainbow Weather'})).toHaveAttribute('href','https://rainbow.ai/');
 await expect(page.locator('#painel-direito')).toBeHidden();
 const before=await page.evaluate(()=>window.__rainbowRequests.length);
 await page.evaluate(()=>WeatherEvidence.refresh());expect(await page.evaluate(()=>window.__rainbowRequests.length)).toBe(before);
 const chart=await page.locator('#rainbow-rain-chart').boundingBox();expect(chart.x).toBeGreaterThanOrEqual(0);expect(chart.x+chart.width).toBeLessThanOrEqual(width+1);
 await page.locator('#rainbow-rain-chart').screenshot({path:'/workspace/scratch/rainbow-chart-'+mode+'.png'});
});
test('cota preserva modelos e não vira ausência de chuva',async({page})=>{
 await fixture(page,{failure:true});await page.goto('/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>WeatherEvidence.refresh());
 await expect(page.locator('#sp-rain-eta')).toContainText('Prev.');await page.evaluate(()=>showFcPopup());
 await expect(page.locator('#rainbow-rain-chart')).toHaveCount(0);await expect(page.locator('#weather-brief')).toContainText('pausada até renovar');
 await expect(page.locator('#weather-brief')).toContainText('modelos horários');
 const before=await page.evaluate(()=>window.__rainbowRequests.length);await page.evaluate(()=>WeatherEvidence.refresh());expect(await page.evaluate(()=>window.__rainbowRequests.length)).toBe(before);
});
test('GPS trocado durante consulta não exibe previsão do ponto antigo',async({page})=>{
 await fixture(page,{delayed:true});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const native=WeatherPanel.update;window.__wrongRainLocation=false;
  WeatherPanel.update=()=>{if(window.__rainOutlook?.provider==='rainbow'&&window.__rainOutlook.loc.lat!==weatherLoc.lat)window.__wrongRainLocation=true;native();};
  const first=WeatherEvidence.refresh();weatherLoc.lat=-22.9;weatherLoc.lng=-43.2;weatherLoc.nome='Rio de Janeiro';WeatherEvidence.update();await first;
 });
 await page.evaluate(()=>WeatherEvidence.refresh());await expect(page.locator('#sp-rain-eta')).toHaveText('Chuva forte · agora');
 expect(await page.evaluate(()=>window.__rainOutlook.loc.lat)).toBe(-22.9);
 expect(await page.evaluate(()=>window.__wrongRainLocation)).toBe(false);
});

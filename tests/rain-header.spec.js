const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
test('chuva por modelo separada de alagamentos e sem sobreposição',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.setViewportSize({width:1280,height:720});
 await page.addInitScript(()=>{
  const native=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(!url.includes('api.open-meteo.com/v1/forecast')||!new URL(url).searchParams.get('models'))return native(input,init);
   const base=Math.floor(Date.now()/3600000)*3600000,time=Array.from({length:9},(_,i)=>new Date(base+i*3600000).toISOString().slice(0,16)),hourly={time};
   for(const key of ['ecmwf_ifs025','gfs_seamless','icon_seamless'])hourly['precipitation_'+key]=time.map((_,i)=>i===2?3:0);
   return Promise.resolve(new Response(JSON.stringify({hourly}),{headers:{'Content-Type':'application/json'}}));
  };
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>WeatherEvidence.refresh());
 await expect(page.locator('#sp-rain-eta')).toContainText('Prev.');await expect(page.locator('#sp-rain-eta')).toContainText('3,0mm');
 await expect(page.locator('#cemaden-card')).toBeHidden();await expect(page.locator('#sp-live-card')).toHaveCSS('backdrop-filter','none');await expect(page.locator('#sp-live-card')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('#chips-row')).toHaveCSS('color-scheme','dark');await expect(page.locator('#chips-row')).toHaveCSS('scrollbar-color','rgba(126, 205, 224, 0.48) rgba(0, 0, 0, 0)');await page.evaluate(()=>document.getElementById('chips-row').classList.add('expanded'));await page.locator('#chips-row').evaluate(el=>el.scrollTo({left:60,behavior:'instant'}));await expect.poll(()=>page.locator('#chips-row').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await expect(page.locator('#flood-risk-chip')).toBeHidden();await expect(page.locator('#sp-forecast-air')).toBeHidden();
 const chip=page.locator('#sp-rain-eta-chip');await expect(chip).toHaveAttribute('title',/resolução horária/);
 let visible=0;for(const width of [1101,1280,1920]){
  await page.setViewportSize({width,height:720});const rain=await chip.boundingBox(),card=await page.locator('#sp-live-card').boundingBox(),clock=await page.locator('#kpi-relogio').boundingBox();
  if(!rain||!card)continue;visible++;
  expect(rain.x).toBeGreaterThanOrEqual(card.x);expect(rain.x+rain.width).toBeLessThanOrEqual(card.x+card.width+1);
  if(clock)expect(rain.x>=clock.x+clock.width||rain.x+rain.width<=clock.x||rain.y>=clock.y+clock.height||rain.y+rain.height<=clock.y).toBeTruthy();
 }
 expect(visible).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Meteorologia',exact:true}).click();await expect(page.locator('#weather-brief')).toContainText('Chuva · curto prazo');await expect(page.locator('#weather-brief')).toContainText('Alagamentos');await expect(page.locator('#weather-more')).toHaveJSProperty('open',false);
 await page.locator('#weather-more > summary').click();await expect(page.getByRole('link',{name:'Radar CGE/SP'})).toBeVisible();
});

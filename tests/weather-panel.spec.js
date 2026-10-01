const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const [name,width,height]of [['desktop',1280,720],['mobile',390,844]])test('meteorologia manual e sem sobreposição '+name,async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.setViewportSize({width,height});await page.goto('/',{waitUntil:'domcontentloaded'});
 const weather=page.locator('#sp-forecast-air'),event=page.locator('#painel-direito');
 await expect(page.locator('#weather-event-tabs')).toHaveCount(0);
 const neighbors=await page.locator('#chip-meteorologia').evaluate(el=>[el.previousElementSibling.id,el.nextElementSibling.id]);expect(neighbors).toEqual(['chip-criticos','chip-radar']);
 await expect(weather).toBeHidden();await expect(page.locator('#weather-more')).toHaveJSProperty('open',false);
 if(width>900)await page.getByRole('button',{name:'Meteorologia',exact:true}).click();
 else await page.evaluate(()=>showFcPopup());
 await expect(weather).toBeVisible();await expect(event).toBeHidden();await expect(page.locator('#pd-focus-btn')).toBeHidden();
 await expect(page.locator('#weather-brief')).toContainText('Chuva observada');
 const fixtureText=await page.evaluate(()=>{window.__weatherEvidenceState={level:'unknown',measured:null};window.__weatherForecastBrief={min:6,max:13,rows:[{},{}]};WeatherPanel.update();return document.getElementById('weather-brief').textContent;});
 expect(fixtureText).toContain('6.0–13.0 mm previstos');
 await page.locator('#weather-more > summary').click();await expect(page.locator('#weather-more')).toHaveJSProperty('open',true);
 const r=await weather.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width+1);expect(r.y+r.height).toBeLessThanOrEqual(height+1);
 if(width>900){await page.getByRole('button',{name:'Meteorologia',exact:true}).click();await expect(event).toBeVisible();await expect(page.locator('#chip-meteorologia')).toHaveAttribute('aria-expanded','false');}
 else await page.locator('#fc-close').click();
 await expect(weather).toBeHidden();
});

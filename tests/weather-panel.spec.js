const {test,expect}=require('@playwright/test');
for(const [name,width,height]of [['desktop',1280,720],['mobile',390,844]])test('meteorologia manual e sem sobreposição '+name,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/',{waitUntil:'domcontentloaded'});
 const weather=page.locator('#sp-forecast-air'),event=page.locator('#painel-direito');
 await expect(weather).toBeHidden();await expect(page.locator('#weather-more')).toHaveJSProperty('open',false);
 if(width>900)await page.getByRole('button',{name:'Meteorologia',exact:true}).click();
 else await page.evaluate(()=>showFcPopup());
 await expect(weather).toBeVisible();await expect(event).toBeHidden();await expect(page.locator('#pd-focus-btn')).toBeHidden();
 await expect(page.locator('#weather-brief')).toContainText('Chuva observada');
 await page.evaluate(()=>{window.__weatherEvidenceState={level:'unknown',measured:null};window.__weatherForecastBrief={min:6,max:13,rows:[{},{}]};WeatherPanel.update();});
 await expect(page.locator('#weather-brief')).toContainText('6.0–13.0 mm previstos');
 await page.locator('#weather-more summary').click();await expect(page.locator('#weather-more')).toHaveJSProperty('open',true);
 const r=await weather.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width+1);expect(r.y+r.height).toBeLessThanOrEqual(height+1);
 if(width>900){await page.getByRole('button',{name:'Evento',exact:true}).click();await expect(event).toBeVisible();}
 else await page.locator('#fc-close').click();
 await expect(weather).toBeHidden();
});

const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,960,390])test('secondary filters collapse and remain usable '+width,async({page})=>{
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);});
 if(width===390){await page.locator('#fab-menu').click();await page.getByRole('button',{name:'Filtros de eventos',exact:true}).click();}
 const toggle=page.locator('#more-filters-toggle');await expect(toggle).toBeVisible();
 for(const id of ['chip-meteorologia','chip-criticos','chip-geo-me','chip-visual-theme'])await expect(page.locator('#'+id)).toBeHidden();
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#chips-row [data-f="tsunami"]')).toBeVisible();
 await page.locator('#chips-row [data-f="tsunami"]').click();
 expect(await page.evaluate(()=>sidebarFilter)).toBe('tsunami');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#chips-row [data-f="tsunami"]')).toBeHidden();await expect(toggle).toContainText('(');
 await page.locator('#chips-row [data-f="all"]').click();expect(await page.evaluate(()=>sidebarFilter)).toBe('all');
});

const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
test('status único, previsão completa e retorno ao cabeçalho móvel',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.getElementById('sp-rain-eta').textContent='Prev. 15–60m · 1,5–4,2mm/1h');
 for(const width of [1101,1280,1920,390,844,1280]){
  await page.setViewportSize({width,height:width===390?844:720});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{document.querySelector('#ao-vivo-badge .av-label').textContent='ATUALIZAÇÃO PARCIAL';document.querySelector('#ao-vivo-badge .av-age').textContent='há 24 s';document.getElementById('kpi-relogio').textContent='13:05:47';});
  const state=await page.evaluate(()=>{
   const ids=['ao-vivo-badge','sp-live-card','kpi-relogio','freshness-bar','kpibox-brent','logo'];
   return Object.fromEntries(ids.map(id=>{const e=(id==='logo'?document.querySelector('.ts-title'):document.getElementById(id)),r=e.getBoundingClientRect();return [id,{x:r.x,y:r.y,w:r.width,h:r.height,parent:e.parentElement.id||e.parentElement.className,display:getComputedStyle(e).display}]}));
  });

  if(width>1100){expect(state['sp-live-card'].x).toBeGreaterThanOrEqual(state.logo.x+state.logo.w);expect(state['sp-live-card'].x+state['sp-live-card'].w).toBeLessThanOrEqual(state['kpibox-brent'].x+1);expect(state['ao-vivo-badge'].y).toBeGreaterThanOrEqual(state['sp-live-card'].y+state['sp-live-card'].h);await expect(page.locator('#freshness-bar #ao-vivo-badge')).toBeVisible();await expect(page.locator('#fresh-sismo')).toBeHidden();expect(await page.locator('#sp-rain-eta').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();const rain=await page.locator('#sp-rain-eta').boundingBox();expect(rain.x+rain.width).toBeLessThanOrEqual(state['kpibox-brent'].x);expect(state['ao-vivo-badge'].x+state['ao-vivo-badge'].w).toBeLessThanOrEqual(width);}
  else {await expect(page.locator('.ts-mainrow > #ao-vivo-badge')).toHaveCount(1);if(width===390)await expect(page.locator('#ao-vivo-badge')).toBeVisible();}
 }
 await page.locator('#ao-vivo-badge').click();await expect(page.locator('#mg-fresh-dialog')).toBeVisible();
});

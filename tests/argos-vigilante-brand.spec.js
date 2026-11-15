const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
test('Argos Orbis eye marks load and preserve live source badge',async({page})=>{
  await page.route('**/*',route=>
    new URL(route.request().url()).hostname==='127.0.0.1'
      ?route.continue():route.abort());
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    const brand=page.locator('#top-strip .mg-logo-frame img');
    const sourceEye=page.locator('#ao-vivo-badge .av-argos-compact img');
    await expect.poll(()=>brand.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await expect.poll(()=>sourceEye.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await expect(page.locator('#ao-vivo-badge .av-label')).toHaveCount(1);
    await expect(page.locator('#ao-vivo-badge .av-age')).toHaveCount(1);
    await expect(page.locator('#kpi-relogio')).toHaveCount(1);
    const geom=await page.evaluate(()=>{
      const a=document.querySelector('.ts-title.mg-title').getBoundingClientRect();
      const b=document.querySelector('#ao-vivo-badge').getBoundingClientRect();
      return {brandRight:a.right,badgeLeft:b.left};
    });
    if(width>=390)expect(geom.badgeLeft).toBeGreaterThanOrEqual(geom.brandRight-5);
  }
});

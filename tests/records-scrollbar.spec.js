const {test,expect}=require('@playwright/test');require('./helpers/card-renderer-fixture.cjs')(test);
test('three overflowing arrival cards keep a dark track and blue thumb in both visual themes',async({page})=>{
 await page.setViewportSize({width:1280,height:650});await page.emulateMedia({colorScheme:'light'});await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);activeAlertingIds.clear();activeUpdatedIds.clear();globalAlerts=[];globalEvents=Array.from({length:3},(_,i)=>({id:'scroll-card-'+i,type:'earthquake',mag:6.1,depth:16,coords:[-100+i,31],time:Date.now()-i*60000,place:'Registro para testar a rolagem '+i,source:'USGS'}));for(const q of globalEvents)activeAlertingIds.set(q.id,Date.now()+180000);applyFilters();});
 const box=page.locator('#sidebar-left');await expect(box).toBeVisible();await expect(page.locator('#events>.event')).toHaveCount(3);
 for(const dark of [false,true]){
  await page.evaluate(dark=>document.documentElement.classList.toggle('mg-theme-dark',dark),dark);
  const actual=await box.evaluate(el=>({overflow:el.scrollHeight>el.clientHeight,gutter:el.offsetWidth-el.clientWidth,track:getComputedStyle(el,'::-webkit-scrollbar-track').backgroundColor,thumb:getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor,scheme:getComputedStyle(el).colorScheme,width:getComputedStyle(el,'::-webkit-scrollbar').width}));
  expect(actual.overflow).toBe(true);expect([0,7]).toContain(actual.gutter); // Headless may suppress the native gutter; visible bars must be 7px.
  expect(actual.scheme).toContain('dark');expect(actual.track).toBe('rgb(11, 35, 48)');expect(actual.thumb).toBe('rgb(73, 115, 134)');expect(actual.width).toBe('7px');
  await box.evaluate(el=>el.scrollTop=el.scrollHeight);expect(await box.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({path:dark?'/tmp/records-scrollbar-dark.png':'/tmp/records-scrollbar-glass.png'});
 }
});

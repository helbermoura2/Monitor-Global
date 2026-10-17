const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
require('./helpers/card-renderer-fixture.cjs')(test);
test('a hidden mobile scene sleeps, resumes on expansion and expires by wall clock',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>window.__cardRendererFixtureReady);
 await page.evaluate(async()=>{CinematicCard.stop();await OptionalFeatures.effect('wind');document.body.classList.remove('mobile-details-mid','mobile-details-open');window.__resets=0;const original=CardEffectQuality.create;CardEffectQuality.create=(...args)=>{const q=original(...args),reset=q.reset;q.reset=()=>{__resets++;return reset()};return q;};});await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.evaluate(()=>CinematicCard.start({id:'idle',type:'wind',windKmh:100,place:'Teste',__cinemaDemo:true},16000));await page.clock.runFor(5000);expect(await page.evaluate(()=>__resets)).toBeLessThanOrEqual(3);expect(await page.evaluate(()=>CinematicCard.isActive())).toBe(true);
 await page.evaluate(()=>CinematicCard.start({id:'idle',type:'wind',windKmh:100,place:'Teste',__cinemaDemo:true},16000));
 await page.evaluate(()=>document.body.classList.add('mobile-details-open'));await page.clock.runFor(500);await expect(page.locator('.pd-cinema-layer')).toBeVisible();
 await page.evaluate(()=>document.body.classList.remove('mobile-details-open'));await page.clock.runFor(12000);expect(await page.evaluate(()=>CinematicCard.isActive())).toBe(true);await page.clock.runFor(5000);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
});

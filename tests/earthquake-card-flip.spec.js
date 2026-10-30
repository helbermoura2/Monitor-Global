const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'no-preference'});
async function boot(page,width=1280){
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).pathname==='/population-exposure'?r.fulfill({json:{status:'available',method:'pager',ranges:[{population:12345},{population:2000},{population:100}]}}):new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();map._render=()=>{};clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();activeAlertingIds.clear();isFirstLoad=false;isFirstDisplay=false;window.__mgColdLoadGraceUntil=0;globalAlerts=[];
 globalEvents=['flip-first','flip-second'].map((id,i)=>({id,type:'earthquake',mag:4.2,depth:10,coords:[-70+i,-20],time:Date.now()-3600000,place:'Sismo de teste',source:'QA'}));
 window.estimarPessoasAfetadas=async()=>({totalPessoas:10000,status:'available',raioKm:50,sources:['GeoNames'],cidades:[{nome:'Cidade próxima',distancia:15,pop:10000,mmi:null}]});
 });
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
}
for(const width of [1280,390])for(const mode of ['manual','auto','new'])test('card flips after arrival and returns, '+mode+' '+width,async({page})=>{
 await boot(page,width);await page.evaluate(mode=>{window.__mgSoftCycle=mode==='auto';showEventDetails(0,mode==='new');document.body.classList.add('mobile-details-open');},mode);
 // Allow the 40ms cross-tab cache lookup before inspecting the mocked reply.
 await page.clock.runFor(50);
 await expect(page.locator('#pd-grid-exposure')).toHaveAttribute('data-status','available');await expect(page.locator('#pd-exposure-brief')).toHaveCount(0);
 await page.clock.runFor(23850);await expect(page.locator('#pd-flip-verso')).toHaveCount(0);
 await page.clock.runFor(1000);await expect(page.locator('#painel-direito')).toHaveClass(/pd-flip-girado/);
 await expect(page.locator('#pd-flip-verso')).toContainText('Cidade próxima');await expect(page.locator('#pd-flip-verso')).toContainText('USGS PAGER');await expect(page.locator('#pd-flip-grid-exposure')).toContainText('12 mil');
 if(mode==='manual'){if(width===390)await expect(page.locator('#latest-event-ticker')).toHaveCSS('background-image',/20, 28, 28/);await expect(page.locator('#pd-flip-verso .pd-flip-verso-body')).toHaveCSS('overflow-y','auto');await expect(page.locator('#pd-flip-verso')).toBeInViewport();await page.screenshot({path:'/tmp/earthquake-card-flip-'+width+'.png',animations:'disabled'});}
 await page.clock.runFor(13000);await expect(page.locator('#pd-flip-verso')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-flip-girado/);
});
test('selection and manually opened details cancel pending population flip',async({page})=>{
 await boot(page);await page.evaluate(()=>showEventDetails(0,false));await page.clock.runFor(19000);
 await page.evaluate(()=>{window.__mgSoftCycle=true;showEventDetails(1,false);});await page.clock.runFor(2000);await expect(page.locator('#pd-flip-verso')).toHaveCount(0);
 await page.evaluate(()=>EventDetailsBack.toggle(true));await page.clock.runFor(32000);await expect(page.locator('#pd-flip-verso')).toHaveCount(0);await expect(page.locator('#pd-details-verso')).toHaveCount(1);
});

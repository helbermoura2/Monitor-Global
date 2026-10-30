const {test,expect}=require('@playwright/test');const fs=require('node:fs');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [390,1280])test('selected summary and quiet secondary points '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>{if(r.request().url().includes('/qa-world-tile')&&fs.existsSync('/tmp/globe-world-tile.jpg'))return r.fulfill({path:'/tmp/globe-world-tile.jpg',contentType:'image/jpeg'});return new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort();});
 await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento&&document.querySelector('.mobile-focus-content'));
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);globalAlerts=[];globalEvents=[{id:'focus-qa',type:'earthquake',mag:2.4,depth:12.647,coords:[-47,-21],time:Date.now(),place:'Interior de São Paulo, Brasil',source:'QA'},{id:'secondary-qa',type:'earthquake',mag:6.1,depth:10,coords:[-47.05,-21.03],time:Date.now(),place:'Peru',source:'QA'}];
 showEventDetails(0,false);clearTimeout(cycleTimeout);EventCamera.cancel();SeismicPaintTour.stop();stopMapCamera();stopWaveFront();stopFeltZone();SeismicImpact.stop();SeismicCinema.stop();CinematicCard.stop();
 for(const l of map.getStyle().layers)if(l.type==='raster')map.removeLayer(l.id);
 if(!map.getSource('qa-world')){map.addSource('qa-world',{type:'raster',tiles:['http://127.0.0.1:4173/qa-world-tile'],tileSize:256,maxzoom:0});map.addLayer({id:'qa-world',type:'raster',source:'qa-world'});}
 document.getElementById('mobile-notice-stack')?.remove();document.body.classList.remove('mobile-details-open','mobile-details-mid');map.jumpTo({center:[-47,-21],zoom:6,bearing:0,pitch:0,padding:0});syncAllMarkers();updateQuakeLabels();
 // Receiving a newer item must not replace the selected-event summary.
 atualizarTickerUltimoEvento(globalEvents[1]);
 });
 const selected=page.locator('[data-quake-id="focus-qa"]'),secondary=page.locator('[data-quake-id="secondary-qa"]');
 await expect(selected).toHaveClass(/map-pin-selected/);await expect(secondary).toHaveClass(/map-pin-secondary/);
 expect(await secondary.evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none');
 if(width===390){await expect(page.locator('.focus-place')).toHaveText('Interior de São Paulo, Brasil');await expect(page.locator('.focus-metric')).toHaveText('M 2,4');await expect(page.locator('.focus-detail')).toHaveText('Profundidade: 12,65 km');await expect(page.locator('.mobile-focus-content')).toBeVisible();}
 else await expect(page.locator('.mobile-focus-content')).toBeHidden();
 await page.evaluate(()=>{GlobePreview.setMode('globe');const wrap=document.getElementById('mapWrap');for(const [cls,text]of [['wave-front-status','Ondas sísmicas · 00:12 / 01:00'],['seismic-impact-status','Intensidade estimada · Sem área em terra estimada para pintar']]){const el=document.createElement('div');el.className=cls;el.textContent=text;wrap.append(el);}});
 if(width===390){await expect.poll(()=>page.evaluate(()=>{const a=document.querySelector('.wave-front-status').getBoundingClientRect(),b=document.querySelector('.seismic-impact-status').getBoundingClientRect(),c=document.getElementById('latest-event-ticker').getBoundingClientRect();return a.top>=c.bottom+6&&b.top>=a.bottom+4;})).toBe(true);}
 await page.evaluate(()=>GlobePreview.overview());await page.waitForTimeout(400);await page.evaluate(()=>document.getElementById('mobile-notice-stack')?.remove());await page.screenshot({path:'/tmp/mobile-focus-layout-'+width+'.png'});
 await page.evaluate(()=>{globalEvents[0].mag=3.1;globalEvents[0].depth=8;EventStore.notify('revise',{id:'focus-qa'});syncAllMarkers();});
 if(width===390){await expect(page.locator('.focus-metric')).toHaveText('M 3,1');await expect(page.locator('.focus-detail')).toHaveText('Profundidade: 8 km');await page.locator('#latest-event-ticker').click();await expect(page.locator('body')).toHaveClass(/mobile-events-open/);await page.getByRole('button',{name:'Fechar lista de eventos',exact:true}).click();await expect(page.locator('body')).not.toHaveClass(/mobile-events-open/);}
 await page.evaluate(()=>{map.jumpTo({center:[-47,-21],zoom:6});EventStore.setSelected('secondary-qa');syncAllMarkers();});await expect(selected).toHaveClass(/map-pin-secondary/);await expect(secondary).toHaveClass(/map-pin-selected/);
 if(width===390){
  await page.locator('#mobile-detail-handle').click();await expect(page.locator('body')).toHaveClass(/mobile-details-mid/);
  await page.setViewportSize({width:320,height:740});await expect(page.locator('.mobile-focus-content')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:844,height:390});await expect(page.locator('.mobile-focus-content')).toBeHidden();expect(await page.locator('#latest-event-ticker .let-mid').evaluate(el=>el.style.display)).not.toBe('none');
 }
});

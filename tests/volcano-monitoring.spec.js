const {test,expect}=require('@playwright/test');
require('./helpers/card-renderer-fixture.cjs')(test);
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('monitoramento fica no Menu; cartão real mantém dados sem animação '+width,async({page})=>{
 test.setTimeout(90000);
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__cardRendererFixtureReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{
  const item={id:'crater-real',type:'volcano',eruptionStatus:'Sem atividade eruptiva',detail:'Em monitoramento',source:'QA',coords:[-155.29,19.42],time:Date.now(),place:'Vulcão de teste'};
  globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);
 });
 await expect(page.locator('.pd-volcano-monitor,.pd-cinema-layer,#site-effect-demo-canvas')).toHaveCount(0);
 await expect(page.locator('#pd-local')).toContainText('Vulcão de teste');
 await page.evaluate(()=>{applyFilters();clearTimeout(cycleTimeout);});
 const before=await page.evaluate(()=>({events:JSON.stringify(globalAlerts),selected:EventStore.selectedId,text:document.getElementById('pd-local').textContent}));
 await page.evaluate(()=>CardEffectDemo.preview('volcano-monitoring'));
 await expect(page.locator('.pd-volcano-monitor')).toHaveAttribute('data-texture','photograph');await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','true');
 expect(await page.evaluate(()=>({events:JSON.stringify(globalAlerts),selected:EventStore.selectedId,text:document.getElementById('pd-local').textContent}))).toEqual(before);
 await page.locator('#painel-direito').screenshot({path:'/tmp/volcano-monitoring-'+width+'.png'});
 await page.evaluate(()=>CardEffectDemo.stop());await expect(page.locator('.pd-volcano-monitor,.pd-cinema-layer')).toHaveCount(0);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),noticeId:'eruptive-revision',eruptionStatus:'Em erupção',detail:'Fluxo de lava ativo · sem cinzas'};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});
 await expect(page.locator('#site-effect-demo-canvas')).toHaveAttribute('data-scene','lava');await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
 await page.evaluate(()=>{const item={...EventStore.getSelected(),noticeId:'ended-revision',eruptionStatus:'Erupção encerrada',detail:'Sem atividade eruptiva'};upsertAlert(item);showAlertDetails(item,false,true);});
 await expect(page.locator('#site-effect-demo-canvas,.pd-cinema-layer')).toHaveCount(0);
});
test('sem fotografia, a reserva desenha uma cratera detalhada e limpa a carga pendente',async({page})=>{
 await page.route('**/volcano-crater.jpg',r=>r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>OptionalFeatures.effect("volcano"));await page.waitForFunction(()=>!!window.CardVolcanoMonitoring);
 const result=await page.evaluate(()=>{
  const scene=CardVolcanoMonitoring.create({type:'volcano',hot:false,ash:false,lava:false},false);scene.resize(320,600);scene.draw(2);
  const ctx=scene.canvas.getContext('2d'),data=ctx.getImageData(0,0,scene.canvas.width,scene.canvas.height).data;
  const values=new Set(Array.from(data).filter((v,i)=>i%4===0)),at=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
  const sample={unique:values.size,center:at(160,280),edge:at(280,280),texture:scene.canvas.dataset.texture};
  document.body.append(scene.canvas);scene.destroy();sample.connected=scene.canvas.isConnected;
  sample.active=CardVolcanoMonitoring.create({type:'volcano',hot:true,ash:true,lava:false},false);
  return sample;
 });
 expect(result.unique).toBeGreaterThan(30);expect(result.center).not.toEqual(result.edge);expect(result.texture).toBe('procedural');expect(result.connected).toBe(false);expect(result.active).toBeNull();
});

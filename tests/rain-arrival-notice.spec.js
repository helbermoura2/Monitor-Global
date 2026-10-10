const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function setup(page,width=1280,height=720){
 await page.setViewportSize({width,height});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  if(typeof pausarBuscas==='function')pausarBuscas();
  window.getAutoCycleProtectionRemaining=()=>0;
  EventStore.setSelected(null);
  if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();
  weatherLoc.nome='Liberdade, São Paulo';
  window.rainFixture=()=>{const now=Date.now();return {provider:'rainbow',status:'soon',arrivalMinutes:15,consultedAt:now,now,loc:{lat:weatherLoc.lat,lng:weatherLoc.lng},amount:6,series:Array.from({length:60},(_,i)=>({start:now+i*60000,end:now+(i+1)*60000,rate:i>=15&&i<45?12:0,type:'rain'}))};};
  RainbowNowcast.outlook=()=>rainFixture();
  RainArrivalNotice.consider(rainFixture());
 });
 await expect(page.locator('#rain-arrival-notice')).toBeVisible();
}
for(const [mode,w,h]of [['desktop',1280,720],['mobile',390,844]])test('aviso '+mode+' com previsão, gráfico e retorno',async({page})=>{
 await setup(page,w,h);
 const notice=page.locator('#rain-arrival-notice');
 await expect(notice).toContainText('≈ 15 min');await expect(notice).toContainText('forte');await expect(notice).toContainText('≈ 6,0 mm');await expect(notice).toContainText('mm/h');
 await expect(notice).toContainText('Liberdade, São Paulo');
 if(mode==='desktop')await expect(page.locator('#painel-direito')).toHaveClass(/pd-flip-girado/);
 else await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-flip-girado/);
 await expect.poll(async()=>{const b=await notice.boundingBox();return b.y+b.height;}).toBeLessThanOrEqual(h+1);
 const box=await notice.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(w+1);expect(box.y+box.height).toBeLessThanOrEqual(h+1);
 expect(await notice.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.bottom-16));})).toBe(true);
 await notice.screenshot({path:'/workspace/scratch/rain-arrival-'+mode+'.png'});
 await page.waitForTimeout(mode==='desktop'?13000:21000);
 await expect(notice).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-flip-girado/);
 await page.evaluate(()=>RainArrivalNotice.consider(rainFixture()));await expect(notice).toHaveCount(0);
});
test('sismo prioritário interrompe e bloqueia o aviso',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{globalEvents.push({id:'rain-priority',type:'earthquake',mag:5.1});EventStore.setSelected('rain-priority');RainArrivalNotice.consider(rainFixture());});
 await expect(page.locator('#rain-arrival-notice')).toHaveCount(0);await expect(page.locator('#painel-direito')).not.toHaveClass(/pd-flip-girado/);
});
test('fechar durante retorno remove o verso e permite abrir previsão',async({page})=>{
 await setup(page,390,844);
 await page.locator('.rain-arrival-return').click();
 await page.evaluate(()=>RainArrivalNotice.close(true));
 await expect(page.locator('#rain-arrival-notice')).toHaveCount(0);
 await page.evaluate(()=>{weatherLoc.lat=-22.9;weatherLoc.lng=-43.2;RainArrivalNotice.consider(rainFixture());});
 await expect(page.locator('#rain-arrival-notice')).toBeVisible();
 await page.locator('.rain-arrival-details').click();
 await expect(page.locator('#rain-arrival-notice')).toHaveCount(0);await expect(page.locator('#weather-brief')).toBeVisible();
});
test('dados antigos, outro local e chegada distante não acionam aviso',async({page})=>{
 await setup(page);await page.evaluate(()=>RainArrivalNotice.close(true));
 expect(await page.evaluate(()=>{
  const s=rainFixture();return [RainArrivalNotice.candidate({...s,arrivalMinutes:21}),RainArrivalNotice.candidate({...s,consultedAt:Date.now()-21*60000}),RainArrivalNotice.candidate({...s,loc:{lat:0,lng:0}}),RainArrivalNotice.candidate({...s,provider:'models'})];
 })).toEqual([null,null,null,null]);
});
test('verso manual adia aviso e mudança de localização o fecha',async({page})=>{
 await setup(page);await page.evaluate(()=>RainArrivalNotice.close(true));
 await page.evaluate(()=>{
  weatherLoc.lat=-23;weatherLoc.lng=-46;
  const back=document.createElement('div');back.id='pd-details-verso';document.body.append(back);
  RainArrivalNotice.consider(rainFixture());
 });
 await expect(page.locator('#rain-arrival-notice')).toHaveCount(0);
 await page.evaluate(()=>{document.getElementById('pd-details-verso').remove();RainArrivalNotice.consider(rainFixture());});
 await expect(page.locator('#rain-arrival-notice')).toBeVisible();
 await page.evaluate(()=>{const old=rainFixture();weatherLoc.lat=-22;RainArrivalNotice.consider(old);});
 await expect(page.locator('#rain-arrival-notice')).toHaveCount(0);
});

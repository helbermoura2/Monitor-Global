const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
for(const width of [1280,390])test('boletim CGE na lista e texto oficial no verso '+width,async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  const now=Date.now();const row={sourceId:'56051',title:'Chuvas isoladas na cidade',time:now-60000,displayUntil:now+3600000,summary:'Radar mostra chuvas nas zonas Norte e Leste.',description:'CGE: chuva observada nas zonas Norte e Leste. Há condições para raios nas próximas horas.'};
  const item=CgeBulletins.fromBulletin(row);globalAlerts=[item];globalEvents=[];upsertAlert(item);applyFilters();EventStore.setSelected(item.id);
 });
 if(width<900)await page.evaluate(()=>toggleMobileEventsModal(true));
 const card=page.locator('#events .event').filter({hasText:'CGE'}).first();await expect(card).toContainText('BOLETIM CGE');await expect(card).toContainText('BOLETIM OFICIAL');await expect(card).toContainText('Chuvas isoladas na cidade');
 const states=await page.evaluate(()=>({live:activeAlertingIds.has('cge-bulletin-56051'),expired:CgeBulletins.fromBulletin({sourceId:'1',time:Date.now()-7*3600000,displayUntil:Date.now()-3600000,title:'Antigo',description:'Chuva'}),link:resolveOfficialLink(EventStore.getSelected()).url}));expect(states.live).toBe(false);expect(states.expired).toBe(null);expect(states.link).toContain('noticias.jsp?id=56051');
 await card.click();await page.locator('#pd-more-toggle').click();const back=page.locator('#pd-details-verso');await expect(back).toContainText('CGE: chuva observada nas zonas Norte e Leste.');await expect(back).toContainText('não confirmam alagamentos');
 await back.getByRole('button',{name:'Voltar ao evento'}).click();await expect(back).toHaveCount(0);
});

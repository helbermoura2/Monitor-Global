const {test,expect}=require('@playwright/test');
for(const width of [390,1280])test('administrative health uses private headers and renders safe paginated source state '+width,async({page})=>{
 await page.setViewportSize({width,height:850});const requests=[];let pageNumber=0;
 await page.route('https://black-sky-9ba0.terrestre.workers.dev/**',async route=>{
  const req=route.request(),u=new URL(req.url());requests.push({url:req.url(),token:req.headers()['x-admin-token']});
  if(u.pathname==='/telegram-history')return route.fulfill({json:{daily:[],alerts:[]}});
  if(u.pathname==='/source-health'){pageNumber=Number(u.searchParams.get('page'));return route.fulfill({json:{ok:true,note:'Cache deste datacenter; não representa visão global.',page:pageNumber,pages:2,sources:[{group:pageNumber?'NOAA':'USGS <script>window.bad=true</script>',state:pageNumber?'retrying':'fresh',lastOk:Date.now()-50000,attempt:Date.now(),next:pageNumber?Date.now()+30000:0}],usage:{available:true,day:'2026-10-17',counts:{'translation.read.attempted':3},activity:{sourceRequests:30,sourceCacheHits:29,sourceFetches:1,sourceFailures:0}}}});}
  return route.abort();
 });
 await page.route('**/__shared-health-test',r=>r.fulfill({contentType:'text/html',body:'<main><div id="ts-more-menu"></div></main>'}));await page.goto('/__shared-health-test');await page.addScriptTag({path:'js/telegram-history.js'});await page.evaluate(()=>TelegramAdmin.open());await page.locator('#tg-admin-key').fill('private-test');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('button',{name:'Saúde do serviço',exact:true}).click();
 const dialog=page.locator('#tg-admin-dialog');await expect(dialog).toContainText('Coleta compartilhada');await expect(dialog).toContainText('Resposta recente');await expect(dialog).toContainText('Cache deste datacenter; não representa visão global.');await expect(dialog.getByRole('link',{name:'Ver consumo do Durable e meta diária'})).toHaveAttribute('href',/cloudflare-durable-audit.yml$/);await expect(dialog).toContainText('Tradução · leituras: 3');expect(await page.evaluate(()=>window.bad)).toBeUndefined();
 await page.getByRole('button',{name:'Próxima',exact:true}).click();await expect(dialog).toContainText('Nova tentativa pendente');await expect(dialog).toContainText('Próxima tentativa permitida');expect(pageNumber).toBe(1);expect(requests.every(r=>r.token==='private-test'&&!r.url.includes('private-test'))).toBe(true);expect(await page.evaluate(()=>localStorage.length)).toBe(0);
 await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.locator('#tg-admin-key')).toBeVisible();
});

const {test,expect}=require('@playwright/test');
async function boot(page,query=''){
 await page.route('**/__optional-panels*',r=>r.fulfill({contentType:'text/html',body:'<main><div id="ts-more-menu"></div></main>'}));
 await page.goto('/__optional-panels'+query);
 await page.addScriptTag({path:'js/optional-features.js'});
}
test('public startup defers private history; repeated opens share assets',async({page})=>{
 const requests=[];page.on('request',r=>requests.push(r.url()));await boot(page);
 expect(requests.filter(u=>/telegram-history|solar-system/.test(u))).toEqual([]);
 expect(await page.evaluate(()=>TelegramAdmin.isAuthenticated())).toBe(false);
 await page.evaluate(()=>Promise.all([TelegramAdmin.open(),TelegramAdmin.open()]));
 await expect(page.getByRole('dialog',{name:'Histórico do Telegram'})).toBeVisible();
 expect(requests.filter(u=>/js\/telegram-history/.test(u))).toHaveLength(1);
 expect(requests.filter(u=>/css\/telegram-history/.test(u))).toHaveLength(1);
 expect(requests.some(u=>u.includes('workers.dev'))).toBe(false);
 await page.getByRole('button',{name:'Fechar histórico'}).click();
 await page.evaluate(()=>TelegramAdmin.open());await expect(page.locator('#tg-admin-dialog')).toBeVisible();
 expect(requests.filter(u=>/js\/telegram-history/.test(u))).toHaveLength(1);
 await page.getByRole('button',{name:'Fechar histórico'}).click();
 expect(await page.evaluate(()=>typeof window.SolarSystem)).toBe('undefined');
});
test('admin link opens login after deferred loading without storing a token',async({page})=>{
 await boot(page,'?admin=1');await expect(page.locator('#tg-admin-key')).toBeVisible();
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});
for(const file of ['css/telegram-history.css','js/telegram-history.js'])test('failed '+file+' can retry without leaving duplicate dialogs',async({page})=>{
 let attempts=0;await page.route('**/'+file+'*',r=>++attempts===1?r.abort():r.continue());
 await boot(page);await page.evaluate(()=>TelegramAdmin.open());await expect(page.locator('#tg-admin-dialog')).toHaveCount(0);
 await page.evaluate(()=>TelegramAdmin.open());await expect(page.locator('#tg-admin-key')).toBeVisible();expect(attempts).toBe(2);
 await expect(page.locator('#tg-admin-dialog')).toHaveCount(1);
});

test('admin can send a single text smoke test from history panel without HTTP editor',async({page})=>{
 let posts=0,tokenInUrl=false,method='',credential='';
 await page.route('**/telegram-history',r=>r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,daily:[],alerts:[]})}));
 await page.route('**/telegram-admin-smoke',r=>{
  posts++;method=r.request().method();credential=r.request().headers()['x-admin-token'];
  tokenInUrl=r.request().url().includes('test-key');
  return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,mode:'text',messageId:811})});
 });
 await boot(page,'?admin=1');
 await page.locator('#tg-admin-key').fill('test-key');
 await page.getByRole('button',{name:'Entrar'}).click();
 const button=page.getByRole('button',{name:'Enviar teste ao canal'});
 await expect(button).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await button.click();
 await expect(page.locator('#tg-admin-dialog .tg-admin-message')).toContainText('mensagem 811');
 expect(posts).toBe(1);expect(method).toBe('POST');expect(credential).toBe('test-key');expect(tokenInUrl).toBe(false);
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});

test('Telegram diagnostic checks identity and permissions without publishing',async({page})=>{
 let calls=0,method='';
 await page.route('**/telegram-history',r=>r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"daily":[],"alerts":[]}'}));
 await page.route('**/telegram-admin-diagnose',r=>{
  calls++;method=r.request().method();
  return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"ok":false,"botUsername":"MonitorGlobalTop_bot","stage":"bot","error":"Worker está usando o bot antigo."}'});
 });
 await boot(page,'?admin=1');
 await page.locator('#tg-admin-key').fill('test-key');
 await page.getByRole('button',{name:'Entrar'}).click();
 await page.getByRole('button',{name:'Verificar bot e canal'}).click();
 await expect(page.locator('#tg-admin-dialog .tg-admin-message')).toContainText('Worker está usando o bot antigo.');
 expect(calls).toBe(1);expect(method).toBe('POST');
});

test('Imperial Bronze menu shortcut opens the exact PNG uploader after admin login',async({page})=>{
 let sent=0,authHeader='',name='';
 await page.route('**/telegram-history',route=>route.fulfill({
   status:200,headers:{'access-control-allow-origin':'*'},
   contentType:'application/json',body:'{"ok":true,"daily":[],"alerts":[]}'
 }));
 await page.route('**/telegram-imperial-preview',route=>{
   sent++;authHeader=route.request().headers()['x-admin-token'];
   const payload=route.request().postData()||'';
   name=payload.includes('approved-imperial.png')?'approved-imperial.png':'missing';
   return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},
     contentType:'application/json',body:JSON.stringify({ok:true,posted:true,messageId:616,channel:'@argosorbis'})});
 });
 await boot(page);
 const menu=page.locator('#admin-telegram-imperial');
 await expect(menu).toBeVisible();
 await menu.click();
 await expect(page.locator('#tg-admin-key')).toBeVisible();
 await page.locator('#tg-admin-key').fill('private-demo');
 await page.getByRole('button',{name:'Entrar'}).click();
 await expect(page.getByText('Publicar a imagem Imperial Bronze aprovada')).toBeVisible();
 const input=page.locator('#tg-imperial-png');
 await input.setInputFiles({name:'approved-imperial.png',mimeType:'image/png',buffer:Buffer.from('unit-test-image')});
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Publicar esta imagem no @argosorbis'}).click();
 await expect(page.locator('.tg-imperial-upload')).toContainText('mensagem 616');
 expect(sent).toBe(1);expect(authHeader).toBe('private-demo');expect(name).toBe('approved-imperial.png');
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});
test('mobile shortcut remains available even when user is not authenticated',async({page})=>{
 await boot(page);
 expect(await page.evaluate(()=>typeof TelegramAdmin.openImperialBronze)).toBe('function');
 await expect(page.locator('#admin-telegram-imperial')).toHaveCount(1);
 await page.locator('#admin-telegram-imperial').click();
 await expect(page.getByRole('dialog',{name:'Histórico do Telegram'})).toBeVisible();
 await expect(page.locator('#tg-admin-key')).toBeVisible();
});

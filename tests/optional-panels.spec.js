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

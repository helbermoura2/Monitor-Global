const {test,expect}=require('@playwright/test');
test('unmocked production requests cannot leave the browser; local mocks still work',async({page,request})=>{
 await page.goto('/index.html');
 const blocked=await page.evaluate(async()=>{try{await fetch('https://black-sky-9ba0.terrestre.workers.dev/health');return false;}catch{return true;}});expect(blocked).toBe(true);
 await expect(request.get('https://black-sky-9ba0.terrestre.workers.dev/health',{timeout:5000})).rejects.toThrow();
 await page.route('https://black-sky-9ba0.terrestre.workers.dev/offline-fixture',route=>route.fulfill({json:{fixture:true},headers:{'Access-Control-Allow-Origin':'*'}}));
 expect(await page.evaluate(async()=>(await(await fetch('https://black-sky-9ba0.terrestre.workers.dev/offline-fixture')).json()).fixture)).toBe(true);
});

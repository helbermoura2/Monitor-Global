const {test,expect}=require('@playwright/test');
test('two real Chromium tabs reuse public freshness without hiding a revision or expired source',async({context})=>{
 await context.route('**/quota-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Quota fixture</title>'}));
 let calls=0;
 await context.route('https://black-sky-9ba0.terrestre.workers.dev/**',async r=>{calls++;await new Promise(resolve=>setTimeout(resolve,35));await r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Monitor-Source-State,X-Monitor-Source-Last-Ok,X-Monitor-Source-Next-Retry','X-Monitor-Source-State':'fresh','X-Monitor-Source-Last-Ok':String(Date.now()),'X-Monitor-Source-Next-Retry':String(Date.now()+1000),'Content-Type':'application/json'},body:JSON.stringify({revision:calls})});});
 const a=await context.newPage(),b=await context.newPage();
 for(const p of [a,b]){await p.goto('/quota-fixture');await p.evaluate(()=>Object.defineProperty(document,'hidden',{get:()=>false}));await p.addScriptTag({url:'/js/cross-tab-public-requests.js'});await p.addScriptTag({url:'/js/browser-request-budget.js'});}
 const get=(p,suffix='')=>p.evaluate(async suffix=>{const req=new Request('https://black-sky-9ba0.terrestre.workers.dev/global-feeds'+suffix);return (await BrowserRequestBudget.fetch(req,fetch,3000)).json();},suffix);
 const both=await Promise.all([get(a),get(b)]);expect(both).toEqual([{revision:1},{revision:1}]);expect(calls).toBe(1);
 expect(await get(b,'?revision=2')).toEqual({revision:2});expect(calls).toBe(2);
 await a.waitForTimeout(1100);expect(await get(a)).toEqual({revision:3});expect(calls).toBe(3);
 await Promise.all([a.close(),b.close()]);
});

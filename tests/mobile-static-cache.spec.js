const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const oldWorker='sw-mobile-benchmark-before.js';
test.beforeAll(()=>fs.writeFileSync(oldWorker,fs.readFileSync('tests/fixtures/sw-network-first-before.js')));
test.afterAll(()=>fs.rmSync(oldWorker,{force:true}));
test('unchanged versioned code avoids a second network fetch while data remain uncached',async({browser})=>{
 const results={};
 for(const [name,script]of [['before',oldWorker],['after','sw-monitor.js']]){
  const context=await browser.newContext({serviceWorkers:'allow'});
  try{
   await context.route('**/__cache-probe',r=>r.fulfill({contentType:'text/html',body:'<main>Cache probe</main>'}));const page=await context.newPage();await page.goto('/__cache-probe');
   await page.evaluate(async script=>{await navigator.serviceWorker.register('/'+script,{scope:'/'});await navigator.serviceWorker.ready;},script);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const worker=context.serviceWorkers()[0];await worker.evaluate(()=>{self.__probeFetches=0;const original=self.fetch.bind(self);self.fetch=(...args)=>{const url=typeof args[0]==='string'?args[0]:args[0].url;if(url.includes('sw-budget-probe'))self.__probeFetches++;return original(...args);};});
   const url='/js/debug-panel.js?v=sw-budget-probe';await page.evaluate(async url=>(await fetch(url,{cache:'reload'})).text(),url);
   await expect.poll(()=>worker.evaluate(async()=>{for(const name of await caches.keys()){const c=await caches.open(name);if(await c.match(new URL('/js/debug-panel.js?v=sw-budget-probe',location.origin).href))return true;}return false;})).toBe(true);
   await page.evaluate(async url=>(await fetch(url,{cache:'reload'})).text(),url);results[name]=await worker.evaluate(()=>self.__probeFetches);
   if(name==='after'){await context.setOffline(true);expect((await page.evaluate(async url=>(await fetch(url,{cache:'reload'})).text(),url)).length).toBeGreaterThan(0);expect(await page.evaluate(async()=>{try{await fetch('/data/cemaden-alerts.json',{cache:'no-store'});return false;}catch{return true;}})).toBe(true);}
  }finally{await context.close();}
 }
 expect(results).toEqual({before:2,after:1});console.log('Versioned asset network fetches:',JSON.stringify(results));
});

const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
const origin=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
for(const width of [1280,390])test('site image universal and video action isolated '+width,async({page})=>{
 test.setTimeout(120000);
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.setViewportSize({width,height:844});
 await page.goto(origin+'/?verify=site-concept6-v1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.EventStore&&!!window.RecordPresentation);
 await page.evaluate(()=>{
  if(typeof pausarBuscas==='function')pausarBuscas();
  if(typeof cycleTimeout!=='undefined')clearTimeout(cycleTimeout);
  Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
 });
 const choose=async(id,mag,code,coords)=>{
  await page.evaluate(({id,mag,code,coords})=>{
   const item={id,type:'earthquake',mag,depth:0,coords,place:code==='BR'?'Lajedo/PE':'Test region',time:Date.now(),source:'QA',countryCode:code};
   globalEvents=[item];showEventDetails(0,false);
   if(typeof cycleTimeout!=='undefined')clearTimeout(cycleTimeout);
  },{id,mag,code,coords});
 };

 const mapFixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#274934';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];});
 await page.route('https://server.arcgisonline.com/**',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(mapFixture,'base64')}));
 await choose('br-site-low',1.8,'BR',[-36.24,-8.67]);
 await expect(page.locator('#pd-video-btn')).toBeVisible();
 const download=page.waitForEvent('download');
 await page.locator('#pd-share-btn').click();
 const png=await download;expect(png.suggestedFilename()).toBe('evento-earthquake-br-site-low.png');
 const canvasMeta=await page.evaluate(async()=>{
  const meta=await QuakeSiteFlags.resolve(EventStore.getSelected());
  return {meta,layout:QuakeSiteCard.version};
 });
 expect(canvasMeta.meta).toMatchObject({countryCode:'BR',stateCode:'PE'});
 expect(canvasMeta.layout).toBe('site-concept6-v1');
 await choose('jp-site-small',4.3,'JP',[139.69,35.68]);
 await expect(page.locator('#pd-video-btn')).toBeHidden();
 await expect(page.locator('#pd-share-btn')).toBeVisible();
 await choose('jp-site-big',6.3,'JP',[139.69,35.68]);
 await expect(page.locator('#pd-video-btn')).toBeVisible();
});


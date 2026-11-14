const {test,expect}=require('@playwright/test');

test.use({serviceWorkers:'block'});

test('Argos Orbis stays readable beside the animated globe in narrow portrait headers',async({page})=>{
  await page.route('**/*',route=>
    new URL(route.request().url()).hostname==='127.0.0.1'
      ?route.continue():route.abort());
  for(const width of [320,360,390,412]){
    await page.setViewportSize({width,height:844});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(300); // permite reorganização do cabeçalho no retrato
    const brand=await page.evaluate(()=>{
      const title=document.querySelector('#top-strip .ts-title.mg-title');
      const picture=title?.querySelector('.mg-logo-frame');
      const name=title?.querySelector('.mg-logo-word');
      const live=document.querySelector('#top-strip .ts-mainrow #ao-vivo-badge');
      const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
      return {
        title:rect(title),picture:rect(picture),name:rect(name),
        live:live?rect(live):null,
        iconReady:picture.querySelector('img').complete&&picture.querySelector('img').naturalWidth>0,
        flexDirection:getComputedStyle(title).flexDirection,
        wordDirection:getComputedStyle(name).flexDirection,
        wordText:name.textContent.replace(/\s+/g,''),
        nameColor:getComputedStyle(name.querySelector('.ao-word-orbis')).color
      };
    });
    expect(brand.iconReady).toBe(true);
    expect(brand.wordText).toBe('ARGOSORBIS');
    expect(brand.flexDirection).toBe('row');
    expect(brand.wordDirection).toBe('column');
    expect(brand.picture.w).toBeGreaterThanOrEqual(39);
    expect(brand.name.x).toBeGreaterThanOrEqual(brand.picture.right-1);
    expect(brand.title.right).toBeLessThanOrEqual(width-70);
    expect(brand.name.y).toBeGreaterThanOrEqual(brand.title.y-1);
    if(width>=360&&brand.live){
      expect(brand.live.x).toBeGreaterThanOrEqual(brand.title.right-5);
    }
  }
});

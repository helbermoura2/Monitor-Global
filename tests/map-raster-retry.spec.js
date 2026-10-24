const {test,expect}=require('@playwright/test');
test('an errored raster retry never renders a tile before its texture exists',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let failed=false,retry=false;
 if(process.env.MAPLIBRE_BASELINE)await page.route('**/vendor/maplibre-gl.js',r=>r.fulfill({path:process.env.MAPLIBRE_BASELINE,contentType:'application/javascript'}));
 const tile=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#14394a';x.fillRect(0,0,256,256);return c.toDataURL().split(',')[1];}),'base64');
 await page.route('**/raster-retry-tile/**',async r=>{if(!failed){failed=true;return r.fulfill({status:503,body:'Injected failure'});}if(retry)await new Promise(resolve=>setTimeout(resolve,150));return r.fulfill({contentType:'image/png',body:tile});});
 await page.route('**/raster-retry-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="map" style="width:600px;height:400px"></div><script src="/vendor/maplibre-gl.js"></script><script>window.map=new maplibregl.Map({container:"map",center:[0,0],zoom:1,style:{version:8,sources:{satellite:{type:"raster",tiles:[location.origin+"/raster-retry-tile/{z}/{x}/{y}"],tileSize:256}},layers:[{id:"satellite",source:"satellite",type:"raster"}]}});window.ready=new Promise(r=>map.once("idle",r));</script>'}));
 await page.goto('/raster-retry-harness');await page.evaluate(()=>ready);retry=true;
 await page.evaluate(()=>{map.refreshTiles('satellite');map.easeTo({center:[2,1],duration:1200});});
 await page.waitForTimeout(1800);
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>Object.values(map.style.tileManagers.satellite._tiles).some(t=>t.state==='loaded'&&!!t.texture))).toBe(true);
});

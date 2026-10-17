const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
async function boot(page){
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.goto('/');await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();});
}
test('startup omits map test and ZIP parser; concurrent ZIP consumers share a working library',async({page})=>{
 const requests=[];page.on('request',r=>requests.push(r.url()));await boot(page);
 expect(requests.filter(u=>/jszip|seismic-scenario-demo/.test(u))).toEqual([]);
 const text=await page.evaluate(async()=>{await Promise.all([OptionalFeatures.zip(),OptionalFeatures.zip()]);const z=new JSZip();z.file('track.kml','<kml>local test</kml>');const data=await z.generateAsync({type:'uint8array'});return (await JSZip.loadAsync(data)).file('track.kml').async('text');});
 expect(text).toBe('<kml>local test</kml>');expect(requests.filter(u=>/jszip/.test(u))).toHaveLength(1);
 await page.evaluate(()=>CardEffectDemo.open());await expect(page.locator('#card-fx-demo-type')).toBeVisible();
 expect(await page.evaluate(()=>typeof SeismicScenarioDemo.start)).toBe('function');expect(requests.filter(u=>/seismic-scenario-demo/.test(u))).toHaveLength(1);
});
test('failed ZIP load is retried successfully',async({page})=>{
 let attempts=0;
 // Add the specific route after boot, because the generic route takes precedence otherwise.
 await boot(page);await page.route('**/vendor/jszip.min.js?*',r=>++attempts===1?r.abort():r.continue());
 expect(await page.evaluate(()=>OptionalFeatures.zip().then(()=>false,()=>true))).toBe(true);
 await page.evaluate(()=>OptionalFeatures.zip());expect(attempts).toBe(2);expect(await page.evaluate(()=>typeof JSZip.loadAsync)).toBe('function');
});
test('official cyclone KMZ parser loads ZIP dependency and preserves track and cone geometry',async({page})=>{
 await boot(page);
 const Zip=require('../vendor/jszip.min.js'),zip=new Zip();zip.file('cone.kml','<kml><Placemark><name>Cone oficial de teste</name><LineString><coordinates>-80,20 -79,21</coordinates></LineString><Polygon><outerBoundaryIs><LinearRing><coordinates>-80,20 -79,20 -79,21 -80,20</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>');
 const body=await zip.generateAsync({type:'nodebuffer'});const proxyUrl=await page.evaluate(()=>WORKER_PROXY('https://example.invalid/cone.kmz'));await page.route(proxyUrl,r=>r.fulfill({contentType:'application/vnd.google-earth.kmz',body}));
 const result=await page.evaluate(async()=>{return fetchKmzGeoJSON('https://example.invalid/cone.kmz');});
 expect(result.linhas).toHaveLength(1);expect(result.poligonos).toHaveLength(1);expect(result.linhas[0].geometry.coordinates).toEqual([[-80,20],[-79,21]]);
});

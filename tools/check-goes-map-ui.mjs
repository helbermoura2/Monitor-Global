// End-to-end map-control test using real INPE samples in an isolated replay clock.
// No live freshness is asserted by this test; operational freshness has its own gate.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const bundle=resolve(process.argv[2]||'missing');
const folder='android-mobile/app/src/main/assets/';
const refs=Object.fromEntries(await Promise.all(['B08','B09','B10'].map(async b=>[b,JSON.parse(await readFile('/tmp/argos-goes-'+b+'.json','utf8'))])));
const originalTime=Date.parse(refs.B08.time);
assert(Number.isFinite(originalTime)&&Object.values(refs).every(r=>Date.parse(r.time)===originalTime));
const clock=originalTime+20*60000;
let browser,server,downloads=0,mode='ok';
try{
 const files=new Map([['/phone-goes-model.js',[folder+'phone-goes-model.js','text/javascript']],['/phone-goes.js',[folder+'phone-goes.js','text/javascript']],['/vendor/cappi/inpe-cappi-worker.mjs',[bundle,'text/javascript']],['/data/brazil-satellite-border.json',['data/brazil-satellite-border.json','application/json']]]);
 server=createServer(async(req,res)=>{
  try{
   res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://gibs.earthdata.nasa.gov; worker-src 'self'; connect-src 'self' https://data.inpe.br; base-uri 'none'; form-action 'none'");
   if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>GOES map replay test</title><main id="map"></main><script src="/phone-goes-model.js"></script><script src="/phone-goes.js"></script>');return;}
   const f=files.get(req.url);if(!f){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',f[1]);res.end(await readFile(f[0]));
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(clock=>{window.__testNow=clock;Date.now=()=>window.__testNow;},clock);
 const assets=Object.fromEntries(Object.entries(refs).map(([band,r])=>[band,{type:'application/x-netcdf',href:r.asset}]));
 await page.route('https://data.inpe.br/**',async route=>{
  const url=new URL(route.request().url()),headers={'Access-Control-Allow-Origin':'*'};
  if(url.pathname==='/bdc/stac/v1/search'){
   return route.fulfill({headers,json:{features:mode==='empty'?[]:[{collection:'GOES19-L2-CMI-1',properties:{datetime:refs.B08.time},assets}]}});
  }
  const band=Object.keys(refs).find(b=>refs[b].asset===url.href);
  if(!band)throw Error('Unexpected NetCDF request '+url.pathname);
  downloads++;return route.fulfill({headers,contentType:'application/octet-stream',body:await readFile('/tmp/argos-goes-'+band+'.nc')});
 });
 await page.route('https://gibs.earthdata.nasa.gov/**',route=>route.fulfill({status:404}));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  const source=new Map(),layers=new Map();
  const map={getContainer:()=>document.getElementById('map'),getBounds:()=>({getWest:()=>-75,getEast:()=>-28,getSouth:()=>-35,getNorth:()=>6}),getSource:id=>source.get(id),getLayer:id=>layers.get(id),addSource:(id,o)=>source.set(id,{...o,play(){},pause(){}}),removeSource:id=>source.delete(id),addLayer:o=>layers.set(o.id,o),removeLayer:id=>layers.delete(id),setPaintProperty(){},triggerRepaint(){},on(){},off(){},fitBounds(){},isStyleLoaded:()=>true};
  window.__testMap=map;window.__testSatellite=window.BrazilSatellite.create({map,enabled:false});
  document.querySelector('.brazil-satellite-control details').open=true;
  const checkbox=document.querySelector('input[type=checkbox]');const selector=document.querySelector('[data-action=product]');
  selector.value='b08';selector.dispatchEvent(new Event('change'));checkbox.click();
 });
 const select=page.getByLabel('Produto GOES-19');
 for(const [key,band] of [['b08','B08'],['b09','B09'],['b10','B10']]){
  if(key!=='b08')await select.selectOption(key);
  await page.waitForFunction(({key,originalTime})=>window.__testSatellite.state.product===key&&window.__testSatellite.state.dataAt===originalTime&&window.__testMap.getLayer('br-satellite-layer')&&document.querySelector('.brazil-satellite-control').dataset.ready==='true',{key,originalTime},{timeout:100000});
  const result=await page.evaluate(()=>{
   const src=window.__testMap.getSource('br-satellite-source'),ctx=src.canvas.getContext('2d'),pixels=ctx.getImageData(0,0,1200,1200).data;
   const [x,y]=BrazilSatelliteModel.point(-46.635,-23.555),i=(Math.floor(y)*1200+Math.floor(x))*4;
   return {coverage:window.__testSatellite.state.coverage,alpha:pixels[i+3],cornerAlpha:pixels[3],attribution:src.attribution,coords:src.coordinates};
  });
  assert(result.coverage>=.98);assert(result.alpha>0);assert.equal(result.cornerAlpha,0);assert.match(result.attribution,/INPE/);assert.deepEqual(result.coords,[[-75,6],[-28,6],[-28,-35],[-75,-35]]);
  assert.equal(await page.locator('[data-action=play]').isDisabled(),true);
  console.log(JSON.stringify({band,downloads,coverage:result.coverage,clipped:true,map:'passed',mode:'isolated real historical replay'}));
 }
 assert.equal(downloads,3);
 await page.evaluate(()=>{window.__testNow+=71*60000;window.__testSatellite.setActive(false);window.__testSatellite.setActive(true);});
 await page.waitForFunction(()=>!window.__testMap.getLayer('br-satellite-layer')&&document.querySelector('.br-satellite-status').textContent.includes('expirou'));
 mode='empty';
 await page.locator('[data-action=latest]').click();
 await page.waitForFunction(()=>document.querySelector('.br-satellite-status').textContent.includes('sem quadro recente'));
 assert.equal(downloads,3,'expired metadata must not trigger another binary download');
 assert.deepEqual(errors,[]);
 console.log('GOES UI: three real channels, Brazil clipping, source attribution and expiration passed');
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(r=>server.close(r));
}

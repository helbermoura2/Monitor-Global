// Isolated UI integration check. Actual NetCDF bytes, controlled catalog and base map.
// The fixture is not a current weather report. No production service is modified.
import {chromium,expect} from '@playwright/test';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base=resolve('android-mobile/app/src/main/assets'),bundle=process.argv[2];
const origin='https://appassets.androidplatform.net',prefix='/assets/v66/';
const now=Date.now(),sample=JSON.parse(await readFile('/tmp/argos-inpe-cappi15l.json','utf8'));
const actual=await readFile('/tmp/argos-raw-cappi15l.nc');
const href=sample.products.cappi15l.href,uri=new URL(href);
const catalog={type:'FeatureCollection',features:[{type:'Feature',id:'ui-test-real-bytes',collection:'br-weather-radar-cappi-1',bbox:sample.bounds,properties:{radar:sample.radar,owner:sample.owner,datetime:new Date(now-600000).toISOString()},assets:{cappi15l:{href,type:'application/octet-stream'}}}],links:[]};
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64');
const dirs=[base,resolve('js'),resolve('css'),resolve('vendor'),resolve('data'),resolve('assets/weather')];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:760},deviceScaleFactor:1});
 let catalogCalls=0,downloads=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let lib;Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>lib,set:value=>{lib=value;const Original=value.Map;value.Map=class extends Original{constructor(o){super(o);window.__map=this;}};}});});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),cors={'Access-Control-Allow-Origin':'*'};
  if(u.origin===origin&&u.pathname.startsWith(prefix)){
   const name=u.pathname.slice(prefix.length);
   if(name==='vendor/cappi/inpe-cappi-worker.mjs')return route.fulfill({contentType:'text/javascript',path:bundle});
   if(name.includes('..'))return route.abort();
   for(const dir of dirs){
    const path=resolve(dir,name.startsWith('vendor/')||name.startsWith('data/')?name.split('/').slice(1).join('/'):name);
    try{if((await stat(path)).isFile())return route.fulfill({path, ...(name.endsWith('.mjs')?{contentType:'text/javascript'}:{})});}catch{}
   }
   return route.fulfill({status:404,body:'unavailable fixture asset'});
  }
  if(u.hostname==='data.inpe.br'&&u.pathname==='/bdc/stac/v1/search'){catalogCalls++;return route.fulfill({headers:cors,json:catalog});}
  if(u.href===uri.href){downloads++;return route.fulfill({headers:cors,contentType:'application/octet-stream',body:actual});}
  if(u.hostname==='server.arcgisonline.com'||u.hostname==='tilecache.rainviewer.com')return route.fulfill({headers:cors,contentType:'image/png',body:blank});
  if(u.hostname==='api.rainviewer.com')return route.fulfill({headers:cors,json:{version:'2.0',host:'https://tilecache.rainviewer.com',radar:{past:[]}}});
  return route.fulfill({status:503,headers:cors,body:'offline fixture'});
 });
 await page.goto(origin+prefix+'phone-brazil.html');
 await page.waitForFunction(()=>window.__map?.isStyleLoaded()&&window.MonitorMap?.inpeCenter());
 await page.evaluate(([w,s,e,n])=>window.__map.jumpTo({center:[(w+e)/2,(s+n)/2],zoom:5}),sample.bounds);
 await page.locator('#layers-toggle').click();
 await page.locator('#inpe-catalog-toggle').click();
 await page.locator('#inpe-catalog-search').click();
 const details=page.locator('#inpe-catalog-results details').first();
 await details.locator('summary').click();
 const levels=details.getByLabel('Altitude CAPPI');
 await expect(levels.locator('option')).toHaveCount(15);
 await levels.selectOption('3000');
 await details.getByRole('button',{name:'Exibir no mapa'}).click();
 await page.waitForFunction(()=>window.__map.getLayer('br-inpe-cappi-layer')&&window.__map.isSourceLoaded('br-inpe-cappi'),{},{timeout:45000});
 await expect(page.locator('#inpe-map-label')).toContainText('3 km');
 assert.equal(downloads,1);
 await page.locator('#inpe-map-return').click();
 await levels.selectOption('16000');
 await details.getByRole('button',{name:'Exibir no mapa'}).click();
 await expect(page.locator('#inpe-map-label')).toContainText('16 km',{timeout:45000});
 await page.waitForFunction(()=>window.__map.getLayer('br-inpe-cappi-layer')&&window.__map.isSourceLoaded('br-inpe-cappi'));
 assert.equal(downloads,1,'same multi-level file must be reused');
 await page.locator('#inpe-map-clear').click();
 assert.equal(await page.evaluate(()=>!!window.__map.getLayer('br-inpe-cappi-layer')),false);
 await expect(page.locator('#inpe-map-readout')).toBeHidden();
 await page.locator('#radar-toggle').click();
 await expect(page.locator('#radar-toggle')).toHaveAttribute('aria-pressed','true');
 assert.equal(catalogCalls,1);
 assert.deepEqual(errors,[]);
 console.log('CAPPI interface passed: actual data, 15 levels, 3/16 km, reuse, clear, RainViewer switch');
}finally{await browser.close();}

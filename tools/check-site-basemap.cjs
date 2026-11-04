'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),root=path.resolve(__dirname,'..');
async function verifyViewport(page){
 const measure=()=>page.evaluate(()=>{
  const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const r=map.getCanvas().getBoundingClientRect();
  const app=document.getElementById('app');return {viewport:innerHeight,inline:app.style.height,priority:app.style.getPropertyPriority('height'),computed:getComputedStyle(app).height,app:box('app'),wrap:box('mapWrap'),container:box('mapContainer'),canvas:{bottom:r.bottom,height:r.height},sameMap:map===beforeMap};
 });
 const full=async()=>{
  await page.waitForFunction(()=>{const app=document.getElementById('app');return app.style.getPropertyPriority('height')==='important'&&Math.abs(parseFloat(app.style.height)-innerHeight)<1&&Math.abs(app.getBoundingClientRect().bottom-innerHeight)<1&&Math.abs(map.getCanvas().getBoundingClientRect().bottom-innerHeight)<1;}).catch(async error=>{throw Error(error.message+' '+JSON.stringify(await measure()));});
  const state=await measure();
  for(const key of ['app','wrap','container','canvas'])assert(Math.abs(state[key].bottom-state.viewport)<1,key+' must reach the browser viewport bottom: '+JSON.stringify(state));
  assert(state.sameMap,'viewport updates must preserve the map instance');return state;
 };
 await page.addStyleTag({content:'@media(min-width:901px){body #app{height:calc(100vh - 56px)!important}}'});
 await page.evaluate(()=>{
  // Emulate a browser retaining its smaller dynamic/visual viewport after
  // chrome disappears. A normal inline height cannot beat the CSS rule.
  Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-56});
  document.getElementById('app').style.removeProperty('height');
  document.getElementById('app').style.height=visualViewport.height+'px';map.resize();
 });
 const short=await measure();assert.equal(short.viewport-short.app.bottom,56,'the fixture must reproduce the bottom gap');
 await page.evaluate(()=>__resizeMapParaViewportAtual());
 const fixed=await full(),sizes=[];
 for(const viewport of [{width:1280,height:638},{width:960,height:540},{width:1920,height:1080}]){
  await page.setViewportSize(viewport);sizes.push(await full());
 }
 await page.setViewportSize({width:1280,height:638});await full();
 for(const event of ['pageshow','fullscreenchange']){
  await page.evaluate(name=>{document.getElementById('app').style.removeProperty('height');map.resize();(name==='pageshow'?window:document).dispatchEvent(new Event(name));},event);
  await full();
 }
 await page.evaluate(()=>{delete visualViewport.height;GlobePreview.setMode('mercator');map.jumpTo({center:[176,-39],zoom:6});});
 await page.waitForTimeout(3000);await page.screenshot({path:'/tmp/site-basemap-viewport.png'});
 console.log('VIEWPORT_RESULT '+JSON.stringify({passed:true,short,fixed,sizes}));
}
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failures=[];let tiles=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,400));});page.on('requestfailed',r=>{if(r.url().includes('arcgisonline'))failures.push([r.url(),r.failure()]);});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='site-map.test'){let f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep)&&f!==root)return route.abort();if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f))return route.fulfill({status:404});return route.fulfill({contentType:({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}if(u.hostname==='server.arcgisonline.com'){tiles++;return route.continue();}return route.abort();});
 await page.goto('https://site-map.test/');await page.waitForFunction(()=>window.__mgMapReady,null,{timeout:30000});await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();map.jumpTo({center:[-151,60],zoom:1.7});});await page.waitForTimeout(15000);
 const report=async(label)=>{console.log('BASEMAP_'+label+' '+JSON.stringify(await page.evaluate(()=>{const c=map.getCanvas(),gl=c.getContext('webgl2')||c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let visible=0;for(let i=0;i<p.length;i+=4)if(p[i+3]&&p[i]+p[i+1]+p[i+2]>80)visible++;return {preserved:gl.getContextAttributes().preserveDrawingBuffer,ready:__mgMapReady,projection:map.getProjection(),canvas:[c.width,c.height],visible,layers:map.getStyle().layers.map(l=>({id:l.id,type:l.type,visibility:l.layout?.visibility})),recovery:AppRecovery.state()};}))),console.log('BASEMAP_NETWORK '+JSON.stringify({tiles,failures,errors}));await page.screenshot({path:'/tmp/site-basemap-'+label+'.png'});};
 assert.equal(await page.evaluate(()=>{const c=map.getCanvas(),gl=c.getContext('webgl2')||c.getContext('webgl');return gl.getContextAttributes().preserveDrawingBuffer;}),true,'MapLibre must preserve its real WebGL drawing buffer for the glass compositor');
 assert(await page.locator('.brazil-satellite-control').isHidden(),'satellite control must be hidden over Alaska');await report('initial');await page.evaluate(()=>GlobePreview.setMode('mercator'));await page.waitForTimeout(4000);await report('flat');
 await page.evaluate(()=>{GlobePreview.setMode('globe');map.jumpTo({center:[-51,-15],zoom:2});});await page.waitForTimeout(4000);assert(await page.locator('.brazil-satellite-control').isHidden(),'satellite panel must stay closed over Brazil');
 assert.equal(await page.locator('#chip-satellite').evaluate(el=>el.previousElementSibling.dataset.f),'tsunami');
 const chipOrder=await page.evaluate(()=>{const a=document.querySelector('[data-f="tsunami"]').getBoundingClientRect(),b=document.getElementById('chip-satellite').getBoundingClientRect();return b.left>=a.right;});assert(chipOrder,'satellite chip must visually follow Tsunamis');
 const cameraBefore=await page.evaluate(()=>map.getCenter().toArray());await page.locator('#chip-satellite').click();assert(await page.locator('.brazil-satellite-control').isVisible());assert.equal(await page.locator('#chip-satellite').getAttribute('aria-expanded'),'true');assert.deepEqual(await page.evaluate(()=>map.getCenter().toArray()),cameraBefore);
 await page.getByRole('button',{name:'Fechar controles do satélite'}).click();assert(await page.locator('.brazil-satellite-control').isHidden());
 await page.evaluate(()=>{window.satelliteSetting=localStorage.getItem('mg-br-satellite');map.jumpTo({center:[176.9,-39.6],zoom:7});});await page.waitForTimeout(300);assert(await page.locator('.brazil-satellite-control').isHidden());assert.equal(await page.evaluate(()=>localStorage.getItem('mg-br-satellite')),await page.evaluate(()=>satelliteSetting));
 await page.evaluate(()=>map.jumpTo({center:[-51,-15],zoom:2}));await page.waitForTimeout(3000);assert(await page.locator('.brazil-satellite-control').isHidden(),'returning to Brazil must never reopen the panel');
 await page.locator('#chip-satellite').click();assert(await page.locator('.brazil-satellite-control').isVisible());await page.keyboard.press('Escape');assert(await page.locator('.brazil-satellite-control').isHidden());assert.equal(await page.locator('#chip-satellite').getAttribute('aria-expanded'),'false');
 await page.locator('#chip-satellite').click();await page.locator('#chip-satellite').click();assert(await page.locator('.brazil-satellite-control').isHidden());
 await report('brazil');
 const painted=await page.evaluate(()=>{const c=map.getCanvas(),gl=c.getContext('webgl2')||c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let n=0;for(let i=0;i<p.length;i+=4)if(p[i+3]&&p[i]+p[i+1]+p[i+2]>80)n++;return n;});assert(painted>10000,'the idle map buffer must retain visible geography');
 await page.evaluate(()=>{window.beforeMap=map;window.beforeLayers=map.getStyle().layers.map(l=>l.id);const c=map.getCanvas(),gl=c.getContext('webgl2')||c.getContext('webgl');window.contextLoss=gl.getExtension('WEBGL_lose_context');contextLoss.loseContext();});await page.waitForFunction(()=>AppRecovery.state().lost);await page.waitForTimeout(300);await page.evaluate(()=>contextLoss.restoreContext());await page.waitForFunction(()=>!AppRecovery.state().lost&&map.isStyleLoaded());await page.waitForTimeout(3000);assert(await page.evaluate(()=>map===beforeMap),'recovery must retain the map instance');assert.deepEqual(await page.evaluate(()=>map.getStyle().layers.map(l=>l.id)),await page.evaluate(()=>beforeLayers));await report('restored');console.log('BASEMAP_RESULT '+JSON.stringify({passed:true,painted,contextRestored:true}));
 await verifyViewport(page);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

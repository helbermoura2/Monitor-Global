#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const apk=process.argv[process.argv.indexOf('--apk')+1];if(!apk||apk===process.argv[0])throw Error('Use --apk arquivo.apk');
const output=path.resolve('android-mobile/app/build/reports/rain-browser'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'phone-rain-check-'));
fs.mkdirSync(output,{recursive:true});
const version=fs.readFileSync('android-mobile/app/build.gradle','utf8').match(/versionCode\s+(\d+)/)[1],prefix='/assets/v'+version+'/',origin='https://appassets.androidplatform.net',api='https://black-sky-9ba0.terrestre.workers.dev';
function png(rain){
 const w=256,raw=Buffer.alloc(w*(1+4*w));for(let y=0;y<w;y++)for(let x=0;x<w;x++){const i=y*(1+4*w)+1+4*x,d=Math.hypot(x-120,y-125),c=rain?(d<32?[230,20,35]:d<55?[255,220,0]:d<95?[40,190,60]:[0,0,0]):[21+(x>>4)%2*8,53+(y>>4)%2*8,66];raw.set(c,i);raw[i+3]=rain?(d<95?185:0):255;}
 function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
 function chunk(n,b){const t=Buffer.from(n),l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([l,t,b,c]);}
 const h=Buffer.alloc(13);h.writeUInt32BE(w);h.writeUInt32BE(w,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
let browser;
(async()=>{
 execFileSync('python3',['-c',`import pathlib,sys,zipfile
dest=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(sys.argv[1]) as archive:
 for e in archive.infolist():
  p=pathlib.PurePosixPath(e.filename)
  if not p.parts or p.parts[0]!='assets' or '..' in p.parts or e.is_dir(): continue
  target=dest.joinpath(*p.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(e))
`,path.resolve(apk),temporary]);
 const assets=path.join(temporary,'assets'),launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;else launch.channel='chrome';browser=await chromium.launch(launch);
 const page=await browser.newPage({viewport:{width:360,height:610},deviceScaleFactor:1});
 const errors=[],unexpected=[],tileCalls=[];let fail=false,dry=false,pointCalls=0,snapshotCalls=0;const base=png(false),precip=png(true),stamp=Math.floor(Date.now()/600000)*600;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!fail)errors.push(m.text());});
 await page.addInitScript(()=>{window.__map=null;window.__rainDisposed=false;let library;Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>library,set:value=>{library=value;const OriginalMap=value.Map;value.Map=class extends OriginalMap{constructor(options){super(options);window.__map=this;}remove(){window.__rainDisposed=true;return super.remove();}};}});});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),cors={'Access-Control-Allow-Origin':'*'};
  if(u.origin===origin&&u.pathname==='/favicon.ico')return route.fulfill({status:204});
  if(u.origin===origin&&u.pathname.startsWith(prefix)){const file=path.resolve(assets,decodeURIComponent(u.pathname.slice(prefix.length)));if(!file.startsWith(assets+path.sep)||!fs.existsSync(file)){unexpected.push(u.href);return route.fulfill({status:404});}return route.fulfill({status:200,body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream'});}
  if(u.hostname==='server.arcgisonline.com')return route.fulfill({status:200,contentType:'image/png',headers:cors,body:base});
  if(u.origin===api&&u.pathname==='/rainbow-snapshot'){snapshotCalls++;return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({ok:true,snapshot:stamp})});}
  if(u.origin===api&&u.pathname==='/tv-rain'){pointCalls++;const now=Math.floor(Date.now()/60000)*60000;return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(fail?{ok:false}:{ok:true,version:'tv-rain-v1',area:'liberdade',loc:{lat:-23.555,lng:-46.635},at:Date.now(),expiresAt:Date.now()+600000,forecast:Array.from({length:180},(_,i)=>({start:now+i*60000,end:now+(i+1)*60000,rate:!dry&&i>=75&&i<110?5:0,type:!dry&&i>=75&&i<110?'rain':'no_precipitation'}))})});}
  if(u.origin===api&&u.pathname.startsWith('/rainbow-tile/')){tileCalls.push(u.pathname);return fail?route.fulfill({status:503,headers:cors,body:'Indisponível'}):route.fulfill({status:200,headers:cors,contentType:'image/png',body:precip});}
  unexpected.push(u.href);return route.abort();
 });
 try{
  await page.goto(origin+prefix+'phone-rain.html');
  await page.waitForFunction(()=>document.querySelector('#frame-label').textContent.startsWith('Quadro atual')&&document.querySelector('#chart svg'),null,{timeout:20000});
  assert.match(await page.locator('#headline').textContent(),/Chuva prevista em cerca de 7[45] min/);assert.equal(await page.locator('#chart svg path').count(),2);assert.equal(await page.locator('.liberdade-point').count(),1);assert.equal(await page.locator('.liberdade-point span').textContent(),'Liberdade');assert.equal(await page.locator('#frame-kind').textContent(),'ÚLTIMO QUADRO');
  assert.equal(await page.evaluate(()=>!!document.querySelector('.maplibregl-canvas').getContext('webgl2')),true);
  await page.evaluate(()=>window.__map.jumpTo({center:[-45.8,-22.9],zoom:6.5}));const camera=await page.evaluate(()=>({center:__map.getCenter().toArray(),zoom:__map.getZoom()}));
  await page.locator('#frame').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},9);await page.waitForFunction(()=>document.querySelector('#frame-label').textContent.startsWith('Previsão'),null,{timeout:15000});
  assert.ok(tileCalls.some(p=>p.includes('/7200/')),'future requests use a real forecast offset');assert.deepEqual(await page.evaluate(()=>({center:__map.getCenter().toArray(),zoom:__map.getZoom()})),camera,'changing the time cannot move the camera');
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#frame-label').textContent.startsWith('Histórico'),null,{timeout:15000});await page.evaluate(()=>MonitorMap.pause());
  await page.waitForTimeout(200);const count=tileCalls.length;await page.waitForTimeout(1600);assert.equal(tileCalls.length,count,'no playback or loading while hidden');assert.equal(await page.locator('#play').getAttribute('aria-label'),'Reproduzir animação');
  await page.evaluate(()=>MonitorMap.resume());await page.waitForFunction(()=>document.querySelector('#map-status').hidden);assert.equal(snapshotCalls,1);assert.equal(pointCalls,1,'fresh point data reused after resume');assert.deepEqual(await page.evaluate(()=>({center:__map.getCenter().toArray(),zoom:__map.getZoom()})),camera);
  await page.locator('#recenter').click();assert.ok(Math.abs(await page.evaluate(()=>__map.getCenter().lng)+46.635)<.001);
  await page.locator('#frame').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},3);await page.waitForFunction(()=>document.querySelector('#map-status').hidden);
  for(const [width,height]of [[360,610],[412,740]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.screenshot({path:path.join(output,'rain-'+width+'.png'),fullPage:true});if(width===360)console.log('PHONE_RAIN_SCREEN_360 '+(await page.screenshot({type:'jpeg',quality:76,fullPage:true})).toString('base64'));}
  await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+610000;MonitorMap.pause();MonitorMap.resume();});assert.match(await page.locator('#headline').textContent(),/Atualizando|indisponível/,'expired graph cleared before network completes');
  dry=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#headline').textContent.startsWith('Sem chuva estimada'));assert.equal(await page.locator('#forecast-details').getAttribute('open'),null,'a dry forecast does not reserve a large empty graph');assert.ok(await page.locator('.map-panel').evaluate(el=>el.getBoundingClientRect().height)>=280);await page.locator('#forecast-details summary').click();assert.equal(await page.locator('#chart svg').isVisible(),true,'dry graph remains available on request');
  fail=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#headline').textContent.includes('indisponível')&&document.querySelector('#frame-label').textContent==='Quadro indisponível',null,{timeout:20000});await page.waitForTimeout(300);assert.equal(await page.locator('#chart svg').count(),0);assert.doesNotMatch(await page.locator('#headline').textContent(),/Sem chuva/);assert.match(await page.locator('#map-status').textContent(),/indisponível/);await page.screenshot({path:path.join(output,'rain-offline.png'),fullPage:true});
  await page.evaluate(()=>MonitorMap.close());assert.equal(await page.locator('.maplibregl-canvas').count(),0);assert.equal(await page.evaluate(()=>__rainDisposed),true);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log(JSON.stringify({passed:true,tileCalls:tileCalls.length,snapshotCalls,pointCalls,renderer:'Chromium WebGL2, packaged APK assets',fixture:'synthetic PNGs and point series; no live weather claims'}));
  if(process.argv.includes('--live-proof')){const live=await browser.newPage({viewport:{width:412,height:740},deviceScaleFactor:1});const liveErrors=[];live.on('pageerror',e=>liveErrors.push(e.message));let requests=0;await live.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&u.pathname==='/favicon.ico')return route.fulfill({status:204});if(u.origin===origin&&u.pathname.startsWith(prefix)){const file=path.resolve(assets,decodeURIComponent(u.pathname.slice(prefix.length)));if(!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({status:200,body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream'});}if(u.hostname==='server.arcgisonline.com'||u.origin===api){if(++requests>40)throw Error('Live source proof exceeded bounded requests');return route.continue();}return route.abort();});await live.goto(origin+prefix+'phone-rain.html');await live.waitForFunction(()=>document.querySelector('#frame-label').textContent.startsWith('Quadro atual')&&!/Consultando|Atualizando/.test(document.querySelector('#headline').textContent),null,{timeout:30000});await live.waitForTimeout(1500);assert.deepEqual(liveErrors,[]);await live.screenshot({path:path.join(output,'rain-live.png'),fullPage:true});console.log('PHONE_RAIN_LIVE_412 '+(await live.screenshot({type:'jpeg',quality:82,fullPage:true})).toString('base64'));console.log('PHONE_RAIN_LIVE_RESULT '+JSON.stringify({requests,headline:await live.locator('#headline').textContent(),mapTime:await live.locator('#map-source').textContent()}));await live.close();}
 }catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.log('PHONE_RAIN_SCREEN_FAILURE '+(await page.screenshot({type:'jpeg',quality:76,fullPage:true})).toString('base64'));console.error(JSON.stringify({errors,unexpected,tileCalls,snapshotCalls,pointCalls}));throw e;}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();fs.rmSync(temporary,{recursive:true,force:true});});

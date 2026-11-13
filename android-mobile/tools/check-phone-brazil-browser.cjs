#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const apk=process.argv[process.argv.indexOf('--apk')+1];if(!apk)throw Error('Use --apk arquivo.apk');
const output=path.resolve('android-mobile/app/build/reports/brazil-browser'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'phone-brazil-check-'));fs.mkdirSync(output,{recursive:true});
const version=fs.readFileSync('android-mobile/app/build.gradle','utf8').match(/versionCode\s+(\d+)/)[1],prefix='/assets/v'+version+'/',origin='https://appassets.androidplatform.net';
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
 const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;else launch.channel='chrome';browser=await chromium.launch(launch);
 const page=await browser.newPage({viewport:{width:390,height:760},deviceScaleFactor:1});let mode='hold',metadataCalls=0,releaseFirst;const errors=[],tiles=[],unexpected=[],base=png(false),rain=png(true),now=Date.now(),stamp=Math.floor(now/600000)*600;
 const metadata={version:'2.0',host:'https://tilecache.rainviewer.com',radar:{past:[{time:stamp-600,path:'/v2/radar/9a4fd3f6a0e5'},{time:stamp,path:'/v2/radar/ead16661a2c1'}]}};
 const day=new Date(now-3*3600000).toISOString().slice(0,10),start=Date.parse(day+'T00:00:00Z'),hours=Array.from({length:72},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));const forecast={latitude:-23.555,longitude:-46.635,timezone:'America/Sao_Paulo',hourly:{time:hours,temperature_2m:hours.map(()=>22),wind_speed_10m:hours.map(()=>9),wind_direction_10m:hours.map(()=>90),precipitation:hours.map(()=>.1),pressure_msl:hours.map(()=>1013)}};
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__radarOffset=0;const NativeDate=Date;window.Date=class extends NativeDate {static now(){return NativeDate.now()+window.__radarOffset;}};let library;Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>library,set:value=>{library=value;const Original=value.Map;value.Map=class extends Original{constructor(o){super(o);window.__map=this;}};}});});
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),cors={'Access-Control-Allow-Origin':'*'};
  if(u.origin===origin&&u.pathname==='/favicon.ico')return route.fulfill({status:204});
  if(u.origin===origin&&u.pathname.startsWith(prefix)){const file=path.join(temporary,'assets',u.pathname.slice(prefix.length));if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.fulfill({status:404,body:'missing packaged asset'});}
  if(u.hostname==='server.arcgisonline.com')return route.fulfill({headers:cors,contentType:'image/png',body:base});
  if(u.hostname==='gibs.earthdata.nasa.gov'&&u.pathname.startsWith('/legends/'))return route.fulfill({headers:cors,contentType:'image/png',body:base});
  if(u.hostname==='api.open-meteo.com')return route.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(forecast)});
  if(u.hostname==='api.rainviewer.com'){metadataCalls++;if(mode==='hold'&&metadataCalls===1)await new Promise(r=>releaseFirst=r);try{return await route.fulfill({status:mode==='fail'?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(mode==='empty'?{...metadata,radar:{past:[]}}:metadata)});}catch{return;}}
  if(u.hostname==='tilecache.rainviewer.com'){assert.match(u.pathname,/^\/v2\/radar\/[A-Za-z0-9_-]{1,64}\/256\/[0-7]\/\d{1,3}\/\d{1,3}\/2\/1_1\.png$/);tiles.push(u.pathname);return route.fulfill({headers:cors,contentType:'image/png',body:rain});}
  unexpected.push(u.hostname+u.pathname);return route.abort();
 });
 await page.goto(origin+prefix+'phone-brazil.html');await page.waitForFunction(()=>window.__map?.isStyleLoaded()&&document.querySelector('#headline').textContent.includes('22'));
 await page.locator('#radar-toggle').click();await page.waitForFunction(()=>document.querySelector('[data-radar=status]').textContent.includes('Consultando'));
 mode='ok';await page.evaluate(()=>{MonitorMap.pause();MonitorMap.resume();});releaseFirst?.();await page.waitForFunction(()=>!document.querySelector('[data-radar=play]').disabled&&window.__map.getSource('br-historical-radar')&&window.__map.isSourceLoaded('br-historical-radar'));
 assert.equal(metadataCalls,2,'resume must retry interrupted request, not wait ten minutes');assert(tiles.length>0);assert.equal(await page.locator('#overlay-panel .brazil-satellite-control').isVisible(),false);assert.match(await page.locator('.frame-badge>span').innerText(),/RADAR/);
 const before=await page.evaluate(()=>__map.getSource('br-historical-radar').tiles[0]);await page.locator('[data-radar=play]').click();await page.waitForFunction(previous=>__map.getSource('br-historical-radar').tiles[0]!==previous,before);assert.match(await page.locator('[data-radar=play]').innerText(),/Pausar/);
 await page.evaluate(()=>MonitorMap.pause());const callsAtPause=metadataCalls;await page.waitForTimeout(300);assert.equal(metadataCalls,callsAtPause);await page.evaluate(()=>MonitorMap.resume());await page.waitForFunction(()=>__map.getSource('br-historical-radar')&&__map.isSourceLoaded('br-historical-radar'));assert.equal(metadataCalls,callsAtPause,'valid cache survives pause');
 await page.screenshot({path:path.join(output,'radar-packaged-fixture.png'),fullPage:true});
 mode='fail';await page.evaluate(()=>window.__radarOffset+=6000);await page.locator('[data-radar=refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-radar=status]').textContent.includes('Falha na atualização'));assert.equal(await page.locator('[data-radar=play]').isDisabled(),false);
 mode='ok';await page.evaluate(()=>window.__radarOffset+=6000);await page.locator('[data-radar=refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-radar=status]').textContent.includes('Quadro de radar'));assert.equal(await page.locator('[data-radar=play]').isDisabled(),false);
 await page.locator('#radar-toggle').click();assert.equal(await page.locator('#overlay-panel').isVisible(),false);assert.match(await page.locator('.frame-badge>span').innerText(),/PREVISÃO/);
 const live={attempted:process.argv.includes('--live-proof')};if(live.attempted){const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{signal:AbortSignal.timeout(12000)});assert(r.ok,'live metadata unavailable');const data=await r.json();const frames=await page.evaluate(d=>PhoneBrazilRadar.parseMetadata(d,Date.now()),data);assert(frames.length>0,'packaged parser must accept current real metadata');const frame=frames.at(-1),url=await page.evaluate(f=>PhoneBrazilRadar.tileUrl(f).replace('{z}','5').replace('{x}','11').replace('{y}','18'),frame),tile=await fetch(url,{signal:AbortSignal.timeout(12000)});assert(tile.ok,'real Sao Paulo tile unavailable');const bytes=Buffer.from(await tile.arrayBuffer());assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'provider must return PNG');Object.assign(live,{passed:true,frames:frames.length,frameTime:frame.time,provider:'RainViewer',tileBytes:bytes.length,coverage:'PNG receipt does not assert local coverage or rain'});}
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);const report={passed:true,renderer:'Chromium WebGL2 with packaged APK assets',metadataCalls,radarTileCalls:tiles.length,opaqueFrameIds:true,abortResume:true,manualRecovery:true,separateObservedTimestamp:true,live};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();browser=null;
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));

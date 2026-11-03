#!/usr/bin/env node
/* Real Chromium/WebGL startup check. All assets come from the APK; tiles stay offline. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('@playwright/test');
const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);if(i<0)return null;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(name+' exige um valor');return args[i+1];}
const apk=option('--apk'),assetRoot=option('--asset-root');
if(Boolean(apk)===Boolean(assetRoot))throw new Error('Use --apk arquivo.apk OU --asset-root pasta/contendo/phone-map.html');
const output=path.resolve(option('--output-dir')||path.join(__dirname,'../app/build/reports/map-browser'));
fs.mkdirSync(output,{recursive:true});
function tilePng(){
 const width=256,height=256,raw=Buffer.alloc(height*(1+width*4));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(1+width*4)+1+x*4,shade=((x>>5)+(y>>5))%2;raw[i]=20+shade*14;raw[i+1]=55+shade*14;raw[i+2]=80+shade*14;raw[i+3]=255;}
 function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
 function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,checksum]);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
let temporary=null,browser=null;
(async()=>{
 let assets;
 if(apk){temporary=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-map-apk-'));execFileSync('python3',['-c',`import pathlib,sys,zipfile
destination=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(sys.argv[1]) as archive:
 for entry in archive.infolist():
  p=pathlib.PurePosixPath(entry.filename)
  if not p.parts or p.parts[0]!='assets' or '..' in p.parts or entry.is_dir(): continue
  target=destination.joinpath(*p.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(entry))
`,path.resolve(apk),temporary]);assets=path.join(temporary,'assets');}else assets=path.resolve(assetRoot);
 for(const file of ['phone-map.html','phone-map.js','phone-map.css','vendor/maplibre-gl.js','vendor/maplibre-gl.css'])assert.ok(fs.existsSync(path.join(assets,file)),'asset real do APK: '+file);
 const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;else launch.channel='chrome';
 browser=await chromium.launch(launch);
 const page=await browser.newPage({viewport:{width:412,height:740},deviceScaleFactor:2});
 const errors=[],unexpected=[],workers=[];let tiles=0;const png=tilePng();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('worker',worker=>workers.push(worker.url()));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin==='https://appassets.androidplatform.net'&&u.pathname==='/favicon.ico')return route.fulfill({status:204});
  if(u.origin==='https://appassets.androidplatform.net'&&u.pathname.startsWith('/assets/')){
   const file=path.resolve(assets,decodeURIComponent(u.pathname.slice(8)));
   if(!file.startsWith(assets+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){unexpected.push(u.pathname);return route.fulfill({status:404,body:'Recurso ausente no APK'});}
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
   return route.fulfill({status:200,contentType:mime,body:fs.readFileSync(file)});
  }
  if(u.origin==='https://server.arcgisonline.com'&&u.pathname.startsWith('/ArcGIS/rest/services/World_Imagery/MapServer/tile/')){tiles++;return route.fulfill({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:png});}
  unexpected.push(u.href);return route.abort();
 });
 try{
  await page.goto('https://appassets.androidplatform.net/assets/phone-map.html');
  await page.waitForFunction(()=>window.MonitorMap&&document.querySelector('.maplibregl-canvas')&&document.querySelectorAll('.maplibregl-ctrl-group').length>0&&document.getElementById('notice').hidden,null,{timeout:20000});
  const state=await page.evaluate(()=>{const canvas=document.querySelector('.maplibregl-canvas');return {canvasWidth:canvas.width,canvasHeight:canvas.height,webgl2:!!canvas.getContext('webgl2'),version:maplibregl.getVersion(),controls:document.querySelectorAll('.maplibregl-ctrl-group').length,attribution:document.querySelector('.maplibregl-ctrl-attrib').textContent};});
  assert.ok(state.canvasWidth>0&&state.canvasHeight>0);assert.ok(state.webgl2,'canvas possui contexto WebGL2 real');assert.ok(state.controls>0);assert.ok(tiles>0,'raster solicita e decodifica os tiles locais');assert.match(state.attribution,/Esri/);
  await page.evaluate(()=>{window.__mapSelected=null;window.__mapInjected=false;window.MonitorMapBridge={selectEvent(id){window.__mapSelected=id;}};window.MonitorMap.setEvents([{id:'map-test',kind:'earthquake',title:'M6,0 · Exemplo <img src=x onerror="window.__mapInjected=true">',longitude:85,latitude:27}]);});
  await page.locator('.marker').click();await page.getByRole('button',{name:'Ver detalhes',exact:true}).click();
  await page.waitForFunction(()=>window.__mapSelected==='map-test',null,{timeout:5000});assert.equal(await page.locator('.maplibregl-popup img').count(),0);assert.equal(await page.evaluate(()=>window.__mapInjected),false);
  await page.screenshot({path:path.join(output,'map-ready.png')});
  assert.deepEqual(unexpected,[],'nenhuma rede fora dos recursos controlados');assert.deepEqual(errors,[],'sem erros JavaScript, CSP ou worker');
  const report={passed:true,...state,tiles,workers:workers.length,tileMode:'fixture PNG local; sem acesso à rede externa'};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){await page.screenshot({path:path.join(output,'map-failure.png')}).catch(()=>{});const report={passed:false,errors,unexpected,tiles,workers,error:String(error)};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(JSON.stringify(report));throw error;}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(temporary)fs.rmSync(temporary,{recursive:true,force:true});});

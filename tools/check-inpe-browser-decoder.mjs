// Browser compatibility gate: same offline-bundled reader and worker intended for mobile.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'argos-cappi-browser-'));
let browser,server;
try{
 const bundle=join(dir,'worker.mjs');
 await build({entryPoints:['tools/inpe-cappi-browser-worker.mjs'],outfile:bundle,bundle:true,platform:'browser',format:'esm',target:'chrome100',minify:true,legalComments:'inline',logLevel:'warning'});
 const size=(await stat(bundle)).size;
 assert.ok(size>0&&size<12*1024*1024,'Browser bundle exceeds budget');
 const csp="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";
 const files=new Map([['/worker.mjs',[bundle,'text/javascript']],['/cappi3km.nc',['/tmp/argos-raw-cappi3km.nc','application/octet-stream']],['/cappi15l.nc',['/tmp/argos-raw-cappi15l.nc','application/octet-stream']]]);
 server=createServer(async(req,res)=>{
  try{
   res.setHeader('Content-Security-Policy',csp);
   res.setHeader('X-Content-Type-Options','nosniff');
   if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>CAPPI browser diagnostic</title>');return;}
   const f=files.get(req.url);
   if(!f){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',f[1]);res.end(await readFile(f[0]));
  }catch{res.writeHead(500).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);
 for(const [product,altitude] of [['cappi3km',3000],['cappi15l',3000],['cappi15l',16000]]){
  const actual=await page.evaluate(async({product,altitude})=>{
   const bytes=await (await fetch('/'+product+'.nc')).arrayBuffer();
   return await new Promise((resolve,reject)=>{
    const w=new Worker('/worker.mjs',{type:'module'});
    const timer=setTimeout(()=>{w.terminate();reject(Error('Decoder timeout'));},30000);
    const finish=(err,value)=>{clearTimeout(timer);w.terminate();if(err)reject(Error(err));else resolve(value);};
    w.onerror=e=>finish(e.message||'Browser worker failed');
    w.onmessage=({data})=>{if(data.error)finish(data.error);else finish(null,{lon:data.lon,lat:data.lat,values:data.values,coordinates:data.coordinates,rgbaLength:data.rgba.length});};
    w.postMessage({id:1,product,altitude,bytes},[bytes]);
   });
  },{product,altitude});
  const expected=JSON.parse(await readFile('/tmp/argos-grid-'+product+'-'+altitude+'.json','utf8'));
  assert.equal(actual.rgbaLength,1000000);
  assert.equal(actual.values.length,250000);
  for(const axis of ['lon','lat'])for(let i=0;i<500;i++)assert.ok(Math.abs(actual[axis][i]-expected[axis][i])<1e-5);
  for(let i=0;i<250000;i++){const a=actual.values[i],b=expected.values[i];if(b===null)assert.equal(a,null);else assert.ok(a!==null&&Math.abs(a-b)<1e-4,'Browser pixel mismatch '+i);}
  console.log(JSON.stringify({product,altitude,checkedPixels:250000,bundleBytes:size,worker:'browser passed'}));
 }
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(dir,{recursive:true,force:true});
}

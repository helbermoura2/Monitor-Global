// Test the same decoder under browser CSP, not only in Node.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'argos-goes-browser-'));
let browser,server;
try{
 const bundle=join(dir,'worker.mjs');
 await build({entryPoints:['tools/goes-water-vapor-browser-worker.mjs'],outfile:bundle,bundle:true,platform:'browser',format:'esm',target:'chrome100',minify:true,legalComments:'inline',logLevel:'warning'});
 const bundleBytes=(await stat(bundle)).size;
 assert(bundleBytes>1000000&&bundleBytes<12*1024*1024);
 const files=new Map([['/worker.mjs',[bundle,'text/javascript']],...['B08','B09','B10'].map(b=>['/'+b+'.nc',['/tmp/argos-goes-'+b+'.nc','application/octet-stream']])]);
 server=createServer(async(req,res)=>{
  try{
   res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'");
   res.setHeader('X-Content-Type-Options','nosniff');
   if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>GOES browser diagnostic</title>');return;}
   const f=files.get(req.url);if(!f){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',f[1]);res.end(await readFile(f[0]));
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);
 for(const band of ['B08','B09','B10']){
  const reference=JSON.parse(await readFile('/tmp/argos-goes-'+band+'.json','utf8'));
  const result=await page.evaluate(async({band,size})=>{
   const response=await fetch('/'+band+'.nc');if(!response.ok)throw Error('Fixture missing');
   const bytes=await response.arrayBuffer(),start=performance.now();
   return await new Promise((resolve,reject)=>{
    const worker=new Worker('/worker.mjs',{type:'module'});
    const timer=setTimeout(()=>{worker.terminate();reject(Error('GOES worker timeout'));},45000);
    function finish(err,data){clearTimeout(timer);worker.terminate();if(err)reject(Error(err));else resolve(data);}
    worker.onerror=e=>finish(e.message||'GOES worker error');
    worker.onmessage=({data})=>{
     if(data.error){finish(data.error);return;}
     if(!(data.celsius instanceof Float32Array&&data.quality instanceof Uint8Array&&data.rows instanceof Int32Array&&data.columns instanceof Int32Array)){finish('Invalid worker output');return;}
     finish(null,{celsius:Array.from(data.celsius,v=>Number.isNaN(v)?null:v),quality:Array.from(data.quality),rows:Array.from(data.rows),columns:Array.from(data.columns),cropPixels:data.cropPixels,elapsedMs:Math.round(performance.now()-start)});
    };
    worker.postMessage({id:1,band,size,bytes},[bytes]);
   });
  },{band,size:reference.size});
  assert.equal(result.celsius.length,reference.size**2);
  let valid=0,maxDelta=0;
  for(let i=0;i<reference.values.length;i++){
   assert.equal(result.rows[i],reference.rows[i],'row '+i);assert.equal(result.columns[i],reference.columns[i],'column '+i);
   assert.equal(result.quality[i],reference.quality[i],'quality '+i);
   if(reference.values[i]===null)assert.equal(result.celsius[i],null,'mask '+i);
   else{assert.notEqual(result.celsius[i],null);const delta=Math.abs(result.celsius[i]-reference.values[i]);assert(delta<.01,'temperature '+i);valid++;maxDelta=Math.max(maxDelta,delta);}
  }
  assert(valid>reference.values.length*.8);assert(result.cropPixels<=9000000);
  console.log(JSON.stringify({band,checked:reference.values.length,valid,maxDelta,cropPixels:result.cropPixels,bundleBytes,elapsedMs:result.elapsedMs,worker:'browser passed'}));
 }
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(dir,{recursive:true,force:true});
}

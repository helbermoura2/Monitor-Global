import {fileURLToPath} from 'node:url';
import {test} from 'node:test';import assert from 'node:assert/strict';import {classify,captureSeconds} from '../../tools/cloudflare-route-tail.mjs';
test('route diagnostics discard query tokens, headers, exception text, logs and arbitrary paths',()=>{
 const item={outcome:'exceededCpu',event:{request:{url:'https://example.com/population-exposure?token=secret&lat=1',headers:{Authorization:'secret'}}},exceptions:[{message:'private'}],logs:[{message:['private']}]};
 assert.deepEqual(classify(item),{route:'/population-exposure',outcome:'exceededCpu'});
 item.event.request.url='https://example.com/private-token';assert.deepEqual(classify(item),{route:'other',outcome:'exceededCpu'});
});

test('CLI exits after deleting its session even if a websocket retains an idle handle',async()=>{
 const {spawnSync}=await import('node:child_process'),{mkdtemp,rm,readFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'monitor-tail-')),script=new URL('../../tools/cloudflare-route-tail.mjs',import.meta.url).pathname;
 const code=`process.env.CLOUDFLARE_API_TOKEN='fake-private-token';process.env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);const timer=setTimeout;globalThis.setTimeout=(fn,ms,...rest)=>timer(fn,ms===120000?5:ms,...rest);globalThis.fetch=async(u,init)=>Response.json({success:true,result:init.method==='POST'?{id:'b'.repeat(32),url:'wss://example.test/session'}:null});globalThis.WebSocket=class{constructor(){setInterval(()=>{},10000);}addEventListener(){}close(){}};process.argv[1]=${JSON.stringify(script)};await import(${JSON.stringify('file://'+script)});`;
 // Retain the offline preload when the child changes its working directory.
 const guard=fileURLToPath(new URL('../../tools/test-network-guard.cjs',import.meta.url));
 const env={...process.env,NODE_OPTIONS:(process.env.NODE_OPTIONS||'').replace('./tools/test-network-guard.cjs',JSON.stringify(guard))};
 try{const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,env,encoding:'utf8',timeout:3000});assert.equal(result.status,0,result.stderr);assert(!result.stdout.includes('fake-private-token'));const report=JSON.parse(await readFile(join(dir,'audit-results/route-tail.json'),'utf8'));assert.equal(report.sessionRemoved,true);assert.equal(report.events,0);}finally{await rm(dir,{recursive:true,force:true});}
});

test('capture duration is bounded even for malformed workflow inputs',()=>{assert.equal(captureSeconds('999999'),300);assert.equal(captureSeconds('-1'),30);assert.equal(captureSeconds('invalid'),120);assert.equal(captureSeconds(undefined),120);});

test('new TV meteorological routes remain attributable without preserving the point or query',()=>{
 for(const route of ['/tv-rain','/tv-weather'])assert.deepEqual(classify({outcome:'exceededResources',event:{request:{url:'https://example.com'+route+'?area=liberdade&secret=discard'}}}),{route,outcome:'exceededResources'});
});

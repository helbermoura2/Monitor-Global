const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),http=require('node:http');
const {local}=require('../../tools/test-network-guard.cjs'),{createProxy}=require('../../tools/test-offline-proxy.cjs');
test('only loopback fixture URLs are allowed',()=>{
 for(const url of ['http://127.0.0.1:4173/','http://localhost:4173/','http://[::1]:4173/'])assert.equal(local(url),true);
 for(const url of ['https://black-sky-9ba0.terrestre.workers.dev/','https://api.telegram.org/','https://monitorglobal.top/','http://localhost.evil.test/','https://localhost@evil.test/','file:///etc/passwd'])assert.equal(local(url),false);
});
test('Node preloader blocks real fetch and HTTP transports without reaching network',()=>{
 const result=spawnSync(process.execPath,['--require','./tools/test-network-guard.cjs','-e',`(async()=>{const assert=require('node:assert/strict');await assert.rejects(fetch('https://black-sky-9ba0.terrestre.workers.dev/'),{code:'TEST_NETWORK_BLOCKED'});for(const p of ['node:http','node:https'])assert.throws(()=>require(p).get(p.endsWith('https')?'https://api.telegram.org/':'http://api.telegram.org/'),{code:'TEST_NETWORK_BLOCKED'});})().catch(e=>{console.error(e);process.exitCode=1})`],{env:{...process.env,MONITOR_TEST_OFFLINE:'1'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('browser proxy refuses HTTP and HTTPS tunnels instead of forwarding requests',async()=>{
 const server=createProxy();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const status=await new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:'http://black-sky-9ba0.terrestre.workers.dev/'},res=>{res.resume();resolve(res.statusCode)}).on('error',reject));assert.equal(status,403);
  const tunnel=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,method:'CONNECT',path:'black-sky-9ba0.terrestre.workers.dev:443'});req.on('connect',(res,socket)=>{socket.destroy();resolve(res.statusCode)});req.on('error',reject);req.end()});assert.equal(tunnel,403);
 }finally{await new Promise(r=>server.close(r));}
});

// A deny-only proxy: browser requests fulfilled by Playwright mocks never get
// here. Every unmatched external request is rejected without an upstream socket.
'use strict';
const http=require('node:http');
function createProxy(){
 const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('offline test proxy');return;}
  res.writeHead(403,{'Content-Type':'text/plain'});res.end('TEST_NETWORK_BLOCKED: local fixtures only');
 });
 server.on('connect',(_req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
 server.on('upgrade',(_req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
 return server;
}
if(require.main===module)createProxy().listen(4174,'127.0.0.1');
module.exports={createProxy};

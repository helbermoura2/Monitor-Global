// Test processes may reach loopback fixtures only. Never forward to production.
'use strict';
const http=require('node:http'),https=require('node:https');
function local(input){
 try{const u=input instanceof URL?input:new URL(typeof input==='string'?input:input.url);return ['http:','https:','ws:','wss:'].includes(u.protocol)&&['127.0.0.1','localhost','[::1]'].includes(u.hostname);}catch{return false;}
}
function denied(){const e=new Error('TEST_NETWORK_BLOCKED: use a local fixture instead of a real service');e.code='TEST_NETWORK_BLOCKED';return e;}
function install(){
 const fetch=globalThis.fetch;if(fetch)globalThis.fetch=function(input,...args){return local(input)?fetch.call(this,input,...args):Promise.reject(denied());};
 for(const [transport,protocol] of [[http,'http:'],[https,'https:']]){
  const request=transport.request;
  transport.request=function(input,...args){
   const url=typeof input==='string'||input instanceof URL?input:protocol+'//'+(input.hostname||input.host||'localhost')+(input.port?':'+input.port:'')+(input.path||'/');
   if(!local(url))throw denied();return request.call(this,input,...args);
  };
  transport.get=function(...args){const req=transport.request(...args);req.end();return req;};
 }
}
if(process.env.MONITOR_TEST_OFFLINE==='1')install();
module.exports={local,install};

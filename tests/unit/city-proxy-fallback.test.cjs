const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/cidades-proximas.js','utf8');
const body=source.slice(source.indexOf('async function fetchJsonComFallbackCidade'),source.indexOf('async function getCidadesPhoton'));
test('city fallbacks skip forbidden Worker hosts and retain authorized fallback',async()=>{
 const calls=[];
 const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,WORKER_PROXY:u=>'https://worker.invalid/?url='+encodeURIComponent(u),fetch:async u=>{calls.push(u);return {ok:u.startsWith('https://worker.invalid'),json:async()=>({elements:[]})};}});
 vm.runInContext(body,ctx);
 for(const host of ['photon.komoot.io','overpass.kumi.systems','overpass.openstreetmap.ru']){
  calls.length=0;assert.equal(await ctx.fetchJsonComFallbackCidade('https://'+host+'/test'),null);assert.equal(calls.length,1);
 }
 calls.length=0;assert.ok(await ctx.fetchJsonComFallbackCidade('https://overpass-api.de/api/interpreter'));assert.equal(calls.length,2);
});

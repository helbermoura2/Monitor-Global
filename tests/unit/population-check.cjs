const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../js/populacao-sismo.js'),'utf8');
function context(fetch,extra={}){
 const c={fetch,AbortController,setTimeout,clearTimeout,Date,console,window:{},raioEstimado:()=>20,raioCritico:()=>8,raioDetectavel:()=>37,
 haversine:(lat,lng,a,b)=>Math.hypot(a-lat,b-lng)*111,formatarPopulacao:n=>n.toLocaleString('pt-BR'),...extra};vm.createContext(c);vm.runInContext(source,c);return c;
}
// Fixture sintética: cidade perto, cidade fora do raio sentido e localidade no epicentro.
const fixture=[{name:'Tirúa (fixture)',id:'1',lat:'-38.05',lon:'-73.5',pop:'1000'},{name:'Fora',id:'2',lat:'-38.3',lon:'-73.5',pop:'50000'},{name:'Epicentro',id:'3',lat:'-38',lon:'-73.5',pop:'500'}];
(async()=>{
 let requests=0;const c=context(async()=>{requests++;return{ok:true,json:async()=>fixture}});
 const [a,b]=await Promise.all([c.estimarPessoasAfetadas(-38,-73.5,3.3,0),c.estimarPessoasAfetadas(-38,-73.5,3.3,0)]);
 assert.equal(requests,1);assert.equal(a.totalPessoas,1500);assert.equal(a.cidades.length,2);assert.equal(a.cidades[0].distancia,0);assert.equal(a.status,'available');assert(!a.cidades.some(x=>/V-VI/.test(x.mmi.nivel)));
 assert(!c.renderAlcancePopulacaoHTML(a).includes('pessoas podem ter sentido'));
 await c.estimarPessoasAfetadas(-38,-73.5,3.4,0);assert.equal(requests,1);
 let mirrorCalls=0;const mirror=context(async()=>{mirrorCalls++;return mirrorCalls===1?{ok:false,status:503}:{ok:true,json:async()=>fixture}});assert.equal((await mirror.estimarPessoasAfetadas(-38,-73.5,3.3,0)).totalPessoas,1500);assert.equal(mirrorCalls,2);
 let fails=0;const fallback=context(async()=>{fails++;throw Error('offline')},{fetchJsonComFallbackCidade:async()=>({elements:[{id:1,lat:-38.05,lon:-73.5,tags:{place:'village',name:'Vila',population:'1,234'}}]}),resolverCidadesProximas:async()=>({reserva:false,cidades:[{nome:'Vila',lat:-38.05,lng:-73.5,pop:1234},{nome:'Sem população',lat:-38.02,lng:-73.5,pop:0}]})});
 const f=await fallback.estimarPessoasAfetadas(-38,-73.5,3.3,0);assert.equal(f.totalPessoas,1234);assert.equal(f.localidades,2);assert.equal(f.partial,true);assert.equal(f.missingPopulation,1);assert.equal(fails,2);
 const unavailable=context(async()=>{throw Error('offline')});const u=await unavailable.estimarPessoasAfetadas(-38,-73.5,3.3,0);assert.equal(u.status,'unavailable');assert.equal(u.totalPessoas,null);assert(c.mensagemCoberturaPopulacao(u).includes('não significa'));
 const empty=context(async()=>({ok:true,json:async()=>[{name:'Longe',lat:0,lon:0,pop:10}]}));assert.equal((await empty.estimarPessoasAfetadas(-38,-73.5,3.3,0)).status,'no-settlements');
 const missing=context(async()=>{throw Error('offline')},{resolverCidadesProximas:async()=>({cidades:[{nome:'Tirúa',lat:-38.05,lng:-73.5,pop:0}]})});const m=await missing.estimarPessoasAfetadas(-38,-73.5,3.3,0);assert.equal(m.status,'population-missing');assert.equal(m.cidades.length,1);assert.equal(m.totalPessoas,null);
 for(const value of ['','unknown','0','123.5',null])assert.equal(c.numeroPopulacao(value),null);assert.equal(c.numeroPopulacao('12 345'),12345);
 assert.equal(c.normalizarLugarPop({name:'Invalid',lat:null,lon:null,pop:1000}),null);
 // Uma falha é temporária: após cooldown, o catálogo volta a ser consultado.
 let now=0,online=false,count=0;class Clock extends Date{static now(){return now;}}
 const retry=context(async()=>{count++;if(!online)throw Error('offline');return{ok:true,json:async()=>fixture}},{Date:Clock});assert.equal(await retry.fetchLugaresPopulosos(),null);assert.equal(count,2);online=true;now=61000;assert.equal((await retry.fetchLugaresPopulosos()).length,3);assert.equal(count,3);
 console.log('PASS: Chile fixture, epicenter, felt radius, HTTP/mirror failures, deduplication, partial/missing data, retries, revision cache and safe labels');
})().catch(e=>{console.error(e);process.exitCode=1});

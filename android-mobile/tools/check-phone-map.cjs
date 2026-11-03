#!/usr/bin/env node
/* Startup regression against the real MapLibre API bundled in the source or APK. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const mobile=path.resolve(__dirname,'..'),repo=path.dirname(mobile),option=process.argv.indexOf('--asset-root');
if(option>=0&&!process.argv[option+1])throw new Error('--asset-root exige uma pasta');
const assets=option>=0?path.resolve(process.argv[option+1]):path.join(mobile,'app/src/main/assets');
const vendor=option>=0?path.join(assets,'vendor/maplibre-gl.js'):path.join(repo,'vendor/maplibre-gl.js');
const real=require(vendor),script=fs.readFileSync(path.join(assets,'phone-map.js'),'utf8'),html=fs.readFileSync(path.join(assets,'phone-map.html'),'utf8');
assert.equal(typeof real.Map,'function','o APK precisa incluir o construtor real do MapLibre');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 const name=match[1];if(name.includes(':')||name.startsWith('#'))continue;
 const file=option<0&&name.startsWith('vendor/')?path.join(repo,name):path.join(assets,name);
 assert.ok(fs.existsSync(file),'recurso local incluído: '+name);
}
function start(api){
 const nodes={};
 function element(id){return nodes[id]||(nodes[id]={hidden:false,textContent:'',handlers:{},addEventListener(name,callback){this.handlers[name]=callback;}});}
 const window={maplibregl:api,devicePixelRatio:2,addEventListener(){}};
 const context={window,maplibregl:api,document:{getElementById:element},console,Number,Math};
 vm.createContext(context);vm.runInContext(script,context,{filename:'phone-map.js'});
 return {nodes,window};
}
// A bitmap-less VM cannot create WebGL; the startup must reach Map and expose its error.
// Spreading the actual exports intentionally does not fabricate the removed supported() API.
let attempts=0;
const unavailable={...real,Map:new Proxy(real.Map,{construct(){attempts++;throw new Error('WebGL indisponível no ensaio');}})};
const failure=start(unavailable);
assert.equal(attempts,1,'inicialização chega ao construtor do MapLibre real');
assert.equal(failure.nodes.notice.hidden,false);assert.equal(failure.nodes.retry.hidden,false);
assert.match(failure.nodes.notice.textContent,/Não foi possível abrir o mapa/);
assert.notEqual(failure.nodes.notice.textContent,'Carregando mapa…');
failure.nodes.retry.handlers.click();assert.equal(attempts,2,'nova tentativa exige toque explícito');
const missing=start(undefined);assert.equal(missing.nodes.retry.hidden,false);assert.match(missing.nodes.notice.textContent,/recursos do mapa/);
console.log('Mapa móvel: assets incluídos, API MapLibre real e falhas de inicialização verificadas ('+(typeof real.getVersion==='function'?real.getVersion():'versão não informada')+').');

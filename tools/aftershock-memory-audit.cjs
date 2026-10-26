// Whole sequence controller, offline catalogue turnover, Node heap after GC.
// No DOM/map, production feeds, alerts or Telegram. Not a phone/GPU benchmark.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
if(!global.gc)throw Error('Run with node --expose-gc');
const path=process.argv.find(a=>a.startsWith('--source='))?.slice(9)||'js/aftershock-sequence.js',source=fs.readFileSync(path,'utf8');
const rounds=240,size=200,listeners={},c={globalEvents:[],AftershockModel:require('../js/aftershock-model.js'),Date,Math,Map,Set,performance,clearTimeout,setTimeout,cancelAnimationFrame:()=>{},document:{hidden:false,getElementById:()=>null,addEventListener:()=>{}},addEventListener:(name,fn)=>listeners[name]=fn};c.window=c;
vm.createContext(c);vm.runInContext(source.replace(/\}\)\(\);\s*$/,'window.__sequenceAudit=()=>({known:known.size,fresh:fresh.size});})();'),c);
const samples=[];function sample(round){global.gc();samples.push({round,heapBytes:process.memoryUsage().heapUsed,...c.__sequenceAudit()});}
sample(0);const time=Date.now()-1000;
for(let round=1;round<=rounds;round++){c.globalEvents=Array.from({length:size},(_,i)=>({id:'catalogue-'+round+'-'+i,type:'earthquake',mag:2.5,depth:10,time,coords:[0,0]}));c.AftershockSequence.refresh();if(round%40===0)sample(round);}
listeners.pagehide();sample('pagehide');
console.log(JSON.stringify({method:'240 local catalogue replacements, 200 distinct IDs per replacement; same recent origins; main Node JS heap after explicit GC; no browser, phone or GPU measurement',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),samples},null,2));

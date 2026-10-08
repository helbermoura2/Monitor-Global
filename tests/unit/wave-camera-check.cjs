const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../js/sismo-metrics.js'),'utf8');
function simulate(mag,maxRadius,startZoom){
let now=0,zoom=startZoom,queue=[],abortHandler;const frames=[];
const c={Date:{now:()=>now},performance:{now:()=>now},document:{createElement:()=>({style:{},setAttribute(){},remove(){}}),getElementById:()=>({append(){},getBoundingClientRect:()=>({top:0,bottom:0})})},window:{matchMedia:()=>({matches:false}),GlobalQuakeTravel:{status:()=>'ready',load:()=>Promise.resolve(),EARTH_RADIUS:6379,radius:(phase,depth,t)=>t*7.5<=maxRadius?t*7.5:null}},map:{getSource:()=>({setData(){}}),getLayer:()=>true,setPaintProperty(){},getZoom:()=>zoom,jumpTo:x=>{zoom=x.zoom;frames.push(zoom)},on:(name,f)=>{if(name==='wheel')abortHandler=f}},stopWaveFront(){},anelGeodesico:()=>[],centroCompensado:()=>[0,0],raioCritico:()=>8,zoomParaCaberRaio:(lng,lat,r)=>8-Math.log2(r/100),WAVE_PHASES:['p','s','pkp','pkikp'],WAVE_LAYER_IDS:[],waveFrontGeneration:0,waveFrontStatus:null,waveFrontContext:null,waveFrontAtivo:false,waveCamRAF:null,waveCamAbortHandler:null,waveFrontPlaceHandler:null,waveFrontInterval:null,setInterval:()=>1,requestAnimationFrame:f=>{queue.push(f);return queue.length}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function startWaveFront('),source.indexOf('/* ═══════════ RÓTULOS')),c);
c.startWaveFront(0,0,mag,15,0,{chaseCam:true,zoomFinalMinimo:6.6});
const samples={};for(let t=0;t<=300000;t+=16){now=t;const batch=queue;queue=[];batch.forEach(f=>f(t));if(t===40000||t===80000)samples[t]=zoom;}
assert(Math.abs(zoom-(8-Math.log2(maxRadius/100)))<.01);assert(frames.every((z,i)=>!i||z<=frames[i-1]+1e-9));
c.startWaveFront(0,0,mag,15,now,{chaseCam:true});abortHandler({originalEvent:{}});const n=frames.length;now+=16;queue.splice(0).forEach(f=>f(now));assert.equal(frames.length,n);return{zoom,samples};
}
const small=simulate(.9,16.5,11.4);assert(small.zoom>10);const large=simulate(5.6,1730,8);assert(large.samples[80000]<large.samples[40000]-.5);
console.log('PASS: camera follows model radii, stops expanding at final arrivals, opens smoothly, and yields to manual interaction');

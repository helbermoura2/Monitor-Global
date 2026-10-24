import '../js/event-portuguese.js';import '../js/tsunami-link.js';import '../js/tsunami-regional-model.js';
import {getOfficialTsunamis} from '../tsunami-official-worker.mjs';
const MAX_AGE=6*3600000,VERSION='tv-alerts-v1';let last,inflight;
const clean=s=>String(s||'').slice(0,700),hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function tvSnapshot(quakes,tsunamis,now=Date.now()){
 const alerts=[];
 for(const f of quakes.features||[]){const p=f.properties||{},c=f.geometry?.coordinates||[],mag=p.mag,time=p.time;if(typeof mag!=='number'||!Number.isFinite(mag)||mag<5.5||mag>10||p.type&&p.type!=='earthquake'||!Number.isFinite(time)||time>now+300000||now-time>MAX_AGE||!f.id)continue;
  const depth=typeof c[2]==='number'&&Number.isFinite(c[2])&&c[2]>=0?c[2]:null,place=EventPortuguese.place(clean(p.place||'Local não informado'));
  alerts.push({kind:'earthquake',id:'USGS:'+clean(f.id),version:JSON.stringify([mag,depth]),issuedAt:Number.isFinite(p.updated)?p.updated:time,eventTime:time,eligible:mag>=6,magnitude:mag,title:'M'+EventPortuguese.number(mag,1)+' · '+place,detail:(depth===null?'Profundidade não informada':'Profundidade: '+EventPortuguese.number(depth,0)+' km')+' · USGS',source:'USGS',state:'earthquake'});
 }
 for(const a of TsunamiLink.latest(tsunamis.items||[],now)){const rows=TsunamiRegional.rows(a),groups=TsunamiRegional.summarize(rows),primary=groups[0];if(!primary)continue;
  const product=a.feedKey||a.source,event=a.officialEventId||(Number.isFinite(a.originTime)?a.originTime+':'+(a.coords||[]).map(n=>Math.round(n*10)/10).join(','):a.id),state=primary.state;
  alerts.push({kind:'tsunami',id:'TS:'+product+':'+event,version:JSON.stringify([a.time,state,rows.map(r=>[r.region,r.state,r.category])]),issuedAt:a.time,eventTime:a.originTime||a.time,eligible:rows.some(r=>r.active)&&tsunamis.ok===true,source:clean(a.source),state,title:(state==='ended'?'Aviso encerrado · ':state==='noThreat'?'Sem ameaça segundo o boletim · ':'Tsunami · ')+primary.regions.join(' · '),detail:clean(primary.label+' · '+a.source+' · Apenas para as costas citadas'),regions:primary.regions});
 }
 return {version:VERSION,serverTime:now,sources:{earthquake:quakes.ok!==false,tsunami:tsunamis.ok===true},alerts:alerts.sort((a,b)=>b.issuedAt-a.issuedAt).slice(0,120)};
}
async function collect(){const now=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const [q,t]=await Promise.allSettled([fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5.5&limit=100&orderby=time&starttime='+encodeURIComponent(new Date(now-MAX_AGE).toISOString()),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('USGS');const data=await r.json();if(!Array.isArray(data.features))throw Error('Catalog');return data;}),getOfficialTsunamis()]);return tvSnapshot(q.status==='fulfilled'?q.value:{ok:false,features:[]},t.status==='fulfilled'?t.value:{ok:false,items:[]},now);}finally{clearTimeout(timer);}}
export async function handleTvAlerts(request,{read=collect,now=Date.now(),cache=globalThis.caches?.default}={}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag','Content-Type':'application/json','Cache-Control':'public, max-age=20','X-Monitor-TV':VERSION};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-alerts-v1');let snapshot;
 try{const hit=await cache?.match(key);if(hit)snapshot=await hit.json();}catch{}
 if(!snapshot||now-snapshot.serverTime>30000){if(last&&now-last.serverTime<30000)snapshot=last;else{if(!inflight)inflight=read().finally(()=>inflight=null);snapshot=await inflight;last=snapshot;try{await cache?.put(key,new Response(JSON.stringify(snapshot),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=25'}}));}catch{}}}
 const etag='"'+await hash(JSON.stringify([snapshot.sources,snapshot.alerts]))+'"';headers.ETag=etag;
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});
}

import '../js/tsunami-link.js';
import '../js/tsunami-regional-model.js';
import '../js/tsunami-map-model.js';
const T=globalThis.TsunamiLink,R=globalThis.TsunamiRegional,M=globalThis.TsunamiMapModel;
export const TSUNAMI_CARD_VERSION='tsunami-coastal-v1';
export function related(a,b){if(a.officialEventId&&b.officialEventId&&a.officialEventId!==b.officialEventId&&(a.officialEventId.split(':')[0]===b.officialEventId.split(':')[0]||a.source===b.source))return false;return T.sameEvent(a,b)||T.origin(a)&&T.origin(b)&&Number.isFinite(a.originTime)&&Number.isFinite(b.originTime)&&Math.abs(a.originTime-b.originTime)<=120000&&T.distance(a.coords,b.coords)<=100;}
export function compactBulletin(a){const out={};for(const k of ['id','source','feedKey','time','coords','coordinateRole','originTime','originMag','originDepth','officialEventId','hazardNature','warningLevel','cancelled','official','expiresAt','bulletinNr'])if(a[k]!==undefined)out[k]=a[k];for(const k of ['place','detail','description','link','bulletinUrl'])if(a[k])out[k]=String(a[k]).slice(0,k==='detail'||k==='description'?2400:700);for(const k of ['affectedAreas','coverageAreas'])if(Array.isArray(a[k]))out[k]=a[k].slice(0,80).map(x=>typeof x==='string'?{name:x.slice(0,120)}:Object.fromEntries(Object.entries(x).filter(([key])=>['name','category','radiusKm','scopeNote'].includes(key)).map(([key,value])=>[key,typeof value==='string'?value.slice(0,key==='scopeNote'?240:160):value])));if(a.warningGeometry&&JSON.stringify(a.warningGeometry).length<60000)out.warningGeometry=a.warningGeometry;out.type='tsunami';return out;}
export function reconcile(previous,feed,now=Date.now()){
 const fresh=T.latest(feed?.items||[],now),latest=T.latest([...(previous||[]),...fresh],now),ids=new Set(fresh.map(a=>a.id));
 return latest.slice(0,12).map(a=>{if(a.cancelled&&!a.affectedAreas?.length&&!a.coverageAreas?.length){const old=(previous||[]).find(b=>(b.feedKey||b.source)===(a.feedKey||a.source)&&related(a,b));if(old)a={...a,affectedAreas:[...old.affectedAreas||[],...old.coverageAreas||[]].map(x=>({...typeof x==='string'?{name:x}:x,category:'Cancellation',scopeNote:'Último alcance informado pelo mesmo produto, agora encerrado.'}))};}return {...compactBulletin(a),_tsunamiStale:!ids.has(a.id)||feed?.ok!==true||!!feed.sources?.length&&!feed.sources.some(s=>s.ok&&(s.feedKey||s.source)===(a.feedKey||a.source))};});
}
export function bulletinModel(bulletins,history=[]){
 const rows=bulletins.flatMap(a=>R.rows(a)),groups=R.summarize(rows),primary=groups.find(g=>g.active&&!g.stale)||groups[0];
 const state=primary?.stale?'unknown':primary?.state||'unknown',title={warning:'Aviso: ondas perigosas possíveis',watch:'Vigilância de tsunami',advisory:'Atenção para tsunami',ended:'Aviso encerrado nas regiões citadas',noThreat:'Sem ameaça nas regiões citadas',information:'Boletim informativo',unknown:'Atualização indisponível; consulte a fonte'}[state];
 const host=bulletins.find(a=>a.id===primary?.rows[0]?.bulletinId)||bulletins[0];
 const label=primary?.regions.join(' · ')||'Regiões do boletim';
 const version=JSON.stringify([TSUNAMI_CARD_VERSION,bulletins.map(a=>[a.id,a.feedKey,a.time,a._tsunamiStale,a.cancelled,a.warningLevel,a.affectedAreas,a.coverageAreas,a.warningGeometry])]);
 return {bulletins,rows,groups,primary,state,title,label,host,history:history.slice(-2),version};
}
export function updateHistory(history,oldBulletins,bulletins){
 const updates=bulletins.filter(a=>!a._tsunamiStale&&!oldBulletins?.some(b=>b.id===a.id&&b.time>=a.time)).flatMap(a=>R.summarize(R.rows(a)).map(g=>({time:a.time,source:a.source,state:g.state,label:g.label,regions:g.regions.slice(0,8)})));
 return [...history||[],...updates].sort((a,b)=>a.time-b.time).filter((a,i,all)=>!all.slice(0,i).some(b=>JSON.stringify(a)===JSON.stringify(b))).slice(-2);
}
const lineStrings=g=>g?.type==='LineString'?[g.coordinates]:g?.type==='MultiLineString'?g.coordinates:g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
// Clip each coast segment to the distance explicitly stated by the authority.
function radiusClip(lines,origin,radius){if(!origin||!Number.isFinite(radius))return lines;const inside=p=>T.distance(origin,p)<=radius,result=[];
 for(const points of lines){let run=[];const flush=()=>{if(run.length>1)result.push(run);run=[];};for(let i=1;i<points.length;i++){const near=p=>[p[0]+360*Math.round((origin[0]-p[0])/360),p[1]],a=near(points[i-1]),b=near(points[i]),ia=inside(a),ib=inside(b);if(ia&&!run.length)run.push(a);if(ia!==ib){let lo=0,hi=1;for(let j=0;j<24;j++){const t=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(inside(p)===ia)lo=t;else hi=t;}const t=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];run.push(p);if(ia)flush();}if(ib)run.push(b);else flush();}flush();}return result;
}
export function coastalMap(model,regions){
 const lines=[],unmapped=[],chosen=model.primary?.rows||[];
 for(const row of chosen){const a=model.bulletins.find(a=>a.id===row.bulletinId),area=[...a?.affectedAreas||[],...a?.coverageAreas||[]].find(x=>x.name===row.region);
  const item={...a,hazardNature:row.active?'warning':'bulletin',cancelled:row.state==='ended',affectedAreas:row.scoped?[{name:row.region,category:row.state==='noThreat'?'No tsunami threat':row.category}]:[],coverageAreas:[]};
  const map=M.build(item,regions);unmapped.push(...map.unmapped);
  for(const f of map.data.features.filter(f=>f.properties.band==='shoreline'||f.properties.kind==='official'))for(const points of radiusClip(lineStrings(f.geometry),T.origin(a)?a.coords:null,area?.radiusKm))if(points.length>1)lines.push({points,color:row.stale?'#94a3b8':row.color,official:f.properties.kind==='official'});
 }
 const points=lines.flatMap(l=>l.points),origin=T.origin(model.host)?model.host.coords:null;
 if(origin)points.push(origin);
 if(!points.length)return {lines,unmapped,frame:null,origin};
 const [west,east]=M.longitudeBounds(points.map(p=>p[0])),center=(west+east)/2,ys=points.map(p=>p[1]),midY=(Math.min(...ys)+Math.max(...ys))/2;
 const half=Math.max(.35,(east-west)/2,(Math.max(...ys)-Math.min(...ys))*800/(2*430))*1.15,latSpan=half*430/800;
 const frame={width:800,height:430,minLon:center-half,maxLon:center+half,minLat:midY-latSpan,maxLat:midY+latSpan,zoom:Math.max(3,Math.min(10,Math.floor(Math.log2(180/half))))};
 return {lines,unmapped,frame,origin};
}
export function bulletinCaption(model){const plain=s=>String(s||'').replace(/[\*_`\[\]]/g,''),date=t=>new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' BRT';
 let text='🌊 Boletim regional de tsunami\n'+model.title+'\n';for(const g of model.groups.slice(0,4))text+='\n'+plain(g.regions.join(' · '))+'\n'+plain(g.label)+(g.stale?' · última informação; atualização indisponível':'')+'\n'+plain(g.source)+' · '+date(g.issuedAt)+'\n';
 text+='\nCada situação vale só para as costas citadas. As referências no mapa não representam inundação. Siga as autoridades locais.\n';const links=[...new Set(model.bulletins.map(a=>a.bulletinUrl||a.link).filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}}))];if(links[0])text+='\nBoletim oficial: '+links[0]+'\n';return text.slice(0,980)+'\nhttps://monitorglobal.top';
}

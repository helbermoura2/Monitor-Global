import '../js/event-portuguese.js';import '../js/tsunami-link.js';import '../js/tsunami-regional-model.js';
import {tvTargetArea,TV_TARGET_POLICY} from './tv-target-areas.mjs';
import {tvCoastalMap} from './tv-map.mjs';
const MAX_AGE=6*3600000,VERSION='tv-alerts-v1';
const quakeId=f=>f.tvId||(f.provider||'USGS')+':'+clean(f.id);
const clean=s=>String(s||'').slice(0,700);
export function tvSnapshot(quakes,tsunamis,now=Date.now(),{maxAge=MAX_AGE,minMagnitude=5}={}){
 const alerts=[];
 const quakeOrigins=(quakes.features||[]).map(f=>({id:quakeId(f),type:'earthquake',time:f.properties?.time,mag:f.properties?.mag,notifiable:f.tracked===true||f.brazil===true,coords:f.geometry?.coordinates}));
 const bulletins=TsunamiLink.latest(tsunamis.items||[],now);
 for(const f of quakes.features||[]){const p=f.properties||{},c=f.geometry?.coordinates||[],mag=p.mag,time=p.time;if(typeof mag!=='number'||!Number.isFinite(mag)||(!f.brazil&&!f.tracked&&mag<minMagnitude)||mag>10||p.type&&p.type!=='earthquake'||!Number.isFinite(time)||time>now+300000||now-time>maxAge||!f.id)continue;
  const depth=typeof c[2]==='number'&&Number.isFinite(c[2])&&c[2]>=0?c[2]:null,place=EventPortuguese.place(clean(p.place||'Local não informado'));
  const origin=quakeOrigins.find(q=>q.id===quakeId(f));
  const linked=tsunamis.ok===true?TsunamiLink.forQuake(origin,bulletins,quakeOrigins,now).filter(r=>r.kind==='origin'):[];
  const active=TsunamiRegional.summarize(linked.flatMap(r=>TsunamiRegional.rows(r.alert)).filter(r=>r.active&&!r.stale));
  const tsunamiSummary=clean(active.map(g=>g.label+' · '+g.regions.join(' / ')).join(' | '));
  alerts.push({kind:'earthquake',id:quakeId(f),version:JSON.stringify([mag,depth,c[0],c[1],time,p.net||f.provider||'USGS',p.status,p.place]),issuedAt:f.observedRevisionAt||(Number.isFinite(p.updated)?p.updated:time),eventTime:time,eligible:mag>=6||f.brazil===true,provider:f.provider||'USGS',catalog:f.globalMultiSource&&f.provider!=='USGS'?f.provider+'_GLOBAL':f.brazil&&(f.provider||'USGS')==='USGS'?'USGS_BR':f.provider||'USGS',aliases:f.aliases||[quakeId(f)],countryCode:f.brazil?'br':'',magnitude:mag,depth,targetArea:!f.brazil?tvTargetArea(c[0],c[1],mag,depth):'',...(Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90?{originLongitude:c[0],originLatitude:c[1],originTime:time}:{}),tsunamiSummary,title:'M'+EventPortuguese.number(mag,1)+' · '+place,detail:(depth===null?'Profundidade não informada':'Profundidade: '+EventPortuguese.number(depth,0)+' km')+' · '+clean(f.provider||'USGS'),source:clean(f.provider||'USGS'),state:'earthquake'});
 }
 for(const a of bulletins){const rows=TsunamiRegional.rows(a),groups=TsunamiRegional.summarize(rows),primary=groups[0];if(!primary)continue;
  const relation=TsunamiLink.match(a,quakeOrigins),relatedQuakeId=relation?.kind==='origin'?relation.quake.id:'';
  const product=a.feedKey||a.source,event=a.officialEventId||(Number.isFinite(a.originTime)?a.originTime+':'+(a.coords||[]).map(n=>Math.round(n*10)/10).join(','):a.id),state=primary.state;
  const noThreat=state==='noThreat'&&!rows.some(r=>r.stale)&&!!relatedQuakeId&&quakeOrigins.some(q=>q.id===relatedQuakeId&&(q.mag>=6||q.notifiable));
  alerts.push({kind:'tsunami',id:'TS:'+product+':'+event,version:JSON.stringify([relatedQuakeId,state,rows.map(r=>[r.region,r.state,r.category]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]),semanticVersion:TsunamiRegional.signature(a),issuedAt:a.time,eventTime:a.originTime||a.time,eligible:(rows.some(r=>r.active&&!r.stale)||noThreat)&&tsunamis.ok===true,source:clean(a.source),bulletinProduct:clean(product),officialEventId:clean(a.officialEventId),originTime:Number.isFinite(a.originTime)?a.originTime:0,...(TsunamiLink.origin(a)?{originLongitude:a.coords[0],originLatitude:a.coords[1]}:{}),relatedQuakeId,tsunamiSummary:clean(groups.map(g=>g.label+' · '+g.regions.join(' / ')).join(' | ')),state,title:(state==='ended'?'Aviso encerrado · ':state==='noThreat'?'Sem ameaça segundo o boletim · ':'Tsunami · ')+primary.regions.join(' · '),detail:clean(primary.label+' · '+a.source+' · Apenas para as costas citadas'),regions:primary.regions,map:tvCoastalMap(a)});
 }
 return {version:VERSION,targetPolicy:TV_TARGET_POLICY,tsunamiPolicy:'regional-lifecycle-v2',serverTime:now,sources:{earthquake:quakes.ok!==false,tsunami:tsunamis.ok===true,...(quakes.catalogs?{catalogs:quakes.catalogs}:{})},alerts:alerts.sort((a,b)=>b.issuedAt-a.issuedAt).slice(0,120)};
}

import '../js/event-portuguese.js';import '../js/tsunami-link.js';import '../js/tsunami-regional-model.js';
const MAX_AGE=6*3600000,VERSION='tv-alerts-v1';
const clean=s=>String(s||'').slice(0,700);
export function tvSnapshot(quakes,tsunamis,now=Date.now(),{maxAge=MAX_AGE,minMagnitude=5.5}={}){
 const alerts=[];
 const quakeOrigins=(quakes.features||[]).map(f=>({id:'USGS:'+clean(f.id),type:'earthquake',time:f.properties?.time,mag:f.properties?.mag,coords:f.geometry?.coordinates}));
 const bulletins=TsunamiLink.latest(tsunamis.items||[],now);
 for(const f of quakes.features||[]){const p=f.properties||{},c=f.geometry?.coordinates||[],mag=p.mag,time=p.time;if(typeof mag!=='number'||!Number.isFinite(mag)||mag<minMagnitude||mag>10||p.type&&p.type!=='earthquake'||!Number.isFinite(time)||time>now+300000||now-time>maxAge||!f.id)continue;
  const depth=typeof c[2]==='number'&&Number.isFinite(c[2])&&c[2]>=0?c[2]:null,place=EventPortuguese.place(clean(p.place||'Local não informado'));
  const origin=quakeOrigins.find(q=>q.id==='USGS:'+clean(f.id));
  const linked=tsunamis.ok===true?TsunamiLink.forQuake(origin,bulletins,quakeOrigins,now).filter(r=>r.kind==='origin'):[];
  const active=TsunamiRegional.summarize(linked.flatMap(r=>TsunamiRegional.rows(r.alert)).filter(r=>r.active&&!r.stale));
  const tsunamiSummary=clean(active.map(g=>g.label+' · '+g.regions.join(' / ')).join(' | '));
  alerts.push({kind:'earthquake',id:'USGS:'+clean(f.id),version:JSON.stringify([mag,depth]),issuedAt:Number.isFinite(p.updated)?p.updated:time,eventTime:time,eligible:mag>=6,magnitude:mag,depth,tsunamiSummary,title:'M'+EventPortuguese.number(mag,1)+' · '+place,detail:(depth===null?'Profundidade não informada':'Profundidade: '+EventPortuguese.number(depth,0)+' km')+' · USGS',source:'USGS',state:'earthquake'});
 }
 for(const a of bulletins){const rows=TsunamiRegional.rows(a),groups=TsunamiRegional.summarize(rows),primary=groups[0];if(!primary)continue;
  const relation=TsunamiLink.match(a,quakeOrigins),relatedQuakeId=relation?.kind==='origin'?relation.quake.id:'';
  const product=a.feedKey||a.source,event=a.officialEventId||(Number.isFinite(a.originTime)?a.originTime+':'+(a.coords||[]).map(n=>Math.round(n*10)/10).join(','):a.id),state=primary.state;
  const noThreat=state==='noThreat'&&!rows.some(r=>r.stale)&&!!relatedQuakeId&&quakeOrigins.some(q=>q.id===relatedQuakeId&&q.mag>=6);
  alerts.push({kind:'tsunami',id:'TS:'+product+':'+event,version:JSON.stringify([state==='noThreat'?relatedQuakeId:a.time,state,rows.map(r=>[r.region,r.state,r.category])]),issuedAt:a.time,eventTime:a.originTime||a.time,eligible:(rows.some(r=>r.active&&!r.stale)||noThreat)&&tsunamis.ok===true,source:clean(a.source),relatedQuakeId,tsunamiSummary:clean(groups.map(g=>g.label+' · '+g.regions.join(' / ')).join(' | ')),state,title:(state==='ended'?'Aviso encerrado · ':state==='noThreat'?'Sem ameaça segundo o boletim · ':'Tsunami · ')+primary.regions.join(' · '),detail:clean(primary.label+' · '+a.source+' · Apenas para as costas citadas'),regions:primary.regions});
 }
 return {version:VERSION,serverTime:now,sources:{earthquake:quakes.ok!==false,tsunami:tsunamis.ok===true},alerts:alerts.sort((a,b)=>b.issuedAt-a.issuedAt).slice(0,120)};
}

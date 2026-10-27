/* One regional interpretation for bulletins, map, effects and image exports. */
(function(root){'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const labels={warning:'Aviso oficial · ondas perigosas possíveis',watch:'Vigilância',advisory:'Atenção',ended:'Aviso encerrado',noThreat:'Sem ameaça segundo o boletim',information:'Informativo',unknown:'Situação não confirmada'};
const colors={warning:'#fb7148',watch:'#fbbf24',advisory:'#fbbf24',ended:'#94a3b8',noThreat:'#70c9b5',information:'#38bdf8',unknown:'#94a3b8'};
const rank={warning:6,watch:5,advisory:4,ended:3,noThreat:2,information:1,unknown:0};
const region=name=>({alaska:'Alasca',britishcolumbia:'Colúmbia Britânica',washington:'Washington',oregon:'Oregon',california:'Califórnia',hawaii:'Havaí'}[normalize(name)]||root.EventPortuguese?.place(name)||String(name||''));
function classify(item,category=''){
 const value=String(category||''),explicit=!!value;
 if(/cancel|encerrad|ended/i.test(value))return 'ended';
 if(/no (?:tsunami )?(?:threat|danger)|sem amea[cç]a/i.test(value))return 'noThreat';
 if(item.cancelled)return 'ended';
 if(/information|informativo/i.test(value))return item.hazardNature!=='warning'&&/no tsunami (?:threat|danger)|no existe peligro de tsunami|sem amea[cç]a|n[aã]o h[aá] amea[cç]a/i.test([item.detail,item.description].join(' '))?'noThreat':'information';
 if(/watch|vigil[aâ]ncia/i.test(value))return 'watch';
 if(/advisory|aten[cç][aã]o/i.test(value))return 'advisory';
 if(explicit&&/meters|metres|metros|warning|threat|aviso|amea[cç]a/i.test(value))return item.hazardNature==='warning'?'warning':'information';
 if(item.hazardNature==='warning')return /watch|vigil/i.test(item.warningLevel)?'watch':/advisory|aten/i.test(item.warningLevel)?'advisory':'warning';
 const text=[item.detail,item.description].join(' ');
 if(/(?:no tsunami (?:threat|danger)|no existe peligro de tsunami|sem amea[cç]a|n[aã]o h[aá] amea[cç]a)/i.test(text))return 'noThreat';
 return 'information';
}
function rows(item){
 if(item?.retained&&Array.isArray(item.regionalRows))return item.regionalRows.map(r=>({...r,stale:true}));
 const scopes=[...(item?.affectedAreas||[]),...(item?.coverageAreas||[])].map(a=>typeof a==='string'?{name:a}:a).filter(a=>a?.name);
 if(!scopes.length)scopes.push({name:item.warningGeometry||item.coordinateRole==='warning-area'?item.place||'Área publicada pela autoridade':'Regiões não detalhadas no boletim',unscoped:true});
 const result=[];
 for(const a of scopes.slice(0,100)){const state=classify(item,a.category),active=['warning','watch','advisory'].includes(state);const row={key:(item.feedKey||item.source||'')+'|'+normalize(a.name),region:a.name,regionLabel:region(a.name)+(Number.isFinite(a.radiusKm)?' · trechos até '+a.radiusKm+' km':''),scopeNote:a.scopeNote||'',category:String(a.category||item.warningLevel||''),state,label:labels[state],color:colors[state],rank:rank[state],active,geometryOnly:!!a.unscoped&&!!item.warningGeometry,scoped:!a.unscoped||!!item.warningGeometry,source:item.source||'Fonte oficial',bulletinId:item.id,feedKey:item.feedKey||item.source,issuedAt:item.time,link:item.bulletinUrl||item.link||'',stale:!!item._tsunamiStale};
  if(!result.some(r=>r.key===row.key&&r.state===row.state))result.push(row);
 }
 return result;
}
function summarize(all){
 const groups=[];
 for(const r of all){const key=[r.source,r.feedKey,r.state,r.issuedAt,r.stale].join('|');let group=groups.find(g=>g.key===key);if(!group){group={key,state:r.state,label:r.label,color:r.color,active:r.active,rank:r.rank,source:r.source,issuedAt:r.issuedAt,stale:r.stale,regions:[],rows:[]};groups.push(group);}if(!group.regions.includes(r.regionLabel))group.regions.push(r.regionLabel);group.rows.push(r);}
 return groups.sort((a,b)=>b.rank-a.rank||b.issuedAt-a.issuedAt);
}
function bundle(host,alerts=[],quakes=[],now=Date.now()){
 const T=root.TsunamiLink;if(!T||!host)return {rows:[],groups:[],bulletins:[],hasThreat:false};
 let quake=host.type==='earthquake'?host:null;
 if(!quake&&T.official(host)){const match=T.match(host,quakes);if(match?.kind==='origin')quake=match.quake;else if(T.origin(host)&&Number.isFinite(host.originTime))quake={id:'bulletin-origin',type:'earthquake',coords:host.coords,time:host.originTime,mag:host.originMag};}
 const candidates=T.latest([...alerts,...(T.official(host)?[host]:[])],now);
 const bulletins=candidates.filter(a=>a.id===host.id||quake&&T.match(a,quakes.some(q=>q.id===quake.id)?quakes:[quake])?.quake.id===quake.id&&Number.isFinite(a.originTime)||T.official(host)&&T.sameEvent(host,a));
 const all=bulletins.flatMap(rows),groups=summarize(all);
 return {rows:all,groups,bulletins,hasThreat:all.some(r=>r.active),activeRegions:all.filter(r=>r.active&&r.scoped).map(r=>r.regionLabel)};
}
function signature(item){return JSON.stringify(rows(item).map(r=>[normalize(r.regionLabel),r.state,r.category.trim().toLowerCase().replace(/\s+/g,' '),r.scopeNote]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
function hasThreat(item){return rows(item).some(r=>r.active&&!r.stale);}
const api={normalize,region,classify,rows,summarize,bundle,hasThreat,signature,labels,colors};root.TsunamiRegional=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

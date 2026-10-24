/* Official bulletin evidence for image exports; absence never means no threat. */
(function(root){'use strict';
const names={warning:'AVISO OFICIAL DE TSUNAMI',watch:'VIGILÂNCIA DE TSUNAMI',advisory:'ATENÇÃO PARA TSUNAMI',cancelled:'AVISO DE TSUNAMI ENCERRADO',noThreat:'SEM AMEAÇA SEGUNDO O BOLETIM',information:'BOLETIM INFORMATIVO DE TSUNAMI',unknown:'TSUNAMI: SITUAÇÃO NÃO CONFIRMADA'};
function state(a){if(names[a.imageState])return a.imageState;if(a.hazardNature==='warning'&&!a.cancelled)return /vigil|watch/i.test(a.warningLevel)?'watch':/aten|advisory/i.test(a.warningLevel)?'advisory':'warning';if(a.cancelled&&/cancel|encerr|ended/i.test([a.title,a.detail,a.description].join(' ')))return 'cancelled';if(/(?:there is no tsunami threat|no tsunami threat|no destructive tsunami|não há ameaça de tsunami)/i.test([a.detail,a.description].join(' ')))return 'noThreat';if(a.cancelled)return 'cancelled';if(a.hazardNature!=='warning')return 'information';return /vigil|watch/i.test(a.warningLevel)?'watch':/aten|advisory/i.test(a.warningLevel)?'advisory':'warning';}
function areas(a){return a.retained?(a.retainedAreas||'Regiões: consulte o boletim oficial'):[...(a.affectedAreas||[]).map(x=>x.name),...(a.coverageAreas||[]).map(x=>typeof x==='string'?x:x.name)].filter(Boolean).slice(0,20).join(' · ').slice(0,1000)||'Regiões: consulte o boletim oficial';}
function version(s){return JSON.stringify([s.state,!!s.stale,s.areas||'',s.bulletins||[]]);}
function resolve(quake,feed,previous=null,quakes=[quake],now=Date.now()){
 const rows=(feed?.items||[]).filter(a=>root.TsunamiLink.current(a,now)).flatMap(alert=>{const r=root.TsunamiLink.match(alert,quakes);return r?.quake.id===quake.id&&r.kind==='origin'?[{alert,...r}]:[];});
 const linked=rows.map(r=>r.alert),ids=new Set([...linked.map(a=>a.officialEventId),...(previous?.eventIds||[])].filter(Boolean));
 // A later cancellation can omit origin coordinates but retain an exact official event ID.
 for(const a of root.TsunamiLink.latest(feed?.items||[],now))if(a.officialEventId&&ids.has(a.officialEventId)&&!linked.some(b=>a.id===b.id))linked.push(a);
 // Retain newer evidence per product when a feed disappears or serves an older revision.
 for(const b of previous?.bulletins||[]){const product=b[5]||b[1];if(!names[b[3]]||linked.some(a=>(a.feedKey||a.source)===product&&a.time>=b[2]))continue;
  linked.push({id:b[0],source:b[1],time:b[2],imageState:b[3],link:b[4],feedKey:product,type:'tsunami',official:true,coords:quake.coords,originTime:quake.time,retained:true,retainedAreas:b[6],regionalRows:b[7]});
 }
 const latest=root.TsunamiLink.latest(linked,now),rank={warning:6,watch:5,advisory:4,cancelled:3,noThreat:2,information:1};
 latest.sort((a,b)=>(rank[state(b)]||0)-(rank[state(a)]||0)||b.time-a.time);
 const a=latest[0],fresh=feed?.ok===true&&(!feed.checkedAt||now-feed.checkedAt<15*60000);
 let result;
 if(a){const kind=state(a),evidenceFresh=fresh&&(!(feed.sources?.length)||feed.sources.some(s=>s.ok&&(s.feedKey||s.source)===(a.feedKey||a.source))); result={state:kind,headline:names[kind],source:a.source,issuedAt:a.time,checkedAt:now,stale:!evidenceFresh||!!a.retained,
  eventIds:[...ids].slice(0,12),areas:areas(a),
  bulletins:latest.slice(0,12).map(b=>[b.id,b.source,b.time,state(b),b.link||'',b.feedKey||b.source,areas(b),root.TsunamiRegional?.rows(b)||[]])};}
 else if(previous&&previous.state!=='unknown')result={...previous,checkedAt:now,stale:true};
 else result={state:'unknown',headline:names.unknown,source:'',issuedAt:null,checkedAt:now,stale:!fresh,areas:'Ausência de boletim não significa ausência de risco.',bulletins:[]};
 result.regionalRows=latest.flatMap(a=>root.TsunamiRegional?.rows(a)||[]);result.regionalGroups=root.TsunamiRegional?.summarize(result.regionalRows)||[];
 const mainGroup=result.regionalGroups[0];if(mainGroup){const state=mainGroup.state==='ended'?'cancelled':mainGroup.state;result.state=state;result.headline=names[state]||names.unknown;result.source=mainGroup.source;result.issuedAt=mainGroup.issuedAt;result.stale=mainGroup.stale||result.stale;}
 result.version=version(result);return result;
}
root.QuakeTsunamiStatus={resolve,version,names};if(typeof module!=='undefined')module.exports=root.QuakeTsunamiStatus;
})(globalThis);

/* Bounded local history. Origin, publication and browser observation are distinct. */
(function(root){
'use strict';
const MAX_EVENTS=240,MAX_ROWS=36,AGE=7*86400000;
const number=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const safe=s=>String(s||'').slice(0,300);
function signature(v){let hash=2166136261;for(const c of JSON.stringify(v)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
function snapshot(q){return {id:safe(q.id),type:q.type||'earthquake',time:number(q.time),mag:number(q.mag),depth:number(q.depth),coords:Array.isArray(q.coords)?q.coords.slice(0,2):null,source:safe(q.sourceSummary||q.source),isPreliminary:!!q.isPreliminary,warningLevel:safe(q.warningLevel),cancelled:!!q.cancelled,officialEventId:safe(q.officialEventId),feedKey:safe(q.feedKey),originTime:number(q.originTime),originMag:number(q.originMag),coordinateRole:q.coordinateRole,place:safe(q.place),areas:signature([q.affectedAreas||[],q.coverageAreas||[]])};}
function create(saved){
 const events=new Map();
 if(saved?.version===1&&Array.isArray(saved.events))for(const e of saved.events.slice(-MAX_EVENTS))if(e&&typeof e.id==='string'&&e.snapshot?.id===e.id&&Array.isArray(e.rows)&&Number.isFinite(e.seenAt))events.set(e.id,{...e,rows:e.rows.filter(r=>r&&typeof r.key==='string'&&Number.isFinite(r.at)&&typeof r.text==='string').slice(-MAX_ROWS)});
 function prune(now){for(const[id,e]of events)if(now-e.seenAt>AGE)events.delete(id);while(events.size>MAX_EVENTS)events.delete(events.keys().next().value);}
 function add(id,row){const e=events.get(id);if(!e||!Number.isFinite(row.at)||e.rows.some(r=>r.key===row.key))return false;e.rows.push({...row,text:safe(row.text),source:safe(row.source)});if(e.rows.length>MAX_ROWS)e.rows.splice(1,1);return true;}
 function observe(q,now=Date.now()){
  if(!q?.id||!Number.isFinite(q.time)||q.time>now+300000||q.__tsunamiMapDemo)return false;
  const s=snapshot(q);let e=events.get(s.id),changed=false;
  if(!e){e={id:s.id,seenAt:now,snapshot:s,rows:[]};events.set(s.id,e);add(s.id,{key:'origin',at:s.time,text:s.type==='earthquake'?'Origem do sismo':s.type==='tsunami'?'Boletim '+(s.warningLevel||'publicado'):'Registro publicado',source:s.source,clock:'source'});add(s.id,{key:'first-seen',at:now,text:'Primeiro registro neste dispositivo',source:'Monitor Global',clock:'observed'});changed=true;}
  else{
   const p=e.snapshot,parts=[];
   if(s.type==='earthquake'){
    if(s.mag!==null&&p.mag!==null&&Math.abs(s.mag-p.mag)>=.099)parts.push('Magnitude M'+p.mag.toFixed(1)+' → M'+s.mag.toFixed(1));
    if(s.depth!==null&&p.depth!==null&&Math.abs(s.depth-p.depth)>=1)parts.push('Profundidade '+p.depth+' → '+s.depth+' km');
    if(p.isPreliminary&&!s.isPreliminary)parts.push('Preliminar → revisado');
   }
   if(s.source!==p.source)parts.push('Fontes: '+s.source);
   if(s.warningLevel!==p.warningLevel||s.cancelled!==p.cancelled)parts.push(s.cancelled?'Boletim encerrado':'Nível: '+s.warningLevel);
   if(s.areas!==p.areas&&s.type==='tsunami')parts.push('Regiões do boletim atualizadas');
   if(parts.length){const at=number(q.sourceUpdatedAt),published=at!==null&&at>=s.time&&at<=now+300000;changed=add(s.id,{key:'change-'+now+'-'+parts.join('|'),at:published?at:now,text:parts.join(' · ').replace(/(\d)\.(\d)/g,'$1,$2'),source:s.source,clock:published?'source':'observed'})||changed;}
   e.snapshot=s;e.seenAt=now;events.delete(s.id);events.set(s.id,e);
  }
  prune(now);return changed;
 }
 return {observe,add,get:id=>events.get(id),all:()=>[...events.values()],serialize:()=>{const rows=[...events.values()];while(rows.length&&JSON.stringify(rows).length>500000)rows.shift();return {version:1,events:rows};}};
}
const api={create,snapshot,number,MAX_EVENTS,MAX_ROWS};root.EventEvolutionModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

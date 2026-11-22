// Official IDAP/CAP snapshot to Firebase. Never synthesize or infer cell-broadcast alerts.
export const CIVIL_TOPIC='monitor_global_civil_v1';
export const CIVIL_SOURCE='https://idapfile.mdr.gov.br/idap/api/rss/cap';
const KEY='mobile-civil-history-v1',MIN=60000,MAX_AGE=30*MIN,MAX_SNAPSHOT_AGE=10*MIN;
const issuers=new Set(['defesa civil estadual de são paulo','defesa civil de são paulo (sp)']);
const text=value=>typeof value==='string'?value.trim():'';
const hash=value=>{let n=2166136261;for(const c of value){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(36);};
/** Source provenance, municipality, CAP validity and delivery freshness are mandatory. */
export function validCivilSnapshot(snapshot,now){
 return snapshot?.version===1&&snapshot.source===CIVIL_SOURCE&&snapshot.municipality==='3550308'&&
 Number.isFinite(snapshot.checkedAt)&&snapshot.checkedAt<=now+MIN&&now-snapshot.checkedAt>=0&&
 now-snapshot.checkedAt<=MAX_SNAPSHOT_AGE&&Number.isFinite(snapshot.updatedAt)&&
 snapshot.updatedAt<=snapshot.checkedAt+MIN&&
 Array.isArray(snapshot.alerts)&&snapshot.alerts.length<=20&&
 (now-snapshot.updatedAt<=20*MIN||snapshot.alerts.some(a=>a&&Number.isFinite(a.sent)&&
  a.sent>now-MAX_AGE&&a.sent<=now&&Number.isFinite(a.expires)&&a.expires>now));
}
export function civilNotices(snapshot,now){
 if(!validCivilSnapshot(snapshot,now))return [];
 const output=[];
 for(const value of snapshot.alerts){
  if(!value||!['Severe','Extreme'].includes(value.severity)||
    !issuers.has(text(value.issuer).toLowerCase())||
    !text(value.id)||text(value.id).length>80||!text(value.message)||text(value.message).length>500||
    !Number.isFinite(value.sent)||value.sent<=0||value.sent>now||
    now-value.sent>MAX_AGE||!Number.isFinite(value.expires)||value.expires<=now||
    value.expires<=value.sent||value.expires-value.sent>24*3600000)continue;
  const id='civil:'+value.id+':'+value.sent;
  const body=text(value.message),version=String(value.sent)+':'+hash(body);
  output.push({schema:'monitor-notice-v1',kind:'civil',id,version,
   title:'Defesa Civil · Alerta '+(value.severity==='Extreme'?'EXTREMO':'SEVERO'),
   body,issuedAt:value.sent,expiresAt:value.expires,
   issuer:value.issuer,severity:value.severity,source:CIVIL_SOURCE});
 }
 return output.sort((a,b)=>b.issuedAt-a.issuedAt).slice(0,20);
}
/** A failed send is never marked as delivered; recent original CAP events only. */
export function createCivilDispatcher({storage,read,send,clock=Date.now}){
 return async function tick(){
  const now=clock(),snapshot=await read().catch(()=>null);
  if(!validCivilSnapshot(snapshot,now))return {skipped:'official-cap-unavailable-or-stale',sent:0};
  let state=await storage.get(KEY)||{records:[]};
  if(!Array.isArray(state.records))state={records:[]};
  state.records=state.records.filter(x=>x&&typeof x.id==='string'&&Number.isFinite(x.at)&&now-x.at<7*86400000).slice(-200);
  let sent=0;
  for(const n of civilNotices(snapshot,now)){
   const previous=state.records.find(x=>x.id===n.id);
   if(previous?.version===n.version)continue;
   const raw=JSON.stringify(n);
   if(new TextEncoder().encode(raw).length>3000)continue;
   const seconds=Math.min(1800,Math.max(1,Math.floor((n.expiresAt-now)/1000)));
   await send({topic:CIVIL_TOPIC,data:{notice:raw},android:{priority:'HIGH',ttl:seconds+'s'}});
   if(previous){previous.version=n.version;previous.at=now;}
   else state.records.push({id:n.id,version:n.version,at:now});
   state.records=state.records.slice(-200);await storage.put(KEY,state);
   if(++sent>=3)break;
  }
  return {sent};
 };
}

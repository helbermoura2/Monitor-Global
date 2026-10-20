export const TELEGRAM_SOLUTION_POLICY='reviewed-seismic-priority-v1';
// Selection only: no fetching, persistence, Telegram calls or scheduling.
const usgs=event=>event?.provider==='USGS'||/earthquake\.usgs\.gov/.test(event?.url||'');
export function telegramSolutionPriority(event){
 if(!usgs(event))return 0;
 const network=String(event.source||'').toUpperCase();
 return /^(PT|AT|USAUTO)$/.test(network)||/^usauto/.test(event.id||'')?1:2;
}
export function telegramSolutionMayReplace(before,after){
 if(usgs(before)&&usgs(after)){
  const a=telegramSolutionPriority(after),b=telegramSolutionPriority(before);
  if(a!==b)return a>b;
 }
 if(before?.id===after?.id){
  const a=Number(after.sourceUpdatedAt),b=Number(before.sourceUpdatedAt);
  if(a>0&&b>0&&a<b)return false;
  if(before.reviewed&&!after.reviewed)return false;
 }
 return true;
}

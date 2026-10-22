export function imageRefreshInterval(record,now=Date.now()){const age=now-Date.parse(record.timeIso);return Number(record.currentEvent?.mag??record.mag)>=5.5&&age>=0&&age<3600000?60000:300000;}
export function imageRefreshDue(record,now=Date.now()){
 const age=now-Date.parse(record.timeIso);if(record.aliasOf||record.baseline||record.delivery!=='sent'||record.messageType!=='photo'||!record.messageId||!Number.isFinite(age)||age<0||age>=86400000||now-(record.imageExposureCheckedAt||0)<30000)return false;
 const pending=record.imageExposureVersion==='pending'||record.currentEvent?.imageExposure?.upstreamStatus==='pending';
 return record.cardImageVersion!=='cartographic-v12-context'||now-(record.imageShakingCheckedAt||0)>=imageRefreshInterval(record,now)||pending&&age<1200000;
}
export function selectImageRefreshes(records,now=Date.now()){return records.filter(r=>imageRefreshDue(r,now)).sort((a,b)=>((a.imageShakingCheckedAt||0)+imageRefreshInterval(a,now))-((b.imageShakingCheckedAt||0)+imageRefreshInterval(b,now))).slice(0,3);}

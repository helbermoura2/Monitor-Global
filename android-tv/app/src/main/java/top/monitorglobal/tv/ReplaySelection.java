package top.monitorglobal.tv;
/** Revisions of older origins must not hide a newer quake. No notification side effects. */
final class ReplaySelection {
 /** Restrict offline replays to the requested category and rolling 72h window. */
 static Alert scoped(Alert a,String view,long now){
  if(a==null||!"earthquake".equals(a.kind)||a.eventTime<=0
    ||a.eventTime>now+300000||now-a.eventTime>72L*3600000)return null;
  if("brazil-replay".equals(view))return "br".equals(a.countryCode)?a:null;
  if("global-replay".equals(view))return !"br".equals(a.countryCode)
    &&Double.isFinite(a.magnitude)&&a.magnitude>=6?a:null;
  return a;
 }
 static Alert latest(Alert a,Alert b){
  if(a==null)return b;if(b==null)return a;
  if(a.eventTime!=b.eventTime)return a.eventTime>b.eventTime?a:b;
  return a.issuedAt>=b.issuedAt?a:b;
 }
}

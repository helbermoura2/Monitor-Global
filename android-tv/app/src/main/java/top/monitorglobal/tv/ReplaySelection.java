package top.monitorglobal.tv;
/** Revisions of older origins must not hide a newer quake. No notification side effects. */
final class ReplaySelection {
 static Alert latest(Alert a,Alert b){
  if(a==null)return b;if(b==null)return a;
  if(a.eventTime!=b.eventTime)return a.eventTime>b.eventTime?a:b;
  return a.issuedAt>=b.issuedAt?a:b;
 }
}

package top.monitorglobal.tv;

import android.content.Context;

/** Latest previously received real Civil Defense record across CAP and phone relay.
 * Historical-only: never synthesizes an alert from current network data.
 * Both source-specific history stores retain their separate provenance.
 */
final class CivilLatestReplay {
 static final class Record {
  final DefesaCivilSp.Notice notice;
  final boolean phone;
  Record(DefesaCivilSp.Notice notice,boolean phone){
   this.notice=notice;this.phone=phone;
  }
  String origin(){return phone?"CELL BROADCAST · CELULAR · NÃO VERIFICADO VIA CAP":"BOLETIM OFICIAL CAP";}
  String label(){return notice.level()+" · "+origin();}
 }
 private CivilLatestReplay(){}
 static Record choose(DefesaCivilSp.Notice capSevere,DefesaCivilSp.Notice capExtreme,
                      DefesaCivilSp.Notice phoneSevere,DefesaCivilSp.Notice phoneExtreme){
  Record latest=null;
  DefesaCivilSp.Notice[] notices={capSevere,capExtreme,phoneSevere,phoneExtreme};
  for(int i=0;i<notices.length;i++){
   DefesaCivilSp.Notice n=notices[i];
   if(n==null)continue;
   boolean phone=i>=2;
   if(latest==null||n.sent>latest.notice.sent)latest=new Record(n,phone);
  }
  return latest;
 }
 static Record last(Context c){
  return choose(CivilReplayStore.last(c,CivilReplayStore.SEVERE),
   CivilReplayStore.last(c,CivilReplayStore.EXTREME),
   CivilPhoneHistory.last(c,"Severe"),CivilPhoneHistory.last(c,"Extreme"));
 }
}

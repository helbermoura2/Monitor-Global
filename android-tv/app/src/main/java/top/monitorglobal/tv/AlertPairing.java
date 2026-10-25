package top.monitorglobal.tv;
import java.util.*;
/** Consume only precise associations already supplied by the official server model. */
final class AlertPairing {
 static boolean isPair(Alert a,Alert b){if(a==null||b==null)return false;Alert q=a.kind.equals("earthquake")?a:b,t=a.kind.equals("tsunami")?a:b;return q.kind.equals("earthquake")&&t.kind.equals("tsunami")&&!t.relatedQuakeId.isEmpty()&&t.relatedQuakeId.equals(q.id);}
 private static int rank(Alert a){return a.state.equals("warning")?3:a.state.equals("watch")?2:a.state.equals("advisory")?1:0;}
 static void attach(List<Alert> notices,List<Alert> snapshot,boolean quakeOk,boolean tsunamiOk){
  if(!quakeOk||!tsunamiOk)return;
  for(Alert a:notices){Alert best=null;for(Alert b:snapshot){if(!isPair(a,b))continue;
   if(a.kind.equals("earthquake")&&(!b.eligible||rank(b)==0&&!b.state.equals("noThreat")))continue;
   if(best==null||rank(b)>rank(best)||rank(b)==rank(best)&&b.issuedAt>best.issuedAt)best=b;
  }if(best!=null)a.companion=best.copy();}
 }
 static List<Alert> coalesce(List<Alert> notices){
  List<Alert> out=new ArrayList<>();for(Alert a:notices){boolean covered=false;
   if(a.kind.equals("tsunami"))for(Alert q:notices)if(q.kind.equals("earthquake")&&q.companion!=null&&q.companion.id.equals(a.id)&&q.companion.version.equals(a.version)){covered=true;break;}
   if(!covered)out.add(a);
  }return out;
 }
 static void refreshQueuedCompanions(Collection<Alert> pending,List<Alert> snapshot,boolean quakeOk,boolean tsunamiOk){
  for(Alert p:pending){if(p.companion==null)continue;boolean healthy=p.companion.kind.equals("tsunami")?tsunamiOk:quakeOk;if(!healthy)continue;
   for(Alert latest:snapshot)if(latest.id.equals(p.companion.id)&&isPair(p,latest)){
    p.companion=latest.copy();if(p.kind.equals("earthquake"))p.tsunamiSummary=(rank(latest)>0||latest.state.equals("noThreat"))?latest.tsunamiSummary:"";break;
   }
  }
 }
 static boolean replacesQueued(Alert newer,Alert older){return newer.id.equals(older.id)||newer.kind.equals("earthquake")&&newer.companion!=null&&newer.companion.id.equals(older.id);}
 static boolean updates(Alert active,Alert next){if(active==null)return false;if(active.id.equals(next.id))return !active.version.equals(next.version);return active.companion!=null&&active.companion.id.equals(next.id)&&!active.companion.version.equals(next.version);}
 static boolean represents(Alert presentation,Alert other){return presentation.id.equals(other.id)||presentation.companion!=null&&presentation.companion.id.equals(other.id)&&presentation.companion.version.equals(other.version);}
}

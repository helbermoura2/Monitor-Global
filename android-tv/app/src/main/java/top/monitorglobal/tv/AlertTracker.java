package top.monitorglobal.tv;
import java.util.*;
/** Baseline and deduplication are independent for each healthy source. No disappearance means cancellation. */
public final class AlertTracker {
 public static final class Seen {public String version;public long at;public boolean tracked;public Seen(String v,long a,boolean t){version=v;at=a;tracked=t;}}
 public final LinkedHashMap<String,Seen> seen=new LinkedHashMap<>();public boolean earthquakeReady,tsunamiReady;
 public List<Alert> accept(List<Alert> alerts,boolean earthquakeOk,boolean tsunamiOk,long now){
  List<Alert> notifications=new ArrayList<>();
  for(Alert a:alerts){boolean quake=a.kind.equals("earthquake");if(!quake&&!a.kind.equals("tsunami"))continue;if(quake&&!earthquakeOk||!quake&&!tsunamiOk)continue;
   boolean ready=quake?earthquakeReady:tsunamiReady;Seen old=seen.get(a.id);boolean fresh=a.issuedAt<=now+300000&&now-a.issuedAt<=30*60000;
   boolean changed=old==null||!old.version.equals(a.version),tracked=a.eligible||old!=null&&old.tracked;
   if(ready&&changed&&fresh&&(a.eligible||old!=null&&old.tracked))notifications.add(quake&&old!=null?new Alert(a.id,a.kind,a.version,a.title,"Revisão · "+a.detail,a.state,a.issuedAt,a.eventTime,a.eligible):a);
   seen.put(a.id,new Seen(a.version,now,tracked));
  }
  if(earthquakeOk)earthquakeReady=true;if(tsunamiOk)tsunamiReady=true;
  seen.entrySet().removeIf(e->now-e.getValue().at>72*3600000L);while(seen.size()>256)seen.remove(seen.keySet().iterator().next());return notifications;
 }
}

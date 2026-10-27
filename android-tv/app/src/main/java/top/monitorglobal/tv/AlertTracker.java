package top.monitorglobal.tv;
import java.util.*;
/** Baseline and deduplication are independent for each healthy source. No disappearance means cancellation. */
public final class AlertTracker {
 public static final class Seen {public Alert bulletin;public String version;public long at;public boolean tracked;public double magnitude=Double.NaN,noticeMagnitude=Double.NaN;public Seen(String v,long a,boolean t){version=v;at=a;tracked=t;}}
 public final LinkedHashMap<String,Seen> seen=new LinkedHashMap<>();public boolean earthquakeReady,tsunamiReady;public final Set<String> readyCatalogs=new HashSet<>();
 public List<Alert> accept(List<Alert> alerts,boolean earthquakeOk,boolean tsunamiOk,long now){
  return accept(alerts,earthquakeOk,tsunamiOk,now,Collections.emptyMap());
 }
 public List<Alert> accept(List<Alert> alerts,boolean earthquakeOk,boolean tsunamiOk,long now,Map<String,Boolean> catalogs){
  List<Alert> notifications=new ArrayList<>();
  for(Alert a:alerts){boolean quake=a.kind.equals("earthquake");if(!quake&&!a.kind.equals("tsunami"))continue;if(quake&&!earthquakeOk||!quake&&!tsunamiOk)continue;
   String catalog=a.catalog.isEmpty()?a.provider:a.catalog;
   if(quake&&!catalogs.isEmpty()&&!Boolean.TRUE.equals(catalogs.get(catalog)))continue;
   boolean ready=quake?catalogs.isEmpty()?earthquakeReady:readyCatalogs.contains(catalog):tsunamiReady;Seen old=seen.get(a.id);
   if(old==null&&!a.aliases.isEmpty()){List<Seen> matches=new ArrayList<>();for(String id:a.aliases){Seen match=seen.get(id);if(match!=null&&!matches.contains(match))matches.add(match);}if(matches.size()==1)old=matches.get(0);}if(old==null&&!quake){List<Map.Entry<String,Seen>> matches=new ArrayList<>();for(Map.Entry<String,Seen> e:seen.entrySet())if(Alert.sameBulletin(e.getValue().bulletin,a))matches.add(e);if(matches.size()==1){old=matches.get(0).getValue();seen.remove(matches.get(0).getKey());}}
   boolean fresh=a.issuedAt<=now+300000&&now-a.issuedAt<=30*60000;
   boolean changed=old==null||!(old.version.equals(a.version)||!quake&&!a.legacyVersion.isEmpty()&&old.version.equals(a.legacyVersion))||!quake&&a.eligible&&!old.tracked,tracked=a.eligible||old!=null&&old.tracked;
   double notice=old==null?Double.NaN:Double.isFinite(old.noticeMagnitude)?old.noticeMagnitude:old.magnitude;
   boolean important=!quake||old==null||old.magnitude==a.magnitude||importantChange(notice,a.magnitude);
   boolean notify=ready&&changed&&fresh&&tracked&&important;
   if(notify)notifications.add(quake&&old!=null?a.revised(notice):a);
   Seen next=new Seen(a.version,now,tracked);if(!quake)next.bulletin=a.bulletinIdentity();next.magnitude=a.magnitude;next.noticeMagnitude=old==null||notify?a.magnitude:notice;seen.put(a.id,next);
  }
  for(Map.Entry<String,Boolean> entry:catalogs.entrySet())if(Boolean.TRUE.equals(entry.getValue()))readyCatalogs.add(entry.getKey());
  if(earthquakeOk)earthquakeReady=true;if(tsunamiOk)tsunamiReady=true;
  seen.entrySet().removeIf(e->now-e.getValue().at>72*3600000L);while(seen.size()>256)seen.remove(seen.keySet().iterator().next());return notifications;
 }
 private static boolean importantChange(double before,double after){return !Double.isFinite(before)||!Double.isFinite(after)||Math.abs(after-before)>=.3-1e-8||(before>=6)!=(after>=6)||(before>=7)!=(after>=7)||after>=6&&after!=before;}
}

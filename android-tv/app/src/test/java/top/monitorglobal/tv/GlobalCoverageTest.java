package top.monitorglobal.tv;
import org.junit.Test;import java.util.*;import static org.junit.Assert.*;
public class GlobalCoverageTest {
 private final long now=1800000000000L;
 private Alert a(String provider,double mag,String version){Alert a=new Alert("USGS:us7000ttlt","earthquake",version,"M6,1 · Vanuatu","Fonte","earthquake",now,now-60000,mag>=6);a.provider=provider;a.catalog=provider.equals("USGS")?"USGS":provider+"_GLOBAL";a.source=provider;a.magnitude=mag;return a;}
 @Test public void supplementalSourcesHaveIndependentBaselinesAndDoNotCreateFalseSameSourceRevisions(){
  AlertTracker t=new AlertTracker();Map<String,Boolean> health=Map.of("USGS",true,"GEOFON_GLOBAL",true,"EMSC_GLOBAL",false);
  t.accept(List.of(a("USGS",5.6,"us56")),true,true,now,health);
  List<Alert> notices=t.accept(List.of(a("GEOFON",6.09,"gfz61")),true,true,now+1000,health);assertEquals(1,notices.size());Alert out=notices.get(0);assertTrue(out.revision.startsWith("Nova estimativa"));assertTrue(out.revision.contains("USGS"));assertFalse(BannerTimeline.magnitudeChanged(out));assertEquals("GEOFON",t.seen.get(out.id).provider);
  assertTrue(t.accept(List.of(a("GEOFON",6.09,"gfz61")),true,true,now+2000,health).isEmpty());
  assertTrue(t.accept(List.of(a("GEOFON",6.10,"gfz610")),true,true,now+3000,health).isEmpty());
  notices=t.accept(List.of(a("GEOFON",6.2,"gfz62")),true,true,now+4000,health);assertEquals(1,notices.size());assertEquals("M6,1 → M6,2",notices.get(0).revision);assertTrue(BannerTimeline.magnitudeChanged(notices.get(0)));
 }
 @Test public void firstHealthySnapshotOfEachGlobalSourceIsSilent(){
  AlertTracker t=new AlertTracker();t.accept(List.of(),true,true,now,Map.of("USGS",true));
  assertTrue(t.accept(List.of(a("GEOFON",6.1,"v1")),true,true,now,Map.of("GEOFON_GLOBAL",true)).isEmpty());
  assertTrue(t.accept(List.of(a("EMSC",6.2,"v2")),true,true,now,Map.of("EMSC_GLOBAL",false)).isEmpty());
  assertFalse(t.readyCatalogs.contains("EMSC_GLOBAL"));
 }
 @Test public void newSourceBaselineNeverReusesAnotherAgencysMagnitudeForLaterRevision(){
  AlertTracker t=new AlertTracker();t.accept(List.of(a("USGS",5.6,"us")),true,true,now,Map.of("USGS",true));
  assertTrue(t.accept(List.of(a("GEOFON",6.09,"gfz61")),true,true,now+1000,Map.of("USGS",true,"GEOFON_GLOBAL",true)).isEmpty());
  List<Alert> notices=t.accept(List.of(a("GEOFON",6.2,"gfz62")),true,true,now+2000,Map.of("USGS",true,"GEOFON_GLOBAL",true));assertEquals(1,notices.size());assertEquals("M6,1 → M6,2",notices.get(0).revision);
 }
}

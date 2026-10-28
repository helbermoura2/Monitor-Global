package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import java.util.*;
public class AlertTrackerParityTest {
 private final long now=1800000000000L;
 private Alert q(String id,String catalog,double mag,String version){Alert a=new Alert(id,"earthquake",version,"Sismo","Fonte","earthquake",now,now-50*3600000L,true);a.catalog=catalog;a.provider=catalog;a.magnitude=mag;return a;}
 @Test public void everySourceHasItsOwnSilentBaselineAndLateBrazilEventsAreAccepted(){
  AlertTracker t=new AlertTracker();Map<String,Boolean> health=new HashMap<>();health.put("USGS",true);health.put("USP",false);
  assertTrue(t.accept(List.of(q("us1","USGS",6,"1")),true,true,now,health).isEmpty());
  health.put("USP",true);assertTrue(t.accept(List.of(q("usp1","USP",1,"1")),true,true,now,health).isEmpty());
  assertEquals(1,t.accept(List.of(q("usp2","USP",.8,"1")),true,true,now,health).size());
  health.put("USP",false);assertTrue(t.accept(List.of(q("usp3","USP",1,"1")),true,true,now,health).isEmpty());
 }
 @Test public void revisionsAccumulateAndCrossingM6AlwaysNotifies(){
  AlertTracker t=new AlertTracker();Map<String,Boolean> health=Map.of("USP",true,"USGS",true);t.accept(List.of(q("usp1","USP",1,"1"),q("us1","USGS",6.1,"1")),true,true,now,health);
  assertTrue(t.accept(List.of(q("usp1","USP",1.1,"2")),true,true,now,health).isEmpty());
  List<Alert> updates=t.accept(List.of(q("usp1","USP",1.3,"3")),true,true,now,health);assertEquals(1,updates.size());assertEquals(1,updates.get(0).previousMagnitude,0);
  Alert below=q("us1","USGS",5.9,"2");below=new Alert(below.id,below.kind,below.version,below.title,below.detail,below.state,now,now-1000,false);below.catalog="USGS";below.magnitude=5.9;
  assertEquals(1,t.accept(List.of(below),true,true,now,health).size());
 }
 @Test public void recoveredCanonicalAliasesDoNotCreateASecondAlert(){
  AlertTracker t=new AlertTracker();Map<String,Boolean> health=Map.of("USP",true,"EMSC",true);t.accept(List.of(q("old","USP",2,"1")),true,true,now,health);
  Alert a=q("canonical","EMSC",2,"1");a.aliases=List.of("old","canonical");assertTrue(t.accept(List.of(a),true,true,now,health).isEmpty());
 }
 @Test public void vanuatuSixToSixPointOneNotifiesOnceAndKeepsFullCountry(){
  AlertTracker tracker=new AlertTracker();Map<String,Boolean> health=Map.of("USGS",true);
  tracker.accept(List.of(),true,true,now,health);
  Alert original=vanuatu(6,"v6");List<Alert> first=tracker.accept(List.of(original),true,true,now,health);assertEquals(1,first.size());
  Alert updated=vanuatu(6.1,"v61");List<Alert> notices=tracker.accept(List.of(updated),true,true,now+30000,health);
  assertEquals(1,notices.size());Alert revision=notices.get(0);assertEquals("M6,0 → M6,1",revision.revision);assertEquals(6,revision.previousMagnitude,0);assertEquals(6.1,revision.magnitude,0);assertTrue(revision.title.endsWith("Vanuatu"));assertTrue(AlertPairing.updates(original,revision));
  assertTrue(tracker.accept(List.of(updated),true,true,now+60000,health).isEmpty());
 }
 private Alert vanuatu(double mag,String version){Alert a=new Alert("USGS:us7000ttlm","earthquake",version,String.format(Locale.forLanguageTag("pt-BR"),"M%.1f · 214 km a noroeste de Port-Olry, Vanuatu",mag),"Profundidade: 10 km · USGS","earthquake",now,now-60000,true);a.catalog="USGS";a.provider="USGS";a.magnitude=mag;a.depth=10;return a;}
}

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
}

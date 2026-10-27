package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import org.json.*;import java.util.*;import java.io.*;import java.nio.charset.StandardCharsets;
public class TsunamiLifecycleTest {
 private JSONObject fixture() throws Exception {try(InputStream in=getClass().getResourceAsStream("/tsunami-lifecycle.json")){assertNotNull(in);return new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));}}
 private AlertTracker restart(AlertTracker previous) throws Exception {AlertTracker restored=new AlertTracker();restored.earthquakeReady=previous.earthquakeReady;restored.tsunamiReady=previous.tsunamiReady;restored.readyCatalogs.addAll(previous.readyCatalogs);for(Map.Entry<String,AlertTracker.Seen> e:previous.seen.entrySet()){AlertTracker.Seen old=e.getValue(),copy=new AlertTracker.Seen(old.version,old.at,old.tracked);copy.magnitude=old.magnitude;copy.noticeMagnitude=old.noticeMagnitude;if(old.bulletin!=null)copy.bulletin=AlertCodec.read(AlertCodec.write(old.bulletin));restored.seen.put(e.getKey(),copy);}return restored;}
 @Test public void workerSnapshotsDriveTheCompleteTVLifecycleAcrossOutagesAndRestart() throws Exception {
  JSONArray stages=fixture().getJSONArray("stages");AlertTracker tracker=new AlertTracker();Alert active=null,waiting=null;
  for(int i=0;i<stages.length();i++){
   JSONObject stage=stages.getJSONObject(i),body=stage.getJSONObject("snapshot"),sources=body.getJSONObject("sources");List<Alert> snapshot=new ArrayList<>();JSONArray rows=body.getJSONArray("alerts");for(int j=0;j<rows.length();j++)snapshot.add(AlertCodec.read(rows.getJSONObject(j)));
   List<Alert> notices=tracker.accept(snapshot,sources.getBoolean("earthquake"),sources.getBoolean("tsunami"),stage.getLong("now"));assertEquals(stage.getString("name"),stage.getInt("expected"),notices.size());
   AlertPairing.attach(notices,snapshot,sources.getBoolean("earthquake"),sources.getBoolean("tsunami"));
   if(i==1){List<Alert> visible=AlertPairing.coalesce(notices);assertEquals(3,visible.size());active=visible.stream().filter(a->a.kind.equals("earthquake")).findFirst().get();waiting=active.copy();waiting.companion=active.companion.copy();assertEquals("warning",active.companion.state);assertEquals(32000,BannerTimeline.durationMillis(active,20));}
   if(i==3){assertEquals(1,AlertPairing.coalesce(notices).size());assertEquals(7.2,notices.stream().filter(a->a.kind.equals("earthquake")).findFirst().get().previousMagnitude,0);}
   if(i==5)tracker=restart(tracker);
   if(i==6){Alert ending=notices.get(0);assertEquals("ended",ending.state);assertTrue(AlertPairing.updates(active,ending));AlertPairing.refreshQueuedCompanions(List.of(waiting),snapshot,true,true);assertEquals("ended",waiting.companion.state);assertTrue(waiting.tsunamiSummary.contains("Fiji"));assertFalse(waiting.tsunamiSummary.contains("Vanuatu"));assertTrue(snapshot.stream().anyMatch(a->a.kind.equals("tsunami")&&a.state.equals("warning")&&a.title.contains("Fiji")));}
   if(i==11){assertEquals("warning",notices.get(0).state);assertFalse(notices.get(0).quietInformation());}
   if(i==14)assertEquals("ended",notices.get(0).state);
   if(i==7){assertEquals("noThreat",notices.get(0).state);assertTrue(notices.get(0).quietInformation());}
  }
  assertTrue(tracker.seen.size()<=4);
 }
 @Test public void migrationStaysSilentAndChangesBeyondTheTextLimitStillNotify() throws Exception {
  JSONObject row=fixture().getJSONArray("stages").getJSONObject(1).getJSONObject("snapshot").getJSONArray("alerts").getJSONObject(1);
  assertEquals("tsunami",row.getString("kind"));Alert current=AlertCodec.read(row);AlertTracker t=new AlertTracker();t.tsunamiReady=true;t.earthquakeReady=true;AlertTracker.Seen old=new AlertTracker.Seen(current.legacyVersion,current.issuedAt,true);t.seen.put(current.id,old);
  assertTrue(t.accept(List.of(current),true,true,current.issuedAt).isEmpty());
  row.put("semanticVersion","regional-status".repeat(200)+"warning");Alert longOne=AlertCodec.read(row);row.put("semanticVersion","regional-status".repeat(200)+"ended");Alert longTwo=AlertCodec.read(row);assertNotEquals(longOne.version,longTwo.version);assertTrue(longOne.version.length()<80);
 }
 @Test public void productScopeDifferentOriginsAndAmbiguousMatchesCannotBorrowCancellation() {
  long now=1800000000000L;Alert a=new Alert("a","tsunami","v","","","warning",now,now,true);a.bulletinProduct="PTWC-WEPA40";a.originTime=now;a.originLongitude=166;a.originLatitude=-14;
  Alert b=new Alert("b","tsunami","end","","","ended",now,now,false);b.bulletinProduct=a.bulletinProduct;b.originTime=now+2000;b.originLongitude=166.2;b.originLatitude=-14;
  assertTrue(Alert.sameBulletin(a,b));b.bulletinProduct="NTWC-WEAK51";assertFalse(Alert.sameBulletin(a,b));b.bulletinProduct=a.bulletinProduct;b.originTime=now-3600000;assertFalse(Alert.sameBulletin(a,b));b.originTime=now+2000;
  AlertTracker t=new AlertTracker();Alert other=a.copy();other=new Alert("another","tsunami","v","","","warning",now,now,true);other.bulletinProduct=a.bulletinProduct;other.originTime=a.originTime;other.originLongitude=166.1;other.originLatitude=-14;
  a.officialEventId="event-1";other.officialEventId="event-2";t.accept(List.of(a,other),true,true,now);assertTrue(t.accept(List.of(b),true,true,now).isEmpty());
 }
 @Test public void queuedWarningCanEndDuringQuakeOutageAndExplicitNoThreatCanBecomeEligibleOnce() {
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0),end=DemoAlerts.create("ended",1800000000000L).get(0);q.companion.bulletinProduct="PTWC";end.bulletinProduct="PTWC";end.relatedQuakeId="";
  Alert tsunami=q.companion.copy();tsunami.companion=q.copy();Alert revised=q.revised(7.3);revised=new Alert(q.id,q.kind,"updated",q.title,q.detail,q.state,q.issuedAt,q.eventTime,true);assertTrue(AlertPairing.updates(tsunami,revised));
  AlertPairing.refreshQueuedCompanions(List.of(q),List.of(end),false,true);assertEquals("ended",q.companion.state);assertTrue(q.tsunamiSummary.isEmpty());
  AlertTracker t=new AlertTracker();long now=1800000000000L;Alert unlinked=new Alert("safe","tsunami","same","","","noThreat",now,now,false);t.accept(List.of(unlinked),true,true,now);Alert eligible=new Alert("safe","tsunami","same","","","noThreat",now,now,true);assertEquals(1,t.accept(List.of(eligible),true,true,now).size());assertTrue(t.accept(List.of(eligible),true,true,now).isEmpty());
 }
}

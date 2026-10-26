package top.monitorglobal.tv;
import java.util.*;import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
public class SummaryRecordTest {
 @Test public void closedDayFlagSurvivesOfflineReplayWithoutChangingLegacyRecords() throws Exception {
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0);
  assertTrue(SummaryRecord.decode(SummaryRecord.encode(List.of(q),"2026-10-25",1800000000000L,true)).complete);
  JSONObject legacy=new JSONObject(SummaryRecord.encode(List.of(q),"2026-10-25",1800000000000L));legacy.remove("complete");assertFalse(SummaryRecord.decode(legacy.toString()).complete);
 }
 @Test public void offlineReplayPreservesOriginalOrderDateTimeAndTiming() throws Exception {
  List<Alert> list=new ArrayList<>();long time=1800000000000L;
  for(int i=0;i<5;i++){Alert a=new Alert("q"+i,"earthquake","v","M6,0 · Local","USGS","earthquake",time,time-i*1000,true);a.magnitude=7-i*.3;a.depth=10;list.add(a);}
  FeedClient.Snapshot saved=SummaryRecord.decode(SummaryRecord.encode(list,"2026-10-25",time));
  assertEquals("2026-10-25",saved.day);assertEquals(time,saved.asOf);assertEquals(5,saved.alerts.size());
  for(int i=0;i<5;i++){assertEquals(list.get(i).id,saved.alerts.get(i).id);assertEquals(list.get(i).magnitude,saved.alerts.get(i).magnitude,0);}
  assertEquals(30000,BannerTimeline.summaryDuration(saved.alerts.size()));
 }
 @Test public void invalidAndOversizedRecordsCannotCreateUnboundedReplay() throws Exception {
  try{SummaryRecord.decode(" ".repeat(64001));fail();}catch(JSONException expected){}
  try{SummaryRecord.decode("{\"day\":\"2026-10-25\",\"asOf\":1,\"alerts\":[]}");fail();}catch(JSONException expected){}
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0);
  try{SummaryRecord.encode(Collections.nCopies(6,q),"2026-10-25",1);fail();}catch(JSONException expected){}
 }
}

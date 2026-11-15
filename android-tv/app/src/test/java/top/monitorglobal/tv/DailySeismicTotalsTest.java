package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
import java.util.*;
public class DailySeismicTotalsTest {
 @Test public void equalTelegramPhotoCountsSurviveOfflineReplay()throws Exception{
  DailySeismicTotals stats=new DailySeismicTotals("2026-11-14",190,0,2,15,173,false);
  Alert quake=new Alert("quake","earthquake","v","M5,5 · Atlântico","USGS","earthquake",1800000000000L,1800000000000L,true);
  quake.magnitude=5.5;quake.depth=10;quake.source="USGS";
  String record=SummaryRecord.encode(List.of(quake),"2026-11-14",1800000000000L,true,stats);
  FeedClient.Snapshot saved=SummaryRecord.decode(record);
  assertTrue(saved.complete);assertNotNull(saved.dailyTotals);
  assertArrayEquals(new int[]{190,0,2,15,173},saved.dailyTotals.values());
  assertEquals("2026-11-14",saved.dailyTotals.day);
  assertTrue(saved.dailyTotals.accessibilityText().contains("190 eventos"));
  assertEquals("2026-11-14",saved.day);
 }
 @Test public void olderSummariesRemainReadableAndInvalidCountsNeverProduceZeros()throws Exception{
  Alert a=DemoAlerts.create("quake",1800000000000L).get(0);
  String legacy=SummaryRecord.encode(List.of(a),"2026-11-14",1800000000000L,true);
  assertNull(SummaryRecord.decode(legacy).dailyTotals);
  JSONObject corrupt=new JSONObject(legacy);
  corrupt.put("dailyTotals",new JSONObject().put("day","2026-11-14").put("total",190).put("m6",0).put("m5",2).put("m4",15).put("below4",5));
  assertNull(SummaryRecord.decode(corrupt.toString()).dailyTotals);
  assertNull(DailySeismicTotals.read(new DailySeismicTotals("2026-11-14",190,0,2,15,173,true).json(),"2026-11-14"));
  try{DailySeismicTotals.read(new DailySeismicTotals("2026-11-15",190,0,2,15,173,false).json(),"2026-11-14");fail("Out-of-day totals accepted");}
  catch(JSONException expected){}
 }
}

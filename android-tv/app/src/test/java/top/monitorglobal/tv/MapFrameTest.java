package top.monitorglobal.tv;
import org.junit.Test;import org.json.*;import static org.junit.Assert.*;import java.util.*;
public class MapFrameTest {
 @Test public void ordinaryEpicenterIsCenteredAndDateLineDoesNotMoveItToGreenwich(){
  MapFrame f=MapFrame.epicenter(179.8,-18);assertTrue(f.valid());assertEquals(155,f.x(179.8),.01);assertEquals(75,f.y(-18),.01);assertTrue(Math.abs(f.x(-179.9)-f.x(179.8))<25);
  assertFalse(MapFrame.located(Double.NaN,0));assertFalse(MapFrame.located(181,0));assertTrue(MapFrame.located(0,0));assertFalse(new MapFrame(0,0,0,1).valid());assertFalse(new MapFrame(0,1,1000,1001).valid());
 }
 @Test public void polarFramesKeepOriginOnMapAndLatitudeFinite(){for(double latitude:new double[]{-90,-85,0,85,90}){MapFrame f=MapFrame.epicenter(12,latitude);assertTrue(f.valid());assertTrue(f.south>=-90&&f.north<=90);assertTrue(f.y(latitude)>=0&&f.y(latitude)<=150);}}
 @Test public void savedReplayPreservesMapAndRejectsOversizedOptionalPayload() throws Exception {
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0);q.companion.mapJson="{\"frame\":{\"minLon\":164,\"maxLon\":169,\"minLat\":-17,\"maxLat\":-13},\"lines\":[]}";
  Alert restored=AlertCodec.read(new JSONObject(AlertCodec.write(q).toString()));assertEquals(165.55,restored.originLongitude,0);assertEquals(164,new JSONObject(restored.companion.mapJson).getJSONObject("frame").getInt("minLon"));assertEquals(0,new JSONObject(restored.companion.mapJson).getJSONArray("lines").length());
  JSONObject stored=AlertCodec.write(q);stored.put("map",new JSONObject().put("oversized","x".repeat(16001)));assertEquals("",AlertCodec.read(stored).mapJson);
 }
 @Test public void oldSavedReplayRecoversCatalogCoordinatesWithoutGuessing() throws Exception {
  Alert a=new Alert("old","earthquake","[6.9,10,165.55,-14.06,1800000000000]","M6,9 · Vanuatu","","earthquake",1800000000000L,1800000000000L,true);
  Alert restored=AlertCodec.read(AlertCodec.write(a));assertEquals(165.55,restored.originLongitude,0);assertEquals(-14.06,restored.originLatitude,0);
  JSONObject bad=AlertCodec.write(a);bad.put("version","[6.9,10,null,null]");assertTrue(Double.isNaN(AlertCodec.read(bad).originLongitude));
 }
 @Test public void offlineSummaryKeepsFiveDifferentEpicentersAndOriginalDurations() throws Exception {
  List<Alert> alerts=new ArrayList<>();for(int i=0;i<5;i++){Alert a=DemoAlerts.create("quake",1800000000000L).get(0).copy();a.originLongitude=165+i;a.originLatitude=-14-i;alerts.add(a);}
  FeedClient.Snapshot restored=SummaryRecord.decode(SummaryRecord.encode(alerts,"2026-10-26",1800000000000L,true));
  for(int i=0;i<5;i++)assertEquals(165+i,restored.alerts.get(i).originLongitude,0);
  assertEquals(6000,BannerTimeline.SUMMARY_PAGE_MS);assertEquals(34000,BannerTimeline.summaryContentDuration(5,true)+2*BannerTimeline.WIPE_MS);
 }
}

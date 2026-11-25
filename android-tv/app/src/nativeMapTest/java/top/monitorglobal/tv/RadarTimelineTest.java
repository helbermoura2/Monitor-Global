package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.json.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class RadarTimelineTest {
 private static final long NOW=Instant.parse("2026-11-25T22:45:00Z").toEpochMilli();
 @Test public void actualTimesSortedDeduplicatedAndBounded(){
  RadarTimeline t=new RadarTimeline();
  long a=NOW-42*60000L,b=NOW-27*60000L,c=NOW-12*60000L;
  t.set(Arrays.asList(c,a,b,a,NOW+1,NOW-181*60000L),NOW);
  assertEquals(3,t.size());assertEquals(c,t.current());
  assertEquals(a,t.oldest());assertEquals(a,t.previous());
  assertEquals(b,t.next());assertEquals(c,t.next());assertTrue(t.atEnd());assertEquals(c,t.next());
  assertEquals(b,t.previous());assertEquals(c,t.newest());
  assertFalse(t.select(a+60000L));assertTrue(t.select(a));assertEquals(a,t.current());
  t.clear();assertEquals(0,t.current());
 }
 @Test public void catalogGroupsSameTimeAndRejectsMismatchedAssets()throws Exception{
  JSONArray features=new JSONArray();
  long a=NOW-35*60000L,b=NOW-25*60000L;
  features.put(item(b,"saoroque",b));features.put(item(a,"picocouto",a));features.put(item(a,"saoroque",a));features.put(item(b,"picocouto",a));
  features.put(item(NOW+60000L,"saoroque",NOW+60000L));features.put(item(a,"unknown",a));
  NavigableMap<Long,List<RadarMapClient.Item>> h=RadarMapClient.parseHistory(new JSONObject().put("features",features).toString(),NOW);
  assertEquals(Arrays.asList(a,b),new ArrayList<>(h.keySet()));
  assertEquals(2,h.get(a).size());assertEquals(1,h.get(b).size());
  for(List<RadarMapClient.Item> group:h.values())for(RadarMapClient.Item i:group)assertEquals(group.get(0).at,i.at);
 }
 @Test public void regionalUnknownDoesNotBecomeZeroRain(){
  RadarMapClient.Frame empty=new RadarMapClient.Frame(NOW-60000L,Collections.singletonList("São Roque"),Collections.emptyList());
  String result=RadarRegion.describe(empty,RadarRegion.POINTS[1],NOW);
  assertTrue(result.contains("Liberdade"));assertTrue(result.contains("Refletividade indisponível"));
  assertTrue(result.contains("mm/h indisponível"));assertTrue(result.contains("INPE / DECEA"));assertTrue(result.contains("há 1 min"));
  assertTrue(RadarRegion.describe(null,RadarRegion.POINTS[0],NOW).contains("Radar indisponível"));
 }
 private JSONObject item(long at,String radar,long fileAt)throws Exception{
  String stamp=DateTimeFormatter.ofPattern("uuuuMMddHHmm",Locale.ROOT).withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(fileAt));
  String url="https://data.inpe.br/bdc/data/br-weather-radar-cappi/decea/"+radar+"/cappi/cappi3km_nc/"+stamp.substring(0,4)+"/"+stamp.substring(4,6)+"/cappi3km_"+stamp+".nc";
  return new JSONObject().put("collection",RadarMapClient.COLLECTION).put("properties",new JSONObject().put("radar",radar).put("owner","decea").put("datetime",Instant.ofEpochMilli(at).toString())).put("assets",new JSONObject().put("cappi3km",new JSONObject().put("href",url)));
 }
}

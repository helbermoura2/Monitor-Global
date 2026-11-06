package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import java.time.*;import java.util.*;
public class RealEarthPlanTest {
 long now=Instant.parse("2026-11-06T01:07:00Z").toEpochMilli();
 String metadata(String id,String times){return "[{\"id\":\""+id+"\",\"times\":"+times+"}]";}
 @Test public void onlyTheExactProductAndItsAdvertisedRecentTimesAreAccepted(){
  String values="[\"20261106.005021\",\"20261106.004021\",\"20261106.005021\",\"20261106.020021\",\"20261105.220021\",\"20260230.000021\"]";
  List<Long> times=RealEarthPlan.frames(metadata(RealEarthPlan.PRODUCT,values),now);assertEquals(2,times.size());assertEquals(Instant.parse("2026-11-06T00:50:21Z").toEpochMilli(),(long)times.get(1));assertTrue(RealEarthPlan.frames(metadata("G18-ABI-FD-BAND13-GRAD",values),now).isEmpty());assertTrue(RealEarthPlan.frames("<error/>",now).isEmpty());
 }
 @Test public void imageRequestsAnExactTimeAndTheExistingMercatorRectangle(){
  String url=RealEarthPlan.image(InfraredPlan.SOUTHEAST,Instant.parse("2026-11-06T00:50:21Z").toEpochMilli());assertTrue(url.contains("G19-ABI-FD-BAND13-GRAD_20261106_005021"));assertTrue(url.contains("bounds=-27.000000,-54.000000,-17.000000,-38.000000"));assertTrue(url.contains("width=1024"));assertTrue(url.contains("height="+InfraredPlan.SOUTHEAST.height));assertFalse(url.contains("time=latest"));
 }
}

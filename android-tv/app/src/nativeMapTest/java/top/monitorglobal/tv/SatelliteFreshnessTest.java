package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.io.*;import java.nio.charset.*;import java.time.*;import java.time.format.*;import java.util.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class SatelliteFreshnessTest {
 Context context;long now,nasaAt,realAt;
 @Before public void setup(){context=RuntimeEnvironment.getApplication();now=org.robolectric.shadows.ShadowSystem.currentTimeMillis();nasaAt=now/600000*600000-2400000;realAt=nasaAt+1221000;}
 byte[] bytes(String s){return s.getBytes(StandardCharsets.UTF_8);}
 byte[] png(int w,int h,int color){Bitmap b=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);b.eraseColor(color);ByteArrayOutputStream o=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,o);b.recycle();return o.toByteArray();}
 String real(){String t=DateTimeFormatter.ofPattern("uuuuMMdd.HHmmss",Locale.ROOT).withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(realAt));return "[{\"id\":\""+RealEarthPlan.PRODUCT+"\",\"times\":[\""+t+"\"]}]";}
 WeatherSatelliteClient client(boolean missingRealMetadata,boolean emptyReal,boolean nasaNewer){
  byte[] image=png(InfraredPlan.WIDTH,InfraredPlan.SOUTHEAST.height,0xff050505),empty=png(InfraredPlan.WIDTH,InfraredPlan.SOUTHEAST.height,Color.TRANSPARENT);
  return new WeatherSatelliteClient(context,(url,limit,deadline)->{
   if(url.equals(RealEarthPlan.METADATA)){if(missingRealMetadata)throw new IOException("Temporary source outage");return bytes(real());}
   if(url.contains("DescribeDomains"))return bytes("<Domains><Domain>"+InfraredPlan.iso(nasaNewer?realAt+600000:nasaAt)+"</Domain></Domains>");
   if(url.equals(RealEarthPlan.LEGEND))return png(320,49,Color.WHITE);if(url.equals(InfraredPlan.LEGEND))return png(420,95,Color.WHITE);
   return emptyReal&&url.startsWith(RealEarthPlan.ROOT)?empty:image;
  });
 }
 @Test public void freshestSourceWinsAndItsPixelsWatermarkAreaLegendAndHistoryStayTogether()throws Exception{
  WeatherSatelliteClient c=client(false,false,false);try{WeatherSatelliteClient.Frame f=c.latest(InfraredPlan.SOUTHEAST,now);assertNotNull(f);assertEquals(realAt,f.at);assertEquals(WeatherSatelliteClient.Source.REALEARTH,f.source);assertEquals(0xff050505,f.image.getPixel(0,f.image.getHeight()-1));assertEquals(0xff050505,f.image.getPixel((int)InfraredPlan.SOUTHEAST.x(-50),(int)InfraredPlan.SOUTHEAST.y(-20)));assertEquals(320,f.legend.getWidth());assertEquals(Collections.singletonList(realAt),f.times);assertTrue(f.credit().contains("SSEC"));f.close();assertTrue(c.cacheBytes()<=4194304);}finally{c.close();}assertEquals(0,c.cacheBytes());
 }
 @Test public void unavailableMetadataOrAnEmptyNewerImageFallsBackToAnActualNasaFrame()throws Exception{
  for(boolean missingMetadata:new boolean[]{true,false}){WeatherSatelliteClient c=client(missingMetadata,true,false);try{WeatherSatelliteClient.Frame f=c.latest(InfraredPlan.SOUTHEAST,now);assertNotNull(f);assertEquals(nasaAt,f.at);assertEquals(WeatherSatelliteClient.Source.NASA,f.source);assertEquals(420,f.legend.getWidth());assertFalse(f.times.contains(realAt));f.close();}finally{c.close();}}
 }
 @Test public void nasaIsStillPreferredWhenItHasTheNewerActualFrame()throws Exception{
  WeatherSatelliteClient c=client(false,false,true);try{WeatherSatelliteClient.Frame f=c.latest(InfraredPlan.SOUTHEAST,now);assertNotNull(f);assertEquals(realAt+600000,f.at);assertEquals(WeatherSatelliteClient.Source.NASA,f.source);f.close();}finally{c.close();}
 }
}

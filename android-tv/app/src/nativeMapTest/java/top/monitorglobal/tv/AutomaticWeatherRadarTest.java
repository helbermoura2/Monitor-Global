package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.nio.file.*;
import java.util.*;
import java.time.Instant;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w960dp-h540dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class AutomaticWeatherRadarTest {
 @Test public void realCatalogAndRadarRenderAreNotLabelledSatellite()throws Exception{
  String catalog=System.getenv("ARGOS_AUTO_RADAR_CATALOG"),file=System.getenv("ARGOS_AUTO_RADAR_FILE");
  if("1".equals(System.getenv("ARGOS_REQUIRE_AUTO_RADAR"))){assertNotNull(catalog);assertNotNull(file);}
  org.junit.Assume.assumeTrue(catalog!=null&&file!=null);
  long at=Instant.parse("2026-11-25T22:10:00Z").toEpochMilli(),now=at+28*60000L;
  String json=new String(Files.readAllBytes(Paths.get(catalog)),java.nio.charset.StandardCharsets.UTF_8);
  NavigableMap<Long,List<RadarMapClient.Item>> parsed=RadarMapClient.parseHistory(json,now);
  assertFalse("Real INPE catalog must be usable by Android parser",parsed.isEmpty());
  assertTrue("Known observation must be found",parsed.containsKey(at));
  RadarCappi grid=RadarCappi.decode(Files.readAllBytes(Paths.get(file)));
  RadarMapClient.Frame observed=new RadarMapClient.Frame(at,Collections.singletonList("Pico do Couto"),Collections.singletonList(grid));
  Context c=RuntimeEnvironment.getApplication();WeatherSatelliteClient client=new WeatherSatelliteClient(c);
  WeatherSatelliteClient.Frame f=null;
  try{
   Bitmap b=RadarMapRender.render(c,client,WeatherSatelliteSequence.RADAR_REGION,observed);
   f=WeatherSatelliteClient.Frame.radar(b,observed,WeatherSatelliteSequence.RADAR_REGION);
   assertTrue(f.isRadar());assertTrue(f.credit().contains("Pico do Couto"));assertTrue(f.validAt(now));assertFalse(f.validAt(at+61*60000L));assertFalse(f.validAt(at-1));
   TvBroadcastInfoView v=TvBroadcastInfoView.satellite(c,f,"");
   assertTrue(v.getContentDescription().toString().contains("RADAR OBSERVADO"));assertTrue(v.getContentDescription().toString().contains("dBZ"));assertFalse(v.getContentDescription().toString().contains("GOES-EAST"));
   v.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(306,View.MeasureSpec.EXACTLY));v.layout(0,0,960,306);
   v.startPresentation(Math.max(1,android.os.SystemClock.uptimeMillis()),false);
   Bitmap out=Bitmap.createBitmap(960,306,Bitmap.Config.ARGB_8888);
   try{v.draw(new Canvas(out));try(java.io.FileOutputStream o=new java.io.FileOutputStream("/tmp/argos-weather-layout-automatic-radar.png")){assertTrue(out.compress(Bitmap.CompressFormat.PNG,100,o));}}finally{out.recycle();}
  }finally{if(f!=null)f.close();client.close();}
 }
 @Test public void infraredFallbackRetainsSeparateIdentity(){
  long now=System.currentTimeMillis();Bitmap b=Bitmap.createBitmap(32,32,Bitmap.Config.ARGB_8888);
  WeatherSatelliteClient.Frame f=new WeatherSatelliteClient.Frame(b,null,now-20*60000L,InfraredPlan.SOUTHEAST,Collections.emptyList(),WeatherSatelliteClient.Source.REALEARTH);
  try{assertFalse(f.isRadar());assertTrue(f.validAt(now));assertTrue(f.credit().contains("NOAA"));TvBroadcastInfoView v=TvBroadcastInfoView.satellite(RuntimeEnvironment.getApplication(),f,"");assertTrue(v.getContentDescription().toString().contains("GOES-EAST"));assertFalse(v.getContentDescription().toString().contains("RADAR OBSERVADO"));}finally{f.close();}
 }
}

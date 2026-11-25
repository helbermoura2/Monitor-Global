package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.Bitmap;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.nio.file.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RadarMapRenderTest {
 @Test public void realRadarDrawsGeographicOverlayAndMarksUnknownCells()throws Exception{
  String fixture=System.getenv("ARGOS_CAPPI_TEST_FILE");
  org.junit.Assume.assumeTrue("Real fixture supplied by targeted workflow",fixture!=null);
  RadarCappi grid=RadarCappi.decode(Files.readAllBytes(Path.of(fixture)));
  Context c=RuntimeEnvironment.getApplication();
  RadarMapClient.Frame frame=new RadarMapClient.Frame(1L,Collections.singletonList("Pico do Couto"),Collections.singletonList(grid));
  WeatherSatelliteClient geography=new WeatherSatelliteClient(c);
  Bitmap bitmap=null;
  try{
   bitmap=RadarMapRender.render(c,geography,InfraredPlan.SOUTHEAST,frame);
   assertEquals(1024,bitmap.getWidth());
   assertEquals(InfraredPlan.SOUTHEAST.height,bitmap.getHeight());
   assertTrue(Float.isNaN(frame.sample(-19,-50)));
   assertNotEquals(RadarMapRender.color(Float.NaN,0,0),RadarMapRender.color(0,0,0));
   assertNotEquals(RadarMapRender.color(20,0,0),RadarMapRender.color(50,0,0));
   int colored=0;for(int y=0;y<bitmap.getHeight();y+=2)for(int x=0;x<bitmap.getWidth();x+=2){
    int rgb=bitmap.getPixel(x,y);int r=(rgb>>16)&255,g=(rgb>>8)&255,b=rgb&255;
    if(Math.max(r,Math.max(g,b))-Math.min(r,Math.min(g,b))>65)colored++;
   }
   assertTrue("Actual observed radar echoes visible",colored>50);
  }finally{if(bitmap!=null)bitmap.recycle();geography.close();}
 }
 @Test public void onlyApprovedProviderAndObservationTimes(){
  assertTrue(RadarMapClient.allowedAsset("https://data.inpe.br/bdc/data/br-weather-radar-cappi/decea/saoroque/cappi/cappi3km_nc/2026/11/cappi3km_202611252200.nc","saoroque"));
  assertFalse(RadarMapClient.allowedAsset("https://example.org/cappi.nc","saoroque"));
  assertFalse(RadarMapClient.allowedAsset("https://data.inpe.br/bdc/data/br-weather-radar-cappi/decea/saoroque/cappi/cappi3km_nc/2026/11/cappi3km_202611252200.nc","picocouto"));
 }
}

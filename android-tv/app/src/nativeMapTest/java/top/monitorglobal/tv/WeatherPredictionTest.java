package top.monitorglobal.tv;

import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import android.graphics.Bitmap;
import java.nio.file.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class WeatherPredictionTest {
 @Test public void correctMetricScaleAndDirection(){
  InfraredPlan.Scope scope=InfraredPlan.SOUTHEAST;
  double east=SatelliteMotion.kmPerSampleX(scope,1024/4);
  double north=SatelliteMotion.kmPerSampleY(scope,scope.height/4);
  assertTrue(east>6&&east<7);
  assertEquals(east,north,0.15);
  Bitmap a=Bitmap.createBitmap(1024,scope.height,Bitmap.Config.ARGB_8888);
  Bitmap b=Bitmap.createBitmap(1024,scope.height,Bitmap.Config.ARGB_8888);
  try{
   Random random=new Random(42);int w=1024,h=scope.height;int[] pixels=new int[w*h],shifted=new int[w*h];
   for(int i=0;i<pixels.length;i++){int g=random.nextInt(256);pixels[i]=0xff000000|g*0x010101;}
   for(int y=0;y<h;y++)for(int x=8;x<w;x++)shifted[y*w+x]=pixels[y*w+x-8];
   a.setPixels(pixels,0,w,0,0,w,h);b.setPixels(shifted,0,w,0,0,w,h);
   SatelliteMotion.Result result=SatelliteMotion.analyze(a,b,1800000000000L,1800001800000L,scope);
   assertNotNull(result);assertEquals("L",result.direction);assertEquals(east*4,result.speedKmh,0.2);
  }finally{a.recycle();b.recycle();}
 }
 @Test public void radarPredictionHasLimitedHorizonAndRejectsPast(){
  long now=1800000000000L;
  RadarNowcast.Motion m=new RadarNowcast.Motion(3,-3,6,now-40*60000L,now-30*60000L);
  assertFalse(m.usable(20,now));assertFalse(m.usable(30,now));assertTrue(m.usable(45,now));assertFalse(m.usable(61,now));
  assertTrue(Float.isNaN(RadarNowcast.extrapolate(null,m,100,100,45,now)));
  assertNull(RadarNowcast.estimate(null,null,now-600000,now));
 }
 @Test public void realForecastResponseHasCorrectCoordinatesUnitsAndHorizon()throws Exception{
  String file=System.getenv("ARGOS_FORECAST_FIXTURE");
  assertNotNull("Live forecast fixture required",file);
  long fetched=Long.parseLong(System.getenv("ARGOS_FORECAST_TIME"));
  RegionalForecast.Data f=RegionalForecast.parse(new String(Files.readAllBytes(Paths.get(file)),java.nio.charset.StandardCharsets.UTF_8),fetched);
  assertEquals(9,f.points.size());assertTrue(f.attribution().contains("rodada não informada"));
  for(RegionalForecast.Point p:f.points)for(int h=1;h<=6;h++){
   assertTrue("Actual forecast sample missing at hour "+h,Double.isFinite(p.value(f.end(h))));
   assertTrue(p.value(f.end(h))>=0);
  }
 }
}

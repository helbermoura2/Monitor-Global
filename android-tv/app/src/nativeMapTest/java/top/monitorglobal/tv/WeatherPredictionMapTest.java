package top.monitorglobal.tv;

import android.graphics.Bitmap;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.nio.file.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherPredictionMapTest {
 private RadarCappi read(String env)throws Exception{
  String file=System.getenv(env);assertNotNull(env,file);return RadarCappi.decode(Files.readAllBytes(Paths.get(file)));
 }
 @Test public void knownTranslationAndRealRadarPair()throws Exception{
  long now=1800000000000L,a=now-20*60000L,b=now-10*60000L;
  RadarCappi old=read("ARGOS_SHIFT_OLD"),latest=read("ARGOS_SHIFT_NEW");
  RadarNowcast.Motion m=RadarNowcast.estimate(old,latest,a,b);
  assertNotNull("Known translated test fixture",m);assertEquals(6,m.dx);assertEquals(-3,m.dy);
  assertEquals(latest.at(159,132),RadarNowcast.extrapolate(latest,m,150,150,30,now),0.0001f);
  assertTrue(Float.isNaN(RadarNowcast.extrapolate(latest,m,0,0,30,now)));
  RadarCappi realOld=read("ARGOS_REAL_OLD"),realNew=read("ARGOS_REAL_NEW");
  RadarMapClient.Frame r1=new RadarMapClient.Frame(a,Collections.singletonList("Pico do Couto"),Collections.singletonList(realOld));
  RadarMapClient.Frame r2=new RadarMapClient.Frame(b,Collections.singletonList("Pico do Couto"),Collections.singletonList(realNew));
  List<WeatherPredictionMap.Echo> result=WeatherPredictionMap.derive(r1,r2);
  if(!result.isEmpty()){
   assertTrue(result.get(0).motion.matched>=4);
   assertTrue(Float.isNaN(WeatherPredictionMap.sample(result,90,180,30,now)));
   assertTrue(Float.isNaN(WeatherPredictionMap.sample(result,-22,-43,30,b+31*60000L)));
  }
  System.out.println("REAL_PAIR "+(result.isEmpty()?"no coherent estimate; unavailable as designed":"coherent estimate with "+result.get(0).motion.matched+" blocks"));
  RadarMapClient.Frame other=new RadarMapClient.Frame(b,Collections.singletonList("São Roque"),Collections.singletonList(realNew));
  assertTrue(WeatherPredictionMap.derive(r1,other).isEmpty());
 }
 @Test public void forecastDrawsOnlyPublishedPointSamples()throws Exception{
  long fetched=Long.parseLong(System.getenv("ARGOS_FORECAST_TIME"));
  RegionalForecast.Data data=RegionalForecast.parse(new String(Files.readAllBytes(Paths.get(System.getenv("ARGOS_FORECAST_FIXTURE"))),java.nio.charset.StandardCharsets.UTF_8),fetched);
  WeatherSatelliteClient geo=new WeatherSatelliteClient(RuntimeEnvironment.getApplication());
  Bitmap bitmap=null;
  try{
   bitmap=WeatherPredictionMap.numerical(geo,InfraredPlan.SOUTHEAST,data,6);
   assertEquals(1024,bitmap.getWidth());assertEquals(InfraredPlan.SOUTHEAST.height,bitmap.getHeight());
   for(RegionalForecast.Point p:data.points){int x=Math.round(InfraredPlan.SOUTHEAST.x(p.lon)),y=Math.round(InfraredPlan.SOUTHEAST.y(p.lat));assertNotEquals(0xff101719,bitmap.getPixel(x,y));}
  }finally{if(bitmap!=null)bitmap.recycle();geo.close();}
 }
}

package top.monitorglobal.tv;
import android.content.*;import android.os.*;import org.json.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.util.concurrent.*;import java.util.concurrent.atomic.*;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RainMonitorTest {
 private Object value(Object target,String name)throws Exception{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private JSONObject sample()throws Exception{long now=System.currentTimeMillis(),start=now/60000*60000;JSONArray p=new JSONArray();for(int i=0;i<120;i++)p.put(new JSONObject().put("start",start+i*60000).put("end",start+(i+1)*60000).put("rate",8).put("type","rain"));return new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("forecast",p);}
 @Test public void slowWeatherIoNeverBlocksMainAndHigherPriorityContentPreventsTheOverlay()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("weatherHourly",false).putInt("rainMode",2).commit();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);Shadows.shadowOf((PowerManager)c.getSystemService(Context.POWER_SERVICE)).setIsInteractive(true);
  CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean allowed=new AtomicBoolean(false);JSONObject data=sample();RainMonitor monitor=new RainMonitor(c,allowed::get,()->{entered.countDown();release.await(5,TimeUnit.SECONDS);return data;});
  try{monitor.tick();assertTrue(entered.await(2,TimeUnit.SECONDS));AtomicBoolean mainWorks=new AtomicBoolean();new Handler(Looper.getMainLooper()).post(()->mainWorks.set(true));Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(mainWorks.get());assertNull(value(value(monitor,"overlay"),"current"));release.countDown();long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);while((Boolean)value(monitor,"busy")&&System.nanoTime()<deadline){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}assertFalse((Boolean)value(monitor,"busy"));assertNull(value(value(monitor,"overlay"),"current"));assertEquals("",Prefs.get(c).getString("rainLastKey",""));allowed.set(true);monitor.tick();assertNotNull(value(value(monitor,"overlay"),"current"));assertEquals("",Prefs.get(c).getString("rainLastKey",""));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(13));assertEquals("now:forte",Prefs.get(c).getString("rainLastKey",""));monitor.hide();assertNull(value(value(monitor,"overlay"),"current"));monitor.tick();assertNull(value(value(monitor,"overlay"),"current"));}finally{release.countDown();monitor.close();}ExecutorService executor=(ExecutorService)value(monitor,"worker");assertTrue(executor.awaitTermination(5,TimeUnit.SECONDS));assertNull(value(value(monitor,"overlay"),"current"));
 }
 @Test public void disabledWeatherDoesNotStartARequestOrWorker()throws Exception{Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("weatherHourly",false).putInt("rainMode",0).commit();AtomicInteger calls=new AtomicInteger();RainMonitor monitor=new RainMonitor(c,()->true,()->{calls.incrementAndGet();return sample();});try{monitor.tick();assertEquals(0,calls.get());assertNull(value(monitor,"worker"));}finally{monitor.close();}}

 @Test public void rainNoticeDoesNotGetConsumedBySimultaneousHourlyWeather()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("weatherHourly",true).putBoolean("weatherSatellite",false).putInt("rainMode",1).commit();
  org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);Shadows.shadowOf((PowerManager)c.getSystemService(Context.POWER_SERVICE)).setIsInteractive(true);
  long now=System.currentTimeMillis(),start=now/3600000*3600000;
  JSONObject weather=new JSONObject().put("version","tv-weather-v1").put("area","liberdade").put("ok",true).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("at",now).put("generatedAt",now).put("expiresAt",Math.min(now+3600000,start+3600000)).put("current",new JSONObject().put("start",start).put("temperature",22).put("feels",23).put("condition","Cloudy"));
  RainMonitor monitor=new RainMonitor(c,()->true,this::sample,()->weather);
  try{
   monitor.tick();for(int n=0;n<1000&&((Boolean)value(monitor,"busy")||(Boolean)value(monitor,"weatherBusy"));n++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}
   android.view.ViewGroup host=(android.view.ViewGroup)value(value(monitor,"overlay"),"current");assertNotNull(host);
   assertEquals(TvBroadcastInfoView.RAIN,((Integer)value(host.getChildAt(0),"kind")).intValue());
   assertEquals(0,Prefs.get(c).getLong("weatherLastNotice",0));assertEquals("",Prefs.get(c).getString("rainLastKey",""));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(RainOverlay.DURATION+1000));
   assertEquals("now:forte",Prefs.get(c).getString("rainLastKey",""));
  }finally{monitor.close();}
 }
}

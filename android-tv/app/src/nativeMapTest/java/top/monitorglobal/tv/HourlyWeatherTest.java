package top.monitorglobal.tv;
import android.content.*;import android.os.*;import android.graphics.*;import android.view.*;import org.json.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.util.concurrent.*;import java.util.concurrent.atomic.*;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi",instrumentedPackages={"top.monitorglobal.tv"}) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class HourlyWeatherTest {
 // App wall time is instrumented; the non-instrumented test reads that same shadow clock explicitly.
 Context c;private Object field(Object o,String n)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(n);f.setAccessible(true);return f.get(o);}
 @Before public void setup(){long now=org.robolectric.shadows.ShadowSystem.currentTimeMillis();long start=java.time.Instant.parse("2026-11-01T12:05:00Z").toEpochMilli();org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(start-now));c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putInt("rainMode",0).putBoolean("weatherSatellite",false).putBoolean("weatherHourly",true).commit();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);Shadows.shadowOf((PowerManager)c.getSystemService(Context.POWER_SERVICE)).setIsInteractive(true);}
 JSONObject weather()throws Exception{long now=org.robolectric.shadows.ShadowSystem.currentTimeMillis(),start=now/3600000*3600000;return new JSONObject().put("version","tv-weather-v1").put("area","liberdade").put("ok",true).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("at",now).put("generatedAt",now).put("expiresAt",Math.min(now+3600000,start+3600000)).put("current",new JSONObject().put("start",start).put("temperature",22).put("feels",23).put("humidity",81).put("wind",12).put("gust",19).put("condition","Cloudy"));}
 void ready(RainMonitor m)throws Exception{int attempts=0;do{Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}while(((Boolean)field(m,"busy")||(Boolean)field(m,"weatherBusy"))&&++attempts<1000);assertFalse((Boolean)field(m,"busy"));assertFalse((Boolean)field(m,"weatherBusy"));}
 @Test public void hourlyCardIsIndependentOfRainModeWaitsForPriorityAndDoesNotRepeatEveryMinute()throws Exception{
  AtomicBoolean allowed=new AtomicBoolean(false);AtomicInteger hourlyCalls=new AtomicInteger();RainMonitor m=new RainMonitor(c,allowed::get,()->new JSONObject(),()->{hourlyCalls.incrementAndGet();return weather();});
  try{m.tick();ready(m);assertNull(field(field(m,"overlay"),"current"));assertEquals(0,Prefs.get(c).getLong("weatherLastNotice",0));allowed.set(true);m.tick();View host=(View)field(field(m,"overlay"),"current");assertNotNull(host);assertTrue(Prefs.get(c).getLong("weatherLastNotice",0)>0);assertNull(field(field(m,"overlay"),"previewRain"));int width=((WindowManager.LayoutParams)host.getLayoutParams()).width;int height=((WindowManager.LayoutParams)host.getLayoutParams()).height;host.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));host.layout(0,0,width,height);host.setAlpha(1);((ViewGroup)host).getChildAt(0).setTranslationY(0);assertTrue(host.getHeight()<700);Bitmap b=Bitmap.createBitmap(width,host.getHeight(),Bitmap.Config.ARGB_8888);host.draw(new Canvas(b));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-hourly-weather.png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}b.recycle();m.hide();m.tick();assertNull(field(field(m,"overlay"),"current"));assertEquals(1,hourlyCalls.get());m.close();m=new RainMonitor(c,allowed::get,()->new JSONObject(),this::weather);m.tick();ready(m);assertNull(field(field(m,"overlay"),"current"));long now=org.robolectric.shadows.ShadowSystem.currentTimeMillis();org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(WeatherForecast.delay(now)));m.tick();ready(m);assertNotNull(field(field(m,"overlay"),"current"));}finally{m.close();}
 }
 @Test public void midnightHasNoAutomaticCardUntilFivePast()throws Exception{
  long now=org.robolectric.shadows.ShadowSystem.currentTimeMillis();
  long midnight=java.time.Instant.ofEpochMilli(now).atZone(WeatherForecast.ZONE).toLocalDate().plusDays(1).atStartOfDay(WeatherForecast.ZONE).toInstant().toEpochMilli();
  org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(midnight-now));
  RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),this::weather);
  try{m.tick();ready(m);assertNull(field(field(m,"overlay"),"current"));assertEquals(0,Prefs.get(c).getLong("weatherLastNotice",0));
   org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMinutes(5));
   m.tick();ready(m);assertNotNull(field(field(m,"overlay"),"current"));
   assertEquals(midnight+5*60000,Prefs.get(c).getLong("weatherLastNotice",0));
  }finally{m.close();}
 }
 @Test public void manualWorksWithBothAutomaticModesOffAndDoesNotShiftHourlySchedule()throws Exception{Prefs.get(c).edit().putBoolean("weatherHourly",false).commit();AtomicInteger finished=new AtomicInteger();RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),this::weather);m.setManualFinished(finished::incrementAndGet);try{m.weatherNow();ready(m);assertTrue(m.manualPending());assertNull(field(field(m,"overlay"),"current"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(9999));assertNull(field(field(m,"overlay"),"current"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(1));ready(m);assertNotNull(field(field(m,"overlay"),"current"));assertEquals(0,Prefs.get(c).getLong("weatherLastNotice",0));assertTrue(m.manualPending());Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(RainOverlay.WEATHER_DURATION+1000));assertFalse(m.manualPending());assertEquals(1,finished.get());assertNull(field(field(m,"overlay"),"current"));}finally{m.close();}}
 @Test public void missingWeatherFinishesManualWithoutAnEmptyCardOrRainRequest()throws Exception{Prefs.get(c).edit().putBoolean("weatherHourly",false).commit();AtomicInteger rainCalls=new AtomicInteger(),finished=new AtomicInteger();RainMonitor m=new RainMonitor(c,()->true,()->{rainCalls.incrementAndGet();return new JSONObject();},()->new JSONObject());m.setManualFinished(finished::incrementAndGet);try{m.weatherNow();ready(m);assertTrue(m.manualPending());assertEquals(0,finished.get());Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));ready(m);assertNull(field(field(m,"overlay"),"current"));assertEquals(0,rainCalls.get());assertFalse(m.manualPending());assertEquals(1,finished.get());}finally{m.close();}}
 @Test public void repeatedClickRestartsDelayWithoutDuplicatingWeatherFetches()throws Exception{
  Prefs.get(c).edit().putBoolean("weatherHourly",false).commit();
  AtomicInteger calls=new AtomicInteger();RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),()->{calls.incrementAndGet();return weather();});
  try{m.weatherNow();ready(m);Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(5));
   m.weatherNow();ready(m);Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(9999));
   assertNull(field(field(m,"overlay"),"current"));assertEquals(1,calls.get());
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(1));ready(m);
   assertNotNull(field(field(m,"overlay"),"current"));assertEquals(1,calls.get());
  }finally{m.close();}
 }
 @Test public void manualDelayAlsoBlocksDueAutomaticCardAndStillWaitsForPriority()throws Exception{
  AtomicBoolean allowed=new AtomicBoolean(false);RainMonitor m=new RainMonitor(c,allowed::get,()->new JSONObject(),this::weather);
  try{m.weatherNow();ready(m);allowed.set(true);m.tick();assertNull(field(field(m,"overlay"),"current"));
   allowed.set(false);Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));ready(m);
   assertNull(field(field(m,"overlay"),"current"));assertTrue(m.manualPending());assertEquals(0,Prefs.get(c).getLong("weatherLastNotice",0));
   allowed.set(true);m.tick();assertNotNull(field(field(m,"overlay"),"current"));assertTrue(Prefs.get(c).getLong("weatherLastNotice",0)>0);
  }finally{m.close();}
 }
 @Test public void closingDuringCountdownCancelsPresentationAndFinishedCallback()throws Exception{
  Prefs.get(c).edit().putBoolean("weatherHourly",false).commit();AtomicInteger finished=new AtomicInteger();
  RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),this::weather);m.setManualFinished(finished::incrementAndGet);
  m.weatherNow();ready(m);m.close();assertFalse(m.manualPending());Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(30));
  assertNull(field(field(m,"overlay"),"current"));assertEquals(0,finished.get());
 }
 WeatherSatelliteClient.Frame satelliteFrame(){long now=org.robolectric.shadows.ShadowSystem.currentTimeMillis();return new WeatherSatelliteClient.Frame(Bitmap.createBitmap(512,InfraredPlan.SOUTHEAST.height,Bitmap.Config.ARGB_8888),null,now-1800000,InfraredPlan.SOUTHEAST,java.util.Collections.singletonList(now-1800000));}
 @Test public void manualWeatherAndSatelliteShareTheSamePresentation()throws Exception{
  Prefs.get(c).edit().putBoolean("weatherHourly",false).putBoolean("weatherSatellite",true).putInt("rainMode",0).commit();
  AtomicInteger loads=new AtomicInteger(),finished=new AtomicInteger();
  WeatherSatelliteSequence sequence=new WeatherSatelliteSequence(c,()->true,()->new WeatherSatelliteSequence.Loader(){public WeatherSatelliteClient.Frame load(){loads.incrementAndGet();return satelliteFrame();}public void close(){}});
  RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),this::weather,sequence);m.setManualFinished(finished::incrementAndGet);
  try{
   m.weatherNow();ready(m);for(int i=0;i<300&&sequence.currentFrame()==null;i++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}
   assertNotNull(sequence.currentFrame());assertEquals(1,loads.get());
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));ready(m);
   Object host=field(field(m,"overlay"),"current");assertNotNull(host);m.tick();
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(13));
   assertSame(host,field(field(m,"overlay"),"current"));assertNull("no second satellite banner",field(sequence,"current"));assertTrue(m.manualPending());
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(4));
   assertNull(field(field(m,"overlay"),"current"));assertFalse(m.manualPending());assertFalse(sequence.pending());assertEquals(1,finished.get());
  }finally{m.close();}
 }
 @Test public void slowSatelliteUpdatesExistingWeatherInsetWithoutSecondBanner()throws Exception{
  Prefs.get(c).edit().putBoolean("weatherHourly",false).putBoolean("weatherSatellite",true).putInt("rainMode",0).commit();
  CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger loads=new AtomicInteger();WeatherSatelliteClient.Frame image=satelliteFrame();
  WeatherSatelliteSequence sequence=new WeatherSatelliteSequence(c,()->true,()->new WeatherSatelliteSequence.Loader(){public WeatherSatelliteClient.Frame load()throws Exception{loads.incrementAndGet();entered.countDown();release.await(5,TimeUnit.SECONDS);return image;}public void close(){release.countDown();}});
  RainMonitor m=new RainMonitor(c,()->true,()->new JSONObject(),this::weather,sequence);
  try{
   m.weatherNow();assertTrue(entered.await(3,TimeUnit.SECONDS));ready(m);
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));ready(m);
   android.widget.FrameLayout host=(android.widget.FrameLayout)field(field(m,"overlay"),"current");assertNotNull(host);
   assertNull(sequence.currentFrame());assertNull(field(sequence,"current"));
   release.countDown();for(int i=0;i<300&&sequence.currentFrame()==null;i++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}
   assertSame(image,sequence.currentFrame());assertSame(host,field(field(m,"overlay"),"current"));
   java.util.function.Supplier<?> supplier=(java.util.function.Supplier<?>)field(host.getChildAt(0),"weatherSatellite");assertSame(image,supplier.get());
   assertEquals(1,loads.get());assertNull(field(sequence,"current"));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(RainOverlay.WEATHER_DURATION+1000));
   assertNull(field(field(m,"overlay"),"current"));assertTrue(image.image.isRecycled());assertFalse(m.manualPending());
  }finally{release.countDown();m.close();}
 }

}

package top.monitorglobal.tv;

import android.content.Context;
import android.os.Looper;
import android.os.PowerManager;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.shadows.ShadowSettings;
import org.robolectric.shadows.ShadowSystem;
import org.robolectric.shadows.ShadowSystemClock;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi",instrumentedPackages={"top.monitorglobal.tv"})
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherServicePulseTest {
 private Object field(Object target,String name)throws Exception{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private void set(Object target,String name,Object value)throws Exception{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);f.set(target,value);}
 private JSONObject forecast(long now)throws Exception{
  long start=now/60000*60000;JSONArray points=new JSONArray();
  for(int i=0;i<120;i++)points.put(new JSONObject().put("start",start+i*60000).put("end",start+(i+1)*60000).put("rate",i<2?0:3).put("type",i<2?"no_precipitation":"rain"));
  return new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("forecast",points);
 }
 @Test public void serviceAutomaticallyDetectsRainStartingBetweenHoursWithoutAnotherNetworkRead()throws Exception{
  long target=Instant.parse("2026-11-05T12:05:00Z").toEpochMilli();
  ShadowSystemClock.advanceBy(Duration.ofMillis(target-ShadowSystem.currentTimeMillis()));
  Context context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().putBoolean("enabled",true).putBoolean("dailyAuto",false).putBoolean("weatherHourly",false).putBoolean("weatherSatellite",false).putInt("rainMode",1).commit();
  ShadowSettings.setCanDrawOverlays(true);Shadows.shadowOf((PowerManager)context.getSystemService(Context.POWER_SERVICE)).setIsInteractive(true);
  ServiceController<MonitorService> controller=Robolectric.buildService(MonitorService.class).create();
  MonitorService service=controller.get();RainMonitor previous=(RainMonitor)field(service,"rain");
  BooleanSupplier allowed=(BooleanSupplier)field(previous,"allowed");previous.close();
  AtomicInteger reads=new AtomicInteger();JSONObject data=forecast(target);
  RainMonitor rain=new RainMonitor(service,allowed,()->{reads.incrementAndGet();return data;},JSONObject::new);set(service,"rain",rain);
  try{
   ((Runnable)field(service,"dailyTick")).run();
   for(int i=0;i<1000&&(Boolean)field(rain,"busy");i++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}
   assertFalse((Boolean)field(rain,"busy"));
   assertEquals("soon:",Prefs.get(context).getString("rainLastKey",""));
   long arrivalNotice=Prefs.get(context).getLong("rainLastNotice",0);assertTrue(arrivalNotice>0);
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(121));
   assertEquals("now:moderada",Prefs.get(context).getString("rainLastKey",""));
   assertTrue(Prefs.get(context).getLong("rainLastNotice",0)>arrivalNotice);
   assertNotNull(field(field(rain,"overlay"),"current"));
   assertEquals("the service evaluates the cached forecast, without additional source requests",1,reads.get());
   assertEquals(0,Prefs.get(context).getLong("weatherLastNotice",0));
  }finally{controller.destroy();}
 }
}

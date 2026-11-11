package top.monitorglobal.tv;
import android.content.Context;import android.os.*;import android.view.*;import android.widget.*;
import java.time.Duration;import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
/** The former lightning preview now demonstrates rain only. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class StormPreviewTest {
 private Object field(Object o,String key)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
 private String texts(View v){if(v instanceof TextView)return ((TextView)v).getText().toString();StringBuilder b=new StringBuilder();if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)b.append(texts(((ViewGroup)v).getChildAt(i))).append(" ");return b.toString();}
 @Before public void setup(){org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);}
 @Test public void demoRemainsLocalAndAutomaticallyCloses()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("weatherHourly",false).putInt("rainMode",0).commit();AtomicInteger calls=new AtomicInteger();
  RainMonitor monitor=new RainMonitor(c,()->true,()->{calls.incrementAndGet();return new JSONObject();},()->{calls.incrementAndGet();return new JSONObject();});
  try{monitor.demo(true);Object overlay=field(monitor,"overlay");assertNotNull(field(overlay,"previewRain"));assertEquals(0,calls.get());assertNull(field(monitor,"worker"));View host=(View)field(overlay,"current");assertTrue(((ViewGroup)host).getChildAt(0) instanceof TvBroadcastInfoView);assertTrue(String.valueOf(((ViewGroup)host).getChildAt(0).getContentDescription()).contains("SIMULAÇÃO"));assertEquals(1,((ViewGroup)host).getChildCount());assertNotNull(field(overlay,"effectHost"));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(14));assertNull(field(overlay,"current"));assertNull(field(overlay,"previewRain"));
  }finally{monitor.close();}
 }
 @Test public void actualRainUsesSourceIntensityAndCardOnlyRemainsAvailable()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().putInt("previewRainStyle",0).putInt("previewRainLevel",3).commit();
  RainForecast.Summary rain=new RainForecast.Summary("now","fraca","Chuva fraca",1,.5,"",System.currentTimeMillis(),System.currentTimeMillis()+600000,true);
  RainOverlay overlay=new RainOverlay(c);
  try{assertTrue(overlay.show(rain,true,false));Object effect=field(overlay,"previewRain");assertEquals(12,field(effect,"glassCount"));assertEquals(60,field(effect,"airCount"));View host=(View)field(overlay,"current");assertTrue(((WindowManager.LayoutParams)host.getLayoutParams()).width>0);assertEquals(1,((ViewGroup)host).getChildCount());assertNotNull(field(overlay,"effectHost"));
   assertTrue(overlay.show(rain,false,false));assertNull(field(overlay,"previewRain"));assertTrue(((WindowManager.LayoutParams)((View)field(overlay,"current")).getLayoutParams()).width>0);
  }finally{overlay.hide();}
 }
 @Test public void stormRequiresSourceConditionInsteadOfRainRate(){
  assertEquals(0,RainVisualPolicy.level(2.49,false));assertEquals(1,RainVisualPolicy.level(2.5,false));assertEquals(1,RainVisualPolicy.level(7.49,false));assertEquals(2,RainVisualPolicy.level(7.5,false));assertEquals(2,RainVisualPolicy.level(49.99,false));assertEquals(3,RainVisualPolicy.level(50,false));assertEquals(3,RainVisualPolicy.level(1,true));assertEquals(0,RainVisualPolicy.level(0,true));assertEquals(0,RainVisualPolicy.level(Double.NaN,true));
  assertFalse(WeatherForecast.storm("HeavyRain"));assertFalse(WeatherForecast.storm("Rain"));assertTrue(WeatherForecast.storm("Thunderstorms"));assertTrue(WeatherForecast.storm("StrongStorms"));assertTrue(WeatherForecast.storm("IsolatedThunderstorms"));assertTrue(WeatherForecast.storm("ScatteredThunderstorms"));
 }
}

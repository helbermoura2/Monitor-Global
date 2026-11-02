package top.monitorglobal.tv;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class StormPreviewTest {
 private Object field(Object target,String name)throws Exception{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private RainForecast.Summary rain(){return new RainForecast.Summary("now","forte","Chuva forte · exemplo fictício",8,4,"Simulação",System.currentTimeMillis(),System.currentTimeMillis()+600000,true);}
 private String texts(View view){if(view instanceof TextView)return ((TextView)view).getText().toString();StringBuilder out=new StringBuilder();if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)out.append(texts(((ViewGroup)view).getChildAt(i))).append(" ");return out.toString();}
 @Before public void permission(){org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);}
 @Test public void previewDrawsBoltsAndPreemptionReleasesAllFrames()throws Exception{
  RainOverlay overlay=new RainOverlay(RuntimeEnvironment.getApplication());
  try{
   assertTrue(overlay.show(rain(),true,true,null,true));View host=(View)field(overlay,"current");RainOverlay.Lightning lightning=(RainOverlay.Lightning)field(overlay,"lightning");assertNotNull(lightning);
   WindowManager.LayoutParams params=(WindowManager.LayoutParams)host.getLayoutParams();assertEquals(-1,params.width);assertEquals(-1,params.height);assertTrue((params.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);
   host.measure(View.MeasureSpec.makeMeasureSpec(1280,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(720,View.MeasureSpec.EXACTLY));host.layout(0,0,1280,720);
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1100));
   Bitmap b=Bitmap.createBitmap(1280,720,Bitmap.Config.ARGB_8888);lightning.draw(new Canvas(b));int bright=0;for(int y=0;y<260;y++)for(int x=0;x<800;x++){int c=b.getPixel(x,y);if(Color.alpha(c)>100&&Color.red(c)>120&&Color.blue(c)>200)bright++;}
   assertTrue("visible bolt outside the card",bright>40);assertTrue(texts(host).contains("PRÉVIA VISUAL FICTÍCIA"));assertTrue(texts(host).contains("NÃO É DETECÇÃO DE RAIOS"));b.recycle();
   overlay.hide();assertNull(field(overlay,"lightning"));assertFalse((Boolean)field(lightning,"running"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));assertNull(field(overlay,"current"));
  }finally{overlay.hide();}
 }
 @Test public void realWeatherCannotEnableTheUnapprovedEffect()throws Exception{
  RainOverlay overlay=new RainOverlay(RuntimeEnvironment.getApplication());
  try{assertTrue(overlay.show(rain(),true,false,null,true));assertNull(field(overlay,"lightning"));}finally{overlay.hide();}
 }
 @Test public void demoUsesOnlyLocalFixturesAndAutomaticallyCloses()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("weatherHourly",false).putInt("rainMode",0).commit();AtomicInteger calls=new AtomicInteger();
  RainMonitor monitor=new RainMonitor(c,()->true,()->{calls.incrementAndGet();return new JSONObject();},()->{calls.incrementAndGet();return new JSONObject();});
  try{monitor.demo(true);Object overlay=field(monitor,"overlay");assertNotNull(field(overlay,"lightning"));assertEquals(0,calls.get());assertNull(field(monitor,"worker"));assertTrue(texts((View)field(overlay,"current")).contains("Trovoadas · exemplo fictício"));
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(14));assertNull(field(overlay,"current"));assertNull(field(overlay,"lightning"));
  }finally{monitor.close();}
 }
 @Test public void disabledAnimationsKeepTheCardWithoutBoltsOrDrops()throws Exception{
  java.lang.reflect.Method scale=ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);scale.invoke(null,0f);
  RainOverlay overlay=new RainOverlay(RuntimeEnvironment.getApplication());
  try{assertTrue(overlay.show(rain(),true,true,null,true));assertNull(field(overlay,"lightning"));assertNull(field(overlay,"drops"));assertNotNull(field(overlay,"current"));}finally{overlay.hide();scale.invoke(null,1f);}
 }
 @Test public void pulsesAreSeparatedAndStopAfterThePresentation(){
  assertEquals(0,RainOverlay.Lightning.strength(0),0);assertEquals(1,RainOverlay.Lightning.strength(1100),.001);
  assertEquals(0,RainOverlay.Lightning.strength(2000),0);assertEquals(0,RainOverlay.Lightning.strength(4500),0);
  assertEquals(1,RainOverlay.Lightning.strength(5100),.001);assertEquals(0,RainOverlay.Lightning.strength(12000),0);
 }
}

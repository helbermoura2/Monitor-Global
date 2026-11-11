package top.monitorglobal.tv;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.view.*;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RainOverlayTest {
 private Object value(Object target,String name)throws Exception{
  java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);
 }
 private RainForecast.Summary sample(){
  return new RainForecast.Summary("now","forte","Chuva forte estimada agora",8,4,
   "Pode terminar em ~30 min a partir de agora",1800000000000L,1800000600000L,true);
 }
 @Test public void rainUsesTheFullWidthBroadcastBannerWithRegionalMap()throws Exception{
  Context c=RuntimeEnvironment.getApplication();
  org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);
  RainOverlay rain=new RainOverlay(c);
  try{
   assertTrue(rain.show(sample(),true,true));
   View host=(View)value(rain,"current");
   assertTrue(host instanceof BannerRevealLayout);
   WindowManager.LayoutParams p=(WindowManager.LayoutParams)host.getLayoutParams();
   assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);
   assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);
   assertTrue("same configured newsroom width",p.width>c.getResources().getDisplayMetrics().widthPixels*.8);
   TvBroadcastInfoView line=(TvBroadcastInfoView)((ViewGroup)host).getChildAt(0);
   assertEquals(TvBroadcastInfoView.WEATHER,(Integer)value(line,"kind"));
   assertTrue("regional map above newsroom strip",line.mapSpace>0);
   assertNotNull("existing rain effect remains under ticker",value(rain,"previewRain"));
   assertNotNull("separate atmosphere window",value(rain,"effectHost"));
   host.measure(View.MeasureSpec.makeMeasureSpec(p.width,View.MeasureSpec.EXACTLY),
    View.MeasureSpec.makeMeasureSpec(p.height,View.MeasureSpec.EXACTLY));
   host.layout(0,0,p.width,p.height);
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(700));
   Bitmap bitmap=Bitmap.createBitmap(p.width,p.height,Bitmap.Config.ARGB_8888);
   host.draw(new Canvas(bitmap));
   try(java.io.FileOutputStream file=new java.io.FileOutputStream("/tmp/monitor-tv-weather-banner.png")){
    assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,file));
   }
   bitmap.recycle();
  }finally{rain.hide();}
  assertNull(value(rain,"current"));
 }
 @Test public void bannerClosesAfterOriginalTwelveSecondDuration()throws Exception{
  Context c=RuntimeEnvironment.getApplication();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);
  RainOverlay rain=new RainOverlay(c);
  assertTrue(rain.show(sample(),false,true));
  Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(RainOverlay.DURATION+BannerTimeline.WIPE_MS+600));
  assertNull(value(rain,"current"));rain.hide();
 }
 @Test public void noPermissionLeavesNoWindow()throws Exception{
  Context c=RuntimeEnvironment.getApplication();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(false);
  RainOverlay rain=new RainOverlay(c);
  assertFalse(rain.show(sample(),true,true));
  assertNull(value(rain,"current"));assertNull(value(rain,"previewRain"));
 }
}

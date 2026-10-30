package top.monitorglobal.tv;
import android.content.*;import android.view.*;import android.os.*;import android.graphics.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class CompactNoticeTest {
 private Object field(Object o,String name)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(o);}
 @Test public void compactCardDrawsAndClosesWithoutKeepingAnOverlayOrTone()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("sound",false).commit();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);CompactNotice card=new CompactNotice(c);
  Alert a=new Alert("demo","earthquake","v","M5,4 · Katmandu, Nepal","","earthquake",1800000000000L,1800000000000L,false);a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";a.targetArea="Katmandu · Nepal";
  card.show(a,true);View view=(View)field(card,"current");assertNotNull(view);WindowManager.LayoutParams p=(WindowManager.LayoutParams)view.getLayoutParams();assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);assertTrue((p.flags&WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);
  int width=p.width;view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(400,View.MeasureSpec.AT_MOST));view.layout(0,0,width,view.getMeasuredHeight());view.setAlpha(1);view.setTranslationY(0);
  Bitmap b=Bitmap.createBitmap(width,view.getHeight(),Bitmap.Config.ARGB_8888);view.draw(new Canvas(b));assertTrue(Color.alpha(b.getPixel(width/2,20))>200);java.io.File out=new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-target-card.png");try(java.io.FileOutputStream stream=new java.io.FileOutputStream(out)){b.compress(Bitmap.CompressFormat.PNG,100,stream);}b.recycle();
  Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));assertNull(field(card,"current"));assertNull(field(card,"tone"));card.show(a,true);card.hide();assertNull(field(card,"current"));Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(10));assertNull(field(card,"current"));
 }
 @Test public void targetBaselineAndCompactCodecSurviveRestart()throws Exception{Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();AlertTracker t=new AlertTracker();t.targetsReady=true;Prefs.save(c,t);assertTrue(Prefs.tracker(c).targetsReady);Alert a=new Alert("demo","earthquake","v","test","","earthquake",1,1,false);a.targetArea="Katmandu · Nepal";a.compact=true;Alert b=AlertCodec.read(AlertCodec.write(a));assertTrue(b.compact);assertEquals(a.targetArea,b.targetArea);}
}

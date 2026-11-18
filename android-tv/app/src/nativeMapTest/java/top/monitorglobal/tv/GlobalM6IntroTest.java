package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import static org.junit.Assert.*;

/** Automated proof that the video-2 yellow flash is exclusive to live worldwide M6+. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class GlobalM6IntroTest {
 private Context context;
 private Alert quake(){
  Alert a=new Alert("demo-m6","earthquake","v1","M6,8 · Honshu, Japão",
    "Profundidade: 28 km · USGS","earthquake",1763300000000L,1763300000000L,true);
  a.countryCode="JP";a.originLongitude=141.4;a.originLatitude=38.1;
  a.magnitude=6.8;a.depth=28;return a;
 }
 @Before public void setUp(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
 }
 private boolean active(Alert a,boolean demo,boolean replay,boolean summary,boolean regional){
  return GlobalM6Intro.eligible(context,a,demo,replay,summary,regional);
 }
 @Test public void useOnlyActualWorldM6PlusQuakes(){
  Alert a=quake();
  assertTrue(active(a,false,false,false,false));
  a.magnitude=5.9;assertFalse(active(a,false,false,false,false));
  a.magnitude=6.0;assertTrue(active(a,false,false,false,false));
  assertFalse(active(a,false,true,false,false));
  assertFalse(active(a,false,false,true,false));
  assertFalse(active(a,false,false,false,true));
  a.compact=true;assertFalse(active(a,false,false,false,false));
  a.compact=false;
  a.revision="Dados do sismo revisados";assertFalse(active(a,false,false,false,false));
  a.revision="";
  a.companion=new Alert("ts","tsunami","v1","Aviso","","warning",1,1,true);
  assertFalse("associated tsunami must be readable immediately",active(a,false,false,false,false));
  a.companion=null;
  a.countryCode="BR";assertFalse(active(a,false,false,false,false));
  a.countryCode="JP";
  Prefs.get(context).edit().putBoolean(GlobalM6Intro.PREF_ENABLED,false).commit();
  assertFalse("user can restore classic M6+ lower-third",active(a,false,false,false,false));
 }
 @Test public void introStopsAndRevealsSameNewsBulletin(){
  assertTrue(GlobalM6Intro.visible(1200,true));
  assertFalse(GlobalM6Intro.visible(3500,true));
  assertFalse("reduced motion never flashes",GlobalM6Intro.visible(1200,false));
  BannerOpening scene=new BannerOpening(new TvEffectsController(context,TvEffectsController.EffectsCategory.GLOBAL_M6,false),20000);
  assertEquals(0f,scene.contentFraction(GlobalM6Intro.HOLD_END_MS),0);
  assertTrue(scene.contentFraction(3000)>0);
  assertEquals(1f,scene.contentFraction(GlobalM6Intro.END_MS),0);
  assertEquals(0f,GlobalM6Intro.yellowOpacity(300),.01f);
  assertTrue(GlobalM6Intro.yellowOpacity(1500)>.9f);
  assertEquals(0f,GlobalM6Intro.yellowOpacity(3000),.01f);
 }
 @Test public void nativeLayoutHasRealBrightYellowWordmarkAndNoOverscan(){
  NewsBannerView demo=new NewsBannerView(context,quake(),true,false);
  Bitmap bitmap=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{
   // The draw method only paints a small TV lower-third: no full-screen image.
   Bitmap scene=BannerOpeningTest.scene(context,demo,1500);
   new Canvas(bitmap).drawBitmap(scene,0,-Banner.insetDp(context),null);scene.recycle();
   int yellow=0;
   for(int y=30;y<94;y++)for(int x=270;x<803;x++){
    int pixel=bitmap.getPixel(x,y);
    if(Color.red(pixel)>210&&Color.green(pixel)>155&&Color.blue(pixel)<100)yellow++;
   }
   assertTrue("yellow BREAKING NEWS is actually visible at mid-flash",yellow>100);
   assertEquals("white upper left newsroom tab",0xfff5f7f8,bitmap.getPixel(245,6));
   assertEquals("outside safe right margin stays transparent",0,Color.alpha(bitmap.getPixel(948,72)));
   assertEquals("no stray content above banner",0,Color.alpha(bitmap.getPixel(600,4)));
   try(java.io.FileOutputStream stream=new java.io.FileOutputStream(
      System.getProperty("java.io.tmpdir")+"/monitor-tv-m6-intro-video2.png")){
    bitmap.compress(Bitmap.CompressFormat.PNG,100,stream);
   }catch(java.io.IOException ignored){}
  }finally{bitmap.recycle();}
 }
 @Test public void originalBulletinAndSummaryStillOwnTheirContent()throws Exception{
  NewsBannerView a=new NewsBannerView(context,quake(),false,false);
  java.lang.reflect.Field f=NewsBannerView.class.getDeclaredField("globalM6Intro");
  f.setAccessible(true);
  assertTrue(f.getBoolean(a));
  assertFalse(f.getBoolean(new NewsBannerView(context,quake(),false,true)));
  assertFalse(f.getBoolean(new NewsBannerView(context,List.of(quake()),
    "2026-11-16",false,true)));
 }
}

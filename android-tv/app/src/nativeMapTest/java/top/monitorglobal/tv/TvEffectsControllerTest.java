package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.*;
import android.os.*;
import android.view.View;
import android.widget.FrameLayout;
import java.io.*;
import java.time.Duration;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowSettings;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class TvEffectsControllerTest {
 private Context c;
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("sound",false).commit();ShadowSettings.setCanDrawOverlays(true);}
 private TvEffectsController policy(View v){return v instanceof NewsBannerView?((NewsBannerView)v).effects:v instanceof BrazilNationalBannerView?((BrazilNationalBannerView)v).effects:((TvBroadcastInfoView)v).effects;}
 private void start(View v,long elapsed){long when=SystemClock.uptimeMillis()-elapsed;if(v instanceof NewsBannerView)((NewsBannerView)v).startPresentation(when,true);else if(v instanceof BrazilNationalBannerView)((BrazilNationalBannerView)v).startPresentation(when,true);else ((TvBroadcastInfoView)v).startPresentation(when,true);}
 private int height(View v){return v instanceof BrazilNationalBannerView?180:126+(v instanceof TvBroadcastInfoView?((TvBroadcastInfoView)v).mapSpace:Banner.insetDp(c));}
 private Bitmap render(View v,long elapsed){v.layout(0,0,960,height(v));start(v,elapsed);Bitmap b=Bitmap.createBitmap(960,height(v),Bitmap.Config.ARGB_8888);v.draw(new Canvas(b));return b;}
 private void export(Bitmap b,String name)throws Exception{try(FileOutputStream out=new FileOutputStream("/tmp/monitor-tv-banner-effects-"+name+".png")){assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));}}
 private Bitmap exit(View v){BannerRevealLayout host=new BannerRevealLayout(c);host.addView(v,new FrameLayout.LayoutParams(-1,-1));host.configure(policy(v));host.exiting();host.reveal(.25f);host.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height(v),View.MeasureSpec.EXACTLY));host.layout(0,0,960,height(v));start(v,TvEffectsDemo.duration(policy(v).category)-100);Bitmap b=Bitmap.createBitmap(960,height(v),Bitmap.Config.ARGB_8888);host.draw(new Canvas(b));host.removeAllViews();return b;}
 @Test public void modesPersistAndReplaysDowngradeWithoutChangingUserChoice(){
  for(TvEffectsController.EffectsMode m:TvEffectsController.EffectsMode.values()){
   TvEffectsController.select(c,m);assertEquals(m,TvEffectsController.selected(c.getApplicationContext()));
   TvEffectsController live=new TvEffectsController(c,TvEffectsController.EffectsCategory.BRAZIL,false),replay=new TvEffectsController(c,TvEffectsController.EffectsCategory.BRAZIL,true);
   assertEquals(m,live.mode());assertEquals(m==TvEffectsController.EffectsMode.FULL?TvEffectsController.EffectsMode.SOFT:m,replay.mode());
   live.start(100);assertEquals(50,live.elapsed(150));live.stop();assertFalse(live.animated());live.start(200);assertEquals(m,live.mode());
  }
 }
 @Test public void systemReductionOverridesEveryCategoryAndM6Switch()throws Exception{
  java.lang.reflect.Method scale=ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);
  scale.invoke(null,0f);
  try{for(TvEffectsController.EffectsCategory category:TvEffectsController.EffectsCategory.values()){
   View v=TvEffectsDemo.create(c,category);assertFalse(policy(v).animated());assertEquals(255,policy(v).opacity(0));assertEquals(0,policy(v).entranceMs());
   Bitmap a=render(v,100),b=render(v,500);
   try{assertTrue("reduced-motion frame remains static: "+category,a.sameAs(b));}finally{a.recycle();b.recycle();}
  }}finally{scale.invoke(null,1f);}
 }
 @Test public void allTenLayoutsHaveFullSoftOffProofAtEntryMiddleAndExit()throws Exception{
  for(TvEffectsController.EffectsMode mode:TvEffectsController.EffectsMode.values()){
   TvEffectsController.select(c,mode);
   for(TvEffectsController.EffectsCategory category:TvEffectsController.EffectsCategory.values()){
    View v=TvEffectsDemo.create(c,category);String description=v.getContentDescription().toString();
    assertTrue("fixtures are explicitly fictitious",description.toUpperCase(java.util.Locale.ROOT).contains("SIMULA" )||description.toUpperCase(java.util.Locale.ROOT).contains("FICT"));
    for(long at:new long[]{100,8000,TvEffectsDemo.duration(category)-100}){
     Bitmap b=at==TvEffectsDemo.duration(category)-100?exit(v):render(v,at);try{export(b,category+"-"+mode+"-"+at);}finally{b.recycle();}
    }
   }
  }
 }
 @Test public void brazilHostDoesNotCropFooterAtEitherPositionOrMode()throws Exception{
  for(boolean top:new boolean[]{true,false})for(TvEffectsController.EffectsMode mode:TvEffectsController.EffectsMode.values())for(int model:new int[]{1,2}){
   Prefs.get(c).edit().putBoolean("themeTop",top).putInt(BrazilNationalBannerView.PREF_MODEL,model).commit();TvEffectsController.select(c,mode);
   BrazilNationalBannerView v=new BrazilNationalBannerView(c,TvEffectsDemo.quake(true,false),true,false);
   BannerRevealLayout host=new BannerRevealLayout(c);host.setPadding(0,12,0,12);host.addView(v,new FrameLayout.LayoutParams(-1,-1));host.configure(v.effects);host.reveal(mode==TvEffectsController.EffectsMode.OFF?0:.6f);
   host.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(204,View.MeasureSpec.EXACTLY));host.layout(0,0,960,204);v.startPresentation(SystemClock.uptimeMillis()-1000,true);
   Bitmap image=Bitmap.createBitmap(960,204,Bitmap.Config.ARGB_8888);try{host.draw(new Canvas(image));assertTrue("Brazil footer remains inside host at y=180",Color.alpha(image.getPixel(400,188))>100);export(image,"BRAZIL-host-"+mode+"-"+model+"-"+top);}finally{image.recycle();}
  }
 }
 @Test public void noFabricatedWeatherAndNoNewPriceCounters(){
  assertFalse(TvEffectsController.wet(null));assertFalse(TvEffectsController.storm(null,null));
  TvEffectsController.select(c,TvEffectsController.EffectsMode.OFF);
  TvBroadcastInfoView missing=TvBroadcastInfoView.market(c,null,null,false);
  assertTrue(missing.getContentDescription().toString().contains("sem cotação confirmada"));
  assertEquals(255,missing.effects.imageOpacity(0));assertEquals(15000,TvEffectsDemo.duration(TvEffectsController.EffectsCategory.REGIONAL));assertEquals(6000,BannerTimeline.SUMMARY_PAGE_MS);
 }
 @Test public void hiddenBannerCannotResurrectFromAnOldExitCallback(){
  for(TvEffectsController.EffectsMode mode:TvEffectsController.EffectsMode.values()){
   TvEffectsController.select(c,mode);Banner banner=new Banner(c);assertTrue(banner.showEffectsDemo(TvEffectsController.EffectsCategory.BRAZIL));banner.hide();
   Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(25));assertNull(banner.activeView());
  }
 }
}

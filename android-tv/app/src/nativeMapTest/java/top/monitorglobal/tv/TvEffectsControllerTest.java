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
 @Before public void setup(){org.robolectric.shadows.ShadowSystemClock.advanceBy(Duration.ofSeconds(30));c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("sound",false).commit();ShadowSettings.setCanDrawOverlays(true);}
 private TvEffectsController policy(View v){return v instanceof NewsBannerView?((NewsBannerView)v).effects:v instanceof BrazilNationalBannerView?((BrazilNationalBannerView)v).effects:((TvBroadcastInfoView)v).effects;}
 private void start(View v,long elapsed){long when=SystemClock.uptimeMillis()-elapsed;if(v instanceof NewsBannerView)((NewsBannerView)v).startPresentation(when,true);else if(v instanceof BrazilNationalBannerView)((BrazilNationalBannerView)v).startPresentation(when,true);else ((TvBroadcastInfoView)v).startPresentation(when,true);}
 private int height(View v){return v instanceof BrazilNationalBannerView?(int)BrazilNationalBannerView.HEIGHT:126+(v instanceof TvBroadcastInfoView?((TvBroadcastInfoView)v).mapSpace:Banner.insetDp(c));}
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
   try{assertTrue("reduced-motion frame remains static: "+category,a.sameAs(b));export(a,category+"-SYSTEM-REDUCED");}finally{a.recycle();b.recycle();}
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
   // Brazil now has the exact same 180-unit map viewport as regional and satellite.
   // Keep the host test realistic: the footer sits below the inset in bottom mode.
   int height=150+v.mapSpace;
   host.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));host.layout(0,0,960,height);v.startPresentation(SystemClock.uptimeMillis()-1000,true);
   Bitmap image=Bitmap.createBitmap(960,height,Bitmap.Config.ARGB_8888);try{host.draw(new Canvas(image));int footerY=130+(top?0:v.mapSpace);assertTrue("Brazil footer remains visible while the host moves",Color.alpha(image.getPixel(400,footerY))>100);export(image,"BRAZIL-host-"+mode+"-"+model+"-"+top);}finally{image.recycle();}
  }
 }
 @Test public void civilFullScreenRespectsAllMotionModes(){
  TvEffectsController.select(c,TvEffectsController.EffectsMode.FULL);
  assertTrue(CivilScreenEffect.eligible(c));
  assertEquals(CivilScreenEffect.FULL_MS,new CivilScreenEffect(c,false,true).duration());
  assertEquals(CivilScreenEffect.FULL_MS,new CivilScreenEffect(c,true,false).duration());
  TvEffectsController.select(c,TvEffectsController.EffectsMode.SOFT);
  assertTrue(CivilScreenEffect.eligible(c));
  assertEquals(CivilScreenEffect.SOFT_MS,new CivilScreenEffect(c,false,false).duration());
  TvEffectsController.select(c,TvEffectsController.EffectsMode.OFF);
  assertFalse(CivilScreenEffect.eligible(c));
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
 @Test public void simulationSequenceCanBeCancelledWithoutStoppingMonitoring()throws Exception{
  MonitorService service=Robolectric.buildService(MonitorService.class).create().get();
  try{
   Prefs.get(service).edit().putBoolean("enabled",false).commit();
   service.onStartCommand(new android.content.Intent().setAction(MonitorService.TEST+"_EFFECTS"),0,1);
   java.lang.reflect.Field tasks=MonitorService.class.getDeclaredField("demoTasks");tasks.setAccessible(true);
   assertEquals(TvEffectsController.EffectsCategory.values().length,((java.util.List<?>)tasks.get(service)).size());
   service.onStartCommand(new android.content.Intent().setAction(MonitorService.TEST+"_EFFECTS_CANCEL"),0,2);
   assertTrue(((java.util.List<?>)tasks.get(service)).isEmpty());
   assertFalse(Prefs.get(service).getBoolean("enabled",false));
  }finally{service.onDestroy();}
 }
 @Test public void settledInformationKeepsTheSameLayoutAcrossModes(){
  for(TvEffectsController.EffectsCategory category:TvEffectsController.EffectsCategory.values()){
   TvEffectsController.select(c,TvEffectsController.EffectsMode.OFF);Bitmap baseline=render(TvEffectsDemo.create(c,category),8000);
   try{for(TvEffectsController.EffectsMode mode:new TvEffectsController.EffectsMode[]{TvEffectsController.EffectsMode.FULL,TvEffectsController.EffectsMode.SOFT}){
    TvEffectsController.select(c,mode);Bitmap next=render(TvEffectsDemo.create(c,category),8000);
    try{int top=category==TvEffectsController.EffectsCategory.BRAZIL?31:category==TvEffectsController.EffectsCategory.MARKET||category==TvEffectsController.EffectsCategory.VOICE||category==TvEffectsController.EffectsCategory.CIVIL?31:Banner.insetDp(c)+31;
     int bottom=top+60;
     for(int y=top;y<bottom;y++)for(int x=category==TvEffectsController.EffectsCategory.BRAZIL?272:223;x<812;x++)assertEquals("settled content layout: "+category+" / "+mode,baseline.getPixel(x,y),next.getPixel(x,y));
    }finally{next.recycle();}
   }}finally{baseline.recycle();}
  }
 }
 @Test public void newPresentationDoesNotCountItsIdleGapAsJank(){
  RuntimeDiagnostics.resetFrameClock();long before=RuntimeDiagnostics.frameSnapshot().optLong("gapsOver100ms");
  RuntimeDiagnostics.frame(1000000000L,1000000,true);
  TvEffectsController policy=new TvEffectsController(c,TvEffectsController.EffectsCategory.WEATHER,false);policy.start(2000);
  RuntimeDiagnostics.frame(3600000000000L,1000000,true);
  assertEquals(before,RuntimeDiagnostics.frameSnapshot().optLong("gapsOver100ms"));policy.stop();
 }
 @Test public void approvedM6OpeningIsExclusiveToFullAndIndependentSwitch()throws Exception{
  for(TvEffectsController.EffectsMode mode:TvEffectsController.EffectsMode.values())for(boolean opening:new boolean[]{true,false}){
   TvEffectsController.select(c,mode);Prefs.get(c).edit().putBoolean(GlobalM6Intro.PREF_ENABLED,opening).commit();
   Bitmap b=BannerOpeningTest.scene(c,TvEffectsDemo.create(c,TvEffectsController.EffectsCategory.GLOBAL_M6),500);
   try{int red=0;for(int y=Banner.insetDp(c)+48;y<Banner.insetDp(c)+88;y++)for(int x=270;x<800;x++){
    int color=b.getPixel(x,y);if(Color.red(color)>125&&Color.green(color)<65&&Color.blue(color)<115)red++;
   }
   if(mode==TvEffectsController.EffectsMode.FULL&&opening)assertTrue(red>100);
   export(b,"GLOBAL_M6-"+mode+"-opening-"+opening);
   }finally{b.recycle();}
  }
 }
}

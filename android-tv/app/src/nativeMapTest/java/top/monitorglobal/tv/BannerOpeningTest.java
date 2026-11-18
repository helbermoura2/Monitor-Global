package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import android.widget.FrameLayout;
import java.io.*;
import java.time.Duration;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BannerOpeningTest {
 private Context c;
 @Before public void setup(){org.robolectric.shadows.ShadowSystemClock.advanceBy(Duration.ofSeconds(60));c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();OfficialArgosLogo.prepare(c);}
 static TvEffectsController policy(View v){return v instanceof NewsBannerView?((NewsBannerView)v).effects:v instanceof BrazilNationalBannerView?((BrazilNationalBannerView)v).effects:((TvBroadcastInfoView)v).effects;}
 static Bitmap scene(Context context,View row,long elapsed){
  int h=row instanceof BrazilNationalBannerView?180:126+(row instanceof TvBroadcastInfoView?((TvBroadcastInfoView)row).mapSpace:Banner.insetDp(context));
  BannerRevealLayout host=new BannerRevealLayout(context);host.addView(row,new FrameLayout.LayoutParams(-1,-1));host.configure(policy(row),20000);host.reveal(1);
  host.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));host.layout(0,0,960,h);
  long when=SystemClock.uptimeMillis()-elapsed;host.startPresentation(when);
  if(row instanceof NewsBannerView)((NewsBannerView)row).startPresentation(when,true);else if(row instanceof BrazilNationalBannerView)((BrazilNationalBannerView)row).startPresentation(when,true);else ((TvBroadcastInfoView)row).startPresentation(when,true);
  Bitmap b=Bitmap.createBitmap(960,h,Bitmap.Config.ARGB_8888);host.draw(new Canvas(b));host.removeAllViews();return b;
 }
 @Test public void allRequestedHeadlinesAreExplicit(){
  assertEquals("CHUVA",BannerOpening.title(TvEffectsController.EffectsCategory.RAIN));
  assertEquals("SISMO NO BRASIL",BannerOpening.title(TvEffectsController.EffectsCategory.BRAZIL));
  assertEquals("SISMO REGIONAL",BannerOpening.title(TvEffectsController.EffectsCategory.REGIONAL));
  assertEquals("TEMPERATURA",BannerOpening.title(TvEffectsController.EffectsCategory.WEATHER));
  assertEquals("COTAÇÕES",BannerOpening.title(TvEffectsController.EffectsCategory.MARKET));
 }
 @Test public void openerNeverDrawsTheDataUnderItAndWipeHasDisjointPixels(){
  class Data extends View {int draws;final Paint p=new Paint();Data(){super(c);}protected void onDraw(Canvas canvas){draws++;canvas.drawColor(Color.MAGENTA);}}
  TvEffectsController effects=new TvEffectsController(c,TvEffectsController.EffectsCategory.RAIN,false);
  Data data=new Data();BannerRevealLayout host=new BannerRevealLayout(c);host.addView(data,new FrameLayout.LayoutParams(-1,-1));host.configure(effects,12000);host.reveal(1);
  int h=126+Banner.insetDp(c);host.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));host.layout(0,0,960,h);
  Bitmap b=Bitmap.createBitmap(960,h,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(b);
  try{
   host.startPresentation(SystemClock.uptimeMillis()-1200);host.draw(canvas);assertEquals("no normal banner is rendered beneath the opening",0,data.draws);
   host.startPresentation(SystemClock.uptimeMillis()-1975);b.eraseColor(Color.TRANSPARENT);host.draw(canvas);assertEquals(1,data.draws);
   assertEquals("left of wipe is ONLY data",Color.MAGENTA,b.getPixel(100,Banner.insetDp(c)+60));
   assertNotEquals("right of wipe is ONLY opening",Color.MAGENTA,b.getPixel(800,Banner.insetDp(c)+60));
   host.startPresentation(SystemClock.uptimeMillis()-2300);b.eraseColor(Color.TRANSPARENT);host.draw(canvas);assertEquals(Color.MAGENTA,b.getPixel(800,Banner.insetDp(c)+60));
  }finally{b.recycle();}
 }
 @Test public void urgentAndShortPresentationsNeverWaitForOpening(){
  TvEffectsController urgent=new TvEffectsController(c,TvEffectsController.EffectsCategory.TSUNAMI,false);
  assertFalse(new BannerOpening(urgent,15000).visible(500));
  TvEffectsController rain=new TvEffectsController(c,TvEffectsController.EffectsCategory.RAIN,false);
  assertFalse(new BannerOpening(rain,3000).visible(500));rain.disableOpening();assertFalse(new BannerOpening(rain,12000).visible(500));
  TvEffectsController.select(c,TvEffectsController.EffectsMode.OFF);assertFalse(new BannerOpening(new TvEffectsController(c,TvEffectsController.EffectsCategory.MARKET,false),12000).visible(500));
 }
 @Test public void fullAndSoftHaveOneFiniteOpeningAndDoNotRestart(){
  for(TvEffectsController.EffectsMode mode:new TvEffectsController.EffectsMode[]{TvEffectsController.EffectsMode.FULL,TvEffectsController.EffectsMode.SOFT}){
   TvEffectsController.select(c,mode);BannerOpening intro=new BannerOpening(new TvEffectsController(c,TvEffectsController.EffectsCategory.WEATHER,false),15000);
   assertTrue(intro.visible(100));assertFalse(intro.visible(intro.duration()));assertFalse(intro.visible(8000));assertEquals(1,intro.contentFraction(intro.duration()),0);intro.stop();assertFalse(intro.visible(100));
  }
 }
 @Test public void exportActualOpeningFramesForAllRequestedEvents()throws Exception{
  for(TvEffectsController.EffectsCategory category:new TvEffectsController.EffectsCategory[]{TvEffectsController.EffectsCategory.GLOBAL_M6,TvEffectsController.EffectsCategory.RAIN,TvEffectsController.EffectsCategory.BRAZIL,TvEffectsController.EffectsCategory.REGIONAL,TvEffectsController.EffectsCategory.WEATHER,TvEffectsController.EffectsCategory.MARKET}){
   for(int frame=0;frame<45;frame++){
    View row=TvEffectsDemo.create(c,category);Bitmap b=scene(c,row,frame*100L);
    try(FileOutputStream out=new FileOutputStream(String.format(java.util.Locale.ROOT,"/tmp/monitor-tv-banner-opening-%s-%03d.png",category,frame))){assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));}finally{b.recycle();}
   }
  }
 }
}

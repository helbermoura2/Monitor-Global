package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.SystemClock;
import android.view.View;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import static org.junit.Assert.*;

/** Native Canvas regression: all event families inherit the Civil Defense red rules. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class NewsroomDividersTest {
 private Context context;

 @Before public void setup(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
  TvEffectsController.select(context,TvEffectsController.EffectsMode.OFF);
 }

 private Bitmap render(View view){
  int inset=view instanceof BrazilNationalBannerView?((BrazilNationalBannerView)view).mapSpace:
   view instanceof TvBroadcastInfoView?((TvBroadcastInfoView)view).mapSpace:Banner.insetDp(context);
  int h=126+inset;
  view.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),
   View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
  view.layout(0,0,960,h);
  long when=SystemClock.uptimeMillis()-3000;
  if(view instanceof NewsBannerView)((NewsBannerView)view).startPresentation(when,false);
  else if(view instanceof BrazilNationalBannerView)((BrazilNationalBannerView)view).startPresentation(when,false);
  else ((TvBroadcastInfoView)view).startPresentation(when,false);
  Bitmap screenshot=Bitmap.createBitmap(960,h,Bitmap.Config.ARGB_8888);
  view.draw(new Canvas(screenshot));
  return screenshot;
 }
 private static void redRule(Bitmap bitmap,int x,int y,String name){
  int color=bitmap.getPixel(x,y);
  assertTrue(name+" needs a visible red line: "+Integer.toHexString(color),
   Color.red(color)>=120&&Color.red(color)>Color.green(color)*1.4f&&
   Color.red(color)>Color.blue(color)*1.15f);
 }

 @Test public void everyBroadcastFamilyUsesConsistentSourceAndLogoRules(){
  for(TvEffectsController.EffectsCategory category:TvEffectsController.EffectsCategory.values()){
   View view=TvEffectsDemo.create(context,category);
   Bitmap screenshot=render(view);
   try{
    int inset=view instanceof BrazilNationalBannerView?((BrazilNationalBannerView)view).mapSpace:
     view instanceof TvBroadcastInfoView?((TvBroadcastInfoView)view).mapSpace:Banner.insetDp(context);
    int y=inset+56;
    boolean civil=category==TvEffectsController.EffectsCategory.CIVIL;
    redRule(screenshot,civil?179:120,y,category+" source");
    redRule(screenshot,827,y,category+" brand");
    if(category==TvEffectsController.EffectsCategory.MARKET)
     redRule(screenshot,485,y,"Brent / Dólar");
   }finally{screenshot.recycle();}
  }
 }

 @Test public void sharedDividersStayInMainBodyAndNotInFooter(){
  Bitmap bitmap=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{
   Canvas canvas=new Canvas(bitmap);
   OledNewsChrome.base(canvas,new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG));
   BroadcastVisuals.newsroomDividers(canvas,new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG),
    BroadcastVisuals.SOURCE_DIVIDER_X);
   redRule(bitmap,120,60,"source middle");
   redRule(bitmap,827,60,"logo middle");
   assertEquals("dividers must not enter the red tabs",Color.TRANSPARENT,bitmap.getPixel(120,27));
   assertEquals("left red rule stops before ticker",0,Color.red(bitmap.getPixel(120,99)));
  }finally{bitmap.recycle();}
 }
}

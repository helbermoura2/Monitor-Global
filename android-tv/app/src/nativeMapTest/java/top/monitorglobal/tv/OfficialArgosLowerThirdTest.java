package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.view.View;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import static org.junit.Assert.*;

/** Every TV lower-third shares the official compact Argos eye and overscan-safe region. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class OfficialArgosLowerThirdTest {
 private Bitmap render(View view,long elapsed){
  int space=view instanceof TvBroadcastInfoView?((TvBroadcastInfoView)view).mapSpace:0;
  int height=126+space;
  view.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),
    View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));
  view.layout(0,0,960,height);
  if(view instanceof TvBroadcastInfoView)
   ((TvBroadcastInfoView)view).startPresentation(android.os.SystemClock.uptimeMillis()-elapsed,false);
  Bitmap bitmap=Bitmap.createBitmap(960,height,Bitmap.Config.ARGB_8888);
  view.draw(new Canvas(bitmap));
  if(space==0)return bitmap;
  Bitmap band=Bitmap.createBitmap(bitmap,0,space,960,126);
  bitmap.recycle();
  return band;
 }
 private void assertBrandWithinSafeArea(Bitmap b){
  int gold=0,forbidden=0;
  for(int y=33;y<=92;y++)for(int x=818;x<960;x++){
   int p=b.getPixel(x,y);
   boolean isGold=Color.red(p)>125&&Color.green(p)>75&&Color.blue(p)<185&&Color.red(p)>Color.blue(p)+30;
   if(isGold){gold++;if(x>=926)forbidden++;}
  }
  assertTrue("golden official eye must remain visible",gold>15);
  assertEquals("brand must stay 35 units clear of screen edge",0,forbidden);
 }
 @Test public void weatherAndBrentUseExactlyTheSameOfficialLogoRegion(){
  Context c=RuntimeEnvironment.getApplication();
  WeatherForecast.Summary summary=new WeatherForecast.Summary(
   "29°C","Parcialmente nublado","18 km/h","48%",
   "Modelo horário",System.currentTimeMillis()+600000,false,
   "29°C","28°C","48%","18 km/h","27 km/h","PartlyCloudy");
  TvBroadcastInfoView weather=TvBroadcastInfoView.weather(c,null,summary,false);
  BrentQuote oil=new BrentQuote(78.45,77.5,.95,1.22,System.currentTimeMillis()-60000,"Yahoo Finance");
  DollarQuote usd=new DollarQuote(5.35,.04,.76,System.currentTimeMillis()-60000,"Yahoo Finance");
  TvBroadcastInfoView market=TvBroadcastInfoView.market(c,oil,usd,false);
  Bitmap a=render(weather,1000),b=render(market,1000);
  try{
   assertEquals(35f,BroadcastVisuals.BRAND_RIGHT_INSET,0.001f);
   assertEquals(66f,BroadcastVisuals.RADAR_SIZE,0.001f);
   assertEquals(925f,BroadcastVisuals.RADAR_X+BroadcastVisuals.RADAR_SIZE/2f,0.001f);
   assertTrue(BroadcastVisuals.CONTENT_RIGHT_LIMIT+5f<=BroadcastVisuals.RADAR_X-BroadcastVisuals.RADAR_SIZE/2f);
   assertBrandWithinSafeArea(a);
   assertBrandWithinSafeArea(b);
   int transientPixels=0;
   for(int y=33;y<91;y++)for(int x=864;x<926;x++){
    // Renderer passes advance the eye's animated sweep by a few milliseconds.
    if(a.getPixel(x,y)!=b.getPixel(x,y))transientPixels++;
   }
   assertTrue("same official emblem, tolerating only its moving sweep edge: "+transientPixels,
     transientPixels<180);
  }finally{a.recycle();b.recycle();}
 }
 @Test public void noElementsOrBrandCrossTheRightOverscanMargin(){
  Context c=RuntimeEnvironment.getApplication();
  TvBroadcastInfoView rain=TvBroadcastInfoView.market(c,null,null,false);
  Bitmap b=render(rain,1000);
  try{
   int cleanBackground=b.getPixel(945,35);
   for(int y=30;y<90;y++)for(int x=931;x<958;x++){
    assertEquals("logo and metrics stay within the safe area",cleanBackground,b.getPixel(x,y));
   }
  }finally{b.recycle();}
 }
}

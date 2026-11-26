package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherMapNewsStripTest {
 @Test public void newsroomChromeUsesActualSourceAndMarksUnavailable(){
  Context c=RuntimeEnvironment.getApplication();WeatherMapNewsStrip view=new WeatherMapNewsStrip(c);
  long now=1800000000000L;view.radar(null,"SUDESTE",now);
  assertTrue(view.getContentDescription().toString().contains("SEM DADO"));
  assertFalse(view.getContentDescription().toString().contains("OBSERVADO"));
  RadarMapClient.Frame f=new RadarMapClient.Frame(now-28*60000L,Collections.singletonList("São Roque"),Collections.emptyList());
  view.radar(f,"SUDESTE",now);String text=view.getContentDescription().toString();
  assertTrue(text.contains("INPE / DECEA"));assertTrue(text.contains("há 28 min"));assertTrue(text.contains("dBZ não é taxa de chuva"));
  view.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(126,View.MeasureSpec.EXACTLY));
  view.layout(0,0,960,126);
  Bitmap bitmap=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{view.draw(new Canvas(bitmap));assertEquals(Color.BLACK,bitmap.getPixel(350,33));int red=bitmap.getPixel(20,27);assertTrue(Color.red(red)>Color.green(red));}finally{bitmap.recycle();}
  view.radar(f,"SUDESTE",now+40*60000L);assertTrue(view.getContentDescription().toString().contains("DEFASADO"));
  view.satellite(null,"BRASIL",now);assertTrue(view.getContentDescription().toString().contains("SEM DADO"));assertTrue(view.getContentDescription().toString().contains("não mede intensidade da chuva"));
 }
 @Test public void manualStripUsesUndistortedOfficialGeometryAndClock()throws Exception{
  Context c=RuntimeEnvironment.getApplication();WeatherMapNewsStrip view=new WeatherMapNewsStrip(c);
  long now=System.currentTimeMillis();
  view.radar(new RadarMapClient.Frame(now-15*60000L,Collections.singletonList("São Roque"),Collections.emptyList()),"SP/RJ",now);
  for(int w:new int[]{912,1280,1920}){
   view.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(500,View.MeasureSpec.AT_MOST));
   int h=view.getMeasuredHeight();assertEquals(Math.round(w*126f/960f),h);
   view.layout(0,0,w,h);
   Bitmap b=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);
   try{
    view.draw(new Canvas(b));float sx=w/960f,sy=h/126f;
    assertEquals("Shared red clock plate",OledNewsChrome.RED_DARK,b.getPixel(Math.round(20*sx),Math.round(100*sy)));
    assertEquals("Shared gray footer",0xff333436,b.getPixel(Math.round(798*sx),Math.round(100*sy)));
    assertEquals("Shared source divider",0xffbb243d,b.getPixel(Math.round(120*sx),Math.round(75*sy)));
    int white=0;for(int y=Math.round(101*sy);y<Math.round(123*sy);y++)for(int x=Math.round(22*sx);x<Math.round(94*sx);x++){int v=b.getPixel(x,y);if(Color.red(v)>210&&Color.green(v)>210&&Color.blue(v)>210)white++;}
    assertTrue("Clock must contain visible digits",white>12);
    if(w==1280)try(java.io.FileOutputStream out=new java.io.FileOutputStream("/tmp/monitor-tv-weather-card-manual-newsroom.png")){assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));}
   }finally{b.recycle();}
  }
 }
 @Test public void effectsNeverInferRainFromRadarOrUnavailableData(){
  long now=1800000000000L;
  assertFalse(RainVisualPolicy.decorativeAllowed(null,false,now));
  RainForecast.Summary good=new RainForecast.Summary("now","moderada","Chuva estimada",5,3,"",now-60000L,now+60000L,true);
  assertTrue(RainVisualPolicy.decorativeAllowed(good,false,now));
  assertFalse(RainVisualPolicy.decorativeAllowed(good,false,now+60000L));
  assertTrue(RainVisualPolicy.decorativeAllowed(good,true,now+60000L));
  RainForecast.Summary unknown=new RainForecast.Summary("evidence","gauge","Chuva medida",Double.NaN,Double.NaN,"",now-60000L,now+60000L,false);
  assertFalse(RainVisualPolicy.decorativeAllowed(unknown,false,now));
 }
}

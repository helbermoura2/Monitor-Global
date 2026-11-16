package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import static org.junit.Assert.*;

/** Visual and information contract for the approved user-supplied Pixlr OLED template. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class OledNewsChromeTest {
 private Bitmap skin(String left,String right){
  Bitmap b=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  Canvas c=new Canvas(b);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
  OledNewsChrome.base(c,p);
  OledNewsChrome.tab(c,p,left,true);
  OledNewsChrome.tab(c,p,right,false);
  BroadcastVisuals.radar(c,p,1200,false);
  OledNewsChrome.brandFooter(c,p,"argosorbis.com.br",false,255);
  return b;
 }
 @Test public void mainStripeIsGenuineOledBlackWithNoFloatingTopTextBoxes(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   assertEquals("exact OLED #000000, not navy",Color.BLACK,b.getPixel(500,65));
   for(int x:new int[]{350,600,750})assertEquals("no floating info boxes in upper area",0,Color.alpha(b.getPixel(x,8)));
   assertEquals(0,Color.alpha(b.getPixel(20,60)));
   assertEquals(0,Color.alpha(b.getPixel(940,60)));
   assertEquals(255,Color.alpha(b.getPixel(200,65)));
   assertTrue("footer remains darker than a white panel",Color.red(b.getPixel(400,108))<70);
  }finally{b.recycle();}
 }
 @Test public void redTabsRemainSeparatedAndLegible(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   int left=b.getPixel(37,12),live=b.getPixel(808,12);
   assertTrue(Color.red(left)>Color.green(left)*2);
   assertTrue(Color.red(live)>Color.green(live)*2);
   assertEquals("no extra top-right floating boxes",0,Color.alpha(b.getPixel(700,12)));
  }finally{b.recycle();}
 }
 @Test public void completeOfficialBrandIsInsideOverscanSafeArea(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   int cyan=0,gold=0,white=0;
   for(int y=33;y<94;y++)for(int x=818;x<926;x++){
    int rgb=b.getPixel(x,y);
    if(Color.green(rgb)>110&&Color.blue(rgb)>100&&Color.red(rgb)<120)cyan++;
    if(Color.red(rgb)>120&&Color.green(rgb)>70&&Color.red(rgb)>Color.blue(rgb)+30)gold++;
    if(Color.red(rgb)>200&&Color.green(rgb)>200&&Color.blue(rgb)>200)white++;
   }
   assertTrue("real official cyan radar eye",cyan>20);
   assertTrue("official golden eye outline",gold>15);
   assertTrue("full Argos Orbis wordmark",white>25);
   for(int x=931;x<960;x++)for(int y=32;y<94;y++)
    assertEquals("no brand bleeding into overscan",0,Color.alpha(b.getPixel(x,y)));
  }finally{b.recycle();}
 }
 @Test public void liveDataIsStillInTheNativeTvBanners(){
  Context c=RuntimeEnvironment.getApplication();
  long now=System.currentTimeMillis();
  Alert event=new Alert("real","earthquake","v","M6,2 · Japão","Profundidade: 24 km · USGS","earthquake",now,now,true);
  NewsBannerView seismic=new NewsBannerView(c,event,false,false);
  assertEquals("AO VIVO",seismic.badgeLabel());
  assertTrue(seismic.getContentDescription().toString().contains("Profundidade: 24 km"));
  WeatherForecast.Summary weather=new WeatherForecast.Summary("23°C","Nublado","Vento 18 km/h",
   "Umidade 67%","Modelo horário",now+600000,false,"23°C","24°C","67%","18 km/h","22 km/h","Cloudy");
  TvBroadcastInfoView forecast=TvBroadcastInfoView.weather(c,null,weather,false);
  assertTrue(forecast.getContentDescription().toString().contains("Nublado"));
  assertTrue(forecast.getContentDescription().toString().contains("23°C"));
  TvBroadcastInfoView market=TvBroadcastInfoView.market(c,
   new BrentQuote(76.5,75.2,1.3,1.7,now,"Yahoo Finance"),
   new DollarQuote(5.3,.03,.57,now,"Yahoo Finance"),false);
  assertTrue(market.getContentDescription().toString().contains("USD/BRL"));
  assertTrue(market.getContentDescription().toString().contains("BRENT"));
 }
}

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
  OledNewsChrome.brandFooter(c,p,1200,false);
  return b;
 }
 @Test public void mainStripeIsGenuineOledBlackWithNoFloatingTopTextBoxes(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   assertEquals("exact OLED #000000, not navy",Color.BLACK,b.getPixel(500,65));
   for(int x:new int[]{350,600,750})assertEquals("no floating info boxes in upper area",0,Color.alpha(b.getPixel(x,8)));
   assertEquals("black under left category",Color.BLACK,b.getPixel(20,60));
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
   assertEquals("no project wordmark in right-hand logo-only block",0,white);
   for(int x=931;x<960;x++)for(int y=32;y<94;y++)
    assertEquals("no brand bleeding into overscan",0,Color.alpha(b.getPixel(x,y)));
  }finally{b.recycle();}
 }
 @Test public void greyFooterAlternatesOneAddressAtATimeWithNoCrossfadeOverlap(){
  assertEquals("argosorbis.com.br",OledNewsChrome.footerText(1200));
  assertEquals("@argosorbis",OledNewsChrome.footerText(5100));
  assertEquals("argosorbis.com.br",OledNewsChrome.footerText(9100));
  assertEquals(255,OledNewsChrome.footerOpacity(1200,true));
  assertTrue("fade out before changing label",OledNewsChrome.footerOpacity(3900,true)<100);
  assertEquals("no text exactly at switch",0,OledNewsChrome.footerOpacity(4000,true));
  assertTrue("fade in after changing label",OledNewsChrome.footerOpacity(4100,true)<100);
  assertEquals(255,OledNewsChrome.footerOpacity(5100,true));
  assertEquals(255,OledNewsChrome.footerOpacity(4000,false));
  Bitmap first=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  Bitmap second=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  Bitmap blank=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{
   Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
   OledNewsChrome.base(new Canvas(first),p);OledNewsChrome.brandFooter(new Canvas(first),p,1200,true);
   OledNewsChrome.base(new Canvas(second),p);OledNewsChrome.brandFooter(new Canvas(second),p,5100,true);
   OledNewsChrome.base(new Canvas(blank),p);OledNewsChrome.brandFooter(new Canvas(blank),p,4000,true);
   int altered=0;
   for(int y=104;y<122;y++)for(int x=809;x<923;x++){
    if(first.getPixel(x,y)!=second.getPixel(x,y))altered++;
    assertEquals("switching point must contain no address glyphs",
      0xff333436,blank.getPixel(x,y));
   }
   assertTrue("site and Telegram must have distinct visual labels",altered>40);
   assertEquals("background-only during transition",0xff333436,blank.getPixel(850,112));
  }finally{first.recycle();second.recycle();blank.recycle();}
 }
 @Test public void bothAddressesAreHorizontallyCenteredInTheGreyPlate(){
  for(long at:new long[]{1200,5100}){
   Bitmap bitmap=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
   try{
    Canvas canvas=new Canvas(bitmap);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    OledNewsChrome.base(canvas,paint);
    OledNewsChrome.brandFooter(canvas,paint,at,true);
    int left=960,right=0,count=0;
    for(int y=105;y<=121;y++)for(int x=804;x<925;x++){
     int pixel=bitmap.getPixel(x,y);
     if(Color.red(pixel)>155&&Color.green(pixel)>155&&Color.blue(pixel)>155){
      left=Math.min(left,x);right=Math.max(right,x);count++;
     }
    }
    assertTrue("address label must be readable",count>40);
    assertEquals("address centered within expanded grey block",(OledNewsChrome.BRAND_PLATE_LEFT+OledNewsChrome.RIGHT)/2f,(left+right)/2f,6f);
    assertTrue("address label may not touch box edges",left>=OledNewsChrome.BRAND_PLATE_LEFT+3&&right<=OledNewsChrome.RIGHT-3);
   }finally{bitmap.recycle();}
  }
 }
 @Test public void allCategoriesRestOnAnExtendedOledBodyAndMarketPanelsRemainBalanced(){
  Context context=RuntimeEnvironment.getApplication();long now=System.currentTimeMillis();
  WeatherForecast.Summary sky=new WeatherForecast.Summary(
   "24°C","Sol entre nuvens","Vento 17 km/h","Umidade 74%","Modelo horário",now+600000,false,
   "24°C","24°C","74%","17 km/h","19 km/h","PartlyCloudy");
  TvBroadcastInfoView weather=TvBroadcastInfoView.weather(context,null,sky,false);
  TvBroadcastInfoView voice=TvBroadcastInfoView.voiceStatus(context,"Consulta","Sismo no Brasil");
  TvBroadcastInfoView market=TvBroadcastInfoView.market(context,
    new BrentQuote(92.41,95.85,-3.44,-3.58,now,"Yahoo Finance"),
    new DollarQuote(5.7835,.12,2.06,now,"Yahoo Finance"),false);
  for(TvBroadcastInfoView view:new TvBroadcastInfoView[]{weather,voice,market}){
   int height=126+view.mapSpace;view.layout(0,0,960,height);
   view.startPresentation(android.os.SystemClock.uptimeMillis()-1200,false);
   Bitmap b=Bitmap.createBitmap(960,height,Bitmap.Config.ARGB_8888);
   try{
    view.draw(new Canvas(b));
    int offset=view.mapSpace;
    assertEquals("OLED covers label background, not TV content",view==market?0xfff4f5f6:Color.BLACK,b.getPixel(20,offset+90));
    assertEquals("left safe overscan",0,Color.alpha(b.getPixel(0,offset+80)));
    assertEquals("right overscan",0,Color.alpha(b.getPixel(946,offset+80)));
   }finally{b.recycle();}
  }
  assertTrue("Brent panel and USD panel must have comparable widths",
    (TvBroadcastInfoView.MARKET_DIVIDER_X-130)>320);
  assertTrue("USD column must no longer be squeezed into 250 units",
    (829-TvBroadcastInfoView.MARKET_DOLLAR_X)>320);
  assertTrue("market labels and percentage do not collide",
    TvBroadcastInfoView.MARKET_DOLLAR_STATUS_X-TvBroadcastInfoView.MARKET_DOLLAR_X>=190);
 }
 @Test public void finalRefinementsIncreaseLogoAndFooterLegibilityWithoutOverlaps(){
  assertEquals(56f,OledNewsChrome.LOGO_SIZE,0f);
  assertEquals(790f,OledNewsChrome.BRAND_PLATE_LEFT,0f);
  assertEquals("BRENT · 92,41      •      DÓLAR · R$ 5,79",
    OledNewsChrome.tickerDisplay("BRENT · 92,41 • DÓLAR · R$ 5,79"));
  assertEquals("",OledNewsChrome.tickerDisplay(null));
  assertTrue("larger gray plate leaves safe right overscan",OledNewsChrome.RIGHT<936);
  assertTrue("footer is tall enough for the new 14-point letter baseline",OledNewsChrome.FOOTER_END-99>=26);
 }
 @Test public void redTabsSitAboveTheOledBodyAndBreakingNewsIsShorter(){
  Bitmap b=skin("BREAKING NEWS","COTAÇÕES");
  try{
   assertEquals(254f,OledNewsChrome.LEFT_TAB_RIGHT,0f);
   assertTrue("left badge ends before 260",OledNewsChrome.LEFT_TAB_RIGHT<260f);
   assertEquals("red tabs meet OLED band without a gap",OledNewsChrome.BODY_TOP,OledNewsChrome.TAB_BOTTOM,0f);
   for(int x:new int[]{30,120,240,811,855,916}){
    assertEquals("solid red tab bottom at "+x,255,Color.alpha(b.getPixel(x,29)));
    assertTrue("red tab bottom remains red at "+x,Color.red(b.getPixel(x,29))>Color.green(b.getPixel(x,29))*2);
    assertEquals("continuous opaque OLED body below "+x,255,Color.alpha(b.getPixel(x,30)));
   }
   assertEquals("pitch black below left red tab",Color.BLACK,b.getPixel(180,31));
   assertEquals("pitch black below right red tab",Color.BLACK,b.getPixel(855,31));
   assertEquals("unused upper left area stays transparent",0,Color.alpha(b.getPixel(274,12)));
   assertEquals("right tab remains visible",255,Color.alpha(b.getPixel(820,12)));
  }finally{b.recycle();}
 }
 @Test public void greyDestinationPlateIsFullHeightWithLegibleBrandInscriptions(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   for(int y=94;y<126;y++){
    assertEquals("no short grey footer at y "+y,0xff333436,b.getPixel(792,y));
    assertEquals("no uncovered far-right grey region at y "+y,0xff333436,b.getPixel(924,y));
   }
   int upperGold=0,lowerGold=0;
   for(int x=846;x<=910;x++){
    for(int y=38;y<45;y++){
     int p=b.getPixel(x,y);
     if(Color.red(p)>140&&Color.green(p)>85&&Color.blue(p)<185)upperGold++;
    }
    for(int y=85;y<=93;y++){
     int p=b.getPixel(x,y);
     if(Color.red(p)>140&&Color.green(p)>85&&Color.blue(p)<185)lowerGold++;
    }
   }
   assertTrue("Greek PANOPTES top inscription must show",upperGold>10);
   assertTrue("Latin CUSTOS ORBIS bottom inscription must show",lowerGold>10);
  }finally{b.recycle();}
 }
 @Test public void clockAndTickerShareTheNewsSansSerifFamily(){
  assertEquals(android.graphics.Typeface.BOLD,OledNewsChrome.clockFont().getStyle());
  assertEquals(OledNewsChrome.titleFont(null).toString(),OledNewsChrome.clockFont().toString());
  assertEquals(OledNewsChrome.regularFont().toString(),OledNewsChrome.tickerFont().toString());
 }
 @Test public void categorySideRuleIsThinnerAndDoesNotPushContentOffTheBody(){
  Bitmap b=skin("BREAKING NEWS","AO VIVO");
  try{
   assertEquals("three-unit left red rule",OledNewsChrome.RED_DARK,b.getPixel(9,63));
   assertEquals("black starts right after thin rule",Color.BLACK,b.getPixel(12,63));
   assertEquals("category area remains opaque",255,Color.alpha(b.getPixel(18,63)));
  }finally{b.recycle();}
 }
 @Test public void tickerTextUsesSoftFadeRatherThanHardHalfLettersAtClipEdges(){
  Bitmap b=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{
   Canvas c=new Canvas(b);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
   int layer=c.saveLayer(112,95,782,124,null);
   p.setColor(Color.WHITE);c.drawRect(112,105,782,118,p);
   OledNewsChrome.fadeTickerEdges(c,112,782);
   c.restoreToCount(layer);
   assertTrue("ticker entry is softly transparent",Color.alpha(b.getPixel(112,110))<32);
   assertTrue("ticker fade ramps up progressively",Color.alpha(b.getPixel(120,110))>40);
   assertEquals("center must remain fully legible",255,Color.alpha(b.getPixel(160,110)));
   assertTrue("ticker exit softly fades",Color.alpha(b.getPixel(781,110))<48);
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

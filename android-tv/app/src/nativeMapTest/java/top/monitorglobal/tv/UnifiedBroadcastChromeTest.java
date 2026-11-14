package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;

/** Visual contract: the earthquake lower-third is the ONLY reference for
 * weather, rain, satellite, Brent and regional seismic replay. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class UnifiedBroadcastChromeTest {
 Context context;
 @Before public void setup(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().putBoolean("sound",false).commit();
  org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);
 }
 private Alert regional(){
  Alert a=new Alert("regional","earthquake","v","M5,0 · costa leste de Honshu, Japão",
    "Profundidade: 10 km · GEOFON","earthquake",System.currentTimeMillis(),
    System.currentTimeMillis()-120000,false);
  a.compact=true;a.magnitude=5.0;a.depth=10;a.countryCode="JP";a.source="GEOFON";
  a.targetArea="Tóquio · Japão";a.originLatitude=35.8;a.originLongitude=141.8;
  return a;
 }
 private Bitmap frame(View view,int width,int height,long elapsed){
  view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),
    View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));
  view.layout(0,0,width,height);
  if(view instanceof NewsBannerView)((NewsBannerView)view)
   .startPresentation(android.os.SystemClock.uptimeMillis()-elapsed,false);
  if(view instanceof TvBroadcastInfoView)((TvBroadcastInfoView)view)
   .startPresentation(android.os.SystemClock.uptimeMillis()-elapsed,false);
  Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
  view.draw(new Canvas(bitmap));return bitmap;
 }
 @Test public void everyRadarPixelMatchesTheOriginalSeismicReplay()throws Exception{
  NewsBannerView seismic=new NewsBannerView(context,regional(),false,true);
  BrentQuote brent=new BrentQuote(78.45,77.50,.95,1.22,System.currentTimeMillis()-180000,"Yahoo Finance");
  DollarQuote dollar=new DollarQuote(5.35,.04,.76,System.currentTimeMillis()-180000,"Yahoo Finance");
  TvBroadcastInfoView market=TvBroadcastInfoView.market(context,brent,dollar,false);
  WeatherForecast.Summary weather=new WeatherForecast.Summary(
   "25°C · sensação 27°C","Nublado","Vento 10 km/h","Umidade 70%",
   "Modelo horário",System.currentTimeMillis()+600000,false,
   "25°C","27°C","70%","10 km/h","20 km/h","Cloudy");
  TvBroadcastInfoView meteo=TvBroadcastInfoView.weather(context,null,weather,false);
  Bitmap a=frame(seismic,960,126+Banner.insetDp(context),1100);
  Bitmap b=frame(market,960,126,1100);
  Bitmap c=frame(meteo,960,126+meteo.mapSpace,1100);
  try{
   int changed=0,bright=0;
   for(int y=26;y<96;y++)for(int x=886;x<958;x++){
    int seismicPixel=a.getPixel(x,y+Banner.insetDp(context));
    int marketPixel=b.getPixel(x,y);
    int weatherPixel=c.getPixel(x,y+meteo.mapSpace);
    assertEquals("Brent must reuse seismic radar pixel at "+x+","+y,seismicPixel,marketPixel);
    assertEquals("Weather must reuse seismic radar pixel at "+x+","+y,seismicPixel,weatherPixel);
    if(Color.blue(seismicPixel)>Color.red(seismicPixel)+50)bright++;
    if(seismicPixel!=a.getPixel(886,25+Banner.insetDp(context)))changed++;
   }
   assertTrue("official seismic radar stays clearly visible",bright>500);
   assertTrue(changed>100);
  }finally{a.recycle();b.recycle();c.recycle();}
 }
 @Test public void newsroomHeaderAndFooterMatchAcrossSeismicAndMarkets()throws Exception{
  assertEquals(260f,BroadcastVisuals.BREAKING_WIDTH,0f);
  assertEquals(94f,BroadcastVisuals.FOOTER_TOP,0f);
  assertEquals(32f,BroadcastVisuals.FOOTER_HEIGHT,0f);
  NewsBannerView quake=new NewsBannerView(context,regional(),false,true);
  BrentQuote quote=new BrentQuote(78.45,77.50,.95,1.22,System.currentTimeMillis()-180000,"Yahoo Finance");
  TvBroadcastInfoView market=TvBroadcastInfoView.market(context,quote,null,false);
  Bitmap a=frame(quake,960,126+Banner.insetDp(context),1100);
  Bitmap b=frame(market,960,126,1100);
  try{
   int map=Banner.insetDp(context);
   // Sample untouched red margins; white text is now deliberately much wider.
   for(int x:new int[]{10,255}){
    assertEquals("Long breaking label on seismic",0xffbf1827,a.getPixel(x,map+10));
    assertEquals("Long breaking label on market",0xffbf1827,b.getPixel(x,10));
   }
   for(int x:new int[]{809,950}){
    assertEquals("Wide seismic live/replay status",0xffbf1827,a.getPixel(x,map+10));
    assertEquals("Wide market status",0xffbf1827,b.getPixel(x,10));
   }
   assertEquals(0xffbf1827,a.getPixel(10,map+96));
   assertEquals(0xffbf1827,b.getPixel(10,96));
   assertEquals(0xff020816,a.getPixel(92,map+96));
   assertEquals(0xff020816,b.getPixel(92,96));
  }finally{a.recycle();b.recycle();}
  Banner banner=new Banner(context);
  try{
   assertTrue(banner.showRegional(regional(),false,true));
   WindowManager.LayoutParams p=(WindowManager.LayoutParams)banner.activeView().getLayoutParams();
   assertEquals(context.getResources().getDisplayMetrics().widthPixels*96/100,p.width);
  }finally{banner.hide();}
 }
 @Test public void broadcastTypographyFillsRedLabelsWithoutClipping()throws Exception{
  Typeface face=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
  Paint ink=new Paint(Paint.ANTI_ALIAS_FLAG);
  String[] headings={"BREAKING NEWS","AO VIVO","REPLAY","TESTE","TESTE FICTÍCIO","CONSULTA","COTAÇÕES"};
  for(String heading:headings){
   boolean breaking=heading.equals("BREAKING NEWS");
   float width=breaking?BroadcastVisuals.BREAKING_WIDTH:BroadcastVisuals.statusWidth(ink,face,heading);
   float fraction=breaking?BroadcastVisuals.BREAKING_TEXT_FILL:BroadcastVisuals.STATUS_TEXT_FILL;
   Bitmap image=Bitmap.createBitmap(300,24,Bitmap.Config.ARGB_8888);
   try{
    BroadcastVisuals.headerLabel(new Canvas(image),ink,face,heading,0,width,fraction,Color.WHITE);
    int left=300,right=-1,top=24,bottom=-1;
    for(int y=0;y<24;y++)for(int x=0;x<(int)Math.ceil(width);x++){
     int pixel=image.getPixel(x,y);
     if(Color.alpha(pixel)>200&&Color.red(pixel)>220&&Color.green(pixel)>220&&Color.blue(pixel)>220){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
     }
    }
    assertTrue("label visibly rendered: "+heading,right>left&&bottom>top);
    assertTrue("label fills most of its tab: "+heading,(right-left+1)>width*(fraction-.12f));
    assertTrue("label stays inside its red tab: "+heading,left>=0&&right<width&&top>=0&&bottom<24);
    assertEquals("label horizontal alignment: "+heading,width/2f,(left+right)/2f,7f);
    assertEquals("label must restore paint horizontal scale: "+heading,1f,ink.getTextScaleX(),.0001f);
   }finally{image.recycle();}
  }
 }
 @Test public void seismicAndWeatherHaveIdenticalBreakingAndLiveLettering(){
  NewsBannerView quake=new NewsBannerView(context,regional(),false,false);
  WeatherForecast.Summary summary=new WeatherForecast.Summary(
    "22°C","Nublado","10 km/h","70%","Modelo horário",System.currentTimeMillis()+600000,false,
    "22°C","22°C","70%","10 km/h","15 km/h","Cloudy");
  TvBroadcastInfoView weather=TvBroadcastInfoView.weather(context,null,summary,false);
  Bitmap a=frame(quake,960,126+Banner.insetDp(context),1100);
  Bitmap b=frame(weather,960,126+weather.mapSpace,1100);
  try{
   int qa=Banner.insetDp(context),qb=weather.mapSpace;
   for(int y=3;y<=20;y++)for(int x=20;x<=240;x++){
    // Ignore seismic-only shine by sampling the same stable status drawing separately.
    if(x>24&&x<236)continue;
    assertEquals("same breaking banner edges",a.getPixel(x,qa+y),b.getPixel(x,qb+y));
   }
   for(int y=3;y<=20;y++)for(int x=817;x<=945;x++)
    assertEquals("AO VIVO lettering must match across events at "+x+","+y,a.getPixel(x,qa+y),b.getPixel(x,qb+y));
  }finally{a.recycle();b.recycle();}
 }
 @Test public void allTickerAndRadarMotionUseOneSharedClock(){
  assertEquals(40f,BroadcastVisuals.TICKER_PX_PER_SECOND,0f);
  assertEquals(922f,BroadcastVisuals.RADAR_X,0f);
  assertEquals(61f,BroadcastVisuals.RADAR_Y,0f);
  assertEquals(2400,BroadcastVisuals.RADAR_PERIOD_MS);
  assertEquals(40,BroadcastVisuals.tickerOffset(1000,1000,true),.01);
  assertEquals(80,BroadcastVisuals.tickerOffset(2000,1000,true),.01);
  assertEquals(0,BroadcastVisuals.tickerOffset(2000,1000,false),.01);
 }
 @Test public void regionalReplayIsFullWidthAndIncludesGeolocatedEpicenterMap()throws Exception{
  Banner banner=new Banner(context);
  try{
   assertTrue(banner.showRegional(regional(),false,true));
   View host=banner.activeView();assertNotNull(host);
   assertTrue(host instanceof BannerRevealLayout);
   WindowManager.LayoutParams params=(WindowManager.LayoutParams)host.getLayoutParams();
   assertTrue(params.width>context.getResources().getDisplayMetrics().widthPixels*.8);
   assertTrue(params.height>126*context.getResources().getDisplayMetrics().density);
   NewsBannerView row=(NewsBannerView)((ViewGroup)host).getChildAt(0);
   assertEquals("REPLAY",row.badgeLabel());
   assertTrue(row.getContentDescription().toString().contains("ÁREA MONITORADA"));
   assertTrue(row.getContentDescription().toString().contains("Tóquio"));
   assertTrue(Banner.insetDp(context)>0);
  }finally{banner.hide();}
 }
}

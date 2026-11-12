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
   for(int y=26;y<96;y++)for(int x=884;x<958;x++){
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

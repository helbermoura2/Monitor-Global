package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
import android.view.*;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.FileOutputStream;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class TvBroadcastInfoViewTest {
 private Context c;
 @Before public void setup(){c=RuntimeEnvironment.getApplication();}
 private Bitmap render(TvBroadcastInfoView view,String label)throws Exception{
  int width=960,height=126+view.mapSpace;
  view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),
   View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));
  view.layout(0,0,width,height);view.startPresentation(android.os.SystemClock.uptimeMillis()-1200,false);
  Bitmap b=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);view.draw(new Canvas(b));
  try(FileOutputStream out=new FileOutputStream("/tmp/monitor-tv-newsroom-"+label+".png")){
   assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));
  }
  return b;
 }
 @Test public void weatherHasMapAboveLiveBreakingNewsWithoutChangingSourceData()throws Exception{
  WeatherForecast.Summary weather=new WeatherForecast.Summary(
   "22°C · sensação 23°C","Nublado","Vento 12 km/h","Umidade 81%",
   "Modelo horário",System.currentTimeMillis()+600000,false,"22°C","23°C","81%","12 km/h","19 km/h","Cloudy");
  TvBroadcastInfoView view=TvBroadcastInfoView.weather(c,null,weather,false);
  assertTrue(view.mapSpace>=80);
  String accessible=String.valueOf(view.getContentDescription());
  assertTrue(accessible.contains("Nublado"));assertTrue(accessible.contains("22°C"));
  Bitmap b=render(view,"weather");
  try{assertTrue("strip has a solid broadcast background",Color.alpha(b.getPixel(500,view.mapSpace+50))>240);
   assertEquals("red breaking news start",0xffbf1827,b.getPixel(10,view.mapSpace+10));
  }finally{b.recycle();}
 }
 @Test public void weatherKeepsOriginalIndependentMetricColumns()throws Exception{
  long validUntil=System.currentTimeMillis()+600000;
  WeatherForecast.Summary first=new WeatherForecast.Summary(
   "22°C · sensação 23°C","Nublado","Vento 12 km/h","Umidade 81%",
   "Modelo horário",validUntil,false,"22°C","23°C","81%","12 km/h","19 km/h","Cloudy");
  WeatherForecast.Summary changed=new WeatherForecast.Summary(
   "17°C · sensação 23°C","Nublado","Vento 5 km/h","Umidade 47%",
   "Modelo horário",validUntil,false,"17°C","23°C","47%","5 km/h","8 km/h","Cloudy");
  TvBroadcastInfoView oldCard=TvBroadcastInfoView.weather(c,null,first,false);
  TvBroadcastInfoView newCard=TvBroadcastInfoView.weather(c,null,changed,false);
  Bitmap a=render(oldCard,"original-weather-columns");
  Bitmap b=render(newCard,"changed-weather-columns");
  try{
   int top=oldCard.mapSpace;
   // Values must be in four dedicated horizontal columns, as in TV 1.0.88.
   // The accidental 1.0.89 rewrite moved temperature and grouped all metrics
   // into a tiny line, which would fail these pixel-region comparisons.
   int[][] valueColumns={{124,235,44,69},{520,616,49,71},{653,753,49,71},{786,865,49,71}};
   for(int i=0;i<valueColumns.length;i++){
    int[] rect=valueColumns[i],changedPixels=0;
    for(int y=top+rect[2];y<top+rect[3];y++)
     for(int x=rect[0];x<rect[1];x++)
      if(a.getPixel(x,y)!=b.getPixel(x,y))changedPixels++;
    assertTrue("Separate weather metric "+i+" must be readable in its old position: "+changedPixels,
      changedPixels>12);
   }
   // The weather-condition icon and descriptive column stay independent of
   // the four numeric values; they must not move when a metric changes.
   for(int y=top+42;y<top+90;y++)for(int x=251;x<481;x++)
    assertEquals("Condition column should not change with temperature, humidity or wind",
      a.getPixel(x,y),b.getPixel(x,y));
  }finally{a.recycle();b.recycle();}
 }
 @Test public void brentAndDollarAlwaysShareSameStripAndClearlyMarkMissingFX()throws Exception{
  BrentQuote brent=new BrentQuote(78.35,77.5,.85,1.1,System.currentTimeMillis()-300000,"Yahoo Finance");
  DollarQuote dollar=new DollarQuote(5.32,.02,.38,System.currentTimeMillis()-240000,"Yahoo Finance");
  TvBroadcastInfoView view=TvBroadcastInfoView.market(c,brent,dollar,false);
  assertEquals(0,view.mapSpace);
  assertTrue(String.valueOf(view.getContentDescription()).contains("+0,38%"));
  assertTrue(String.valueOf(view.getContentDescription()).contains("US$ 78,35"));
  assertTrue(String.valueOf(view.getContentDescription()).contains("R$ 5,32"));
  Bitmap b=render(view,"brent-dollar");
  try{assertEquals(126,b.getHeight());assertEquals(0xffbf1827,b.getPixel(10,10));}
  finally{b.recycle();}
  TvBroadcastInfoView missing=TvBroadcastInfoView.market(c,brent,null,false);
  assertTrue(String.valueOf(missing.getContentDescription()).contains("DÓLAR USD/BRL · STATUS N/D: sem cotação confirmada"));
  TvBroadcastInfoView demo=TvBroadcastInfoView.market(c,brent,dollar,true);
  assertTrue(String.valueOf(demo.getContentDescription()).contains("SIMULAÇÃO"));
 }
 @Test public void brentMarketStateUsesSameTopRowAsDollarWithNoLowerLeftBadge()throws Exception{
  assertEquals("ABERTO",TvBroadcastInfoView.marketHeaderStatus(new MarketState(MarketState.OPEN,"fonte")));
  assertEquals("FECHADO",TvBroadcastInfoView.marketHeaderStatus(new MarketState(MarketState.CLOSED,"fonte")));
  assertEquals("PAUSADO",TvBroadcastInfoView.marketHeaderStatus(new MarketState(MarketState.PAUSED,"fonte")));
  assertEquals("N/D",TvBroadcastInfoView.marketHeaderStatus(MarketState.unknown()));
  Paint measure=new Paint(Paint.ANTI_ALIAS_FLAG);
  measure.setTypeface(Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf"));measure.setTextSize(12);
  for(String label:new String[]{"ABERTO","FECHADO","PAUSADO","N/D"})
   assertTrue("Brent header badge must not overlap price: "+label,measure.measureText(label)<60);
  for(int state:new int[]{MarketState.OPEN,MarketState.CLOSED,MarketState.PAUSED}){
   MarketState market=new MarketState(state,"Informado pela fonte");
   TvBroadcastInfoView view=TvBroadcastInfoView.market(c,null,null,market,market,false);
   Bitmap image=render(view,"aligned-brent-"+state);
   try{
    // A quoted session can transition while tests run (e.g. Friday market close).
    // Assert the color of the ACTUAL time-adjusted session being rendered.
    java.lang.reflect.Field sessionField=TvBroadcastInfoView.class.getDeclaredField("brentSession");
    sessionField.setAccessible(true);
    MarketState onScreen=(MarketState)sessionField.get(view);
    int tint=onScreen.value==MarketState.OPEN?0xff75edb2:onScreen.value==MarketState.CLOSED?0xffff7687:onScreen.value==MarketState.PAUSED?0xffffd17d:0xffb8d2df;
    int top=0,bottom=0;
    // The new header badge is in the SAME y=44 baseline as the USD/BRL badge.
    for(int y=28;y<=44;y++)for(int x=75;x<=135;x++){
     int pixel=image.getPixel(x,y);
     if(Color.red(pixel)==Color.red(tint)&&Color.green(pixel)==Color.green(tint)&&Color.blue(pixel)==Color.blue(tint))top++;
    }
    for(int y=70;y<=95;y++)for(int x=12;x<=120;x++){
     int pixel=image.getPixel(x,y);
     if(Color.red(pixel)==Color.red(tint)&&Color.green(pixel)==Color.green(tint)&&Color.blue(pixel)==Color.blue(tint))bottom++;
    }
    assertTrue("Brent status should be visible on top row: "+state,top>5);
    assertEquals("No duplicate ABERTO/FECHADO/PAUSADO beneath Brent",0,bottom);
   }finally{image.recycle();}
  }
 }
 @Test public void AlexaBrentPendingAndOtherVoiceStatusUseIdenticalNewsroomGeometry()throws Exception{
  TvBroadcastInfoView pending=TvBroadcastInfoView.marketPending(c);
  TvBroadcastInfoView generic=TvBroadcastInfoView.voiceStatus(c,"Consulta do Brasil","Sem registros confirmados.");
  assertEquals(0,pending.mapSpace);assertEquals(0,generic.mapSpace);
  assertTrue(String.valueOf(pending.getContentDescription()).contains("CONSULTANDO COTAÇÃO REAL"));
  assertTrue(String.valueOf(generic.getContentDescription()).contains("Sem registros confirmados"));
  Bitmap a=render(pending,"alexa-brent-pending");
  Bitmap b=render(generic,"alexa-generic-banner");
  try{
   assertEquals(126,a.getHeight());assertEquals(126,b.getHeight());
   assertEquals(0xffbf1827,a.getPixel(10,10));
   assertEquals(0xffbf1827,b.getPixel(10,10));
   assertTrue(a.getPixel(911,60)!=0xff071724);
  }finally{a.recycle();b.recycle();}
 }
 @Test public void weatherUsesSatellitePixelsInItsOwnInset()throws Exception{
  WeatherForecast.Summary w=new WeatherForecast.Summary("22°C","Nublado","Vento 12 km/h","Umidade 81%","Modelo horário",System.currentTimeMillis()+600000,false,"22°C","23°C","81%","12 km/h","19 km/h","Cloudy");
  Bitmap image=Bitmap.createBitmap(512,300,Bitmap.Config.ARGB_8888);image.eraseColor(Color.MAGENTA);
  WeatherSatelliteClient.Frame frame=new WeatherSatelliteClient.Frame(image,null,System.currentTimeMillis()-300000,InfraredPlan.SOUTHEAST,java.util.Collections.singletonList(System.currentTimeMillis()-300000));
  TvBroadcastInfoView view=TvBroadcastInfoView.weather(c,null,w,false);view.satelliteSource(()->frame);
  Bitmap result=render(view,"weather-satellite");
  try{assertEquals(Color.MAGENTA,result.getPixel(800,80));}finally{result.recycle();frame.close();}
 }
 @Test public void hourlyRainNeverClaimsObservedRainWhenMinuteForecastIsDry()throws Exception{
  WeatherForecast.Summary model=new WeatherForecast.Summary(
   "24°C · sensação 24°C","Chuva","Vento 9 km/h","Umidade 77%",
   "Modelo horário",System.currentTimeMillis()+600000,false,
   "24°C","24°C","77%","9 km/h","17 km/h","Rain",
   System.currentTimeMillis(),System.currentTimeMillis()-900000);
  RainForecast.Summary minute=new RainForecast.Summary("dry","","Sem chuva estimada · próxima hora",0,0,
   "Término não aplicável",System.currentTimeMillis(),System.currentTimeMillis()+300000,false);
  TvBroadcastInfoView view=TvBroadcastInfoView.weather(c,minute,model,false);
  String accessible=String.valueOf(view.getContentDescription());
  assertTrue(accessible.contains("CONDIÇÃO ESTIMADA: Sem chuva estimada"));
  assertTrue(accessible.contains("MODELO HORÁRIO: Chuva"));
  assertTrue(accessible.contains("estimativa por minuto sem chuva"));
  Bitmap screenshot=render(view,"hourly-rain-vs-dry-minute");
  screenshot.recycle();
  TvBroadcastInfoView withoutMinute=TvBroadcastInfoView.weather(c,null,model,false);
  assertTrue(String.valueOf(withoutMinute.getContentDescription()).contains("Previsão: chuva"));
 }
 @Test public void compactWeatherRainDetailsFitTheAllocatedColumn()throws Exception{
  long now=System.currentTimeMillis();
  WeatherForecast.Summary hourly=new WeatherForecast.Summary("22°C","Chuva","Vento 4 km/h","Umidade 80%","Modelo horário",now+600000,false,"22°C","23°C","80%","4 km/h","9 km/h","Rain");
  RainForecast.Summary rain=new RainForecast.Summary("now","fraca","Chuva fraca estimada agora",1.2,1.2,"Término indefinido",now,now+300000,true,0,-1,-1,1.2,"Duração indefinida");
  assertEquals("Chuva fraca",WeatherConditionDisplay.headline(hourly,rain));
  String detail=WeatherConditionDisplay.detail(hourly,rain);assertEquals("Sensação 23°C · 1,2 mm/h",detail);
  Paint measure=new Paint();measure.setTypeface(Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf"));measure.setTextSize(16);assertTrue("Short details fit without ellipsis",measure.measureText(detail)<=190);
  Bitmap image=render(TvBroadcastInfoView.weather(c,rain,hourly,false),"weather-compact-rain");
  try(FileOutputStream out=new FileOutputStream("/tmp/monitor-tv-weather-card-compact-rain.png")){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}finally{image.recycle();}
 }
 @Test public void dedicatedRainUsesOfficialStripWithoutWeatherMetricsOrMap()throws Exception{
  RainForecast.Summary rain=new RainForecast.Summary("soon","fraca","Chuva prevista em ~10 min",0,3.2,"Pode terminar em ~45 min",System.currentTimeMillis(),System.currentTimeMillis()+600000,false,10,45,35,4.5,"Duração estimada: ~35 min");
  TvBroadcastInfoView view=TvBroadcastInfoView.rain(c,rain,null,true);assertEquals(0,view.mapSpace);
  String description=String.valueOf(view.getContentDescription());assertTrue(description.contains("3,2 mm"));assertTrue(description.contains("4,5 mm/h"));assertTrue(description.contains("35 min"));assertFalse(description.contains("Umidade"));
  Bitmap image=render(view,"rain");try{assertEquals(126,image.getHeight());assertEquals(0xffbf1827,image.getPixel(10,10));try(FileOutputStream out=new FileOutputStream("/tmp/monitor-tv-weather-card-rain-banner.png")){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}}finally{image.recycle();}
 }
 @Test public void infraredImageIsMapInsetNotAnotherCornerCard()throws Exception{
  Bitmap frame=Bitmap.createBitmap(512,300,Bitmap.Config.ARGB_8888);
  WeatherSatelliteClient.Frame image=new WeatherSatelliteClient.Frame(frame,null,System.currentTimeMillis()-300000,
   InfraredPlan.SOUTHEAST,java.util.Collections.singletonList(System.currentTimeMillis()-300000));
  TvBroadcastInfoView view=TvBroadcastInfoView.satellite(c,image,"");
  assertTrue(view.mapSpace>0);assertTrue(String.valueOf(view.getContentDescription()).contains("GOES-EAST"));
  Bitmap screenshot=render(view,"satellite");
  screenshot.recycle();frame.recycle();
 }
}


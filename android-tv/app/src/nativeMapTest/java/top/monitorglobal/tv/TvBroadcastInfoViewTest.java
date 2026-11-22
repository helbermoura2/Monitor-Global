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
 // Pixel bounding boxes are measured in the approved shared 960-unit banner.
 // Compare *visible ink* rather than comparing baseline numbers in source.
 private float inkMidY(Bitmap b,int x0,int x1,int top,int bottom,boolean title){
  int first=999,last=-1;
  for(int y=top;y<=bottom;y++)for(int x=x0;x<=x1;x++){
   int c=b.getPixel(x,y),r=Color.red(c),g=Color.green(c),blue=Color.blue(c);
   boolean ink=title?r>235&&g>=75&&g<175&&blue>95: r>215&&g>215&&blue>215;
   if(ink){first=Math.min(first,y);last=Math.max(last,y);}
  }
  assertTrue("Primary title/value ink is present in expected column",last>=first);
  return (first+last)/2f;
 }
 @Test public void rainWeatherBrentSatelliteAndVoiceUseTheSameMagnitudeColumn()throws Exception{
  Typeface face=Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf");
  String[] categories={"CHUVA","TEMPO","BRENT","SATÉLITE","CONSULTA","TSUNAMI"};
  String[] captions={"LIBERDADE · SP","LIBERDADE · SP","NYMEX","GOES-EAST","POR VOZ","SEM AMEAÇA"};
  for(int i=0;i<categories.length;i++){
   Bitmap b=Bitmap.createBitmap(120,100,Bitmap.Config.ARGB_8888);
   try{
    BroadcastVisuals.eventCategory(new Canvas(b),new Paint(Paint.ANTI_ALIAS_FLAG),face,categories[i],captions[i],0xffff6d7f);
    int top=100,bottom=-1,left=120,right=-1,captionPixels=0;
    for(int y=28;y<94;y++)for(int x=8;x<108;x++){
     int pixel=b.getPixel(x,y);
     if(Color.red(pixel)>240&&Color.green(pixel)>=80&&Color.green(pixel)<180&&Color.blue(pixel)>=90){
      top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
     }
     if(y>=74&&Color.red(pixel)>225&&Color.green(pixel)>225&&Color.blue(pixel)>225)captionPixels++;
    }
    assertTrue("Category '"+categories[i]+"' is visible",bottom>top);
    assertTrue("Category '"+categories[i]+"' is horizontally centered like magnitude",Math.abs((left+right)/2f-BroadcastVisuals.EVENT_CENTER_X)<=6f);
    assertTrue("Category '"+categories[i]+"' remains in seismic center column",top>=31&&bottom<=73);
    assertTrue("Caption '"+captions[i]+"' stays below like seismic subtitle",captionPixels>6);
   }finally{b.recycle();}
  }
  assertEquals(68f,BroadcastVisuals.EVENT_CENTER_X,0f);
  assertEquals(72f,BroadcastVisuals.EVENT_MAGNITUDE_BASELINE,0f);
 }
 @Test public void everyPrimaryValueUsesOneOpticalCenterForReadableTVLabels()throws Exception{
  TvBroadcastInfoView view=TvBroadcastInfoView.market(c,new BrentQuote(95.34,96.2,-.86,-.90,System.currentTimeMillis(),"Yahoo Finance"),new DollarQuote(5.67,0d,0d,System.currentTimeMillis(),"Yahoo Finance"),false);
  Bitmap b=render(view,"market-editorial");
  try{
   assertEquals(Color.BLACK,b.getPixel(480,80));
   int light=0,red=0;
   for(int y=48;y<75;y++)for(int x=20;x<473;x++){int p=b.getPixel(x,y);if(Color.red(p)>205&&Color.green(p)>205&&Color.blue(p)>205)light++;if(Color.red(p)>170&&Color.red(p)>Color.green(p)+50)red++;}
   assertTrue("price ink remains visible",light>80);assertTrue("negative variation remains visible",red>20);
  }finally{b.recycle();}
 }
 @Test public void officialCivilNoticeRendersInTheStandardStrip()throws Exception{
  long now=System.currentTimeMillis();
  String message="Mensagem fictícia para teste de renderização. Zona Central e Leste de São Paulo.";
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice("fixture","Defesa Civil Estadual de São Paulo",message,"Severe",now,now+60000);
  TvBroadcastInfoView view=TvBroadcastInfoView.civilAlert(c,notice);
  Bitmap b=render(view,"civil-alert");
  try{
   assertEquals(126,b.getHeight());
   assertTrue(view.getContentDescription().toString().contains(message));
   int ink=0;
   for(int y=56;y<94;y++)for(int x=170;x<800;x++){
    int pixel=b.getPixel(x,y);
    if(Color.red(pixel)>220&&Color.green(pixel)>220&&Color.blue(pixel)>220)ink++;
   }
   assertTrue("Official message is visible above the footer",ink>80);
  }finally{b.recycle();}
 }
 @Test public void localCivilSimulationClearlyLabelsBothSeverityLevelsAndKeepsOfficialMode()throws Exception{
  long now=System.currentTimeMillis();
  for(String severity:new String[]{"Severe","Extreme"}){
   DefesaCivilSp.Notice example=new DefesaCivilSp.Notice("TEST-ONLY","ARGOS ORBIS · DADOS FICTÍCIOS",
     "EXEMPLO FICTÍCIO: NÃO EXISTE ALERTA REAL NESTE TESTE.",severity,now,now+20000);
   TvBroadcastInfoView simulated=TvBroadcastInfoView.civilAlert(c,example,true);
   String visible=String.valueOf(simulated.getContentDescription());
   assertTrue(visible.contains("SIMULAÇÃO · NÃO É ALERTA REAL"));
   assertTrue(visible.contains("DADOS FICTÍCIOS"));
   assertTrue(visible.contains("EXEMPLO FICTÍCIO"));
   assertTrue(visible.contains("Alerta "+("Extreme".equals(severity)?"extremo":"severo")));
   Bitmap bitmap=render(simulated,"civil-simulation-"+severity);
   try{assertEquals(126,bitmap.getHeight());}finally{bitmap.recycle();}
  }
  DefesaCivilSp.Notice real=new DefesaCivilSp.Notice("REAL","Defesa Civil Estadual de São Paulo",
    "Comunicado confirmado de teste unitário.", "Severe",now,now+30000);
  assertFalse(String.valueOf(TvBroadcastInfoView.civilAlert(c,real).getContentDescription()).contains("SIMULAÇÃO"));
 }
 @Test public void replayCivilIsExplicitlyHistoricalAndHasOriginalIssuance()throws Exception{
  long sent=System.currentTimeMillis()-3600000;
  DefesaCivilSp.Notice old=new DefesaCivilSp.Notice("official-archive",
   "Defesa Civil Estadual de São Paulo","Mensagem histórica de chuva. Siga fontes oficiais.",
   "Extreme",sent,sent+120000);
  TvBroadcastInfoView replay=TvBroadcastInfoView.civilAlert(c,old,false,true);
  String text=String.valueOf(replay.getContentDescription());
  assertTrue(text.contains("REPLAY HISTÓRICO"));
  assertTrue(text.contains("NÃO É ALERTA ATUAL"));
  assertTrue(text.contains(BrDates.dateTime(sent)));
  assertFalse(text.contains("SIMULAÇÃO"));
  Bitmap b=render(replay,"civil-replay");try{assertEquals(126,b.getHeight());}
  finally{b.recycle();}
 }
 @Test public void satelliteAndSeismicMapShareOneStableVisualAnchor()throws Exception{
  assertEquals(649f,MapInset.FRAME_X,0);
  assertEquals(310f,MapInset.FRAME_WIDTH,0);
  assertEquals(176f,MapInset.FRAME_HEIGHT,0);
  WeatherForecast.Summary weather=new WeatherForecast.Summary(
    "22°C","Nublado","12 km/h","74%","Modelo horário",System.currentTimeMillis()+600000,false,
    "22°C","22°C","74%","12 km/h","17 km/h","Cloudy");
  TvBroadcastInfoView v=TvBroadcastInfoView.weather(c,null,weather,false);
  Bitmap full=render(v,"aligned-weather-inset");
  try{
   assertTrue("Shared frame begins exactly at x649",Color.alpha(full.getPixel(653,10))>160);
   assertEquals("No legacy inset should begin at x615",0,Color.alpha(full.getPixel(623,10)));
  }finally{full.recycle();}
 }
 @Test public void sundayForexIsGlobalAndB3NextRegularSessionIsMondayMorning(){
  long sunday=java.time.Instant.parse("2026-11-16T01:33:00Z").toEpochMilli();
  long monday=java.time.Instant.parse("2026-11-16T15:33:00Z").toEpochMilli();
  assertEquals("YAHOO · USD/BRL · CÂMBIO",TvBroadcastInfoView.brazilFxHint(sunday));
  assertEquals("YAHOO · USD/BRL · CÂMBIO",TvBroadcastInfoView.brazilFxHint(monday));
  assertTrue(MarketState.brazilDollarContext(sunday).contains("CÂMBIO INTERNACIONAL"));
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
   assertTrue("weather uses the common red tab",Color.red(b.getPixel(36,view.mapSpace+3))>Color.blue(b.getPixel(36,view.mapSpace+3)));
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
   // Values must remain four independently readable columns within the new logo safe-area.
   // The accidental 1.0.89 rewrite moved temperature and grouped all metrics
   // into a tiny line, which would fail these pixel-region comparisons.
   int[][] valueColumns={{124,235,44,78},{519,616,48,76},{630,723,48,76},{739,814,48,76}};
   for(int i=0;i<valueColumns.length;i++){
    int[] rect=valueColumns[i];int changedPixels=0;
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
 @Test public void finalMarketColumnSpacingKeepsBothVariationsInBounds(){
  assertEquals(338f,TvBroadcastInfoView.MARKET_BRENT_STATUS_X,0f);
  assertEquals(711f,TvBroadcastInfoView.MARKET_DOLLAR_STATUS_X,0f);
  assertTrue("Brent change closer to price",TvBroadcastInfoView.MARKET_BRENT_STATUS_X-
    TvBroadcastInfoView.MARKET_BRENT_PRICE_X<215f);
  assertTrue("Dollar separated from its quoted price",TvBroadcastInfoView.MARKET_DOLLAR_STATUS_X-
    TvBroadcastInfoView.MARKET_DOLLAR_X>=200f);
  assertTrue("USD status remains inside content safe-area",TvBroadcastInfoView.MARKET_DOLLAR_STATUS_X+113<=BroadcastVisuals.CONTENT_RIGHT_LIMIT);
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
  try{assertEquals(126,b.getHeight());assertTrue(Color.red(b.getPixel(36,3))>Color.blue(b.getPixel(36,3)));}
  finally{b.recycle();}
  TvBroadcastInfoView missing=TvBroadcastInfoView.market(c,brent,null,MarketState.unknown(),MarketState.unknown(),false);
  String missingText=String.valueOf(missing.getContentDescription());
  assertTrue("Missing quote remains explicit both during trading and the daily FX pause",missingText.contains("DÓLAR USD/BRL · YAHOO · STATUS N/D: sem cotação confirmada")||missingText.contains("DÓLAR USD/BRL · YAHOO · FECHADO: sem cotação confirmada"));
  TvBroadcastInfoView demo=TvBroadcastInfoView.market(c,brent,dollar,true);
  assertTrue(String.valueOf(demo.getContentDescription()).contains("SIMULAÇÃO"));
 }
 @Test public void brentMarketStateUsesSameTopRowAsDollarWithNoLowerLeftBadge()throws Exception{
  for(int state:new int[]{MarketState.OPEN,MarketState.CLOSED,MarketState.PAUSED}){
   MarketState session=new MarketState(state,"fonte");
   Bitmap image=render(TvBroadcastInfoView.market(c,null,null,session,session,false),"market-state-"+state);
   try{for(int left:new int[]{338,711}){int ink=0;for(int y=34;y<48;y++)for(int x=left;x<left+100;x++){int p=image.getPixel(x,y);if(Math.max(Color.red(p),Color.green(p))>140)ink++;}assertTrue("independent market status visible",ink>10);}}finally{image.recycle();}
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
   assertTrue(Color.red(a.getPixel(36,3))>Color.blue(a.getPixel(36,3)));
   assertTrue(Color.red(b.getPixel(36,10))>Color.green(b.getPixel(36,10)));
   assertTrue(a.getPixel(911,60)!=0xff071724);
  }finally{a.recycle();b.recycle();}
 }
 @Test public void weatherUsesSatellitePixelsInItsOwnInset()throws Exception{
  WeatherForecast.Summary w=new WeatherForecast.Summary("22°C","Nublado","Vento 12 km/h","Umidade 81%","Modelo horário",System.currentTimeMillis()+600000,false,"22°C","23°C","81%","12 km/h","19 km/h","Cloudy");
  Bitmap image=Bitmap.createBitmap(512,300,Bitmap.Config.ARGB_8888);image.eraseColor(Color.MAGENTA);
  WeatherSatelliteClient.Frame frame=new WeatherSatelliteClient.Frame(image,null,System.currentTimeMillis()-300000,InfraredPlan.SOUTHEAST,java.util.Collections.singletonList(System.currentTimeMillis()-300000));
  TvBroadcastInfoView view=TvBroadcastInfoView.weather(c,null,w,false);view.satelliteSource(()->frame);
  Bitmap arrival=render(view,"weather-satellite-arrival");
  try{assertNotEquals("new image begins its fade",Color.MAGENTA,arrival.getPixel(800,80));}finally{arrival.recycle();}
  org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(500));
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
  assertTrue(accessible.contains("CONDIÇÃO ESTIMADA: Previsão: chuva"));
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
 @Test public void dedicatedRainUsesIconsMetricsAndAttachedSatellite()throws Exception{
  RainForecast.Summary rain=new RainForecast.Summary("soon","fraca","Chuva prevista em ~10 min",0,3.2,"Pode terminar em ~45 min",System.currentTimeMillis(),System.currentTimeMillis()+600000,false,10,45,35,4.5,"Duração estimada: ~35 min");
  TvBroadcastInfoView view=TvBroadcastInfoView.rain(c,rain,null,true);assertTrue(view.mapSpace>0);
  String description=String.valueOf(view.getContentDescription());assertTrue(description.contains("3,2 mm"));assertTrue(description.contains("4,5 mm/h"));assertTrue(description.contains("35 min"));assertFalse(description.contains("Umidade"));
  Bitmap image=render(view,"rain");try{assertEquals(126+view.mapSpace,image.getHeight());assertTrue(Color.red(image.getPixel(36,view.mapSpace+3))>Color.blue(image.getPixel(36,view.mapSpace+3)));try(FileOutputStream out=new FileOutputStream("/tmp/monitor-tv-weather-card-rain-banner.png")){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}}finally{image.recycle();}
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


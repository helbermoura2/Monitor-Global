package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.Locale;

/** The SAME broadcast geometry as seismic Breaking News, but no fake seismic Alert.
 * Weather / satellite map above AO VIVO, Brent + USD/BRL in the lower-third.
 * Informational banners stay silent and preserve the existing timers.
 */
final class TvBroadcastInfoView extends View {
 static final int WEATHER=1,BRENT=2,SATELLITE=3,RAIN=4,VOICE_STATUS=5;
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Typeface brand,data;
 private final int kind,accent,foreground,background;
 private final RainForecast.Summary rain;
 private final RainBannerContent rainFacts;
 private final WeatherForecast.Summary weather;
 private final BrentQuote brent;
 private final DollarQuote dollar;private MarketState brentSession,dollarSession;
 private boolean marketPending;private String voiceTitle="",voiceDetail="";
 private final WeatherSatelliteClient.Frame satellite;
 private java.util.function.Supplier<WeatherSatelliteClient.Frame> weatherSatellite;
 private final WeatherCardView.Icon[] weatherIcons=new WeatherCardView.Icon[4];
 void satelliteSource(java.util.function.Supplier<WeatherSatelliteClient.Frame> source){weatherSatellite=source;invalidate();}
 private final String satelliteStatus;
 private final boolean demo,mapBelow;
 final int mapSpace;
 private final Alert locator;
 private MapInset mapInset;
 private long marketSecond=Long.MIN_VALUE;private long started,clockMinute=Long.MIN_VALUE;private String clockText="--:--";
 private float mapReveal=1;
 private String ticker;private final String baseTicker;
 private final Path outline=new Path(),telegramPlane=new Path();
 private final float[] identityWidths=new float[2],identityTextWidths=new float[2];
 private boolean running;
 private final boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();

 private TvBroadcastInfoView(Context c,int kind,RainForecast.Summary rain,WeatherForecast.Summary weather,
                             BrentQuote brent,DollarQuote dollar,WeatherSatelliteClient.Frame satellite,
                             String status,boolean demo){
  super(c);OfficialArgosLogo.prepare(c);this.kind=kind;this.rain=rain;this.rainFacts=kind==RAIN?new RainBannerContent(rain):null;this.weather=weather;this.brent=brent;this.dollar=dollar;
  brentSession=brent==null?closedBrentOrUnknown():brent.session;dollarSession=dollar==null?MarketState.unknown():dollar.session;
  this.satellite=satellite;this.satelliteStatus=status==null?"":status;this.demo=demo;
  this.mapBelow=Prefs.get(c).getBoolean("themeTop",false);
  this.mapSpace=kind==BRENT||kind==VOICE_STATUS||(kind==WEATHER||kind==RAIN)&&!Prefs.get(c).getBoolean("weatherSatellite",true)?0:Banner.insetDp(c);
  brand=OledNewsChrome.titleFont(null);
  data=OledNewsChrome.regularFont();
  accent=Color.parseColor(Prefs.get(c).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(c).getString("themeAccent","#38bdf8"));
  foreground=OledNewsChrome.INK;
  background=OledNewsChrome.OLED;
  outline.addRoundRect(0,24,960,126,new float[]{0,0,0,0,8,8,8,8},Path.Direction.CW);
  // Match NewsBannerView's alternating site/Telegram footer exactly.
  p.setTypeface(brand);p.setTextSize(15);
  identityTextWidths[0]=p.measureText("argosorbis.com.br");
  identityTextWidths[1]=p.measureText("@argosorbis");
  identityWidths[0]=(float)Math.ceil(identityTextWidths[0])+12;
  identityWidths[1]=(float)Math.ceil(identityTextWidths[1])+34;
  telegramPlane.moveTo(-5.5f,-.5f);telegramPlane.lineTo(5,-4.5f);
  telegramPlane.lineTo(3,5);telegramPlane.lineTo(-.5f,2);
  telegramPlane.lineTo(2.5f,-1.5f);telegramPlane.lineTo(-2,1);telegramPlane.close();
  if(kind==RAIN){locator=null;ticker=(demo?"SIMULAÇÃO FICTÍCIA · ":"")+rainFacts.accessible;
  }else if(kind==WEATHER){
   locator=new Alert("weather-liberdade","weather","","","","",0,0,false);
   locator.originLongitude=RainForecast.LONGITUDE;locator.originLatitude=RainForecast.LATITUDE;
   StringBuilder t=new StringBuilder(demo?"SIMULAÇÃO FICTÍCIA · ":"");
   t.append("CONDIÇÃO ESTIMADA: ").append(WeatherConditionDisplay.headline(weather,rain));
   if(weather!=null)t.append(" · MODELO HORÁRIO: ").append(weather.condition).append(" · ").append(weather.temperature)
      .append(" · ").append(weather.humidity).append(" · ").append(weather.wind).append(" · Rajadas ").append(weather.gustValue);
   if(rain!=null)t.append(" · CHUVA POR MINUTO: ").append(rain.title).append(" · ").append(rain.amountText);
   t.append(" · ").append(WeatherConditionDisplay.sourceNote(weather,rain));
   t.append(" · Modelos meteorológicos; não representam observação direta do céu");
   ticker=t.toString();
  }else{locator=null;
   if(kind==BRENT){
    String v=brent==null?"indisponível":"US$ "+amount(brent.price);
    String usd=dollar==null?"indisponível":"R$ "+fxAmount(dollar.price);
    ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT: "+v+
      (brent!=null?" · ref. "+BrentQuote.clock(brent.at):"")+"     •     DÓLAR USD/BRL: "+usd+
      (dollar!=null?" · "+(dollar.percent==null?"Variação indisponível":(dollar.percent>=0?"+":"")+amount(dollar.percent)+"%")+" · ref. "+BrentQuote.clock(dollar.at):"")+
      "     •     Variação sobre o fechamento anterior · Fonte: Yahoo Finance · dados podem sofrer atraso";
   }else{
    ticker=(satellite!=null?"SATÉLITE GOES-EAST · "+satellite.credit()+" · "+InfraredPlan.timing(satellite.at,System.currentTimeMillis())+
      " · Infravermelho não mede intensidade da chuva":"SATÉLITE GOES-EAST · "+this.satelliteStatus);
   }
  }
  if(kind==WEATHER||kind==RAIN){int[] icons=kind==RAIN?new int[]{WeatherCardView.Icon.RAIN,WeatherCardView.Icon.DROP,WeatherCardView.Icon.RAIN,WeatherCardView.Icon.HOURGLASS}:new int[]{WeatherCardView.conditionIcon(weather==null?"":weather.conditionKey),WeatherCardView.Icon.DROP,WeatherCardView.Icon.WIND,WeatherCardView.Icon.GUST};for(int i=0;i<4;i++){weatherIcons[i]=new WeatherCardView.Icon(c,icons[i]);weatherIcons[i].layout(0,0,24,24);}}
  baseTicker=ticker;
  if(kind==WEATHER||kind==RAIN)refreshBriefing();
  setContentDescription((demo?"Teste fictício. ":"")+baseTicker+" · "+ticker);
  setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
 }
 static TvBroadcastInfoView weather(Context c,RainForecast.Summary rain,WeatherForecast.Summary weather,boolean demo){
  return new TvBroadcastInfoView(c,WEATHER,rain,weather,null,null,null,null,demo);
 }
 static TvBroadcastInfoView rain(Context c,RainForecast.Summary rain,WeatherForecast.Summary weather,boolean demo){return new TvBroadcastInfoView(c,RAIN,rain,weather,null,null,null,null,demo);}
 static TvBroadcastInfoView market(Context c,BrentQuote brent,DollarQuote dollar,boolean demo){
  TvBroadcastInfoView v=new TvBroadcastInfoView(c,BRENT,null,null,brent,dollar,null,null,demo);v.refreshMarket();return v;
 }
 private static MarketState closedBrentOrUnknown(){MarketState state=MarketState.brentRegular(System.currentTimeMillis());return state.closed()?state:MarketState.unknown();}
 static TvBroadcastInfoView market(Context c,BrentQuote b,DollarQuote d,MarketState bs,MarketState ds,boolean demo){TvBroadcastInfoView v=market(c,b,d,demo);if(bs!=null)v.brentSession=bs;if(ds!=null)v.dollarSession=ds;v.marketSecond=Long.MIN_VALUE;v.refreshMarket();return v;}
 private String variationText(Double value){return value==null?"Variação indisponível":(value>=0?"+":"")+amount(value)+"%";}
 private void refreshMarket(){
  if(kind!=BRENT)return;
  if(marketPending){
   ticker="BRENT · CONSULTANDO COTAÇÃO REAL · Verificando fontes do mercado · DÓLAR USD/BRL aguardando resultado · Sem valores fictícios";
   setContentDescription(ticker);return;
  }
  long now=System.currentTimeMillis(),sec=now/1000;if(marketSecond==sec)return;marketSecond=sec;brentSession=brentSession.current(now,true);dollarSession=MarketState.forexRegular(now).closed()?MarketState.forexRegular(now):dollarSession.current(now,false);
  ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT · NYMEX · "+brentSession.label()+": "+(brent==null?"sem cotação confirmada":"US$ "+amount(brent.price)+" · "+variationText(brent.percent)+" · "+(brentSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(brent.at))+"     •     DÓLAR USD/BRL · YAHOO · "+dollarSession.label()+": "+(dollar==null?"sem cotação confirmada":"R$ "+fxAmount(dollar.price)+" · "+variationText(dollar.percent)+" · "+(dollarSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(dollar.at))+"     •     "+MarketState.brazilDollarContext(System.currentTimeMillis())+" · "+brentSession.basis+" · "+dollarSession.basis+" · Yahoo Finance · valores indicativos sujeitos a atraso";
  setContentDescription((demo?"Teste fictício. ":"")+ticker);
 }
 /** All voice status results reuse the SAME official seismic broadcast geometry. */
 static TvBroadcastInfoView voiceStatus(Context c,String title,String detail){
  TvBroadcastInfoView v=new TvBroadcastInfoView(c,VOICE_STATUS,null,null,null,null,null,null,false);
  v.voiceTitle=title==null?"CONSULTA POR VOZ":title;
  v.voiceDetail=detail==null?"":detail;
  v.ticker="ARGOS ORBIS · CONSULTA POR VOZ · "+v.voiceTitle+" · "+v.voiceDetail;
  v.setContentDescription(v.ticker);return v;
 }
 /** The voice request immediately enters the hourly Brent/Dollar banner. */
 static TvBroadcastInfoView marketPending(Context c){
  TvBroadcastInfoView v=market(c,null,null,MarketState.unknown(),MarketState.unknown(),false);
  v.marketPending=true;v.marketSecond=Long.MIN_VALUE;v.refreshMarket();
  return v;
 }
 static TvBroadcastInfoView satellite(Context c,WeatherSatelliteClient.Frame frame,String message){
  return new TvBroadcastInfoView(c,SATELLITE,null,null,null,null,frame,message,false);
 }
 void startPresentation(long when,boolean animated){started=when;invalidate();}
 void mapReveal(float reveal){mapReveal=Math.max(0,Math.min(1,reveal));invalidate();}
 void refreshBriefing(){
  if(kind==RAIN){
   String ai=demo?"":WeatherBriefingClient.text(getContext(),"rain",weather,rain);
   String analysis=ai.isEmpty()?"":WeatherTicker.composeRain(ai);
   ticker="LIBERDADE / SP";
   if(weather!=null&&weather.expiresAt>System.currentTimeMillis()&&!weather.temperatureValue.equals("—"))ticker+=" · "+weather.temperatureValue+" · sensação "+weather.feelsValue;
   if(!analysis.isEmpty()&&!analysis.startsWith("Sem análise complementar"))ticker+="     •     IA · "+analysis;
   ticker+="     •     Previsão por minuto · sujeita a mudanças";
   setContentDescription(baseTicker+" · "+ticker);invalidate();return;
  }
  if(kind!=WEATHER)return;
  String outlook=WeatherBriefingClient.outlookText(getContext(),rain);
  String ai=WeatherBriefingClient.text(getContext(),"hourly",weather,rain);
  ticker="ANÁLISE · "+WeatherTicker.compose(ai,outlook);
  setContentDescription(baseTicker+" · "+ticker);invalidate();
 }
 private static String amount(double n){return String.format(Locale.forLanguageTag("pt-BR"),"%.2f",n);}
 private void fill(Canvas c,float x,float y,float w,float h,int color){p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawRect(x,y,x+w,y+h,p);}
 private void rounded(Canvas c,float x,float y,float w,float h,int color,float radius){
  p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawRoundRect(x,y,x+w,y+h,radius,radius,p);
 }
 private void label(Canvas c,String raw,float x,float y,float size,int color,Typeface font,float max){
  String s=raw==null?"":raw;p.setTypeface(font);p.setTextSize(size);
  if(p.measureText(s)>max){while(!s.isEmpty()&&p.measureText(s+"…")>max)s=s.substring(0,s.offsetByCodePoints(s.length(),-1));s+="…";}
  p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawText(s,x,y,p);
 }
 private void badge(Canvas c,String value){
  OledNewsChrome.tab(c,p,value,false);
 }
 private String status(){return demo?"TESTE FICTÍCIO":kind==VOICE_STATUS?"CONSULTA":kind==BRENT?"COTAÇÕES":"AO VIVO";}
   // Scale text before considering an ellipsis; the distance to the TV makes
 // clipped words (e.g. INDISPONÍ...) materially harder to understand.
 private void fitted(Canvas c,String value,float x,float y,float size,float minimum,int color,Typeface font,float width){
  String raw=value==null?"":value;p.setTypeface(font);p.setTextScaleX(1f);p.setTextSize(size);
  while(size>minimum&&p.measureText(raw)>width){size-=.5f;p.setTextSize(size);}
  label(c,raw,x,y,size,color,font,width);
 }
 // Align category names and the large value on one optical center. Font sizes
 // can differ while their painted bounding boxes keep the same vertical center.
 private void primary(Canvas c,String text,float x,float size,int tint,float maxWidth){
  String value=text==null?"":text;
  float chosen=size;
  p.setTypeface(brand);p.setTextSize(chosen);
  while(chosen>16f&&p.measureText(value)>maxWidth){chosen-=.5f;p.setTextSize(chosen);}
  float baseline=BroadcastVisuals.centeredBodyBaseline(p,brand,chosen);
  label(c,value,x,baseline,chosen,tint,brand,maxWidth);
 }
 private void eventCategory(Canvas c,String title,String caption){
  BroadcastVisuals.eventCategory(c,p,brand,title,caption,0xffff6d7f);
 }
 private void drawOfficialMarketLogo(Canvas c,long elapsed){
  // Kept for existing render tests; it delegates to the shared logo.
  drawRadar(c,elapsed);
 }
 private void drawRadar(Canvas c,long elapsed){
  BroadcastVisuals.radar(c,p,elapsed,animate);
 }
 private float identityLeft(long elapsed){
  int current=BannerTimeline.page(elapsed,2),within=(int)(elapsed%BannerTimeline.PAGE_MS);
  float width=identityWidths[current];
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS)
   width=Math.max(identityWidths[0],identityWidths[1]);
  return OledNewsChrome.BRAND_PLATE_LEFT;
 }
 private void drawIdentity(Canvas c,long elapsed){
  // Same one-at-a-time site/Telegram fade used by seismic and daily summary banners.
  long now=System.currentTimeMillis(),minute=now/60000;
  if(minute!=clockMinute){clockMinute=minute;clockText=NewsBannerView.formatClock(now);}
  fill(c,OledNewsChrome.LEFT,BroadcastVisuals.FOOTER_TOP,106-OledNewsChrome.LEFT,BroadcastVisuals.FOOTER_HEIGHT,OledNewsChrome.RED_DARK);
  Typeface clockFace=OledNewsChrome.clockFont();
  p.setTypeface(clockFace);p.setTextSize(18f);
  label(c,clockText,58-p.measureText(clockText)/2f,118,18,Color.WHITE,clockFace,90);
  OledNewsChrome.brandFooter(c,p,elapsed,animate);
  float tickerLeft=112f,tickerRight=identityLeft(elapsed)-8f;
  c.save();c.clipRect(tickerLeft,BroadcastVisuals.FOOTER_TOP+1,tickerRight,124);
  int tickerLayer=c.saveLayer(tickerLeft,95,tickerRight,124,null);
  String display=OledNewsChrome.tickerDisplay(ticker);
  Typeface tickerFace=OledNewsChrome.tickerFont();
  p.setTypeface(tickerFace);p.setTextSize(14);float length=p.measureText(display)+104;
  float offset=BroadcastVisuals.tickerOffset(elapsed,length,animate);
  label(c,display,tickerLeft-offset,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  label(c,display,tickerLeft-offset+length,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  OledNewsChrome.fadeTickerEdges(c,tickerLeft,tickerRight);
  c.restoreToCount(tickerLayer);c.restore();
 }
 private void drawHeader(Canvas c,long elapsed){
  OledNewsChrome.base(c,p);
  if(kind==BRENT){
   fill(c,8,0,demo?360:250,30,0xff09235f);
   fitted(c,demo?"COTAÇÕES · TESTE FICTÍCIO":"COTAÇÕES",20,21,20,14,Color.WHITE,brand,790);
   fill(c,8,30,812,64,0xfff4f5f6);
  }else if(kind==WEATHER||kind==RAIN){
   fill(c,8,0,350,30,0xff09235f);
   fitted(c,demo?(kind==RAIN?"CHUVA · TESTE FICTÍCIO":"TEMPO · TESTE FICTÍCIO"):kind==RAIN?"CHUVA · LIBERDADE – SP":"TEMPO · LIBERDADE – SP",20,21,20,14,Color.WHITE,brand,325);
   fill(c,8,30,812,64,0xff071d2b);
  }else{
   OledNewsChrome.tab(c,p,"BREAKING NEWS",true);
   badge(c,status());
  }
  // Retain every event-specific native metric, status, timestamp and dynamic value.
  c.save();c.clipRect(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP);
  if(kind==RAIN)drawRain(c);
  else if(kind==WEATHER)drawWeather(c);
  else if(kind==BRENT)drawBrent(c);
  else if(kind==VOICE_STATUS)drawVoiceStatus(c);
  else drawSatelliteNews(c);
  c.restore();
  drawRadar(c,elapsed); // One official eye in every informational strip.
  drawIdentity(c,elapsed);
 }
 private void icon(Canvas c,int index,float x,float y,float size){c.save();c.translate(x,y);c.scale(size/24,size/24);weatherIcons[index].draw(c);c.restore();}
 private void metric(Canvas c,int index,String value,String caption,float x){
  // Every value/icon shares the same center as TEMPO, CHUVA and BRENT.
  icon(c,index,x,51,20);
  primary(c,value,x+27,19,foreground,Math.min(95,BroadcastVisuals.CONTENT_RIGHT_LIMIT-x-31));
  fitted(c,caption,x,86,12,9,0xffd8e4ee,brand,Math.min(112,BroadcastVisuals.CONTENT_RIGHT_LIMIT-x-4));
 }
 private void drawRain(Canvas c){
  RainBannerContent facts=rainFacts;
  eventCategory(c,facts.topic,"LIBERDADE · SP");
  icon(c,0,127,41,28);label(c,facts.headline,165,60,23,foreground,brand,235);
  label(c,facts.end,127,86,16,0xffb8d2df,brand,275);
  metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",430);
  metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",558);
  metric(c,3,facts.duration,facts.durationLabel.contains("JANELA")?"JANELA ESTIMADA":rain!=null&&rain.state.equals("now")?"DURAÇÃO RESTANTE":"DURAÇÃO PREVISTA",704);
 }
 private void drawWeather(Canvas c){
  eventCategory(c,"TEMPO","LIBERDADE · SP");
  primary(c,weather==null?"—":weather.temperatureValue,124,39,foreground,112);
  icon(c,0,251,42,30);
  // Do not present an hourly MODEL rain code as rain observed right now.
  String sky=WeatherConditionDisplay.headline(weather,rain);
  label(c,sky,290,58,sky.length()>19?18:21,foreground,brand,190);
  String detail=WeatherConditionDisplay.detail(weather,rain);
  p.setTypeface(brand);float detailSize=16;p.setTextSize(detailSize);
  while(detailSize>11&&p.measureText(detail)>190){detailSize-=.5f;p.setTextSize(detailSize);}
  label(c,detail,290,84,detailSize,0xffb8d2df,brand,190);
  metric(c,1,weather==null?"—":weather.humidityValue,"UMIDADE",492);
  metric(c,2,weather==null?"—":weather.windValue,weather==null?"VENTO · N/D":"VENTO · "+weather.windDirection,603);
  metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",712);
 }
 static String fxAmount(double price){return String.format(Locale.forLanguageTag("pt-BR"),"%.4f",price);}
 static String brazilFxHint(long now){
  return "YAHOO · USD/BRL · CÂMBIO";
 }
 private int sessionColor(MarketState s){return s.value==MarketState.OPEN?0xff75edb2:s.value==MarketState.CLOSED?0xffff7687:s.value==MarketState.PAUSED?0xffffd17d:0xffb8d2df;}
 // Compact labels fit next to each market name without truncating PAUSADO.
 // Full market state remains available in ticker/accessibility information.
 static String marketHeaderStatus(MarketState session){
  if(session==null)return "N/D";
  switch(session.value){
   case MarketState.OPEN:return "ABERTO";
   case MarketState.CLOSED:return "FECHADO";
   case MarketState.PAUSED:return "PAUSADO";
   default:return "N/D";
  }
 }

 private void drawVoiceStatus(Canvas c){
  eventCategory(c,"CONSULTA","POR VOZ");
  primary(c,voiceTitle,170,27,foreground,680);
  label(c,voiceDetail,170,88,16,0xffbdcfdd,data,680);
 }
 // Dedicated, balanced Brent and USD/BRL panels sharing the full OLED band.
 // Always keep state and variation inside their own columns.
 static final float MARKET_BRENT_PRICE_X=130f, MARKET_BRENT_STATUS_X=338f;
 static final float MARKET_DIVIDER_X=485f, MARKET_DOLLAR_X=502f, MARKET_DOLLAR_STATUS_X=711f;
 private void drawBrent(Canvas c){
  refreshMarket();
  final int ink=0xff101d33, muted=0xff27394b;
  fitted(c,"BRENT",20,46,16,13,ink,brand,110);
  fitted(c,"DÓLAR USD/BRL",430,46,16,12,ink,brand,185);
  fill(c,410,36,1,50,0xffaab5c0);
  if(marketPending){
   fitted(c,"CONSULTANDO COTAÇÃO…",20,72,21,14,ink,brand,370);
   fitted(c,"AGUARDANDO FONTE",430,72,21,14,ink,brand,370);
   return;
  }
  fitted(c,brent==null?"US$ —":"US$ "+amount(brent.price),20,73,32,19,ink,brand,195);
  fitted(c,demo?"SIMULADO":marketHeaderStatus(brentSession),218,45,13,10,muted,brand,176);
  String oil=brent==null||brent.percent==null?"VAR. —":(brent.percent>=0?"▲ +":"▼ ")+amount(brent.percent)+"%";
  fitted(c,oil,218,73,27,16,brent==null||brent.percent==null?muted:brent.percent>=0?0xff00733b:0xffbd1628,brand,176);
  fitted(c,brent==null?"SEM COTAÇÃO CONFIRMADA":"NYMEX · "+(brentSession.value==MarketState.OPEN?"REF. ":"ÚLTIMA ")+BrentQuote.reference(brent.at),20,91,13,11,muted,data,370);
  fitted(c,dollar==null?"R$ —":"R$ "+fxAmount(dollar.price),430,73,32,19,ink,brand,195);
  fitted(c,demo?"SIMULADO":marketHeaderStatus(dollarSession),630,45,13,10,muted,brand,185);
  Double change=dollar==null?null:dollar.percent;
  String fx=change==null?"VAR. —":(change>=0?"▲ +":"▼ ")+amount(change)+"%";
  fitted(c,fx,630,73,27,16,change==null?muted:change>=0?0xff00733b:0xffbd1628,brand,185);
  fitted(c,dollar==null?"SEM COTAÇÃO CONFIRMADA":"YAHOO · "+(dollarSession.value==MarketState.OPEN?"REF. ":"ÚLTIMA ")+BrentQuote.reference(dollar.at),430,91,13,11,muted,data,370);
 }
 private void drawSatelliteNews(Canvas c){
  eventCategory(c,"SATÉLITE","GOES-EAST");
  primary(c,satellite==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,28,foreground,705);
  label(c,satellite==null?satelliteStatus:InfraredPlan.timing(satellite.at,System.currentTimeMillis())+
    " · IMAGEM INFRAVERMELHA · NÃO É RADAR DE CHUVA",142,88,16,0xffb8d2df,data,705);
 }
 private void drawMap(Canvas c){
  if(mapSpace<=0||mapReveal<=0)return;
  c.save();c.translate(0,mapBelow?126:0);c.scale(1,mapSpace/180f);c.clipRect(0,0,960,(kind==WEATHER||kind==RAIN)&&!mapBelow?210:180);
  float slide=(1-mapReveal)*180;
  c.translate(kind==WEATHER||kind==RAIN?615:649,mapBelow?0-slide:slide+(kind==WEATHER||kind==RAIN?34:0));
  WeatherSatelliteClient.Frame displayed=kind==WEATHER||kind==RAIN?(weatherSatellite==null?null:weatherSatellite.get()):satellite;
  if(kind==WEATHER||kind==RAIN||kind==SATELLITE){
   rounded(c,0,0,310,176,0xff0d2737,8);
   if(displayed!=null&&displayed.image!=null&&!displayed.image.isRecycled()){
    p.setColor(Color.WHITE);p.setFilterBitmap(true);p.setStyle(Paint.Style.FILL);
    c.drawBitmap(displayed.image,null,new RectF(0,0,310,150),p);
   }
   fill(c,0,0,310,23,0xdd071724);
   label(c,"INFRAVERMELHO · SUDESTE",9,17,16,Color.WHITE,brand,286);
   fill(c,0,150,310,26,0xee071724);
   label(c,displayed!=null?InfraredPlan.timing(displayed.at,System.currentTimeMillis()):"Satélite indisponível nesta consulta",9,168,12,0xffbbd7e7,brand,290);
   p.setColor(accent);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);
   c.drawRoundRect(0,0,310,176,8,8,p);p.setStyle(Paint.Style.FILL);
  }
  c.restore();
 }
 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);if(started==0)return;
  long now=SystemClock.uptimeMillis(),elapsed=now-started;
  canvas.save();canvas.scale(getWidth()/960f,getHeight()/(126f+mapSpace));
  canvas.save();canvas.translate(0,mapBelow?0:mapSpace);
  drawHeader(canvas,elapsed);canvas.restore();
  drawMap(canvas);canvas.restore();
  if(running&&isShown()){
   if(animate)postInvalidateOnAnimation();
   else postInvalidateDelayed(60000-Math.floorMod(System.currentTimeMillis(),60000));
  }
 }
 @Override protected void onAttachedToWindow(){
  super.onAttachedToWindow();running=true;

 }
 @Override protected void onDetachedFromWindow(){running=false;if(mapInset!=null){mapInset.close();mapInset=null;}super.onDetachedFromWindow();}
}


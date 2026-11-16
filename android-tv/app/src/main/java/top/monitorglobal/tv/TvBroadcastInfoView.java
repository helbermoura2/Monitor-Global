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
  super(c);this.kind=kind;this.rain=rain;this.rainFacts=kind==RAIN?new RainBannerContent(rain):null;this.weather=weather;this.brent=brent;
  // A global USD/BRL quote can never populate the B3 DOL block, even when
  // callers accidentally pass a legacy quote. Demonstration is clearly marked.
  this.dollar=dollar!=null&&(dollar.b3Close||demo)?dollar:null;
  brentSession=brent==null?closedBrentOrUnknown():brent.session;
  dollarSession=MarketState.brazilDOLRegular(System.currentTimeMillis());
  this.satellite=satellite;this.satelliteStatus=status==null?"":status;this.demo=demo;
  this.mapBelow=Prefs.get(c).getBoolean("themeTop",false);
  this.mapSpace=kind==RAIN||kind==BRENT||kind==VOICE_STATUS||kind==WEATHER&&!Prefs.get(c).getBoolean("weatherSatellite",true)?0:Banner.insetDp(c);
  brand=Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf");
  data=Typeface.createFromAsset(c.getAssets(),"fonts/JetBrainsMono.ttf");
  accent=Color.parseColor(Prefs.get(c).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(c).getString("themeAccent","#38bdf8"));
  foreground=Color.parseColor(Prefs.get(c).getString("themeText","#ffffff"));
  background=Color.parseColor(Prefs.get(c).getInt("themeVersion",0)<2?"#071724":Prefs.get(c).getString("themeBackground","#071724"));
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
    String usd=this.dollar==null?"fechamento indisponível":"R$ "+b3Amount(this.dollar.price);
    ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT: "+v+
      (brent!=null?" · ref. "+BrentQuote.clock(brent.at):"")+"     •     DÓLAR FUTURO B3 DOL: "+usd+
      (this.dollar!=null?" · "+this.dollar.contract+" · último fechamento "+BrentQuote.reference(this.dollar.at):"")+
      "     •     DOL: cotação de fechamento da B3, não é preço intradiário · Brent: Yahoo Finance";
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
 static TvBroadcastInfoView market(Context c,BrentQuote b,DollarQuote d,MarketState bs,MarketState ds,boolean demo){TvBroadcastInfoView v=market(c,b,d,demo);if(bs!=null)v.brentSession=bs;v.dollarSession=MarketState.brazilDOLRegular(System.currentTimeMillis());v.marketSecond=Long.MIN_VALUE;v.refreshMarket();return v;}
 private String variationText(Double value){return value==null?"Variação indisponível":(value>=0?"+":"")+amount(value)+"%";}
 private void refreshMarket(){
  if(kind!=BRENT)return;
  if(marketPending){
   ticker="BRENT · CONSULTANDO COTAÇÃO REAL · DÓLAR FUTURO B3 DOL: consultando fechamento · Sem valores fictícios";
   setContentDescription(ticker);return;
  }
  long now=System.currentTimeMillis(),sec=now/1000;if(marketSecond==sec)return;marketSecond=sec;
  brentSession=brentSession.current(now,true);dollarSession=MarketState.brazilDOLRegular(now);
  ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT · NYMEX · "+brentSession.label()+": "+
   (brent==null?"sem cotação confirmada":"US$ "+amount(brent.price)+" · "+variationText(brent.percent)+" · "+BrentQuote.reference(brent.at))+
   "     •     DÓLAR FUTURO · B3 DOL · "+dollarSession.label()+" (HORÁRIO REGULAR): "+
   (dollar==null?"sem fechamento B3 confirmado":"R$ "+b3Amount(dollar.price)+" / US$ 1 · "+dollar.contract+
    " · ÚLTIMO FECHAMENTO "+BrentQuote.reference(dollar.at)+" · "+variationText(dollar.percent))+
   "     •     "+MarketState.brazilDollarContext(now)+(MarketDOLWidget.shouldShow(now,demo)?
    " · DOL intradiário exibido somente no widget oficial TradingView (atraso ~15 min; sem extração)":
    " · B3 via Notícias Agrícolas (fechamento histórico)")+" · nenhum preço de outro mercado utilizado";
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
  float width=BroadcastVisuals.statusWidth(p,brand,value);
  int tint=demo?0xff995b0e:0xffbf1827;
  rounded(c,960-width,0,width,24,tint,7);
  // Square the lower corners consistently with NewsBannerView's joined header.
  fill(c,960-width,17,width,7,tint);
  BroadcastVisuals.headerLabel(c,p,brand,value,960-width,width,BroadcastVisuals.STATUS_TEXT_FILL,Color.WHITE);
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
 private void drawRadar(Canvas c,long elapsed){
  BroadcastVisuals.radar(c,p,elapsed,animate);
 }
 private float identityLeft(long elapsed){
  int current=BannerTimeline.page(elapsed,2),within=(int)(elapsed%BannerTimeline.PAGE_MS);
  float width=identityWidths[current];
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS)
   width=Math.max(identityWidths[0],identityWidths[1]);
  return 960-BroadcastVisuals.BRAND_RIGHT_INSET-width;
 }
 private void identity(Canvas c,int index,int opacity){
  if(opacity<=0)return;
  float labelX=960-BroadcastVisuals.BRAND_RIGHT_INSET-identityTextWidths[index];
  int layer=c.saveLayerAlpha(960-BroadcastVisuals.BRAND_RIGHT_INSET-identityWidths[index],BroadcastVisuals.FOOTER_TOP,960-BroadcastVisuals.BRAND_RIGHT_INSET,126,opacity);
  c.clipPath(outline);
  if(index==1){
   c.save();c.translate(labelX-14,113);p.setStyle(Paint.Style.FILL);p.setColor(Color.rgb(42,171,238));
   c.drawCircle(0,0,8,p);p.setColor(Color.WHITE);c.drawPath(telegramPlane,p);c.restore();
  }
  label(c,index==0?"argosorbis.com.br":"@argosorbis",labelX,119,15,Color.WHITE,brand,206);
  c.restoreToCount(layer);
 }
 private void drawIdentity(Canvas c,long elapsed){
  fill(c,0,BroadcastVisuals.FOOTER_TOP,960,BroadcastVisuals.FOOTER_HEIGHT,0xff020816);
  long now=System.currentTimeMillis(),minute=now/60000;
  if(minute!=clockMinute){clockMinute=minute;clockText=NewsBannerView.formatClock(now);}
  fill(c,0,BroadcastVisuals.FOOTER_TOP,90,BroadcastVisuals.FOOTER_HEIGHT,0xffbf1827);
  p.setTypeface(data);p.setTextSize(18);
  label(c,clockText,45-p.measureText(clockText)/2,119,18,Color.WHITE,data,78);
  int index=BannerTimeline.page(elapsed,2);
  long within=elapsed%BannerTimeline.PAGE_MS;
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS){
   float t=BannerTimeline.progress(within);
   identity(c,1-index,(int)(255*(1-t)));identity(c,index,(int)(255*t));
  }else identity(c,index,255);
  c.save();c.clipRect(BroadcastVisuals.TICKER_START_X,BroadcastVisuals.FOOTER_TOP+1,identityLeft(elapsed)-8,124);
  p.setTypeface(data);p.setTextSize(12);float length=p.measureText(ticker)+90;
  float offset=BroadcastVisuals.tickerOffset(elapsed,length,animate);
  label(c,ticker,100-offset,119,12,Color.WHITE,data,Float.MAX_VALUE);
  label(c,ticker,100-offset+length,119,12,Color.WHITE,data,Float.MAX_VALUE);
  c.restore();
 }
 private void drawHeader(Canvas c,long elapsed){
  c.save();c.clipPath(outline);fill(c,0,24,960,102,background);c.restore();
  // Preserve the original red official header; only the tab widths are reduced.
  rounded(c,0,0,BroadcastVisuals.BREAKING_WIDTH,24,0xffbf1827,5);
  BroadcastVisuals.headerLabel(c,p,brand,"BREAKING NEWS",0,BroadcastVisuals.BREAKING_WIDTH,BroadcastVisuals.BREAKING_TEXT_FILL,Color.WHITE);
  // Leave this top-row area clear; context remains in the large, legible body and ticker.
  badge(c,status());
  // Reserve the same bounded logo region across rain, weather, oil, dollar,
  // satellite, voice and breaking-news banners; never paint metrics below it.
  c.save();c.clipRect(0,24,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP);
  if(kind==RAIN)drawRain(c);
  else if(kind==WEATHER)drawWeather(c);
  else if(kind==BRENT)drawBrent(c);
  else if(kind==VOICE_STATUS)drawVoiceStatus(c);
  else drawSatelliteNews(c);
  c.restore();
  drawRadar(c,elapsed);
  drawIdentity(c,elapsed);
 }
 private void icon(Canvas c,int index,float x,float y,float size){c.save();c.translate(x,y);c.scale(size/24,size/24);weatherIcons[index].draw(c);c.restore();}
 private void metric(Canvas c,int index,String value,String caption,float x){
  // Every value/icon shares the same center as TEMPO, CHUVA and BRENT.
  icon(c,index,x,51,20);
  primary(c,value,x+27,21,foreground,109);
  fitted(c,caption,x,86,12,10,0xffd8e4ee,brand,129);
 }
 private void drawRain(Canvas c){
  RainBannerContent facts=rainFacts;
  eventCategory(c,facts.topic,"LIBERDADE · SP");
  icon(c,0,127,41,28);label(c,facts.headline,165,60,23,foreground,brand,235);
  label(c,facts.end,127,86,16,0xffb8d2df,brand,275);
  metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",412);
  metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",570);
  metric(c,3,facts.duration,facts.durationLabel.contains("JANELA")?"JANELA ESTIMADA":rain!=null&&rain.state.equals("now")?"DURAÇÃO RESTANTE":"DURAÇÃO PREVISTA",720);
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
  metric(c,1,weather==null?"—":weather.humidityValue,"UMIDADE",493);
  metric(c,2,weather==null?"—":weather.windValue,"VENTO",626);
  metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",727);
 }
 static String brazilFxHint(long now){
  return MarketState.brazilWeekend(now)?"B3 FECHADA · SEG 09H (REGULAR)":"B3 DOL · 09H–18H30 (REG.)";
 }
 private static String b3Amount(double value){return String.format(Locale.forLanguageTag("pt-BR"),"%.3f",value);}
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
 private void drawBrent(Canvas c){
  refreshMarket();
  if(marketPending){
   eventCategory(c,"BRENT","NYMEX");
   primary(c,"CONSULTANDO COTAÇÃO REAL…",138,29,foreground,420);
   fill(c,575,41,1,43,0xff45647b);
   label(c,"DÓLAR · B3 DOL",593,45,17,0xffe6f7ff,brand,220);
   label(c,"CONSULTANDO FECHAMENTO",593,77,21,foreground,brand,260);
   return;
  }
  // Matching panels: market state immediately ABOVE each percentage.
  // Right panel accepts ONLY B3 DOL futures closing quotes, never overseas spot FX.
  eventCategory(c,"BRENT","NYMEX");
  primary(c,brent==null?"US$ —":"US$ "+amount(brent.price),138,36,foreground,252);
  int oilTint=brent==null||brent.percent==null?0xffb8d2df:brent.percent>=0?0xff75edb2:0xffff7687;
  String oilChange=brent==null||brent.percent==null?"VAR. —":(brent.percent>=0?"▲ +":"▼ ")+amount(brent.percent)+"%";
  fitted(c,demo?"SIMULADO":marketHeaderStatus(brentSession),402,45,16,12,demo?0xffffd17d:sessionColor(brentSession),brand,158);
  fitted(c,oilChange,402,73,25,16,oilTint,brand,160);
  fill(c,575,41,1,43,0xff45647b);
  // A real intraday B3 price, when available, is rendered directly by the
  // official TradingView widget above this native fallback (not scraped).
  boolean intraday=MarketDOLWidget.shouldShow(System.currentTimeMillis(),demo);
  fitted(c,"DÓLAR · B3",593,47,21,16,0xffe6f7ff,brand,157);
  fitted(c,demo?"SIMULADO":marketHeaderStatus(dollarSession),754,45,15,11,demo?0xffffd17d:sessionColor(dollarSession),brand,104);
  fitted(c,intraday?"COTAÇÃO NO WIDGET":dollar==null?"R$ —":"R$ "+b3Amount(dollar.price),593,75,intraday?18:29,16,foreground,brand,165);
  Double fxChange=intraday?null:dollar==null?null:dollar.percent;
  String fxVariation=intraday?"B3 · DOL1!":fxChange==null?"VAR. —":(fxChange>=0?"▲ +":"▼ ")+amount(fxChange)+"%";
  fitted(c,fxVariation,751,76,intraday?15:21,13,fxChange==null?0xffb8d2df:fxChange>=0?0xff75edb2:0xffff7687,brand,107);
  label(c,brent==null?"NYMEX · SEM COTAÇÃO":"NYMEX · "+(brentSession.value==MarketState.OPEN?"REF. ":"ÚLTIMA ")+BrentQuote.reference(brent.at),138,90,12,0xffd3e3ed,data,434);
  String fxFoot=intraday?"B3 DOL1! · ~15 MIN · TradingView":dollar==null?"B3 DOL · FECHAMENTO N/D":"ÚLT. FECH. "+BrentQuote.reference(dollar.at)+" · "+dollar.contract;
  fitted(c,fxFoot,593,91,12,10,0xffd3e3ed,brand,264);
 }
 private void drawSatelliteNews(Canvas c){
  eventCategory(c,"SATÉLITE","GOES-EAST");
  primary(c,satellite==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,28,foreground,705);
  label(c,satellite==null?satelliteStatus:InfraredPlan.timing(satellite.at,System.currentTimeMillis())+
    " · IMAGEM INFRAVERMELHA · NÃO É RADAR DE CHUVA",142,88,16,0xffb8d2df,data,705);
 }
 private void drawMap(Canvas c){
  if(mapSpace<=0||mapReveal<=0)return;
  c.save();c.translate(0,mapBelow?126:0);c.scale(1,mapSpace/180f);c.clipRect(0,0,960,180);
  float slide=(1-mapReveal)*180;
  c.translate(649,mapBelow?4-slide:slide);
  WeatherSatelliteClient.Frame displayed=kind==WEATHER?(weatherSatellite==null?null:weatherSatellite.get()):satellite;
  if(kind==WEATHER||kind==SATELLITE){
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


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
 static final int WEATHER=1,BRENT=2,SATELLITE=3,RAIN=4,VOICE_STATUS=5,CIVIL_ALERT=6;
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Typeface brand,data;
 private final int kind,accent,foreground,background;
 private final RainForecast.Summary rain;
 private final RainBannerContent rainFacts;
 private final WeatherForecast.Summary weather;
 private final BrentQuote brent;
 private final DollarQuote dollar;private MarketState brentSession,dollarSession;
 private boolean brentChanged=true,dollarChanged=true,temperatureChanged=true,rainStateChanged;
 private String weatherTrend="";
 private boolean brentStateChanged,dollarStateChanged,voiceChanged;
 private DefesaCivilSp.Notice civilNotice;
 private boolean civilReplay,civilFromPhone;
 private android.text.StaticLayout civilMessage;
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
 private long iconOpeningDelay;
 private String ticker,tickerDisplay="",tickerSource="";private final String baseTicker;
 private final Path outline=new Path(),telegramPlane=new Path();
 private final float[] identityWidths=new float[2],identityTextWidths=new float[2];
 private boolean running;
 private final boolean animate;
 private boolean motionEnabled(){return animate&&effects.animated();}
 final TvEffectsController effects;
 private WeatherSatelliteClient.Frame fadingFrame;private long imageReadyAt=-1;
 private final RectF satelliteImageBounds=new RectF(0,0,310,150);

 private TvBroadcastInfoView(Context c,int kind,RainForecast.Summary rain,WeatherForecast.Summary weather,
                             BrentQuote brent,DollarQuote dollar,WeatherSatelliteClient.Frame satellite,
                             String status,boolean demo){
  super(c);OfficialArgosLogo.prepare(c);
  effects=new TvEffectsController(c,kind==WEATHER?TvEffectsController.EffectsCategory.WEATHER:kind==RAIN?TvEffectsController.EffectsCategory.RAIN:kind==BRENT?TvEffectsController.EffectsCategory.MARKET:kind==SATELLITE?TvEffectsController.EffectsCategory.SATELLITE:kind==CIVIL_ALERT?TvEffectsController.EffectsCategory.CIVIL:TvEffectsController.EffectsCategory.VOICE,false,demo);
  animate=effects.animated();this.kind=kind;this.rain=rain;this.rainFacts=kind==RAIN?new RainBannerContent(rain):null;this.weather=weather;this.brent=brent;this.dollar=dollar;
  brentSession=brent==null?closedBrentOrUnknown():brent.session;dollarSession=dollar==null?MarketState.unknown():dollar.session;
  this.satellite=satellite;this.satelliteStatus=status==null?"":status;this.demo=demo;
  this.mapBelow=Prefs.get(c).getBoolean("themeTop",false);
  this.mapSpace=kind==BRENT||kind==VOICE_STATUS||kind==CIVIL_ALERT||(kind==WEATHER||kind==RAIN)&&!Prefs.get(c).getBoolean("weatherSatellite",true)?0:Banner.insetDp(c);
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
   if(rain!=null&&rain.state.equals("evidence"))t.append(" · ").append(rain.title).append(" · ").append(rain.stopText);
   else if(rain!=null)t.append(" · CHUVA POR MINUTO: ").append(rain.title).append(" · ").append(rain.amountText);
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
  String marketDetails=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT · NYMEX · "+brentSession.label()+": "+(brent==null?"sem cotação confirmada":"US$ "+amount(brent.price)+" · "+variationText(brent.percent)+" · "+(brentSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(brent.at))+"     •     DÓLAR USD/BRL · YAHOO · "+dollarSession.label()+": "+(dollar==null?"sem cotação confirmada":"R$ "+fxAmount(dollar.price)+" · "+variationText(dollar.percent)+" · "+(dollarSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(dollar.at));
  ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"Valores indicativos sujeitos a atraso · Variação sobre o fechamento anterior · "+MarketState.brazilDollarContext(now)+" · "+brentSession.basis+" · "+dollarSession.basis+" · Yahoo Finance";
  setContentDescription(marketDetails+" · "+ticker);
 }
 /** All voice status results reuse the SAME official seismic broadcast geometry. */
 private android.text.StaticLayout dailyWeatherText;
 static TvBroadcastInfoView dailyWeather(Context c,String title,String detail){
  TvBroadcastInfoView view=voiceStatus(c,title,detail);
  android.text.TextPaint text=new android.text.TextPaint(Paint.ANTI_ALIAS_FLAG);
  text.setColor(0xffbdcfdd);text.setTypeface(view.data);text.setTextSize(15);
  view.dailyWeatherText=android.text.StaticLayout.Builder.obtain(detail,0,detail.length(),text,650)
   .setIncludePad(false).setMaxLines(2).setEllipsize(android.text.TextUtils.TruncateAt.END).build();
  view.ticker=title+" · "+detail+" · Previsão Open-Meteo";
  view.setContentDescription(view.ticker);
  return view;
 }
 static TvBroadcastInfoView voiceStatus(Context c,String title,String detail){
  TvBroadcastInfoView v=new TvBroadcastInfoView(c,VOICE_STATUS,null,null,null,null,null,null,false);
  v.voiceTitle=title==null?"CONSULTA POR VOZ":title;
  v.voiceDetail=detail==null?"":detail;
  v.ticker="ARGOS ORBIS · CONSULTA POR VOZ · "+v.voiceTitle+" · "+v.voiceDetail;
  v.setContentDescription(v.ticker);return v;
 }
 static TvBroadcastInfoView civilAlert(Context c,DefesaCivilSp.Notice notice){return civilAlert(c,notice,false);}
 static TvBroadcastInfoView civilAlert(Context c,DefesaCivilSp.Notice notice,boolean demo){
  return civilAlert(c,notice,demo,false);
 }
 static TvBroadcastInfoView civilAlert(Context c,DefesaCivilSp.Notice notice,boolean demo,boolean replay){
  TvBroadcastInfoView v=new TvBroadcastInfoView(c,CIVIL_ALERT,null,null,null,null,null,null,demo);
  v.civilNotice=notice;v.civilReplay=replay;
  android.text.TextPaint paint=new android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG);
  paint.setColor(v.foreground);paint.setTypeface(v.data);paint.setTextSize(15);
  v.civilMessage=android.text.StaticLayout.Builder.obtain(notice.message,0,notice.message.length(),paint,622)
   .setIncludePad(false).setMaxLines(2).setEllipsize(android.text.TextUtils.TruncateAt.END).build();
  v.ticker=CivilSourceContext.describe(notice,System.currentTimeMillis(),false,replay,demo)+" · São Paulo, capital · "+notice.message;
  v.setContentDescription(notice.level()+" · "+v.ticker);
  return v;
 }
 /** Presentation metadata for the optional transparent full-screen radar layer. */
 boolean civilIsExtreme(){return kind==CIVIL_ALERT&&civilNotice!=null&&"Extreme".equals(civilNotice.severity);}
 boolean civilIsReplay(){return kind==CIVIL_ALERT&&civilReplay;}
 boolean civilIsSimulation(){return kind==CIVIL_ALERT&&demo;}
 /** Opt-in phone relay is NOT official CAP verification. Even live captures are labelled. */
 static TvBroadcastInfoView civilPhone(Context c,DefesaCivilSp.Notice notice,boolean simulated){
  return civilPhone(c,notice,simulated,"Celular sem identificação");
 }
 static TvBroadcastInfoView civilPhone(Context c,DefesaCivilSp.Notice notice,boolean simulated,String sender){
  TvBroadcastInfoView v=civilAlert(c,notice,simulated,false);
  v.civilFromPhone=true;
  v.ticker=CivilSourceContext.describe(notice,System.currentTimeMillis(),true,false,simulated)+" · "+notice.message;
  v.setContentDescription(notice.level()+" · "+v.ticker);
  return v;
 }
 /** Replay retains the phone origin and never impersonates an official CAP record. */
 static TvBroadcastInfoView civilPhoneReplay(Context c,DefesaCivilSp.Notice notice){
  TvBroadcastInfoView v=civilPhone(c,notice,false);
  v.civilReplay=true;
  v.ticker="REPLAY HISTÓRICO · CELULAR · NÃO VERIFICADO VIA CAP · "
   +BrDates.dateTime(notice.sent)+" · "+notice.message;
  v.setContentDescription("REPLAY HISTÓRICO · NÃO É AVISO ATUAL · CAPTURADO NO CELULAR "
   +"E NÃO VERIFICADO VIA CAP · "+notice.level()+" · "+notice.message);
  return v;
 }
 /** The voice request immediately enters the hourly Brent/Dollar banner. */
 static TvBroadcastInfoView marketPending(Context c){
  TvBroadcastInfoView v=market(c,null,null,MarketState.unknown(),MarketState.unknown(),false);
  v.marketPending=true;v.marketSecond=Long.MIN_VALUE;v.refreshMarket();
  return v;
 }
 static TvBroadcastInfoView satelliteDemo(Context c){return new TvBroadcastInfoView(c,SATELLITE,null,null,null,null,null,"SIMULAÇÃO · sem imagem real carregada",true);}
 static TvBroadcastInfoView satellite(Context c,WeatherSatelliteClient.Frame frame,String message){
  return new TvBroadcastInfoView(c,SATELLITE,null,null,null,null,frame,message,false);
 }
 void comparePrevious(TvBroadcastInfoView previous){
  if(previous.kind!=kind||previous.demo!=demo)return;
  if(kind==BRENT){
   brentChanged=brent!=null&&(previous.brent==null||Double.compare(brent.price,previous.brent.price)!=0);
   dollarChanged=dollar!=null&&(previous.dollar==null||Double.compare(dollar.price,previous.dollar.price)!=0);
   brentStateChanged=previous.marketPending!=marketPending||brentSession.value!=previous.brentSession.value;
   dollarStateChanged=previous.marketPending!=marketPending||dollarSession.value!=previous.dollarSession.value;
  }else if(kind==WEATHER){
   temperatureChanged=weather!=null&&(previous.weather==null||!weather.temperatureValue.equals(previous.weather.temperatureValue));
   weatherTrend=WeatherTicker.trend(previous.weather,weather);
   if(!weatherTrend.isEmpty())refreshBriefing();
  }else if(kind==RAIN){
   rainStateChanged=rain!=null&&(previous.rain==null||!rain.state.equals(previous.rain.state));
  }else if(kind==VOICE_STATUS){
   voiceChanged=!voiceTitle.equals(previous.voiceTitle)||!voiceDetail.equals(previous.voiceDetail);
  }
  // Reuse the active strip position for incoming readings and voice results.
  effects.disableOpening();
 }
 void iconOpeningDelay(long delay){iconOpeningDelay=delay;}
 void startPresentation(long when,boolean animated){started=when;effects.start(when);invalidate();}
 void mapReveal(float reveal){if(mapReveal!=reveal){mapReveal=reveal;invalidate();}}
 void refreshBriefing(){
  if(kind==RAIN){
   String ai=demo?"":WeatherBriefingClient.text(getContext(),"rain",weather,rain);
   String analysis=ai.isEmpty()?"":WeatherTicker.composeRain(ai);
   ticker="LIBERDADE / SP";
   if(weather!=null&&weather.expiresAt>System.currentTimeMillis()&&!weather.temperatureValue.equals("—"))ticker+=" · "+weather.temperatureValue+" · sensação "+weather.feelsValue;
   if(!weatherTrend.isEmpty())ticker+=" · "+weatherTrend;
   ticker+=" · "+WeatherTicker.sourceContext(weather,rain,System.currentTimeMillis());
   if(!analysis.isEmpty()&&!analysis.startsWith("Sem análise complementar"))ticker+="     •     IA · "+analysis;
   ticker+="     •     Previsão por minuto · sujeita a mudanças";
   setContentDescription(baseTicker+" · "+ticker);invalidate();return;
  }
  if(kind!=WEATHER)return;
  String outlook=WeatherBriefingClient.outlookText(getContext(),rain);
  String ai=WeatherBriefingClient.text(getContext(),"hourly",weather,rain);
  ticker="ANÁLISE · "+WeatherTicker.compose(ai,outlook)+" · "+(weatherTrend.isEmpty()?"Tendência: aguardando nova atualização horária":weatherTrend)+" · "+WeatherTicker.sourceContext(weather,rain,System.currentTimeMillis());
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
  BroadcastVisuals.radar(c,p,elapsed,motionEnabled());
 }
 private float identityLeft(long elapsed){
  int current=BannerTimeline.page(elapsed,2),within=(int)(elapsed%BannerTimeline.PAGE_MS);
  float width=identityWidths[current];
  if(motionEnabled()&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS)
   width=Math.max(identityWidths[0],identityWidths[1]);
  return OledNewsChrome.BRAND_PLATE_LEFT;
 }
 private String satelliteMotionTicker(WeatherSatelliteClient.Frame frame){
  if(frame==null)return "";
  String motion=frame.motion==null
    ?"MOVIMENTO DAS NUVENS: SEM ESTIMATIVA CONFIÁVEL"
    :frame.motion.description()+" · COERÊNCIA "+Math.round(frame.motion.confidence*100)+"% · COMPARAÇÃO "+
      Math.max(1,(frame.motion.newerAt-frame.motion.olderAt)/60000)+" MIN";
  return " · "+motion+" · DESLOCAMENTO VISUAL DAS NUVENS; NÃO É PREVISÃO DE CHUVA · "+
    frame.credit()+" · "+InfraredPlan.timing(frame.at,System.currentTimeMillis());
 }
 private void drawIdentity(Canvas c,long elapsed,WeatherSatelliteClient.Frame frame){
  // Same one-at-a-time site/Telegram fade used by seismic and daily summary banners.
  long now=System.currentTimeMillis(),minute=now/60000;
  if(minute!=clockMinute){clockMinute=minute;clockText=NewsBannerView.formatClock(now);}
  fill(c,OledNewsChrome.LEFT,BroadcastVisuals.FOOTER_TOP,106-OledNewsChrome.LEFT,BroadcastVisuals.FOOTER_HEIGHT,OledNewsChrome.RED_DARK);
  Typeface clockFace=OledNewsChrome.clockFont();
  p.setTypeface(clockFace);p.setTextSize(18f);
  label(c,clockText,58-p.measureText(clockText)/2f,118,18,Color.WHITE,clockFace,90);
  OledNewsChrome.brandFooter(c,p,elapsed,motionEnabled());
  float tickerLeft=112f,tickerRight=identityLeft(elapsed)-8f;
  c.save();c.clipRect(tickerLeft,BroadcastVisuals.FOOTER_TOP+1,tickerRight,124);
  int tickerLayer=c.saveLayer(tickerLeft,95,tickerRight,124,null);
  String visibleTicker=ticker;
  if(kind==SATELLITE||kind==WEATHER||kind==RAIN)visibleTicker+=satelliteMotionTicker(frame);
  if(!visibleTicker.equals(tickerSource)){tickerSource=visibleTicker;tickerDisplay=OledNewsChrome.tickerDisplay(visibleTicker);}
  String display=tickerDisplay;
  Typeface tickerFace=OledNewsChrome.tickerFont();
  p.setTypeface(tickerFace);p.setTextSize(14);float length=p.measureText(display)+104;
  // Let viewers read the beginning of emergency notices before the ticker starts moving.
  // Other event tickers keep their established cadence.
  long tickerTime=kind==CIVIL_ALERT?Math.max(0L,elapsed-3500L):elapsed;
  float tickerSpeed=(kind==SATELLITE||frame!=null&&(kind==WEATHER||kind==RAIN))?65f:BroadcastVisuals.TICKER_PX_PER_SECOND;
  float offset=BroadcastVisuals.tickerOffset(tickerTime,length,motionEnabled(),tickerSpeed);
  label(c,display,tickerLeft-offset,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  label(c,display,tickerLeft-offset+length,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  OledNewsChrome.fadeTickerEdges(c,tickerLeft,tickerRight);
  c.restoreToCount(tickerLayer);c.restore();
 }
 private void drawHeader(Canvas c,long elapsed,WeatherSatelliteClient.Frame frame){
  OledNewsChrome.base(c,p);
  if(kind==CIVIL_ALERT)OledNewsChrome.tab(c,p,demo?"SIMULAÇÃO":civilFromPhone?"DEFESA CIVIL":civilReplay?"DEFESA CIVIL":"ALERTA OFICIAL",true);
  else OledNewsChrome.tab(c,p,dailyWeatherText!=null?"BOLETIM DO TEMPO":BannerOpening.title(effects.category),true);
  OledNewsChrome.tab(c,p,demo?"TESTE FICTÍCIO":civilReplay?"REPLAY":civilFromPhone?"CELULAR":"AO VIVO",false);
  // Retain every event-specific native metric, status, timestamp and dynamic value.
  c.save();c.clipRect(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP);
  int effectLayer=c.saveLayerAlpha(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP,effects.opacity(elapsed));
  effects.behindContent(c,elapsed);
  if(kind==RAIN)drawRain(c,elapsed);
  else if(kind==WEATHER)drawWeather(c,elapsed);
  else if(kind==BRENT)drawBrent(c,elapsed);
  else if(kind==VOICE_STATUS)drawVoiceStatus(c,elapsed);
  else if(kind==CIVIL_ALERT)drawCivilAlert(c,elapsed);
  else drawSatelliteNews(c,frame);
  c.restoreToCount(effectLayer);effects.draw(c,elapsed,TvEffectsController.wet(rain),TvEffectsController.storm(rain,weather));
  // Shared source / content / logo divisions in every information banner.
  BroadcastVisuals.newsroomDividers(c,p,kind==CIVIL_ALERT
    ?BroadcastVisuals.CIVIL_SOURCE_DIVIDER_X:BroadcastVisuals.SOURCE_DIVIDER_X);
  // Brent and USD/BRL have two distinct market columns within the content.
  if(kind==BRENT)BroadcastVisuals.sectionDivider(c,p,BroadcastVisuals.MARKET_DIVIDER_X);
  c.restore();
  drawRadar(c,elapsed); // One official eye in every informational strip.
  drawIdentity(c,elapsed,frame);
 }
 private void icon(Canvas c,int index,float x,float y,float size){c.save();c.translate(x,y);c.scale(size/24,size/24);weatherIcons[index].draw(c);c.restore();}
 private void categoryIcon(Canvas c,int index,float x,float y,float size,long elapsed){
  long visibleElapsed=elapsed-iconOpeningDelay;
  long duration=effects.full()?900:500;
  if(!motionEnabled()||visibleElapsed<0||visibleElapsed>=duration){
   icon(c,index,x,y,size);return;
  }
  float progress=TvEffectsController.phase(visibleElapsed,duration);
  float lift=(float)Math.sin(Math.PI*progress);
  float scale=1f+(effects.full()?.16f:.09f)*lift;
  c.save();c.translate(x+size/2f,y+size/2f-5f*lift);
  c.scale(scale,scale);
  icon(c,index,-size/2f,-size/2f,size);c.restore();
 }
 private void metric(Canvas c,int index,String value,String caption,float x,long elapsed){
  // Every value/icon shares the same center as TEMPO, CHUVA and BRENT.
  icon(c,index,x,51,20);
  primary(c,value,x+27,19,effects.valueInk(foreground,0xff92e4ff,elapsed),Math.min(95,BroadcastVisuals.CONTENT_RIGHT_LIMIT-x-31));
  fitted(c,caption,x,86,13,10,0xffd8e4ee,brand,Math.min(112,BroadcastVisuals.CONTENT_RIGHT_LIMIT-x-4));
 }
 private void drawRain(Canvas c,long elapsed){
  RainBannerContent facts=rainFacts;
  eventCategory(c,facts.topic,"LIBERDADE · SP");
  categoryIcon(c,0,127,41,28,elapsed);label(c,facts.headline,165,60,23,rain==null||!rainStateChanged?foreground:effects.valueInk(foreground,0xff92e4ff,elapsed),brand,235);
  label(c,facts.end,127,86,16,0xffb8d2df,brand,275);
  metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",430,elapsed);
  metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",558,elapsed);
  metric(c,3,facts.duration,facts.durationLabel.contains("JANELA")?"JANELA ESTIMADA":rain!=null&&rain.state.equals("now")?"DURAÇÃO RESTANTE":"DURAÇÃO PREVISTA",704,elapsed);
 }
 private void drawWeather(Canvas c,long elapsed){
  eventCategory(c,"TEMPO","LIBERDADE · SP");
  primary(c,weather==null?"—":weather.temperatureValue,124,39,weather==null||!temperatureChanged?foreground:effects.valueInk(foreground,0xff92e4ff,elapsed),112);
  categoryIcon(c,0,251,42,30,elapsed);
  // Do not present an hourly MODEL rain code as rain observed right now.
  String sky=WeatherConditionDisplay.headline(weather,rain);
  label(c,sky,290,58,sky.length()>19?18:21,foreground,brand,190);
  String detail=WeatherConditionDisplay.detail(weather,rain);
  p.setTypeface(brand);float detailSize=16;p.setTextSize(detailSize);
  while(detailSize>11&&p.measureText(detail)>190){detailSize-=.5f;p.setTextSize(detailSize);}
  label(c,detail,290,84,detailSize,0xffb8d2df,brand,190);
  metric(c,1,weather==null?"—":weather.humidityValue,"UMIDADE",492,elapsed);
  metric(c,2,weather==null?"—":weather.windValue,weather==null?"VENTO · N/D":"VENTO · "+weather.windDirection,603,elapsed);
  metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",712,elapsed);
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

 // A dedicated, centered source plate for Civil Defense, instead of the tiny
 // seismic magnitude column. This affects official CAP, replay and phone notices alike.
 private void civilCentered(Canvas c,String text,float centerX,float centerY,float size,float min,
                            float width,Typeface face,int color){
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setTypeface(face);
  p.setTextScaleX(1f);p.setTextSize(size);
  while(size>min&&p.measureText(text)>width){size-=.5f;p.setTextSize(size);}
  Paint.FontMetrics metrics=p.getFontMetrics();
  float baseline=centerY-(metrics.ascent+metrics.descent)/2f;
  p.setColor(color);
  c.drawText(text,centerX-p.measureText(text)/2f,baseline,p);
 }
 /** One low-intensity red edge sweep at entry; never flashes the warning text. */
 private void civilEdgeSweep(Canvas c,long elapsed){
  if(!motionEnabled()||elapsed<0)return;
  long duration=effects.full()?820:480;
  if(elapsed>=duration)return;
  float phase=TvEffectsController.ease(TvEffectsController.phase(elapsed,duration));
  float head=20f+794f*phase,tail=Math.max(20f,head-(effects.full()?116f:64f));
  p.setShader(null);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(effects.full()?1.7f:1.1f);
  p.setColor(Color.argb(Math.round(160*(1-phase)),255,75,96));
  c.save();c.clipRect(19f,31f,822f,94f);
  c.drawLine(tail,32.2f,head,32.2f,p);
  c.drawLine(tail,92.1f,head,92.1f,p);
  c.restore();p.setStyle(Paint.Style.FILL);
 }
 private void drawCivilAlert(Canvas c,long elapsed){
  String caption=civilReplay?(civilFromPhone?"REPLAY • CELULAR":"REGISTRO HISTÓRICO"):
   demo?(civilFromPhone?"TESTE • CELULAR":"TESTE • TV"):
   civilFromPhone?"CELULAR • NÃO É CAP":"SÃO PAULO • CAPITAL";
  // Plate x=20..171: source and subtitle share the same optical center.
  civilCentered(c,"DEFESA CIVIL",97f,54.7f,19.5f,16f,144f,brand,Color.WHITE);
  fill(c,28f,65.9f,138f,1.2f,0xffc52943);
  civilCentered(c,caption,97f,77.1f,11.5f,9.5f,144f,data,0xffdae2e8);
  // The shared renderer paints the exact same Civil Defense source rule.
  // Title and two-line message use the wider newsroom column, leaving a safe
  // separation from the official animated eye at the far right.
  fitted(c,civilNotice.level().toUpperCase(java.util.Locale.forLanguageTag("pt-BR")),
    190f,52f,25f,19f,0xffffb49c,brand,622f);
  c.save();c.translate(190f,56f);civilMessage.draw(c);c.restore();
  // The logo boundary is also shared with every other event.
  civilEdgeSweep(c,elapsed);
 }
 private void drawVoiceStatus(Canvas c,long elapsed){
  eventCategory(c,dailyWeatherText!=null?"PREVISÃO":"CONSULTA",dailyWeatherText!=null?"OPEN-METEO":"POR VOZ");
  if(dailyWeatherText!=null){
   label(c,voiceTitle,170,52,23,foreground,brand,650);
   c.save();c.translate(170,56);dailyWeatherText.draw(c);c.restore();
   return;
  }
  primary(c,voiceTitle,170,27,voiceChanged?effects.valueInk(foreground,0xff92e4ff,elapsed):foreground,680);
  label(c,voiceDetail,170,88,16,0xffbdcfdd,data,680);
 }
 // Dedicated, balanced Brent and USD/BRL panels sharing the full OLED band.
 // Always keep state and variation inside their own columns.
 static final float MARKET_BRENT_PRICE_X=130f, MARKET_BRENT_STATUS_X=338f;
 static final float MARKET_DIVIDER_X=485f, MARKET_DOLLAR_X=502f, MARKET_DOLLAR_STATUS_X=711f;
 private void drawBrent(Canvas c,long elapsed){
  refreshMarket();
  final int ink=Color.WHITE, muted=0xffc5d6df;
  fitted(c,"BRENT",20,71,25,19,0xffff7687,brand,100);
  fitted(c,"DÓLAR USD/BRL",MARKET_DOLLAR_X,48,18,15,ink,brand,199);
  // Red Brent / USD divider is drawn by the shared newsroom template.
  fitted(c,brent==null?"US$ —":"US$ "+amount(brent.price),MARKET_BRENT_PRICE_X,73,32,19,brent==null||!brentChanged?ink:effects.valueInk(ink,0xff92e4ff,elapsed),brand,199);
  fitted(c,marketPending?"CONSULTANDO":demo?"SIMULADO":marketHeaderStatus(brentSession),MARKET_BRENT_STATUS_X,48,16,12,demo?muted:brentStateChanged?effects.valueInk(sessionColor(brentSession),Color.WHITE,elapsed):sessionColor(brentSession),brand,135);
  String oil=brent==null||brent.percent==null?"VAR. —":(brent.percent>=0?"▲ +":"▼ ")+amount(brent.percent)+"%";
  fitted(c,oil,MARKET_BRENT_STATUS_X,73,25,16,brent==null||brent.percent==null?muted:brent.percent>=0?0xff75edb2:0xffff7687,brand,135);
  fitted(c,marketReference("NYMEX",brentSession,brent==null?null:brent.at),MARKET_BRENT_PRICE_X,90,14,12,muted,data,340);
  fitted(c,dollar==null?"R$ —":"R$ "+fxAmount(dollar.price),MARKET_DOLLAR_X,73,32,19,dollar==null||!dollarChanged?ink:effects.valueInk(ink,0xff92e4ff,elapsed),brand,199);
  fitted(c,marketPending?"CONSULTANDO":demo?"SIMULADO":marketHeaderStatus(dollarSession),MARKET_DOLLAR_STATUS_X,48,16,12,demo?muted:dollarStateChanged?effects.valueInk(sessionColor(dollarSession),Color.WHITE,elapsed):sessionColor(dollarSession),brand,113);
  Double change=dollar==null?null:dollar.percent;
  String fx=change==null?"VAR. —":(change>=0?"▲ +":"▼ ")+amount(change)+"%";
  fitted(c,fx,MARKET_DOLLAR_STATUS_X,73,25,16,change==null?muted:change>=0?0xff75edb2:0xffff7687,brand,113);
  fitted(c,marketReference("YAHOO",dollarSession,dollar==null?null:dollar.at),MARKET_DOLLAR_X,90,14,12,muted,data,322);
 }
 private String marketReference(String source,MarketState session,Long at){
  if(at==null)return marketPending?"AGUARDANDO FONTE":"SEM COTAÇÃO CONFIRMADA";
  String reference=session.value==MarketState.OPEN?"REF. ":"ÚLTIMA COTAÇÃO ";
  return reference+BrentQuote.reference(at)+" · "+source;
 }
 private void drawSatelliteNews(Canvas c,WeatherSatelliteClient.Frame frame){
  eventCategory(c,"SATÉLITE","GOES-EAST");
  primary(c,frame==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,28,foreground,705);
  label(c,frame==null?(satellite==null?satelliteStatus:"Imagem indisponível"):InfraredPlan.timing(frame.at,System.currentTimeMillis())+
    " · IMAGEM INFRAVERMELHA · NÃO É RADAR DE CHUVA",142,88,16,0xffb8d2df,data,705);
 }
 private WeatherSatelliteClient.Frame currentFrame(){
  WeatherSatelliteClient.Frame frame=kind==WEATHER||kind==RAIN
      ?(weatherSatellite==null?null:weatherSatellite.get()):satellite;
  return frame!=null&&frame.image!=null&&!frame.image.isRecycled()?frame:null;
 }
 private void drawMap(Canvas c,WeatherSatelliteClient.Frame displayed,long now){
  if(mapSpace<=0||mapReveal<=0)return;
  c.save();c.translate(0,mapBelow?126:0);c.scale(1,mapSpace/180f);c.clipRect(0,0,960,180);
  float slide=(1-mapReveal)*(effects.full()?34:19);
  // A mesma ancora usada nos sismos: nenhum deslocamento exclusivo do infravermelho.
  c.translate(MapInset.FRAME_X,MapInset.slideY(mapBelow,slide));
  int mapLayer=mapReveal<1?c.saveLayerAlpha(0,0,310,176,Math.round(255*mapReveal)):c.save();
  if(kind==WEATHER||kind==RAIN||kind==SATELLITE){
   rounded(c,0,0,310,176,0xff0d2737,8);
   if(fadingFrame!=displayed){fadingFrame=displayed;imageReadyAt=now;}
   if(displayed!=null){
    p.setColor(Color.WHITE);p.setFilterBitmap(true);p.setStyle(Paint.Style.FILL);
    p.setAlpha(effects.imageOpacity(now-imageReadyAt));
    c.drawBitmap(displayed.image,null,satelliteImageBounds,p);p.setAlpha(255);
   }
   fill(c,0,0,310,23,0xdd071724);
   label(c,"INFRAVERMELHO · SUDESTE",9,17,16,Color.WHITE,brand,286);
   fill(c,0,150,310,26,0xee071724);
   if(displayed!=null)label(c,displayed.credit(),9,160,10,0xffbbd7e7,brand,290);
   label(c,displayed!=null?InfraredPlan.timing(displayed.at,System.currentTimeMillis()):"Satélite indisponível nesta consulta",9,displayed!=null?173:168,12,0xffbbd7e7,brand,290);
   p.setColor(accent);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);
   c.drawRoundRect(0,0,310,176,8,8,p);p.setStyle(Paint.Style.FILL);
  }
  c.restoreToCount(mapLayer);c.restore();
 }
 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);if(started==0)return;long drawStarted=SystemClock.elapsedRealtimeNanos();
  long now=SystemClock.uptimeMillis(),elapsed=now-started;
  canvas.save();canvas.scale(getWidth()/960f,getHeight()/(126f+mapSpace));
  canvas.save();canvas.translate(0,mapBelow?0:mapSpace);
  WeatherSatelliteClient.Frame frame=currentFrame();
  drawHeader(canvas,elapsed,frame);canvas.restore();
  drawMap(canvas,frame,now);canvas.restore();
  RuntimeDiagnostics.frame(drawStarted,SystemClock.elapsedRealtimeNanos()-drawStarted,motionEnabled());
  if(running&&isShown()){
   if(motionEnabled())postInvalidateOnAnimation();
   else postInvalidateDelayed(60000-Math.floorMod(System.currentTimeMillis(),60000));
  }
 }
 @Override protected void onAttachedToWindow(){
  super.onAttachedToWindow();running=true;

 }
 @Override protected void onDetachedFromWindow(){running=false;effects.stop();fadingFrame=null;imageReadyAt=-1;if(mapInset!=null){mapInset.close();mapInset=null;}super.onDetachedFromWindow();}
}


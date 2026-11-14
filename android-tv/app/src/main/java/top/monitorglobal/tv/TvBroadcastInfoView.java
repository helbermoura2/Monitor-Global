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
  super(c);this.kind=kind;this.rain=rain;this.rainFacts=kind==RAIN?new RainBannerContent(rain):null;this.weather=weather;this.brent=brent;this.dollar=dollar;
  brentSession=brent==null?closedBrentOrUnknown():brent.session;dollarSession=dollar==null?MarketState.unknown():dollar.session;
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
  p.setTypeface(brand);p.setTextSize(17);
  identityTextWidths[0]=p.measureText("monitorglobal.top");
  identityTextWidths[1]=p.measureText("@monitor_global");
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
    String usd=dollar==null?"indisponível":"R$ "+amount(dollar.price);
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
  long sec=System.currentTimeMillis()/1000;if(marketSecond==sec)return;marketSecond=sec;brentSession=brentSession.current(System.currentTimeMillis(),true);dollarSession=dollarSession.current(System.currentTimeMillis(),false);
  ticker=(demo?"SIMULAÇÃO · NÃO É COTAÇÃO REAL · ":"")+"BRENT · "+brentSession.label()+": "+(brent==null?"sem cotação confirmada":"US$ "+amount(brent.price)+" · "+variationText(brent.percent)+" · "+(brentSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(brent.at))+"     •     DÓLAR USD/BRL · "+dollarSession.label()+": "+(dollar==null?"sem cotação confirmada":"R$ "+amount(dollar.price)+" · "+variationText(dollar.percent)+" · "+(dollarSession.value==MarketState.OPEN?"ref. ":"última conhecida ")+BrentQuote.reference(dollar.at))+"     •     "+brentSession.basis+" · "+dollarSession.basis+" · Yahoo Finance · valores indicativos sujeitos a atraso";
  setContentDescription((demo?"Teste fictício. ":"")+ticker);
 }
 /** All voice status results reuse the SAME official seismic broadcast geometry. */
 static TvBroadcastInfoView voiceStatus(Context c,String title,String detail){
  TvBroadcastInfoView v=new TvBroadcastInfoView(c,VOICE_STATUS,null,null,null,null,null,null,false);
  v.voiceTitle=title==null?"CONSULTA POR VOZ":title;
  v.voiceDetail=detail==null?"":detail;
  v.ticker="MONITOR GLOBAL · CONSULTA POR VOZ · "+v.voiceTitle+" · "+v.voiceDetail;
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
  rounded(c,960-width,0,width,24,demo?0xff995b0e:0xffbf1827,7);
  BroadcastVisuals.headerLabel(c,p,brand,value,960-width,width,BroadcastVisuals.STATUS_TEXT_FILL,Color.WHITE);
 }
 private String status(){return demo?"TESTE FICTÍCIO":kind==VOICE_STATUS?"CONSULTA":kind==BRENT?"COTAÇÕES":"AO VIVO";}
 private void drawRadar(Canvas c,long elapsed){
  BroadcastVisuals.radar(c,p,elapsed,animate);
 }
 private float identityLeft(long elapsed){
  int current=BannerTimeline.page(elapsed,2),within=(int)(elapsed%BannerTimeline.PAGE_MS);
  float width=identityWidths[current];
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS)
   width=Math.max(identityWidths[0],identityWidths[1]);
  return 960-width;
 }
 private void identity(Canvas c,int index,int opacity){
  if(opacity<=0)return;
  float labelX=954-identityTextWidths[index];
  int layer=c.saveLayerAlpha(960-identityWidths[index],BroadcastVisuals.FOOTER_TOP,960,126,opacity);
  c.clipPath(outline);
  if(index==1){
   c.save();c.translate(labelX-14,113);p.setStyle(Paint.Style.FILL);p.setColor(Color.rgb(42,171,238));
   c.drawCircle(0,0,8,p);p.setColor(Color.WHITE);c.drawPath(telegramPlane,p);c.restore();
  }
  label(c,index==0?"monitorglobal.top":"@monitor_global",labelX,119,17,Color.WHITE,brand,206);
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
  rounded(c,0,0,BroadcastVisuals.BREAKING_WIDTH,24,0xffbf1827,5);
  BroadcastVisuals.headerLabel(c,p,brand,"BREAKING NEWS",0,BroadcastVisuals.BREAKING_WIDTH,BroadcastVisuals.BREAKING_TEXT_FILL,Color.WHITE);
  label(c,kind==RAIN?"CHUVA · LIBERDADE / SP":kind==WEATHER?"METEOROLOGIA":kind==BRENT?"MERCADO · ENERGIA":kind==VOICE_STATUS?"CONSULTA POR VOZ":"IMAGEM DE SATÉLITE",BroadcastVisuals.BREAKING_WIDTH+16,18,17,accent,brand,440);
  badge(c,status());
  if(kind==RAIN)drawRain(c);
  else if(kind==WEATHER)drawWeather(c);
  else if(kind==BRENT)drawBrent(c);
  else if(kind==VOICE_STATUS)drawVoiceStatus(c);
  else drawSatelliteNews(c);
  drawRadar(c,elapsed);
  drawIdentity(c,elapsed);
 }
 private void icon(Canvas c,int index,float x,float y,float size){c.save();c.translate(x,y);c.scale(size/24,size/24);weatherIcons[index].draw(c);c.restore();}
 private void metric(Canvas c,int index,String value,String caption,float x){icon(c,index,x,48,20);label(c,value,x+27,65,21,foreground,brand,105);label(c,caption,x,86,12,0xffb8d2df,brand,130);}
 private void drawRain(Canvas c){
  RainBannerContent facts=rainFacts;
  label(c,facts.topic,11,70,29,0xffff6d7f,brand,108);
  icon(c,0,127,41,28);label(c,facts.headline,165,60,23,foreground,brand,235);
  label(c,facts.end,127,86,16,0xffb8d2df,brand,275);
  metric(c,1,facts.amount,"PRÓXIMOS 60 MIN",412);
  metric(c,2,facts.rate,"INTENSIDADE ESTIMADA",570);
  metric(c,3,facts.duration,facts.durationLabel.contains("JANELA")?"JANELA ESTIMADA":rain!=null&&rain.state.equals("now")?"DURAÇÃO RESTANTE":"DURAÇÃO PREVISTA",735);
 }
 private void drawWeather(Canvas c){
  label(c,"TEMPO",11,70,30,0xffff6d7f,brand,105);
  label(c,weather==null?"—":weather.temperatureValue,124,65,39,foreground,brand,112);
  label(c,"LIBERDADE / SP",124,87,12,0xffb8d2df,data,140);
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
  metric(c,3,weather==null?"—":weather.gustValue,"RAJADAS",759);
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
  label(c,"CONSULTA",12,66,31,0xffff6d7f,brand,133);
  label(c,voiceTitle,170,62,27,foreground,brand,690);
  label(c,voiceDetail,170,88,16,0xffbdcfdd,data,688);
 }
 private void drawBrent(Canvas c){
  refreshMarket();
  if(marketPending){
   label(c,"BRENT",12,57,28,0xffff6d7f,brand,112);
   label(c,"CONSULTA POR VOZ",12,83,13,accent,brand,120);
   label(c,"CONSULTANDO COTAÇÃO REAL…",138,67,29,foreground,brand,420);
   fill(c,575,41,1,43,0xff45647b);
   label(c,"DÓLAR USD/BRL",593,45,17,accent,brand,240);
   label(c,"AGUARDANDO FONTE",593,77,21,foreground,brand,275);
   return;
  }
  // Header matches the USD/BRL name + colored market-state badge at y=44.
  // Keep prices, percentages, references, ticker and animation untouched.
  label(c,"BRENT",12,44,19,0xffff6d7f,brand,62);
  label(c,demo?"SIMULADO":marketHeaderStatus(brentSession),76,44,12,sessionColor(brentSession),brand,60);
  label(c,brent==null?"US$ —":"US$ "+amount(brent.price),138,68,37,foreground,brand,254);
  int tint=brent==null||brent.percent==null?0xffb8d2df:brent.percent>=0?0xff75edb2:0xffff7687;String variation=brent==null||brent.percent==null?"VAR. —":(brent.percent>=0?"▲ +":"▼ ")+amount(brent.percent)+"%";label(c,variation,402,66,25,tint,brand,162);fill(c,575,41,1,43,0xff45647b);
  label(c,"DÓLAR USD/BRL",593,44,16,accent,brand,174);label(c,demo?"SIMULADO":marketHeaderStatus(dollarSession),775,44,12,sessionColor(dollarSession),brand,110);
  label(c,dollar==null?"R$ —":"R$ "+amount(dollar.price),593,75,29,foreground,brand,150);Double pct=dollar==null?null:dollar.percent;label(c,pct==null?"VAR. —":(pct>=0?"▲ +":"▼ ")+amount(pct)+"%",755,75,21,pct==null?0xffb8d2df:pct>=0?0xff75edb2:0xffff7687,brand,130);
  label(c,brent==null?"NYMEX · SEM COTAÇÃO CONFIRMADA":"NYMEX · "+(brentSession.value==MarketState.OPEN?"REF. ":"ÚLTIMA ")+BrentQuote.reference(brent.at),138,89,12,0xffbdcfdd,data,430);
  label(c,dollar==null?"FONTE SEM COTAÇÃO CONFIRMADA":(dollarSession.value==MarketState.OPEN?"REF. ":"ÚLTIMA ")+BrentQuote.reference(dollar.at),593,91,11,0xffbdcfdd,data,287);
 }
 private void drawSatelliteNews(Canvas c){
  label(c,"SATÉLITE",12,70,32,0xffff6d7f,brand,119);
  label(c,satellite==null?"IMAGEM INDISPONÍVEL":"GOES-EAST · SUDESTE",142,62,28,foreground,brand,705);
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


package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** National seismic bulletin on the shared Argos Orbis TV strip. */
final class BrazilNationalBannerView extends View {
 static final int MODEL_BACKUP=1, MODEL_APPROVED=2;
 static final String PREF_MODEL="brazilBannerModel";
 static final float WIDTH=960f,HEIGHT=OledNewsChrome.FOOTER_END;
 private static final int WHITE=Color.WHITE;
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
 private final Alert alert;
 private final boolean demo,replay;
 private final boolean backup;
 private final BrazilGeoStates geography;
 private final BrazilGeoStates.State state;
 private final String place,headline,magnitude,depth,time,source,ticker;
 private final Typeface bold=OledNewsChrome.titleFont(null);
 private final Typeface regular=OledNewsChrome.regularFont();
 final TvEffectsController effects;
 private final RectF stateArea=new RectF();
 private Bitmap mapArtwork;private float[] epicenter;

 private boolean running;private long started;private boolean animated;
 private long clockMinute=-1;private String clock="--:--";

 BrazilNationalBannerView(Context context,Alert event,boolean demonstration,boolean repeated){
  super(context);
  alert=event;demo=demonstration;replay=repeated;
  effects=new TvEffectsController(context,TvEffectsController.EffectsCategory.BRAZIL,replay,demo);
  if(!event.revision.isEmpty()||event.companion!=null)effects.disableOpening();
  backup=Prefs.get(context).getInt(PREF_MODEL,MODEL_APPROVED)==MODEL_BACKUP;
  geography=BrazilGeoStates.load(context);
  state=geography==null?null:geography.locate(event);
  prepareMapArtwork();
  place=place(event,state);
  headline=headline(state);
  magnitude=Double.isFinite(event.magnitude)
   ?String.format(Locale.forLanguageTag("pt-BR"),"%.1f",event.magnitude)
   :magnitudeFromTitle(event.title);
  depth=Double.isFinite(event.depth)&&event.depth>=0
   ?String.format(Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km",event.depth)
   :"Profundidade não informada";
  time=event.eventTime>0?eventTime(event.eventTime):"Horário indisponível";
  String given=event.source==null||event.source.trim().isEmpty()?event.provider:event.source;
  source=given==null||given.trim().isEmpty()?"Fonte não informada":given.trim();
  ticker=(replay?"REPLAY HISTÓRICO · NÃO É NOVO ALERTA · ":"")
   +(demo?"SIMULAÇÃO · NÃO É ALERTA REAL · ":"")
   +place+" · "+depth+" · "+time+" · "+source+" · DADOS SUJEITOS A REVISÃO";
  setContentDescription((demo?"Simulação, não é um alerta real. ":replay?
   "Replay histórico, não é um novo alerta. ":"Registro sísmico no Brasil. ")
   +headline+". "+place+". Magnitude "+magnitude+". "+depth+". "+time+". "+source+".");
  setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
  OfficialArgosLogo.prepare(context);
 }
 static boolean isBrazilAlert(Alert event){
  if(event==null||!"earthquake".equals(event.kind)||event.compact)return false;
  if("BR".equalsIgnoreCase(event.countryCode))return true;
  if("USGS_BR".equalsIgnoreCase(event.catalog)||"USP".equalsIgnoreCase(event.catalog))return true;
  String title=event.title==null?"":event.title;
  if(title.matches("(?is).*\\b(?:Brasil|Brazil)\\b.*"))return true;
  BrazilGeoStates geo=null;
  // Coordinates are checked by the caller against the bundled real state polygons.
  return false;
 }
 static boolean isBrazilAlert(Context context,Alert event){
  if(isBrazilAlert(event))return true;
  if(event==null||!"earthquake".equals(event.kind)||event.compact)return false;
  BrazilGeoStates geo=BrazilGeoStates.load(context);
  return geo!=null&&geo.fromCoordinates(event.originLongitude,event.originLatitude)!=null;
 }
 static String eventTime(long when){
  SimpleDateFormat f=new SimpleDateFormat("HH'h'mm 'BRT'",Locale.forLanguageTag("pt-BR"));
  f.setTimeZone(TimeZone.getTimeZone("America/Sao_Paulo"));
  return f.format(new Date(when));
 }
 static String headline(BrazilGeoStates.State state){
  if(state==null)return "TREMOR REGISTRADO NO BRASIL";
  String uf=state.uf;
  String preposition;
  switch(uf){
   case "BA":case "PB":case "PE":case "AL":case "SE":case "CE":
   case "SC":case "AM":case "PA":case "RO":case "RR":case "AP":
    preposition=uf.equals("AM")||uf.equals("PA")||uf.equals("CE")||uf.equals("AP")?"NO ":"NA ";break;
   case "PR":case "MA":case "PI":case "AC":case "RS":case "RN":
   case "ES":case "RJ":case "MT":case "MS":case "TO":case "DF":
    preposition=uf.equals("PI")||uf.equals("RN")||uf.equals("RS")||uf.equals("RJ")||uf.equals("DF")
       ||uf.equals("PR")||uf.equals("MA")||uf.equals("ES")||uf.equals("TO")||uf.equals("AC")?"NO ":"EM ";break;
   default:preposition="EM ";
  }
  if(uf.equals("BA"))return "TREMOR REGISTRADO NA BAHIA";
  return "TREMOR REGISTRADO "+preposition+state.name.toUpperCase(Locale.forLanguageTag("pt-BR"));
 }
 private static String magnitudeFromTitle(String title){
  if(title!=null){
   java.util.regex.Matcher m=java.util.regex.Pattern.compile("M([0-9]+[,.][0-9]+)").matcher(title);
   if(m.find())return m.group(1).replace('.',',');
  }
  return "—";
 }
 private static String place(Alert a,BrazilGeoStates.State s){
  if(a.title==null||a.title.trim().isEmpty())return s==null?"Brasil":"Localização · "+s.uf;
  String location=a.title.replaceFirst("(?i)^M[0-9]+[,.][0-9]+\\s*[·:-]\\s*","").trim();
  if(location.equals(a.title)&&location.startsWith("M"))return s==null?"Brasil":s.name+" ("+s.uf+")";
  location=location.replaceFirst("(?i)[,\\s·–-]+(?:Brasil|Brazil)\\s*$","").trim();
  if(s!=null){
   // Avoid repeating the full state after a municipality, e.g. Jacobina, Bahia.
   String normalized=Normalizer.normalize(location,Normalizer.Form.NFD)
    .replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);
   String name=Normalizer.normalize(s.name,Normalizer.Form.NFD)
    .replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);
   if(normalized.endsWith(", "+name))location=location.substring(0,location.lastIndexOf(',')).trim();
   if(!location.matches("(?is).*\\b"+s.uf+"\\b.*"))location+=" ("+s.uf+")";
  }
  return location.isEmpty()?(s==null?"Brasil":s.name+" ("+s.uf+")"):location;
 }
 void startPresentation(long when,boolean allowAnimation){
  started=when;effects.start(when);animated=allowAnimation&&effects.animated();invalidate();
 }
 boolean isBackup(){return backup;}
 private void fill(Canvas c,float l,float t,float r,float b,int color){
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(color);c.drawRect(l,t,r,b,p);
 }
 private void ink(Canvas c,String text,float x,float baseline,float size,int color,Typeface face,float limit){
  if(text==null||text.isEmpty())return;
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setTypeface(face);
  float font=size;p.setTextSize(font);
  while(font>11f&&p.measureText(text)>limit){font-=.6f;p.setTextSize(font);}
  String shown=text;
  if(p.measureText(shown)>limit){
   while(shown.length()>1&&p.measureText(shown+"…")>limit)shown=shown.substring(0,shown.length()-1);
   shown+="…";
  }
  p.setColor(color);c.drawText(shown,x,baseline,p);
 }
 private void centered(Canvas c,String text,float center,float baseline,float size,int color,Typeface face,float width){
  p.setTypeface(face);p.setTextSize(size);
  while(size>11f&&p.measureText(text)>width){size-=.5f;p.setTextSize(size);}
  p.setColor(color);p.setShader(null);p.setStyle(Paint.Style.FILL);
  c.drawText(text,center-p.measureText(text)/2f,baseline,p);
 }
 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);if(started==0)return;animated=animated&&effects.animated();
  long drawStarted=SystemClock.elapsedRealtimeNanos();
  long elapsed=effects.elapsed(SystemClock.uptimeMillis());
  canvas.save();canvas.scale(getWidth()/WIDTH,getHeight()/HEIGHT);
  OledNewsChrome.base(canvas,p);
  OledNewsChrome.tab(canvas,p,"SISMO NO BRASIL",true);
  OledNewsChrome.tab(canvas,p,demo?"TESTE FICTÍCIO":replay?"REPLAY":"AO VIVO",false);
  drawBody(canvas,elapsed);
  BroadcastVisuals.radar(canvas,p,elapsed,animated);
  drawFooter(canvas,elapsed);
  canvas.restore();
  RuntimeDiagnostics.frame(drawStarted,SystemClock.elapsedRealtimeNanos()-drawStarted,animated);
  if(running){if(animated)postInvalidateOnAnimation();else postInvalidateDelayed(60000-Math.floorMod(System.currentTimeMillis(),60000));}
 }
 private float mapReveal=1;
 void mapReveal(float reveal){if(mapReveal!=reveal){mapReveal=reveal;invalidate();}}
 private void drawBody(Canvas c,long elapsed){
  float mapRight=backup?271:224;
  if(mapArtwork!=null&&mapReveal>0){
   c.save();c.clipRect(124,32,mapRight,92);
   int layer=mapReveal<1?c.saveLayerAlpha(124,32,mapRight,92,Math.round(255*mapReveal)):c.save();
   c.translate(0,(1-mapReveal)*(effects.full()?12:7));
   drawStateMap(c,stateArea(124,32,mapRight,92),elapsed);
   c.restoreToCount(layer);c.restore();
  }
  float textX=mapArtwork==null?124:mapRight+12;
  int alpha=animated?effects.opacity(elapsed):255;
  int layer=c.saveLayerAlpha(20,31,829,94,alpha);
  centered(c,"MAGNITUDE",68,50,13,0xffecb8bf,bold,99);
  centered(c,magnitude.equals("—")?magnitude:"M"+magnitude,68,76,32,0xffff7687,bold,99);
  ink(c,headline,textX,55,24,WHITE,bold,821-textX);
  ink(c,place,textX,73,16,0xffd8e4ee,bold,821-textX);
  ink(c,depth+"  ·  "+time,textX,89,14,0xffd8e4ee,regular,821-textX);
  c.restoreToCount(layer);
 }
 private RectF stateArea(float l,float t,float r,float b){stateArea.set(l,t,r,b);return stateArea;}
 private void prepareMapArtwork(){
  if(geography==null||mapArtwork!=null)return;
  int w=backup?147:100,h=60;
  mapArtwork=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);
  epicenter=geography.draw(new Canvas(mapArtwork),p,new RectF(0,0,w,h),state,alert,false);
 }
 private void drawStateMap(Canvas c,RectF area,long elapsed){
  if(mapArtwork==null||mapArtwork.isRecycled())return;
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(WHITE);
  p.setAlpha(animated?effects.imageOpacity(elapsed):255);
  c.drawBitmap(mapArtwork,area.left,area.top,p);p.setAlpha(255);
  if(epicenter==null)return;
  float x=area.left+epicenter[0],y=area.top+epicenter[1];
  if(animated&&effects.full()){
   float phase=(elapsed%2000L)/2000f;
   p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.6f);p.setColor(Color.argb(Math.round(180*(1-phase)),216,0,15));
   c.drawCircle(x,y,4f+14f*phase,p);
  }
  p.setStyle(Paint.Style.FILL);p.setColor(WHITE);c.drawCircle(x,y,6.5f,p);
  p.setColor(0xffd91024);c.drawCircle(x,y,4.8f,p);
 }
 private void drawFooter(Canvas c,long elapsed){
  long minute=System.currentTimeMillis()/60000;
  if(minute!=clockMinute){
   clockMinute=minute;clock=NewsBannerView.formatClock(System.currentTimeMillis());
  }
  fill(c,8,94,106,126,OledNewsChrome.RED_DARK);
  centered(c,clock,57,118,18,WHITE,OledNewsChrome.clockFont(),90);
  OledNewsChrome.brandFooter(c,p,elapsed,animated);
  float left=112,right=OledNewsChrome.BRAND_PLATE_LEFT-8;
  int layer=c.saveLayer(left,95,right,124,null);
  c.clipRect(left,95,right,124);
  p.setTypeface(OledNewsChrome.tickerFont());p.setTextSize(14);
  float length=p.measureText(ticker)+104;
  float offset=BroadcastVisuals.tickerOffset(elapsed,length,animated);
  ink(c,ticker,left-offset,118.5f,14,WHITE,OledNewsChrome.tickerFont(),Float.MAX_VALUE);
  ink(c,ticker,left-offset+length,118.5f,14,WHITE,OledNewsChrome.tickerFont(),Float.MAX_VALUE);
  OledNewsChrome.fadeTickerEdges(c,left,right);
  c.restoreToCount(layer);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();prepareMapArtwork();running=true;invalidate();}
 @Override protected void onDetachedFromWindow(){running=false;effects.stop();if(mapArtwork!=null){mapArtwork.recycle();mapArtwork=null;}epicenter=null;super.onDetachedFromWindow();}
}

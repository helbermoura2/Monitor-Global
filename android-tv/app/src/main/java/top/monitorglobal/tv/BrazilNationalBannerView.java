package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Brazil's distinct editorial television lower-third, matching the user's
 * approved red/white JPG composition (not the regional OLED quake strip).
 * Every label comes from a live Alert; the JPG's fictional numbers and blurry
 * newsroom background are NEVER part of the shipped on-screen graphics.
 *
 * Model 2: approved red-and-white BRASIL / main headline / right magnitude.
 * Model 1: retained teal-and-white newsroom backup, selected in TV settings.
 */
final class BrazilNationalBannerView extends View {
 static final int MODEL_BACKUP=1, MODEL_APPROVED=2;
 static final String PREF_MODEL="brazilBannerModel";
 static final float WIDTH=960f,HEIGHT=180f,HEADER_END=26f,BODY_END=141f,FOOTER_END=180f;
 private static final int RED=0xffb60000,TEAL=0xff064e59,WHITE=Color.WHITE,BLACK=Color.BLACK;
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
 private final Alert alert;
 private final boolean demo,replay;
 private final boolean backup;
 private final BrazilGeoStates geography;
 private final BrazilGeoStates.State state;
 private final String place,headline,magnitude,depth,time,source,ticker;
 private final Typeface bold=Typeface.create("sans-serif-condensed",Typeface.BOLD);
 private final Typeface regular=Typeface.create("sans-serif",Typeface.NORMAL);
 private final boolean animationEnabled=android.animation.ValueAnimator.areAnimatorsEnabled();
 private boolean running;private long started;private boolean animated;
 private long clockMinute=-1;private String clock="--:--";

 BrazilNationalBannerView(Context context,Alert event,boolean demonstration,boolean repeated){
  super(context);
  alert=event;demo=demonstration;replay=repeated;
  backup=Prefs.get(context).getInt(PREF_MODEL,MODEL_APPROVED)==MODEL_BACKUP;
  geography=BrazilGeoStates.load(context);
  state=geography==null?null:geography.locate(event);
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
  started=when;animated=allowAnimation&&animationEnabled;invalidate();
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
  super.onDraw(canvas);if(started==0)return;
  long elapsed=Math.max(0,SystemClock.uptimeMillis()-started);
  canvas.save();canvas.scale(getWidth()/WIDTH,getHeight()/HEIGHT);
  drawHeader(canvas,elapsed);
  drawBody(canvas,elapsed);
  drawFooter(canvas,elapsed);
  canvas.restore();
  if(running&&animated)postInvalidateOnAnimation();
 }
 private void drawHeader(Canvas c,long elapsed){
  if(backup){
   fill(c,0,0,WIDTH,HEADER_END,TEAL);
   // A real country emblem, not a nearby-state or guessed flag.
   drawBrazilFlag(c,17,3,43,20);
   ink(c,"BRASIL",70,19,22,WHITE,bold,112);
   fill(c,182,4,183,23,0xffd4ebee);
   ink(c,"BOLETIM SÍSMICO",195,19,19,WHITE,regular,260);
  }else{
   fill(c,0,23,WIDTH,26,RED);
  }
  String status=demo?"SIMULAÇÃO · NÃO É ALERTA REAL":replay?
    "REPLAY · REGISTRO HISTÓRICO":"MONITORAMENTO NACIONAL";
  // A red/white clipped status ribbon lives directly above the main bar.
  Path flag=new Path();flag.moveTo(711,0);flag.lineTo(949,0);flag.lineTo(960,25);flag.lineTo(696,25);flag.close();
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(backup?0xffe9eef0:0xffba0b14);c.drawPath(flag,p);
  centered(c,status,827,18,17,backup?BLACK:WHITE,bold,224);
 }
 private void drawBody(Canvas c,long elapsed){
  fill(c,0,26,WIDTH,BODY_END,WHITE);
  if(backup){
   fill(c,0,26,219,BODY_END,0xffd6e6e9);
   if(geography!=null)drawStateMap(c,new RectF(10,30,211,136),elapsed,true);
   else ink(c,"MAPA INDISPONÍVEL",22,90,14,0xff355a64,regular,190);
  }else{
   fill(c,0,26,109,BODY_END,RED);
   centered(c,"BRASIL",54,91,27,WHITE,bold,100);
   if(geography!=null)drawStateMap(c,new RectF(112,31,214,135),elapsed,false);
   else ink(c,"BR",137,100,35,0xff6c7780,bold,75);
  }
  float textX=backup?233:223;
  float textRight=812;
  int alpha=animated?Math.round(255f*Math.min(1f,Math.max(0,(elapsed-160)/420f))):255;
  c.saveLayerAlpha(textX,30,textRight,140,Math.max(0,alpha));
  ink(c,headline,textX,87,37,BLACK,bold,textRight-textX-8);
  String detail=place+"   •   "+depth+"   •   "+time;
  ink(c,detail,textX,118,22,0xff4c4c4c,regular,textRight-textX-14);
  c.restore();
  fill(c,813,38,814,127,0xff777777);
  centered(c,"MAGNITUDE",888,61,21,0xff111111,bold,132);
  centered(c,magnitude,888,126,72,BLACK,bold,137);
 }
 private void drawBrazilFlag(Canvas c,float x,float y,float w,float h){
  fill(c,x,y,x+w,y+h,0xff009b3a);
  Path diamond=new Path();diamond.moveTo(x+w/2,y+2);diamond.lineTo(x+w-4,y+h/2);
  diamond.lineTo(x+w/2,y+h-2);diamond.lineTo(x+4,y+h/2);diamond.close();
  p.setColor(0xffffdf00);p.setStyle(Paint.Style.FILL);c.drawPath(diamond,p);
  p.setColor(0xff002776);c.drawCircle(x+w/2,y+h/2,h*.27f,p);
 }
 private void drawStateMap(Canvas c,RectF area,long elapsed,boolean teal){
  float[] marker=geography.draw(c,p,area,state,alert,teal);
  if(marker==null)return;
  p.setShader(null);p.setStyle(Paint.Style.STROKE);
  if(animated){
   float phase=(elapsed%2000L)/2000f;
   p.setStrokeWidth(1.6f);p.setColor(Color.argb(Math.round(180*(1-phase)),216,0,15));
   c.drawCircle(marker[0],marker[1],4f+14f*phase,p);
  }
  p.setStyle(Paint.Style.FILL);p.setColor(WHITE);c.drawCircle(marker[0],marker[1],6.5f,p);
  p.setColor(0xffd91024);c.drawCircle(marker[0],marker[1],4.8f,p);
 }
 private void drawFooter(Canvas c,long elapsed){
  final int base=backup?0xff063c46:0xffa50000;
  p.setShader(new LinearGradient(0,BODY_END,0,FOOTER_END,
    backup?new int[]{0xff072f36,0xff00434b}:new int[]{0xffb80000,0xff850000},
    null,Shader.TileMode.CLAMP));
  p.setStyle(Paint.Style.FILL);c.drawRect(0,BODY_END,WIDTH,FOOTER_END,p);p.setShader(null);
  fill(c,0,BODY_END,WIDTH,BODY_END+1,backup?0xffd3e8e8:0xffe54444);
  ink(c,"SISMO NO BRASIL",17,167,21,WHITE,bold,166);
  fill(c,178,150,179,174,0xffefcfcf);
  float tickerX=194,tickerRight=744;
  c.save();c.clipRect(tickerX,145,tickerRight,179);
  p.setTypeface(regular);p.setTextSize(17);
  float textWidth=p.measureText(ticker);
  float offset=animated&&textWidth>tickerRight-tickerX
    ?elapsed/1000f*22f%(textWidth+55):0f;
  ink(c,ticker,tickerX-offset,166,17,WHITE,regular,Math.max(textWidth+15f,tickerRight-tickerX));
  if(textWidth>tickerRight-tickerX)ink(c,ticker,tickerX-offset+textWidth+55,166,17,WHITE,regular,textWidth+15f);
  c.restore();
  fill(c,744,148,745,174,0xffedaaaa);
  // Official eye lives small in the footer: blink + pointer animation as in other strips.
  c.save();c.translate(750,145);c.scale(.43f,.47f);c.translate(-830,-31);
  OfficialArgosLogo.draw(c,elapsed,animated);c.restore();
  ink(c,"ARGOS ORBIS",796,162,13,WHITE,bold,96);
  ink(c,"CUSTOS ORBIS",796,174,8,0xffe8c5a0,regular,96);
  fill(c,890,148,891,174,0xffedaaaa);
  long minute=System.currentTimeMillis()/60000;
  if(minute!=clockMinute){
   clockMinute=minute;
   clock=NewsBannerView.formatClock(System.currentTimeMillis());
  }
  centered(c,clock,926,168,22,WHITE,bold,63);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();running=true;invalidate();}
 @Override protected void onDetachedFromWindow(){running=false;super.onDetachedFromWindow();}
}

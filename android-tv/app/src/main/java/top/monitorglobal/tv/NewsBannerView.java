package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.regex.*;

/** Non-interactive broadcast overlay. Only the clipped footer animates; no focus required. */
final class NewsBannerView extends View {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Typeface brand,data;
 private final Alert alert;
 private final boolean demo;
 private final long started=SystemClock.uptimeMillis();
 private final String magnitude,location,time,ticker;
 private final int accent,foreground,background;
 private final Bitmap flag;
 private final boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
 private boolean running;
 NewsBannerView(Context context,Alert a,boolean demonstration){
  super(context);alert=a;demo=demonstration;
  brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
  data=Typeface.createFromAsset(context.getAssets(),"fonts/JetBrainsMono.ttf");
  accent=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(context).getString("themeAccent","#38bdf8"));
  foreground=Color.parseColor(Prefs.get(context).getString("themeText","#ffffff"));
  background=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#071724":Prefs.get(context).getString("themeBackground","#071724"));
  Matcher m=Pattern.compile("^(M[0-9]+[,.][0-9]+)\\s*·\\s*(.*)$").matcher(a.title);
  boolean quake=m.matches();magnitude=quake?m.group(1):"TSUNAMI";location=quake?m.group(2):a.title;
  time=formatTime(a.kind.equals("tsunami")?a.issuedAt:a.eventTime);
  flag=CountryFlag.load(context,a);
  ticker=(demo?"TESTE FICTÍCIO · ":"")+(a.revision.isEmpty()?"":a.revision+" · Atualização: "+formatTime(a.issuedAt)+"     •     ")+(a.tsunamiSummary.isEmpty()?"":"TSUNAMI · "+a.tsunamiSummary+"     •     ")+a.title+"     •     "+a.detail+"     •     "+(a.kind.equals("tsunami")?"Boletim: ":"Origem do sismo: ")+time+"     •     "+(a.kind.equals("tsunami")?"Válido somente para as costas citadas · siga as orientações das autoridades locais":"Magnitude sujeita a revisão");
  setContentDescription((demo?"Demonstração, não é um alerta real. ":"")+a.title+". "+a.detail+". "+a.revision+". "+a.tsunamiSummary+". "+time);
  setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
 }
 private void rect(Canvas c,float l,float t,float r,float b,int color){paint.setColor(color);paint.setStyle(Paint.Style.FILL);c.drawRect(l,t,r,b,paint);}
 private void text(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setColor(color);paint.setStyle(Paint.Style.FILL);paint.setTextSize(size);paint.setTypeface(font);
  // Ellipsize once at the available width; do not shrink long locations into unreadable type.
  while(value.length()>0&&paint.measureText(value)>max)value=value.substring(0,value.offsetByCodePoints(value.length(),-1));
  c.drawText(value,x,y,paint);
 }
 private void fitText(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setTextSize(size);paint.setTypeface(font);
  String shown=value;if(paint.measureText(value)>max){while(shown.length()>0&&paint.measureText(shown+"…")>max)shown=shown.substring(0,shown.offsetByCodePoints(shown.length(),-1));shown+="…";}
  text(c,shown,x,y,size,color,font,max);
 }
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);c.save();c.scale(getWidth()/960f,getHeight()/126f);
  paint.setColor(background);paint.setStyle(Paint.Style.FILL);c.drawRoundRect(0,0,960,126,10,10,paint);
  paint.setColor(accent);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1);c.drawRoundRect(1,1,959,125,10,10,paint);paint.setStyle(Paint.Style.FILL);
  // Red/white news label belongs to the brand, never encodes tsunami severity.
  rect(c,1,1,218,23,Color.rgb(191,24,39));
  text(c,"BREAKING NEWS",20,18,19,Color.WHITE,brand,194);
  radar(c,36,63);
  text(c,"MONITOR",69,59,24,foreground,brand,140);text(c,"GLOBAL",69,81,24,foreground,brand,140);
  rect(c,218,24,219,102,Color.rgb(49,76,91));
  int block=Color.rgb(191,24,39);
  if(alert.kind.equals("tsunami")){if(alert.state.equals("ended")||alert.state.equals("information"))block=Color.rgb(64,82,101);else if(alert.state.equals("noThreat"))block=Color.rgb(25,105,101);else if(!alert.state.equals("warning"))block=Color.rgb(140,94,15);}
  rect(c,230,29,377,94,block);
  int alpha=animate&&alert.kind.equals("earthquake")?(int)(235+20*Math.cos((SystemClock.uptimeMillis()-started)/1000f*Math.PI)):255;
  text(c,magnitude,240,76,magnitude.equals("TSUNAMI")?27:49,Color.argb(alpha,255,255,255),brand,129);
  String stateLabel=alert.kind.equals("tsunami")?tsunamiLabel(alert.state):!alert.revision.isEmpty()?"REVISÃO · "+alert.revision:!alert.tsunamiSummary.isEmpty()?"SISMO COM AVISO REGIONAL DE TSUNAMI":"NOVO SISMO";
  String heading=(demo?"TESTE FICTÍCIO · NÃO É ALERTA REAL · ":"")+stateLabel;
  fitText(c,heading,391,22,13,demo?Color.rgb(255,214,119):foreground,brand,552);
  float locationWidth=flag==null?550:505;
  fitText(c,location,391,57,31,foreground,brand,locationWidth);
  if(flag!=null){paint.setTypeface(brand);paint.setTextSize(31);float x=391+Math.min(paint.measureText(location),locationWidth)+10;paint.setAlpha(255);c.drawBitmap(flag,null,new RectF(x,35,x+32,59),paint);}
  rect(c,389,65,944,66,Color.rgb(49,76,91));
  String details=alert.detail.replaceFirst("^Revisão · ","");int split=details.indexOf(" · ");
  String first=alert.kind.equals("tsunami")?tsunamiLabel(alert.state):split<0?details:details.substring(0,split);
  String source=!alert.source.isEmpty()?alert.source:split<0?"Fonte não informada":details.substring(split+3);
  fitText(c,first,391,86,17,foreground,brand,270);
  rect(c,668,72,669,92,Color.rgb(49,76,91));fitText(c,source,681,86,17,foreground,brand,110);
  rect(c,800,72,801,92,Color.rgb(49,76,91));text(c,time,813,86,15,foreground,data,131);
  rect(c,1,101,959,102,accent);
  text(c,demo?"TESTE":"INFORMAÇÕES",12,119,14,accent,brand,108);
  rect(c,123,106,124,122,Color.rgb(49,76,91));
  c.save();c.clipRect(135,103,947,124);paint.setTypeface(data);paint.setTextSize(13);float length=paint.measureText(ticker)+90;
  // Time-based 32 design pixels/second, two copies wrap without blank gaps or jumps.
  float offset=animate?((SystemClock.uptimeMillis()-started)/1000f*32)%length:0;
  text(c,ticker,135-offset,119,13,foreground,data,Float.MAX_VALUE);
  text(c,ticker,135-offset+length,119,13,foreground,data,Float.MAX_VALUE);c.restore();c.restore();
  if(animate&&running&&isShown())postInvalidateOnAnimation();
 }
 private void radar(Canvas c,float x,float y){
  paint.setColor(Color.rgb(2,8,22));paint.setStyle(Paint.Style.FILL);c.drawRoundRect(x-26,y-26,x+26,y+26,8,8,paint);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.6f);paint.setColor(Color.rgb(28,97,130));
  for(float r:new float[]{23,16,8})c.drawCircle(x,y,r,paint);
  paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(56,189,248));
  float angle=animate?((SystemClock.uptimeMillis()-started)%2400)/2400f*360:0;
  c.drawArc(x-23,y-23,x+23,y+23,-90+angle,45,true,paint);c.drawCircle(x,y,3,paint);
 }
 static String formatTime(long at){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.forLanguageTag("pt-BR"));f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static String tsunamiLabel(String state){switch(state){case "warning":return "AVISO DE TSUNAMI";case "watch":return "VIGILÂNCIA DE TSUNAMI";case "advisory":return "ATENÇÃO PARA TSUNAMI";case "ended":return "AVISO ENCERRADO · COSTAS CITADAS";case "noThreat":return "SEM AMEAÇA · COSTAS CITADAS";case "unknown":return "SITUAÇÃO DE TSUNAMI NÃO CONFIRMADA";default:return "BOLETIM INFORMATIVO DE TSUNAMI";}}
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();running=true;invalidate();}
 @Override protected void onDetachedFromWindow(){running=false;super.onDetachedFromWindow();}
}

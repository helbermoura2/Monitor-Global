package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.regex.*;

/** One overlay: stable brand/footer, softly changing event content. No focus required. */
final class NewsBannerView extends View {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Typeface brand,data;
 private final Alert root;
 private final Page[] pages;
 private final boolean demo,replay;
 private final long started=SystemClock.uptimeMillis();
 private final String ticker;
 private final int accent,foreground,background;
 private final boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
 private boolean running;
 private final class Page {
  final Alert alert;final String magnitude,oldMagnitude,location,headline,heading,time,first,source;final Bitmap flag;
  Page(Alert a){
   alert=a;Matcher m=Pattern.compile("^(M[0-9]+[,.][0-9]+)\\s*·\\s*(.*)$").matcher(a.title);
   boolean quake=m.matches();magnitude=quake?m.group(1):"TSUNAMI";location=quake?m.group(2):a.title;
   headline=BannerTimeline.magnitudeChanged(a)?a.revision+" · "+location:!a.revision.isEmpty()?"DADOS REVISADOS · "+location:location;
   time=formatTime(a.kind.equals("tsunami")?a.issuedAt:a.eventTime);flag=CountryFlag.load(getContext(),a);
   String details=a.detail.replaceFirst("^Revisão · ","");int split=details.indexOf(" · ");
   first=a.kind.equals("tsunami")?tsunamiLabel(a.state):split<0?details:details.substring(0,split);
   source=!a.source.isEmpty()?a.source:split<0?"Fonte não informada":details.substring(split+3);
   oldMagnitude=BannerTimeline.magnitudeChanged(a)?String.format(java.util.Locale.forLanguageTag("pt-BR"),"M%.1f",a.previousMagnitude):"";
   String stateLabel=a.kind.equals("tsunami")?tsunamiLabel(a.state):!a.revision.isEmpty()?"ATUALIZAÇÃO DO SISMO":a!=root?"SISMO ASSOCIADO AO BOLETIM":!a.tsunamiSummary.isEmpty()?"SISMO COM AVISO REGIONAL DE TSUNAMI":"NOVO SISMO";
   heading=(demo?"TESTE FICTÍCIO · NÃO É ALERTA REAL · ":replay?"REPLAY · "+formatRecordTime(a.issuedAt)+" · ":"")+stateLabel;
  }
 }
 NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated){
  super(context);root=a;demo=demonstration;replay=repeated;
  brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");data=Typeface.createFromAsset(context.getAssets(),"fonts/JetBrainsMono.ttf");
  accent=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(context).getString("themeAccent","#38bdf8"));
  foreground=Color.parseColor(Prefs.get(context).getString("themeText","#ffffff"));background=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#071724":Prefs.get(context).getString("themeBackground","#071724"));
  pages=AlertPairing.isPair(a,a.companion)?new Page[]{new Page(a),new Page(a.companion)}:new Page[]{new Page(a)};
  StringBuilder line=new StringBuilder(demo?"TESTE FICTÍCIO · ":replay?"REPLAY · REGISTRO HISTÓRICO LOCAL · ":"");
  for(Page p:pages){Alert v=p.alert;if(!v.revision.isEmpty())line.append(v.revision).append(" · Atualização: ").append(formatTime(v.issuedAt)).append("     •     ");
   if(!v.tsunamiSummary.isEmpty())line.append("TSUNAMI · ").append(v.tsunamiSummary).append("     •     ");
   line.append(v.title).append("     •     ").append(v.detail).append("     •     ").append(v.kind.equals("tsunami")?"Boletim: ":"Origem do sismo: ").append(p.time).append("     •     ");
  }
  line.append("Siga as orientações das autoridades locais");ticker=line.toString();
  setContentDescription((demo?"Demonstração, não é alerta real. ":replay?"Replay de registro histórico. ":"")+ticker);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
 }
 private void rect(Canvas c,float l,float t,float r,float b,int color){paint.setColor(color);paint.setStyle(Paint.Style.FILL);c.drawRect(l,t,r,b,paint);}
 private void text(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setColor(color);paint.setStyle(Paint.Style.FILL);paint.setTextSize(size);paint.setTypeface(font);
  while(value.length()>0&&paint.measureText(value)>max)value=value.substring(0,value.offsetByCodePoints(value.length(),-1));c.drawText(value,x,y,paint);
 }
 private void fitText(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setTextSize(size);paint.setTypeface(font);String shown=value;
  if(paint.measureText(value)>max){while(shown.length()>0&&paint.measureText(shown+"…")>max)shown=shown.substring(0,shown.offsetByCodePoints(shown.length(),-1));shown+="…";}
  text(c,shown,x,y,size,color,font,max);
 }
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);long elapsed=SystemClock.uptimeMillis()-started;c.save();c.scale(getWidth()/960f,getHeight()/126f);
  paint.setColor(background);paint.setStyle(Paint.Style.FILL);c.drawRoundRect(0,0,960,126,10,10,paint);paint.setColor(accent);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1);c.drawRoundRect(1,1,959,125,10,10,paint);paint.setStyle(Paint.Style.FILL);
  rect(c,1,1,218,23,Color.rgb(191,24,39));text(c,replay?"REPLAY":"BREAKING NEWS",20,18,19,Color.WHITE,brand,194);
  radar(c,36,63,elapsed);text(c,"MONITOR",69,59,24,foreground,brand,140);text(c,"GLOBAL",69,81,24,foreground,brand,140);rect(c,218,24,219,102,Color.rgb(49,76,91));
  int index=BannerTimeline.page(elapsed,pages.length);long within=elapsed%BannerTimeline.PAGE_MS;
  if(animate&&pages.length>1&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS){
   float t=BannerTimeline.progress(within);drawPage(c,pages[(index+pages.length-1)%pages.length],elapsed,(int)(255*(1-t)),-3*t);drawPage(c,pages[index],elapsed,(int)(255*t),3*(1-t));
  }else drawPage(c,pages[index],elapsed,255,0);
  rect(c,1,101,959,102,accent);text(c,demo?"TESTE":replay?"REPLAY":"INFORMAÇÕES",12,119,14,accent,brand,108);rect(c,123,106,124,122,Color.rgb(49,76,91));
  c.save();c.clipRect(135,103,947,124);paint.setTypeface(data);paint.setTextSize(13);float length=paint.measureText(ticker)+90;
  float offset=animate?(elapsed/1000f*32)%length:0;text(c,ticker,135-offset,119,13,foreground,data,Float.MAX_VALUE);text(c,ticker,135-offset+length,119,13,foreground,data,Float.MAX_VALUE);c.restore();c.restore();
  if(running&&isShown()){if(animate)postInvalidateOnAnimation();else if(pages.length>1)postInvalidateDelayed(BannerTimeline.PAGE_MS-within);}
 }
 private void drawPage(Canvas c,Page p,long elapsed,int opacity,float shift){
  if(opacity<=0)return;int layer=opacity<255?c.saveLayerAlpha(220,0,958,100,opacity):c.save();c.clipRect(220,0,958,100);c.translate(0,shift);
  Alert a=p.alert;int block=Color.rgb(191,24,39);
  if(a.kind.equals("tsunami")){if(a.state.equals("ended")||a.state.equals("information"))block=Color.rgb(64,82,101);else if(a.state.equals("noThreat"))block=Color.rgb(25,105,101);else if(!a.state.equals("warning"))block=Color.rgb(140,94,15);}
  rect(c,230,29,377,94,block);
  if(BannerTimeline.magnitudeChanged(a)){
   String old=p.oldMagnitude;
   if(!animate||elapsed>=BannerTimeline.REVISION_AT_MS+BannerTimeline.FADE_MS)magnitude(c,p.magnitude,"ATUAL",255);
   else if(elapsed<BannerTimeline.REVISION_AT_MS)magnitude(c,old,"ANTERIOR",255);
   else{float t=BannerTimeline.progress(elapsed-BannerTimeline.REVISION_AT_MS);magnitude(c,old,"ANTERIOR",(int)(255*(1-t)));magnitude(c,p.magnitude,"ATUAL",(int)(255*t));}
  }else{int alpha=animate&&a.kind.equals("earthquake")?(int)(235+20*Math.cos(elapsed/1000f*Math.PI)):255;text(c,p.magnitude,240,76,p.magnitude.equals("TSUNAMI")?27:49,Color.argb(alpha,255,255,255),brand,129);}
  fitText(c,p.heading,391,22,13,demo?Color.rgb(255,214,119):foreground,brand,552);
  float width=p.flag==null?550:505;fitText(c,p.headline,391,57,BannerTimeline.magnitudeChanged(a)?28:31,foreground,brand,width);
  if(p.flag!=null){paint.setTypeface(brand);paint.setTextSize(BannerTimeline.magnitudeChanged(a)?28:31);float x=391+Math.min(paint.measureText(p.headline),width)+10;paint.setAlpha(255);c.drawBitmap(p.flag,null,new RectF(x,35,x+32,59),paint);}
  rect(c,389,65,944,66,Color.rgb(49,76,91));fitText(c,p.first,391,86,17,foreground,brand,270);rect(c,668,72,669,92,Color.rgb(49,76,91));fitText(c,p.source,681,86,17,foreground,brand,110);rect(c,800,72,801,92,Color.rgb(49,76,91));text(c,p.time,813,86,15,foreground,data,131);c.restoreToCount(layer);
 }
 private void magnitude(Canvas c,String value,String label,int opacity){if(opacity<=0)return;int layer=c.saveLayerAlpha(231,30,376,94,opacity);text(c,value,240,73,49,Color.WHITE,brand,129);text(c,label,245,90,12,Color.WHITE,brand,120);c.restoreToCount(layer);}
 private void radar(Canvas c,float x,float y,long elapsed){
  paint.setColor(Color.rgb(2,8,22));paint.setStyle(Paint.Style.FILL);c.drawRoundRect(x-26,y-26,x+26,y+26,8,8,paint);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.6f);paint.setColor(Color.rgb(28,97,130));for(float r:new float[]{23,16,8})c.drawCircle(x,y,r,paint);
  paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(56,189,248));float angle=animate?(elapsed%2400)/2400f*360:0;c.drawArc(x-23,y-23,x+23,y+23,-90+angle,45,true,paint);c.drawCircle(x,y,3,paint);
 }
 static String formatTime(long at){return date(at,"HH:mm 'BRT'");}
 private static String formatRecordTime(long at){return date(at,"dd/MM/yyyy HH:mm 'BRT'");}
 private static String date(long at,String pattern){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat(pattern,java.util.Locale.forLanguageTag("pt-BR"));f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static String tsunamiLabel(String state){switch(state){case "warning":return "AVISO DE TSUNAMI";case "watch":return "VIGILÂNCIA DE TSUNAMI";case "advisory":return "ATENÇÃO PARA TSUNAMI";case "ended":return "AVISO ENCERRADO · COSTAS CITADAS";case "noThreat":return "SEM AMEAÇA · COSTAS CITADAS";case "unknown":return "SITUAÇÃO DE TSUNAMI NÃO CONFIRMADA";default:return "BOLETIM INFORMATIVO DE TSUNAMI";}}
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();running=true;invalidate();}
 @Override protected void onDetachedFromWindow(){running=false;super.onDetachedFromWindow();}
}

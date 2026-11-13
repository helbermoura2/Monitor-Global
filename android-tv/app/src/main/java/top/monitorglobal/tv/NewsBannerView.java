package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.regex.*;

/** One overlay: stable brand/footer, softly changing event content. No focus required. */
final class NewsBannerView extends View {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 static final float HEADLINE_X=124,HEADLINE_Y=64,HEADLINE_TOP=40,HEADLINE_BOTTOM=72,HEADLINE_WIDTH=714,FLAG_RESERVE=44;
 private final Path breakingClip=new Path();private final float breakingWidth,badgeWidth;private final Path bannerClip=new Path(),telegramPlane=new Path();private final float[] identityWidths=new float[2],identityTextWidths=new float[2];
 private long clockMinute=Long.MIN_VALUE;private String clockText="--:--";
 private final Matrix shineMatrix=new Matrix();
 private final LinearGradient shine=new LinearGradient(0,0,70,0,new int[]{Color.TRANSPARENT,0x50ffffff,Color.TRANSPARENT},null,Shader.TileMode.CLAMP);
 private final Typeface brand,data;
 private final Alert root;
 private final Page[] pages;
 private final boolean demo,replay;
 private final boolean summary;private final String summaryDay;private final long pageMillis;
 private long started;private boolean presentationAnimated;
 void startPresentation(long when,boolean animated){started=when;presentationAnimated=animated&&animate;invalidate();}
 private final String ticker;
 private final int accent,foreground,background;
 private final boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
 private boolean running;private MapInset mapInset;private float mapReveal=1;
 private final boolean mapBelow;private final int mapSpace;
 void mapReveal(float p){if(mapReveal!=p){mapReveal=p;invalidate();}}
 private final class Page {
  String caption;final Alert alert;final String magnitude,oldMagnitude,location,headline,heading,time,first,source;final Bitmap flag;
  Page(Alert a){
   alert=a;Matcher m=Pattern.compile("^(M[0-9]+[,.][0-9]+)\\s*·\\s*(.*)$").matcher(a.title);
   boolean quake=m.matches();magnitude=quake?m.group(1):"TSUNAMI";location=quake?m.group(2):a.title.replaceFirst("^Sem ameaça segundo o boletim · ","");
   headline=BannerTimeline.magnitudeChanged(a)?a.revision+" · "+location:!a.revision.isEmpty()?(a.revision.startsWith("Nova estimativa")?"NOVA ESTIMATIVA · ":"DADOS REVISADOS · ")+location:location;
   time=formatTime(a.kind.equals("tsunami")?a.issuedAt:a.eventTime);flag=CountryFlag.load(getContext(),a);
   String details=a.detail.replaceFirst("^Revisão · ","");int split=details.indexOf(" · ");
   first=a.kind.equals("tsunami")?tsunamiLabel(a.state):split<0?details:details.substring(0,split);
   source=!a.source.isEmpty()?a.source:split<0?"Fonte não informada":details.substring(split+3);
   oldMagnitude=BannerTimeline.magnitudeChanged(a)?String.format(java.util.Locale.forLanguageTag("pt-BR"),"M%.1f",a.previousMagnitude):"";
   String stateLabel=a.kind.equals("tsunami")?tsunamiLabel(a.state):a.compact?"SISMO REGIONAL · ÁREA MONITORADA":!a.revision.isEmpty()?(a.revision.startsWith("Nova estimativa")?"NOVA ESTIMATIVA DE OUTRA FONTE":"ATUALIZAÇÃO DO SISMO"):!summary&&a!=root?"SISMO ASSOCIADO AO BOLETIM":!a.tsunamiSummary.isEmpty()?"SISMO COM AVISO REGIONAL DE TSUNAMI":summary?"MAIORES MAGNITUDES DO DIA":"NOVO SISMO";
   heading=(summary?(replay?"REPLAY DO RESUMO · ":"RESUMO · ")+summaryDay+" · ":demo?"TESTE FICTÍCIO · NÃO É ALERTA REAL · ":replay?"REPLAY · "+formatRecordTime(a.issuedAt)+" · ":"")+stateLabel;caption=heading;
  }
 }
 NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated){
  this(context,a,demonstration,repeated,null,"",false);
 }
 NewsBannerView(Context context,java.util.List<Alert> alerts,String day,boolean repeated,boolean complete){this(context,alerts.get(0),false,repeated,alerts,day,complete);}
 private NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated,java.util.List<Alert> daily,String day,boolean complete){
  super(context);mapSpace=Banner.insetDp(context);mapBelow=Prefs.get(context).getBoolean("themeTop",false);summary=daily!=null;summaryDay=BrDates.day(day);pageMillis=summary?BannerTimeline.SUMMARY_PAGE_MS:BannerTimeline.PAGE_MS;root=a;demo=demonstration;replay=repeated;
  brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");data=Typeface.createFromAsset(context.getAssets(),"fonts/JetBrainsMono.ttf");
  paint.setTypeface(brand);breakingWidth=BroadcastVisuals.BREAKING_WIDTH;breakingClip.addRoundRect(0,0,breakingWidth,30,7,7,Path.Direction.CW);badgeWidth=BroadcastVisuals.statusWidth(paint,brand,badgeLabel());bannerClip.addRoundRect(0,24,960,126,new float[]{0,0,0,0,8,8,8,8},Path.Direction.CW);
  identityTextWidths[0]=paint.measureText("monitorglobal.top");identityTextWidths[1]=paint.measureText("@monitor_global");identityWidths[0]=(float)Math.ceil(identityTextWidths[0])+12;identityWidths[1]=(float)Math.ceil(identityTextWidths[1])+34;
  telegramPlane.moveTo(-5.5f,-.5f);telegramPlane.lineTo(5,-4.5f);telegramPlane.lineTo(3,5);telegramPlane.lineTo(-.5f,2);telegramPlane.lineTo(2.5f,-1.5f);telegramPlane.lineTo(-2,1);telegramPlane.close();
  accent=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(context).getString("themeAccent","#38bdf8"));
  foreground=Color.parseColor(Prefs.get(context).getString("themeText","#ffffff"));background=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#071724":Prefs.get(context).getString("themeBackground","#071724"));
  if(summary){pages=new Page[daily.size()];for(int i=0;i<pages.length;i++){pages[i]=new Page(daily.get(i));pages[i].caption=(i+1)+"º DE "+pages.length+" · "+pages[i].heading;}}
  else pages=AlertPairing.isPair(a,a.companion)?new Page[]{new Page(a),new Page(a.companion)}:new Page[]{new Page(a)};
  StringBuilder line=new StringBuilder(summary?(replay?"REPLAY DO RESUMO · ":"RESUMO DO DIA · ")+summaryDay+" · HORÁRIO DE BRASÍLIA · FONTES SÍSMICAS · "+(complete?"DIA ENCERRADO · ":"PARCIAL ATÉ A CONSULTA · "):demo?"TESTE FICTÍCIO · ":replay?"REPLAY · REGISTRO HISTÓRICO · ":"");
  for(Page p:pages){Alert v=p.alert;if(!v.revision.isEmpty())line.append(v.revision).append(" · Atualização: ").append(formatTime(v.issuedAt)).append("     •     ");
   if(!v.populationSummary.isEmpty())line.append(v.populationSummary).append("     •     ");
   if(!v.nearbySummary.isEmpty())line.append(v.nearbySummary).append("     •     ");
   if(v.compact&&!v.targetArea.isEmpty())line.append("ÁREA MONITORADA: ").append(v.targetArea).append("     •     ");
   if(!v.tsunamiSummary.isEmpty())line.append("TSUNAMI · ").append(v.tsunamiSummary).append("     •     ");
   line.append(v.title).append("     •     ").append(v.detail).append("     •     ").append(v.kind.equals("tsunami")?"Boletim: ":"Origem do sismo: ").append(p.time).append("     •     ");
  }
  if(summary||replay)line.append("HISTÓRICO · Não informa a situação atual de tsunami     •     ");
  line.append("Siga as orientações das autoridades locais");ticker=line.toString();
  setContentDescription((demo?"Demonstração, não é alerta real. ":replay?"Replay de registro histórico. ":"")+ticker);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
 }
 private void rect(Canvas c,float l,float t,float r,float b,int color){paint.setColor(color);paint.setStyle(Paint.Style.FILL);c.drawRect(l,t,r,b,paint);}
 private void rounded(Canvas c,float l,float t,float r,float b,float radius,int color){paint.setColor(color);paint.setStyle(Paint.Style.FILL);c.drawRoundRect(l,t,r,b,radius,radius,paint);}
 private void text(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setColor(color);paint.setStyle(Paint.Style.FILL);paint.setTextSize(size);paint.setTypeface(font);
  while(value.length()>0&&paint.measureText(value)>max)value=value.substring(0,value.offsetByCodePoints(value.length(),-1));c.drawText(value,x,y,paint);
 }
 private void centerText(Canvas c,String value,float center,float y,float size,int color,Typeface font,float max){
  paint.setTypeface(font);paint.setTextSize(size);while(paint.measureText(value)>max&&size>8){size-=.5f;paint.setTextSize(size);}text(c,value,center-paint.measureText(value)/2,y,size,color,font,max);
 }
 private int eventInk(Alert a){
  if(!a.kind.equals("tsunami")||a.state.equals("warning"))return Color.rgb(255,90,107);
  if(a.state.equals("ended")||a.state.equals("information"))return Color.rgb(183,199,216);
  return a.state.equals("noThreat")?Color.rgb(102,217,189):Color.rgb(255,214,119);
 }
 private void fitText(Canvas c,String value,float x,float y,float size,int color,Typeface font,float max){
  paint.setTextSize(size);paint.setTypeface(font);String shown=value;
  if(paint.measureText(value)>max){while(shown.length()>0&&paint.measureText(shown+"…")>max)shown=shown.substring(0,shown.offsetByCodePoints(shown.length(),-1));shown+="…";}
  text(c,shown,x,y,size,color,font,max);
 }
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);if(started==0)return;long drawStarted=SystemClock.elapsedRealtimeNanos();long elapsed=SystemClock.uptimeMillis()-started;c.save();c.scale(getWidth()/960f,getHeight()/(126f+mapSpace));
  c.save();c.translate(0,mapBelow?0:mapSpace);
  c.save();c.clipPath(bannerClip);rect(c,0,24,960,126,background);rect(c,0,BroadcastVisuals.FOOTER_TOP,960,126,Color.rgb(2,8,22));c.restore();
  breaking(c,elapsed);
  BroadcastVisuals.radar(c,paint,elapsed,animate);
  c.save();c.clipRect(0,0,960,24);rounded(c,960-badgeWidth,0,960,30,7,Color.rgb(191,24,39));rect(c,960-badgeWidth,17,960,24,Color.rgb(191,24,39));centerText(c,badgeLabel(),960-badgeWidth/2,18,17,Color.WHITE,brand,badgeWidth-24);c.restore();drawClock(c);
  drawIdentity(c,elapsed);
  long contentElapsed=summary?BannerTimeline.summaryElapsed(elapsed,presentationAnimated):elapsed;
  int index=summary?BannerTimeline.summaryPage(contentElapsed,pages.length,presentationAnimated):BannerTimeline.page(elapsed,pages.length);long within=elapsed%pageMillis;
  long fadeElapsed=summary?BannerTimeline.summaryFadeElapsed(contentElapsed,index):within;
  if((summary?presentationAnimated:animate)&&pages.length>1&&(summary?index>0:elapsed>=pageMillis)&&fadeElapsed>=0&&fadeElapsed<BannerTimeline.PAGE_FADE_MS){
   float t=BannerTimeline.pageProgress(fadeElapsed);drawPage(c,pages[(index+pages.length-1)%pages.length],elapsed,(int)(255*(1-t)),-18*t);drawPage(c,pages[index],elapsed,(int)(255*t),18*(1-t));
  }else drawPage(c,pages[index],elapsed,255,0);
  c.save();c.clipRect(100,BroadcastVisuals.FOOTER_TOP+1,identityLeft(elapsed)-8,124);paint.setTypeface(data);paint.setTextSize(12);float length=paint.measureText(ticker)+90;
  float offset=BroadcastVisuals.tickerOffset(elapsed,length,animate);text(c,ticker,100-offset,119,12,Color.WHITE,data,Float.MAX_VALUE);text(c,ticker,100-offset+length,119,12,Color.WHITE,data,Float.MAX_VALUE);c.restore();
  c.restore();
  drawMap(c,index,elapsed,fadeElapsed);c.restore();
  RuntimeDiagnostics.frame(drawStarted,SystemClock.elapsedRealtimeNanos()-drawStarted,animate);
  if(running&&isShown()){if(animate)postInvalidateOnAnimation();else postInvalidateDelayed(Math.min(pageMillis-within,60000-Math.floorMod(System.currentTimeMillis(),60000)));}
 }
 private void drawMap(Canvas c,int index,long elapsed,long fadeElapsed){
  if(mapInset==null||mapReveal<=0||mapSpace==0)return;
  c.save();c.translate(0,mapBelow?126:0);c.scale(1,mapSpace/180f);c.clipRect(0,0,960,180);float slide=(1-mapReveal)*180;
  c.translate(649,mapBelow?4-slide:slide);
  boolean fading=(summary?presentationAnimated:animate)&&pages.length>1&&(summary?index>0:elapsed>=pageMillis)&&fadeElapsed>=0&&fadeElapsed<BannerTimeline.PAGE_FADE_MS;
  if(fading){float t=BannerTimeline.pageProgress(fadeElapsed);int layer=c.saveLayerAlpha(0,0,310,176,(int)(255*(1-t)));mapInset.draw(c,pages[(index+pages.length-1)%pages.length].alert,brand,accent);c.restoreToCount(layer);layer=c.saveLayerAlpha(0,0,310,176,(int)(255*t));mapInset.draw(c,pages[index].alert,brand,accent);c.restoreToCount(layer);}
  else mapInset.draw(c,pages[index].alert,brand,accent);
  c.restore();
 }
 String badgeLabel(){return demo?"TESTE":replay?"REPLAY":"AO VIVO";}
 static String formatClock(long at){return date(at,"HH:mm");}
 private void drawClock(Canvas c){long now=System.currentTimeMillis(),minute=now/60000;if(minute!=clockMinute){clockMinute=minute;clockText=formatClock(now);}c.save();c.clipPath(bannerClip);rect(c,0,BroadcastVisuals.FOOTER_TOP,90,126,Color.rgb(191,24,39));centerText(c,clockText,45,119,18,Color.WHITE,data,78);c.restore();}
 private void breaking(Canvas c,long elapsed){
  c.save();c.clipRect(0,0,breakingWidth,24);
  rounded(c,0,0,breakingWidth,30,7,Color.rgb(191,24,39));rect(c,0,17,breakingWidth,24,Color.rgb(191,24,39));
  if(animate&&!replay&&!summary){float phase=(elapsed%3200)/3200f;if(phase<.7f){shineMatrix.setTranslate(-70+phase/.7f*(breakingWidth+70),0);shine.setLocalMatrix(shineMatrix);c.save();c.clipPath(breakingClip);paint.setShader(shine);c.drawRect(0,0,breakingWidth,24,paint);paint.setShader(null);c.restore();}}
  centerText(c,"BREAKING NEWS",breakingWidth/2,18,20,Color.WHITE,brand,breakingWidth-32);c.restore();
 }
 float identityLeft(long elapsed){
  int current=BannerTimeline.page(elapsed,2);long within=elapsed%BannerTimeline.PAGE_MS;float width=identityWidths[current];
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS)width=Math.max(identityWidths[0],identityWidths[1]);
  return 960-width;
 }
 private void drawIdentity(Canvas c,long elapsed){
  int current=BannerTimeline.page(elapsed,2);long within=elapsed%BannerTimeline.PAGE_MS;
  if(animate&&elapsed>=BannerTimeline.PAGE_MS&&within<BannerTimeline.FADE_MS){float t=BannerTimeline.progress(within);identity(c,1-current,(int)(255*(1-t)));identity(c,current,(int)(255*t));}
  else identity(c,current,255);
 }
 private void identity(Canvas c,int index,int opacity){
  if(opacity<=0)return;float labelX=954-identityTextWidths[index];int layer=c.saveLayerAlpha(960-identityWidths[index],BroadcastVisuals.FOOTER_TOP,960,126,opacity);c.clipPath(bannerClip);
  if(index==1){c.save();c.translate(labelX-14,113);paint.setStyle(Paint.Style.FILL);paint.setColor(Color.rgb(42,171,238));c.drawCircle(0,0,8,paint);paint.setColor(Color.WHITE);c.drawPath(telegramPlane,paint);c.restore();}
  text(c,index==0?"monitorglobal.top":"@monitor_global",labelX,119,17,Color.WHITE,brand,206);c.restoreToCount(layer);
 }
 private void drawPage(Canvas c,Page p,long elapsed,int opacity,float shift){
  if(opacity<=0)return;int layer=opacity<255?c.saveLayerAlpha(0,24,844,BroadcastVisuals.FOOTER_TOP,opacity):c.save();c.clipRect(0,24,844,BroadcastVisuals.FOOTER_TOP);c.translate(0,shift);
  Alert a=p.alert;
  if(BannerTimeline.magnitudeChanged(a)){
   if(!animate||elapsed>=BannerTimeline.REVISION_AT_MS+BannerTimeline.FADE_MS)magnitude(c,p.magnitude,"ATUAL",255);
   else if(elapsed<BannerTimeline.REVISION_AT_MS)magnitude(c,p.oldMagnitude,"ANTERIOR",255);
   else{float t=BannerTimeline.progress(elapsed-BannerTimeline.REVISION_AT_MS);magnitude(c,p.oldMagnitude,"ANTERIOR",(int)(255*(1-t)));magnitude(c,p.magnitude,"ATUAL",(int)(255*t));}
  }else if(a.kind.equals("tsunami")){centerText(c,"TSUNAMI",56f,59,22,eventInk(a),brand,85);centerText(c,a.state.equals("noThreat")?"SEM AMEAÇA":"BOLETIM",56f,79,12,eventInk(a),brand,85);}
  else centerText(c,p.magnitude,56f,72,36,eventInk(a),brand,85);
  fitText(c,p.caption,HEADLINE_X,36,11,demo?Color.rgb(255,214,119):foreground,brand,HEADLINE_WIDTH);
  float width=p.flag==null?HEADLINE_WIDTH:HEADLINE_WIDTH-FLAG_RESERVE,size=BannerTimeline.magnitudeChanged(a)?26:28;drawHeadline(c,p,elapsed,width,size);
  if(p.flag!=null){paint.setTypeface(brand);paint.setTextSize(size);float x=HEADLINE_X+Math.min(paint.measureText(p.headline),width)+10;paint.setAlpha(255);c.drawBitmap(p.flag,null,new RectF(x,43,x+32,67),paint);}
  fitText(c,p.first,HEADLINE_X,89,15,foreground,brand,346);fitText(c,p.source,488,89,15,foreground,brand,185);text(c,p.time,691,89,13,foreground,data,142);c.restoreToCount(layer);
 }
 private void drawHeadline(Canvas c,Page p,long elapsed,float width,float size){
  paint.setTypeface(brand);paint.setTextSize(size);float length=paint.measureText(p.headline);
  if(length<=width||!animate){fitText(c,p.headline,HEADLINE_X,HEADLINE_Y,size,foreground,brand,width);return;}
  long local=elapsed%pageMillis;if(summary){long content=BannerTimeline.summaryElapsed(elapsed,presentationAnimated);int index=0;for(int i=0;i<pages.length;i++)if(pages[i]==p){index=i;break;}local=Math.max(0,content-index*(pageMillis+(presentationAnimated?BannerTimeline.PAGE_FADE_MS:0)));}
  float offset=HeadlineMotion.offset(length-width,local,pageMillis);c.save();c.clipRect(HEADLINE_X,HEADLINE_TOP,HEADLINE_X+width,HEADLINE_BOTTOM);text(c,p.headline,HEADLINE_X-offset,HEADLINE_Y,size,foreground,brand,Float.MAX_VALUE);c.restore();
 }
 private void magnitude(Canvas c,String value,String label,int opacity){if(opacity<=0)return;int layer=c.saveLayerAlpha(8,28,108,94,opacity);centerText(c,value,56f,68,35,Color.rgb(255,90,107),brand,85);centerText(c,label,56f,86,10,Color.WHITE,brand,85);c.restoreToCount(layer);}


 static String formatTime(long at){return date(at,"HH:mm 'BRT'");}
 private static String formatRecordTime(long at){return date(at,"dd/MM/yyyy HH:mm 'BRT'");}
 private static String date(long at,String pattern){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat(pattern,java.util.Locale.forLanguageTag("pt-BR"));f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static String tsunamiLabel(String state){switch(state){case "warning":return "AVISO DE TSUNAMI";case "watch":return "VIGILÂNCIA DE TSUNAMI";case "advisory":return "ATENÇÃO PARA TSUNAMI";case "ended":return "AVISO ENCERRADO · COSTAS CITADAS";case "noThreat":return "SEM AMEAÇA · COSTAS CITADAS";case "unknown":return "SITUAÇÃO DE TSUNAMI NÃO CONFIRMADA";default:return "BOLETIM INFORMATIVO DE TSUNAMI";}}
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();RuntimeDiagnostics.resetFrameClock();running=true;if(mapSpace>0){mapInset=new MapInset(getContext(),this::invalidate);for(Page p:pages)mapInset.prepare(p.alert);}invalidate();}
 @Override protected void onDetachedFromWindow(){RuntimeDiagnostics.resetFrameClock();running=false;if(mapInset!=null){mapInset.close();mapInset=null;}super.onDetachedFromWindow();}
}

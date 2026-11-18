package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import java.util.regex.*;

/** One overlay: stable brand/footer, softly changing event content. No focus required. */
final class NewsBannerView extends View {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 static final float HEADLINE_X=124,HEADLINE_Y=72,HEADLINE_TOP=48,HEADLINE_BOTTOM=77,HEADLINE_WIDTH=672,FLAG_RESERVE=44;
 private final Path breakingClip=new Path();private final float breakingWidth,badgeWidth;private final Path bannerClip=new Path(),telegramPlane=new Path();private final float[] identityWidths=new float[2],identityTextWidths=new float[2];
 private long clockMinute=Long.MIN_VALUE;private String clockText="--:--";
 private final Matrix shineMatrix=new Matrix();
 private final LinearGradient shine=new LinearGradient(0,0,70,0,new int[]{Color.TRANSPARENT,0x50ffffff,Color.TRANSPARENT},null,Shader.TileMode.CLAMP);
 private final Typeface brand,data;
 private final Alert root;
 private final Page[] pages;
 private final boolean demo,replay,regional,globalM6Intro;
 private final boolean summary;private final String summaryDay;private final long pageMillis;private final DailySeismicTotals summaryTotals;
 private long started;private boolean presentationAnimated;
 void startPresentation(long when,boolean animated){started=when;effects.start(when);presentationAnimated=animated&&android.animation.ValueAnimator.areAnimatorsEnabled();invalidate();}
 private final String ticker,tickerDisplay;
 private final int accent,foreground,background;
 private final boolean animate;
 private boolean motionEnabled(){return animate&&effects.animated();}
 final TvEffectsController effects;
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
   heading=(demo&&summary?"SIMULAÇÃO FICTÍCIA · ":"")+(summary?(replay?"REPLAY DO RESUMO · ":"RESUMO · ")+summaryDay+" · ":demo?"TESTE FICTÍCIO · NÃO É ALERTA REAL · ":replay?"REPLAY · "+formatRecordTime(a.issuedAt)+" · ":"")+stateLabel;caption=heading;
  }
 }
 NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated){
  this(context,a,demonstration,repeated,false);
 }
 /** Regional M5.x events keep the original seismic map, clock and official ticker. */
 NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated,boolean isRegional){
  this(context,a,demonstration,repeated,null,"",false,null,isRegional);
 }
 NewsBannerView(Context context,java.util.List<Alert> alerts,String day,boolean repeated,boolean complete){this(context,alerts,day,repeated,complete,null);}
  NewsBannerView(Context context,java.util.List<Alert> alerts,String day,boolean repeated,boolean complete,DailySeismicTotals totals){this(context,alerts.get(0),false,repeated,alerts,day,complete,totals,false);}
 static NewsBannerView simulationSummary(Context c,java.util.List<Alert> alerts){return new NewsBannerView(c,alerts.get(0),true,false,alerts,"SIMULAÇÃO",true,null,false);}
 private NewsBannerView(Context context,Alert a,boolean demonstration,boolean repeated,java.util.List<Alert> daily,String day,boolean complete,DailySeismicTotals totals,boolean isRegional){
  super(context);OfficialArgosLogo.prepare(context);mapSpace=Banner.insetDp(context);mapBelow=Prefs.get(context).getBoolean("themeTop",false);summary=daily!=null;summaryTotals=summary&&totals!=null&&!totals.partial&&totals.day.equals(day)?totals:null;summaryDay=BrDates.day(day);pageMillis=summary?BannerTimeline.SUMMARY_PAGE_MS:BannerTimeline.PAGE_MS;root=a;demo=demonstration;replay=repeated;regional=isRegional&&!summary;globalM6Intro=GlobalM6Intro.eligible(context,a,demo,replay,summary,regional);
  effects=new TvEffectsController(context,summary?TvEffectsController.EffectsCategory.SUMMARY:regional?TvEffectsController.EffectsCategory.REGIONAL:"tsunami".equals(a.kind)||a.companion!=null?TvEffectsController.EffectsCategory.TSUNAMI:TvEffectsController.EffectsCategory.GLOBAL_M6,replay||!a.revision.isEmpty(),demo);
  if(!summary&&(!a.revision.isEmpty()||a.companion!=null||urgentTsunami(a)||effects.category==TvEffectsController.EffectsCategory.GLOBAL_M6&&!globalM6Intro))effects.disableOpening();
  animate=effects.animated();
  brand=OledNewsChrome.titleFont(null);data=OledNewsChrome.regularFont();
  paint.setTypeface(brand);paint.setTextSize(15);breakingWidth=BroadcastVisuals.BREAKING_WIDTH;breakingClip.addRoundRect(0,0,breakingWidth,30,7,7,Path.Direction.CW);badgeWidth=BroadcastVisuals.statusWidth(paint,brand,badgeLabel());bannerClip.addRoundRect(0,24,960,126,new float[]{0,0,0,0,8,8,8,8},Path.Direction.CW);
  identityTextWidths[0]=paint.measureText("argosorbis.com.br");identityTextWidths[1]=paint.measureText("@argosorbis");identityWidths[0]=(float)Math.ceil(identityTextWidths[0])+12;identityWidths[1]=(float)Math.ceil(identityTextWidths[1])+34;
  telegramPlane.moveTo(-5.5f,-.5f);telegramPlane.lineTo(5,-4.5f);telegramPlane.lineTo(3,5);telegramPlane.lineTo(-.5f,2);telegramPlane.lineTo(2.5f,-1.5f);telegramPlane.lineTo(-2,1);telegramPlane.close();
  accent=Color.parseColor(Prefs.get(context).getInt("themeVersion",0)<2?"#38bdf8":Prefs.get(context).getString("themeAccent","#38bdf8"));
  foreground=OledNewsChrome.INK;background=OledNewsChrome.OLED;
  if(summary){pages=new Page[daily.size()];for(int i=0;i<pages.length;i++){pages[i]=new Page(daily.get(i));pages[i].caption=(i+1)+"º DE "+pages.length+" · "+pages[i].heading;}}
  else pages=AlertPairing.isPair(a,a.companion)?new Page[]{new Page(a),new Page(a.companion)}:new Page[]{new Page(a)};
  StringBuilder line=new StringBuilder(summary?(replay?"REPLAY DO RESUMO · ":"RESUMO DO DIA · ")+summaryDay+" · HORÁRIO DE BRASÍLIA · FONTES SÍSMICAS · "+(complete?"DIA ENCERRADO · ":"PARCIAL ATÉ A CONSULTA · "):regional?(demo?"TESTE FICTÍCIO · AVISO REGIONAL · ":replay?"REPLAY · SISMO REGIONAL · REGISTRO HISTÓRICO · ":"AVISO REGIONAL · ÁREA MONITORADA · "):demo?"TESTE FICTÍCIO · ":replay?"REPLAY · REGISTRO HISTÓRICO · ":"");
  for(Page p:pages){Alert v=p.alert;if(!v.revision.isEmpty())line.append(v.revision).append(" · Atualização: ").append(formatTime(v.issuedAt)).append("     •     ");
   if(!v.populationSummary.isEmpty())line.append(v.populationSummary).append("     •     ");
   if(!v.nearbySummary.isEmpty())line.append(v.nearbySummary).append("     •     ");
   if(v.compact&&!v.targetArea.isEmpty())line.append("ÁREA MONITORADA: ").append(v.targetArea).append("     •     ");
   if(!v.tsunamiSummary.isEmpty())line.append("TSUNAMI · ").append(v.tsunamiSummary).append("     •     ");
   line.append(v.title).append("     •     ").append(v.detail).append("     •     ").append(v.kind.equals("tsunami")?"Boletim: ":"Origem do sismo: ").append(p.time).append("     •     ");
  }
  if(summary||replay)line.append("HISTÓRICO · Não informa a situação atual de tsunami     •     ");
  line.append("Siga as orientações das autoridades locais");ticker=line.toString();tickerDisplay=OledNewsChrome.tickerDisplay(ticker);
  setContentDescription((demo?"Demonstração, não é alerta real. ":replay?"Replay de registro histórico. ":"")+(summaryTotals!=null?summaryTotals.accessibilityText()+" ":"")+ticker);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
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
  OledNewsChrome.base(c,paint);
  breaking(c,elapsed);
  OledNewsChrome.tab(c,paint,badgeLabel(),false);
  BroadcastVisuals.radar(c,paint,elapsed,motionEnabled());
  drawClock(c);
  drawIdentity(c,elapsed);
  long contentElapsed=summary?BannerTimeline.summaryElapsed(elapsed,presentationAnimated):elapsed;
  int index=summary?BannerTimeline.summaryPage(contentElapsed,pages.length,presentationAnimated):BannerTimeline.page(elapsed,pages.length);long within=elapsed%pageMillis;
  long fadeElapsed=summary?BannerTimeline.summaryFadeElapsed(contentElapsed,index):within;
  int effectLayer=c.saveLayerAlpha(8,31,829,94,effects.opacity(elapsed));
  if(effects.animated()&&(summary?presentationAnimated:motionEnabled())&&pages.length>1&&(summary?index>0:elapsed>=pageMillis)&&fadeElapsed>=0&&fadeElapsed<BannerTimeline.PAGE_FADE_MS){
   float t=effects.pageProgress(fadeElapsed);drawPage(c,pages[(index+pages.length-1)%pages.length],elapsed,(int)(255*(1-t)),-18*t);drawPage(c,pages[index],elapsed,(int)(255*t),18*(1-t));
  }else drawPage(c,pages[index],elapsed,255,0);
  c.restoreToCount(effectLayer);effects.draw(c,elapsed,false,false);
  if(summary&&summaryTotals!=null)drawSummaryTotals(c);
  else{
  float tickerLeft=112f,tickerRight=identityLeft(elapsed)-8f;
  c.save();c.clipRect(tickerLeft,BroadcastVisuals.FOOTER_TOP+1,tickerRight,124);
  int tickerLayer=c.saveLayer(tickerLeft,95,tickerRight,124,null);
  String display=tickerDisplay;
  Typeface tickerFace=OledNewsChrome.tickerFont();
  paint.setTypeface(tickerFace);paint.setTextSize(14);float length=paint.measureText(display)+104;
  float offset=BroadcastVisuals.tickerOffset(elapsed,length,motionEnabled());
  text(c,display,tickerLeft-offset,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  text(c,display,tickerLeft-offset+length,118.5f,14,Color.WHITE,tickerFace,Float.MAX_VALUE);
  OledNewsChrome.fadeTickerEdges(c,tickerLeft,tickerRight);
  c.restoreToCount(tickerLayer);c.restore();
  }
  c.restore();
  drawMap(c,index,elapsed,fadeElapsed);
  c.restore();
  RuntimeDiagnostics.frame(drawStarted,SystemClock.elapsedRealtimeNanos()-drawStarted,motionEnabled());
  if(running&&isShown()){if(motionEnabled())postInvalidateOnAnimation();else postInvalidateDelayed(Math.min(pageMillis-within,60000-Math.floorMod(System.currentTimeMillis(),60000)));}
 }
 /** Five magnitude bands from the full-day catalog, not the five ranked quake cards. */
 private void drawSummaryTotals(Canvas c){
  final float left=112f,right=identityLeft(1000)-8f;
  final float width=(right-left)/5f;
  final String[] labels={"EVENTOS","M6,0+","M5,0–5,9","M4,0–4,9","ABAIXO M4,0"};
  final int[] colors={0xff29d4f2,0xffff5c68,0xffffa04b,0xffffda54,0xff46df9b};
  final int[] values=summaryTotals.values();
  c.save();c.clipRect(left,BroadcastVisuals.FOOTER_TOP+1,right,125);
  for(int i=0;i<5;i++){
   float x=left+i*width,center=x+width/2f;
   if(i>0){paint.setStyle(Paint.Style.STROKE);paint.setColor(0xff315169);paint.setStrokeWidth(.75f);c.drawLine(x,105,x,123,paint);}
   centerText(c,Integer.toString(values[i]),center,114,14,colors[i],brand,width-7f);
   centerText(c,labels[i],center,122.7f,8.5f,Color.WHITE,data,width-6f);
  }
  c.restore();
 }
 private void drawMap(Canvas c,int index,long elapsed,long fadeElapsed){
  if(mapInset==null||mapReveal<=0||mapSpace==0)return;
  c.save();c.translate(0,mapBelow?126:0);c.scale(1,mapSpace/180f);c.clipRect(0,0,960,180);float slide=(1-mapReveal)*180;
  c.translate(649,mapBelow?4-slide:slide);
  boolean fading=effects.animated()&&(summary?presentationAnimated:motionEnabled())&&pages.length>1&&(summary?index>0:elapsed>=pageMillis)&&fadeElapsed>=0&&fadeElapsed<BannerTimeline.PAGE_FADE_MS;
  if(fading){float t=effects.pageProgress(fadeElapsed);int layer=c.saveLayerAlpha(0,0,310,176,(int)(255*(1-t)));mapInset.draw(c,pages[(index+pages.length-1)%pages.length].alert,brand,accent);c.restoreToCount(layer);layer=c.saveLayerAlpha(0,0,310,176,(int)(255*t));mapInset.draw(c,pages[index].alert,brand,accent);c.restoreToCount(layer);}
  else mapInset.draw(c,pages[index].alert,brand,accent);
  c.restore();
 }
 String badgeLabel(){return demo?"TESTE":replay?"REPLAY":summary?"RESUMO":regional?"REGIONAL":"AO VIVO";}
 static String formatClock(long at){return date(at,"HH:mm");}
 private void drawClock(Canvas c){
  long now=System.currentTimeMillis(),minute=now/60000;
  if(minute!=clockMinute){clockMinute=minute;clockText=formatClock(now);}
  c.save();c.clipRect(OledNewsChrome.LEFT,94,106,126);
  rect(c,OledNewsChrome.LEFT,94,106,126,OledNewsChrome.RED_DARK);
  centerText(c,clockText,58,118,18,Color.WHITE,OledNewsChrome.clockFont(),90);
  c.restore();
 }
 static boolean urgentTsunami(Alert alert){
  return "tsunami".equals(alert.kind)&&!("noThreat".equals(alert.state)||"ended".equals(alert.state));
 }
 private String leftTitle(){
  if(summary)return "RESUMO DIÁRIO";
  if(regional)return "SISMO REGIONAL";
  if("tsunami".equals(root.kind))return "TSUNAMI";
  return "earthquake".equals(root.kind)&&Double.isFinite(root.magnitude)&&root.magnitude>=6
      ?"BREAKING NEWS":"SISMO";
 }
 private void breaking(Canvas c,long elapsed){
  OledNewsChrome.tab(c,paint,leftTitle(),true);
  // Keep the native breaking-news shine, clipped to the approved left red label.
  if(effects.full()&&!replay&&!summary){
   float phase=(elapsed%3200)/3200f;
   if(phase<.7f){
    float left=OledNewsChrome.LEFT,right=OledNewsChrome.LEFT_TAB_RIGHT,width=right-left;
    shineMatrix.setTranslate(left-70+phase/.7f*(width+70),0);
    shine.setLocalMatrix(shineMatrix);
    c.save();c.clipRect(left,0,right,OledNewsChrome.TAB_BOTTOM);paint.setShader(shine);
    c.drawRect(left,0,right,OledNewsChrome.TAB_BOTTOM,paint);paint.setShader(null);c.restore();
   }
  }
 }
 float identityLeft(long elapsed){return OledNewsChrome.BRAND_PLATE_LEFT;}
 private void drawIdentity(Canvas c,long elapsed){
  OledNewsChrome.brandFooter(c,paint,elapsed,motionEnabled());
 }
 private void drawPage(Canvas c,Page p,long elapsed,int opacity,float shift){
  if(opacity<=0)return; int layer=opacity<255?c.saveLayerAlpha(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP,opacity):c.save();c.clipRect(0,31,BroadcastVisuals.CONTENT_RIGHT_LIMIT,BroadcastVisuals.FOOTER_TOP);c.translate(0,shift);
  Alert a=p.alert;
  if(regional){
   drawRegionalPage(c,p,elapsed);
   c.restoreToCount(layer);
   return;
  }
  if(BannerTimeline.magnitudeChanged(a)){
   if(!motionEnabled()||elapsed>=BannerTimeline.REVISION_AT_MS+BannerTimeline.FADE_MS)magnitude(c,p.magnitude,"ATUAL",255,elapsed-BannerTimeline.REVISION_AT_MS);
   else if(elapsed<BannerTimeline.REVISION_AT_MS)magnitude(c,p.oldMagnitude,"ANTERIOR",255,-1);
   else{float t=BannerTimeline.progress(elapsed-BannerTimeline.REVISION_AT_MS);magnitude(c,p.oldMagnitude,"ANTERIOR",(int)(255*(1-t)),-1);magnitude(c,p.magnitude,"ATUAL",(int)(255*t),elapsed-BannerTimeline.REVISION_AT_MS);}
  }else if(a.kind.equals("tsunami")){BroadcastVisuals.eventCategory(c,paint,brand,"TSUNAMI",a.state.equals("noThreat")?"SEM AMEAÇA":"BOLETIM",eventInk(a));}
  else centerText(c,p.magnitude,BroadcastVisuals.EVENT_CENTER_X,BroadcastVisuals.EVENT_MAGNITUDE_BASELINE,36,eventInk(a),brand,85);
  fitText(c,p.caption,HEADLINE_X,45,13,demo?Color.rgb(255,214,119):foreground,brand,HEADLINE_WIDTH);
  float width=p.flag==null?HEADLINE_WIDTH:HEADLINE_WIDTH-FLAG_RESERVE,size=BannerTimeline.magnitudeChanged(a)?26:31;drawHeadline(c,p,elapsed,width,size);
  if(p.flag!=null){paint.setTypeface(brand);paint.setTextSize(size);float x=HEADLINE_X+Math.min(paint.measureText(p.headline),width)+10;paint.setAlpha(255);c.drawBitmap(p.flag,null,new RectF(x,50,x+32,74),paint);}
  fitText(c,p.first,HEADLINE_X,89,15,foreground,brand,315);fitText(c,p.source,449,89,14,foreground,brand,166);text(c,p.time,630,89,13,foreground,data,180);c.restoreToCount(layer);
 }
 /** M5.0–5.9 is an informational notice for a selected target area,
  * not a second global Breaking News event. Keep the magnitude's exact M6
  * optical center and leave the map/footer/official logo untouched.
  */
 private void drawRegionalPage(Canvas c,Page page,long elapsed){
  Alert a=page.alert;
  if(BannerTimeline.magnitudeChanged(a)){
   if(!motionEnabled()||elapsed>=BannerTimeline.REVISION_AT_MS+BannerTimeline.FADE_MS)
    magnitude(c,page.magnitude,"ATUAL",255,elapsed-BannerTimeline.REVISION_AT_MS);
   else if(elapsed<BannerTimeline.REVISION_AT_MS)
    magnitude(c,page.oldMagnitude,"ANTERIOR",255,-1);
   else{
    float t=BannerTimeline.progress(elapsed-BannerTimeline.REVISION_AT_MS);
    magnitude(c,page.oldMagnitude,"ANTERIOR",(int)(255*(1-t)),-1);
    magnitude(c,page.magnitude,"ATUAL",(int)(255*t),elapsed-BannerTimeline.REVISION_AT_MS);
   }
  }else centerText(c,page.magnitude,BroadcastVisuals.EVENT_CENTER_X,
    BroadcastVisuals.EVENT_MAGNITUDE_BASELINE,36,eventInk(a),brand,85);
  String area=a.targetArea==null||a.targetArea.trim().isEmpty()
    ?"REGIÃO SELECIONADA":a.targetArea.trim();
  String heading=(demo?"TESTE FICTÍCIO · ":replay?"REPLAY · REGISTRO HISTÓRICO · ":"")
    +"ÁREA MONITORADA · "+area;
  fitText(c,heading,HEADLINE_X,45,13,demo?0xffffd677:Color.WHITE,brand,HEADLINE_WIDTH);
  float locationX=HEADLINE_X;
  if(page.flag!=null){
   paint.setShader(null);paint.setStyle(Paint.Style.FILL);
   paint.setColor(Color.WHITE);paint.setAlpha(255);
   c.drawBitmap(page.flag,null,new RectF(HEADLINE_X,52,HEADLINE_X+30,74),paint);
   locationX+=42;
  }
  paint.setTypeface(brand);paint.setTextScaleX(1f);
  float fontSize=29f,available=BroadcastVisuals.CONTENT_RIGHT_LIMIT-locationX-10f;
  paint.setTextSize(fontSize);
  while(fontSize>19f&&paint.measureText(page.headline)>available){
   fontSize-=.5f;paint.setTextSize(fontSize);
  }
  fitText(c,page.headline,locationX,72,fontSize,Color.WHITE,brand,available);
  String depth=Double.isFinite(a.depth)&&a.depth>=0
    ?String.format(java.util.Locale.forLanguageTag("pt-BR"),"PROF. %.0f KM",a.depth)
    :"PROF. NÃO INFORMADA";
  fitText(c,depth,HEADLINE_X,89,13.5f,0xffdbe5ed,data,124);
  // Area is a verified selected target, not an inferred epicentral distance.
  fitText(c,"REGIÃO · "+area,269,89,13.5f,0xffdbe5ed,brand,280);
  fitText(c,page.source,560,89,13.5f,0xffdbe5ed,data,91);
  fitText(c,page.time,662,89,13f,Color.WHITE,data,151);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(.7f);paint.setColor(0xff80313b);
  for(float x:new float[]{260,551,655})c.drawLine(x,78,x,90,paint);
  paint.setStyle(Paint.Style.FILL);
 }
 private void drawHeadline(Canvas c,Page p,long elapsed,float width,float size){
  paint.setTypeface(brand);paint.setTextSize(size);float length=paint.measureText(p.headline);
  if(length<=width||!motionEnabled()){fitText(c,p.headline,HEADLINE_X,HEADLINE_Y,size,foreground,brand,width);return;}
  long local=elapsed%pageMillis;if(summary){long content=BannerTimeline.summaryElapsed(elapsed,presentationAnimated);int index=0;for(int i=0;i<pages.length;i++)if(pages[i]==p){index=i;break;}local=Math.max(0,content-index*(pageMillis+(presentationAnimated?BannerTimeline.PAGE_FADE_MS:0)));}
  float offset=HeadlineMotion.offset(length-width,local,pageMillis);c.save();c.clipRect(HEADLINE_X,HEADLINE_TOP,HEADLINE_X+width,HEADLINE_BOTTOM);text(c,p.headline,HEADLINE_X-offset,HEADLINE_Y,size,foreground,brand,Float.MAX_VALUE);c.restore();
 }
 private void magnitude(Canvas c,String value,String label,int opacity,long elapsed){if(opacity<=0)return;int layer=c.saveLayerAlpha(8,28,108,94,opacity);centerText(c,value,BroadcastVisuals.EVENT_CENTER_X,BroadcastVisuals.EVENT_CATEGORY_BASELINE,35,effects.valueInk(Color.rgb(255,90,107),0xffffafba,elapsed),brand,85);centerText(c,label,BroadcastVisuals.EVENT_CENTER_X,BroadcastVisuals.EVENT_CAPTION_BASELINE,10,Color.WHITE,brand,85);c.restoreToCount(layer);}


 static String formatTime(long at){return date(at,"HH:mm 'BRT'");}
 private static String formatRecordTime(long at){return date(at,"dd/MM/yyyy HH:mm 'BRT'");}
 private static String date(long at,String pattern){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat(pattern,java.util.Locale.forLanguageTag("pt-BR"));f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static String tsunamiLabel(String state){switch(state){case "warning":return "AVISO DE TSUNAMI";case "watch":return "VIGILÂNCIA DE TSUNAMI";case "advisory":return "ATENÇÃO PARA TSUNAMI";case "ended":return "AVISO ENCERRADO · COSTAS CITADAS";case "noThreat":return "SEM AMEAÇA · COSTAS CITADAS";case "unknown":return "SITUAÇÃO DE TSUNAMI NÃO CONFIRMADA";default:return "BOLETIM INFORMATIVO DE TSUNAMI";}}
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();RuntimeDiagnostics.resetFrameClock();running=true;if(mapSpace>0){mapInset=new MapInset(getContext(),this::invalidate);for(Page p:pages)mapInset.prepare(p.alert);}invalidate();}
 @Override protected void onDetachedFromWindow(){RuntimeDiagnostics.resetFrameClock();running=false;effects.stop();if(mapInset!=null){mapInset.close();mapInset=null;}super.onDetachedFromWindow();}
}

package top.monitorglobal.tv;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;

/** One introductory scene, followed by the existing data scene in the SAME window.
 * The host partitions the canvas during the wipe; it never crossfades two banners.
 */
final class BannerOpening {
 private static final Typeface BOLD=Typeface.create("sans-serif",Typeface.BOLD);
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final TvEffectsController effects;
 private final long slot;
 private final String title;
 private boolean stopped;
 BannerOpening(TvEffectsController policy,long duration){
  effects=policy;slot=duration;title=title(policy.category);
 }
 static String title(TvEffectsController.EffectsCategory category){
  switch(category){case BRAZIL:return "SISMO NO BRASIL";case REGIONAL:return "SISMO REGIONAL";
   case RAIN:return "CHUVA";case WEATHER:return "TEMPERATURA";case MARKET:return "COTAÇÕES";
   case SATELLITE:return "SATÉLITE";case TSUNAMI:return "TSUNAMI";case SUMMARY:return "RESUMO DIÁRIO";
   case VOICE:return "CONSULTA POR VOZ";default:return "BREAKING NEWS";}
 }
 long duration(){return effects.full()?(effects.category==TvEffectsController.EffectsCategory.GLOBAL_M6?GlobalM6Intro.END_MS:2300):750;}
 long transitionStart(){return effects.full()&&effects.category==TvEffectsController.EffectsCategory.GLOBAL_M6?GlobalM6Intro.HOLD_END_MS:duration()-(effects.full()?650:300);}
 boolean visible(long elapsed){return !stopped&&effects.openingAllowed()&&slot>duration()+2000&&elapsed>=0&&elapsed<duration();}
 float contentFraction(long elapsed){return TvEffectsController.ease(TvEffectsController.phase(elapsed-transitionStart(),duration()-transitionStart()));}
 void stop(){stopped=true;}
 private void rect(Canvas c,float l,float t,float r,float b,int color){paint.setShader(null);paint.setStyle(Paint.Style.FILL);paint.setColor(color);c.drawRect(l,t,r,b,paint);}
 private void text(Canvas c,String s,float x,float y,float size,float max,int color){
  paint.setTypeface(BOLD);paint.setTextAlign(Paint.Align.LEFT);paint.setTextScaleX(1);paint.setTextSize(size);
  while(size>12&&paint.measureText(s)>max){size-=.5f;paint.setTextSize(size);}
  paint.setShader(null);paint.setStyle(Paint.Style.FILL);paint.setColor(color);c.drawText(s,x,y,paint);
 }
 boolean standard(){return effects.category!=TvEffectsController.EffectsCategory.GLOBAL_M6||!effects.full();}
 float arrival(long elapsed){return TvEffectsController.ease(TvEffectsController.phase(elapsed,effects.full()?450:160));}
 void draw(Canvas c,long elapsed,float height){
  if(standard()){drawStandard(c,elapsed,height);return;}
  float footer=height-32,center=(30+footer)/2;
  c.save();c.clipRect(8,0,925,height);
  drawChrome(c,elapsed,"BREAKING NEWS",effects.demonstration?"TESTE FICTÍCIO":"AO VIVO");
  float arrival=effects.full()?TvEffectsController.ease(TvEffectsController.phase(elapsed,700)):1;
  float sweep=8+790*arrival;
  if(effects.full())for(int k=5;k>=0;k--){
   paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2+k*4);paint.setColor(Color.argb(160-k*23,255,k<2?220:125,k<2?80:38));
   c.drawLine(Math.max(9,sweep-65-k*9),center-7,Math.min(802,sweep+24+k*8),center-7,paint);
  }
  float textArrival=effects.full()?TvEffectsController.ease(TvEffectsController.phase(elapsed-700,360)):TvEffectsController.ease(TvEffectsController.phase(elapsed,160));
  float size=effects.full()?47:37;paint.setTypeface(BOLD);paint.setTextSize(size);
  while(size>20&&paint.measureText(title)>750){size-=.5f;paint.setTextSize(size);}
  float x=20+(760-paint.measureText(title))/2+(1-textArrival)*45;
  text(c,title,x,center+17,size,760,Color.argb(Math.round(255*textArrival),255,224,33));
  rect(c,8,footer-1,925,footer,0xfffa5260);c.restore();paint.setShader(null);paint.setStyle(Paint.Style.FILL);paint.setAlpha(255);
 }
 private void drawStandard(Canvas c,long elapsed,float height){
  float footer=height-32,center=(30+footer)/2;
  c.save();c.clipRect(8,0,925,height);
  drawChrome(c,elapsed,"ARGOS ORBIS",effects.demonstration?"TESTE FICTÍCIO":effects.replay?"REPLAY":title);
  long in=effects.full()?200:65, fade=effects.full()?360:120;
  float appear=TvEffectsController.ease(TvEffectsController.phase(elapsed-in,fade));
  float leave=TvEffectsController.ease(TvEffectsController.phase(elapsed-(transitionStart()-fade),fade));
  Typeface face=OledNewsChrome.titleFont(null);
  paint.setTypeface(face);paint.setTextAlign(Paint.Align.CENTER);paint.setTextScaleX(1);
  paint.setTextSize(height>126?48:40);paint.setShader(null);paint.setStyle(Paint.Style.FILL);
  int opacity=Math.round(255*appear*(1-leave));
  paint.setColor(Color.argb(opacity,245,250,255));
  float baseline=center-(paint.ascent()+paint.descent())/2f+8*(1-appear)-6*leave;
  c.drawText(title,465,baseline,paint);
  float half=44*appear;
  rect(c,465-half,center+23,465+half,center+25,Color.argb(opacity,217,39,77));
  c.restore();
  paint.setTextAlign(Paint.Align.LEFT);paint.setAlpha(255);
 }
 private void drawChrome(Canvas c,long elapsed,String left,String right){
  OledNewsChrome.base(c,paint);
  OledNewsChrome.tab(c,paint,left,true);
  OledNewsChrome.tab(c,paint,right,false);
  rect(c,8,94,106,126,OledNewsChrome.RED_DARK);
  text(c,NewsBannerView.formatClock(System.currentTimeMillis()),35,118,18,62,Color.WHITE);
  OledNewsChrome.brandFooter(c,paint,elapsed,true);
  BroadcastVisuals.radar(c,paint,elapsed,true);
 }
}

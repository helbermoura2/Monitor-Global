package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;

/** Presentation only. No alert mutation, queue, timer, network or sound ownership. */
final class TvEffectsController {
 enum EffectsMode { FULL, SOFT, OFF }
 enum EffectsCategory { GLOBAL_M6, BRAZIL, REGIONAL, TSUNAMI, WEATHER, RAIN, MARKET, SUMMARY, SATELLITE, VOICE }
 static final String PREF_MODE="tvEffectsMode";
 final EffectsCategory category;
 final EffectsMode requested;
 final boolean replay,demonstration;
 private boolean openingAllowed=true;
 private final Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final RectF rainRadar=new RectF(122,36,160,74);
 private long started;
 private boolean stopped;
 TvEffectsController(Context c,EffectsCategory type,boolean historical){
  this(c,type,historical,false);
 }
 TvEffectsController(Context c,EffectsCategory type,boolean historical,boolean demo){
  category=type;replay=historical;demonstration=demo;requested=selected(c);
 }
 void disableOpening(){openingAllowed=false;}
 boolean openingAllowed(){return openingAllowed&&animated()&&category!=EffectsCategory.TSUNAMI&&category!=EffectsCategory.SUMMARY&&category!=EffectsCategory.VOICE;}
 static EffectsMode selected(Context c){
  try{return EffectsMode.valueOf(Prefs.get(c).getString(PREF_MODE,"FULL"));}
  catch(IllegalArgumentException e){return EffectsMode.FULL;}
 }
 static void select(Context c,EffectsMode mode){Prefs.get(c).edit().putString(PREF_MODE,mode.name()).apply();}
 static String label(Context c){switch(selected(c)){case SOFT:return "Suave";case OFF:return "Sem efeitos";default:return "Completo";}}
 static boolean enabled(Context c){return selected(c)!=EffectsMode.OFF&&ValueAnimator.areAnimatorsEnabled();}
 EffectsMode mode(){return stopped||!ValueAnimator.areAnimatorsEnabled()?EffectsMode.OFF:replay&&requested==EffectsMode.FULL?EffectsMode.SOFT:requested;}
 boolean animated(){return mode()!=EffectsMode.OFF;}
 boolean full(){return mode()==EffectsMode.FULL;}
 void start(long when){RuntimeDiagnostics.resetFrameClock();started=when;stopped=false;}
 void stop(){RuntimeDiagnostics.resetFrameClock();stopped=true;}
 long elapsed(long now){return Math.max(0,now-started);}
 long entranceMs(){
  if(!animated())return 0;
  if(!full())return category==EffectsCategory.BRAZIL?300:category==EffectsCategory.VOICE?160:220;
  switch(category){case BRAZIL:return 600;case REGIONAL:return 550;case TSUNAMI:return 400;
   case WEATHER:case MARKET:return 450;case RAIN:return 500;case SATELLITE:return 400;
   case SUMMARY:return 320;case VOICE:return 300;default:return BannerTimeline.WIPE_MS;}
 }
 long pageFadeMs(){return !animated()?0:full()?320:160;}
 static float phase(long elapsed,long duration){return duration<=0?1:Math.max(0f,Math.min(1f,elapsed/(float)duration));}
 static float ease(float t){t=Math.max(0f,Math.min(1f,t));return t*t*(3f-2f*t);}
 float progress(long elapsed){return ease(phase(elapsed,entranceMs()));}
 // Keep critical data readable from the first frame, even during the entrance.
 int opacity(long elapsed){return !animated()||category==EffectsCategory.TSUNAMI?255:Math.round(255*(.72f+.28f*progress(elapsed)));}
 float translate(long elapsed){return animated()?(1-progress(elapsed))*(full()?8:3):0;}
 float pageProgress(long elapsed){return ease(phase(elapsed,pageFadeMs()));}
 int imageOpacity(long elapsed){return !animated()?255:Math.round(255*ease(phase(elapsed,full()?400:200)));}
 static boolean wet(RainForecast.Summary rain){return rain!=null&&rain.rain&&"now".equals(rain.state)&&Double.isFinite(rain.rate)&&rain.rate>0;}
 static boolean storm(RainForecast.Summary rain,WeatherForecast.Summary weather){return wet(rain)&&weather!=null&&weather.stormForecast;}
 /** Radar ornament surrounds the rain icon; it is not meteorological radar data. */
 void behindContent(Canvas c,long elapsed){
  if(category!=EffectsCategory.RAIN||!animated()||elapsed<0||elapsed>=entranceMs())return;
  float t=progress(elapsed);brush.setShader(null);brush.setStyle(Paint.Style.STROKE);
  brush.setStrokeWidth(full()?1.5f:1f);brush.setColor(Color.argb(Math.round((full()?90:40)*(1-t)),88,220,229));
  c.drawArc(rainRadar,-90,360*t,false,brush);
  brush.setStyle(Paint.Style.FILL);brush.setAlpha(255);
 }
 /** Ornament stays in the 2px body edge, away from every text/number column. */
 void draw(Canvas c,long elapsed,boolean wet,boolean storm){
  if(!animated()||category==EffectsCategory.SUMMARY||elapsed<0||elapsed>=entranceMs())return;
  float t=progress(elapsed),x=8+804*t;
  brush.setShader(null);brush.setStyle(Paint.Style.STROKE);brush.setStrokeWidth(full()?2:1);
  int tint=category==EffectsCategory.GLOBAL_M6?0xffee3048:category==EffectsCategory.TSUNAMI?0xffffc56b:category==EffectsCategory.MARKET?0xff3166b4:category==EffectsCategory.REGIONAL?0xfff47a89:0xff58dce5;
  brush.setColor(tint);brush.setAlpha(Math.round((full()?160:80)*(1-t)));
  c.save();c.clipRect(8,91.5f,812,94);
  switch(category){
   case REGIONAL:
    for(int i=0;i<7;i++){float a=x-48+i*8;c.drawLine(a,93,a+4,92+(i%2),brush);}break;
   case TSUNAMI:c.drawLine(8,93,812,93,brush);break;
   case MARKET:c.drawLine(8,93,x,93,brush);break;
   case RAIN:
    c.drawLine(Math.max(8,x-90),93,x,93,brush);
    if(full()&&wet){for(int i=0;i<3;i++)c.drawLine(x-i*15,92,x-i*15-2,94,brush);}
    if(full()&&storm){brush.setColor(0x80ffe8b0);c.drawLine(8,92,812,92,brush);}break;
   case VOICE:c.drawLine(8,93,8+65*(1-t),93,brush);break;
   default:c.drawLine(Math.max(8,x-100),93,x,93,brush);break;
  }
  c.restore();brush.setAlpha(255);brush.setStyle(Paint.Style.FILL);
 }
}

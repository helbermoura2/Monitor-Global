package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;

/**
 * Temporary, transparent full-screen atmosphere for a NEW Civil Defense notice.
 * The existing TV lower third is a SEPARATE WindowManager overlay above this one.
 *
 * Purely decorative: no alarm sound, no real/official provenance inference, no
 * event polling, no touch handling, no screenshot or screen sampling. Works atop
 * the current TV program just like the existing rain overlay.
 *
 * No flashing: a single amber/crimson edge trace and a very faint moving scan
 * fade smoothly. System animation-disabled and mode OFF suppress this window.
 */
final class CivilScreenEffect extends View {
 static final long FRAME_MS=33L, FULL_MS=4300L, SOFT_MS=2200L;
 private final Paint ink=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final RectF arc=new RectF();
 private final boolean extreme,simulation;
 private final TvEffectsController.EffectsMode mode;
 private final long duration;
 private long began;
 private boolean running;

 CivilScreenEffect(Context context,boolean extreme,boolean simulation){
  super(context);
  this.extreme=extreme;
  this.simulation=simulation;
  mode=TvEffectsController.selected(context);
  duration=mode==TvEffectsController.EffectsMode.FULL?FULL_MS:SOFT_MS;
  setWillNotDraw(false);
 }

 static boolean eligible(Context context){
  return TvEffectsController.enabled(context)&&
    TvEffectsController.selected(context)!=TvEffectsController.EffectsMode.OFF;
 }
 long duration(){return duration;}
 void stop(){running=false;clearAnimation();}

 @Override protected void onAttachedToWindow(){
  super.onAttachedToWindow();
  began=SystemClock.uptimeMillis();
  running=true;
  invalidate();
 }
 @Override protected void onDetachedFromWindow(){
  stop();
  super.onDetachedFromWindow();
 }

 private void stroke(Canvas canvas,int red,int green,int blue,int alpha,float width){
  ink.setShader(null);
  ink.setStyle(Paint.Style.STROKE);
  ink.setStrokeWidth(width);
  ink.setStrokeCap(Paint.Cap.ROUND);
  ink.setColor(Color.argb(Math.min(255,Math.max(0,alpha)),red,green,blue));
 }

 private static float fade(long elapsed,long duration){
  float enter=TvEffectsController.ease(TvEffectsController.phase(elapsed,320));
  float leave=TvEffectsController.ease(TvEffectsController.phase(duration-elapsed,800));
  return Math.max(0f,Math.min(enter,leave));
 }

 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);
  if(!running||!ValueAnimator.areAnimatorsEnabled())return;
  long elapsed=SystemClock.uptimeMillis()-began;
  if(elapsed>=duration){running=false;return;}
  float w=getWidth(),h=getHeight();
  if(w<=0||h<=0)return;
  float density=getResources().getDisplayMetrics().density;
  float opacity=fade(elapsed,duration)*(simulation?.58f:1f);
  int r=extreme?223:227,g=extreme?47:156,b=extreme?66:76;
  float inset=Math.max(5f,4f*density);
  float strokeWidth=Math.max(1f,1.5f*density);
  float left=inset,top=inset,right=w-inset,bottom=h-inset;

  // A held, translucent perimeter gives full-screen awareness while the
  // underlying TV program stays fully visible.
  stroke(canvas,r,g,b,Math.round((mode==TvEffectsController.EffectsMode.FULL?80:43)*opacity),strokeWidth);
  canvas.drawRoundRect(left,top,right,bottom,8*density,8*density,ink);

  if(mode==TvEffectsController.EffectsMode.FULL){
   // One complete edge trace; it never loops, flashes or blocks text.
   float travel=TvEffectsController.ease(TvEffectsController.phase(elapsed,1450));
   float head=left+(right-left)*travel;
   float tail=Math.max(left,head-w*.17f);
   stroke(canvas,r,g,b,Math.round(140*opacity),Math.max(1f,2f*density));
   canvas.drawLine(tail,top,head,top,ink);
   canvas.drawLine(right-(head-left),bottom,right-(tail-left),bottom,ink);

   // Faint radar arcs remain near the corners, not over the main video.
   stroke(canvas,r,g,b,Math.round(41*opacity),strokeWidth);
   float radius=Math.min(w,h)*.24f;
   for(int i=1;i<=3;i++){
    float rad=radius*(.32f+i*.25f);
    arc.set(left-rad,top-rad,left+rad,top+rad);
    canvas.drawArc(arc,1,85,false,ink);
    arc.set(right-rad,bottom-rad,right+rad,bottom+rad);
    canvas.drawArc(arc,181,85,false,ink);
   }

   // A low-opacity light band sweeps once over the picture, staying well
   // beneath the brightness of a full-screen flash.
   float scan=TvEffectsController.ease(TvEffectsController.phase(elapsed,2600));
   float center=-w*.17f+scan*(w*1.34f);
   float half=Math.min(w*.08f,100*density);
   ink.setShader(new LinearGradient(center-half,0,center+half,0,
    new int[]{Color.TRANSPARENT,Color.argb(Math.round(13*opacity),r,g,b),Color.TRANSPARENT},
    new float[]{0f,.5f,1f},Shader.TileMode.CLAMP));
   ink.setStyle(Paint.Style.FILL);
   canvas.drawRect(Math.max(0,center-half),0,Math.min(w,center+half),h,ink);
   ink.setShader(null);
  }
  postInvalidateDelayed(FRAME_MS);
 }
}

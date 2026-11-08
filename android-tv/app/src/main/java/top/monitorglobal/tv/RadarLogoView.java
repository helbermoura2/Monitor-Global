package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.view.View;

/**
 * Exact Radar Scope logo geometry from ic_launcher_monitor.xml and
 * css/brand-logo.css. THREE rings remain still; ONLY radar sweep + dot rotate.
 * Original drawable, web logo and 2.4 second animation are not modified.
 */
public final class RadarLogoView extends View {
 private static final int CYAN=0xff38bdf8;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Path sector=new Path();
 private ValueAnimator animator;
 private float sweep;
 public RadarLogoView(Context c){this(c,null);}
 public RadarLogoView(Context c,AttributeSet attrs){
  super(c,attrs);
  sector.moveTo(64,64);sector.lineTo(64,8);
  sector.arcTo(8,8,120,120,-90,45,false);sector.close();
  setContentDescription("Monitor Global · radar em movimento");
  setLayerType(View.LAYER_TYPE_HARDWARE,null);
 }
 public void setSweepDegrees(float degrees){sweep=degrees;invalidate();}
 public float getSweepDegrees(){return sweep;}
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);int save=c.save();
  float size=Math.min(getWidth(),getHeight())/128f;
  c.translate((getWidth()-128*size)/2f,(getHeight()-128*size)/2f);
  c.scale(size,size);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(4f);
  paint.setColor(0x5938bdf8);
  for(int r:new int[]{56,38,20})c.drawCircle(64,64,r,paint);
  c.save();c.rotate(sweep,64,64);
  paint.setStyle(Paint.Style.FILL);paint.setColor(0xd938bdf8);c.drawPath(sector,paint);
  paint.setColor(CYAN);c.drawCircle(64,64,7,paint);
  c.restore();c.restoreToCount(save);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();start();}
 @Override protected void onDetachedFromWindow(){stop();super.onDetachedFromWindow();}
 private void start(){
  stop();
  if(!ValueAnimator.areAnimatorsEnabled())return; // respect reduced motion
  animator=ValueAnimator.ofFloat(0,360);
  animator.setDuration(2400);animator.setRepeatCount(ValueAnimator.INFINITE);
  animator.setInterpolator(new android.view.animation.LinearInterpolator());
  animator.addUpdateListener(v->setSweepDegrees((Float)v.getAnimatedValue()));
  animator.start();
 }
 private void stop(){if(animator!=null){animator.cancel();animator=null;}}
}

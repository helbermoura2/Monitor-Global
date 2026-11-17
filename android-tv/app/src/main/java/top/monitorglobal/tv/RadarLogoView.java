package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.View;

/** Argos Orbis: gold blinking eye with stationary teal radar and rotating pointer. */
public final class RadarLogoView extends View {
 private static final int CYAN=0xff1fcac5,GOLD=0xffc4a16a;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private static final Path SECTOR=new Path(),QUAKE=new Path(),WAVES=new Path();
 static {
  SECTOR.moveTo(64,64);SECTOR.lineTo(64,26);
  SECTOR.arcTo(26,26,102,102,-90,42,false);SECTOR.close();
  QUAKE.moveTo(17,26);QUAKE.lineTo(24,26);QUAKE.lineTo(24,21);
  QUAKE.lineTo(29,21);QUAKE.lineTo(29,28);QUAKE.lineTo(34,19);
  QUAKE.lineTo(38,30);QUAKE.lineTo(42,24);
  WAVES.moveTo(14,105);WAVES.cubicTo(20,99,24,99,29,105);
  WAVES.cubicTo(34,111,39,111,44,105);
 }
 private ValueAnimator animator;
 private float sweep;
 public RadarLogoView(Context c){this(c,null);}
 public RadarLogoView(Context c,AttributeSet attrs){
  super(c,attrs);
  setContentDescription("Argos Orbis · olho do vigilante e radar em movimento");
 }
 public void setSweepDegrees(float degrees){sweep=degrees;invalidate();}
 public float getSweepDegrees(){return sweep;}
 @Override protected void onDraw(Canvas c){
  super.onDraw(c);
  int save=c.save();
  float scale=Math.min(getWidth(),getHeight())/128f;
  if(scale<=0f){c.restoreToCount(save);return;}
  c.translate((getWidth()-128*scale)/2f,(getHeight()-128*scale)/2f);c.scale(scale,scale);
  final float phase=(SystemClock.uptimeMillis()%11000)/11000f;
  float open=1f;
  if(phase>.81f && phase<.89f){
   final float p=(phase-.81f)/.08f;
   open=Math.max(.015f,Math.abs(2f*p-1f));
  }
  drawArtwork(c,paint,sweep,open);
  c.restoreToCount(save);
 }
 /** Shared vector artwork for the official Argos Orbis emblem.
  * Both the home header and all 960x126 lower-thirds use this exact geometry;
  * only the layout transform differs. No bitmap or separate simplified logo.
  */
 static void drawArtwork(Canvas c,Paint paint,float sweep,float open){
  drawArtwork(c,paint,sweep,open,true);
 }
 /** Strip rendering can replace only the miniature inscriptions with readable labels. */
 static void drawArtwork(Canvas c,Paint paint,float sweep,float open,boolean includeInscriptions){
  Path eye=new Path();
  eye.moveTo(8,64);
  eye.quadTo(64,64-54*open,120,64);
  eye.quadTo(64,64+54*open,8,64);eye.close();
  c.save();c.clipPath(eye);
  paint.setStyle(Paint.Style.FILL);paint.setColor(0xff052f35);
  c.drawCircle(64,64,38,paint);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3.5f);paint.setColor(CYAN);
  for(int r:new int[]{38,28,17})c.drawCircle(64,64,r,paint);
  // Stationary radar details from the official mark; pointer is the only rotation.
  paint.setColor(0xff14a4a6);paint.setStrokeWidth(2.8f);
  for(int j=0;j<12;j++)c.drawArc(32,32,96,96,j*30-87,15,false,paint);
  c.save();c.rotate(sweep,64,64);
  paint.setStyle(Paint.Style.FILL);paint.setColor(0x7742f5e7);c.drawPath(SECTOR,paint);
  paint.setColor(0xff3affed);c.drawCircle(64,64,5.5f,paint);
  c.restore();c.restore();
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(4f);paint.setColor(GOLD);
  c.drawPath(eye,paint);
  // Original four symbols from the site: seismic, compass, cyclone, and globe.
  paint.setColor(0xffb99a68);paint.setStrokeWidth(1.2f);
  c.drawPath(QUAKE,paint);
  c.drawCircle(108,24,5,paint);c.drawLine(108,16,108,32,paint);
  c.drawLine(100,24,116,24,paint);c.drawLine(104,20,112,28,paint);
  c.drawPath(WAVES,paint);
  c.drawCircle(108,105,6,paint);c.drawOval(105,99,111,111,paint);
  c.drawLine(101,105,115,105,paint);c.drawLine(108,98,108,112,paint);
  paint.setStyle(Paint.Style.FILL);
  // Broadcast labels use Rajdhani/JetBrains; normalize the logo text
  // so all lower thirds draw identical glyphs regardless of the last metric.
  if(includeInscriptions){
   paint.setTypeface(android.graphics.Typeface.DEFAULT);
   paint.setTextScaleX(1f);
   paint.setColor(GOLD);paint.setTextAlign(Paint.Align.CENTER);
   paint.setTextSize(6f);
   c.drawText("ΠΑΝΟΠΤΗΣ",64,9,paint);
   c.drawText("CUSTOS ORBIS",64,126,paint);
   paint.setTextAlign(Paint.Align.LEFT);
  }
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();start();}
 @Override protected void onDetachedFromWindow(){stop();super.onDetachedFromWindow();}
 @Override protected void onWindowVisibilityChanged(int visibility){
  super.onWindowVisibilityChanged(visibility);
  if(visibility==VISIBLE)start();else stop();
 }
 private void start(){
  if(animator!=null)return;
  if(!ValueAnimator.areAnimatorsEnabled()||getWindowVisibility()!=VISIBLE)return;
  animator=ValueAnimator.ofFloat(0,360);animator.setDuration(7200);
  animator.setRepeatCount(ValueAnimator.INFINITE);
  animator.setInterpolator(new android.view.animation.LinearInterpolator());
  animator.addUpdateListener(v->setSweepDegrees((Float)v.getAnimatedValue()));
  animator.start();
 }
 private void stop(){if(animator!=null){animator.cancel();animator=null;}}
}

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
 private static final int GOLD=0xffc4a16a;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 private static final Path QUAKE=new Path(),WAVES=new Path();
 static {
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
  float open=OfficialArgosLogo.eyeOpenness(SystemClock.uptimeMillis(),ValueAnimator.areAnimatorsEnabled());
  drawArtwork(c,paint,sweep,open);
  c.restoreToCount(save);
 }
 /** Full vector artwork for in-app headers and the lower-third fallback. */
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
  drawRadar(c,paint,sweep);
  c.restore();
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
 // Shared radar geometry for the settings screens and every TV tarja.
 private static final float[] CONTACT_X={80,45,56,81};
 private static final float[] CONTACT_Y={49,55,86,82};
 private static final int TRAIL_SEGMENTS=12;
 private static final int[] TRAIL=new int[TRAIL_SEGMENTS];
 static{
  for(int i=0;i<TRAIL.length;i++)
   TRAIL[i]=android.graphics.Color.rgb(4+2*i,29+8*i,37+8*i);
 }
 static void drawRadar(Canvas c,Paint paint,float sweep){
  paint.setShader(null);paint.setStyle(Paint.Style.FILL);paint.setColor(0xff041d25);
  c.drawCircle(64,64,39,paint);
  c.save();c.rotate(sweep,64,64);
  for(int i=0;i<TRAIL.length;i++){
   paint.setColor(TRAIL[i]);
   c.drawArc(25,25,103,103,-162+6*i,6.2f,true,paint);
  }
  paint.setColor(0xff92ffeb);paint.setStrokeWidth(1.2f);
  c.drawLine(64,64,64,25,paint);
  c.restore();
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(.8f);paint.setColor(0xff297c7d);
  c.drawCircle(64,64,38,paint);c.drawCircle(64,64,32,paint);
  c.drawCircle(64,64,21,paint);c.drawCircle(64,64,11,paint);
  paint.setStyle(Paint.Style.FILL);
  for(int i=0;i<CONTACT_X.length;i++){
   double bearing=Math.toDegrees(Math.atan2(CONTACT_Y[i]-64,CONTACT_X[i]-64))+90;
   double age=(sweep-bearing+720)%360;
   float glow=.24f+.76f*Math.max(0,1-(float)age/100);
   paint.setColor(android.graphics.Color.rgb(Math.round(133*glow),Math.round(255*glow),Math.round(221*glow)));
   c.drawCircle(CONTACT_X[i],CONTACT_Y[i],1.65f,paint);
  }
  paint.setColor(0xff67ddd0);c.drawCircle(64,64,1.7f,paint);
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
  animator=ValueAnimator.ofFloat(0,360);animator.setDuration(BroadcastVisuals.RADAR_PERIOD_MS);
  animator.setRepeatCount(ValueAnimator.INFINITE);
  animator.setInterpolator(new android.view.animation.LinearInterpolator());
  animator.addUpdateListener(v->setSweepDegrees((Float)v.getAnimatedValue()));
  animator.start();
 }
 private void stop(){if(animator!=null){animator.cancel();animator=null;}}
}

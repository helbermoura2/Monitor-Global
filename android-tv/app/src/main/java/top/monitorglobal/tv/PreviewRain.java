package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;
import java.util.Random;

/** Rain over a transparent window. The water highlights are drawn without sampling the TV picture. */
final class PreviewRain extends View {
 private static final long DURATION_MS=12250,FADE_IN_MS=450,FADE_OUT_MS=750,FRAME_MS=34;
 private static final int[] AIR_COUNTS={42,86,146,220};
 private static final int[] GLASS_COUNTS={8,15,25,36};
 private static final float[] WIND={4,13,29,47};
 private static final float[] FALL={.32f,.44f,.59f,.74f};
 private static final float[] GLASS_SPEED={.014f,.024f,.039f,.058f};

 private final int level,glassCount,airCount;
 private final float[] x,y,depth,variation;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
 private final RectF box=new RectF();
 private final Bitmap bead,air;
 private final Runnable frame=this::invalidate;
 private long born;
 private boolean running;

 PreviewRain(Context context,int selectedStyle,int selectedLevel){
  super(context);
  int style=WeatherPreviewOptions.valid(selectedStyle,3,2);
  level=WeatherPreviewOptions.valid(selectedLevel,4,1);
  glassCount=style==1?0:GLASS_COUNTS[level];
  airCount=style==0?0:AIR_COUNTS[level];
  int count=airCount+glassCount;
  x=new float[count];y=new float[count];depth=new float[count];variation=new float[count];
  Random random=new Random(1729);
  for(int i=0;i<count;i++){
   x[i]=random.nextFloat();y[i]=random.nextFloat();depth[i]=random.nextFloat();variation[i]=random.nextFloat();
  }
  bead=makeBead();
  air=makeStreak();
 }

 private static Bitmap makeBead(){
  Bitmap image=Bitmap.createBitmap(42,58,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(image);
  Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
  Path outline=new Path();
  outline.moveTo(22,5);
  outline.cubicTo(13,12,6,21,7,34);
  outline.cubicTo(7,49,16,54,28,51);
  outline.cubicTo(39,47,39,34,35,23);
  outline.cubicTo(32,15,27,10,22,5);
  outline.close();
  p.setShader(new RadialGradient(17,22,33,new int[]{0x124f6974,0x1f9db8c3,0xa3182b35,0x4ac8e7ef},
   new float[]{0,.54f,.88f,1},Shader.TileMode.CLAMP));
  canvas.drawPath(outline,p);
  p.setShader(null);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.1f);p.setColor(0xabd5eef1);
  canvas.drawArc(9,15,34,38,180,83,false,p);
  p.setColor(0x80b9dee5);canvas.drawArc(11,30,35,49,23,104,false,p);
  p.setStyle(Paint.Style.FILL);p.setColor(0xabf0ffff);
  canvas.drawOval(12,21,15,25,p);
  return image;
 }

 private static Bitmap makeStreak(){
  Bitmap image=Bitmap.createBitmap(12,64,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(image);
  Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
  p.setShader(new LinearGradient(0,2,0,62,new int[]{0x00b9dbea,0x25b9dbea,0x99d9edf3,0x00b9dbea},
   new float[]{0,.35f,.8f,1},Shader.TileMode.CLAMP));
  Path streak=new Path();
  streak.moveTo(6,2);streak.quadTo(3,33,2,53);streak.quadTo(6,65,10,53);
  streak.quadTo(9,32,6,2);streak.close();
  canvas.drawPath(streak,p);
  return image;
 }

 @Override protected void onAttachedToWindow(){
  super.onAttachedToWindow();born=SystemClock.uptimeMillis();running=true;invalidate();
 }
 @Override protected void onDetachedFromWindow(){stop();releaseSprites();super.onDetachedFromWindow();}
 private void releaseSprites(){if(!bead.isRecycled())bead.recycle();if(!air.isRecycled())air.recycle();}
 void stop(){running=false;removeCallbacks(frame);invalidate();if(!isAttachedToWindow())releaseSprites();}

 static float opacity(long elapsed){
  return Math.min(TvEffectsController.ease(TvEffectsController.phase(elapsed,FADE_IN_MS)),
   TvEffectsController.ease(TvEffectsController.phase(DURATION_MS-elapsed,FADE_OUT_MS)));
 }

 @Override protected void onDraw(Canvas canvas){
  if(!running)return;
  long elapsed=SystemClock.uptimeMillis()-born;
  if(elapsed>=DURATION_MS){stop();return;}
  float seconds=elapsed/1000f,fade=opacity(elapsed);
  float width=getWidth(),height=getHeight(),scale=Math.max(.5f,height/720f);
  drawAir(canvas,seconds,fade,width,height,scale);
  drawGlass(canvas,seconds,fade,width,height,scale);
  removeCallbacks(frame);postDelayed(frame,FRAME_MS);
 }

 private void drawAir(Canvas canvas,float seconds,float fade,float width,float height,float scale){
  for(int i=0;i<airCount;i++){
   float near=depth[i];
   float length=(13+near*24+variation[i]*9)*(1+level*.17f)*scale;
   float size=(1.7f+near*2.8f)*scale;
   float yy=((y[i]+seconds*FALL[level]*(.59f+near*.62f+variation[i]*.18f))%1.18f-.1f)*height;
   float xx=(x[i]*width+seconds*WIND[level]*(.6f+near)*scale)%(width+32)-12;
   paint.setAlpha(Math.round(fade*(95+near*115)));
   canvas.save();
   canvas.rotate(-WIND[level]*.28f,xx,yy);
   box.set(xx-size,yy-length,xx+size,yy);
   canvas.drawBitmap(air,null,box,paint);
   canvas.restore();
  }
 }

 private void drawGlass(Canvas canvas,float seconds,float fade,float width,float height,float scale){
  for(int i=airCount;i<x.length;i++){
   float phase=(seconds*(.19f+variation[i]*.17f)+depth[i])%1;
   float slide=TvEffectsController.ease(TvEffectsController.phase((long)((phase-.38f)*1000),620));
   float xx=(.025f+x[i]*.95f)*width+(variation[i]-.5f)*9*slide*scale;
   float yy=((y[i]+seconds*GLASS_SPEED[level]*(.28f+variation[i])+.1f*slide)%1.08f-.04f)*height;
   float radius=(2.7f+depth[i]*5.3f+level*.8f)*scale;
   boolean merging=level>=2&&i%5==0&&phase<.38f;
   if(merging)drawBead(canvas,xx-radius*(1.5f- phase),yy-radius*(2.2f-3*phase),radius*.46f,fade*.7f);
   if(level>0&&slide>0){
    paint.setColor(Color.rgb(174,216,226));paint.setAlpha(Math.round(fade*(18+level*8)*slide));
    paint.setStrokeWidth(Math.max(.7f,radius*.18f));paint.setStrokeCap(Paint.Cap.ROUND);
    canvas.drawLine(xx-radius*.15f,yy-radius*(2+slide*2),xx,yy,paint);
   }
   drawBead(canvas,xx,yy,radius,fade);
  }
 }

 private void drawBead(Canvas canvas,float x,float y,float radius,float fade){
  paint.setAlpha(Math.round(fade*218));
  box.set(x-radius,y-radius*1.42f,x+radius,y+radius*1.42f);
  canvas.drawBitmap(bead,null,box,paint);
 }
}

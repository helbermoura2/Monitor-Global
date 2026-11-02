package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.os.SystemClock;import android.view.View;
/** Two small reusable sprites; no screenshot of the app behind the overlay is taken. */
final class PreviewRain extends View {
 private final int style,level,glassCount,airCount;private final float[] x,y,r,speed;private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);private final RectF box=new RectF();private final Bitmap bead,air;
 private final long born=SystemClock.uptimeMillis();private boolean running;private final Runnable frame=()->invalidate();
 PreviewRain(Context c,int selectedStyle,int selectedLevel){
  super(c);style=WeatherPreviewOptions.valid(selectedStyle,3,2);level=WeatherPreviewOptions.valid(selectedLevel,4,1);
  glassCount=style==1?0:new int[]{12,26,46,70}[level];airCount=style==0?0:new int[]{24,55,100,160}[level];
  int count=Math.max(glassCount,airCount);x=new float[count];y=new float[count];r=new float[count];speed=new float[count];java.util.Random random=new java.util.Random(1729);
  for(int i=0;i<count;i++){x[i]=random.nextFloat();y[i]=random.nextFloat();r[i]=random.nextFloat();speed[i]=random.nextFloat();}
  bead=bead();air=air();
 }
 private static Bitmap bead(){
  Bitmap image=Bitmap.createBitmap(64,96,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(image);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
  Path shape=new Path();shape.moveTo(31,7);shape.cubicTo(19,26,8,48,14,68);shape.cubicTo(22,91,52,87,54,63);shape.cubicTo(57,44,42,23,31,7);shape.close();
  p.setShader(new RadialGradient(26,43,43,new int[]{0x08459bbe,0x3875a2b9,0x8a0b2638,0x30d6f5ff},new float[]{0,.60f,.91f,1},Shader.TileMode.CLAMP));c.drawPath(shape,p);p.setShader(null);
  p.setStyle(Paint.Style.STROKE);p.setColor(0x6cc5eaff);p.setStrokeWidth(1.3f);c.drawPath(shape,p);
  p.setColor(0xddeafaff);p.setStrokeWidth(2.6f);c.drawArc(18,32,42,70,155,88,false,p);p.setColor(0x90ffffff);p.setStrokeWidth(1.2f);c.drawArc(22,54,51,82,30,90,false,p);
  p.setStyle(Paint.Style.FILL);p.setColor(0xc9ffffff);c.drawOval(21,31,25,38,p);return image;
 }
 private static Bitmap air(){
  Bitmap image=Bitmap.createBitmap(24,80,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(image);c.scale(1,3);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
  p.setShader(new RadialGradient(12,13,11,new int[]{0x83d5edfa,0x45c2e1f4,0x00beddf2},new float[]{0,.35f,1},Shader.TileMode.CLAMP));c.drawOval(1,2,23,24,p);return image;
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();running=true;invalidate();}
 @Override protected void onDetachedFromWindow(){stop();releaseSprites();super.onDetachedFromWindow();}
 private void releaseSprites(){if(!bead.isRecycled())bead.recycle();if(!air.isRecycled())air.recycle();}
 void stop(){running=false;removeCallbacks(frame);invalidate();if(!isAttachedToWindow())releaseSprites();}
 @Override protected void onDraw(Canvas c){
  if(!running)return;float seconds=(SystemClock.uptimeMillis()-born)/1000f;if(seconds>12.25f){stop();return;}
  float w=getWidth(),h=getHeight(),density=getResources().getDisplayMetrics().density;
  for(int i=0;i<airCount;i++){float depth=.35f+.65f*r[i],yy=((y[i]+seconds*(.30f+speed[i]*.28f)*(1+level*.22f))%1.15f-.10f)*h;float xx=(x[i]*w+seconds*(12+level*9)*depth)%Math.max(1,w);float width=(1.2f+3.3f*depth)*density,height=width*(2.4f+depth*2.2f);box.set(xx,yy,xx+width,yy+height);paint.setAlpha((int)((style==2?120:180)*depth));c.drawBitmap(air,null,box,paint);}
  for(int i=0;i<glassCount;i++){
   float nx=style==2?(i%2==0?x[i]*.16f:.84f+x[i]*.16f):x[i];
   float yy=((y[i]+seconds*(.002f+speed[i]*.008f)*(1+level*.18f))%1.12f-.04f)*h,xx=nx*w;float radius=(3+8*r[i])*(1+level*.12f)*density;
   paint.setAlpha(style==2?180:225);box.set(xx-radius,yy-radius*1.4f,xx+radius,yy+radius*1.4f);c.drawBitmap(bead,null,box,paint);
   if(i%9==0&&level>0){paint.setAlpha(45);for(int j=1;j<=3;j++){float oldY=yy-j*radius*.8f;box.set(xx-radius*.35f,oldY-radius,xx+radius*.35f,oldY+radius);c.drawBitmap(bead,null,box,paint);}}
  }
  removeCallbacks(frame);postDelayed(frame,34);
 }
}

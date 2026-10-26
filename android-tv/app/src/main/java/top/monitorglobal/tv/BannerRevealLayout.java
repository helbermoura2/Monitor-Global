package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.widget.FrameLayout;
/** A red leading block reveals the actual banner behind it. No video, snapshots or per-frame objects. */
final class BannerRevealLayout extends FrameLayout {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path outline=new Path();private final Matrix matrix=new Matrix();
 private LinearGradient red;private float progress=1;
 BannerRevealLayout(Context c){super(c);}
 void reveal(float value){progress=Math.max(0,Math.min(1,value));invalidate();}
 @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){
  super.onSizeChanged(w,h,oldw,oldh);outline.reset();float height=h-getPaddingTop()-getPaddingBottom();
  outline.addRoundRect(0,getPaddingTop(),w,h-getPaddingBottom(),10*w/960f,10*height/126f,Path.Direction.CW);
  red=new LinearGradient(0,0,Math.max(1,w*.4f),0,new int[]{Color.rgb(191,24,39),Color.rgb(227,38,63),Color.rgb(191,24,39)},null,Shader.TileMode.CLAMP);
 }
 @Override protected void dispatchDraw(Canvas canvas){
  if(progress>=1){super.dispatchDraw(canvas);return;}
  float sweep=progress*1.4f*getWidth(),left=Math.max(0,sweep-getWidth()*.4f),right=Math.min(getWidth(),sweep);
  int outer=canvas.save();canvas.clipPath(outline);
  if(left>0){int content=canvas.save();canvas.clipRect(0,0,left,getHeight());super.dispatchDraw(canvas);canvas.restoreToCount(content);}
  if(right>left){matrix.setTranslate(left,0);if(red!=null)red.setLocalMatrix(matrix);paint.setShader(red);canvas.drawRect(left,getPaddingTop(),right,getHeight()-getPaddingBottom(),paint);paint.setShader(null);}
  canvas.restoreToCount(outer);
 }
}

package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.widget.FrameLayout;
/** A red leading block reveals the actual banner behind it. No video, snapshots or per-frame objects. */
final class BannerRevealLayout extends FrameLayout {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path outline=new Path();private final Matrix matrix=new Matrix();
 private LinearGradient red;private float progress=1;
 BannerRevealLayout(Context c){super(c);}
 void reveal(float value){progress=Math.max(0,Math.min(1,value));if(getChildCount()>0&&getChildAt(0) instanceof NewsBannerView)((NewsBannerView)getChildAt(0)).mapReveal(progress);invalidate();}
 @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){
  super.onSizeChanged(w,h,oldw,oldh);outline.reset();float height=h-getPaddingTop()-getPaddingBottom();
  float top=getPaddingTop()+(Prefs.get(getContext()).getBoolean("themeTop",false)?0:Banner.insetDp(getContext()))*height/(126f+Banner.insetDp(getContext()));
  outline.addRoundRect(0,top,w,top+126*height/(126f+Banner.insetDp(getContext())),10*w/960f,10*height/(126f+Banner.insetDp(getContext())),Path.Direction.CW);
  red=new LinearGradient(0,0,Math.max(1,w*.4f),0,new int[]{Color.rgb(191,24,39),Color.rgb(227,38,63),Color.rgb(191,24,39)},null,Shader.TileMode.CLAMP);
 }
 @Override protected void dispatchDraw(Canvas canvas){
  if(getChildCount()>0&&getChildAt(0) instanceof NewsBannerView)((NewsBannerView)getChildAt(0)).mapReveal(progress);
  if(progress>=1){super.dispatchDraw(canvas);return;}
  float bannerTop=getPaddingTop()+(Prefs.get(getContext()).getBoolean("themeTop",false)?0:Banner.insetDp(getContext()))*(getHeight()-getPaddingTop()-getPaddingBottom())/(126f+Banner.insetDp(getContext()));
  float bannerBottom=bannerTop+126*(getHeight()-getPaddingTop()-getPaddingBottom())/(126f+Banner.insetDp(getContext()));
  // The inset rises from behind the fixed banner; the approved red wipe still affects only the banner.
  int map=canvas.save();if(Prefs.get(getContext()).getBoolean("themeTop",false))canvas.clipRect(0,bannerBottom,getWidth(),getHeight());else canvas.clipRect(0,0,getWidth(),bannerTop);super.dispatchDraw(canvas);canvas.restoreToCount(map);
  float sweep=progress*1.4f*getWidth(),left=Math.max(0,sweep-getWidth()*.4f),right=Math.min(getWidth(),sweep);
  int outer=canvas.save();canvas.clipPath(outline);
  if(left>0){int content=canvas.save();canvas.clipRect(0,0,left,getHeight());super.dispatchDraw(canvas);canvas.restoreToCount(content);}
  if(right>left){matrix.setTranslate(left,0);if(red!=null)red.setLocalMatrix(matrix);paint.setShader(red);canvas.drawRect(left,bannerTop,right,bannerBottom,paint);paint.setShader(null);}
  canvas.restoreToCount(outer);
 }
}

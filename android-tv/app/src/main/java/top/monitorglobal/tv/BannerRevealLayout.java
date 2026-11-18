package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.widget.FrameLayout;
/** A red leading block reveals the actual banner behind it. No video, snapshots or per-frame objects. */
final class BannerRevealLayout extends FrameLayout {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path outline=new Path();private final Matrix matrix=new Matrix();
 private LinearGradient red;private float progress=1;
 private TvEffectsController effects;private boolean exiting,sceneStarted;
 private long sceneStart;private BannerOpening opening;
 void configure(TvEffectsController policy){configure(policy,Long.MAX_VALUE);}
 void configure(TvEffectsController policy,long duration){effects=policy;opening=new BannerOpening(policy,duration);exiting=false;sceneStarted=false;}
 long openingLead(){return opening!=null&&opening.visible(0)?opening.transitionStart():0;}
 void startPresentation(long when){sceneStart=when;sceneStarted=true;invalidate();}
 void exiting(){exiting=true;}
 private boolean brazil(){return getChildCount()>0&&getChildAt(0) instanceof BrazilNationalBannerView;}
 private float bodyHeight(){return brazil()?BrazilNationalBannerView.HEIGHT:126f;}
 private float totalHeight(){return bodyHeight()+mapInset();}
 BannerRevealLayout(Context c){super(c);}
 private int mapInset(){
  if(brazil())return 0;
  if(getChildCount()>0&&getChildAt(0) instanceof TvBroadcastInfoView)return ((TvBroadcastInfoView)getChildAt(0)).mapSpace;
  return Banner.insetDp(getContext());
 }
 private void revealMap(){
  if(getChildCount()==0)return;
  float visible=exiting||effects!=null&&!effects.animated()?1:progress;
  if(getChildAt(0) instanceof NewsBannerView)((NewsBannerView)getChildAt(0)).mapReveal(effects!=null&&effects.category==TvEffectsController.EffectsCategory.TSUNAMI?1:visible);
  else if(getChildAt(0) instanceof TvBroadcastInfoView)((TvBroadcastInfoView)getChildAt(0)).mapReveal(visible);
 }
 void reveal(float value){progress=Math.max(0,Math.min(1,value));revealMap();invalidate();}
 @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){
  super.onSizeChanged(w,h,oldw,oldh);outline.reset();float height=h-getPaddingTop()-getPaddingBottom();
  float top=getPaddingTop()+(Prefs.get(getContext()).getBoolean("themeTop",false)?0:mapInset())*height/(totalHeight());
  float radius=8*w/960f;outline.addRoundRect(0,top,w,top+bodyHeight()*height/(totalHeight()),new float[]{0,0,0,0,radius,radius,radius,radius},Path.Direction.CW);
  red=new LinearGradient(0,0,Math.max(1,w*.4f),0,new int[]{Color.rgb(191,24,39),Color.rgb(227,38,63),Color.rgb(191,24,39)},null,Shader.TileMode.CLAMP);
 }
 @Override protected void onDetachedFromWindow(){sceneStarted=false;if(opening!=null)opening.stop();super.onDetachedFromWindow();}
 @Override protected void dispatchDraw(Canvas canvas){
  long elapsed=android.os.SystemClock.uptimeMillis()-sceneStart;
  if(sceneStarted&&!exiting&&opening!=null&&opening.visible(elapsed)){
   long frameStart=android.os.SystemClock.elapsedRealtimeNanos();
   // Exclusive scenes: the normal child is never painted beneath the opening.
   float seam=opening.contentFraction(elapsed)*getWidth();
   if(seam>0){int child=canvas.save();canvas.clipRect(0,0,seam,getHeight());revealMap();super.dispatchDraw(canvas);canvas.restoreToCount(child);}
   int intro=canvas.save();canvas.clipRect(seam,0,getWidth(),getHeight());
   canvas.translate(0,getPaddingTop());canvas.scale(getWidth()/960f,(getHeight()-getPaddingTop()-getPaddingBottom())/totalHeight());
   canvas.translate(0,Prefs.get(getContext()).getBoolean("themeTop",false)?0:mapInset());
   float arrival=opening.standard()?opening.arrival(elapsed):1;
   if(arrival<1){
    canvas.translate(0,(1-arrival)*10*(Prefs.get(getContext()).getBoolean("themeTop",false)?-1:1));
    int layer=canvas.saveLayerAlpha(8,0,925,bodyHeight(),Math.round(255*arrival));
    opening.draw(canvas,elapsed,bodyHeight());canvas.restoreToCount(layer);
   }else opening.draw(canvas,elapsed,bodyHeight());
   canvas.restoreToCount(intro);
   if(seam>0&&seam<getWidth()&&effects.full()&&effects.category==TvEffectsController.EffectsCategory.GLOBAL_M6){
    float height=getHeight()-getPaddingTop()-getPaddingBottom();
    float top=getPaddingTop()+(Prefs.get(getContext()).getBoolean("themeTop",false)?0:mapInset())*height/totalHeight();
    float scale=height/totalHeight();
    paint.setShader(null);paint.setColor(0xffef8899);paint.setStrokeWidth(2*scale);
    canvas.drawLine(seam-8*scale,top+93*scale,seam,top+93*scale,paint);
   }
   RuntimeDiagnostics.frame(frameStart,android.os.SystemClock.elapsedRealtimeNanos()-frameStart,true);
   postInvalidateOnAnimation();return;
  }
  revealMap();
  if(exiting&&effects!=null&&effects.animated()){
   int restore=canvas.save();
   float travel=getPaddingBottom()*(1-progress);
   canvas.translate(0,Prefs.get(getContext()).getBoolean("themeTop",false)?-travel:travel);
   int layer=canvas.saveLayerAlpha(0,0,getWidth(),getHeight(),Math.round(255*progress));
   super.dispatchDraw(canvas);canvas.restoreToCount(layer);canvas.restoreToCount(restore);return;
  }
  if(progress>=1||effects!=null&&!effects.animated()){super.dispatchDraw(canvas);return;}
  if(effects!=null&&!(effects.full()&&effects.category==TvEffectsController.EffectsCategory.GLOBAL_M6)){
   // All data and the connected layout are present from frame one. Never wipe away a tsunami map.
   int layer=canvas.saveLayerAlpha(0,0,getWidth(),getHeight(),Math.round(255*(.72f+.28f*progress)));
   super.dispatchDraw(canvas);canvas.restoreToCount(layer);return;
  }
  float bannerTop=getPaddingTop()+(Prefs.get(getContext()).getBoolean("themeTop",false)?0:mapInset())*(getHeight()-getPaddingTop()-getPaddingBottom())/(totalHeight());
  float bannerBottom=bannerTop+bodyHeight()*(getHeight()-getPaddingTop()-getPaddingBottom())/(totalHeight());
  // The inset rises from behind the fixed banner; the approved red wipe still affects only the banner.
  int map=canvas.save();if(Prefs.get(getContext()).getBoolean("themeTop",false))canvas.clipRect(0,bannerBottom,getWidth(),getHeight());else canvas.clipRect(0,0,getWidth(),bannerTop);super.dispatchDraw(canvas);canvas.restoreToCount(map);
  float sweep=progress*1.4f*getWidth(),left=Math.max(0,sweep-getWidth()*.4f),right=Math.min(getWidth(),sweep);
  int outer=canvas.save();canvas.clipPath(outline);
  if(left>0){int content=canvas.save();canvas.clipRect(0,0,left,getHeight());super.dispatchDraw(canvas);canvas.restoreToCount(content);}
  if(right>left){matrix.setTranslate(left,0);if(red!=null)red.setLocalMatrix(matrix);paint.setShader(red);canvas.drawRect(left,bannerTop,right,bannerBottom,paint);paint.setShader(null);}
  canvas.restoreToCount(outer);
 }
}

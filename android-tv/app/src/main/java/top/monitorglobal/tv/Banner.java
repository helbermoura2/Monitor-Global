package top.monitorglobal.tv;
import android.content.*;import android.graphics.PixelFormat;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.FrameLayout;
final class Banner {
 private static final int TRAVEL_DP=12;
 private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private android.animation.ValueAnimator wipe;private Runnable exitDeadline,onFinished;private View awaiting;private ViewTreeObserver.OnPreDrawListener starter;private final Runnable dismiss=this::dismiss;
 Banner(Context c){context=c;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(Alert a,boolean demo,boolean replay){return showView(new NewsBannerView(context,a,demo,replay),BannerTimeline.durationMillis(a,Prefs.get(context).getInt("seconds",20)),0,null);}
 boolean showSummary(java.util.List<Alert> alerts,String day,boolean replay,boolean complete){return showSummary(alerts,day,replay,complete,null);}
 boolean showSummary(java.util.List<Alert> alerts,String day,boolean replay,boolean complete,Runnable finished){return showView(new NewsBannerView(context,alerts,day,replay,complete),0,alerts.size(),finished);}
 private boolean showView(NewsBannerView row,long duration,int summaryCount,Runnable finished){
  if(!Settings.canDrawOverlays(context))return false;main.removeCallbacks(dismiss);clearStarter();clearWipe();clearExit();onFinished=null;
  boolean animated=android.animation.ValueAnimator.areAnimatorsEnabled();
  WindowManager wm=(WindowManager)context.getSystemService(Context.WINDOW_SERVICE);WindowManager.LayoutParams p=new WindowManager.LayoutParams(context.getResources().getDisplayMetrics().widthPixels*Prefs.get(context).getInt("themeWidthPercent",92)/100,dp(126)+2*dp(TRAVEL_DP),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=(Prefs.get(context).getBoolean("themeTop",false)?Gravity.TOP:Gravity.BOTTOM)|Gravity.CENTER_HORIZONTAL;p.y=dp(32)-dp(TRAVEL_DP);
  try{
   BannerRevealLayout host;if(current instanceof BannerRevealLayout){host=(BannerRevealLayout)current;host.reveal(animated?0:1);host.removeAllViews();host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.updateViewLayout(host,p);}
   else{host=new BannerRevealLayout(context);host.setPadding(0,dp(TRAVEL_DP),0,dp(TRAVEL_DP));host.setClipToPadding(false);host.reveal(animated?0:1);host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.addView(host,p);current=host;}
   onFinished=finished;awaiting=row;
   starter=new ViewTreeObserver.OnPreDrawListener(){public boolean onPreDraw(){
    clearStarter();if(current!=host||host.getChildAt(0)!=row)return true;
    // Anchor both drawing and dismissal to the first visible frame, not construction/font loading.
    row.startPresentation(android.os.SystemClock.uptimeMillis(),animated);
    if(animated)animateWipe(host,0,1);
    long delay=summaryCount>0?BannerTimeline.summaryContentDuration(summaryCount,animated)+(animated?BannerTimeline.WIPE_MS:0):Math.max(0,duration-(animated?BannerTimeline.WIPE_MS:0));
    main.postDelayed(dismiss,delay);return true;
   }};row.getViewTreeObserver().addOnPreDrawListener(starter);return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Não foi possível exibir sobre outro aplicativo. Confira a permissão.");return false;}
 }
 private void animateWipe(BannerRevealLayout host,float from,float to){clearWipe();wipe=android.animation.ValueAnimator.ofFloat(from,to);wipe.setDuration(BannerTimeline.WIPE_MS);wipe.setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator());wipe.addUpdateListener(a->{if(current==host)host.reveal((float)a.getAnimatedValue());});wipe.start();}
 private void clearWipe(){if(wipe!=null){wipe.cancel();wipe.removeAllUpdateListeners();wipe=null;}}
 private void clearStarter(){if(awaiting!=null&&starter!=null&&awaiting.getViewTreeObserver().isAlive())awaiting.getViewTreeObserver().removeOnPreDrawListener(starter);awaiting=null;starter=null;}
 private void clearExit(){if(exitDeadline!=null)main.removeCallbacks(exitDeadline);exitDeadline=null;}
 private void finish(View host,View row){if(current!=host||((FrameLayout)host).getChildAt(0)!=row)return;Runnable callback=onFinished;hide();if(callback!=null)callback.run();}
 private void dismiss(){
  if(!(current instanceof BannerRevealLayout))return;BannerRevealLayout host=(BannerRevealLayout)current;View row=host.getChildAt(0);if(row==null){hide();return;}
  if(!android.animation.ValueAnimator.areAnimatorsEnabled()){finish(host,row);return;}
  clearExit();exitDeadline=()->finish(host,row);main.postDelayed(exitDeadline,BannerTimeline.WIPE_MS);animateWipe(host,1,0);
 }
 void hide(){main.removeCallbacks(dismiss);clearStarter();clearWipe();clearExit();onFinished=null;if(current!=null){try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
}

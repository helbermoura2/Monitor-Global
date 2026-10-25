package top.monitorglobal.tv;
import android.content.*;import android.graphics.PixelFormat;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.FrameLayout;
final class Banner {
 private static final long ENTRY_MS=450,EXIT_MS=300;private static final int TRAVEL_DP=12;
 private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private Runnable exitDeadline;private final Runnable dismiss=this::dismiss;
 Banner(Context c){context=c;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(Alert a,boolean demo,boolean replay){return showView(new NewsBannerView(context,a,demo,replay),BannerTimeline.durationMillis(a,Prefs.get(context).getInt("seconds",20)));}
 boolean showSummary(java.util.List<Alert> alerts,String day,boolean replay){return showView(new NewsBannerView(context,alerts,day,replay),BannerTimeline.summaryDuration(alerts.size()));}
 private boolean showView(View row,long duration){if(!Settings.canDrawOverlays(context))return false;main.removeCallbacks(dismiss);clearExit();

  boolean animated=android.animation.ValueAnimator.areAnimatorsEnabled();
  // Transparent travel room keeps the approved final size/position and avoids clipping the moving row.
  WindowManager wm=(WindowManager)context.getSystemService(Context.WINDOW_SERVICE);WindowManager.LayoutParams p=new WindowManager.LayoutParams(context.getResources().getDisplayMetrics().widthPixels*Prefs.get(context).getInt("themeWidthPercent",92)/100,dp(126)+2*dp(TRAVEL_DP),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=(Prefs.get(context).getBoolean("themeTop",false)?Gravity.TOP:Gravity.BOTTOM)|Gravity.CENTER_HORIZONTAL;p.y=dp(32)-dp(TRAVEL_DP);
  row.setAlpha(animated?0f:1f);row.setTranslationY(animated?dp(TRAVEL_DP):0);
  try{
   FrameLayout host;if(current instanceof FrameLayout){host=(FrameLayout)current;cancelRow(host);host.removeAllViews();host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.updateViewLayout(host,p);}
   else{host=new FrameLayout(context);host.setPadding(0,dp(TRAVEL_DP),0,dp(TRAVEL_DP));host.setClipToPadding(false);host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.addView(host,p);current=host;}
   if(animated)row.animate().alpha(1f).translationY(0).setDuration(ENTRY_MS).setInterpolator(new android.view.animation.DecelerateInterpolator(2f)).start();
   main.postDelayed(dismiss,animated?Math.max(0,duration-EXIT_MS):duration);return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Não foi possível exibir sobre outro aplicativo. Confira a permissão.");return false;}
 }
 private void cancelRow(FrameLayout host){if(host.getChildCount()>0)host.getChildAt(0).animate().withEndAction(null).cancel();}
 private void clearExit(){if(exitDeadline!=null)main.removeCallbacks(exitDeadline);exitDeadline=null;}
 private void dismiss(){
  if(!(current instanceof FrameLayout)||!android.animation.ValueAnimator.areAnimatorsEnabled()){hide();return;}
  FrameLayout host=(FrameLayout)current;View row=host.getChildAt(0);if(row==null){hide();return;}
  clearExit();exitDeadline=()->{if(current==host&&host.getChildAt(0)==row)hide();};
  // A timed removal also works when the screen stops delivering animation frames.
  main.postDelayed(exitDeadline,EXIT_MS);
  row.animate().withEndAction(null).cancel();row.animate().alpha(0f).translationY(dp(TRAVEL_DP)).setDuration(EXIT_MS).setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator()).withEndAction(exitDeadline).start();
 }
 void hide(){main.removeCallbacks(dismiss);clearExit();if(current!=null){if(current instanceof FrameLayout)cancelRow((FrameLayout)current);try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
}

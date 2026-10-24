package top.monitorglobal.tv;
import android.content.*;import android.graphics.PixelFormat;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.FrameLayout;
final class Banner {
 private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private final Runnable dismiss=this::hide;
 Banner(Context c){context=c;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(Alert a,boolean demo,boolean replay){if(!Settings.canDrawOverlays(context))return false;main.removeCallbacks(dismiss);
  View row=new NewsBannerView(context,a,demo,replay);
  WindowManager wm=(WindowManager)context.getSystemService(Context.WINDOW_SERVICE);WindowManager.LayoutParams p=new WindowManager.LayoutParams(context.getResources().getDisplayMetrics().widthPixels*Prefs.get(context).getInt("themeWidthPercent",92)/100,dp(126),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=(Prefs.get(context).getBoolean("themeTop",false)?Gravity.TOP:Gravity.BOTTOM)|Gravity.CENTER_HORIZONTAL;p.y=dp(32);
  try{
   FrameLayout host;if(current instanceof FrameLayout){host=(FrameLayout)current;host.removeAllViews();host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.updateViewLayout(host,p);}
   else{host=new FrameLayout(context);host.addView(row,new FrameLayout.LayoutParams(-1,-1));wm.addView(host,p);current=host;}
   main.postDelayed(dismiss,BannerTimeline.durationMillis(a,Prefs.get(context).getInt("seconds",20)));return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Não foi possível exibir sobre outro aplicativo. Confira a permissão.");return false;}
 }
 void hide(){main.removeCallbacks(dismiss);if(current!=null){try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
}

package top.monitorglobal.tv;
import android.content.*;import android.graphics.PixelFormat;import android.os.*;import android.provider.Settings;import android.view.*;

/** Silent, non-touchable Brent overlay. Sismic/tsunami alerts can hide it instantly. */
final class BrentOverlay {
 private final Context c;private final Handler main=new Handler(Looper.getMainLooper());private View current;
 BrentOverlay(Context context){c=context;}
 boolean showing(){return current!=null;}
 boolean show(BrentQuote quote,boolean demo){
  if(quote==null||!Settings.canDrawOverlays(c))return false;
  hide();
  try{
   BrentCardView card=new BrentCardView(c,quote,demo);
   int width=Math.min(dp(385),c.getResources().getDisplayMetrics().widthPixels*42/100);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(width,-2,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT);
   p.gravity=Gravity.BOTTOM|Gravity.RIGHT;p.x=dp(28);p.y=dp(28);
   ((WindowManager)c.getSystemService(Context.WINDOW_SERVICE)).addView(card,p);current=card;
   CardMotion.enter(card,c);
   main.postDelayed(()->{if(current==card)CardMotion.exit(card,c,()->{if(current==card)hide();});},BrentQuote.DISPLAY);
   return true;
  }catch(RuntimeException e){hide();return false;}
 }
 void hide(){
  main.removeCallbacksAndMessages(null);
  if(current!=null){
   current.animate().cancel();
   try{((WindowManager)c.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}
   current=null;
  }
 }
 private int dp(int n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
}

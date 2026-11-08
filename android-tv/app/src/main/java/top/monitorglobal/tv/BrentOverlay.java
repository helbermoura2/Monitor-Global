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
   int width=Math.min(dp(455),c.getResources().getDisplayMetrics().widthPixels*45/100);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(width,-2,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT);
   p.gravity=Gravity.TOP|Gravity.RIGHT;p.x=dp(24);p.y=dp(34);
   ((WindowManager)c.getSystemService(Context.WINDOW_SERVICE)).addView(card,p);current=card;
   if(android.animation.ValueAnimator.areAnimatorsEnabled()){
    card.setAlpha(0);card.setTranslationY(-dp(9));card.animate().alpha(1).translationY(0).setDuration(280).start();
   }
   main.postDelayed(()->{if(current!=card)return;if(!android.animation.ValueAnimator.areAnimatorsEnabled()){hide();return;}
     card.animate().alpha(0).setDuration(260).withEndAction(()->{if(current==card)hide();}).start();
   },BrentQuote.DISPLAY);
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

package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;
/** Short, transparent, touch-through weather overlay with bounded, reusable rain sprites. */
final class RainOverlay {
 static final long DURATION=12000;private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private PreviewRain previewRain;private Runnable completed;
 RainOverlay(Context c){context=c;}
 int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo){
  return show(s,effect,demo,null);
 }
 boolean show(RainForecast.Summary s,boolean effect,boolean demo,WeatherForecast.Summary weather){return show(s,effect,demo,weather,false);}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview){
  return show(s,effect,demo,weather,stormPreview,null);
 }
 boolean showing(){return current!=null;}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,Runnable onCompleted){
  hide();long expiry=weather==null?(s==null?0:s.expiresAt):s==null?weather.expiresAt:Math.min(weather.expiresAt,s.expiresAt);long duration=demo?DURATION:Math.min(DURATION,expiry-System.currentTimeMillis()-500);if(duration<=0||!Settings.canDrawOverlays(context))return false;
  try{FrameLayout host=new FrameLayout(context);boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
   boolean preview=stormPreview&&demo;boolean rainfall=effect&&s!=null&&s.rain&&animate;if(rainfall){previewRain=new PreviewRain(context,preview?WeatherPreviewOptions.style(context):2,preview?WeatherPreviewOptions.level(context):RainVisualPolicy.level(s.rate,weather!=null&&weather.stormForecast));host.addView(previewRain,new FrameLayout.LayoutParams(-1,-1));}
   WeatherCardView card=new WeatherCardView(context,s,weather,demo,preview);
   FrameLayout.LayoutParams box=new FrameLayout.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),-2,Gravity.TOP|Gravity.RIGHT);box.setMargins(rainfall?dp(24):0,rainfall?dp(28):0,rainfall?dp(28):0,0);host.addView(card,box);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams((rainfall)?-1:box.width,(rainfall)?-1:WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|((rainfall)?Gravity.LEFT:Gravity.RIGHT);p.x=(rainfall)?0:dp(28);p.y=(rainfall)?0:dp(28);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(host,p);current=host;completed=onCompleted;
   if(animate){host.setAlpha(0);card.setTranslationY(-dp(10));host.animate().alpha(1).setDuration(250).start();card.animate().translationY(0).setDuration(250).start();}
   main.postDelayed(()->{if(current!=host)return;Runnable finish=()->{if(current!=host)return;Runnable delivered=completed;completed=null;hide();if(delivered!=null)delivered.run();};if(!animate){finish.run();return;}if(previewRain!=null)previewRain.stop();host.animate().alpha(0).setDuration(250).withEndAction(finish).start();},duration+250);return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Chuva: confira a permissão de exibição sobre outros aplicativos.");return false;}
 }
 void hide(){completed=null;main.removeCallbacksAndMessages(null);if(previewRain!=null){previewRain.stop();previewRain=null;}if(current!=null){current.animate().cancel();try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
}

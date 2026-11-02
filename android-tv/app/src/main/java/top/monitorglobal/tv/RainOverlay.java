package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;
/** Short, transparent, touch-through weather overlay with bounded, reusable rain sprites. */
final class RainOverlay {
 static final long DURATION=12000;private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private PreviewRain previewRain;
 RainOverlay(Context c){context=c;}
 int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo){
  return show(s,effect,demo,null);
 }
 boolean show(RainForecast.Summary s,boolean effect,boolean demo,WeatherForecast.Summary weather){return show(s,effect,demo,weather,false);}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview){
  hide();long expiry=weather==null?(s==null?0:s.expiresAt):s==null?weather.expiresAt:Math.min(weather.expiresAt,s.expiresAt);long duration=demo?DURATION:Math.min(DURATION,expiry-System.currentTimeMillis()-500);if(duration<=0||!Settings.canDrawOverlays(context))return false;
  try{FrameLayout host=new FrameLayout(context);boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
   boolean preview=stormPreview&&demo;boolean rainfall=effect&&s!=null&&s.rain&&animate;if(rainfall){previewRain=new PreviewRain(context,preview?WeatherPreviewOptions.style(context):2,preview?WeatherPreviewOptions.level(context):RainVisualPolicy.level(s.rate,weather!=null&&weather.stormForecast));host.addView(previewRain,new FrameLayout.LayoutParams(-1,-1));}
   LinearLayout card=new LinearLayout(context);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(18),dp(12),dp(18),dp(12));GradientDrawable bg=new GradientDrawable();bg.setColor(0xf50a192b);bg.setCornerRadius(dp(14));bg.setStroke(dp(1),0xff61d7e7);card.setBackground(bg);
   Typeface brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
   LinearLayout header=new LinearLayout(context);header.setGravity(Gravity.CENTER_VERTICAL);ImageView logo=new ImageView(context);logo.setImageResource(R.drawable.ic_monitor);LinearLayout.LayoutParams icon=new LinearLayout.LayoutParams(dp(20),dp(20));icon.setMarginEnd(dp(8));header.addView(logo,icon);card.addView(header);line(header,demo?"TESTE FICTÍCIO · LIBERDADE, SP":"MONITOR GLOBAL · LIBERDADE, SP",16,0xff70dce8,brand);
   if(preview){line(card,"CHUVA · PRÉVIA VISUAL FICTÍCIA",17,0xffbdeaff,brand);line(card,WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(context)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(context)],15,0xffbdeaff,brand);}
   if(weather!=null){line(card,weather.temperature,24,Color.WHITE,brand);line(card,weather.condition+" · "+weather.humidity,17,0xffd9eff5,Typeface.DEFAULT);line(card,weather.wind,16,0xffd9eff5,Typeface.DEFAULT);}
   if(s!=null){line(card,s.rain&&weather!=null&&weather.stormForecast?"Tempestade prevista · "+s.title:s.title,weather==null?24:18,Color.WHITE,brand);if(s.state.equals("now"))line(card,s.rateText,weather==null?17:15,0xffd9eff5,Typeface.DEFAULT);line(card,s.amountText,weather==null?17:15,0xffd9eff5,Typeface.DEFAULT);if(weather==null&&!s.state.equals("dry"))line(card,s.stopText,15,0xffbfd1df,Typeface.DEFAULT);}else line(card,"Chuva por minuto: indisponível",15,0xffbfd1df,Typeface.DEFAULT);
   java.text.SimpleDateFormat fmt=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);fmt.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));
   if(weather!=null)line(card,weather.timing,12,0xffbfd1df,Typeface.DEFAULT);line(card,stormPreview&&demo?"DEMONSTRAÇÃO LOCAL · DADOS FICTÍCIOS":"Rainbow Weather"+(s==null?" · previsão horária":" · chuva consultada "+fmt.format(new java.util.Date(s.at))),13,0xffbfd1df,Typeface.DEFAULT);line(card,stormPreview&&demo?"Demonstração · não informa o tempo atual":"Estimativa para um ponto da Liberdade · sujeita a mudanças",12,0xffa9c1cd,Typeface.DEFAULT);
   FrameLayout.LayoutParams box=new FrameLayout.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),-2,Gravity.TOP|Gravity.RIGHT);box.setMargins(rainfall?dp(24):0,rainfall?dp(28):0,rainfall?dp(28):0,0);host.addView(card,box);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams((rainfall)?-1:box.width,(rainfall)?-1:WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|((rainfall)?Gravity.LEFT:Gravity.RIGHT);p.x=(rainfall)?0:dp(28);p.y=(rainfall)?0:dp(28);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(host,p);current=host;
   if(animate){host.setAlpha(0);card.setTranslationY(-dp(10));host.animate().alpha(1).setDuration(250).start();card.animate().translationY(0).setDuration(250).start();}
   main.postDelayed(()->{if(current!=host)return;if(!animate){hide();return;}if(previewRain!=null)previewRain.stop();host.animate().alpha(0).setDuration(250).withEndAction(()->{if(current==host)hide();}).start();},duration+250);return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Chuva: confira a permissão de exibição sobre outros aplicativos.");return false;}
 }
 private void line(LinearLayout card,String text,int size,int color,Typeface font){TextView t=new TextView(context);t.setText(text);t.setTextSize(size);t.setTextColor(color);t.setTypeface(font);t.setMaxLines(2);card.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 void hide(){main.removeCallbacksAndMessages(null);if(previewRain!=null){previewRain.stop();previewRain=null;}if(current!=null){current.animate().cancel();try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
}

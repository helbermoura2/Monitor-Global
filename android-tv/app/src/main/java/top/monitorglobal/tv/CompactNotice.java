package top.monitorglobal.tv;

import android.app.*;import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.media.*;import android.os.*;import android.provider.Settings;import android.text.TextUtils;import android.view.*;import android.widget.*;
/** Small watch-area card. No map requests, focus, permanent animation or replay mutation. */
final class CompactNotice {
 static final long DURATION_MS=8000;
 private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private ToneGenerator tone;
 private final Runnable dismiss=()->exit();
 CompactNotice(Context c){context=c;}
 private int dp(int value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
 void show(Alert alert,boolean demo){
  hide();boolean shown=false;
  if(Settings.canDrawOverlays(context))try{
   LinearLayout card=new LinearLayout(context);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(18),dp(10),dp(18),dp(10));GradientDrawable bg=new GradientDrawable();bg.setColor(0xf50a192b);bg.setCornerRadius(dp(14));bg.setStroke(dp(2),0xff44d7dd);card.setBackground(bg);
   Typeface brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
   LinearLayout header=new LinearLayout(context);header.setGravity(Gravity.CENTER_VERTICAL);ImageView logo=new ImageView(context);logo.setImageResource(R.drawable.ic_monitor);LinearLayout.LayoutParams icon=new LinearLayout.LayoutParams(dp(20),dp(20));icon.setMarginEnd(dp(8));header.addView(logo,icon);card.addView(header);line(header,demo?"TESTE FICTÍCIO · NÃO É ALERTA REAL":"MONITOR GLOBAL · ÁREA MONITORADA",16,0xff61e0df,brand);
   line(card,alert.title,24,Color.WHITE,brand);
   String depth=String.format(java.util.Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km · %s",alert.depth,alert.source);
   java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);format.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));String time=format.format(new java.util.Date(alert.eventTime));
   line(card,depth+" · "+time,15,0xffd6e4ee,Typeface.DEFAULT);
   line(card,alert.targetArea,14,0xffb5c9d5,Typeface.DEFAULT);line(card,"Danos não confirmados",12,0xffb5c9d5,Typeface.DEFAULT);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(Math.min(dp(400),context.getResources().getDisplayMetrics().widthPixels*44/100),WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.BOTTOM|Gravity.RIGHT;p.x=dp(32);p.y=dp(32);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(card,p);current=card;shown=true;
   if(android.animation.ValueAnimator.areAnimatorsEnabled()){card.setAlpha(0);card.setTranslationY(dp(12));card.animate().alpha(1).translationY(0).setDuration(220).start();}
   main.postDelayed(dismiss,DURATION_MS+220);
  }catch(RuntimeException e){hide();}
  if(!shown)try{PendingIntent open=PendingIntent.getActivity(context,1,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);context.getSystemService(NotificationManager.class).notify(2,new Notification.Builder(context,"alerts").setSmallIcon(R.drawable.ic_monitor).setContentTitle((demo?"TESTE FICTÍCIO · ":"ÁREA MONITORADA · ")+alert.title).setContentText(alert.targetArea+" · Danos não confirmados").setContentIntent(open).setAutoCancel(true).build());}catch(RuntimeException ignored){}
  if(Prefs.get(context).getBoolean("sound",true))try{tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,45);tone.startTone(ToneGenerator.TONE_PROP_BEEP,160);main.postDelayed(()->{if(tone!=null){tone.release();tone=null;}},300);}catch(RuntimeException ignored){}
 }
 private void line(LinearLayout card,String value,int size,int color,Typeface face){TextView text=new TextView(context);text.setText(value);text.setTextSize(size);text.setTextColor(color);text.setTypeface(face);text.setSingleLine(true);text.setEllipsize(TextUtils.TruncateAt.MARQUEE);text.setMarqueeRepeatLimit(1);text.setSelected(true);card.addView(text,new LinearLayout.LayoutParams(-1,-2));}
 private void exit(){if(current==null)return;View card=current;if(!android.animation.ValueAnimator.areAnimatorsEnabled()){hide();return;}card.animate().alpha(0).translationY(dp(12)).setDuration(180).withEndAction(()->{if(current==card)hide();}).start();}
 void hide(){main.removeCallbacksAndMessages(null);try{context.getSystemService(NotificationManager.class).cancel(2);}catch(RuntimeException ignored){}if(current!=null){current.animate().cancel();try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}if(tone!=null){tone.release();tone=null;}}
}

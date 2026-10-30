package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;
/** A short, transparent, touch-through overlay. No bitmap, blur, sound or permanent loop. */
final class RainOverlay {
 static final long DURATION=12000;private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private Drops drops;
 RainOverlay(Context c){context=c;}
 int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 boolean show(RainForecast.Summary s,boolean effect,boolean demo){
  hide();long duration=demo?DURATION:Math.min(DURATION,s.expiresAt-System.currentTimeMillis()-500);if(duration<=0||!Settings.canDrawOverlays(context))return false;
  try{FrameLayout host=new FrameLayout(context);boolean animate=android.animation.ValueAnimator.areAnimatorsEnabled();
   boolean rainfall=effect&&s.rain&&animate;if(rainfall){drops=new Drops(context,s.rate);host.addView(drops,new FrameLayout.LayoutParams(-1,-1));}
   LinearLayout card=new LinearLayout(context);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(18),dp(12),dp(18),dp(12));GradientDrawable bg=new GradientDrawable();bg.setColor(0xf50a192b);bg.setCornerRadius(dp(14));bg.setStroke(dp(1),0xff61d7e7);card.setBackground(bg);
   Typeface brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
   LinearLayout header=new LinearLayout(context);header.setGravity(Gravity.CENTER_VERTICAL);ImageView logo=new ImageView(context);logo.setImageResource(R.drawable.ic_monitor);LinearLayout.LayoutParams icon=new LinearLayout.LayoutParams(dp(20),dp(20));icon.setMarginEnd(dp(8));header.addView(logo,icon);card.addView(header);line(header,demo?"TESTE FICTÍCIO · LIBERDADE, SP":"MONITOR GLOBAL · LIBERDADE, SP",16,0xff70dce8,brand);
   line(card,s.title,24,Color.WHITE,brand);if(s.state.equals("now"))line(card,s.rateText,17,0xffd9eff5,Typeface.DEFAULT);
   line(card,s.amountText,17,0xffd9eff5,Typeface.DEFAULT);if(!s.state.equals("dry"))line(card,s.stopText,15,0xffbfd1df,Typeface.DEFAULT);
   java.text.SimpleDateFormat fmt=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);fmt.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));
   line(card,"Rainbow Weather · consulta "+fmt.format(new java.util.Date(s.at)),13,0xffbfd1df,Typeface.DEFAULT);line(card,"Estimativa para um ponto da Liberdade · sujeita a mudanças",12,0xffa9c1cd,Typeface.DEFAULT);
   FrameLayout.LayoutParams box=new FrameLayout.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),-2,Gravity.TOP|Gravity.RIGHT);box.setMargins(rainfall?dp(24):0,rainfall?dp(28):0,rainfall?dp(28):0,0);host.addView(card,box);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(rainfall?-1:box.width,rainfall?-1:WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|(rainfall?Gravity.LEFT:Gravity.RIGHT);p.x=rainfall?0:dp(28);p.y=rainfall?0:dp(28);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(host,p);current=host;
   if(animate){host.setAlpha(0);card.setTranslationY(-dp(10));host.animate().alpha(1).setDuration(250).start();card.animate().translationY(0).setDuration(250).start();}
   main.postDelayed(()->{if(current!=host)return;if(!animate){hide();return;}if(drops!=null)drops.stop();host.animate().alpha(0).setDuration(250).withEndAction(()->{if(current==host)hide();}).start();},duration+250);return true;
  }catch(RuntimeException e){hide();Prefs.status(context,"Chuva: confira a permissão de exibição sobre outros aplicativos.");return false;}
 }
 private void line(LinearLayout card,String text,int size,int color,Typeface font){TextView t=new TextView(context);t.setText(text);t.setTextSize(size);t.setTextColor(color);t.setTypeface(font);t.setMaxLines(2);card.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 void hide(){main.removeCallbacksAndMessages(null);if(drops!=null){drops.stop();drops=null;}if(current!=null){current.animate().cancel();try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}}
 static final class Drops extends View {
  private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final float[] x,y,speed,length;private final long born=SystemClock.uptimeMillis();private boolean running;
  private final Runnable frame=()->invalidate();
  Drops(Context c,double rate){super(c);int n=rate<2.5?20:rate<7.5?32:48;x=new float[n];y=new float[n];speed=new float[n];length=new float[n];java.util.Random r=new java.util.Random(718);for(int i=0;i<n;i++){x[i]=r.nextFloat();y[i]=r.nextFloat();speed[i]=.18f+r.nextFloat()*.2f;length[i]=.014f+r.nextFloat()*.014f;}paint.setColor(0xb8b9edff);paint.setStrokeWidth(Math.max(2,2*c.getResources().getDisplayMetrics().density));paint.setStrokeCap(Paint.Cap.ROUND);}
  @Override protected void onAttachedToWindow(){super.onAttachedToWindow();running=true;invalidate();}
  @Override protected void onDetachedFromWindow(){stop();super.onDetachedFromWindow();}
  void stop(){running=false;removeCallbacks(frame);}
  @Override protected void onDraw(Canvas c){if(!running)return;long age=SystemClock.uptimeMillis()-born;if(age>DURATION+250){stop();return;}float seconds=age/1000f,w=getWidth(),h=getHeight();for(int i=0;i<x.length;i++){float yy=((y[i]+seconds*speed[i])%1.08f-.04f)*h,xx=(x[i]*w+seconds*12)%Math.max(1,w);c.drawLine(xx,yy,xx-5,yy+length[i]*h,paint);}removeCallbacks(frame);postDelayed(frame,34);}
 }
}

package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Informational card when a requested result is empty or unavailable. Never simulates a quake. */
final class VoiceStatusOverlay {
 static final long DURATION=12000L;
 private final Context context;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private View current;
 VoiceStatusOverlay(Context context){this.context=context;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 private TextView text(String value,int size,int color,boolean strong){
  TextView t=new TextView(context);t.setText(value);t.setTextSize(size);t.setTextColor(color);
  if(strong)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
  return t;
 }
 boolean show(String title,String body){
  hide();
  if(!Settings.canDrawOverlays(context))return false;
  try{
   LinearLayout card=new LinearLayout(context);card.setOrientation(LinearLayout.VERTICAL);
   card.setPadding(dp(16),dp(14),dp(16),dp(16));
   GradientDrawable background=new GradientDrawable();
   background.setColor(0xff081b30);background.setCornerRadius(dp(12));
   background.setStroke(dp(2),0xff39c8dd);card.setBackground(background);
   card.addView(text("MONITOR GLOBAL  ·  CONSULTA POR VOZ",14,0xff63e6f2,true));
   TextView heading=text(title,20,Color.WHITE,true);
   LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,-2);hp.topMargin=dp(9);card.addView(heading,hp);
   TextView details=text(body,15,0xffc2d9e1,false);
   LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,-2);bp.topMargin=dp(8);card.addView(details,bp);
   int screen=context.getResources().getDisplayMetrics().widthPixels;
   WindowManager.LayoutParams params=new WindowManager.LayoutParams(
    Math.min(dp(420),screen*46/100),-2,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    PixelFormat.TRANSLUCENT);
   params.gravity=Gravity.BOTTOM|Gravity.RIGHT;
   params.x=dp(32);
   params.y=dp(32);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(card,params);
   current=card;
   if(android.animation.ValueAnimator.areAnimatorsEnabled()){
    card.setAlpha(0f);card.animate().alpha(1f).setDuration(250).start();
   }
   handler.postDelayed(()->{if(current==card)hide();},DURATION);
   return true;
  }catch(RuntimeException e){hide();return false;}
 }
 void hide(){
  handler.removeCallbacksAndMessages(null);
  if(current!=null){
   current.animate().cancel();
   try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}
   current=null;
  }
 }
}

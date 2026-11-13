package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;

/** Voice status HUD: same native header/body/footer as Brent and weather cards. */
final class VoiceStatusOverlay {
 static final long DURATION=12000L;
 private final Context context;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private View current;
 VoiceStatusOverlay(Context context){this.context=context;}
 private int dp(int n){return TvCardStyle.dp(context,n);}

 boolean show(String title,String body){return show(title,body,DURATION);}
 boolean show(String title,String body,long duration){
  hide();
  if(!Settings.canDrawOverlays(context))return false;
  try{
   Typeface brand=TvCardStyle.brand(context);
   LinearLayout card=new LinearLayout(context);
   card.setOrientation(LinearLayout.VERTICAL);
   card.setBackground(TvCardStyle.panel(context,TvCardStyle.BODY));

   LinearLayout header=TvCardStyle.header(context);
   header.addView(TvCardStyle.label(context,"MONITOR GLOBAL  /  CONSULTA POR VOZ",15,TvCardStyle.BODY,brand,2));
   card.addView(header,new LinearLayout.LayoutParams(-1,-2));

   LinearLayout content=TvCardStyle.body(context);
   content.addView(TvCardStyle.label(context,title,23,TvCardStyle.WHITE,brand,3));
   LinearLayout.LayoutParams details=new LinearLayout.LayoutParams(-1,-2);
   details.topMargin=dp(8);
   content.addView(TvCardStyle.label(context,body,15,TvCardStyle.MUTED,Typeface.DEFAULT,5),details);
   card.addView(content,new LinearLayout.LayoutParams(-1,-2));

   LinearLayout footer=TvCardStyle.footer(context);
   footer.addView(TvCardStyle.label(context,"CONSULTA SOB DEMANDA · NÃO É NOVO ALERTA",12,TvCardStyle.MUTED,brand,2));
   card.addView(footer,new LinearLayout.LayoutParams(-1,-2));
   card.setContentDescription("Monitor Global, consulta por voz. "+title+". "+body);

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
   CardMotion.enter(card,context);
   handler.postDelayed(()->{if(current==card)CardMotion.exit(card,context,()->{if(current==card)hide();});},Math.max(1200L,Math.min(duration,60000L)));
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

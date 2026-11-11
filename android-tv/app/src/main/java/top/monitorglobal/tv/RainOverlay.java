package top.monitorglobal.tv;

import android.content.Context;
import android.os.*;
import android.view.*;
import android.widget.FrameLayout;
import android.graphics.PixelFormat;
import android.provider.Settings;
import java.util.function.BooleanSupplier;

/** Silent weather/rain newsroom banner. The forecast and hour slots belong to
 * RainMonitor; only the old bottom-right card presentation is replaced.
 */
final class RainOverlay {
 static final long DURATION=12000L,WEATHER_DURATION=15000L;
 private final Context context;
 private final Banner banner;
 private View current;
 private PreviewRain previewRain;
 private FrameLayout effectHost; // Rain sprites live BEHIND the full-width ticker.
 private Runnable completed;
 private int generation;
 RainOverlay(Context c){context=c;banner=new Banner(c);}
 boolean showing(){return current!=null;}
 void satelliteSource(java.util.function.Supplier<WeatherSatelliteClient.Frame> source){if(current instanceof ViewGroup){ViewGroup group=(ViewGroup)current;for(int i=0;i<group.getChildCount();i++)if(group.getChildAt(i) instanceof TvBroadcastInfoView)((TvBroadcastInfoView)group.getChildAt(i)).satelliteSource(source);}}
 void refreshBriefing(){
  if(current instanceof ViewGroup){
   ViewGroup group=(ViewGroup)current;
   for(int i=0;i<group.getChildCount();i++){
    View child=group.getChildAt(i);
    if(child instanceof TvBroadcastInfoView)((TvBroadcastInfoView)child).refreshBriefing();
   }
  }
 }
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo){return show(rain,effect,demo,null);}
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather){return show(rain,effect,demo,weather,false);}
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview){
  return show(rain,effect,demo,weather,stormPreview,null);
 }
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,Runnable onCompleted){
  return show(rain,effect,demo,weather,stormPreview,onCompleted,null,false);
 }
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,
              Runnable onCompleted,BooleanSupplier satelliteReady){
  return showCard(rain,weather,effect,demo,stormPreview,onCompleted,satelliteReady,true);
 }
 boolean showRain(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,Runnable onCompleted){
  return showCard(rain,weather,effect,demo,stormPreview,onCompleted,null);
 }
 private boolean showCard(RainForecast.Summary rain,WeatherForecast.Summary weather,boolean effect,boolean demo,
                          boolean stormPreview,Runnable onCompleted,BooleanSupplier satelliteReady,boolean hourlyCard){
  hide();
  long expiry=weather==null?(rain==null?0:rain.expiresAt):rain==null?weather.expiresAt:Math.min(weather.expiresAt,rain.expiresAt);
  long max=hourlyCard&&weather!=null?WEATHER_DURATION:DURATION;
  long duration=demo?max:Math.min(max,expiry-System.currentTimeMillis()-500);
  if(duration<=0||!Settings.canDrawOverlays(context))return false;
  // Retain the existing optional rain atmosphere, but put its transparent
  // full-screen effect window BELOW the news strip, so no text is obscured.
  if(effect&&rain!=null&&rain.rain&&android.animation.ValueAnimator.areAnimatorsEnabled()){
   boolean preview=demo&&stormPreview;
   previewRain=new PreviewRain(context,preview?WeatherPreviewOptions.style(context):2,
    preview?WeatherPreviewOptions.level(context):RainVisualPolicy.level(rain.rate,weather!=null&&weather.stormForecast));
   effectHost=new FrameLayout(context);
   effectHost.addView(previewRain,new FrameLayout.LayoutParams(-1,-1));
   WindowManager.LayoutParams screen=new WindowManager.LayoutParams(-1,-1,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    PixelFormat.TRANSLUCENT);
   screen.gravity=Gravity.TOP|Gravity.LEFT;
   try{context.getSystemService(WindowManager.class).addView(effectHost,screen);}
   catch(RuntimeException error){stopEffect();}
  }
  final int token=++generation;
  completed=onCompleted;
  boolean shown=banner.showWeather(rain,weather,demo,duration,()->{
   if(generation!=token)return;
   current=null;stopEffect();
   if(satelliteReady!=null)satelliteReady.getAsBoolean();
   Runnable done=completed;completed=null;
   if(done!=null)done.run();
  });
  if(!shown){completed=null;stopEffect();return false;}
  current=banner.activeView();return true;
 }
 private void stopEffect(){
  if(previewRain!=null){previewRain.stop();previewRain=null;}
  if(effectHost!=null){
   try{context.getSystemService(WindowManager.class).removeView(effectHost);}
   catch(RuntimeException ignored){}
   effectHost=null;
  }
 }
 void hide(){
  generation++;completed=null;
  banner.hide();current=null;stopEffect();
 }
}

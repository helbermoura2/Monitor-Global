package top.monitorglobal.tv;

import android.content.Context;
import android.os.*;
import android.view.*;
import java.util.function.BooleanSupplier;

/** Silent weather/rain newsroom banner. The forecast and hour slots belong to
 * RainMonitor; only the old bottom-right card presentation is replaced.
 */
final class RainOverlay {
 static final long DURATION=12000L;
 private final Context context;
 private final Banner banner;
 private View current;
 private PreviewRain previewRain; // No weather visual is ever painted over the news ticker.
 private Runnable completed;
 private int generation;
 RainOverlay(Context c){context=c;banner=new Banner(c);}
 boolean showing(){return current!=null;}
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
  return show(rain,effect,demo,weather,stormPreview,onCompleted,null);
 }
 boolean show(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,
              Runnable onCompleted,BooleanSupplier satelliteReady){
  return showCard(rain,weather,demo,onCompleted,satelliteReady);
 }
 boolean showRain(RainForecast.Summary rain,boolean effect,boolean demo,WeatherForecast.Summary weather,boolean stormPreview,Runnable onCompleted){
  return showCard(rain,weather,demo,onCompleted,null);
 }
 private boolean showCard(RainForecast.Summary rain,WeatherForecast.Summary weather,boolean demo,
                          Runnable onCompleted,BooleanSupplier satelliteReady){
  hide();
  long expiry=weather==null?(rain==null?0:rain.expiresAt):rain==null?weather.expiresAt:Math.min(weather.expiresAt,rain.expiresAt);
  long max=weather!=null&&satelliteReady!=null?DURATION+750:DURATION;
  long duration=demo?DURATION:Math.min(max,expiry-System.currentTimeMillis()-500);
  if(duration<=0)return false;
  final int token=++generation;
  completed=onCompleted;
  boolean shown=banner.showWeather(rain,weather,demo,duration,()->{
   if(generation!=token)return;
   current=null;
   if(satelliteReady!=null)satelliteReady.getAsBoolean();
   Runnable done=completed;completed=null;
   if(done!=null)done.run();
  });
  if(!shown){completed=null;return false;}
  current=banner.activeView();return true;
 }
 void hide(){
  generation++;completed=null;
  banner.hide();current=null;previewRain=null;
 }
}

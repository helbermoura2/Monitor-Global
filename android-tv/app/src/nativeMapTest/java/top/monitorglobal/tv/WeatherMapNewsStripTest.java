package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherMapNewsStripTest {
 @Test public void newsroomChromeUsesActualSourceAndMarksUnavailable(){
  Context c=RuntimeEnvironment.getApplication();WeatherMapNewsStrip view=new WeatherMapNewsStrip(c);
  long now=1800000000000L;view.radar(null,"SUDESTE",now);
  assertTrue(view.getContentDescription().toString().contains("SEM DADO"));
  assertFalse(view.getContentDescription().toString().contains("OBSERVADO"));
  RadarMapClient.Frame f=new RadarMapClient.Frame(now-28*60000L,Collections.singletonList("São Roque"),Collections.emptyList());
  view.radar(f,"SUDESTE",now);String text=view.getContentDescription().toString();
  assertTrue(text.contains("INPE / DECEA"));assertTrue(text.contains("há 28 min"));assertTrue(text.contains("dBZ não é taxa de chuva"));
  view.measure(View.MeasureSpec.makeMeasureSpec(960,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(126,View.MeasureSpec.EXACTLY));
  view.layout(0,0,960,126);
  Bitmap bitmap=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);
  try{view.draw(new Canvas(bitmap));assertEquals(Color.BLACK,bitmap.getPixel(350,33));int red=bitmap.getPixel(20,27);assertTrue(Color.red(red)>Color.green(red));}finally{bitmap.recycle();}
  view.radar(f,"SUDESTE",now+40*60000L);assertTrue(view.getContentDescription().toString().contains("DEFASADO"));
  view.satellite(null,"BRASIL",now);assertTrue(view.getContentDescription().toString().contains("SEM DADO"));assertTrue(view.getContentDescription().toString().contains("não mede intensidade da chuva"));
 }
 @Test public void effectsNeverInferRainFromRadarOrUnavailableData(){
  long now=1800000000000L;
  assertFalse(RainVisualPolicy.decorativeAllowed(null,false,now));
  RainForecast.Summary good=new RainForecast.Summary("now","moderada","Chuva estimada",5,3,"",now-60000L,now+60000L,true);
  assertTrue(RainVisualPolicy.decorativeAllowed(good,false,now));
  assertFalse(RainVisualPolicy.decorativeAllowed(good,false,now+60000L));
  assertTrue(RainVisualPolicy.decorativeAllowed(good,true,now+60000L));
  RainForecast.Summary unknown=new RainForecast.Summary("evidence","gauge","Chuva medida",Double.NaN,Double.NaN,"",now-60000L,now+60000L,false);
  assertFalse(RainVisualPolicy.decorativeAllowed(unknown,false,now));
 }
}

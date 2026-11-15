package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import static org.junit.Assert.*;

/** Screenshots of the same modeled condition at two local times must differ by sun/moon. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PhoneDaylightArtworkTest {
 private static long saoPaulo(int hour){
  return ZonedDateTime.of(2026,11,15,hour,29,0,0,ZoneId.of("America/Sao_Paulo"))
   .toInstant().toEpochMilli();
 }
 private static Bitmap paint(Context context,String condition,long at){
  PhoneWeatherArt art=new PhoneWeatherArt(context,condition,at);
  art.layout(0,0,150,126);
  Bitmap result=Bitmap.createBitmap(150,126,Bitmap.Config.ARGB_8888);
  art.draw(new Canvas(result));
  return result;
 }
 @Test public void partlyCloudyNightNeverDisplaysTheYellowDaytimeSun(){
  Context context=RuntimeEnvironment.getApplication();
  Bitmap noon=paint(context,"PartlyCloudy",saoPaulo(12));
  Bitmap night=paint(context,"PartlyCloudy",saoPaulo(3));
  try {
   // Above the cloud, at a point that lies in the original daytime sun.
   int day=noon.getPixel(92,20),dark=night.getPixel(92,20);
   assertTrue("daytime artwork retains its gold sun",Color.red(day)>Color.blue(day)+35);
   assertTrue("night artwork must not retain the gold sun",Color.red(dark)<=Color.blue(dark)+35);
   assertNotEquals("sun and moon illustrations must be visibly different",day,dark);
  }finally{noon.recycle();night.recycle();}
 }
}

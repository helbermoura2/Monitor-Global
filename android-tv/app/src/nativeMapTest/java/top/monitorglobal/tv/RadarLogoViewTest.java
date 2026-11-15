package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RadarLogoViewTest {
 @Test public void argosEyeKeepsCenterAnd7200MsSweep(){
  Context c=RuntimeEnvironment.getApplication();RadarLogoView view=new RadarLogoView(c);
  view.layout(0,0,128,128);
  Bitmap image=Bitmap.createBitmap(128,128,Bitmap.Config.ARGB_8888);
  view.setSweepDegrees(0);view.draw(new Canvas(image));
  assertTrue("cyan center remains visible",android.graphics.Color.green(image.getPixel(64,64))>180);
  int bronze=0;
  for(int y=20;y<110;y++)for(int x=0;x<128;x++){
   int px=image.getPixel(x,y);
   if(android.graphics.Color.alpha(px)>100 && android.graphics.Color.red(px)>120
      && android.graphics.Color.green(px)>80 && android.graphics.Color.blue(px)<180) bronze++;
  }
  assertTrue("gold eye outline is present",bronze>50);
  view.setSweepDegrees(90);view.draw(new Canvas(image));
  assertEquals(90f,view.getSweepDegrees(),0.01f);
  image.recycle();
 }
}

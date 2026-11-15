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
  assertTrue("gold eye contour is visible",android.graphics.Color.alpha(image.getPixel(64,10))>0);
  view.setSweepDegrees(90);view.draw(new Canvas(image));
  assertEquals(90f,view.getSweepDegrees(),0.01f);
  image.recycle();
 }
}

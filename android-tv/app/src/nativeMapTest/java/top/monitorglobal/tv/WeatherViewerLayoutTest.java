package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.view.*;
import android.widget.*;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.io.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w960dp-h540dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherViewerLayoutTest {
 @Test public void mapGetsNearlyAllAvailableHeightAtCompactTvSize() throws Exception{
  for(InfraredPlan.Scope scope:Arrays.asList(InfraredPlan.BRAZIL,InfraredPlan.SOUTHEAST)){
   Context c=RuntimeEnvironment.getApplication();
   Bitmap b=Bitmap.createBitmap(1024,scope.height,Bitmap.Config.ARGB_8888);
   b.eraseColor(0xff295866);
   WeatherSatelliteClient.Frame f=new WeatherSatelliteClient.Frame(b,null,1800000000000L,scope,Collections.emptyList());
   WeatherSatelliteCard card=new WeatherSatelliteCard(c,f,true);
   try{
    int w=912,h=380;
    card.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
    card.layout(0,0,w,h);
    ImageView map=(ImageView)card.getChildAt(0);
    assertTrue("Map viewport must use at least 78% of width",map.getWidth()>=w*.78);
    assertTrue("Map viewport must use at least 95% of available height",map.getHeight()>=h*.95);
    RectF r=new RectF(0,0,b.getWidth(),b.getHeight());map.getImageMatrix().mapRect(r);
    assertTrue("Actual image must fill height, not a tiny thumbnail",r.height()>=h*.9);
    assertTrue("Map is not cropped",r.width()<=map.getWidth()+1&&r.height()<=map.getHeight()+1);
    Bitmap rendered=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);
    try{card.draw(new Canvas(rendered));try(FileOutputStream out=new FileOutputStream("/tmp/argos-weather-layout-"+scope.name+".png")){assertTrue(rendered.compress(Bitmap.CompressFormat.PNG,100,out));}}finally{rendered.recycle();}
   }finally{card.clear();f.close();}
  }
 }
}

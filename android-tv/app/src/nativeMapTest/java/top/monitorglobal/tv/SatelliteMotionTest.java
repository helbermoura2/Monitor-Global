package top.monitorglobal.tv;
import android.graphics.Bitmap;
import android.graphics.Color;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class SatelliteMotionTest {
 private static int pattern(int x,int y){
  int n=x*0x45d9f3b ^ y*0x119de1f3 ^ (x*y)*0x27d4eb2d;
  n=(n^(n>>>16))*0x45d9f3b;n^=n>>>16;
  int v=(n>>>24)&255;return Color.rgb(v,v,v);
 }
 private Bitmap image(int shiftX,int shiftY){
  Bitmap b=Bitmap.createBitmap(InfraredPlan.WIDTH,InfraredPlan.SOUTHEAST.height,Bitmap.Config.ARGB_8888);
  int w=b.getWidth(),h=b.getHeight();int[] pixels=new int[w*h];
  for(int y=0;y<h;y++)for(int x=0;x<w;x++)pixels[y*w+x]=pattern(x-shiftX,y-shiftY);
  b.setPixels(pixels,0,w,0,0,w,h);return b;
 }
 @Test public void detectsKnownCloudPatternTranslationAndDirection(){
  Bitmap older=image(0,0),newer=image(8,4);
  try{
   SatelliteMotion.Result result=SatelliteMotion.analyze(older,newer,1_000_000L,5_200_000L,InfraredPlan.SOUTHEAST);
   assertNotNull(result);assertEquals("SE",result.direction);assertTrue(result.speedKmh>0);
   assertTrue(result.matched>=4);assertTrue(result.confidence>0);
  }finally{older.recycle();newer.recycle();}
 }
 @Test public void identicalFramesAreReportedAsStationary(){
  Bitmap older=image(0,0),newer=image(0,0);
  try{
   SatelliteMotion.Result result=SatelliteMotion.analyze(older,newer,1_000_000L,1_600_000L,InfraredPlan.SOUTHEAST);
   assertNotNull(result);assertTrue(result.speedKmh<2.0);
  }finally{older.recycle();newer.recycle();}
 }
 @Test public void tickerSpeedOverrideKeepsTheDefaultForOtherBanners(){
  assertEquals(40f,BroadcastVisuals.tickerOffset(1000L,1000f,true),.001f);
  assertEquals(65f,BroadcastVisuals.tickerOffset(1000L,1000f,true,65f),.001f);
 }
 @Test public void rejectsInvalidTimeAndDifferentImageSizes(){
  Bitmap older=image(0,0),newer=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);
  try{
   assertNull(SatelliteMotion.analyze(older,older,2_000_000L,1_000_000L,InfraredPlan.SOUTHEAST));
   assertNull(SatelliteMotion.analyze(older,newer,1_000_000L,1_600_000L,InfraredPlan.SOUTHEAST));
   assertNull(SatelliteMotion.analyze(older,older,1_000_000L,1_000_000L+91*60000L,InfraredPlan.SOUTHEAST));
  }finally{older.recycle();newer.recycle();}
 }
}

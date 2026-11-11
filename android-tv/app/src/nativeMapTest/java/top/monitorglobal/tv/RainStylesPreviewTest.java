package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.os.*;import android.view.*;
import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RainStylesPreviewTest {
 private Context c;
 private Object field(Object o,String key)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true);}
 @After public void reset(){Prefs.get(c).edit().clear().commit();}
 private RainForecast.Summary sample(){return new RainForecast.Summary("now","moderada","Cenário fictício",4,2,"Simulação",System.currentTimeMillis(),System.currentTimeMillis()+600000,true);}
 @Test public void allStylesAndIntensitiesDrawAndReleaseTheirSmallReusableSprites()throws Exception{
  for(int style=0;style<3;style++){int previous=-1;
   for(int level=0;level<4;level++){
    Prefs.get(c).edit().putInt("previewRainStyle",style).putInt("previewRainLevel",level).commit();RainOverlay overlay=new RainOverlay(c);
    try{assertTrue(overlay.show(sample(),true,true,null,true));PreviewRain rain=(PreviewRain)field(overlay,"previewRain");assertNotNull(rain);
     int glass=(Integer)field(rain,"glassCount"),air=(Integer)field(rain,"airCount");assertTrue(glass+air>previous);previous=glass+air;
     if(style==0)assertEquals(0,air);else if(style==1)assertEquals(0,glass);else assertTrue(glass>0&&air>0);
     View host=(View)field(overlay,"effectHost");host.measure(View.MeasureSpec.makeMeasureSpec(1280,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(720,View.MeasureSpec.EXACTLY));host.layout(0,0,1280,720);Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(300));host.measure(View.MeasureSpec.makeMeasureSpec(1280,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(720,View.MeasureSpec.EXACTLY));host.layout(0,0,1280,720);assertTrue("preview must be attached before drawing",(Boolean)field(rain,"running"));
     Bitmap result=Bitmap.createBitmap(1280,720,Bitmap.Config.ARGB_8888);rain.draw(new Canvas(result));int visible=0;for(int y=0;y<720;y+=3)for(int x=0;x<1280;x+=3)if(Color.alpha(result.getPixel(x,y))>0)visible++;
     assertTrue("rain must be visible for style "+style+" level "+level+" visible="+visible+" size="+rain.getWidth()+"x"+rain.getHeight(),visible>20);result.recycle();
     Bitmap bead=(Bitmap)field(rain,"bead"),particle=(Bitmap)field(rain,"air");assertTrue(bead.getAllocationByteCount()+particle.getAllocationByteCount()<65536);
     overlay.hide();Shadows.shadowOf(Looper.getMainLooper()).idle();assertNull(field(overlay,"previewRain"));assertFalse((Boolean)field(rain,"running"));assertTrue(bead.isRecycled());assertTrue(particle.isRecycled());
    }finally{overlay.hide();}
   }
  }
 }
 @Test public void sceneAndCombinedRainCoverAllFourQuadrants()throws Exception{
  for(int style:new int[]{1,2}){
   Prefs.get(c).edit().putInt("previewRainStyle",style).putInt("previewRainLevel",2).commit();RainOverlay overlay=new RainOverlay(c);
   try{assertTrue(overlay.show(sample(),true,true,null,true));View host=(View)field(overlay,"effectHost");host.measure(View.MeasureSpec.makeMeasureSpec(1280,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(720,View.MeasureSpec.EXACTLY));host.layout(0,0,1280,720);
    Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(300));host.measure(View.MeasureSpec.makeMeasureSpec(1280,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(720,View.MeasureSpec.EXACTLY));host.layout(0,0,1280,720);
    Bitmap image=Bitmap.createBitmap(1280,720,Bitmap.Config.ARGB_8888);((View)field(overlay,"previewRain")).draw(new Canvas(image));
    int[] visible=new int[4];for(int y=0;y<720;y+=3)for(int x=0;x<1280;x+=3)if(Color.alpha(image.getPixel(x,y))>0)visible[(y<360?0:2)+(x<640?0:1)]++;
    for(int q=0;q<4;q++)assertTrue("rain in quadrant "+q+" style "+style,visible[q]>10);image.recycle();
   }finally{overlay.hide();}
  }
 }
 @Test public void oldLightningPreferenceCannotAddAnyEffect()throws Exception{
  Prefs.get(c).edit().putBoolean("previewLightning",true).commit();RainOverlay overlay=new RainOverlay(c);
  try{assertTrue(overlay.show(sample(),true,true,null,true));assertNotNull(field(overlay,"previewRain"));}finally{overlay.hide();}
 }
 @Test public void realForecastUsesApprovedCombinationIndependentOfPreview()throws Exception{
  RainOverlay overlay=new RainOverlay(c);
  try{assertTrue(overlay.show(sample(),true,false,null,true));assertNotNull(field(overlay,"previewRain"));assertTrue((Integer)field(field(overlay,"previewRain"),"glassCount")>0);assertTrue((Integer)field(field(overlay,"previewRain"),"airCount")>0);}finally{overlay.hide();}
 }
 @Test public void invalidStoredSelectionsFallBackWithoutChangingTheRealRainMode(){
  Prefs.get(c).edit().putInt("previewRainStyle",99).putInt("previewRainLevel",-1).putInt("rainMode",0).commit();
  assertEquals(2,WeatherPreviewOptions.style(c));assertEquals(2,WeatherPreviewOptions.level(c));assertEquals(0,Prefs.get(c).getInt("rainMode",-1));
 }
 @Test public void disabledAnimationsDoNotAllocatePreviewSprites()throws Exception{
  java.lang.reflect.Method scale=android.animation.ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);scale.invoke(null,0f);RainOverlay overlay=new RainOverlay(c);
  try{assertTrue(overlay.show(sample(),true,true,null,true));assertNull(field(overlay,"previewRain"));assertNotNull(field(overlay,"current"));}finally{overlay.hide();scale.invoke(null,1f);}
 }
}

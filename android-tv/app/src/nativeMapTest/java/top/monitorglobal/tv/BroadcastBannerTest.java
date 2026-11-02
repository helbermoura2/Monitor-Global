package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.time.Instant;import java.util.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BroadcastBannerTest {
 private Context c;
 private Object field(Object o,String key)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
 private Alert alert(){return new Alert("test","earthquake","v","M6,0 · Local de demonstração","Profundidade: 10 km · USGS","earthquake",1600000000000L,1600000000000L,true);}
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();}
 @Test public void badgesDistinguishLiveHistoryAndFiction(){
  assertEquals("AO VIVO",new NewsBannerView(c,alert(),false,false).badgeLabel());
  assertEquals("REPLAY",new NewsBannerView(c,alert(),false,true).badgeLabel());
  assertEquals("TESTE",new NewsBannerView(c,alert(),true,false).badgeLabel());
  assertEquals("REPLAY",new NewsBannerView(c,List.of(alert()),"2026-10-30",false,true).badgeLabel());
 }
 @Test public void clockUsesBrasiliaAcrossMidnightRegardlessOfDeviceZone(){
  TimeZone previous=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"));assertEquals("00:05",NewsBannerView.formatClock(Instant.parse("2026-11-02T03:05:00Z").toEpochMilli()));assertEquals("23:59",NewsBannerView.formatClock(Instant.parse("2026-11-02T02:59:00Z").toEpochMilli()));}finally{TimeZone.setDefault(previous);}
 }
 @Test public void actualCanvasRestoresDarkPaletteRoundedCornersAndCurrentClock()throws Exception{
  Prefs.get(c).edit().putString("themeText","#ffffff").putInt("themeVersion",2).putString("themeBackground","#071724").putString("themeAccent","#38bdf8").commit();
  NewsBannerView view=new NewsBannerView(c,alert(),false,true);int top=(Integer)field(view,"mapSpace"),height=126+top;view.layout(0,0,960,height);view.startPresentation(android.os.SystemClock.uptimeMillis()-1000,false);
  Bitmap b=Bitmap.createBitmap(960,height,Bitmap.Config.ARGB_8888);view.draw(new Canvas(b));
  assertEquals(Color.rgb(7,23,36),b.getPixel(500,top+93));assertEquals(Color.rgb(191,24,39),b.getPixel(10,top+5));assertEquals(Color.rgb(191,24,39),b.getPixel(950,top+5));assertEquals(Color.rgb(191,24,39),b.getPixel(2,top+110));
  assertEquals(0,Color.alpha(b.getPixel(0,top+24)));assertEquals(0,Color.alpha(b.getPixel(0,top+125)));assertEquals(Color.WHITE,field(view,"foreground"));
  assertEquals(NewsBannerView.formatClock(System.currentTimeMillis()),field(view,"clockText"));
  int blue=0;for(int y=top+27;y<top+65;y++)for(int x=884;x<922;x++){int p=b.getPixel(x,y);if(Color.blue(p)>Color.red(p)+50)blue++;}assertTrue("own radar logo must be visible",blue>50);
  try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-tv-banner-1039.png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}b.recycle();
 }
}

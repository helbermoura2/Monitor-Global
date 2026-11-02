package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.time.Instant;import java.util.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BroadcastBannerTest {
 private Context c;
 private Object field(Object o,String key)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
 private Alert alert(){return new Alert("test","earthquake","v","M6,0 · Local de demonstração","Profundidade: 10 km · USGS","earthquake",1600000000000L,1600000000000L,true);}
 private Bitmap render(NewsBannerView view,long elapsed)throws Exception{int space=(Integer)field(view,"mapSpace");view.layout(0,0,960,126+space);view.startPresentation(android.os.SystemClock.uptimeMillis()-elapsed,false);Bitmap b=Bitmap.createBitmap(960,126+space,Bitmap.Config.ARGB_8888);view.draw(new Canvas(b));Bitmap crop=Bitmap.createBitmap(b,0,space,960,126);if(crop!=b)b.recycle();return crop;}
 private void export(Bitmap b,String name)throws Exception{try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-tv-banner-1042-"+name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}}
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();}
 @Test public void badgesDistinguishLiveHistoryAndFiction(){
  assertEquals("AO VIVO",new NewsBannerView(c,alert(),false,false).badgeLabel());assertEquals("REPLAY",new NewsBannerView(c,alert(),false,true).badgeLabel());assertEquals("TESTE",new NewsBannerView(c,alert(),true,false).badgeLabel());assertEquals("REPLAY",new NewsBannerView(c,List.of(alert()),"2026-10-30",false,true).badgeLabel());
 }
 @Test public void clockUsesBrasiliaAcrossMidnightRegardlessOfDeviceZone(){TimeZone previous=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"));assertEquals("00:05",NewsBannerView.formatClock(Instant.parse("2026-11-02T03:05:00Z").toEpochMilli()));assertEquals("23:59",NewsBannerView.formatClock(Instant.parse("2026-11-02T02:59:00Z").toEpochMilli()));}finally{TimeZone.setDefault(previous);}}
 @Test public void joinedStripsHaveNoTransparentSeamAndBadgesFitTheirLabels()throws Exception{
  NewsBannerView view=new NewsBannerView(c,alert(),true,false);Bitmap b=render(view,1000);
  try{for(int y=24;y<126;y++)assertEquals("continuous body and footer",255,Color.alpha(b.getPixel(500,y)));assertEquals("no logo divider",Color.rgb(7,23,36),b.getPixel(845,60));
   assertTrue((Float)field(view,"badgeWidth")<90);assertEquals("no excess red before TESTE",0,Color.alpha(b.getPixel(850,10)));assertEquals(0,Color.alpha(b.getPixel(210,10)));
   assertEquals(NewsBannerView.formatClock(System.currentTimeMillis()),field(view,"clockText"));
   int white=0;for(int y=121;y<125;y++)for(int x=10;x<80;x++){int p=b.getPixel(x,y);if(Color.green(p)>200&&Color.blue(p)>200)white++;}assertEquals("no Brasilia subtitle under clock",0,white);export(b,"quake");
  }finally{b.recycle();}
 }
 private double whiteCenter(Bitmap b,int top,int bottom){int left=105,right=0,count=0;for(int y=top;y<bottom;y++)for(int x=8;x<105;x++){int p=b.getPixel(x,y);if(Color.red(p)>220&&Color.green(p)>220&&Color.blue(p)>220){left=Math.min(left,x);right=Math.max(right,x);count++;}}assertTrue("text must be visible",count>20);return(left+right)/2.0;}
 @Test public void tsunamiAndBulletinShareTheSameCenter()throws Exception{
  Alert a=new Alert("test","tsunami","v","Costas citadas no boletim oficial","PTWC","warning",1600000000000L,1600000000000L,true);Bitmap b=render(new NewsBannerView(c,a,true,false),1000);
  try{assertEquals(56.5,whiteCenter(b,43,63),2);assertEquals(56.5,whiteCenter(b,68,82),2);export(b,"tsunami");}finally{b.recycle();}
 }
 @Test public void radarIsLargeAndAnimatedWhileReducedMotionStopsTheSweep()throws Exception{
  java.lang.reflect.Method scale=android.animation.ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);
  try{for(boolean motion:new boolean[]{true,false}){scale.invoke(null,motion?1f:0f);NewsBannerView view=new NewsBannerView(c,alert(),false,true);Bitmap a=render(view,1000),b=render(view,1600);
   try{int changed=0,blue=0;for(int y=25;y<97;y++)for(int x=867;x<939;x++){if(a.getPixel(x,y)!=b.getPixel(x,y))changed++;int p=a.getPixel(x,y);if(Color.blue(p)>Color.red(p)+50)blue++;}assertTrue("large visible radar",blue>500);if(motion)assertTrue(changed>100);else assertEquals(0,changed);}finally{a.recycle();b.recycle();}
  }}finally{scale.invoke(null,1f);}
 }
 @Test public void siteAndTelegramRemainCenteredWithBreathingRoom()throws Exception{
  NewsBannerView view=new NewsBannerView(c,alert(),false,true);
  for(long elapsed:new long[]{1000,9000}){Bitmap b=render(view,elapsed);try{int left=960,right=0,count=0;for(int y=103;y<124;y++)for(int x=730;x<960;x++){int p=b.getPixel(x,y);if(Color.red(p)>200&&Color.green(p)>200&&Color.blue(p)>200){left=Math.min(left,x);right=Math.max(right,x);count++;}}assertTrue(count>30);assertTrue("left padding",left>750);assertTrue("right padding",right<940);assertEquals(845,(left+right)/2.0,3);export(b,elapsed==1000?"site":"telegram");}finally{b.recycle();}}
 }
}

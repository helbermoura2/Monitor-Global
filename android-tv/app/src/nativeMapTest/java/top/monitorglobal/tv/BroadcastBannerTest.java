package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import java.time.Instant;import java.util.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BroadcastBannerTest {
 private Context c;
 private Object field(Object o,String key)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
 private Alert alert(){return new Alert("test","earthquake","v","M6,0 · Local de demonstração","Profundidade: 10 km · USGS","earthquake",1600000000000L,1600000000000L,true);}
 private Bitmap render(NewsBannerView view,long elapsed)throws Exception{int space=(Integer)field(view,"mapSpace");view.layout(0,0,960,126+space);view.startPresentation(android.os.SystemClock.uptimeMillis()-elapsed,false);Bitmap b=Bitmap.createBitmap(960,126+space,Bitmap.Config.ARGB_8888);view.draw(new Canvas(b));Bitmap crop=Bitmap.createBitmap(b,0,space,960,126);if(crop!=b)b.recycle();return crop;}
 private void export(Bitmap b,String name)throws Exception{try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-tv-banner-1044-"+name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}}
 @Before public void setup(){c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();}
 @Test public void badgesDistinguishLiveHistoryAndFiction(){
  assertEquals("AO VIVO",new NewsBannerView(c,alert(),false,false).badgeLabel());assertEquals("REPLAY",new NewsBannerView(c,alert(),false,true).badgeLabel());assertEquals("TESTE",new NewsBannerView(c,alert(),true,false).badgeLabel());assertEquals("AO VIVO",new NewsBannerView(c,List.of(alert()),"2026-10-30",false,true).badgeLabel());
  assertEquals("REPLAY",new NewsBannerView(c,List.of(alert()),"2026-10-30",true,true).badgeLabel());
  assertEquals("REPLAY",new NewsBannerView(c,List.of(alert()),"2026-10-30",true,false).badgeLabel());
 }
 @Test public void clockUsesBrasiliaAcrossMidnightRegardlessOfDeviceZone(){TimeZone previous=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"));assertEquals("00:05",NewsBannerView.formatClock(Instant.parse("2026-11-02T03:05:00Z").toEpochMilli()));assertEquals("23:59",NewsBannerView.formatClock(Instant.parse("2026-11-02T02:59:00Z").toEpochMilli()));}finally{TimeZone.setDefault(previous);}}
 @Test public void joinedStripsHaveNoTransparentSeamAndBadgesFitTheirLabels()throws Exception{
  NewsBannerView view=new NewsBannerView(c,alert(),true,false);Bitmap b=render(view,1000);
  try{for(int y=31;y<126;y++)assertEquals("continuous OLED body and ticker",255,Color.alpha(b.getPixel(500,y)));assertEquals("pure OLED black",Color.BLACK,b.getPixel(805,60));
   assertTrue("status panel is wide enough for broadcast framing",(Float)field(view,"badgeWidth")>=BroadcastVisuals.STATUS_MIN_WIDTH);assertEquals("gap before expanded status",0,Color.alpha(b.getPixel(780,10)));assertTrue("approved left red news panel",Color.red(b.getPixel(36,10))>Color.green(b.getPixel(36,10))*2);assertEquals("top labels stay separate",0,Color.alpha(b.getPixel(300,10)));
   assertEquals(NewsBannerView.formatClock(System.currentTimeMillis()),field(view,"clockText"));
   int white=0;for(int y=121;y<125;y++)for(int x=10;x<80;x++){int p=b.getPixel(x,y);if(Color.green(p)>200&&Color.blue(p)>200)white++;}assertEquals("no Brasilia subtitle under clock",0,white);export(b,"quake");
  }finally{b.recycle();}
 }
 private double coloredCenter(Bitmap b,int top,int bottom){int left=105,right=0,count=0;for(int y=top;y<bottom;y++)for(int x=18;x<118;x++){int p=b.getPixel(x,y);if(Color.red(p)>220&&Color.green(p)>60&&Color.blue(p)>60){left=Math.min(left,x);right=Math.max(right,x);count++;}}assertTrue("text must be visible",count>20);return(left+right)/2.0;}
 @Test public void tsunamiAndBulletinShareTheSameCenter()throws Exception{
  Alert a=new Alert("test","tsunami","v","Costas citadas no boletim oficial","PTWC","warning",1600000000000L,1600000000000L,true);Bitmap b=render(new NewsBannerView(c,a,true,false),1000);
  try{assertEquals(68,coloredCenter(b,43,63),3);assertEquals("tsunami caption stays aligned within optical tolerance",68.0,coloredCenter(b,68,82),6);export(b,"tsunami");}finally{b.recycle();}
 }
 @Test public void radarIsLargeAndAnimatedWhileReducedMotionStopsTheSweep()throws Exception{
  java.lang.reflect.Method scale=android.animation.ValueAnimator.class.getDeclaredMethod("setDurationScale",float.class);scale.setAccessible(true);
  try{for(boolean motion:new boolean[]{true,false}){scale.invoke(null,motion?1f:0f);NewsBannerView view=new NewsBannerView(c,alert(),false,true);Bitmap a=render(view,1000),b=render(view,1600);
   try{int changed=0,blue=0;for(int y=32;y<92;y++)for(int x=846;x<909;x++){if(a.getPixel(x,y)!=b.getPixel(x,y))changed++;int p=a.getPixel(x,y);if(Color.blue(p)>Color.red(p)+50)blue++;}assertTrue("full official animated eye remains visible",blue>100);if(motion)assertTrue(changed>15);else assertEquals(0,changed);}finally{a.recycle();b.recycle();}
  }}finally{scale.invoke(null,1f);}
 }
 @Test public void siteAndTelegramShareTheRightEdge()throws Exception{
  NewsBannerView view=new NewsBannerView(c,alert(),false,true);
  for(long elapsed:new long[]{1000,5100}){Bitmap b=render(view,elapsed);try{int left=960,right=0,count=0;for(int y=103;y<124;y++)for(int x=(int)OledNewsChrome.BRAND_PLATE_LEFT+2;x<(int)OledNewsChrome.RIGHT-2;x++){int p=b.getPixel(x,y);if(Color.red(p)>200&&Color.green(p)>200&&Color.blue(p)>200){left=Math.min(left,x);right=Math.max(right,x);count++;}}assertTrue(count>30);assertTrue("address ink remains inside grey footer",left>=OledNewsChrome.BRAND_PLATE_LEFT+3);assertTrue("site and Telegram inset by 35 coordinate units",right>=875&&right<=925);export(b,elapsed==1000?"site":"telegram");}finally{b.recycle();}}
 }
 @Test public void oledBackgroundPreservesEarthquakeMagnitudeWithoutOldNavyPanel()throws Exception{
  NewsBannerView normal=new NewsBannerView(c,alert(),true,false);Bitmap b=render(normal,1000);
  try{
   assertEquals("pure black main strip",Color.BLACK,b.getPixel(805,60));
   assertEquals("no floating upper boxes",0,Color.alpha(b.getPixel(500,12)));
   assertEquals("full left category rests on OLED black",Color.BLACK,b.getPixel(20,90));
   int ink=0;
   for(int y=37;y<88;y++)for(int x=38;x<105;x++){
    int pixel=b.getPixel(x,y);
    if(Color.red(pixel)>220&&Color.green(pixel)>60&&Color.green(pixel)<160)ink++;
   }
   assertTrue("magnitude stays readable",ink>100);
   assertTrue("clock block retains old information",Color.red(b.getPixel(32,100))>90);
   assertEquals("right overscan remains free",0,Color.alpha(b.getPixel(947,100)));
   export(b,"refined-oled");
  }finally{b.recycle();}
  NewsBannerView summary=new NewsBannerView(c,List.of(alert(),alert()),"2026-10-30",true,true);
  Bitmap frame=render(summary,BannerTimeline.SUMMARY_PAGE_MS+500);
  try{assertEquals(Color.BLACK,frame.getPixel(805,60));}finally{frame.recycle();}
 }
 @Test public void compactFooterKeepsTickerAndRotatingSiteTelegram()throws Exception{
  NewsBannerView view=new NewsBannerView(c,alert(),false,true);
  Bitmap site=render(view,1000),telegram=render(view,5100);
  try{
   int letters=0,changed=0;
   for(int y=103;y<124;y++)for(int x=112;x<(int)view.identityLeft(1000)-8;x++){
    int rgb=site.getPixel(x,y);
    if(Color.red(rgb)>200&&Color.green(rgb)>200&&Color.blue(rgb)>200)letters++;
   }
   for(int y=111;y<124;y++)for(int x=817;x<924;x++)
    if(site.getPixel(x,y)!=telegram.getPixel(x,y))changed++;
   assertTrue("all original ticker facts remain legible",letters>20);
   assertTrue("footer changes between website and Telegram",changed>20);
   assertEquals(OledNewsChrome.BRAND_PLATE_LEFT,view.identityLeft(1000),0.01);
   assertEquals(view.identityLeft(1000),view.identityLeft(5100),0.01);
   export(site,"site");export(telegram,"telegram");
  }finally{site.recycle();telegram.recycle();}
 }
 @Test public void dailyFooterDisplaysTelegramMagnitudeTotalsAndKeepsBrandMargin()throws Exception{
  DailySeismicTotals totals=new DailySeismicTotals("2026-11-14",190,0,2,15,173,false);
  NewsBannerView view=new NewsBannerView(c,List.of(alert()),"2026-11-14",false,true,totals);
  assertTrue(view.getContentDescription().toString().contains("190 eventos no dia"));
  Bitmap image=render(view,1000);
  try{
   int colored=0,columns=0;
   final int[] palette={0xff29d4f2,0xffff5c68,0xffffa04b,0xffffda54,0xff46df9b};
   float w=(view.identityLeft(1000)-120)/5f;
   for(int i=0;i<5;i++){
    int count=0;
    for(int y=104;y<=123;y++)for(int x=(int)(112+i*w);x<(int)(112+(i+1)*w);x++){
     int pixel=image.getPixel(x,y),c0=palette[i];
     if(Math.abs(Color.red(pixel)-Color.red(c0))<24&&Math.abs(Color.green(pixel)-Color.green(c0))<24&&Math.abs(Color.blue(pixel)-Color.blue(c0))<24)count++;
    }
    if(count>5)columns++;
    colored+=count;
   }
   assertEquals("All five count groups have colored numerals",5,columns);
   assertTrue("Full-day counters legible",colored>50);
   int safe=0;for(int y=104;y<=122;y++)for(int x=932;x<959;x++){int p=image.getPixel(x,y);if(Color.red(p)>125&&Color.green(p)>125&&Color.blue(p)>125)safe++;}
   assertEquals("No bright text enters TV right overscan margin",0,safe);
   export(image,"summary-totals");
  }finally{image.recycle();}
  NewsBannerView unavailable=new NewsBannerView(c,List.of(alert()),"2026-11-14",false,true);
  assertNull("Absent totals must preserve scrolling ticker",field(unavailable,"summaryTotals"));
 }
}


package top.monitorglobal.tv;
import android.content.*;import android.os.*;import android.view.WindowManager;import java.util.*;import java.util.concurrent.*;import java.util.concurrent.atomic.*;import org.json.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import org.robolectric.shadows.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi",instrumentedPackages={"top.monitorglobal.tv"}) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BrentDeliveryTest {
 Context c;
 @Before public void setup(){long target=java.time.Instant.parse("2026-11-11T12:30:00Z").toEpochMilli();ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(target-ShadowSystem.currentTimeMillis()));c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().putBoolean("brentHourly",false).commit();ShadowSettings.setCanDrawOverlays(true);Shadows.shadowOf((PowerManager)c.getSystemService(Context.POWER_SERVICE)).setIsInteractive(true);}
 Object field(Object o,String name)throws Exception{java.lang.reflect.Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(o);}
 JSONObject quote()throws Exception{return new JSONObject().put("version","tv-brent-v1").put("ok",true).put("marketOpen",true).put("symbol","BZ=F").put("currency","USD").put("source","Yahoo Finance").put("price",78.35).put("asOf",ShadowSystem.currentTimeMillis()-60000).put("previousClose",JSONObject.NULL);}
 void await(BrentMonitor m)throws Exception{for(int i=0;i<1000&&(Boolean)field(m,"busy");i++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();}assertFalse((Boolean)field(m,"busy"));}
 @Test public void manualQuoteSurvivesAutomaticDisabledPulse()throws Exception{
  List<String> messages=new ArrayList<>();BrentMonitor m=new BrentMonitor(c,()->true,this::quote);m.setFeedback(messages::add);
  try{
    AtomicInteger displayed=new AtomicInteger();m.setOnPresented(displayed::incrementAndGet);
    m.checkNow();await(m);assertTrue(m.showing());
    m.tick();assertTrue(m.showing());
    assertEquals(1,displayed.get());
    assertTrue(messages.stream().anyMatch(v->v.startsWith("REAL ·")));
   }finally{m.close();}
 }
 @Test public void failedProviderExplainsInsteadOfSilence()throws Exception{
  List<String> messages=new ArrayList<>();BrentMonitor m=new BrentMonitor(c,()->true,()->new JSONObject().put("ok",false).put("marketOpen",true).put("reason","source-unavailable"));m.setFeedback(messages::add);
  try{
    AtomicInteger displayed=new AtomicInteger();m.setOnPresented(displayed::incrementAndGet);
    m.checkNow();await(m);
    assertTrue("Voice/manual Brent must display a truthful no-quote banner",m.showing());
    assertEquals(1,displayed.get());
    assertTrue(messages.stream().anyMatch(v->v.contains("Consultando")));
    assertTrue(messages.stream().anyMatch(v->v.contains("sem cotação")));
    Object overlay=field(m,"overlay"),host=field(field(overlay,"banner"),"current");
    assertNotNull(host);
    android.view.View row=((android.view.ViewGroup)host).getChildAt(0);
    assertTrue(row instanceof TvBroadcastInfoView);
    assertTrue(row.getContentDescription().toString().contains("sem cotação confirmada"));
   }finally{m.close();}
 }
 @Test public void requestDuringAutomaticIoUsesSameResultAcrossHourBoundary()throws Exception{
  Prefs.get(c).edit().putBoolean("brentHourly",true).commit();CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger calls=new AtomicInteger();
  BrentMonitor m=new BrentMonitor(c,()->true,()->{calls.incrementAndGet();entered.countDown();release.await(5,TimeUnit.SECONDS);return quote();});
  try{m.tick();assertTrue(entered.await(2,TimeUnit.SECONDS));m.checkNow();ShadowSystemClock.advanceBy(java.time.Duration.ofMinutes(31));m.tick();release.countDown();await(m);assertEquals(1,calls.get());assertTrue(m.showing());}finally{release.countDown();m.close();}
 }
 @Test public void voiceBrentStartsTheOfficialMarketTarjaBeforeNetworkReturns()throws Exception{
  CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
  AtomicInteger shown=new AtomicInteger();
  BrentMonitor m=new BrentMonitor(c,()->true,()->{
   entered.countDown();release.await(5,TimeUnit.SECONDS);return quote();
  });
  m.setOnPresented(shown::incrementAndGet);
  try{
   m.checkNow();
   assertTrue("The official market banner must be visible immediately",m.showing());
   Object overlay=field(m,"overlay"),host=field(field(overlay,"banner"),"current");
   assertNotNull(host);
   WindowManager.LayoutParams layout=(WindowManager.LayoutParams)((android.view.View)host).getLayoutParams();
   assertTrue("Full-width, not a small Alexa card",layout.width>c.getResources().getDisplayMetrics().widthPixels*.8);
   android.view.View first=((android.view.ViewGroup)host).getChildAt(0);
   assertTrue(first instanceof TvBroadcastInfoView);
   assertTrue(first.getContentDescription().toString().contains("CONSULTANDO COTAÇÃO REAL"));
   assertTrue(entered.await(2,TimeUnit.SECONDS));
   release.countDown();await(m);
   assertTrue(m.showing());assertEquals(1,shown.get());
   Object finalHost=field(field(overlay,"banner"),"current");
   android.view.View finalRow=((android.view.ViewGroup)finalHost).getChildAt(0);
   assertTrue(finalRow instanceof TvBroadcastInfoView);
   assertTrue(finalRow.getContentDescription().toString().contains("US$ 78,35"));
   assertFalse(finalRow.getContentDescription().toString().contains("CONSULTANDO COTAÇÃO REAL"));
  }finally{release.countDown();m.close();}
 }
 @Test public void priorityBlockReturnsExplicitReasonWithoutSourceRequest()throws Exception{
  List<String> messages=new ArrayList<>();AtomicInteger calls=new AtomicInteger();BrentMonitor m=new BrentMonitor(c,()->false,()->{calls.incrementAndGet();return quote();});m.setFeedback(messages::add);
  try{m.checkNow();assertEquals(0,calls.get());assertTrue(messages.get(0).contains("prioridade"));}finally{m.close();}
 }
 @Test public void manualClosedMarketShowsStateWithoutCallingPriceSource()throws Exception{
  long target=java.time.Instant.parse("2026-11-14T12:30:00Z").toEpochMilli();ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(target-ShadowSystem.currentTimeMillis()));AtomicInteger calls=new AtomicInteger();BrentMonitor m=new BrentMonitor(c,()->true,()->{calls.incrementAndGet();return quote();});
  try{m.checkNow();await(m);assertEquals(0,calls.get());assertTrue(m.showing());assertTrue(Prefs.get(c).getString("brentStatus","").contains("FECHADO"));}finally{m.close();}
 }
}


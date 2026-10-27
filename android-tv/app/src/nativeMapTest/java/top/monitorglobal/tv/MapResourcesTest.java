package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.os.Looper;import java.io.*;import java.net.*;import java.lang.reflect.*;import java.util.*;import java.util.concurrent.*;import java.util.concurrent.atomic.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
/** Actual Android Canvas/Bitmap code on host Skia; not a physical TV memory measurement. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class MapResourcesTest {
 private Context context;private static byte[] tile;private static final AtomicInteger calls=new AtomicInteger(),open=new AtomicInteger();private static final AtomicBoolean fail=new AtomicBoolean(),stall=new AtomicBoolean();
 @BeforeClass public static void network() throws Exception {

  URL.setURLStreamHandlerFactory(protocol->protocol.equals("https")?new URLStreamHandler(){protected URLConnection openConnection(URL u){return new HttpURLConnection(u){boolean disconnected;{calls.incrementAndGet();open.incrementAndGet();}public void disconnect(){if(!disconnected){disconnected=true;open.decrementAndGet();}}public boolean usingProxy(){return false;}public void connect(){}public int getResponseCode(){return fail.get()?503:200;}public long getContentLengthLong(){return tile.length;}public InputStream getInputStream(){return new ByteArrayInputStream(tile){public synchronized int read(byte[] b,int off,int len){while(stall.get()&&!disconnected&&!Thread.currentThread().isInterrupted()){try{Thread.sleep(5);}catch(InterruptedException e){Thread.currentThread().interrupt();}}return disconnected?-1:super.read(b,off,len);}};}};}}:null);
 }
 @Before public void setup(){context=RuntimeEnvironment.getApplication();if(tile==null){Bitmap b=Bitmap.createBitmap(256,256,Bitmap.Config.ARGB_8888);b.eraseColor(0xff15384b);ByteArrayOutputStream out=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,out);tile=out.toByteArray();b.recycle();}Prefs.get(context).edit().clear().commit();}
 private static Object value(Object target,String name) throws Exception {Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private static void await(java.util.function.BooleanSupplier done) throws Exception {long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);while(!done.getAsBoolean()&&System.nanoTime()<end){Shadows.shadowOf(Looper.getMainLooper()).idle();Thread.sleep(5);}assertTrue("worker/callback did not finish",done.getAsBoolean());}
 @SuppressWarnings("unchecked") private static Map<Alert,Object> ready(MapInset inset) throws Exception {return (Map<Alert,Object>)value(inset,"ready");}
 private Alert quake(long now){return DemoAlerts.create("quake",now).get(0);}
 @Test public void partialTodayCannotOverwriteSavedCompletedReplay() throws Exception {
  long now=java.time.Instant.parse("2026-10-27T05:27:00Z").toEpochMilli();FeedClient.Snapshot yesterday=new FeedClient.Snapshot();yesterday.day="2026-10-26";yesterday.complete=true;yesterday.quakeOk=true;yesterday.asOf=now;yesterday.alerts.add(quake(now));Prefs.rememberSummary(context,yesterday);
  FeedClient.Snapshot today=new FeedClient.Snapshot();today.day="2026-10-27";today.quakeOk=true;today.asOf=now;today.alerts.add(quake(now));Prefs.rememberSummary(context,today);
  assertEquals("2026-10-27",Prefs.lastSummary(context).day);assertTrue(SummaryRecord.completedFor(Prefs.lastCompletedSummary(context),now));
  Prefs.get(context).edit().remove("lastCompletedSummary").commit();assertNull(Prefs.lastCompletedSummary(context));
  Prefs.rememberSummary(context,yesterday);Prefs.get(context).edit().remove("lastCompletedSummary").commit();assertTrue(SummaryRecord.completedFor(Prefs.lastCompletedSummary(context),now));
 }
 @Test public void closingBetweenPreparationAndDownloadMustNotThrow() throws Exception {
  MapInset inset=new MapInset(context,()->{});((ExecutorService)value(inset,"worker")).shutdownNow();
  ExecutorService closing=new AbstractExecutorService(){int stages;boolean stopped;public void execute(Runnable r){if(++stages==2){inset.close();throw new RejectedExecutionException("closed between check and submit");}r.run();}public void shutdown(){stopped=true;}public List<Runnable> shutdownNow(){stopped=true;return List.of();}public boolean isShutdown(){return stopped;}public boolean isTerminated(){return stopped;}public boolean awaitTermination(long n,TimeUnit u){return stopped;}};
  Field field=MapInset.class.getDeclaredField("worker");field.setAccessible(true);field.set(inset,closing);
  try{inset.prepare(quake(1800000000000L));Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(ready(inset).isEmpty());}finally{inset.close();}
 }
 @Test public void warningNoThreatAndEndingHaveTheirOwnCoastDrawing() throws Exception {
  org.json.JSONObject fixture;try(InputStream in=getClass().getResourceAsStream("/tsunami-lifecycle.json")){assertNotNull(in);fixture=new org.json.JSONObject(new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));}
  Map<String,Alert> examples=new LinkedHashMap<>();org.json.JSONArray stages=fixture.getJSONArray("stages");
  for(int i=0;i<stages.length();i++){org.json.JSONArray rows=stages.getJSONObject(i).getJSONObject("snapshot").getJSONArray("alerts");for(int j=0;j<rows.length();j++){Alert a=AlertCodec.read(rows.getJSONObject(j));if(a.kind.equals("tsunami")&&!a.mapJson.isEmpty()&&List.of("warning","noThreat","ended").contains(a.state)&&new org.json.JSONObject(a.mapJson).getJSONArray("lines").length()>0)examples.putIfAbsent(a.state,a);}}
  assertEquals(3,examples.size());MapInset inset=new MapInset(context,()->{});Map<Alert,Object> ready=ready(inset);
  try{for(Alert a:examples.values())inset.prepare(a);await(()->ready.size()==3);
   for(Map.Entry<String,Alert> entry:examples.entrySet()){List<?> shores=(List<?>)value(ready.get(entry.getValue()),"shores");assertFalse(shores.isEmpty());int expected=Color.parseColor(entry.getKey().equals("warning")?"#fb7148":entry.getKey().equals("noThreat")?"#70c9b5":"#94a3b8");for(Object stroke:shores)assertEquals(expected,((Integer)value(stroke,"color")).intValue());}
  }finally{inset.close();}await(()->((ExecutorService)unchecked(inset,"worker")).isTerminated());assertTrue(ready.isEmpty());
 }
 @Test public void satelliteDrawsAndClosingReleasesQueueAndCallbacks() throws Exception {
  MapInset inset=new MapInset(context,()->{});Alert a=quake(1800000000000L);Map<Alert,Object> ready=ready(inset);inset.prepare(a);
  await(()->{try{return ready.containsKey(a)&&value(ready.get(a),"image")!=null;}catch(Exception e){return false;}});
  Bitmap frame=Bitmap.createBitmap(620,352,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(frame);canvas.scale(2,2);inset.draw(canvas,a,Typeface.DEFAULT,Color.CYAN);int color=frame.getPixel(80,180);assertTrue(Math.abs(Color.red(color)-0x15)<=8);assertTrue(Math.abs(Color.green(color)-0x38)<=4);assertTrue(Math.abs(Color.blue(color)-0x4b)<=8);frame.recycle();
  inset.close();ExecutorService executor=(ExecutorService)value(inset,"worker");await(executor::isTerminated);Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(ready.isEmpty());assertEquals(0,open.get());
 }
 @Test public void failedImageRetainsOfflineGeography() throws Exception {
  fail.set(true);MapInset inset=new MapInset(context,()->{});Alert a=quake(1800000000000L);Map<Alert,Object> ready=ready(inset);int before=calls.get();try{inset.prepare(a);await(()->ready.containsKey(a)&&calls.get()>before&&open.get()==0);assertNotNull(value(ready.get(a),"land"));assertNull(value(ready.get(a),"image"));}finally{inset.close();fail.set(false);}await(()->((ExecutorService)unchecked(inset,"worker")).isTerminated());
 }
 private static Object unchecked(Object object,String name){try{return value(object,name);}catch(Exception e){throw new AssertionError(e);}}
 @Test public void closingDuringNetworkReadCancelsTheConnection() throws Exception {
  stall.set(true);MapInset inset=new MapInset(context,()->{});try{inset.prepare(quake(1800000000000L));await(()->open.get()>0);inset.close();await(()->((ExecutorService)unchecked(inset,"worker")).isTerminated());assertEquals(0,open.get());assertTrue(ready(inset).isEmpty());}finally{stall.set(false);inset.close();}
 }
 @Test public void pairedBannerDrawsTheMapOfItsCurrentEightSecondPage() throws Exception {
  Alert quake=quake(1800000000000L);NewsBannerView view=new NewsBannerView(context,quake,true,false);int space=(Integer)value(view,"mapSpace");assertTrue(space>0);view.layout(0,0,960,126+space);view.onAttachedToWindow();MapInset inset=(MapInset)value(view,"mapInset");Map<Alert,Object> ready=ready(inset);
  try{await(()->ready.size()==2&&ready.values().stream().allMatch(d->unchecked(d,"image")!=null));long start=android.os.SystemClock.uptimeMillis();view.startPresentation(start,true);
   for(int page=0;page<2;page++){long target=start+(page==0?1000:9000),advance=target-android.os.SystemClock.uptimeMillis();if(advance>0)org.robolectric.shadows.ShadowSystemClock.advanceBy(java.time.Duration.ofMillis(advance));Bitmap actual=Bitmap.createBitmap(960,126+space,Bitmap.Config.ARGB_8888),expected=Bitmap.createBitmap(960,126+space,Bitmap.Config.ARGB_8888);
    try{view.onDraw(new Canvas(actual));Canvas c=new Canvas(expected);c.scale(1,space/180f);c.translate(649,0);inset.draw(c,page==0?quake:quake.companion,(Typeface)value(view,"brand"),(Integer)value(view,"accent"));int height=space*176/180;int[] a=new int[310*height],b=new int[a.length];actual.getPixels(a,0,310,649,0,310,height);expected.getPixels(b,0,310,649,0,310,height);assertArrayEquals("page "+page+" uses its own map",b,a);}finally{actual.recycle();expected.recycle();}
   }
  }finally{view.onDetachedFromWindow();}await(()->((ExecutorService)unchecked(inset,"worker")).isTerminated());assertTrue(ready.isEmpty());
 }
 @Test public void fullSummariesStayWithinFiveSmallImagesAndReleaseEveryCycle() throws Exception {
  long maximum=0;int images=0;long began=System.nanoTime();
  for(int cycle=0;cycle<30;cycle++){
   MapInset inset=new MapInset(context,()->{});Map<Alert,Object> ready=ready(inset);List<Alert> alerts=new ArrayList<>();
   try{for(int j=0;j<5;j++){Alert a=quake(1800000000000L+j);alerts.add(a);inset.prepare(a);}await(()->{try{return ready.size()==5&&ready.values().stream().allMatch(d->unchecked(d,"image")!=null);}catch(Exception e){return false;}});
    long bytes=0;for(Object d:ready.values()){bytes+=((Bitmap)value(d,"image")).getAllocationByteCount();images++;}maximum=Math.max(maximum,bytes);assertTrue(bytes<=5L*620*300*2);
    Bitmap frame=Bitmap.createBitmap(620,352,Bitmap.Config.ARGB_8888);try{for(Alert a:alerts){Canvas canvas=new Canvas(frame);canvas.scale(2,2);inset.draw(canvas,a,Typeface.DEFAULT,Color.CYAN);}}finally{frame.recycle();}
   }finally{inset.close();}
   await(()->((ExecutorService)unchecked(inset,"worker")).isTerminated());Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(ready.isEmpty());assertEquals(0,open.get());inset.prepare(alerts.get(0));assertTrue(ready.isEmpty());
  }
  System.out.println("MAP_STRESS fullCycles=30 images="+images+" maxImageBytes="+maximum+" finalConnections="+open.get()+" seconds="+TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-began)/1000.0);
 }
 @Test public void repeatedInterruptedSummaryDoesNotLeaveWorkersOrBitmaps() throws Exception {
  List<ExecutorService> workers=new ArrayList<>();int before=calls.get();
  for(int i=0;i<120;i++){MapInset inset=new MapInset(context,()->{});for(int j=0;j<5;j++)inset.prepare(quake(1800000000000L+j));inset.close();workers.add((ExecutorService)value(inset,"worker"));assertTrue(ready(inset).isEmpty());Shadows.shadowOf(Looper.getMainLooper()).idle();}
  await(()->workers.stream().allMatch(ExecutorService::isTerminated));Shadows.shadowOf(Looper.getMainLooper()).idle();assertEquals(0,open.get());assertTrue(calls.get()-before<=120*5*12);
 }
}

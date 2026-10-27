package top.monitorglobal.tv;
import android.content.*;import android.net.Uri;import android.os.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;import org.json.*;import java.io.*;import java.lang.reflect.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class RuntimeDiagnosticsTest {
 private Context c;
 @Before public void setup(){c=RuntimeEnvironment.getApplication();RuntimeDiagnostics.stop();RuntimeDiagnostics.file(c).delete();RuntimeDiagnostics.previousFile(c).delete();}
 @After public void cleanup(){RuntimeDiagnostics.stop();}
 @Test public void localSamplesAreBoundedAndExportHasNoEventOrNetworkData() throws Exception {
  RuntimeDiagnostics.start(c);for(int i=0;i<RuntimeDiagnostics.MAX_SAMPLES+12;i++)RuntimeDiagnostics.sample();RuntimeDiagnostics.stop();JSONObject r=RuntimeDiagnostics.read(c);assertEquals(RuntimeDiagnostics.MAX_SAMPLES,r.getJSONArray("samples").length());assertTrue(r.getLong("sampleCount")>=RuntimeDiagnostics.MAX_SAMPLES+12);File f=RuntimeDiagnostics.export(c);assertTrue(f.length()<RuntimeDiagnostics.MAX_BYTES);String text=new String(java.nio.file.Files.readAllBytes(f.toPath()),java.nio.charset.StandardCharsets.UTF_8);assertFalse(text.contains("http"));assertFalse(text.contains("token"));assertFalse(text.contains("earthquake"));
 }
 @Test public void drawingGapsExcludeSeparateBanners() throws Exception {
  RuntimeDiagnostics.resetFrameClock();RuntimeDiagnostics.frame(1_000_000_000L,1_000_000,true);JSONObject before=RuntimeDiagnostics.frameSnapshot();RuntimeDiagnostics.frame(1_080_000_000L,2_000_000,true);JSONObject gap=RuntimeDiagnostics.frameSnapshot();assertEquals(before.getLong("gapsOver50ms")+1,gap.getLong("gapsOver50ms"));RuntimeDiagnostics.resetFrameClock();RuntimeDiagnostics.frame(90_000_000_000L,1_000_000,true);assertEquals(gap.getLong("gapsOver50ms"),RuntimeDiagnostics.frameSnapshot().getLong("gapsOver50ms"));
 }
 @Test public void stoppingDoesNotLeaveTheSamplerRunning() throws Exception {
  RuntimeDiagnostics.start(c);Field f=RuntimeDiagnostics.class.getDeclaredField("sampler");f.setAccessible(true);java.util.concurrent.ExecutorService old=(java.util.concurrent.ExecutorService)f.get(null);RuntimeDiagnostics.stop();assertNull(f.get(null));assertTrue(old.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS));
 }
 @Test public void exportProviderIsReadOnlyAndCannotTraversePaths() throws Exception {
  RuntimeDiagnostics.start(c);RuntimeDiagnostics.sample();RuntimeDiagnostics.stop();RuntimeDiagnostics.export(c);DiagnosticsProvider p=Robolectric.buildContentProvider(DiagnosticsProvider.class).create().get();String base="content://"+c.getPackageName()+".diagnostics";try(ParcelFileDescriptor fd=p.openFile(Uri.parse(base+"/report"),"r")){assertNotNull(fd);}for(String path:new String[]{"/../runtime-diagnostics.json","/report?secret=1","/report#fragment","/other"})try{p.openFile(Uri.parse(base+path),"r");fail(path);}catch(FileNotFoundException expected){}try{p.openFile(Uri.parse(base+"/report"),"w");fail();}catch(FileNotFoundException expected){}
 }
 @Test public void upgradeKeepsTheEntirePreviousReportAcrossSameVersionRestarts() throws Exception {
  JSONObject old=new JSONObject().put("version","1.0.19").put("pid",-1).put("sampleCount",278).put("peakPssKb",48537).put("samples",new JSONArray().put(new JSONObject().put("at",123).put("pssKb",31948)));
  java.nio.file.Files.write(RuntimeDiagnostics.file(c).toPath(),old.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  RuntimeDiagnostics.start(c);RuntimeDiagnostics.sample();RuntimeDiagnostics.stop();JSONObject preserved=RuntimeDiagnostics.readPrevious(c);assertEquals("1.0.19",preserved.getString("version"));assertEquals(278,preserved.getLong("sampleCount"));assertEquals(31948,preserved.getJSONArray("samples").getJSONObject(0).getInt("pssKb"));
  JSONObject current=RuntimeDiagnostics.read(c);current.put("pid",-1);java.nio.file.Files.write(RuntimeDiagnostics.file(c).toPath(),current.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));RuntimeDiagnostics.start(c);RuntimeDiagnostics.sample();RuntimeDiagnostics.stop();assertEquals("1.0.19",RuntimeDiagnostics.readPrevious(c).getString("version"));
  JSONObject exported=new JSONObject(new String(java.nio.file.Files.readAllBytes(RuntimeDiagnostics.export(c,true).toPath()),java.nio.charset.StandardCharsets.UTF_8));assertEquals(278,exported.getLong("sampleCount"));JSONObject emptyOld=new JSONObject().put("version","1.0.18").put("samples",new JSONArray());java.nio.file.Files.write(RuntimeDiagnostics.file(c).toPath(),emptyOld.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));RuntimeDiagnostics.start(c);RuntimeDiagnostics.sample();RuntimeDiagnostics.stop();assertEquals(278,RuntimeDiagnostics.readPrevious(c).getLong("sampleCount"));
 }
}

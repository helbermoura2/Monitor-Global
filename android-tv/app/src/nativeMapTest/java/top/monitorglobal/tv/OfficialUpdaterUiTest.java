package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.os.*;import android.provider.Settings;import android.widget.*;
import java.nio.file.Files;import java.util.concurrent.*;import java.util.concurrent.atomic.*;
import org.json.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;
import org.robolectric.*;import org.robolectric.android.controller.ActivityController;import org.robolectric.annotation.*;import org.robolectric.shadows.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class OfficialUpdaterUiTest {
 public static class Screen extends Activity {
  boolean rejectSettings,rejectInstaller,rejectView;
  @Override public void startActivity(Intent intent){
   if(rejectSettings&&Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES.equals(intent.getAction()))throw new ActivityNotFoundException();
   if((rejectInstaller&&(Intent.ACTION_VIEW.equals(intent.getAction())||Intent.ACTION_INSTALL_PACKAGE.equals(intent.getAction())))||(rejectView&&Intent.ACTION_VIEW.equals(intent.getAction())))throw new ActivityNotFoundException();
   super.startActivity(intent);
  }
 }
 private ActivityController<Screen> controller;private Screen activity;private OfficialUpdater updater;private final AtomicReference<String> status=new AtomicReference<>();
 @Before public void setup(){controller=Robolectric.buildActivity(Screen.class).setup();activity=controller.get();Shadows.shadowOf(activity.getPackageManager()).setCanRequestPackageInstalls(false);}
 @After public void cleanup()throws Exception{if(updater!=null)updater.close();OfficialApkProvider.apk(activity).delete();controller.pause().stop().destroy();}
 private JSONObject config(int code,String version)throws Exception{return new JSONObject().put("release",new JSONObject().put("enabled",true).put("versionCode",code).put("versionName",version).put("url","https://monitorglobal.top/downloads/monitor-global-tv-"+version+".apk").put("sha256","0".repeat(64)));}
 private boolean busy()throws Exception{java.lang.reflect.Field f=OfficialUpdater.class.getDeclaredField("busy");f.setAccessible(true);return f.getBoolean(updater);}
 private void ready()throws Exception{for(int i=0;i<1000;i++){Thread.sleep(5);Shadows.shadowOf(Looper.getMainLooper()).idle();if(!busy())return;}fail("update check did not finish");}
 private AlertDialog dialog(){AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertNotNull(d);assertTrue(d.isShowing());return d;}
 private String message(){return ((TextView)dialog().findViewById(android.R.id.message)).getText().toString();}
 private OfficialConfig.Release release()throws Exception{return OfficialConfig.release(config(BuildConfig.VERSION_CODE+1,"1.0.38"));}
 // This fixture enters the UI only after a hypothetical successful verification; it never downloads or installs a real APK.
 private void verifiedFixture(OfficialConfig.Release r)throws Exception{
  Files.writeString(OfficialApkProvider.apk(activity).toPath(),"trusted-stage UI fixture");
  java.lang.reflect.Method m=OfficialUpdater.class.getDeclaredMethod("verified",OfficialConfig.Release.class);m.setAccessible(true);m.invoke(updater,r);
 }
 @Test public void oldPublishedChannelShowsInstalledAndPublishedVersionsInAVisibleDialog()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(10030,"1.0.30"));updater.check();ready();
  assertTrue(message().contains("Instalada: "+BuildConfig.VERSION_NAME));assertTrue(message().contains("Publicada no canal oficial: 1.0.30"));assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
 }
 @Test public void newReleaseOffersDownloadWithoutStartingInstallation()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(BuildConfig.VERSION_CODE+1,"1.0.38"));updater.check();ready();
  assertEquals("Baixar e verificar",dialog().getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
 }
 @Test public void failedChannelReadShowsActionableResultInsteadOfOnlyUpdatingHiddenStatus()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->{throw new java.io.IOException("offline fixture");});updater.check();ready();
  assertTrue(message().contains("Confira a conexão"));assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
 }
 @Test public void repeatedClickWhileCheckingDoesNotStartAnotherRequestOrBlockTheMainLooper()throws Exception{
  CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger calls=new AtomicInteger();
  updater=new OfficialUpdater(activity,status::set,()->{calls.incrementAndGet();entered.countDown();release.await(5,TimeUnit.SECONDS);return config(10030,"1.0.30");});
  try{updater.check();assertTrue(entered.await(2,TimeUnit.SECONDS));updater.check();assertEquals(1,calls.get());AtomicBoolean ran=new AtomicBoolean();new Handler(Looper.getMainLooper()).post(()->ran.set(true));Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(ran.get());}
  finally{release.countDown();}ready();assertTrue(message().contains("1.0.30"));
 }
 @Test public void missingSettingsScreenShowsThePinnedDownloaderAddress()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(10030,"1.0.30"));activity.rejectSettings=true;OfficialConfig.Release r=release();verifiedFixture(r);
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();assertTrue(message().contains("autorizar"));
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();assertTrue(message().contains(r.url));assertTrue(message().contains("sem desinstalar"));
 }
 @Test public void returningFromPermissionOffersTheVerifiedFileWithoutAnotherDownload()throws Exception{
  AtomicInteger calls=new AtomicInteger();updater=new OfficialUpdater(activity,status::set,()->{calls.incrementAndGet();return config(10030,"1.0.30");});OfficialConfig.Release r=release();verifiedFixture(r);
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
  assertEquals(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Shadows.shadowOf(activity).getNextStartedActivity().getAction());
  Shadows.shadowOf(activity.getPackageManager()).setCanRequestPackageInstalls(true);updater.resume();
  assertEquals("Instalar agora",dialog().getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());assertEquals(0,calls.get());
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();Intent install=Shadows.shadowOf(activity).getNextStartedActivity();
  assertEquals(Intent.ACTION_VIEW,install.getAction());assertEquals("application/vnd.android.package-archive",install.getType());assertEquals(activity.getPackageName()+".updates",install.getData().getAuthority());assertTrue((install.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0);
 }
 @Test public void missingInstallerShowsDownloaderInsteadOfSilentlyFailing()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(10030,"1.0.30"));activity.rejectInstaller=true;Shadows.shadowOf(activity.getPackageManager()).setCanRequestPackageInstalls(true);OfficialConfig.Release r=release();verifiedFixture(r);
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();assertTrue(message().contains(r.url));assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
 }
 @Test public void legacyInstallerFallbackKeepsTheReadOnlyContentGrant()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(10030,"1.0.30"));activity.rejectView=true;Shadows.shadowOf(activity.getPackageManager()).setCanRequestPackageInstalls(true);verifiedFixture(release());
  dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();Intent intent=Shadows.shadowOf(activity).getNextStartedActivity();
  assertEquals(Intent.ACTION_INSTALL_PACKAGE,intent.getAction());assertEquals("content",intent.getData().getScheme());assertTrue((intent.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0);assertNotNull(intent.getClipData());
 }
 @Test public void closeDismissesTheResultAndSuppressesLateCallbacks()throws Exception{
  updater=new OfficialUpdater(activity,status::set,()->config(10030,"1.0.30"));updater.check();ready();AlertDialog current=dialog();updater.close();assertFalse(current.isShowing());updater.check();Shadows.shadowOf(Looper.getMainLooper()).idle();assertFalse(current.isShowing());
 }
}

package top.monitorglobal.tv;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import com.google.zxing.*;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import java.util.*;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;
import org.robolectric.shadows.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class OverlayPermissionHelpTest {
 @Before public void reset(){ShadowSettings.setCanDrawOverlays(false);}
 @Test public void missingPackageScreenFallsBackToGeneralOverlayScreen(){
  List<Intent> tried=new ArrayList<>();
  assertTrue(OverlayPermissionHelp.openSettings("top.monitorglobal.tv.preview",intent->{tried.add(intent);if(tried.size()==1)throw new ActivityNotFoundException();}));
  assertEquals(2,tried.size());assertEquals(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,tried.get(1).getAction());assertNull(tried.get(1).getData());
 }
 @Test public void securityRejectionAlsoFallsBackAndApplicationDetailsKeepTheRightPackage(){
  List<Intent> tried=new ArrayList<>();
  assertTrue(OverlayPermissionHelp.openSettings("example.dev",intent->{tried.add(intent);if(tried.size()<3)throw new SecurityException();}));
  assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,tried.get(2).getAction());
  assertEquals("package:example.dev",tried.get(2).getData().toString());
 }
 @Test public void missingEveryScreenDoesNotCrashOrClaimPermission(){
  List<Intent> tried=new ArrayList<>();
  assertFalse(OverlayPermissionHelp.openSettings("example.app",intent->{tried.add(intent);throw new ActivityNotFoundException();}));
  assertEquals(3,tried.size());assertTrue(OverlayPermissionHelp.status(RuntimeEnvironment.getApplication()).contains("ainda não concedida"));
 }
 @Test public void openingSettingsDoesNotCountAsGrantAndRecheckReadsTheSystem(){
  assertTrue(OverlayPermissionHelp.openSettings("example.app",intent->{}));
  assertTrue(OverlayPermissionHelp.status(RuntimeEnvironment.getApplication()).contains("ainda não concedida"));
  ShadowSettings.setCanDrawOverlays(true);
  assertTrue(OverlayPermissionHelp.status(RuntimeEnvironment.getApplication()).startsWith("Sobreposição permitida"));
 }
 private Button button(View view,String title){
  if(view instanceof Button&&((Button)view).getText().toString().equals(title))return (Button)view;
  if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){Button found=button(((ViewGroup)view).getChildAt(i),title);if(found!=null)return found;}
  return null;
 }
 private ImageView image(View view){
  if(view instanceof ImageView&&((ImageView)view).getDrawable() instanceof BitmapDrawable)return (ImageView)view;
  if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){ImageView found=image(((ViewGroup)view).getChildAt(i));if(found!=null)return found;}
  return null;
 }
 @Test public void ownerCanReachPhoneHelpWithoutAnySystemSettingsActivity()throws Exception{
  ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup();
  AlertDialog first=null,phone=null;
  try{
   OverlayPermissionHelp.show(controller.get());first=ShadowAlertDialog.getLatestAlertDialog();assertTrue(first.isShowing());
   Button help=button(first.getWindow().getDecorView(),"Ajuda pelo celular · QR Code");assertNotNull(help);help.performClick();
   phone=ShadowAlertDialog.getLatestAlertDialog();assertTrue(phone.isShowing());assertNotSame(first,phone);
   ImageView qr=image(phone.getWindow().getDecorView());assertNotNull(qr);Bitmap b=((BitmapDrawable)qr.getDrawable()).getBitmap();
   int[] pixels=new int[b.getWidth()*b.getHeight()];b.getPixels(pixels,0,b.getWidth(),0,0,b.getWidth(),b.getHeight());
   String url=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(b.getWidth(),b.getHeight(),pixels)))).getText();
   assertEquals(OverlayPermissionHelp.GUIDE,url);assertFalse(Settings.canDrawOverlays(controller.get()));
  }finally{if(phone!=null)phone.dismiss();if(first!=null)first.dismiss();controller.pause().stop().destroy();}
 }
 @Test public void commandTargetsTheInstalledPackageOnly(){
  assertEquals("appops set top.monitorglobal.tv.preview SYSTEM_ALERT_WINDOW allow",OverlayPermissionHelp.command("top.monitorglobal.tv.preview"));
  assertEquals("appops set example.dev SYSTEM_ALERT_WINDOW allow",OverlayPermissionHelp.command("example.dev"));
 }
}

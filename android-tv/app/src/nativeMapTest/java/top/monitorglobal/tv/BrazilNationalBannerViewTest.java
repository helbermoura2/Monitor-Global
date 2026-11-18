package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.SystemClock;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.util.Locale;
import static org.junit.Assert.*;

/** Pixel-level regression for the user-approved TV Brazil national strip. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BrazilNationalBannerViewTest {
 private Context context;
 @Before public void setup(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
 }
 private Alert brazil(){
  Alert a=new Alert("br-fixture","earthquake","1",
   "M3,8 · Jacobina, Bahia, Brasil","Profundidade: 10 km · USP",
   "earthquake",1763300000000L,1763300000000L,true);
  a.countryCode="BR";a.catalog="USP";a.source="RSBR / USP";
  a.originLatitude=-11.181;a.originLongitude=-40.516;
  a.magnitude=3.8;a.depth=10;return a;
 }
 private Bitmap image(BrazilNationalBannerView view){
  view.layout(0,0,960,180);
  view.startPresentation(SystemClock.uptimeMillis()-1100,false);
  Bitmap bitmap=Bitmap.createBitmap(960,180,Bitmap.Config.ARGB_8888);
  view.draw(new Canvas(bitmap));
  return bitmap;
 }
 @Test public void routeOnlyBrazilNoRegionalOrTsunami(){
  Alert br=brazil();
  assertTrue(BrazilNationalBannerView.isBrazilAlert(context,br));
  Alert world=new Alert("world","earthquake","v","M6,2 · Japão","", "earthquake",br.issuedAt,br.eventTime,true);
  world.countryCode="JP";world.catalog="GEOFON_GLOBAL";world.originLongitude=140;world.originLatitude=37;
  assertFalse(BrazilNationalBannerView.isBrazilAlert(context,world));
  Alert regional=br.copy();regional.compact=true;
  assertFalse(BrazilNationalBannerView.isBrazilAlert(context,regional));
  Alert offshore=br.copy();offshore.originLongitude=-36.4;offshore.originLatitude=-13.1;
  assertTrue("countryCode BR is authoritative even offshore",BrazilNationalBannerView.isBrazilAlert(context,offshore));
  Alert withoutCode=new Alert("br-coordinates","earthquake","v","M3,8 · Jacobina","","earthquake",br.issuedAt,br.eventTime,true);
  withoutCode.countryCode="";withoutCode.catalog="GEOFON_GLOBAL";
  withoutCode.originLongitude=br.originLongitude;withoutCode.originLatitude=br.originLatitude;
  assertTrue("state polygon locates domestic event",BrazilNationalBannerView.isBrazilAlert(context,withoutCode));
  Alert tsunami=new Alert("ts","tsunami","v","Tsunami","","warning",1,1,true);
  assertFalse(BrazilNationalBannerView.isBrazilAlert(context,tsunami));
 }
 @Test public void approvedAndBackupAreSelectableAndVisuallyDistinct(){
  Alert br=brazil();BrazilNationalBannerView approved=new BrazilNationalBannerView(context,br,false,false);
  assertFalse(approved.isBackup());
  Bitmap image=image(approved);
  try{
   assertEquals("approved bulletin body white",Color.WHITE,image.getPixel(400,40));
   assertTrue("approved BRASIL tab red",Color.red(image.getPixel(20,55))>130);
   assertTrue("footer is red",Color.red(image.getPixel(50,154))>100);
   assertEquals("national banner uses full width inside the 96% safe overlay",Color.WHITE,image.getPixel(900,44));
   assertTrue(approved.getContentDescription().toString().contains("Magnitude 3,8"));
   export(image,"national-approved");
  }finally{image.recycle();}
  Prefs.get(context).edit().putInt(BrazilNationalBannerView.PREF_MODEL,
     BrazilNationalBannerView.MODEL_BACKUP).commit();
  BrazilNationalBannerView backup=new BrazilNationalBannerView(context,br,false,false);
  assertTrue(backup.isBackup());
  Bitmap sample=image(backup);
  try{
   int p=sample.getPixel(20,12);
   assertTrue("backup has teal header",Color.green(p)>Color.red(p));
   assertEquals(Color.WHITE,sample.getPixel(450,55));
   export(sample,"national-backup");
  }finally{sample.recycle();}
 }
 @Test public void stateMapAndHeadlineAreGeographicallyTrue(){
  BrazilGeoStates geometry=BrazilGeoStates.load(context);
  assertNotNull(geometry);assertEquals(27,geometry.states.size());
  BrazilGeoStates.State ba=geometry.fromCoordinates(-40.516,-11.181);
  assertNotNull("the fixture is actually in Bahia",ba);
  assertEquals("BA",ba.uf);
  assertEquals("TREMOR REGISTRADO NA BAHIA",BrazilNationalBannerView.headline(ba));
  assertEquals("TREMOR REGISTRADO NO BRASIL",BrazilNationalBannerView.headline(null));
 }
 @Test public void replayAndSimulationNeverImplyNewRealAlert(){
  Alert br=brazil();
  BrazilNationalBannerView historical=new BrazilNationalBannerView(context,br,false,true);
  assertTrue(historical.getContentDescription().toString().contains("Replay histórico"));
  BrazilNationalBannerView demo=new BrazilNationalBannerView(context,br,true,false);
  assertTrue(demo.getContentDescription().toString().contains("Simulação"));
  assertFalse(demo.getContentDescription().toString().contains("novo alerta"));
 }
 private void export(Bitmap image,String name){
  try(java.io.FileOutputStream out=new java.io.FileOutputStream(
       new java.io.File(System.getProperty("java.io.tmpdir"),"monitor-tv-banner-"+name+".png"))){
   image.compress(Bitmap.CompressFormat.PNG,100,out);
  }catch(java.io.IOException ignored){}
 }
}

package top.monitorglobal.tv;
import android.net.Uri;import android.os.Looper;import android.webkit.JavascriptInterface;import android.webkit.WebSettings;import android.webkit.WebView;import java.lang.reflect.*;import java.util.*;import java.util.concurrent.atomic.AtomicInteger;import org.json.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PhoneMapViewTest {
 private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 private Alert sample(String id,double lon,double lat){Alert a=new Alert(id,"earthquake","v","M6,0 · Local de teste","","earthquake",1,1,false);a.originLongitude=lon;a.originLatitude=lat;return a;}
 @Test public void onlyTheLocalPageAndImagerySourceAreTrusted(){
  assertTrue(PhoneMapView.mainPage(Uri.parse(PhoneMapView.PAGE)));assertFalse(PhoneMapView.mainPage(Uri.parse(PhoneMapView.PAGE+"?url=https://evil.example")));assertFalse(PhoneMapView.mainPage(Uri.parse("file:///android_asset/phone-map.html")));assertFalse(PhoneMapView.mainPage(Uri.parse("https://evil.example/assets/phone-map.html")));
  assertTrue(PhoneMapView.tileResource(Uri.parse("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/1")));assertFalse(PhoneMapView.tileResource(Uri.parse("http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/1")));assertFalse(PhoneMapView.tileResource(Uri.parse("https://server.arcgisonline.com/evil.js")));assertFalse(PhoneMapView.localAsset(Uri.parse("https://user@appassets.androidplatform.net/assets/phone-map.html")));
 }
 @Test public void versionedLocalFilesUseTheActualAssetLoader()throws Exception{
  assertTrue(PhoneMapView.PAGE.contains("/assets/v"+top.monitorglobal.mobile.BuildConfig.VERSION_CODE+"/"));
  assertFalse(PhoneMapView.localAsset(Uri.parse("https://appassets.androidplatform.net/assets/phone-map.js")));
  assertFalse(PhoneMapView.mainPage(Uri.parse("https://appassets.androidplatform.net/assets/phone-map.html")));
  PhoneMapView view=new PhoneMapView(RuntimeEnvironment.getApplication(),a->{});
  try{androidx.webkit.WebViewAssetLoader loader=(androidx.webkit.WebViewAssetLoader)field(view,"loader");
   for(String name:Arrays.asList("phone-map.html","phone-map.js","brazil-satellite.js","brazil-satellite-model.js","brazil-satellite.css","data/brazil-satellite-border.json")){
    android.webkit.WebResourceResponse response=loader.shouldInterceptRequest(Uri.parse("https://appassets.androidplatform.net"+PhoneMapView.ASSET_PREFIX+name));
    assertNotNull(name,response);assertNotNull(name,response.getData());assertFalse(name,"text/plain".equals(response.getMimeType()));response.getData().close();
   }
  }finally{view.close();}
 }
 @Test public void satelliteRequestsAreRestrictedToTheOfficialLayer(){
  String base="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?LAYERS=";
  assertTrue(PhoneMapView.satelliteResource(Uri.parse(base+"GOES-East_ABI_Band13_Clean_Infrared")));assertFalse(PhoneMapView.satelliteResource(Uri.parse(base+"arbitrary-layer")));assertFalse(PhoneMapView.satelliteResource(Uri.parse(base.replace("https:","http:")+"GOES-East_ABI_Band13_Clean_Infrared")));assertFalse(PhoneMapView.satelliteResource(Uri.parse("https://evil.example/wms/epsg3857/best/wms.cgi?LAYERS=GOES-East_ABI_Band13_Clean_Infrared")));
 }
 @Test public void payloadUsesOnlyKnownCoordinatesAndClosesWithoutKeepingEvents()throws Exception{
  PhoneMapView view=new PhoneMapView(RuntimeEnvironment.getApplication(),a->{});
  try{Alert good=sample("q1",85,27);Alert invalid=sample("q2",Double.NaN,27);view.setEvents(Arrays.asList(good,invalid));JSONArray payload=new JSONArray((String)field(view,"pendingEvents"));assertEquals(1,payload.length());assertEquals("q1",payload.getJSONObject(0).getString("id"));assertEquals(85,payload.getJSONObject(0).getDouble("longitude"),0);
   WebSettings settings=((WebView)field(view,"web")).getSettings();assertFalse(settings.getAllowFileAccess());assertFalse(settings.getAllowContentAccess());assertFalse(settings.getAllowUniversalAccessFromFileURLs());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,settings.getMixedContentMode());
  }finally{view.close();}assertNull(field(view,"web"));assertEquals(0,((Map<?,?>)field(view,"events")).size());assertEquals(0,view.getChildCount());
 }
 @Test public void bridgeSelectsOnlyAnExistingEventWhileActive()throws Exception{
  AtomicInteger selected=new AtomicInteger();PhoneMapView view=new PhoneMapView(RuntimeEnvironment.getApplication(),a->{assertEquals("q1",a.id);selected.incrementAndGet();});
  try{view.setEvents(Collections.singletonList(sample("q1",85,27)));Object bridge=field(view,"bridge");Method select=bridge.getClass().getDeclaredMethod("selectEvent",String.class);select.setAccessible(true);assertNotNull(select.getAnnotation(JavascriptInterface.class));select.invoke(bridge,"foreign-id");Shadows.shadowOf(Looper.getMainLooper()).idle();assertEquals(0,selected.get());select.invoke(bridge,"q1");Shadows.shadowOf(Looper.getMainLooper()).idle();assertEquals(1,selected.get());view.pause();select.invoke(bridge,"q1");Shadows.shadowOf(Looper.getMainLooper()).idle();assertEquals(1,selected.get());view.close();select.invoke(bridge,"q1");Shadows.shadowOf(Looper.getMainLooper()).idle();assertEquals(1,selected.get());}finally{view.close();}
 }
}

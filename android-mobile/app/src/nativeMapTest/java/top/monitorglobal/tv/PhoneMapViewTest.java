package top.monitorglobal.tv;
import android.net.Uri;import android.os.Looper;import android.webkit.JavascriptInterface;import android.webkit.WebSettings;import android.webkit.WebView;import java.lang.reflect.*;import java.util.*;import java.util.concurrent.atomic.AtomicInteger;import org.json.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PhoneMapViewTest {
 @Test public void rainPreviewTrustsOnlyItsPublicDataRoutesAndVersionedAssets()throws Exception{
  String api="https://black-sky-9ba0.terrestre.workers.dev";assertTrue(PhoneMapView.streetResource(Uri.parse("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/7/72/47")));assertFalse(PhoneMapView.streetResource(Uri.parse("https://evil.example/ArcGIS/rest/services/World_Street_Map/MapServer/tile/7/72/47")));
  assertTrue(PhoneMapView.rainResource(Uri.parse(api+"/rainbow-snapshot")));assertTrue(PhoneMapView.rainResource(Uri.parse(api+"/tv-rain?area=liberdade")));assertTrue(PhoneMapView.rainResource(Uri.parse(api+"/rainbow-tile/1800000000/7200/7/47/72")));
  for(String path:Arrays.asList("/health","/tv-rain?area=other","/rainbow-snapshot?url=evil","/rainbow-tile/1/7200/8/1/1"))assertFalse(path,PhoneMapView.rainResource(Uri.parse(api+path)));
  assertFalse(PhoneMapView.rainResource(Uri.parse(api.replace("https:","http:")+"/rainbow-snapshot")));assertFalse(PhoneMapView.rainResource(Uri.parse("https://evil.example/rainbow-snapshot")));
  PhoneMapView view=new PhoneMapView(RuntimeEnvironment.getApplication(),null,true);try{assertEquals(PhoneMapView.RAIN_PAGE,((WebView)field(view,"web")).getUrl());androidx.webkit.WebViewAssetLoader loader=(androidx.webkit.WebViewAssetLoader)field(view,"loader");for(String name:Arrays.asList("phone-rain.html","phone-rain.js","phone-rain.css","phone-rain-model.js")){android.webkit.WebResourceResponse r=loader.shouldInterceptRequest(Uri.parse("https://appassets.androidplatform.net"+PhoneMapView.ASSET_PREFIX+name));assertNotNull(name,r);assertNotNull(name,r.getData());r.getData().close();}}finally{view.close();}assertNull(field(view,"web"));
 }
 private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 @Test public void radarAcceptsProviderOpaqueIdsAndRejectsForeignOrMalformedResources(){
  assertTrue(PhoneMapView.radarResource(Uri.parse("https://api.rainviewer.com/public/weather-maps.json")));
  for(String id:Arrays.asList("1794582600","ead16661a2c1","Hash-Key_42"))assertTrue(PhoneMapView.radarResource(Uri.parse("https://tilecache.rainviewer.com/v2/radar/"+id+"/256/7/47/72/2/1_1.png")));
  for(String url:Arrays.asList("https://evil.example/v2/radar/hash/256/5/11/18/2/1_1.png","https://tilecache.rainviewer.com/v2/radar/hash/256/8/11/18/2/1_1.png","https://tilecache.rainviewer.com/v2/radar/hash/256/0/11/18/2/1_1.png","https://tilecache.rainviewer.com/v2/radar/hash/256/5/11/18/2/1_1.png?other=1","https://tilecache.rainviewer.com/v2/radar/../other/256/5/11/18/2/1_1.png"))assertFalse(url,PhoneMapView.radarResource(Uri.parse(url)));
 }
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


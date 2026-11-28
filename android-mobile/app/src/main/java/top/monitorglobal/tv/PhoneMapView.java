package top.monitorglobal.tv;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.webkit.WebViewAssetLoader;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Local MapLibre page with a small ID-only bridge; no TV overlay; location only on the weather page. */
final class PhoneMapView extends FrameLayout {
 interface Listener { void onEventSelected(Alert alert); }
 static final String ASSET_PREFIX="/assets/v"+top.monitorglobal.mobile.BuildConfig.VERSION_CODE+"/";
 static final String PAGE="https://appassets.androidplatform.net"+ASSET_PREFIX+"phone-map.html";
 static final String RAIN_PAGE="https://appassets.androidplatform.net"+ASSET_PREFIX+"phone-rain.html";
 static final String BRAZIL_PAGE="https://appassets.androidplatform.net"+ASSET_PREFIX+"phone-brazil.html";
 private final boolean rainPage,brazilPage;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final Listener listener;
 private final WebViewAssetLoader loader;
 private final Map<String,Alert> events=new LinkedHashMap<>();
 private final Bridge bridge=new Bridge();
 private WebView web;
 private boolean closed,ready,active=true;
 private String pendingEvents="[]",pendingFocus="";

 PhoneMapView(Context context,Listener selected){this(context,selected,false);}
 PhoneMapView(Context context,Listener selected,boolean rain){this(context,selected,rain,false);}
 PhoneMapView(Context context,Listener selected,boolean rain,boolean brazil){
  super(context);listener=selected;rainPage=rain;brazilPage=brazil;setBackgroundColor(0xff071724);
  loader=new WebViewAssetLoader.Builder().addPathHandler(ASSET_PREFIX,new WebViewAssetLoader.AssetsPathHandler(context)).build();
  open();
 }
 private void open(){
  if(closed)return;disposeWeb();removeAllViews();ready=false;
  try{
   WebView current=new WebView(getContext());web=current;
   current.setBackgroundColor(0xff071724);
   WebSettings settings=current.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(brazilPage);
   // MapLibre handles pan/pinch/zoom; avoid WebView's duplicate native +/- overlay.
   settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
   settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
   settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(brazilPage);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);settings.setMediaPlaybackRequiresUserGesture(true);settings.setSafeBrowsingEnabled(true);
   current.setWebChromeClient(new android.webkit.WebChromeClient(){
    @Override public void onGeolocationPermissionsShowPrompt(String origin,android.webkit.GeolocationPermissions.Callback callback){
     if(!brazilPage||closed||!active||web!=current||!"https://appassets.androidplatform.net".equals(origin)){callback.invoke(origin,false,false);return;}
     Context context=getContext();
     boolean granted=context.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED||context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED;
     if(!granted&&context instanceof android.app.Activity){
      ((android.app.Activity)context).requestPermissions(new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION,android.Manifest.permission.ACCESS_COARSE_LOCATION},7314);
     }
     callback.invoke(origin,granted,false);
    }
   });
   current.addJavascriptInterface(bridge,"MonitorMapBridge");
   current.setWebViewClient(new WebViewClient(){
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
     Uri uri=request.getUrl();
     if(localAsset(uri)){WebResourceResponse response=loader.shouldInterceptRequest(uri);if(response!=null&&brazilPage&&(uri.getPath().equals(ASSET_PREFIX+"inpe-radar-panel.mjs")||uri.getPath().equals(ASSET_PREFIX+"inpe-radar-catalog.mjs")||uri.getPath().equals(ASSET_PREFIX+"inpe-radar-panel-model.mjs")||uri.getPath().equals(ASSET_PREFIX+"inpe-radar-grid.mjs")||uri.getPath().equals(ASSET_PREFIX+"inpe-radar-layer-model.mjs")||uri.getPath().equals(ASSET_PREFIX+"phone-storm-tracker.mjs")||uri.getPath().equals(ASSET_PREFIX+"vendor/cappi/inpe-cappi-worker.mjs")))response.setMimeType("text/javascript");return response==null?blocked():response;}
     return tileResource(uri)||(!rainPage&&!brazilPage&&(satelliteResource(uri)||municipalMeshResource(uri)))||(rainPage&&(rainResource(uri)||streetResource(uri)||municipalMeshResource(uri)))||(brazilPage&&(forecastResource(uri)||satelliteResource(uri)||mobileGoesResource(uri)||inpeGoesResource(uri)||radarResource(uri)||inpeCatalogResource(uri)||inpeCappiResource(uri)||weatherObservationResource(uri)||municipalMeshResource(uri)))?null:blocked();
    }
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
     if(allowedPage(request.getUrl()))return false;
     if(request.isForMainFrame()&&request.hasGesture()&&attributionLink(request.getUrl()))try{getContext().startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(RuntimeException ignored){}
     return true;
    }
    @Override public void onPageFinished(WebView view,String url){if(!closed&&web==view&&allowedPage(Uri.parse(url))){ready=true;sendSatellite();sendEvents();sendFocus();if(!active)script("window.MonitorMap&&window.MonitorMap.pause()");}}
    @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame()&&web==view)unavailable();}
    @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&web==view)unavailable();}
    @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){if(web==view)unavailable();return true;}
   });
   addView(current,new LayoutParams(-1,-1));current.loadUrl(brazilPage?BRAZIL_PAGE:rainPage?RAIN_PAGE:PAGE);if(!active)current.onPause();
  }catch(RuntimeException failure){unavailable();}
 }
 private boolean allowedPage(Uri uri){return localAsset(uri)&&(brazilPage?(ASSET_PREFIX+"phone-brazil.html").equals(uri.getPath()):rainPage?(ASSET_PREFIX+"phone-rain.html").equals(uri.getPath()):mainPage(uri))&&uri.getQuery()==null;}
 static boolean inpeCappiResource(Uri uri){
  return "https".equalsIgnoreCase(uri.getScheme())&&"data.inpe.br".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getQuery()==null&&uri.getFragment()==null&&uri.getPath()!=null&&uri.getPath().matches("/bdc/data/br-weather-radar-cappi/[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-]{1,64}/cappi/(cappi3km_nc|cappi15l)/[0-9]{4}/(0[1-9]|1[0-2])/[A-Za-z0-9_-]{1,100}[.]nc");
 }
 static boolean inpeCatalogResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||!"data.inpe.br".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1||uri.getFragment()!=null||!"/bdc/stac/v1/search".equals(uri.getPath())||uri.getQuery()==null||uri.getQuery().length()>600)return false;
  try{
   if(!uri.getQueryParameterNames().equals(new java.util.HashSet<>(java.util.Arrays.asList("collections","bbox","datetime","limit"))))return false;
   for(String name:uri.getQueryParameterNames())if(uri.getQueryParameters(name).size()!=1)return false;
   if(!"br-weather-radar-cappi-1".equals(uri.getQueryParameter("collections"))||!"100".equals(uri.getQueryParameter("limit")))return false;
   String[] b=uri.getQueryParameter("bbox").split(",",-1);if(b.length!=4)return false;
   double w=Double.parseDouble(b[0]),s=Double.parseDouble(b[1]),e=Double.parseDouble(b[2]),n=Double.parseDouble(b[3]);
   if(!Double.isFinite(w)||!Double.isFinite(s)||!Double.isFinite(e)||!Double.isFinite(n)||w< -80||e> -30||s< -36||n>7||e<=w||n<=s||e-w>10||n-s>10)return false;
   String[] times=uri.getQueryParameter("datetime").split("/",-1);if(times.length!=2)return false;
   java.time.Instant from=java.time.Instant.parse(times[0]),to=java.time.Instant.parse(times[1]);long duration=java.time.Duration.between(from,to).toMillis();
   return duration==5400000L&&to.toEpochMilli()<=System.currentTimeMillis()+120000L&&to.toEpochMilli()>=System.currentTimeMillis()-300000L;
  }catch(RuntimeException bad){return false;}
 }
 static boolean radarResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getUserInfo()!=null||uri.getPort()!=-1||uri.getQuery()!=null||uri.getFragment()!=null)return false;
  String host=uri.getHost(),path=uri.getPath();if("api.rainviewer.com".equalsIgnoreCase(host))return "/public/weather-maps.json".equals(path);
  if(!"tilecache.rainviewer.com".equalsIgnoreCase(host)||path==null)return false;
  java.util.regex.Matcher m=java.util.regex.Pattern.compile("/v2/radar/[A-Za-z0-9_-]{1,64}/256/([0-7])/([0-9]{1,3})/([0-9]{1,3})/2/1_1[.]png").matcher(path);
  if(!m.matches())return false;int size=1<<Integer.parseInt(m.group(1));return Integer.parseInt(m.group(2))<size&&Integer.parseInt(m.group(3))<size;
 }

 /** Pin municipal meshes to a single immutable, attributed geodata snapshot.
  * Only known Brazilian UFs; no arbitrary URL, query, redirects or asset proxy.
  */
 static boolean municipalMeshResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||!"cdn.jsdelivr.net".equalsIgnoreCase(uri.getHost())
   ||uri.getPort()!=-1||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)return false;
  return uri.getPath()!=null&&uri.getPath().matches(
   "/gh/henriquemalvar/br-geojson@a4680c128c23c90fde346334fd5888a3b2997d29/dist/municipios/"
   +"(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)[.]geojson");
 }
 static boolean weatherObservationResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||!"raw.githubusercontent.com".equalsIgnoreCase(uri.getHost())
    ||uri.getUserInfo()!=null||uri.getPort()!=-1||uri.getQuery()!=null||uri.getFragment()!=null)return false;
  String path=uri.getPath();
  return "/helbermoura2/Monitor-Global/main/data/goes-19-lightning.json".equals(path)||
   "/helbermoura2/Monitor-Global/main/data/cemaden-alerts.json".equals(path);
 }
 static boolean forecastResource(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"api.open-meteo.com".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&"/v1/forecast".equals(uri.getPath())&&uri.getQuery()!=null&&uri.getQuery().length()<=1800&&uri.getQueryParameter("apikey")==null&&uri.getQueryParameter("latitude")!=null&&uri.getQueryParameter("longitude")!=null;}
 static boolean rainResource(Uri uri){if(!"https".equalsIgnoreCase(uri.getScheme())||!"black-sky-9ba0.terrestre.workers.dev".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1)return false;String path=uri.getPath();return ("/rainbow-snapshot".equals(path)&&uri.getQuery()==null)||("/tv-rain".equals(path)&&"area=liberdade".equals(uri.getQuery()))||(path!=null&&path.matches("/rainbow-tile/[0-9]+/[0-9]+/[0-7]/[0-9]+/[0-9]+")&&uri.getQuery()==null);}
 static boolean mainPage(Uri uri){return localAsset(uri)&&(ASSET_PREFIX+"phone-map.html").equals(uri.getPath())&&uri.getQuery()==null;}
 static boolean localAsset(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith(ASSET_PREFIX);}
 static boolean streetResource(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"server.arcgisonline.com".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith("/ArcGIS/rest/services/World_Street_Map/MapServer/tile/");}
 static boolean tileResource(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"server.arcgisonline.com".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith("/ArcGIS/rest/services/World_Imagery/MapServer/tile/");}
 static boolean inpeGoesResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||!"data.inpe.br".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1||uri.getFragment()!=null||uri.getPath()==null)return false;
  if(uri.getQuery()==null)return uri.getPath().matches("/bdc/data/GOES19-L2-CMI/ch(08|09|10)/[0-9]{4}/(0[1-9]|1[0-2])/[A-Za-z0-9_-]{1,100}[.]nc");
  if(!"/bdc/stac/v1/search".equals(uri.getPath())||uri.getQuery().length()>400)return false;
  try{
   if(!uri.getQueryParameterNames().equals(new java.util.HashSet<>(java.util.Arrays.asList("collections","datetime","limit"))))return false;
   for(String key:uri.getQueryParameterNames())if(uri.getQueryParameters(key).size()!=1)return false;
   if(!"GOES19-L2-CMI-1".equals(uri.getQueryParameter("collections"))||!"10".equals(uri.getQueryParameter("limit")))return false;
   String[] t=uri.getQueryParameter("datetime").split("/",-1);if(t.length!=2)return false;
   java.time.Instant from=java.time.Instant.parse(t[0]),to=java.time.Instant.parse(t[1]);long now=System.currentTimeMillis();
   return java.time.Duration.between(from,to).toMillis()==5400000L&&to.toEpochMilli()<=now+120000L&&to.toEpochMilli()>=now-300000L;
  }catch(RuntimeException e){return false;}
 }
 static boolean mobileGoesResource(Uri uri){
  if(!"https".equalsIgnoreCase(uri.getScheme())||!"gibs.earthdata.nasa.gov".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1||uri.getFragment()!=null||uri.getQuery()==null||uri.getQuery().length()>800)return false;
  String path=uri.getPath(),layer;
  if("/wms/epsg3857/best/wms.cgi".equals(path)){
   if(!"GetMap".equals(uri.getQueryParameter("REQUEST"))||!"EPSG:3857".equals(uri.getQueryParameter("SRS"))||!"1200".equals(uri.getQueryParameter("WIDTH"))||!"1200".equals(uri.getQueryParameter("HEIGHT"))||!"image/png".equals(uri.getQueryParameter("FORMAT")))return false;
   layer=uri.getQueryParameter("LAYERS");
  }else if("/wmts/epsg3857/best/wmts.cgi".equals(path)){
   if(!"DescribeDomains".equals(uri.getQueryParameter("REQUEST")))return false;
   layer=uri.getQueryParameter("LAYER");
  }else return false;
  return "GOES-East_ABI_GeoColor".equals(layer)||"GOES-East_ABI_Air_Mass".equals(layer);
 }
 static boolean satelliteResource(Uri uri){if(!"https".equalsIgnoreCase(uri.getScheme())||!"gibs.earthdata.nasa.gov".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1)return false;String p=uri.getPath();if("/legends/Clean_Longwave_Infrared_Window_Band_H.png".equals(p))return true;String layer=uri.getQueryParameter("LAYERS");if(layer==null)layer=uri.getQueryParameter("LAYER");return "GOES-East_ABI_Band13_Clean_Infrared".equals(layer)&&("/wms/epsg3857/best/wms.cgi".equals(p)||"/wmts/epsg3857/best/wmts.cgi".equals(p));}
 static boolean attributionLink(Uri uri){if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getPort()!=-1)return false;String host=uri.getHost();return "www.earthdata.nasa.gov".equalsIgnoreCase(host)||"www.esri.com".equalsIgnoreCase(host)||"www.arcgis.com".equalsIgnoreCase(host)||"maplibre.org".equalsIgnoreCase(host)||"open-meteo.com".equalsIgnoreCase(host)||"www.rainviewer.com".equalsIgnoreCase(host);}
 private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream("Recurso indisponível".getBytes(StandardCharsets.UTF_8)));}

 void setEvents(List<Alert> values){
  if(closed)return;events.clear();JSONArray payload=new JSONArray();int accepted=0;
  if(values!=null)for(Alert event:values){if(event==null||event.id==null||event.id.isEmpty()||event.id.length()>1400)continue;if(accepted++>=120)break;events.put(event.id,event.copy());}
  for(Alert event:events.values()){if(!MapFrame.located(event.originLongitude,event.originLatitude))continue;
   try{payload.put(new JSONObject().put("id",event.id).put("kind",event.kind).put("state",event.state).put("issuedAt",event.issuedAt).put("title",event.title).put("longitude",event.originLongitude).put("latitude",event.originLatitude).put("magnitude",Double.isFinite(event.magnitude)?event.magnitude:JSONObject.NULL).put("depth",Double.isFinite(event.depth)?event.depth:JSONObject.NULL).put("eventTime",event.eventTime).put("source",event.source).put("countryCode",event.countryCode));}catch(JSONException ignored){}
  }
  pendingEvents=payload.toString();sendEvents();
 }
 void focus(Alert event){if(closed||event==null||!MapFrame.located(event.originLongitude,event.originLatitude))return;try{pendingFocus=new JSONObject().put("id",event.id).put("longitude",event.originLongitude).put("latitude",event.originLatitude).toString();sendFocus();}catch(JSONException ignored){}}
 private void sendEvents(){if(!rainPage&&!brazilPage&&ready&&active)script("window.MonitorMap&&window.MonitorMap.setEvents(JSON.parse("+quote(pendingEvents)+"))");}
 private void sendFocus(){if(!rainPage&&!brazilPage&&ready&&active&&web!=null&&!pendingFocus.isEmpty()){String value=pendingFocus;pendingFocus="";script("window.MonitorMap&&window.MonitorMap.focus(JSON.parse("+quote(value)+"))");}}
 private static String quote(String value){return JSONObject.quote(value).replace("\u2028","\\u2028").replace("\u2029","\\u2029");}
 private String pendingWeatherMode;
 void showForecast(){requestWeatherMode("showForecast");}
 void showSevere(){requestWeatherMode("showSevere");}
 private void requestWeatherMode(String mode){if(closed)return;pendingWeatherMode=mode;sendSatellite();}
 private void sendSatellite(){if(ready&&active&&pendingWeatherMode!=null){String mode=pendingWeatherMode;pendingWeatherMode=null;script("window.MonitorMap?.["+quote(mode)+"]?.()");}}
 private void script(String value){if(web!=null&&!closed)web.evaluateJavascript(value,null);}
 void pause(){active=false;if(web!=null){script("window.MonitorMap&&window.MonitorMap.pause()");web.onPause();}}
 void resume(){if(closed)return;active=true;if(web!=null){web.onResume();sendSatellite();script("window.MonitorMap&&window.MonitorMap.resume()");sendEvents();sendFocus();}}
 void close(){if(closed)return;closed=true;ready=false;active=false;main.removeCallbacksAndMessages(null);events.clear();pendingEvents="[]";pendingFocus="";disposeWeb();removeAllViews();}
 private void disposeWeb(){WebView old=web;web=null;if(old!=null){removeView(old);old.removeJavascriptInterface("MonitorMapBridge");old.stopLoading();old.destroy();}}
 private void unavailable(){if(closed)return;ready=false;disposeWeb();removeAllViews();LinearLayout panel=new LinearLayout(getContext());panel.setOrientation(LinearLayout.VERTICAL);panel.setGravity(Gravity.CENTER);int pad=Math.round(20*getResources().getDisplayMetrics().density);panel.setPadding(pad,pad,pad,pad);TextView message=new TextView(getContext());message.setText(brazilPage?"Mapa meteorológico indisponível. Volte para Tempo para tentar novamente.":rainPage?"Mapa de chuva indisponível. Volte para Tempo para consultar a previsão.":"Mapa indisponível no momento. Os dados dos eventos continuam acessíveis na lista.");message.setTextColor(Color.WHITE);message.setTextSize(17);message.setGravity(Gravity.CENTER);panel.addView(message,new LinearLayout.LayoutParams(-1,-2));Button retry=new Button(getContext());retry.setText("Recarregar mapa");retry.setAllCaps(false);retry.setOnClickListener(v->open());panel.addView(retry,new LinearLayout.LayoutParams(-2,-2));TextView credit=new TextView(getContext());credit.setText("Imagens: Esri e colaboradores");credit.setTextColor(0xffbfd1df);credit.setTextSize(12);credit.setGravity(Gravity.CENTER);panel.addView(credit,new LinearLayout.LayoutParams(-1,-2));addView(panel,new LayoutParams(-1,-1));}
 private final class Bridge {
  @JavascriptInterface public void selectEvent(String id){if(id==null||id.length()>1400)return;main.post(()->{if(closed||!active)return;Alert event=events.get(id);if(event!=null&&listener!=null)listener.onEventSelected(event.copy());});}
 }
}



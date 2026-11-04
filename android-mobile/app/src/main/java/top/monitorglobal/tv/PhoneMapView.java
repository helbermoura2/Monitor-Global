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

/** Local MapLibre page with a small ID-only bridge; no TV overlay or location permission. */
final class PhoneMapView extends FrameLayout {
 interface Listener { void onEventSelected(Alert alert); }
 static final String ASSET_PREFIX="/assets/v"+top.monitorglobal.mobile.BuildConfig.VERSION_CODE+"/";
 static final String PAGE="https://appassets.androidplatform.net"+ASSET_PREFIX+"phone-map.html";
 private final Handler main=new Handler(Looper.getMainLooper());
 private final Listener listener;
 private final WebViewAssetLoader loader;
 private final Map<String,Alert> events=new LinkedHashMap<>();
 private final Bridge bridge=new Bridge();
 private WebView web;
 private boolean closed,ready,active=true;
 private String pendingEvents="[]",pendingFocus="";

 PhoneMapView(Context context,Listener selected){
  super(context);listener=selected;setBackgroundColor(0xff071724);
  loader=new WebViewAssetLoader.Builder().addPathHandler(ASSET_PREFIX,new WebViewAssetLoader.AssetsPathHandler(context)).build();
  open();
 }
 private void open(){
  if(closed)return;disposeWeb();removeAllViews();ready=false;
  try{
   WebView current=new WebView(getContext());web=current;
   current.setBackgroundColor(0xff071724);
   WebSettings settings=current.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);
   settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
   settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);settings.setMediaPlaybackRequiresUserGesture(true);settings.setSafeBrowsingEnabled(true);
   current.addJavascriptInterface(bridge,"MonitorMapBridge");
   current.setWebViewClient(new WebViewClient(){
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
     Uri uri=request.getUrl();
     if(localAsset(uri)){WebResourceResponse response=loader.shouldInterceptRequest(uri);return response==null?blocked():response;}
     return tileResource(uri)||satelliteResource(uri)?null:blocked();
    }
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
     if(mainPage(request.getUrl()))return false;
     if(request.isForMainFrame()&&request.hasGesture()&&attributionLink(request.getUrl()))try{getContext().startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(RuntimeException ignored){}
     return true;
    }
    @Override public void onPageFinished(WebView view,String url){if(!closed&&web==view&&mainPage(Uri.parse(url))){ready=true;sendEvents();sendFocus();if(!active)script("window.MonitorMap&&window.MonitorMap.pause()");}}
    @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame()&&web==view)unavailable();}
    @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&web==view)unavailable();}
    @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){if(web==view)unavailable();return true;}
   });
   addView(current,new LayoutParams(-1,-1));current.loadUrl(PAGE);if(!active)current.onPause();
  }catch(RuntimeException failure){unavailable();}
 }
 static boolean mainPage(Uri uri){return localAsset(uri)&&(ASSET_PREFIX+"phone-map.html").equals(uri.getPath())&&uri.getQuery()==null;}
 static boolean localAsset(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith(ASSET_PREFIX);}
 static boolean tileResource(Uri uri){return "https".equalsIgnoreCase(uri.getScheme())&&"server.arcgisonline.com".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith("/ArcGIS/rest/services/World_Imagery/MapServer/tile/");}
 static boolean satelliteResource(Uri uri){if(!"https".equalsIgnoreCase(uri.getScheme())||!"gibs.earthdata.nasa.gov".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1)return false;String p=uri.getPath();if("/legends/Clean_Longwave_Infrared_Window_Band_H.png".equals(p))return true;String layer=uri.getQueryParameter("LAYERS");if(layer==null)layer=uri.getQueryParameter("LAYER");return "GOES-East_ABI_Band13_Clean_Infrared".equals(layer)&&("/wms/epsg3857/best/wms.cgi".equals(p)||"/wmts/epsg3857/best/wmts.cgi".equals(p));}
 static boolean attributionLink(Uri uri){if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getPort()!=-1)return false;String host=uri.getHost();return "www.earthdata.nasa.gov".equalsIgnoreCase(host)||"www.esri.com".equalsIgnoreCase(host)||"www.arcgis.com".equalsIgnoreCase(host)||"maplibre.org".equalsIgnoreCase(host);}
 private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream("Recurso indisponível".getBytes(StandardCharsets.UTF_8)));}

 void setEvents(List<Alert> values){
  if(closed)return;events.clear();JSONArray payload=new JSONArray();int accepted=0;
  if(values!=null)for(Alert event:values){if(event==null||event.id==null||event.id.isEmpty()||event.id.length()>1400)continue;if(accepted++>=120)break;events.put(event.id,event.copy());}
  for(Alert event:events.values()){if(!MapFrame.located(event.originLongitude,event.originLatitude))continue;
   try{payload.put(new JSONObject().put("id",event.id).put("kind",event.kind).put("title",event.title).put("longitude",event.originLongitude).put("latitude",event.originLatitude));}catch(JSONException ignored){}
  }
  pendingEvents=payload.toString();sendEvents();
 }
 void focus(Alert event){if(closed||event==null||!MapFrame.located(event.originLongitude,event.originLatitude))return;try{pendingFocus=new JSONObject().put("id",event.id).put("longitude",event.originLongitude).put("latitude",event.originLatitude).toString();sendFocus();}catch(JSONException ignored){}}
 private void sendEvents(){if(ready&&active)script("window.MonitorMap&&window.MonitorMap.setEvents(JSON.parse("+quote(pendingEvents)+"))");}
 private void sendFocus(){if(ready&&active&&web!=null&&!pendingFocus.isEmpty()){String value=pendingFocus;pendingFocus="";script("window.MonitorMap&&window.MonitorMap.focus(JSON.parse("+quote(value)+"))");}}
 private static String quote(String value){return JSONObject.quote(value).replace("\u2028","\\u2028").replace("\u2029","\\u2029");}
 private void script(String value){if(web!=null&&!closed)web.evaluateJavascript(value,null);}
 void pause(){active=false;if(web!=null){script("window.MonitorMap&&window.MonitorMap.pause()");web.onPause();}}
 void resume(){if(closed)return;active=true;if(web!=null){web.onResume();script("window.MonitorMap&&window.MonitorMap.resume()");sendEvents();sendFocus();}}
 void close(){if(closed)return;closed=true;ready=false;active=false;main.removeCallbacksAndMessages(null);events.clear();pendingEvents="[]";pendingFocus="";disposeWeb();removeAllViews();}
 private void disposeWeb(){WebView old=web;web=null;if(old!=null){removeView(old);old.removeJavascriptInterface("MonitorMapBridge");old.stopLoading();old.destroy();}}
 private void unavailable(){if(closed)return;ready=false;disposeWeb();removeAllViews();LinearLayout panel=new LinearLayout(getContext());panel.setOrientation(LinearLayout.VERTICAL);panel.setGravity(Gravity.CENTER);int pad=Math.round(20*getResources().getDisplayMetrics().density);panel.setPadding(pad,pad,pad,pad);TextView message=new TextView(getContext());message.setText("Mapa indisponível no momento. Os dados dos eventos continuam acessíveis na lista.");message.setTextColor(Color.WHITE);message.setTextSize(17);message.setGravity(Gravity.CENTER);panel.addView(message,new LinearLayout.LayoutParams(-1,-2));Button retry=new Button(getContext());retry.setText("Recarregar mapa");retry.setAllCaps(false);retry.setOnClickListener(v->open());panel.addView(retry,new LinearLayout.LayoutParams(-2,-2));TextView credit=new TextView(getContext());credit.setText("Imagens: Esri e colaboradores");credit.setTextColor(0xffbfd1df);credit.setTextSize(12);credit.setGravity(Gravity.CENTER);panel.addView(credit,new LinearLayout.LayoutParams(-1,-2));addView(panel,new LayoutParams(-1,-1));}
 private final class Bridge {
  @JavascriptInterface public void selectEvent(String id){if(id==null||id.length()>1400)return;main.post(()->{if(closed||!active)return;Alert event=events.get(id);if(event!=null&&listener!=null)listener.onEventSelected(event.copy());});}
 }
}

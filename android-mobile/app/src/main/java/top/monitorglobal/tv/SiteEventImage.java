package top.monitorglobal.tv;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

final class SiteEventImage {
 private static final String PAGE="https://argosorbis.com.br/mobile-event-image";
 private static final int MAX_LENGTH=12_000_000, CHUNK_LENGTH=64_000;
 interface Result { void ready(Uri uri); }

 private final Context context;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable deadline=()->finish(null);
 private final Result result;
 private WebView web;
 private boolean started;

 SiteEventImage(Context context,Alert source,Result result){
  this.context=context;
  this.result=result;
  try{
   boolean quake=source.kind.equals("earthquake");
   JSONObject record=new JSONObject().put("id",source.id).put("type",source.kind)
    .put("time",source.eventTime>0?source.eventTime:source.issuedAt)
    .put("place",quake?PhoneActivity.location(source):source.targetArea.isEmpty()?source.title:source.targetArea)
    .put("source",source.source).put("countryCode",source.countryCode);
   if(Double.isFinite(source.magnitude))record.put("mag",source.magnitude);
   if(quake&&MapFrame.located(source.originLongitude,source.originLatitude))
    record.put("coords",new JSONArray().put(source.originLongitude).put(source.originLatitude));
   if(!quake){
    record.put("statusLabel",PhoneActivity.tsunamiState(source.state));
    record.put("region",source.targetArea.isEmpty()?source.title:source.targetArea);
    record.put("descOnly",source.tsunamiSummary.isEmpty()?source.detail:source.tsunamiSummary);
   }
   if(Double.isFinite(source.depth)&&source.depth>=0)record.put("depth",source.depth);
   web=new WebView(context);
   web.getSettings().setJavaScriptEnabled(true);
   web.getSettings().setAllowFileAccess(false);
   web.getSettings().setAllowContentAccess(false);
   web.setWebViewClient(new WebViewClient(){
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
     return request.isForMainFrame()&&!PAGE.equals(request.getUrl().toString());
    }
    @Override public void onPageFinished(WebView view,String url){
     if(web!=view||started||!PAGE.equals(url))return;
     started=true;
     web.evaluateJavascript("window.ArgosMobileImage?.render("+record+"); true",value->poll());
    }
    @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
     if(request.isForMainFrame())finish(null);
    }
   });
   handler.postDelayed(deadline,18000);
   web.loadUrl(PAGE);
  }catch(org.json.JSONException | RuntimeException e){
   handler.post(()->finish(null));
  }
 }

 private boolean closed;
 private void poll(){
  if(web==null)return;
  web.evaluateJavascript("window.ArgosMobileImage?.status()",value->{
   if(web==null)return;
   try{
    Object state=new JSONTokener(value).nextValue();
    if(state instanceof Integer){
     int length=(Integer)state;
     if(length<=0||length>MAX_LENGTH||length%4!=0){finish(null);return;}
     read(new StringBuilder(length),length);
    }else if("pending".equals(state))handler.postDelayed(this::poll,300);
    else finish(null);
   }catch(org.json.JSONException | RuntimeException e){finish(null);}
  });
 }

 private void read(StringBuilder data,int length){
  if(web==null)return;
  web.evaluateJavascript("window.ArgosMobileImage.chunk("+data.length()+")",value->{
   if(web==null)return;
   try{
    Object chunk=new JSONTokener(value).nextValue();
    if(!(chunk instanceof String)||((String)chunk).length()!=Math.min(CHUNK_LENGTH,length-data.length())){
     finish(null);return;
    }
    data.append((String)chunk);
    if(data.length()<length){read(data,length);return;}
    byte[] png=android.util.Base64.decode(data.toString(),android.util.Base64.NO_WRAP);
    finish(EventShareCard.fromSite(context,png));
   }catch(org.json.JSONException | IOException | RuntimeException e){finish(null);}
  });
 }

 void cancel(){
  closed=true;
  handler.removeCallbacksAndMessages(null);
  if(web==null)return;
  WebView view=web;
  web=null;
  view.stopLoading();
  view.destroy();
 }

 private void finish(Uri uri){
  if(closed)return;
  cancel();
  result.ready(uri);
 }
}

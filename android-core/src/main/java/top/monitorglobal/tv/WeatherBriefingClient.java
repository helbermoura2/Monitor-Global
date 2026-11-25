package top.monitorglobal.tv;
import android.content.*;import android.os.*;import java.net.*;import java.io.*;import java.util.*;import java.util.concurrent.*;import org.json.*;
/** Optional, independent I/O. Never blocks forecast delivery or creates a notification. */
final class WeatherBriefingClient implements AutoCloseable {
 private final SharedPreferences cache;private final Handler main=new Handler(Looper.getMainLooper());private final Runnable changed;private final Set<String> busy=new HashSet<>();private final Map<String,Long> retry=new HashMap<>();private final Map<String,Integer> pendingAttempts=new HashMap<>();private final Set<HttpURLConnection> connections=Collections.synchronizedSet(new HashSet<>());private ExecutorService worker;private boolean closed;private int generation;
 WeatherBriefingClient(Context c,Runnable callback){cache=c.getApplicationContext().getSharedPreferences("weather-ai",Context.MODE_PRIVATE);changed=callback;}
 static String text(Context c,String kind,WeatherForecast.Summary w,RainForecast.Summary r){long now=System.currentTimeMillis();WeatherBriefing value=WeatherBriefing.parse(c.getApplicationContext().getSharedPreferences("weather-ai",Context.MODE_PRIVATE).getString(kind,""),now);return value==null?"":value.forForecast(w,r,now);}
 /** Source-derived 30-minute projection; never interpreted as a live measurement. */
 static String outlookText(Context c,RainForecast.Summary rain){
  if(rain==null)return "";
  long now=System.currentTimeMillis();String raw=c.getApplicationContext().getSharedPreferences("weather-ai",Context.MODE_PRIVATE).getString("outlook","");
  try{
   if(raw==null||raw.length()>6000)return "";
   JSONObject d=new JSONObject(raw);String value=d.optString("text","");
   if(!"rain-outlook-v1".equals(d.optString("version"))||!d.optBoolean("ok")||
    !"liberdade".equals(d.optString("area"))||!"Rainbow Weather".equals(d.optString("source"))||
    d.optInt("horizonMinutes")!=30||d.optLong("basedAt")!=rain.at||
    d.optLong("expiresAt")<=now||d.optLong("expiresAt")>rain.expiresAt||
    d.optJSONArray("groups")==null||d.optJSONArray("groups").length()!=3||
    value.length()<20||value.length()>500||value.contains("<")||value.contains(">"))return "";
   return value;
  }catch(JSONException ignored){return "";}
 }
 void prefetch(String kind,WeatherForecast.Summary w,RainForecast.Summary r){
  if(closed||!(kind.equals("hourly")||kind.equals("rain"))||kind.equals("hourly")&&w==null||kind.equals("rain")&&(r==null||r.state.equals("dry")))return;
  // The projection uses published minute-by-minute data, not LLM guesses,
  // and is available even when the AI has nothing new to add.
  if(kind.equals("hourly")&&r!=null)prefetchOutlook(r);
  if(!textFrom(kind,w,r).isEmpty()||busy.contains(kind)||System.currentTimeMillis()<retry.getOrDefault(kind,0L))return;
  busy.add(kind);final int token=generation;if(worker==null)worker=Executors.newFixedThreadPool(2);worker.execute(()->{String raw="";int pending=0;try{raw=read(kind);JSONObject d=new JSONObject(raw);if("pending".equals(d.optString("status")))pending=1;}catch(Exception ignored){}String result=raw;int again=pending;main.post(()->{if(closed||token!=generation)return;busy.remove(kind);WeatherBriefing value=WeatherBriefing.parse(result,System.currentTimeMillis());if(value!=null){cache.edit().putString(kind,result).apply();retry.remove(kind);pendingAttempts.remove(kind);if(changed!=null)changed.run();}else{int attempts=pendingAttempts.getOrDefault(kind,0)+1;pendingAttempts.put(kind,attempts);long delay=again==1&&attempts<=4?2000:300000;retry.put(kind,System.currentTimeMillis()+delay);if(again==1&&attempts<=4)main.postDelayed(()->prefetch(kind,w,r),delay);}});});
 }
 private void prefetchOutlook(RainForecast.Summary rain){
  if(closed||rain==null||!outlookTextFrom(rain).isEmpty()||busy.contains("outlook")||
   System.currentTimeMillis()<retry.getOrDefault("outlook",0L))return;
  busy.add("outlook");
  final int ticket=generation;
  if(worker==null)worker=Executors.newFixedThreadPool(2);
  worker.execute(()->{
   String result="";
   try{result=read("outlook");}catch(Exception ignored){}
   final String raw=result;
   main.post(()->{
    if(closed||generation!=ticket)return;
    busy.remove("outlook");
    try{
     JSONObject d=new JSONObject(raw);
     if(!d.optBoolean("ok")||!"rain-outlook-v1".equals(d.optString("version"))||
      d.optLong("basedAt")!=rain.at)throw new JSONException("Not matching");
     cache.edit().putString("outlook",raw).apply();
     retry.remove("outlook");if(changed!=null)changed.run();
    }catch(Exception ignored){retry.put("outlook",System.currentTimeMillis()+120000);}
   });
  });
 }
 private String outlookTextFrom(RainForecast.Summary rain){
  try{
   String raw=cache.getString("outlook","");
   if(raw==null||raw.length()>6000)return "";
   JSONObject d=new JSONObject(raw);
   if(!d.optBoolean("ok")||!"rain-outlook-v1".equals(d.optString("version"))||
    d.optLong("basedAt")!=rain.at||d.optLong("expiresAt")<=System.currentTimeMillis())return "";
   return d.optString("text","");
  }catch(JSONException e){return "";}
 }
 private String textFrom(String kind,WeatherForecast.Summary w,RainForecast.Summary r){WeatherBriefing b=WeatherBriefing.parse(cache.getString(kind,""),System.currentTimeMillis());return b==null?"":b.forForecast(w,r,System.currentTimeMillis());}
 private String read(String kind)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL("https://black-sky-9ba0.terrestre.workers.dev/"+(kind.equals("outlook")?"weather-outlook?area=liberdade":"weather-briefing?kind="+kind)).openConnection();connections.add(c);c.setConnectTimeout(4000);c.setReadTimeout(6000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MonitorGlobalWeatherBriefing");try{if(c.getResponseCode()!=200)throw new IOException("Unavailable");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>6000)throw new IOException("Too large");bytes.write(b,0,n);}}return bytes.toString("UTF-8");}finally{c.disconnect();connections.remove(c);}}
 void pause(){generation++;main.removeCallbacksAndMessages(null);busy.clear();synchronized(connections){for(HttpURLConnection c:connections)c.disconnect();connections.clear();}}
 public void close(){closed=true;pause();if(worker!=null)worker.shutdownNow();}
}

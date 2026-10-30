package top.monitorglobal.tv;
import android.content.*;import android.os.*;import java.net.*;import java.io.*;import java.util.concurrent.*;import java.util.function.BooleanSupplier;import org.json.*;
/** One optional meteorological card, independent I/O and the existing minute pulse. */
final class RainMonitor {
 private final Callable<JSONObject> reader,weatherReader;private final Context context;private final BooleanSupplier allowed;private final Handler main=new Handler(Looper.getMainLooper());private final RainOverlay overlay;
 private ExecutorService worker;private boolean busy,weatherBusy,closed,manualWeather;private volatile HttpURLConnection connection;private int lastMode;private boolean lastHourly;private JSONObject data,weatherData;private long nextRead,nextWeatherRead,demoUntil,manualUntil;private int manualGeneration;private final Runnable demoEnd=()->{demoUntil=0;};private Runnable manualFinished=()->{};
 RainMonitor(Context c,BooleanSupplier free){this(c,free,null,null);}
 RainMonitor(Context c,BooleanSupplier free,Callable<JSONObject> read){this(c,free,read,null);}
 RainMonitor(Context c,BooleanSupplier free,Callable<JSONObject> read,Callable<JSONObject> hourly){context=c;allowed=free;if(!Prefs.get(c).getString("rainArea","").equals("liberdade-v1"))Prefs.get(c).edit().putString("rainArea","liberdade-v1").remove("rainLastKey").remove("rainLastNotice").remove("rainLastValidAt").putString("rainStatus","Liberdade: aguardando consulta").apply();reader=read==null?()->read("tv-rain?area=liberdade"):read;weatherReader=hourly==null?()->read("tv-weather"):hourly;lastMode=mode();lastHourly=hourly();overlay=new RainOverlay(c);}
 private int mode(){return Prefs.get(context).getInt("rainMode",2);}
 private boolean hourly(){return Prefs.get(context).getBoolean("weatherHourly",true);}
 private boolean screen(){PowerManager p=context.getSystemService(PowerManager.class);return p==null||p.isInteractive();}
 void setManualFinished(Runnable callback){manualFinished=callback;}
 void weatherNow(){manualGeneration++;manualWeather=true;tick();}
 boolean manualPending(){return manualWeather||SystemClock.elapsedRealtime()<manualUntil;}
 void tick(){
  if(closed)return;int selected=mode();boolean enabled=hourly();if(selected!=lastMode||enabled!=lastHourly){hide();lastMode=selected;lastHourly=enabled;}
  if((selected==0&&!enabled&&!manualWeather)||!screen()){hide();return;}if(SystemClock.elapsedRealtime()<demoUntil)return;
  long now=System.currentTimeMillis();RainForecast.Summary rain=null;WeatherForecast.Summary weather=null;
  try{if(data!=null)rain=RainForecast.summarize(data,now);}catch(JSONException ignored){}
  try{if(weatherData!=null&&(enabled||manualWeather))weather=WeatherForecast.summarize(weatherData,now);}catch(JSONException ignored){}
  Prefs.get(context).edit().putString("weatherStatus",weather==null?"Liberdade: previsão horária indisponível ou aguardando consulta":"Liberdade: "+weather.temperature+" · "+weather.condition).apply();
  boolean due=enabled&&WeatherForecast.due(Prefs.get(context).getLong("weatherLastNotice",0),now),wanted=due||manualWeather;
  Prefs.get(context).edit().putString("rainStatus",rain==null?"Liberdade: chuva por minuto indisponível ou vencida":"Liberdade: "+rain.title).apply();
  String previous=Prefs.get(context).getString("rainLastKey","");if(rain!=null){previous=RainNoticePolicy.previousAfterGap(previous,Prefs.get(context).getLong("rainLastValidAt",0),now);Prefs.get(context).edit().putLong("rainLastValidAt",now).apply();}
  boolean rainNotice=selected>0&&RainNoticePolicy.shouldShow(rain,previous,Prefs.get(context).getLong("rainLastNotice",0),now);
  // Do not start a 12-second presentation with source data about to expire.
  if(weather!=null&&weather.expiresAt-now<13000)weather=null;
  RainForecast.Summary displayRain=rain!=null&&rain.expiresAt-now>=13000?rain:null;
  if((enabled||manualWeather)&&weather==null&&!weatherBusy&&SystemClock.elapsedRealtime()>=nextWeatherRead)fetch(true);
  if((selected>0||wanted&&weather!=null)&&!busy&&SystemClock.elapsedRealtime()>=nextRead)fetch(false);
  boolean shown=false;
  if(allowed.getAsBoolean()){
   if(wanted&&weather!=null&&!busy){shown=overlay.show(displayRain,selected==2,false,weather);if(shown){if(due)Prefs.get(context).edit().putLong("weatherLastNotice",now).apply();finishManual(true);}}
   else if(rainNotice&&!(wanted&&weatherBusy)){shown=overlay.show(rain,selected==2,false,weather);}
  }
  if(shown&&rainNotice&&displayRain!=null)Prefs.get(context).edit().putString("rainLastKey",rain.key()).putLong("rainLastNotice",now).apply();
  if(manualWeather&&!weatherBusy&&weatherData!=null&&weather==null&&SystemClock.elapsedRealtime()<nextWeatherRead){Prefs.status(context,"Previsão horária indisponível para a Liberdade. Tente novamente depois.");finishManual(false);}
 }
 private void finishManual(boolean displayed){if(!manualWeather)return;manualWeather=false;int generation=manualGeneration;manualUntil=displayed?SystemClock.elapsedRealtime()+RainOverlay.DURATION+800:0;main.postDelayed(()->{if(!closed&&generation==manualGeneration){manualUntil=0;manualFinished.run();}},displayed?RainOverlay.DURATION+800:0);}
 private void fetch(boolean hourly){
  if(hourly){weatherBusy=true;nextWeatherRead=SystemClock.elapsedRealtime()+300000;}else{busy=true;nextRead=SystemClock.elapsedRealtime()+600000;}
  if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{JSONObject result;try{result=(hourly?weatherReader:reader).call();}catch(Exception ignored){result=new JSONObject();}if(result==null)result=new JSONObject();JSONObject value=result;main.post(()->{if(hourly)weatherBusy=false;else busy=false;if(closed)return;long remaining=value.optBoolean("ok")?value.optLong("expiresAt",0)-System.currentTimeMillis():300000;if(hourly){weatherData=value;nextWeatherRead=SystemClock.elapsedRealtime()+Math.max(60000,Math.min(3600000,remaining));}else{data=value;nextRead=SystemClock.elapsedRealtime()+Math.max(60000,Math.min(600000,remaining));}tick();});});
 }
 private JSONObject read(String path)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("https://black-sky-9ba0.terrestre.workers.dev/"+path).openConnection();connection=c;c.setConnectTimeout(8000);c.setReadTimeout(18000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MonitorGlobalTV/"+BuildConfig.VERSION_NAME);
  try{if(c.getResponseCode()!=200)throw new IOException("Unavailable");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>100000)throw new IOException("Response too large");bytes.write(b,0,n);}}return new JSONObject(bytes.toString("UTF-8"));}finally{c.disconnect();if(connection==c)connection=null;}
 }
 void demo(){try{long now=System.currentTimeMillis();JSONObject d=new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE));JSONArray points=new JSONArray();long start=now/60000*60000;for(int i=0;i<90;i++)points.put(new JSONObject().put("start",start+i*60000).put("end",start+(i+1)*60000).put("rate",i<30?8:0).put("type",i<30?"rain":"no_precipitation"));d.put("forecast",points);RainForecast.Summary s=RainForecast.summarize(d,now);if(s!=null){hide();demoUntil=SystemClock.elapsedRealtime()+RainOverlay.DURATION+700;overlay.show(s,true,true);main.postDelayed(demoEnd,RainOverlay.DURATION+700);}}catch(JSONException ignored){}}
 void hide(){demoUntil=0;main.removeCallbacks(demoEnd);overlay.hide();}
 void close(){closed=true;hide();main.removeCallbacksAndMessages(null);if(connection!=null)connection.disconnect();if(worker!=null)worker.shutdownNow();data=null;weatherData=null;}
}

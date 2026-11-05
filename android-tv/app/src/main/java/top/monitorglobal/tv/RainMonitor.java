package top.monitorglobal.tv;
import android.content.*;import android.os.*;import java.net.*;import java.io.*;import java.util.concurrent.*;import java.util.function.BooleanSupplier;import org.json.*;
/** One optional meteorological card, independent I/O and the existing minute pulse. */
final class RainMonitor {
 static final long MANUAL_DELAY=10000;
 private final Callable<JSONObject> reader,weatherReader;private final Context context;private final BooleanSupplier allowed;private final Handler main=new Handler(Looper.getMainLooper());private final RainOverlay overlay;private final WeatherSatelliteSequence satellite;private boolean lastSatellite;
 private WeatherBriefingClient briefing;private ExecutorService worker;private boolean busy,weatherBusy,closed,manualWeather;private volatile HttpURLConnection connection;private int lastMode;private boolean lastHourly;private JSONObject data,weatherData;private long nextRead,nextWeatherRead,demoUntil,manualUntil,manualNotBefore;private int manualGeneration;private final Runnable demoEnd=()->{demoUntil=0;};private final Runnable manualStart=this::tick;private Runnable manualFinished=()->{};
 RainMonitor(Context c,BooleanSupplier free){this(c,free,null,null);}
 RainMonitor(Context c,BooleanSupplier free,Callable<JSONObject> read){this(c,free,read,null);}
 RainMonitor(Context c,BooleanSupplier free,Callable<JSONObject> read,Callable<JSONObject> hourly){this(c,free,read,hourly,null);}
 RainMonitor(Context c,BooleanSupplier free,Callable<JSONObject> read,Callable<JSONObject> hourly,WeatherSatelliteSequence sequence){context=c;allowed=free;if(!Prefs.get(c).getString("rainArea","").equals("liberdade-v1")||Prefs.get(c).getInt("rainDeliveryVersion",0)<2)Prefs.get(c).edit().putString("rainArea","liberdade-v1").putInt("rainDeliveryVersion",2).remove("rainLastKey").remove("rainLastNotice").remove("rainLastValidAt").putString("rainStatus","Liberdade: aguardando consulta").apply();reader=read==null?()->read("tv-rain?area=liberdade"):read;weatherReader=hourly==null?()->read("tv-weather"):hourly;lastMode=mode();lastHourly=hourly();overlay=new RainOverlay(c);if(read==null&&hourly==null)briefing=new WeatherBriefingClient(c,()->{if(!closed&&screen())overlay.refreshBriefing();});lastSatellite=satelliteEnabled();satellite=sequence==null?new WeatherSatelliteSequence(c,()->allowed.getAsBoolean()&&screen()):sequence;}
 private int mode(){return Prefs.get(context).getInt("rainMode",2);}
 private boolean satelliteEnabled(){return Prefs.get(context).getBoolean("weatherSatellite",true);}
 private boolean hourly(){return Prefs.get(context).getBoolean("weatherHourly",true);}
 private boolean screen(){PowerManager p=context.getSystemService(PowerManager.class);return p==null||p.isInteractive();}
 void setManualFinished(Runnable callback){manualFinished=callback;}
 void weatherNow(){if(closed)return;main.removeCallbacks(manualStart);manualGeneration++;manualWeather=true;manualUntil=0;manualNotBefore=SystemClock.elapsedRealtime()+MANUAL_DELAY;hide();main.postDelayed(manualStart,MANUAL_DELAY);tick();}
 boolean manualPending(){return manualWeather||SystemClock.elapsedRealtime()<manualUntil||satellite.pending();}
 void tick(){
  if(closed)return;int selected=mode();boolean enabled=hourly();if(selected!=lastMode||enabled!=lastHourly||satelliteEnabled()!=lastSatellite){hide();lastMode=selected;lastHourly=enabled;lastSatellite=satelliteEnabled();}
  if((selected==0&&!enabled&&!manualPending())||!screen()){hide();return;}if(SystemClock.elapsedRealtime()<demoUntil)return;
  long now=System.currentTimeMillis();RainForecast.Summary rain=null;WeatherForecast.Summary weather=null;
  try{if(data!=null)rain=RainForecast.summarize(data,now);}catch(JSONException ignored){}
  try{if(weatherData!=null&&(enabled||manualWeather))weather=WeatherForecast.summarize(weatherData,now);}catch(JSONException ignored){}
  Prefs.get(context).edit().putString("weatherStatus",weather==null?"Liberdade: previsão horária indisponível ou aguardando consulta":"Liberdade: "+weather.temperature+" · "+weather.condition).apply();
  boolean due=enabled&&WeatherForecast.due(Prefs.get(context).getLong("weatherLastNotice",0),now),wanted=due||manualWeather;
  if(wanted&&satelliteEnabled()&&allowed.getAsBoolean())satellite.prepare();
  Prefs.get(context).edit().putString("rainStatus",rain==null?"Liberdade: chuva por minuto indisponível ou vencida":"Liberdade: "+rain.title).apply();
  String previous=Prefs.get(context).getString("rainLastKey","");if(rain!=null){previous=RainNoticePolicy.previousAfterGap(previous,Prefs.get(context).getLong("rainLastValidAt",0),now);Prefs.get(context).edit().putLong("rainLastValidAt",now).apply();}
  boolean rainNotice=selected>0&&RainNoticePolicy.shouldShow(rain,previous,Prefs.get(context).getLong("rainLastNotice",0),now);
  // Do not start a 12-second presentation with source data about to expire.
  if(weather!=null&&weather.expiresAt-now<13000)weather=null;
  RainForecast.Summary displayRain=rain!=null&&rain.expiresAt-now>=13000?rain:null;
  if((enabled||manualWeather)&&weather==null&&!weatherBusy&&SystemClock.elapsedRealtime()>=nextWeatherRead)fetch(true);
  if((selected>0||wanted&&weather!=null)&&!busy&&SystemClock.elapsedRealtime()>=nextRead)fetch(false);
  if(briefing!=null){if(wanted&&weather!=null)briefing.prefetch("hourly",weather,rain);if(rainNotice&&displayRain!=null)briefing.prefetch("rain",weather,displayRain);}
  boolean waiting=manualWeather&&SystemClock.elapsedRealtime()<manualNotBefore;
  boolean shown=false;
  Runnable delivered=rainNotice&&displayRain!=null?rainDelivered(displayRain,now,manualWeather):null;
  if(!waiting&&allowed.getAsBoolean()&&!overlay.showing()){
   if(wanted&&weather!=null&&!busy){shown=overlay.show(displayRain,selected==2,false,weather,false,delivered);if(shown){if(satelliteEnabled())satellite.start();if(due)Prefs.get(context).edit().putLong("weatherLastNotice",now).apply();finishManual(true);}}
   else if(rainNotice&&displayRain!=null&&!(wanted&&weatherBusy)){shown=overlay.showRain(displayRain,selected==2,false,weather,false,delivered);}
  }
  if(!waiting&&manualWeather&&!weatherBusy&&weatherData!=null&&weather==null&&SystemClock.elapsedRealtime()<nextWeatherRead){Prefs.status(context,"Previsão horária indisponível para a Liberdade. Tente novamente depois.");finishManual(false);}
 }
 private Runnable rainDelivered(RainForecast.Summary rain,long shownAt,boolean manual){String key=rain.key();return ()->{if(!closed)Prefs.get(context).edit().putString("rainLastKey",key).putLong("rainLastNotice",shownAt).putLong(manual?"rainLastManualNotice":"rainLastAutomaticNotice",shownAt).apply();};}
 private void finishManual(boolean displayed){long presentation=satelliteEnabled()?WeatherSatelliteSequence.TOTAL:RainOverlay.DURATION;if(!manualWeather)return;if(!displayed)satellite.cancel();manualWeather=false;manualNotBefore=0;main.removeCallbacks(manualStart);if(displayed)Prefs.status(context,"Meteorologia exibida · Liberdade.");int generation=manualGeneration;manualUntil=displayed?SystemClock.elapsedRealtime()+presentation+800:0;main.postDelayed(()->{if(!closed&&generation==manualGeneration){manualUntil=0;manualFinished.run();}},displayed?presentation+800:0);}
 private void fetch(boolean hourly){
  if(hourly){weatherBusy=true;nextWeatherRead=SystemClock.elapsedRealtime()+300000;}else{busy=true;nextRead=SystemClock.elapsedRealtime()+600000;}
  if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{JSONObject result;try{result=(hourly?weatherReader:reader).call();}catch(Exception ignored){result=new JSONObject();}if(result==null)result=new JSONObject();JSONObject value=result;main.post(()->{if(hourly)weatherBusy=false;else busy=false;if(closed)return;long remaining=value.optBoolean("ok")?value.optLong("expiresAt",0)-System.currentTimeMillis():300000;if(hourly){weatherData=value;nextWeatherRead=SystemClock.elapsedRealtime()+Math.max(60000,Math.min(3600000,remaining));}else{data=value;nextRead=SystemClock.elapsedRealtime()+Math.max(60000,Math.min(600000,remaining));}tick();});});
 }
 private JSONObject read(String path)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("https://black-sky-9ba0.terrestre.workers.dev/"+path).openConnection();connection=c;c.setConnectTimeout(8000);c.setReadTimeout(18000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MonitorGlobalTV/"+BuildConfig.VERSION_NAME);
  try{if(c.getResponseCode()!=200)throw new IOException("Unavailable");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>100000)throw new IOException("Response too large");bytes.write(b,0,n);}}return new JSONObject(bytes.toString("UTF-8"));}finally{c.disconnect();if(connection==c)connection=null;}
 }
 void demo(){demo(false);}
 void demo(boolean stormPreview){try{long now=System.currentTimeMillis();JSONObject d=new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE));JSONArray points=new JSONArray();long start=now/60000*60000;for(int i=0;i<90;i++)points.put(new JSONObject().put("start",start+i*60000).put("end",start+(i+1)*60000).put("rate",i<30?(stormPreview?WeatherPreviewOptions.rate(context):8):0).put("type",i<30?"rain":"no_precipitation"));d.put("forecast",points);RainForecast.Summary s=RainForecast.summarize(d,now);if(s!=null){hide();demoUntil=SystemClock.elapsedRealtime()+RainOverlay.DURATION+700;WeatherForecast.Summary example=stormPreview?new WeatherForecast.Summary("22°C · sensação 23°C","Chuva · exemplo fictício","Vento 12 km/h · rajadas 19 km/h","Umidade 81%","SIMULAÇÃO · dados fictícios",now+600000):null;if(stormPreview)s=s.withPresentation(s.level,WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(context)]+" · cenário fictício");overlay.showRain(s,true,true,example,stormPreview,null);main.postDelayed(demoEnd,RainOverlay.DURATION+700);}}catch(JSONException ignored){}}
 void hide(){if(briefing!=null)briefing.pause();satellite.cancel();demoUntil=0;main.removeCallbacks(demoEnd);overlay.hide();}
 void close(){closed=true;if(briefing!=null)briefing.close();satellite.close();manualWeather=false;manualUntil=0;manualNotBefore=0;hide();main.removeCallbacksAndMessages(null);if(connection!=null)connection.disconnect();if(worker!=null)worker.shutdownNow();data=null;weatherData=null;}
}

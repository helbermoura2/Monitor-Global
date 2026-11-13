package top.monitorglobal.tv;

import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/** Foreground, on-demand phone data. Call refresh on one worker, never on the UI thread. */
final class PhoneRepository implements AutoCloseable {
 static final String COVERAGE="M6+ globais, Brasil e áreas monitoradas";
 static final String FEED="tv-alerts?policy=telegram-v1",WEATHER="tv-weather",RAIN="tv-rain?area=liberdade",HOURLY="rain-weather?lat=-23.555&lng=-46.635",DAILY="tv-alerts?view=completed&policy=telegram-v1";
 static final int FEED_LIMIT=256*1024,WEATHER_LIMIT=100000,CACHE_LIMIT=512*1024;
 static final long RETRY=5*60000L;
 interface Transport {Response get(String path,String etag,int limit)throws Exception;void cancel();}
 static final class Response {
  final int status;final String body,etag;
  Response(int code,String json,String tag){status=code;body=json==null?"":json;etag=cleanEtag(tag);}
 }
 static final class Snapshot {
  PhoneRainChart.Series rainSeries;List<PhoneHourly.Hour> hours=Collections.emptyList();List<Alert> daily=Collections.emptyList();String dailyDay="";boolean dailyAvailable;String hourlyStatus="Previsão por hora ainda não consultada";final List<Alert> events;final WeatherForecast.Summary weather;final RainForecast.Summary rain;
  final long refreshedAt;final String feedStatus,weatherStatus,rainStatus;final boolean saved,quakeOk,tsunamiOk;
  Snapshot(List<Alert> list,WeatherForecast.Summary w,RainForecast.Summary r,long at,String feed,String weatherState,String rainState,boolean cached,boolean quakes,boolean tsunamis){
   ArrayList<Alert> copy=new ArrayList<>();if(list!=null)for(Alert a:list){Alert item=a.copy();if(a.companion!=null)item.companion=a.companion.copy();copy.add(item);}events=Collections.unmodifiableList(copy);
   weather=w;rain=r;refreshedAt=at;feedStatus=feed;weatherStatus=weatherState;rainStatus=rainState;saved=cached;quakeOk=quakes;tsunamiOk=tsunamis;
  }
 }
 private final Transport transport;private final AtomicLong generation=new AtomicLong();private volatile boolean closed;
 private JSONObject feedData,weatherData,rainData,hourlyData,dailyData;private long nextHourly,nextDaily,lastHourlyAttempt,lastDailyAttempt;private List<Alert> events=new ArrayList<>();private String etag="";
 private long refreshedAt,nextWeather,nextRain;private boolean feedSaved,quakeOk,tsunamiOk;
 private String hourlyStatus="Previsão por hora ainda não consultada";
 private String feedStatus="Aguardando consulta dos eventos",weatherStatus="Aguardando previsão para a Liberdade",rainStatus="Aguardando chuva por minuto";
 PhoneRepository(){this(new HttpTransport());}
 PhoneRepository(Transport source){transport=Objects.requireNonNull(source);}
 Snapshot refresh(long now){return refresh(now,false);}
 Snapshot refresh(long now,boolean forceWeather){
  if(closed)return snapshot(now);if(forceWeather)synchronized(this){nextHourly=lastHourlyAttempt=0;}long ticket=generation.get(),started=System.nanoTime();
  refreshFeed(now,ticket);if(!active(ticket))return snapshot(afterElapsed(now,started));
  boolean requestWeather,requestRain;
  synchronized(this){requestWeather=(forceWeather||weather(now)==null)&& (forceWeather||now>=nextWeather);requestRain=(forceWeather||rain(now)==null)&&(forceWeather||now>=nextRain);}
  if(requestWeather)refreshForecast(now,ticket,true);if(!active(ticket))return snapshot(afterElapsed(now,started));
  if(requestRain)refreshForecast(now,ticket,false);return snapshot(afterElapsed(now,started));
 }
 private static long afterElapsed(long now,long started){return now+Math.max(0,(System.nanoTime()-started)/1000000);}
 private boolean active(long ticket){return !closed&&generation.get()==ticket;}
 private void refreshFeed(long now,long ticket){
  String tag;synchronized(this){tag=etag;}
  try{
   Response response=transport.get(FEED,tag,FEED_LIMIT);if(!active(ticket))return;
   if(response.status==304){synchronized(this){if(!active(ticket))return;if(feedData==null)throw new IOException("No cached feed");refreshedAt=now;feedSaved=false;feedStatus=sourceStatus(quakeOk,tsunamiOk);}return;}
   JSONObject candidate=object(response,FEED_LIMIT);Parsed parsed=parseFeed(candidate,now);
   synchronized(this){if(!active(ticket))return;feedData=candidate;events=parsed.events;quakeOk=parsed.quakeOk;tsunamiOk=parsed.tsunamiOk;etag=response.etag;refreshedAt=now;feedSaved=false;feedStatus=sourceStatus(quakeOk,tsunamiOk);}
  }catch(Exception error){synchronized(this){if(!active(ticket))return;feedSaved=feedData!=null;feedStatus=feedSaved?"Sem atualização confirmada · mostrando eventos salvos":"Eventos indisponíveis · tente atualizar";}}
 }
 private void refreshForecast(long now,long ticket,boolean hourly){
  try{
   Response response=transport.get(hourly?WEATHER:RAIN,"",WEATHER_LIMIT);if(!active(ticket))return;
   JSONObject candidate=object(response,WEATHER_LIMIT);
   boolean valid=hourly?WeatherForecast.summarize(candidate,now)!=null:RainForecast.summarize(candidate,now)!=null;
   if(!valid)throw new IOException("Invalid or expired forecast");
   synchronized(this){if(!active(ticket))return;if(hourly){weatherData=candidate;nextWeather=0;weatherStatus="Modelo horário · Liberdade, SP";}else{rainData=candidate;nextRain=0;rainStatus="Previsão por minuto · Liberdade, SP";}}
  }catch(Exception error){synchronized(this){if(!active(ticket))return;if(hourly){nextWeather=now+RETRY;weatherStatus=weather(now)==null?"Previsão horária indisponível":"Previsão horária válida salva · sem nova consulta";}else{nextRain=now+RETRY;rainStatus=rain(now)==null?"Chuva por minuto: indisponível":"Previsão por minuto válida salva · sem nova consulta";}}}
 }
 synchronized Snapshot snapshot(long now){
  WeatherForecast.Summary w=weather(now);RainForecast.Summary r=rain(now);
  String ws=w==null&&weatherData!=null?"Previsão horária indisponível ou vencida":weatherStatus;
  String rs=r==null&&rainData!=null?"Chuva por minuto: indisponível ou vencida":rainStatus;
  Snapshot result=new Snapshot(events,w,r,refreshedAt,feedStatus,ws,rs,feedSaved,quakeOk,tsunamiOk);result.rainSeries=PhoneRainChart.Series.parse(rainData,now);result.hours=PhoneHourly.parse(hourlyData,now);result.hourlyStatus=result.hours.isEmpty()?hourlyStatus:"Modelo horário válido · Rainbow Weather";List<Alert> records=parseDaily(dailyData,now);result.dailyAvailable=records!=null;result.daily=records==null?Collections.emptyList():records;result.dailyDay=records==null?"":dailyData.optString("day");return result;
 }
 Snapshot details(long now,boolean daily){return details(now,daily,false);}
 Snapshot details(long now,boolean daily,boolean force){
  if(closed)return snapshot(now);long ticket=generation.get(),started=System.nanoTime();
  synchronized(this){long last=daily?lastDailyAttempt:lastHourlyAttempt;if(force&&last>0&&now-last>=0&&now-last<5000)return snapshot(now);if(!force&&(daily?now<nextDaily:now<nextHourly||!PhoneHourly.parse(hourlyData,now).isEmpty()))return snapshot(now);if(daily){nextDaily=now+RETRY;lastDailyAttempt=now;}else{nextHourly=now+RETRY;lastHourlyAttempt=now;hourlyStatus="Consultando previsão por hora";}}
  try{JSONObject candidate=object(transport.get(daily?DAILY:HOURLY,"",daily?FEED_LIMIT:WEATHER_LIMIT),daily?FEED_LIMIT:WEATHER_LIMIT);if(!active(ticket))return snapshot(now);boolean valid=daily?parseDaily(candidate,now)!=null:!PhoneHourly.parse(candidate,now).isEmpty();if(valid)synchronized(this){if(active(ticket)){if(daily)dailyData=candidate;else{hourlyData=candidate;hourlyStatus="Modelo horário válido · Rainbow Weather";}}}}catch(Exception ignored){/* Detail failure never replaces current conditions. */}
  synchronized(this){if(active(ticket)&&!daily&&PhoneHourly.parse(hourlyData,now).isEmpty())hourlyStatus="Dados por hora não disponíveis nesta consulta";}
  return snapshot(afterElapsed(now,started));
 }
 static List<Alert> parseDaily(JSONObject data,long now){
  try{if(data==null||!"tv-alerts-v1".equals(data.optString("version"))||!"completed".equals(data.optString("view"))||!data.optBoolean("complete")||!data.getJSONObject("sources").optBoolean("earthquake"))return null;long at=data.getLong("serverTime");if(at<=0||at>now+60000||now-at>3600000)return null;String expected=java.time.Instant.ofEpochMilli(now).atZone(WeatherForecast.ZONE).toLocalDate().minusDays(1).toString();if(!expected.equals(data.optString("day")))return null;long start=java.time.LocalDate.parse(expected).atStartOfDay(WeatherForecast.ZONE).toInstant().toEpochMilli();JSONArray list=data.getJSONArray("alerts");if(list.length()>5)return null;ArrayList<Alert> out=new ArrayList<>();for(int i=0;i<list.length();i++){Alert a=AlertCodec.read(list.getJSONObject(i));if(!a.kind.equals("earthquake")||a.eventTime<start||a.eventTime>=start+86400000||!Double.isFinite(a.magnitude))return null;out.add(a);}return Collections.unmodifiableList(out);}catch(Exception ignored){return null;}
 }
 private WeatherForecast.Summary weather(long now){try{return weatherData==null?null:WeatherForecast.summarize(weatherData,now);}catch(JSONException e){return null;}}
 private RainForecast.Summary rain(long now){try{return rainData==null?null:RainForecast.summarize(rainData,now);}catch(JSONException e){return null;}}
 synchronized String exportCache(){
  try{JSONObject out=new JSONObject().put("version",1).put("refreshedAt",refreshedAt).put("etag",etag);if(feedData!=null)out.put("feed",feedData);if(weatherData!=null)out.put("weather",weatherData);if(rainData!=null)out.put("rain",rainData);if(hourlyData!=null)out.put("hourly",hourlyData);String json=out.toString();return json.getBytes(StandardCharsets.UTF_8).length<=CACHE_LIMIT?json:"";}catch(JSONException e){return "";}
 }
 synchronized void importCache(String json,long now){
  if(json==null||json.length()>CACHE_LIMIT||json.getBytes(StandardCharsets.UTF_8).length>CACHE_LIMIT||closed)return;
  try{
   JSONObject root=new JSONObject(json);if(root.optInt("version",0)!=1)return;
   JSONObject f=root.optJSONObject("feed");long at=root.optLong("refreshedAt",0);
   if(f!=null&&at>0&&at<=now+60000){Parsed parsed=parseFeed(f,Math.max(now,at));feedData=f;events=parsed.events;quakeOk=parsed.quakeOk;tsunamiOk=parsed.tsunamiOk;etag=cleanEtag(root.optString("etag",""));refreshedAt=at;feedSaved=true;feedStatus="Dados salvos · atualize para conferir";}
   JSONObject h=root.optJSONObject("hourly");if(!PhoneHourly.parse(h,now).isEmpty())hourlyData=h;
   JSONObject w=root.optJSONObject("weather"),r=root.optJSONObject("rain");
   // Forecasts are restored only when their original timestamps remain valid.
   if(w!=null&&WeatherForecast.summarize(w,now)!=null){weatherData=w;weatherStatus="Modelo horário salvo · Liberdade, SP";}
   if(r!=null&&RainForecast.summarize(r,now)!=null){rainData=r;rainStatus="Previsão por minuto salva · Liberdade, SP";}
  }catch(Exception ignored){/* Corrupt cache never replaces a valid in-memory state. */}
 }
 void cancel(){generation.incrementAndGet();synchronized(this){nextHourly=nextDaily=lastHourlyAttempt=lastDailyAttempt=0;}transport.cancel();}
 @Override public void close(){closed=true;cancel();}
 private static JSONObject object(Response r,int limit)throws IOException,JSONException{
  if(r.status!=200||r.body.isEmpty()||r.body.length()>limit||r.body.getBytes(StandardCharsets.UTF_8).length>limit)throw new IOException("Unavailable or oversized response");return new JSONObject(r.body);
 }
 private static final class Parsed {List<Alert> events;boolean quakeOk,tsunamiOk;}
 private static Parsed parseFeed(JSONObject root,long now)throws IOException,JSONException{
  if(!"tv-alerts-v1".equals(root.optString("version"))||!"telegram-v1".equals(root.optString("policy")))throw new IOException("Unsupported feed");
  long server=root.optLong("serverTime",0);if(root.has("serverTime")&&(server<=0||server>now+60000))throw new IOException("Invalid server timestamp");
  JSONObject sources=root.getJSONObject("sources");Parsed out=new Parsed();out.quakeOk=sources.optBoolean("earthquake",false);out.tsunamiOk=sources.optBoolean("tsunami",false);if(!out.quakeOk&&!out.tsunamiOk)throw new IOException("Sources unavailable");
  JSONArray list=root.getJSONArray("alerts");out.events=new ArrayList<>();for(int i=0;i<Math.min(120,list.length());i++)out.events.add(AlertCodec.read(list.getJSONObject(i)));return out;
 }
 private static String sourceStatus(boolean quake,boolean tsunami){return quake&&tsunami?"Eventos atualizados":quake?"Eventos atualizados · fonte de tsunami indisponível":"Parcial · catálogo sísmico indisponível";}
 private static String cleanEtag(String value){if(value==null||value.length()>200||value.indexOf('\r')>=0||value.indexOf('\n')>=0)return "";return value;}
 /** Only the existing public Worker routes are reachable from this transport. */
 static final class HttpTransport implements Transport {
  private volatile HttpURLConnection connection;private final AtomicLong generation=new AtomicLong();
  @Override public Response get(String path,String tag,int limit)throws IOException{
   if(!path.equals(FEED)&&!path.equals(WEATHER)&&!path.equals(RAIN)&&!path.equals(HOURLY)&&!path.equals(DAILY))throw new IOException("Route not allowed");
   long ticket=generation.get();HttpURLConnection request=(HttpURLConnection)new URL("https://black-sky-9ba0.terrestre.workers.dev/"+path).openConnection();connection=request;
   request.setConnectTimeout(8000);request.setReadTimeout(12000);request.setInstanceFollowRedirects(false);request.setRequestProperty("Accept","application/json");request.setRequestProperty("User-Agent","MonitorGlobalMobile");if(!cleanEtag(tag).isEmpty())request.setRequestProperty("If-None-Match",tag);
   try{if(ticket!=generation.get())throw new InterruptedIOException("Cancelled");int status=request.getResponseCode();if(status==304)return new Response(status,"",request.getHeaderField("ETag"));if(status!=200)return new Response(status,"","");
    long declared=request.getContentLengthLong();if(declared>limit)throw new IOException("Response too large");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream input=request.getInputStream()){byte[] buffer=new byte[4096];int read;while((read=input.read(buffer))!=-1){if(ticket!=generation.get()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Cancelled");if(bytes.size()+read>limit)throw new IOException("Response too large");bytes.write(buffer,0,read);}}
    return new Response(status,new String(bytes.toByteArray(),StandardCharsets.UTF_8),request.getHeaderField("ETag"));
   }finally{request.disconnect();if(connection==request)connection=null;}
  }
  @Override public void cancel(){generation.incrementAndGet();HttpURLConnection current=connection;if(current!=null)current.disconnect();}
 }
}



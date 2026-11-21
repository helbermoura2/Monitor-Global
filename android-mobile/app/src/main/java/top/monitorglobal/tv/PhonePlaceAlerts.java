package top.monitorglobal.tv;

import android.app.*;
import android.app.job.*;
import android.content.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;
import top.monitorglobal.mobile.R;

/** Checks the USGS catalog periodically. The list and matching stay on the device. */
public final class PhonePlaceAlerts extends JobService {
 private static final int JOB_ID=271114;
 private static final long HOUR=3600000L;
 private ExecutorService worker;
 private Future<?> pending;
 static final class Place {
  final String name;final double lat,lon,km,min;final long since;
  Place(String name,double lat,double lon,double km,double min,long since){
   this.name=name;this.lat=lat;this.lon=lon;this.km=km;this.min=min;this.since=since;
  }
  boolean matches(Alert a,double distanceKm){
   return a.eventTime>=since&&a.magnitude>=min&&distanceKm<=km;
  }
  boolean valid(){return !name.trim().isEmpty()&&name.length()<=80&&MapFrame.located(lon,lat)&&km>=10&&km<=1000&&min>=5&&min<=9;}
 }
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences("seismic-places",MODE_PRIVATE);}
 static List<Place> saved(Context c){
  List<Place> places=new ArrayList<>();
  try{
   JSONArray rows=new JSONArray(prefs(c).getString("places","[]"));
   for(int i=0;i<Math.min(10,rows.length());i++){
    JSONObject o=rows.getJSONObject(i);
    Place p=new Place(o.getString("name"),o.getDouble("lat"),o.getDouble("lon"),o.getDouble("km"),o.getDouble("min"),o.getLong("since"));
    if(p.valid())places.add(p);
   }
  }catch(JSONException ignored){}
  return places;
 }
 static void save(Context c,List<Place> places){
  JSONArray rows=new JSONArray();
  for(Place p:places)try{
   rows.put(new JSONObject().put("name",p.name).put("lat",p.lat).put("lon",p.lon)
    .put("km",p.km).put("min",p.min).put("since",p.since));
  }catch(JSONException e){throw new IllegalArgumentException(e);}
  prefs(c).edit().putString("places",rows.toString()).apply();sync(c);
 }
 static void sync(Context c){
  JobScheduler scheduler=c.getSystemService(JobScheduler.class);
  if(scheduler==null)return;
  if(!PhonePush.enabled(c)||!PhonePush.allowed(c)||saved(c).isEmpty()){scheduler.cancel(JOB_ID);return;}
  if(scheduler.getPendingJob(JOB_ID)==null)scheduler.schedule(new JobInfo.Builder(JOB_ID,new ComponentName(c,PhonePlaceAlerts.class))
   .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(30*60*1000L).build());
 }
 @Override public boolean onStartJob(JobParameters params){
  if(!PhonePush.enabled(this)||!PhonePush.allowed(this)||saved(this).isEmpty())return false;
  worker=Executors.newSingleThreadExecutor();
  pending=worker.submit(()->{
   try{check();}catch(Exception ignored){/* Retry on the next scheduled check. */}
   if(!Thread.currentThread().isInterrupted())jobFinished(params,false);
  });
  worker.shutdown();return true;
 }
 @Override public boolean onStopJob(JobParameters params){if(pending!=null)pending.cancel(true);return false;}
 private void check()throws Exception{
  List<Alert> events=PhoneQuakeData.catalog(PhoneQuakeData.USGS+"/earthquakes/feed/v1.0/summary/4.5_day.geojson");
  long now=System.currentTimeMillis();
  SharedPreferences store=prefs(this);
  SharedPreferences.Editor edit=store.edit();
  for(Map.Entry<String,?> entry:store.getAll().entrySet())
   if(entry.getKey().startsWith("seen-")&&entry.getValue() instanceof Long&&now-(Long)entry.getValue()>24*HOUR)edit.remove(entry.getKey());
  for(Alert a:events){
   if(Thread.currentThread().isInterrupted()||!PhonePush.enabled(this)||!PhonePush.allowed(this))break;
   String key="seen-"+a.id;
   if(store.contains(key)||a.eventTime>now||now-a.eventTime>6*HOUR)continue;
   List<String> matches=new ArrayList<>();
   for(Place p:saved(this)){
    double km=PhoneQuakeData.distance(p.lat,p.lon,a.originLatitude,a.originLongitude);
    if(p.matches(a,km))matches.add(p.name+" · "+Math.round(km)+" km");
   }
   if(!matches.isEmpty()&&post(a,matches))edit.putLong(key,now);
  }
  edit.apply();
 }
 @android.annotation.SuppressLint("MissingPermission")
 private boolean post(Alert a,List<String> matches)throws JSONException{
  NotificationManager manager=getSystemService(NotificationManager.class);
  String channel="seismic-places",tag="place-"+a.id;
  manager.createNotificationChannel(new NotificationChannel(channel,"Sismos perto de lugares salvos",NotificationManager.IMPORTANCE_DEFAULT));
  Intent intent=new Intent(this,PhoneActivity.class).setAction(tag).putExtra(PhonePush.EXTRA,AlertCodec.write(a).toString())
   .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent tap=PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  String message=String.join("\n",matches)+"\nFonte: USGS";
  if(!PhonePush.enabled(this)||!PhonePush.allowed(this))return false;
  try{
   manager.notify(tag,0,new Notification.Builder(this,channel).setSmallIcon(R.drawable.ic_notification)
    .setContentTitle(PhoneActivity.magnitude(a)+" · "+a.title).setContentText(matches.get(0))
    .setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(tap)
    .setWhen(a.eventTime).setAutoCancel(true).setOnlyAlertOnce(true).build());
   return true;
  }catch(SecurityException e){return false;}
 }
}

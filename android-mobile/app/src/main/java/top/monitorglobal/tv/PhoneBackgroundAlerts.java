package top.monitorglobal.tv;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Opt-in, budget-bounded fallback if FCM has no configuration.
 *  Android may defer work. Not an emergency warning or a realtime push service.
 */
public final class PhoneBackgroundAlerts extends JobService {
 private static final int JOB_ID=271108, FIRST_JOB_ID=271109;
 private static final long PERIOD=30*60*1000L, MAX_AGE=45*60*1000L;
 private volatile PhoneRepository.HttpTransport transport;
 private ExecutorService executor;

 static void schedule(Context context){
  JobScheduler scheduler=context.getSystemService(JobScheduler.class);
  if(scheduler==null||scheduler.getPendingJob(JOB_ID)!=null)return;
  ComponentName service=new ComponentName(context,PhoneBackgroundAlerts.class);
  JobInfo periodic=new JobInfo.Builder(JOB_ID,service)
   .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(PERIOD)
   .setPersisted(true).build();
  if(scheduler.schedule(periodic)==JobScheduler.RESULT_SUCCESS){
   scheduler.schedule(new JobInfo.Builder(FIRST_JOB_ID,service)
    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(1000).build());
  }
 }
 static void cancel(Context context){
  JobScheduler scheduler=context.getSystemService(JobScheduler.class);
  if(scheduler!=null){scheduler.cancel(JOB_ID);scheduler.cancel(FIRST_JOB_ID);}
 }
 @Override public boolean onStartJob(JobParameters params){
  if(!PhonePush.enabled(this)||PhonePush.configured()||!PhonePush.allowed(this))return false;
  executor=Executors.newSingleThreadExecutor();
  executor.execute(()->{
   try{checkOnce();}catch(Exception ignored){/* Keep old state; retry next scheduled check. */}
   finally{jobFinished(params,false);}
  });
  return true;
 }
 @Override public boolean onStopJob(JobParameters params){
  PhoneRepository.HttpTransport current=transport;
  if(current!=null)current.cancel();
  if(executor!=null)executor.shutdownNow();
  return false;
 }
 private void checkOnce()throws Exception{
  final long now=System.currentTimeMillis();
  if(!PhonePush.enabled(this)||PhonePush.configured()||!PhonePush.allowed(this))return;
  PhoneRepository.HttpTransport t=new PhoneRepository.HttpTransport();transport=t;
  PhoneRepository.Response response=t.get(PhoneRepository.FEED,"",PhoneRepository.FEED_LIMIT);
  if(response.status!=200)return;
  JSONObject feed=new JSONObject(response.body);
  if(!"tv-alerts-v1".equals(feed.optString("version"))||!"telegram-v1".equals(feed.optString("policy")))return;
  JSONObject health=feed.optJSONObject("sources");
  if(health==null||(!health.optBoolean("earthquake")&&!health.optBoolean("tsunami")))return;
  JSONArray records=feed.optJSONArray("alerts");if(records==null||records.length()>256)return;
  SharedPreferences prefs=PhonePush.prefs(this);
  boolean baseline=prefs.getBoolean("fallback-baseline",false);
  if(!baseline&&(!health.optBoolean("earthquake")||!health.optBoolean("tsunami")))return;
  SharedPreferences.Editor changes=prefs.edit();
  List<Alert> valid=new ArrayList<>();
  for(int i=0;i<Math.min(120,records.length());i++){
   try{
    Alert a=AlertCodec.read(records.getJSONObject(i));
    if(!"earthquake".equals(a.kind)&&!"tsunami".equals(a.kind))continue;
    if(!health.optBoolean(a.kind))continue;
    valid.add(a);
   }catch(Exception ignored){/* One bad event never makes an all-clear. */}
  }
  // The first confirmed feed seeds history; never notify all past events on activation.
  if(!baseline){
   for(Alert a:valid)changes.putString("bg-"+PhonePushPayload.tag(a.id),a.version);
   changes.putBoolean("fallback-baseline",true).apply();
   return;
  }
  int sent=0;
  for(Alert a:valid){
   if(sent>=3||!PhonePush.enabled(this)||!PhonePush.allowed(this))break;
   String key="bg-"+PhonePushPayload.tag(a.id),old=prefs.getString(key,"");
   if(a.version.equals(old))continue;
   long age=now-a.issuedAt;
   if(age<0||age>MAX_AGE||a.eventTime>now+60000L||a.eventTime<=0)continue;
   if("earthquake".equals(a.kind)&&(!a.eligible||now-a.eventTime>6*3600000L))continue;
   if("tsunami".equals(a.kind)&&!a.eligible)continue;
   if(PhoneMessagingService.post(this,a,AlertCodec.write(a).toString())){
    changes.putString(key,a.version);
    sent++;
   }
  }
  changes.apply();
  // Prevent indefinite SharedPreferences growth, never modify regular Firebase dedup keys.
  Map<String,?> values=prefs.getAll();int seen=0;
  for(String key:values.keySet())if(key.startsWith("bg-push-"))seen++;
  if(seen>200){SharedPreferences.Editor prune=prefs.edit();int removed=0;for(String key:values.keySet())if(key.startsWith("bg-push-")&&removed++<seen-160)prune.remove(key);prune.apply();}
 }
}

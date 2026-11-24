package top.monitorglobal.tv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import top.monitorglobal.mobile.R;

public final class PhoneWeatherBriefJob extends JobService {
 static final String CATEGORY="weather-brief", DATE="weather-brief-date", MESSAGE="weather-brief-message";
 private static final int JOB=271115;
 private static final String CHANNEL="weather-brief";
 private ExecutorService executor;

 private static boolean enabled(Context c){
  return PhonePush.enabled(c)&&PhonePush.categoryEnabled(c,CATEGORY)&&PhonePush.allowed(c);
 }
 static void sync(Context c){
  JobScheduler scheduler=c.getSystemService(JobScheduler.class);
  if(scheduler==null)return;
  if(!enabled(c)){scheduler.cancel(JOB);return;}
  if(scheduler.getPendingJob(JOB)==null){
   long now=System.currentTimeMillis();
   DailyWeatherBrief.Slot slot=DailyWeatherBrief.due(now);
   boolean pending=slot!=null&&!slot.key().equals(PhonePush.prefs(c).getString("weatherBriefSent",""));
   schedule(c,pending?now:DailyWeatherBrief.next(now));
  }
 }
 private static void schedule(Context c,long time){
  JobScheduler scheduler=c.getSystemService(JobScheduler.class);
  if(scheduler==null||!enabled(c))return;
  scheduler.schedule(new JobInfo.Builder(JOB,new ComponentName(c,PhoneWeatherBriefJob.class))
   .setMinimumLatency(Math.max(0,time-System.currentTimeMillis()))
   .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(false).build());
 }
 @Override public boolean onStartJob(JobParameters params){
  if(!enabled(this))return false;
  ExecutorService work=Executors.newSingleThreadExecutor();
  executor=work;
  work.execute(()->{
   long now=System.currentTimeMillis();
   long next=DailyWeatherBrief.next(now);
   DailyWeatherBrief.Slot slot=DailyWeatherBrief.due(now);
   SharedPreferences prefs=PhonePush.prefs(this);
   try{
    if(slot!=null&&!slot.key().equals(prefs.getString("weatherBriefSent",""))){
     String detail=DailyWeatherBrief.read(slot,now);
     DailyWeatherBrief.Slot current=DailyWeatherBrief.due(System.currentTimeMillis());
     if(enabled(this)&&!Thread.currentThread().isInterrupted()&&current!=null&&current.key().equals(slot.key())){
      post(slot,detail);
      prefs.edit().putString("weatherBriefSent",slot.key()).apply();
     }
    }
   }catch(java.io.IOException|org.json.JSONException|java.time.DateTimeException|SecurityException ignored){
    long retry=now+5*60_000L;
    DailyWeatherBrief.Slot retrySlot=DailyWeatherBrief.due(retry);
    if(slot!=null&&retrySlot!=null&&slot.key().equals(retrySlot.key()))next=retry;
   }finally{
    if(!Thread.currentThread().isInterrupted()){jobFinished(params,false);schedule(this,next);}
    work.shutdown();
   }
  });
  return true;
 }
 @Override public boolean onStopJob(JobParameters params){if(executor!=null)executor.shutdownNow();return enabled(this);}
 private void post(DailyWeatherBrief.Slot slot,String message){
  NotificationManager manager=getSystemService(NotificationManager.class);
  manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Boletins de hoje e amanhã",NotificationManager.IMPORTANCE_DEFAULT));
  Intent open=new Intent(this,PhoneActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
   .putExtra(PhonePush.ROUTE,CATEGORY).putExtra(DATE,slot.date().toString()).putExtra(MESSAGE,message);
  boolean tomorrow=slot.tomorrow;
  PendingIntent destination=PendingIntent.getActivity(this,tomorrow?271117:271116,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  manager.notify(CHANNEL,tomorrow?2:1,new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_notification)
   .setContentTitle(slot.title()).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
   .setContentIntent(destination).setAutoCancel(true).build());
 }
}

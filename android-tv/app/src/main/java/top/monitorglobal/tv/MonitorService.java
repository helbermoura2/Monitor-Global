package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.content.pm.ServiceInfo;import android.os.*;import android.media.*;import java.util.*;import java.util.concurrent.*;
public final class MonitorService extends Service {
 static final String START="top.monitorglobal.tv.START",STOP="top.monitorglobal.tv.STOP",TEST="top.monitorglobal.tv.TEST",TEST_REVISION=TEST+"_REVISION",TEST_TSUNAMI=TEST+"_TSUNAMI",TEST_END=TEST+"_END",TEST_SEQUENCE=TEST+"_SEQUENCE";
 private final List<Runnable> demoTasks=new ArrayList<>();
 private long nextConfigCheck;private volatile boolean destroyed;private ToneGenerator tone;private ScheduledExecutorService executor;private final Handler main=new Handler(Looper.getMainLooper());private Banner banner;private final ArrayDeque<Alert> queue=new ArrayDeque<>();private AlertTracker tracker;private FeedClient feed;private boolean draining;
 @Override public void onCreate(){super.onCreate();banner=new Banner(this);tracker=Prefs.tracker(this);feed=new FeedClient();NotificationManager n=getSystemService(NotificationManager.class);NotificationChannel service=new NotificationChannel("monitoring","Monitoramento contínuo",NotificationManager.IMPORTANCE_LOW);service.setSound(null,null);n.createNotificationChannel(service);NotificationChannel alerts=new NotificationChannel("alerts","Terremotos e tsunami",NotificationManager.IMPORTANCE_HIGH);alerts.setSound(null,null);n.createNotificationChannel(alerts);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?START:intent.getAction();if(STOP.equals(action)){Prefs.get(this).edit().putBoolean("enabled",false).apply();stopSelf();return START_NOT_STICKY;}
  Notification notification=new Notification.Builder(this,"monitoring").setSmallIcon(top.monitorglobal.tv.R.drawable.ic_monitor).setContentTitle("Monitor Global TV").setContentText("Acompanhando sismos M6+ e tsunami").setContentIntent(open()).setOngoing(true).addAction(new Notification.Action.Builder(null,"Parar",PendingIntent.getService(this,2,new Intent(this,MonitorService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE)).build()).build();
  try{if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,notification);}catch(RuntimeException e){Prefs.status(this,"O sistema impediu o monitoramento. Abra o aplicativo para iniciar.");stopSelf();return START_NOT_STICKY;}
  if(TEST.equals(action)||TEST_REVISION.equals(action)||TEST_TSUNAMI.equals(action)||TEST_END.equals(action)||TEST_SEQUENCE.equals(action)){
   String scenario=TEST_REVISION.equals(action)?"revision":TEST_TSUNAMI.equals(action)?"tsunami":TEST_END.equals(action)?"ended":TEST_SEQUENCE.equals(action)?"sequence":"quake";
   scheduleDemo(scenario);if(Prefs.get(this).getBoolean("enabled",false)){ensurePolling();return START_STICKY;}return START_NOT_STICKY;
  }
  if(!Prefs.get(this).getBoolean("enabled",false)){stopSelf();return START_NOT_STICKY;}
  ensurePolling();return START_STICKY;
 }
 private void cancelDemos(){for(Runnable r:demoTasks)main.removeCallbacks(r);demoTasks.clear();}
 private void scheduleDemo(String scenario){
  cancelDemos();List<Alert> examples=DemoAlerts.create(scenario,System.currentTimeMillis());long interval=(Prefs.get(this).getInt("seconds",20)+1)*1000L;
  for(int i=0;i<examples.size();i++){Alert a=examples.get(i);Runnable task=()->{if(!destroyed&&!draining&&queue.isEmpty())display(a,true);};demoTasks.add(task);main.postDelayed(task,10000+i*interval);}
  Runnable stop=()->{if(!Prefs.get(this).getBoolean("enabled",false)&&!draining)stopSelf();};demoTasks.add(stop);main.postDelayed(stop,10000+examples.size()*interval+2000);
  Prefs.status(this,"Teste fictício em 10 segundos. Você pode abrir outro aplicativo.");
 }
 private void enqueue(List<Alert> alerts){
  if(!alerts.isEmpty())cancelDemos();Set<String> added=new HashSet<>();
  for(Alert a:alerts){
   if(a.kind.equals("tsunami")&&!a.relatedQuakeId.isEmpty())for(Alert q:alerts)if(q.id.equals(a.relatedQuakeId)&&added.add(q.id))putPending(q);
   if(added.add(a.id))putPending(a);
  }drain();
 }
 private void putPending(Alert a){queue.removeIf(old->old.id.equals(a.id));if(queue.size()<8)queue.add(a);}
 private void ensurePolling(){if(executor==null){executor=Executors.newSingleThreadScheduledExecutor();executor.scheduleWithFixedDelay(this::poll,0,30,TimeUnit.SECONDS);}}
 private PendingIntent open(){return PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private void poll(){if(destroyed)return;try{FeedClient.Snapshot snapshot=feed.read();if(destroyed)return;long now=System.currentTimeMillis();Prefs.get(this).edit().putLong("lastCheck",now).apply();if(snapshot.unchanged){refreshOfficialConfig();return;}
  List<Alert> alerts=tracker.accept(snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk,now);Prefs.save(this,tracker);Prefs.status(this,snapshot.quakeOk&&snapshot.tsunamiOk?"Conectado · fontes disponíveis":"Conexão ativa · uma fonte está indisponível");main.post(()->{if(destroyed)return;enqueue(alerts);});refreshOfficialConfig();
 }catch(Exception e){Prefs.status(this,"Sem atualização confirmada. Tentando novamente em 30 s.");}}
 private void refreshOfficialConfig(){if(destroyed||android.os.SystemClock.elapsedRealtime()<nextConfigCheck)return;nextConfigCheck=android.os.SystemClock.elapsedRealtime()+15*60000L;try{org.json.JSONObject root=OfficialConfig.read();if(destroyed)return;OfficialConfig.applyTheme(this,root);OfficialConfig.Release release=OfficialConfig.release(root);if(release.enabled&&TrustPolicy.newer(BuildConfig.VERSION_CODE,release.code))Prefs.get(this).edit().putString("updateStatus","Atualização oficial "+release.version+" disponível. Abra Verificar atualização oficial.").apply();}catch(Exception ignored){}}
 private void drain(){if(destroyed||draining||queue.isEmpty())return;draining=true;display(queue.remove(),false);main.postDelayed(()->{draining=false;drain();},(Prefs.get(this).getInt("seconds",20)+1)*1000L);}
 private void display(Alert a,boolean demo){boolean overlay=banner.show(a,demo);if(!overlay)try{getSystemService(NotificationManager.class).notify(100+Math.floorMod(a.id.hashCode(),1000000),new Notification.Builder(this,"alerts").setSmallIcon(R.drawable.ic_monitor).setContentTitle(demo?"DEMONSTRAÇÃO · "+a.title:a.title).setContentText(a.detail).setStyle(new Notification.BigTextStyle().bigText(a.detail)).setContentIntent(open()).setAutoCancel(true).build());}catch(SecurityException e){Prefs.status(this,"Notificações bloqueadas pelo sistema. Confira a permissão de sobreposição.");}
  if(Prefs.get(this).getBoolean("sound",true)){try{if(tone==null)tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,65);tone.startTone(ToneGenerator.TONE_PROP_BEEP,350);}catch(RuntimeException ignored){}}
 }
 @Override public void onDestroy(){destroyed=true;if(executor!=null)executor.shutdownNow();main.removeCallbacksAndMessages(null);banner.hide();queue.clear();if(tone!=null)tone.release();super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}

package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.content.pm.ServiceInfo;import android.os.*;import android.media.*;import java.util.*;import java.util.concurrent.*;
public final class MonitorService extends Service {
 static final String START="top.monitorglobal.tv.START",STOP="top.monitorglobal.tv.STOP",TEST="top.monitorglobal.tv.TEST",TEST_REVISION=TEST+"_REVISION",TEST_TSUNAMI=TEST+"_TSUNAMI",TEST_END=TEST+"_END",TEST_NO_THREAT=TEST+"_NO_THREAT",TEST_SEQUENCE=TEST+"_SEQUENCE",SUMMARY="top.monitorglobal.tv.SUMMARY",REPLAY="top.monitorglobal.tv.REPLAY";
 private final List<Runnable> demoTasks=new ArrayList<>();
 private long nextConfigCheck;private volatile boolean destroyed;private ToneGenerator tone;private ScheduledExecutorService executor;private ExecutorService historyExecutor;private boolean historyBusy;private final Handler main=new Handler(Looper.getMainLooper());private Banner banner;private final ArrayDeque<Alert> queue=new ArrayDeque<>();private AlertTracker tracker;private FeedClient feed;private boolean draining,polling;private int historyRequest;private Alert activeReal;private Runnable nextReal;private long activeUntil;
 @Override public void onCreate(){super.onCreate();banner=new Banner(this);tracker=Prefs.tracker(this);feed=new FeedClient();NotificationManager n=getSystemService(NotificationManager.class);NotificationChannel service=new NotificationChannel("monitoring","Monitoramento contínuo",NotificationManager.IMPORTANCE_LOW);service.setSound(null,null);n.createNotificationChannel(service);NotificationChannel alerts=new NotificationChannel("alerts","Terremotos e tsunami",NotificationManager.IMPORTANCE_HIGH);alerts.setSound(null,null);n.createNotificationChannel(alerts);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?START:intent.getAction();if(STOP.equals(action)){Prefs.get(this).edit().putBoolean("enabled",false).apply();stopSelf();return START_NOT_STICKY;}
  Notification notification=new Notification.Builder(this,"monitoring").setSmallIcon(top.monitorglobal.tv.R.drawable.ic_monitor).setContentTitle("Monitor Global TV").setContentText("Acompanhando sismos M6+ e tsunami").setContentIntent(open()).setOngoing(true).addAction(new Notification.Action.Builder(null,"Parar",PendingIntent.getService(this,2,new Intent(this,MonitorService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE)).build()).build();
  try{if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,notification);}catch(RuntimeException e){Prefs.status(this,"O sistema impediu o monitoramento. Abra o aplicativo para iniciar.");stopSelf();return START_NOT_STICKY;}
  if(REPLAY.equals(action)||SUMMARY.equals(action)){
   if(Prefs.get(this).getBoolean("enabled",false))ensurePolling();
   fetchHistory(SUMMARY.equals(action));return Prefs.get(this).getBoolean("enabled",false)?START_STICKY:START_NOT_STICKY;
  }
  if(TEST.equals(action)||TEST_REVISION.equals(action)||TEST_TSUNAMI.equals(action)||TEST_END.equals(action)||TEST_NO_THREAT.equals(action)||TEST_SEQUENCE.equals(action)){
   String scenario=TEST_REVISION.equals(action)?"revision":TEST_TSUNAMI.equals(action)?"tsunami":TEST_END.equals(action)?"ended":TEST_NO_THREAT.equals(action)?"noThreat":TEST_SEQUENCE.equals(action)?"sequence":"quake";
   scheduleDemo(scenario);if(Prefs.get(this).getBoolean("enabled",false)){ensurePolling();return START_STICKY;}return START_NOT_STICKY;
  }
  if(!Prefs.get(this).getBoolean("enabled",false)){stopSelf();return START_NOT_STICKY;}
  ensurePolling();return START_STICKY;
 }
 private void cancelDemos(){for(Runnable r:demoTasks)main.removeCallbacks(r);demoTasks.clear();}
 private void scheduleDemo(String scenario){scheduleLocal(DemoAlerts.create(scenario,System.currentTimeMillis()),true,false);}
 private void scheduleLocal(List<Alert> examples,boolean demo,boolean replay){
  cancelDemos();long delay=Math.max(10000,activeUntil-android.os.SystemClock.uptimeMillis()+500);
  for(Alert a:examples){Runnable task=()->{if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay);};demoTasks.add(task);main.postDelayed(task,delay);delay+=BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20))+1000;}
  Runnable stop=()->{if(!Prefs.get(this).getBoolean("enabled",false)&&!draining)stopSelf();};demoTasks.add(stop);main.postDelayed(stop,delay+2000);
  Prefs.status(this,draining?"Exibição local agendada para depois do alerta real atual.":replay?"Replay histórico em 10 segundos, sem novo som de alerta.":"Teste fictício em 10 segundos. Você pode abrir outro aplicativo.");
 }
 private void enqueue(List<Alert> alerts,List<Alert> snapshot,boolean quakeOk,boolean tsunamiOk){
  AlertPairing.refreshQueuedCompanions(queue,snapshot,quakeOk,tsunamiOk);
  if(!alerts.isEmpty())cancelDemos();List<Alert> notices=AlertPairing.coalesce(alerts);
  Alert update=null;for(Alert a:notices)if(AlertPairing.updates(activeReal,a)){update=a;break;}
  if(update!=null){Alert latest=update;queue.removeIf(old->AlertPairing.replacesQueued(latest,old));startReal(latest);}
  for(Alert a:notices)if(update==null||!AlertPairing.represents(update,a))putPending(a);
  drain();
 }
 private void putPending(Alert a){queue.removeIf(old->AlertPairing.replacesQueued(a,old));if(queue.size()<8)queue.add(a);}
 private void ensureExecutor(){if(executor==null)executor=Executors.newSingleThreadScheduledExecutor();}
 private void ensurePolling(){ensureExecutor();if(!polling){polling=true;executor.scheduleWithFixedDelay(this::poll,0,30,TimeUnit.SECONDS);}}
 private void fetchHistory(boolean summary){
  if(historyBusy){Prefs.status(this,"Consulta de histórico em andamento. Aguarde.");return;}historyBusy=true;if(historyExecutor==null)historyExecutor=Executors.newSingleThreadExecutor();final int request=++historyRequest;Prefs.status(this,summary?"Consultando os maiores sismos de hoje…":"Buscando o último sismo M6+ nas últimas 72 horas…");
  historyExecutor.execute(()->{try{
   FeedClient.Snapshot snapshot=new FeedClient().history(summary?"daily":"replay");
   if(!snapshot.quakeOk)throw new java.io.IOException("Catálogo indisponível");
   main.post(()->{historyBusy=false;if(destroyed||request!=historyRequest)return;
    if(snapshot.alerts.isEmpty()){Prefs.status(this,summary?"Nenhum sismo M2,5+ no catálogo de hoje até esta consulta.":"Nenhum sismo M6+ nas últimas 72 horas.");stopIfIdle();return;}
    if(summary)scheduleSummary(snapshot);else{Alert latest=snapshot.alerts.get(0),local=Prefs.lastReplay(this);
     // Prefer the newer origin; only a newer revision of that same event may replace it.
     latest=ReplaySelection.latest(latest,local);Prefs.rememberRecovered(this,latest);
     scheduleLocal(List.of(latest),false,true);
    }
   });
  }catch(Exception e){main.post(()->{historyBusy=false;if(destroyed||request!=historyRequest)return;Alert local=summary?null:Prefs.lastReplay(this);
   if(local!=null){scheduleLocal(List.of(local),false,true);Prefs.status(this,"Servidor indisponível · replay do último registro local em 10 segundos.");}
   else{Prefs.status(this,"Histórico indisponível. Tente novamente com internet.");stopIfIdle();}
  });}});
 }
 private void stopIfIdle(){if(!Prefs.get(this).getBoolean("enabled",false)&&!draining&&demoTasks.isEmpty())stopSelf();}
 private void scheduleSummary(FeedClient.Snapshot snapshot){
  cancelDemos();long delay=Math.max(10000,activeUntil-android.os.SystemClock.uptimeMillis()+500);
  Runnable show=()->{if(destroyed)return;if(draining||!queue.isEmpty()){Prefs.status(this,"Resumo adiado por alerta real. Solicite novamente após o aviso.");return;}
   banner.showSummary(snapshot.alerts,snapshot.day);activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.summaryDuration(snapshot.alerts.size());
  };demoTasks.add(show);main.postDelayed(show,delay);
  Runnable stop=()->{demoTasks.clear();activeUntil=0;stopIfIdle();};demoTasks.add(stop);main.postDelayed(stop,delay+BannerTimeline.summaryDuration(snapshot.alerts.size())+1000);
  Prefs.status(this,"Resumo de "+snapshot.day+" em 10 segundos · "+snapshot.alerts.size()+" sismos · "+BannerTimeline.summaryDuration(snapshot.alerts.size())/1000+" segundos · parcial até "+NewsBannerView.formatTime(snapshot.asOf));
 }
 private PendingIntent open(){return PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private void poll(){if(destroyed)return;try{FeedClient.Snapshot snapshot=feed.read();if(destroyed)return;long now=System.currentTimeMillis();Prefs.get(this).edit().putLong("lastCheck",now).apply();if(snapshot.unchanged){refreshOfficialConfig();return;}
  List<Alert> alerts=tracker.accept(snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk,now);AlertPairing.attach(alerts,snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk);Prefs.save(this,tracker);Prefs.status(this,snapshot.quakeOk&&snapshot.tsunamiOk?"Conectado · fontes disponíveis":"Conexão ativa · uma fonte está indisponível");main.post(()->{if(destroyed)return;enqueue(alerts,snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk);});refreshOfficialConfig();
 }catch(Exception e){Prefs.status(this,"Sem atualização confirmada. Tentando novamente em 30 s.");}}
 private void refreshOfficialConfig(){if(destroyed||android.os.SystemClock.elapsedRealtime()<nextConfigCheck)return;nextConfigCheck=android.os.SystemClock.elapsedRealtime()+15*60000L;try{org.json.JSONObject root=OfficialConfig.read();if(destroyed)return;OfficialConfig.applyTheme(this,root);OfficialConfig.Release release=OfficialConfig.release(root);if(release.enabled&&TrustPolicy.newer(BuildConfig.VERSION_CODE,release.code))Prefs.get(this).edit().putString("updateStatus","Atualização oficial "+release.version+" disponível. Abra Verificar atualização oficial.").apply();}catch(Exception ignored){}}
 private void drain(){if(destroyed||draining||queue.isEmpty())return;startReal(queue.remove());}
 private void startReal(Alert a){
  if(nextReal!=null)main.removeCallbacks(nextReal);draining=true;activeReal=a;display(a,false,false);
  nextReal=()->{draining=false;activeReal=null;activeUntil=0;nextReal=null;drain();};activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20))+1000;main.postDelayed(nextReal,Math.max(0,activeUntil-android.os.SystemClock.uptimeMillis()));
 }
 private void display(Alert a,boolean demo,boolean replay){
  if(!demo&&!replay)Prefs.rememberReal(this,a);
  if(demo||replay)activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20));
  boolean overlay=banner.show(a,demo,replay);if(!overlay)try{getSystemService(NotificationManager.class).notify(100+Math.floorMod(a.id.hashCode(),1000000),new Notification.Builder(this,"alerts").setSmallIcon(R.drawable.ic_monitor).setContentTitle((demo?"DEMONSTRAÇÃO · ":replay?"REPLAY · ":!a.revision.isEmpty()?"ATUALIZAÇÃO · ":"")+a.title).setContentText(a.detail).setStyle(new Notification.BigTextStyle().bigText((a.revision.isEmpty()?"":a.revision+" · ")+a.detail)).setContentIntent(open()).setAutoCancel(true).build());}catch(SecurityException e){Prefs.status(this,"Notificações bloqueadas pelo sistema. Confira a permissão de sobreposição.");}
  if(!replay&&!a.quietInformation()&&Prefs.get(this).getBoolean("sound",true)){try{if(tone==null)tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,65);tone.startTone(ToneGenerator.TONE_PROP_BEEP,350);}catch(RuntimeException ignored){}}
 }
 @Override public void onDestroy(){destroyed=true;if(executor!=null)executor.shutdownNow();if(historyExecutor!=null)historyExecutor.shutdownNow();main.removeCallbacksAndMessages(null);banner.hide();queue.clear();if(tone!=null)tone.release();super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}

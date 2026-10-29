package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.content.pm.ServiceInfo;import android.os.*;import android.media.*;import java.util.*;import java.util.concurrent.*;
public final class MonitorService extends Service {
 static final String START="top.monitorglobal.tv.START",STOP="top.monitorglobal.tv.STOP",TEST="top.monitorglobal.tv.TEST",TEST_REVISION=TEST+"_REVISION",TEST_TSUNAMI=TEST+"_TSUNAMI",TEST_END=TEST+"_END",TEST_NO_THREAT=TEST+"_NO_THREAT",TEST_SEQUENCE=TEST+"_SEQUENCE",SUMMARY_REPLAY="top.monitorglobal.tv.SUMMARY_REPLAY",SUMMARY="top.monitorglobal.tv.SUMMARY",SUMMARY_TODAY="top.monitorglobal.tv.SUMMARY_TODAY",REPLAY="top.monitorglobal.tv.REPLAY";
 private final List<Runnable> demoTasks=new ArrayList<>();private int localGeneration;
 private long nextConfigCheck;private volatile boolean destroyed;private ToneGenerator tone;private ScheduledExecutorService executor;private ExecutorService historyExecutor;private boolean historyBusy;private final Handler main=new Handler(Looper.getMainLooper());private Banner banner;private final ArrayDeque<Alert> queue=new ArrayDeque<>();private AlertTracker tracker;private FeedClient feed;private boolean draining,polling;private int historyRequest;private Alert activeReal;private Runnable nextReal;private long activeUntil;
 private RainMonitor rain;private CompactNotice compact;private boolean targetsEnabled,compactBusy;private long targetSettingsRevision;private Runnable targetEnd;private final TargetNoticeQueue targetQueue=new TargetNoticeQueue();
 private DailySummarySchedule daily;private FeedClient.Snapshot pendingDaily;private boolean dailyRunning,dailyBusy;private long dailyRetryAt;private Runnable dailyEnd;
 private final BroadcastReceiver screenChanges=new BroadcastReceiver(){public void onReceive(Context c,Intent intent){RuntimeDiagnostics.resetFrameClock();if(Intent.ACTION_SCREEN_OFF.equals(intent.getAction())){compact.hide();rain.hide();interruptDaily();}else{tryTarget();checkDaily();rain.tick();}}};
 private final Runnable dailyTick=new Runnable(){public void run(){if(destroyed)return;checkDaily();rain.tick();main.postDelayed(this,DailySummarySchedule.delay(System.currentTimeMillis()));}};
 @Override public void onCreate(){super.onCreate();RuntimeDiagnostics.start(this);banner=new Banner(this);compact=new CompactNotice(this);targetSettingsRevision=Prefs.get(this).getLong("targetSettingsRevision",0);targetsEnabled=Prefs.get(this).getBoolean("targetAlerts",true);tracker=Prefs.tracker(this);feed=new FeedClient();daily=new DailySummarySchedule(Prefs.get(this).getString("dailyDeliveredDay",""));rain=new RainMonitor(this,()->!destroyed&&!localBusy()&&!daily.displaying());IntentFilter filter=new IntentFilter(Intent.ACTION_SCREEN_OFF);filter.addAction(Intent.ACTION_SCREEN_ON);filter.addAction(Intent.ACTION_TIME_CHANGED);filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);if(Build.VERSION.SDK_INT>=33)registerReceiver(screenChanges,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(screenChanges,filter);NotificationManager n=getSystemService(NotificationManager.class);NotificationChannel service=new NotificationChannel("monitoring","Monitoramento contínuo",NotificationManager.IMPORTANCE_LOW);service.setSound(null,null);n.createNotificationChannel(service);NotificationChannel alerts=new NotificationChannel("alerts","Terremotos e tsunami",NotificationManager.IMPORTANCE_HIGH);alerts.setSound(null,null);n.createNotificationChannel(alerts);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?START:intent.getAction();if(STOP.equals(action)){Prefs.get(this).edit().putBoolean("enabled",false).apply();stopSelf();return START_NOT_STICKY;}
  Notification notification=new Notification.Builder(this,"monitoring").setSmallIcon(top.monitorglobal.tv.R.drawable.ic_monitor).setContentTitle("Monitor Global TV").setContentText("Acompanhando M6+, sismos no Brasil e tsunami").setContentIntent(open()).setOngoing(true).addAction(new Notification.Action.Builder(null,"Parar",PendingIntent.getService(this,2,new Intent(this,MonitorService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE)).build()).build();
  try{if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,notification);}catch(RuntimeException e){Prefs.status(this,"O sistema impediu o monitoramento. Abra o aplicativo para iniciar.");stopSelf();return START_NOT_STICKY;}
  if(SUMMARY_REPLAY.equals(action)||REPLAY.equals(action)||SUMMARY.equals(action)||SUMMARY_TODAY.equals(action)||action!=null&&action.startsWith(TEST)){rain.hide();interruptDaily();}
  if(SUMMARY_REPLAY.equals(action)){
   if(Prefs.get(this).getBoolean("enabled",false))ensurePolling();
   FeedClient.Snapshot saved=Prefs.lastCompletedSummary(this);
   if(SummaryRecord.completedFor(saved,System.currentTimeMillis())){++historyRequest;scheduleSummary(saved,true);}
   else fetchHistory(true,true,true);
   return Prefs.get(this).getBoolean("enabled",false)?START_STICKY:START_NOT_STICKY;
  }
  if(REPLAY.equals(action)||SUMMARY.equals(action)||SUMMARY_TODAY.equals(action)){
   if(Prefs.get(this).getBoolean("enabled",false))ensurePolling();
   fetchHistory(!REPLAY.equals(action),!SUMMARY_TODAY.equals(action),false);return Prefs.get(this).getBoolean("enabled",false)?START_STICKY:START_NOT_STICKY;
  }
  if((TEST+"_RAIN").equals(action)){cancelDemos();Prefs.status(this,"Teste fictício de chuva em 10 segundos.");Runnable task=new Runnable(){public void run(){demoTasks.remove(this);if(!destroyed&&!localBusy()){activeUntil=SystemClock.uptimeMillis()+RainOverlay.DURATION+800;rain.demo();Runnable finish=new Runnable(){public void run(){demoTasks.remove(this);if(!draining){activeUntil=0;tryTarget();tryDaily();stopIfIdle();}}};demoTasks.add(finish);main.postDelayed(finish,RainOverlay.DURATION+800);}}};demoTasks.add(task);main.postDelayed(task,10000);if(Prefs.get(this).getBoolean("enabled",false))ensurePolling();return Prefs.get(this).getBoolean("enabled",false)?START_STICKY:START_NOT_STICKY;}
  if((TEST+"_TARGET").equals(action)){Alert a=new Alert("DEMO-TARGET","earthquake","demo","M5,4 · Katmandu, Nepal","","earthquake",System.currentTimeMillis(),System.currentTimeMillis(),false);a.magnitude=5.4;a.depth=12;a.source="EXEMPLO";a.targetArea="Katmandu · Nepal";Prefs.status(this,"Aviso menor fictício em 10 segundos.");Runnable task=new Runnable(){public void run(){demoTasks.remove(this);if(!destroyed&&!localBusy()){showTargetCard(a,true);}}};demoTasks.add(task);main.postDelayed(task,10000);if(Prefs.get(this).getBoolean("enabled",false))ensurePolling();return Prefs.get(this).getBoolean("enabled",false)?START_STICKY:START_NOT_STICKY;}
  if(TEST.equals(action)||TEST_REVISION.equals(action)||TEST_TSUNAMI.equals(action)||TEST_END.equals(action)||TEST_NO_THREAT.equals(action)||TEST_SEQUENCE.equals(action)){
   String scenario=TEST_REVISION.equals(action)?"revision":TEST_TSUNAMI.equals(action)?"tsunami":TEST_END.equals(action)?"ended":TEST_NO_THREAT.equals(action)?"noThreat":TEST_SEQUENCE.equals(action)?"sequence":"quake";
   scheduleDemo(scenario);if(Prefs.get(this).getBoolean("enabled",false)){ensurePolling();return START_STICKY;}return START_NOT_STICKY;
  }
  if(!Prefs.get(this).getBoolean("enabled",false)){stopSelf();return START_NOT_STICKY;}
  ensurePolling();checkDaily();rain.tick();return START_STICKY;
 }
 private void cancelDemos(){++localGeneration;for(Runnable r:demoTasks)main.removeCallbacks(r);demoTasks.clear();}
 private void scheduleDemo(String scenario){scheduleLocal(DemoAlerts.create(scenario,System.currentTimeMillis()),true,false);}
 private void scheduleLocal(List<Alert> examples,boolean demo,boolean replay){
  cancelDemos();long delay=Math.max(10000,activeUntil-android.os.SystemClock.uptimeMillis()+500);
  for(Alert a:examples){Runnable task=()->{if(!destroyed&&!draining&&queue.isEmpty())display(a,demo,replay);};demoTasks.add(task);main.postDelayed(task,delay);delay+=BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20))+1000;}
  Runnable stop=()->{demoTasks.clear();if(!draining){activeUntil=0;tryTarget();tryDaily();}if(!Prefs.get(this).getBoolean("enabled",false)&&!draining)stopSelf();};demoTasks.add(stop);main.postDelayed(stop,delay+2000);
  Prefs.status(this,draining?"Exibição local agendada para depois do alerta real atual.":replay?"Replay histórico em 10 segundos, sem novo som de alerta.":"Teste fictício em 10 segundos. Você pode abrir outro aplicativo.");
 }
 private void enqueue(List<Alert> alerts,List<Alert> snapshot,boolean quakeOk,boolean tsunamiOk){
  AlertPairing.refreshQueuedCompanions(queue,snapshot,quakeOk,tsunamiOk);
  targetQueue.primary(alerts);if(!alerts.isEmpty()){rain.hide();stopTarget();interruptDaily();cancelDemos();}List<Alert> notices=AlertPairing.coalesce(alerts);
  Alert update=null;for(Alert a:notices)if(AlertPairing.updates(activeReal,a)){update=a;break;}
  if(update!=null){Alert latest=update;queue.removeIf(old->AlertPairing.replacesQueued(latest,old));startReal(latest);}
  for(Alert a:notices)if(update==null||!AlertPairing.represents(update,a))putPending(a);
  drain();
 }
 private void putPending(Alert a){queue.removeIf(old->AlertPairing.replacesQueued(a,old));if(queue.size()<8)queue.add(a);}
 private void ensureExecutor(){if(executor==null)executor=Executors.newSingleThreadScheduledExecutor();}
 private void ensurePolling(){ensureExecutor();if(!polling){polling=true;executor.scheduleWithFixedDelay(this::poll,0,30,TimeUnit.SECONDS);}if(!dailyRunning){dailyRunning=true;main.post(dailyTick);}}
 private void fetchHistory(boolean summary,boolean completed,boolean replay){
  if(historyBusy){Prefs.status(this,"Consulta de histórico em andamento. Aguarde.");return;}historyBusy=true;if(historyExecutor==null)historyExecutor=Executors.newSingleThreadExecutor();final int request=++historyRequest;Prefs.status(this,summary?(completed?"Consultando o resumo completo de ontem…":"Consultando os maiores sismos de hoje · parcial…"):"Buscando o último sismo M6+ ou no Brasil nas últimas 72 horas…");
  historyExecutor.execute(()->{try{
   FeedClient.Snapshot snapshot=new FeedClient().history(summary?(completed?"completed":"daily"):"replay");
   if(summary&&completed&&!SummaryRecord.completedFor(snapshot,System.currentTimeMillis()))throw new java.io.IOException("Resumo do dia anterior não confirmado");
   if(!snapshot.quakeOk)throw new java.io.IOException("Catálogo indisponível");
   main.post(()->{historyBusy=false;if(destroyed||request!=historyRequest)return;
    if(snapshot.alerts.isEmpty()){Prefs.status(this,summary?(completed?"Nenhum sismo disponível no catálogo do dia anterior.":"Nenhum sismo disponível no catálogo de hoje até esta consulta."):"Nenhum sismo M6+ ou no Brasil nas últimas 72 horas.");stopIfIdle();return;}
    if(summary){if(snapshot.complete)Prefs.rememberSummary(this,snapshot);scheduleSummary(snapshot,replay);}else{Alert latest=snapshot.alerts.get(0),local=Prefs.lastReplay(this);
     // Prefer the newer origin; only a newer revision of that same event may replace it.
     latest=ReplaySelection.latest(latest,local);Prefs.rememberRecovered(this,latest);
     scheduleLocal(List.of(latest),false,true);
    }
   });
  }catch(Exception e){main.post(()->{historyBusy=false;if(destroyed||request!=historyRequest)return;Alert local=summary?null:Prefs.lastReplay(this);
   FeedClient.Snapshot saved=summary&&completed?Prefs.lastCompletedSummary(this):null;
   if(SummaryRecord.completedFor(saved,System.currentTimeMillis())){scheduleSummary(saved,replay);Prefs.status(this,"Sem consulta atual · resumo completo de "+saved.day+" salvo no aparelho em 10 segundos.");return;}
   if(local!=null){scheduleLocal(List.of(local),false,true);Prefs.status(this,"Servidor indisponível · replay do último registro local em 10 segundos.");}
   else{Prefs.status(this,"Histórico indisponível. Tente novamente com internet.");stopIfIdle();}
  });}});
 }
 private void stopIfIdle(){if(!Prefs.get(this).getBoolean("enabled",false)&&!draining&&!compactBusy&&demoTasks.isEmpty())stopSelf();}
 private void scheduleSummary(FeedClient.Snapshot snapshot,boolean replay){
  cancelDemos();final int generation=localGeneration;long delay=Math.max(10000,activeUntil-android.os.SystemClock.uptimeMillis()+500);
  Runnable stop=()->{if(generation!=localGeneration)return;demoTasks.clear();activeUntil=0;stopIfIdle();tryTarget();tryDaily();};
  Runnable show=()->{if(destroyed)return;if(draining||!queue.isEmpty()){Prefs.status(this,"Resumo adiado por alerta real. Solicite novamente após o aviso.");stop.run();return;}
   rain.hide();if(banner.showSummary(snapshot.alerts,snapshot.day,replay,snapshot.complete,stop)){if(!replay)Prefs.rememberSummary(this,snapshot);activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.summaryTotalDuration(snapshot.alerts.size(),android.animation.ValueAnimator.areAnimatorsEnabled())+1000;}else stop.run();
  };demoTasks.add(show);demoTasks.add(stop);main.postDelayed(show,delay);
  Prefs.status(this,(replay?"Replay do resumo de ":"Resumo de ")+snapshot.day+" em 10 segundos · "+snapshot.alerts.size()+" sismos · 6 segundos de leitura por sismo + animações.");
 }
 private void interruptDaily(){
  if(dailyEnd!=null)main.removeCallbacks(dailyEnd);dailyEnd=null;
  if(daily!=null&&daily.interrupt()){banner.hide();activeUntil=0;}
 }
 private boolean dailyEnabled(){return Prefs.get(this).getBoolean("enabled",false)&&Prefs.get(this).getBoolean("dailyAuto",true);}
 private boolean screenReady(){PowerManager power=getSystemService(PowerManager.class);return power==null||power.isInteractive();}
 private boolean localBusy(){return compactBusy||draining||!queue.isEmpty()||!demoTasks.isEmpty()||historyBusy||android.os.SystemClock.uptimeMillis()<activeUntil;}
 private void checkDaily(){
  if(destroyed)return;if(!dailyEnabled()){interruptDaily();pendingDaily=null;return;}if(!screenReady()){interruptDaily();return;}
  String day=daily.due(System.currentTimeMillis());if(day.isEmpty()||daily.displaying()||dailyBusy||android.os.SystemClock.elapsedRealtime()<dailyRetryAt)return;
  if(pendingDaily!=null&&!day.equals(pendingDaily.day))pendingDaily=null;
  if(localBusy())return;
  if(pendingDaily==null){FeedClient.Snapshot saved=Prefs.lastSummary(this);if(saved!=null&&saved.complete&&day.equals(saved.day))pendingDaily=saved;}
  if(pendingDaily!=null){tryDaily();return;}
  dailyBusy=true;if(historyExecutor==null)historyExecutor=Executors.newSingleThreadExecutor();
  historyExecutor.execute(()->{try{
   FeedClient.Snapshot result=new FeedClient().history("completed");
   if(!result.quakeOk||!result.complete||!day.equals(result.day))throw new java.io.IOException("Dia encerrado não confirmado");
   main.post(()->{dailyBusy=false;if(destroyed||!dailyEnabled()||!day.equals(daily.due(System.currentTimeMillis())))return;
    if(result.alerts.isEmpty()){int attempt=daily.start(day);if(daily.finish(day,attempt))Prefs.get(this).edit().putString("dailyDeliveredDay",daily.deliveredDay).apply();Prefs.status(this,"Resumo de "+day+": nenhum sismo disponível nos catálogos consultados.");return;}
    pendingDaily=result;dailyRetryAt=0;tryDaily();
   });
  }catch(Exception e){main.post(()->{dailyBusy=false;if(destroyed)return;dailyRetryAt=android.os.SystemClock.elapsedRealtime()+5*60000L;Prefs.status(this,"Resumo diário indisponível. Nova tentativa em 5 minutos.");});}});
 }
 private void tryDaily(){
  if(destroyed||!dailyEnabled()||!screenReady()||pendingDaily==null||daily.displaying()||localBusy()||android.os.SystemClock.elapsedRealtime()<dailyRetryAt)return;
  if(!pendingDaily.day.equals(daily.due(System.currentTimeMillis())))return;
  FeedClient.Snapshot snapshot=pendingDaily;
  int attempt=daily.start(snapshot.day);
  dailyEnd=()->{if(!screenReady()){interruptDaily();return;}if(destroyed||!daily.finish(snapshot.day,attempt))return;Prefs.get(this).edit().putString("dailyDeliveredDay",daily.deliveredDay).apply();pendingDaily=null;dailyEnd=null;activeUntil=0;tryTarget();Prefs.status(this,"Resumo diário de "+snapshot.day+" exibido. Disponível no replay do resumo.");};
  rain.hide();if(!banner.showSummary(snapshot.alerts,snapshot.day,false,true,dailyEnd)){daily.interrupt();dailyEnd=null;dailyRetryAt=android.os.SystemClock.elapsedRealtime()+5*60000L;return;}
  Prefs.rememberSummary(this,snapshot);activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.summaryTotalDuration(snapshot.alerts.size(),android.animation.ValueAnimator.areAnimatorsEnabled())+1000;
  Prefs.status(this,"Resumo automático de "+snapshot.day+" · dia encerrado · 6 segundos de leitura por sismo + animações.");
 }
 private PendingIntent open(){return PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private void poll(){if(destroyed)return;try{boolean enabledTargets=Prefs.get(this).getBoolean("targetAlerts",true);long settingsRevision=Prefs.get(this).getLong("targetSettingsRevision",0);if(enabledTargets!=targetsEnabled||settingsRevision!=targetSettingsRevision){targetSettingsRevision=settingsRevision;feed.invalidate();tracker.targetsReady=false;targetsEnabled=enabledTargets;main.post(()->{targetQueue.clear();stopTarget();});}FeedClient.Snapshot snapshot=feed.read();if(destroyed)return;long now=System.currentTimeMillis();Prefs.get(this).edit().putLong("lastCheck",now).apply();if(snapshot.unchanged){refreshOfficialConfig();return;}Set<String> disabled=Prefs.get(this).getStringSet("disabledTargetAreas",Collections.emptySet());for(Alert a:snapshot.alerts){if(!a.targetAreas.isEmpty())a.targetArea=a.targetAreas.stream().filter(area->!disabled.contains(area)).findFirst().orElse("");else if(disabled.contains(a.targetArea))a.targetArea="";}List<Alert> all=tracker.accept(snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk,now,snapshot.catalogs,targetsEnabled);List<Alert> small=new ArrayList<>(),alerts=new ArrayList<>();for(Alert a:all){if(a.compact)small.add(a);else alerts.add(a);}AlertPairing.attach(alerts,snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk);Prefs.save(this,tracker);StringBuilder health=new StringBuilder();for(Map.Entry<String,Boolean> e:snapshot.catalogs.entrySet())if(!e.getValue()){if(health.length()>0)health.append(", ");health.append(catalogLabel(e.getKey()));}if(!snapshot.tsunamiOk){if(health.length()>0)health.append(", ");health.append("boletins de tsunami");}Prefs.get(this).edit().putString("sourceHealth",health.length()==0?"Fontes disponíveis":"Indisponível: "+health).apply();Prefs.status(this,health.length()==0?"Conectado · fontes disponíveis":"Monitoramento parcial · "+health);main.post(()->{if(destroyed)return;enqueue(alerts,snapshot.alerts,snapshot.quakeOk,snapshot.tsunamiOk);for(Alert a:small)targetQueue.add(a);tryTarget();});refreshOfficialConfig();
 }catch(Exception e){Prefs.status(this,"Sem atualização confirmada. Tentando novamente em 30 s.");}}
 private static String catalogLabel(String key){return key.equals("USGS_BR")?"USGS Brasil":key.equals("EMSC_GLOBAL")?"EMSC global":key.equals("GEOFON_GLOBAL")?"GEOFON global":key.equals("EMSC")?"EMSC Brasil":key.equals("GEOFON")?"GEOFON Brasil":key;}
 private void refreshOfficialConfig(){if(destroyed||android.os.SystemClock.elapsedRealtime()<nextConfigCheck)return;nextConfigCheck=android.os.SystemClock.elapsedRealtime()+15*60000L;try{org.json.JSONObject root=OfficialConfig.read();if(destroyed)return;OfficialConfig.applyTheme(this,root);OfficialConfig.Release release=OfficialConfig.release(root);if(release.enabled&&TrustPolicy.newer(BuildConfig.VERSION_CODE,release.code))Prefs.get(this).edit().putString("updateStatus","Atualização oficial "+release.version+" disponível. Abra Verificar atualização oficial.").apply();}catch(Exception ignored){}}
 private void stopTarget(){if(targetEnd!=null)main.removeCallbacks(targetEnd);targetEnd=null;compactBusy=false;compact.hide();}
 private void tryTarget(){if(destroyed||!targetsEnabled||localBusy()||daily!=null&&daily.displaying()||!screenReady())return;Alert a=targetQueue.next(System.currentTimeMillis());if(a==null)return;showTargetCard(a,false);}
 private void showTargetCard(Alert a,boolean demo){rain.hide();compactBusy=true;compact.show(a,demo);targetEnd=()->{compactBusy=false;targetEnd=null;tryTarget();tryDaily();stopIfIdle();};main.postDelayed(targetEnd,CompactNotice.DURATION_MS+700);}
 private void drain(){if(destroyed||draining)return;if(queue.isEmpty()){tryTarget();tryDaily();return;}startReal(queue.remove());}
 private void startReal(Alert a){
  if(nextReal!=null)main.removeCallbacks(nextReal);draining=true;activeReal=a;display(a,false,false);
  nextReal=()->{draining=false;activeReal=null;activeUntil=0;nextReal=null;drain();};activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20))+1000;main.postDelayed(nextReal,Math.max(0,activeUntil-android.os.SystemClock.uptimeMillis()));
 }
 private void display(Alert a,boolean demo,boolean replay){
  if(!demo&&!replay)Prefs.rememberReal(this,a);
  if(demo||replay)activeUntil=android.os.SystemClock.uptimeMillis()+BannerTimeline.durationMillis(a,Prefs.get(this).getInt("seconds",20));
  rain.hide();stopTarget();boolean overlay=banner.show(a,demo,replay);if(!overlay)try{getSystemService(NotificationManager.class).notify(100+Math.floorMod(a.id.hashCode(),1000000),new Notification.Builder(this,"alerts").setSmallIcon(R.drawable.ic_monitor).setContentTitle((demo?"DEMONSTRAÇÃO · ":replay?"REPLAY · ":!a.revision.isEmpty()?"ATUALIZAÇÃO · ":"")+a.title).setContentText(a.detail).setStyle(new Notification.BigTextStyle().bigText((a.revision.isEmpty()?"":a.revision+" · ")+a.detail)).setContentIntent(open()).setAutoCancel(true).build());}catch(SecurityException e){Prefs.status(this,"Notificações bloqueadas pelo sistema. Confira a permissão de sobreposição.");}
  if(!replay&&!a.quietInformation()&&Prefs.get(this).getBoolean("sound",true)){try{if(tone==null)tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,65);tone.startTone(ToneGenerator.TONE_PROP_BEEP,350);}catch(RuntimeException ignored){}}
 }
 @Override public void onDestroy(){destroyed=true;RuntimeDiagnostics.stop();rain.close();try{unregisterReceiver(screenChanges);}catch(IllegalArgumentException ignored){}if(daily!=null)daily.interrupt();if(executor!=null)executor.shutdownNow();if(historyExecutor!=null)historyExecutor.shutdownNow();main.removeCallbacksAndMessages(null);banner.hide();compact.hide();targetQueue.clear();queue.clear();if(tone!=null)tone.release();super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}

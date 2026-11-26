package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;import java.util.concurrent.*;import java.util.function.BooleanSupplier;
/** Prefetch during the weather countdown; always give bounded feedback after weather. */
final class WeatherSatelliteSequence implements AutoCloseable {
 static final long AFTER_WEATHER=13000,DURATION=15000,WAIT_FOR_IMAGE=20000,ERROR_DURATION=8000,TOTAL=AFTER_WEATHER+WAIT_FOR_IMAGE+DURATION+500,PREPARE_TTL=60000;
 static final InfraredPlan.Scope RADAR_REGION=new InfraredPlan.Scope("SP/RJ",-50,-27,-40,-18);
 interface Loader {WeatherSatelliteClient.Frame load()throws Exception;void close();default void onFrame(java.util.function.Consumer<WeatherSatelliteClient.Frame> receiver){}}
 private final Context context;private final BooleanSupplier allowed;private final Banner banner;private final Handler main=new Handler(Looper.getMainLooper());private final Handler delivery=new Handler(Looper.getMainLooper());private final java.util.function.Supplier<Loader> factory;private ExecutorService worker;private Loader reader;private WeatherSatelliteClient.Frame frame;private WeatherSatelliteCard card;private FrameLayout current;private int generation;private boolean closed,pending,armed,failed,rendered,flipExpected;private long showAt;
 static final long RADAR_BUDGET=24000,PARALLEL_BUDGET=28000;
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed){this(c,allowed,()->{WeatherSatelliteClient client=new WeatherSatelliteClient(c);WeatherSatelliteClient geography=new WeatherSatelliteClient(c);RadarMapClient radar=new RadarMapClient();return new Loader(){
  private volatile boolean stopped;
  private java.util.function.Consumer<WeatherSatelliteClient.Frame> receiver;
  public void onFrame(java.util.function.Consumer<WeatherSatelliteClient.Frame> receiver){this.receiver=receiver;}
  public WeatherSatelliteClient.Frame load()throws Exception{
   final Object gate=new Object();final boolean[] accepting={true};
   final WeatherSatelliteClient.Frame[] results=new WeatherSatelliteClient.Frame[2];
   final CountDownLatch complete=new CountDownLatch(2);
   ExecutorService tasks=Executors.newFixedThreadPool(2);
   java.util.function.BiConsumer<Integer,WeatherSatelliteClient.Frame> finish=(index,result)->{
    synchronized(gate){if(accepting[0]&&!stopped){if(result!=null&&receiver!=null)receiver.accept(result);else results[index]=result;}else if(result!=null)result.close();}
    complete.countDown();
   };
   try{
    tasks.execute(()->{WeatherSatelliteClient.Frame primary=null;
     try{long now=System.currentTimeMillis();RadarMapClient.Frame observed=radar.latestWithin(now,RADAR_BUDGET);
      if(!stopped&&observed.at<=now&&now-observed.at<=60*60000L){
       Bitmap image=RadarMapRender.render(c,geography,RADAR_REGION,observed);
       if(stopped)image.recycle();else primary=WeatherSatelliteClient.Frame.radar(image,observed,RADAR_REGION);
      }
     }catch(Exception|OutOfMemoryError error){if(!stopped)android.util.Log.w("ArgosRadar","Radar automático indisponível",error);}
     finally{radar.close();geography.close();finish.accept(0,primary);}
    });
    tasks.execute(()->{WeatherSatelliteClient.Frame satellite=null;
     try{if(!stopped){satellite=client.latest(RADAR_REGION,System.currentTimeMillis());
      if(satellite!=null&&!stopped)try{satellite.previousObserved=client.previousForBroadcast(satellite,System.currentTimeMillis());}catch(Exception ignored){}
     }}catch(Exception|OutOfMemoryError error){if(!stopped)android.util.Log.w("ArgosRadar","Infravermelho indisponível",error);}
     finally{client.close();finish.accept(1,satellite);}
    });
    complete.await(PARALLEL_BUDGET,TimeUnit.MILLISECONDS);
    synchronized(gate){
     accepting[0]=false;
     if(stopped)return null;
     WeatherSatelliteClient.Frame primary=results[0],satellite=results[1];results[0]=null;results[1]=null;
     if(primary==null)return satellite;
     primary.alternate=satellite;return primary;
    }
   }finally{
    synchronized(gate){accepting[0]=false;for(WeatherSatelliteClient.Frame result:results)if(result!=null)result.close();}
    tasks.shutdownNow();radar.close();geography.close();client.close();
   }
  }
  public void close(){stopped=true;radar.close();geography.close();client.close();}
 };});}
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed,java.util.function.Supplier<Loader> factory){context=c;this.allowed=allowed;this.factory=factory;banner=new Banner(c);}
 void prepare(){if(closed||pending)return;pending=true;flipExpected=false;int token=++generation;Prefs.get(context).edit().putString("satelliteStatus","Mapa: consultando radar e satélite do Sudeste").apply();
  main.postDelayed(()->{if(token==generation&&pending&&!armed)cancel();},PREPARE_TTL);
  try{reader=factory.get();}catch(RuntimeException e){failed=true;return;}Loader operation=reader;operation.onFrame(value->delivery.post(()->acceptFrame(token,value)));if(worker==null)worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{WeatherSatelliteClient.Frame result=null;try{result=operation.load();}catch(Exception|OutOfMemoryError ignored){}WeatherSatelliteClient.Frame ready=result;delivery.post(()->{
   if(closed||token!=generation||failed){if(ready!=null)ready.close();return;}
   if(reader==operation){operation.close();reader=null;}
   if(ready!=null)acceptFrame(token,ready);
   if(frame==null){failed=true;Prefs.get(context).edit().putString("satelliteStatus","Satélite: sem imagem recente disponível nesta consulta").apply();}
   if(armed&&SystemClock.uptimeMillis()>=showAt)show(token);
  });});
 }
 private void acceptFrame(int token,WeatherSatelliteClient.Frame incoming){
  if(incoming==null)return;
  if(closed||token!=generation||failed||!incoming.validAt(System.currentTimeMillis())){incoming.close();return;}
  if(frame==null)frame=incoming;
  else if(incoming.isRadar()&&!frame.isRadar()){incoming.alternate=frame;frame=incoming;}
  else if(frame.isRadar()&&!incoming.isRadar()&&frame.alternate==null)frame.alternate=incoming;
  else{incoming.close();return;}
  Prefs.get(context).edit().putString("satelliteStatus",InfraredPlan.timing(frame.at,System.currentTimeMillis())).apply();
 }
 boolean loading(){return pending&&!failed&&reader!=null;}
 void start(){if(closed||armed)return;prepare();if(!pending)return;armed=true;int token=generation;showAt=SystemClock.uptimeMillis()+AFTER_WEATHER;main.postDelayed(()->show(token),AFTER_WEATHER);
  main.postDelayed(()->{if(token==generation&&pending&&!rendered&&!failed){failed=true;closeReader();Prefs.get(context).edit().putString("satelliteStatus","Satélite: a fonte demorou a responder nesta apresentação").apply();show(token);}},AFTER_WEATHER+WAIT_FOR_IMAGE);
 }
 private boolean canShow(){PowerManager power=context.getSystemService(PowerManager.class);return allowed.getAsBoolean()&&(power==null||power.isInteractive())&&Settings.canDrawOverlays(context);}
 private void show(int token){
  if(closed||token!=generation||!armed||rendered)return;
  if(!canShow()){cancel();return;}
  if(frame!=null&&!frame.validAt(System.currentTimeMillis())){frame.close();frame=null;failed=true;}
  try{
   if(frame!=null){
    if(!banner.showSatellite(frame,"",DURATION,()->{if(token==generation)cancel();})){cancel();return;}
    rendered=true;
   }else if(failed){
    if(!banner.showSatellite(null,"Imagem indisponível nesta consulta. O boletim do tempo continua funcionando.",
      ERROR_DURATION,()->{if(token==generation)cancel();})){cancel();return;}
    rendered=true;
   }else{
    // Preserve the old wait-for-image phase, but show it inside the tarja.
    if(!banner.showSatellite(null,"Consultando radar e satélite do Sudeste…",
      WAIT_FOR_IMAGE+2000,null)){cancel();return;}
   }
   current=(FrameLayout)banner.activeView();
  }catch(RuntimeException error){
   Prefs.get(context).edit().putString("satelliteStatus","Satélite: exibição da tarja indisponível").apply();
   cancel();
  }
 }
 static WeatherSatelliteClient.Frame displayFrame(WeatherSatelliteClient.Frame root,long elapsed,long now){
  if(root==null)return null;
  WeatherSatelliteClient.Frame satellite=root.isRadar()?root.alternate:root;
  boolean radarValid=root.isRadar()&&root.validAt(now),satValid=satellite!=null&&satellite.validAt(now);
  if(radarValid&&(!satValid||elapsed<5000))return root;
  if(!satValid)return radarValid?root:null;
  long phase=radarValid?Math.max(0,elapsed-5000):Math.max(0,elapsed);
  WeatherSatelliteClient.Frame older=satellite.previousObserved;
  return phase<3000&&older!=null&&older.validAt(now)&&older.source==satellite.source&&older.at<satellite.at?older:satellite;
 }
 private void closeReader(){if(reader!=null){reader.close();reader=null;}}
 WeatherSatelliteClient.Frame currentFrame(){return frame!=null&&frame.validAt(System.currentTimeMillis())?frame:null;}
 boolean pending(){return pending;}
 /** Called at weather-card exit: only a genuine, current image can trigger the flip. */
 boolean readyForFlip(){boolean ready=armed&&!failed&&frame!=null&&frame.validAt(System.currentTimeMillis());
  if(ready)flipExpected=true;return ready;}
 private void exit(int token){if(token==generation)cancel();}
 void cancel(){
  generation++;pending=false;armed=false;failed=false;rendered=false;flipExpected=false;
  main.removeCallbacksAndMessages(null);
  banner.hide();current=null;
  if(card!=null){card.clear();card=null;}
  if(frame!=null){frame.close();frame=null;}
  closeReader();
 }
 public void close(){closed=true;cancel();if(worker!=null)worker.shutdownNow();}
}

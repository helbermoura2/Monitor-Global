package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;import java.util.concurrent.*;import java.util.function.BooleanSupplier;
/** Prefetch during the weather countdown; always give bounded feedback after weather. */
final class WeatherSatelliteSequence implements AutoCloseable {
 static final long AFTER_WEATHER=12300,DURATION=15000,WAIT_FOR_IMAGE=20000,ERROR_DURATION=8000,TOTAL=AFTER_WEATHER+WAIT_FOR_IMAGE+DURATION+500,PREPARE_TTL=60000;
 interface Loader {WeatherSatelliteClient.Frame load()throws Exception;void close();}
 private final Context context;private final BooleanSupplier allowed;private final Handler main=new Handler(Looper.getMainLooper());private final java.util.function.Supplier<Loader> factory;private ExecutorService worker;private Loader reader;private WeatherSatelliteClient.Frame frame;private WeatherSatelliteCard card;private FrameLayout current;private int generation;private boolean closed,pending,armed,failed,rendered,flipExpected;private long showAt;
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed){this(c,allowed,()->{WeatherSatelliteClient client=new WeatherSatelliteClient(c);return new Loader(){public WeatherSatelliteClient.Frame load()throws Exception{return client.latest(InfraredPlan.SOUTHEAST,System.currentTimeMillis());}public void close(){client.close();}};});}
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed,java.util.function.Supplier<Loader> factory){context=c;this.allowed=allowed;this.factory=factory;}
 void prepare(){if(closed||pending)return;pending=true;flipExpected=false;int token=++generation;Prefs.get(context).edit().putString("satelliteStatus","Satélite: consultando a imagem do Sudeste").apply();
  main.postDelayed(()->{if(token==generation&&pending&&!armed)cancel();},PREPARE_TTL);
  try{reader=factory.get();}catch(RuntimeException e){failed=true;return;}Loader operation=reader;if(worker==null)worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{WeatherSatelliteClient.Frame result=null;try{result=operation.load();}catch(Exception|OutOfMemoryError ignored){}WeatherSatelliteClient.Frame ready=result;main.post(()->{
   if(closed||token!=generation||failed){if(ready!=null)ready.close();return;}
   if(reader==operation){operation.close();reader=null;}
   if(ready==null){failed=true;Prefs.get(context).edit().putString("satelliteStatus","Satélite: sem imagem recente disponível nesta consulta").apply();}
   else{frame=ready;Prefs.get(context).edit().putString("satelliteStatus",InfraredPlan.timing(ready.at,System.currentTimeMillis())).apply();}
   if(armed&&SystemClock.uptimeMillis()>=showAt)show(token);
  });});
 }
 void start(){if(closed||armed)return;prepare();if(!pending)return;armed=true;int token=generation;showAt=SystemClock.uptimeMillis()+AFTER_WEATHER;main.postDelayed(()->show(token),AFTER_WEATHER);
  main.postDelayed(()->{if(token==generation&&pending&&!rendered&&!failed){failed=true;closeReader();Prefs.get(context).edit().putString("satelliteStatus","Satélite: a fonte demorou a responder nesta apresentação").apply();show(token);}},AFTER_WEATHER+WAIT_FOR_IMAGE);
 }
 private boolean canShow(){PowerManager power=context.getSystemService(PowerManager.class);return allowed.getAsBoolean()&&(power==null||power.isInteractive())&&Settings.canDrawOverlays(context);}
 private void show(int token){if(closed||token!=generation||!armed||rendered)return;if(!canShow()){cancel();return;}
  if(frame!=null&&System.currentTimeMillis()-frame.at>InfraredPlan.MAX_AGE){frame.close();frame=null;failed=true;}
  try{if(current==null){FrameLayout host=new FrameLayout(context);WindowManager.LayoutParams p=new WindowManager.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.BOTTOM|Gravity.RIGHT;p.x=p.y=dp(28);context.getSystemService(WindowManager.class).addView(host,p);current=host;}
   boolean firstFace=current.getChildCount()==0;
   current.removeAllViews();if(frame!=null){card=new WeatherSatelliteCard(context,frame,false);current.addView(card,new FrameLayout.LayoutParams(-1,-2));
    if(firstFace&&flipExpected)CardMotion.flipIn(card,context);else CardMotion.enter(card,context);
    rendered=true;main.postDelayed(()->{if(token==generation)exit(token);},Math.max(0,DURATION-(CardMotion.enabled()?290:0)));}
   else if(failed){View notice=message("Imagem indisponível nesta consulta. O boletim do tempo continua funcionando.");current.addView(notice,new FrameLayout.LayoutParams(-1,-2));CardMotion.enter(notice,context);main.postDelayed(()->{if(token==generation)exit(token);},Math.max(0,ERROR_DURATION-(CardMotion.enabled()?290:0)));}
   else{View loading=message("Carregando a imagem de satélite…");current.addView(loading,new FrameLayout.LayoutParams(-1,-2));if(firstFace)CardMotion.enter(loading,context);}
   context.getSystemService(WindowManager.class).updateViewLayout(current,current.getLayoutParams());
  }catch(RuntimeException error){Prefs.get(context).edit().putString("satelliteStatus","Satélite: o sistema impediu a exibição do cartão").apply();cancel();}
 }
 private View message(String text){LinearLayout box=new LinearLayout(context);box.setOrientation(LinearLayout.VERTICAL);box.setBackground(TvCardStyle.panel(context,TvCardStyle.BODY));
  LinearLayout header=TvCardStyle.header(context);
  header.addView(TvCardStyle.label(context,"SATÉLITE  /  SUDESTE",16,TvCardStyle.BODY,TvCardStyle.brand(context),2));box.addView(header);
  LinearLayout body=TvCardStyle.body(context);
  body.addView(TvCardStyle.label(context,text,16,TvCardStyle.WHITE,TvCardStyle.brand(context),3));box.addView(body);return box;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 private void closeReader(){if(reader!=null){reader.close();reader=null;}}
 boolean pending(){return pending;}
 /** Called at weather-card exit: only a genuine, current image can trigger the flip. */
 boolean readyForFlip(){boolean ready=armed&&!failed&&frame!=null&&System.currentTimeMillis()-frame.at<=InfraredPlan.MAX_AGE;
  if(ready)flipExpected=true;return ready;}
 private void exit(int token){if(token!=generation||current==null){cancel();return;}
  View host=current;View face=host instanceof FrameLayout&&((FrameLayout)host).getChildCount()>0?((FrameLayout)host).getChildAt(0):host;
  CardMotion.exit(face,context,()->{if(token==generation&&current==host)cancel();});
 }
 void cancel(){generation++;pending=false;armed=false;failed=false;rendered=false;flipExpected=false;main.removeCallbacksAndMessages(null);if(current!=null){current.animate().cancel();for(int i=0;i<current.getChildCount();i++)current.getChildAt(i).animate().cancel();try{context.getSystemService(WindowManager.class).removeView(current);}catch(RuntimeException ignored){}current=null;}if(card!=null){card.animate().cancel();card.clear();card=null;}if(frame!=null){frame.close();frame=null;}closeReader();}
 public void close(){closed=true;cancel();if(worker!=null)worker.shutdownNow();}
}

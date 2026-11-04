package top.monitorglobal.tv;
import android.content.*;import android.graphics.*;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.provider.Settings;import android.view.*;import android.widget.*;import java.util.concurrent.*;import java.util.function.BooleanSupplier;
/** Prefetch during the weather countdown; always give bounded feedback after weather. */
final class WeatherSatelliteSequence implements AutoCloseable {
 static final long AFTER_WEATHER=13000,DURATION=15000,WAIT_FOR_IMAGE=20000,ERROR_DURATION=8000,TOTAL=AFTER_WEATHER+WAIT_FOR_IMAGE+DURATION+500,PREPARE_TTL=60000;
 interface Loader {WeatherSatelliteClient.Frame load()throws Exception;void close();}
 private final Context context;private final BooleanSupplier allowed;private final Handler main=new Handler(Looper.getMainLooper());private final java.util.function.Supplier<Loader> factory;private ExecutorService worker;private Loader reader;private WeatherSatelliteClient.Frame frame;private WeatherSatelliteCard card;private FrameLayout current;private int generation;private boolean closed,pending,armed,failed,rendered;private long showAt;
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed){this(c,allowed,()->{WeatherSatelliteClient client=new WeatherSatelliteClient(c);return new Loader(){public WeatherSatelliteClient.Frame load()throws Exception{return client.latest(InfraredPlan.SOUTHEAST,System.currentTimeMillis());}public void close(){client.close();}};});}
 WeatherSatelliteSequence(Context c,BooleanSupplier allowed,java.util.function.Supplier<Loader> factory){context=c;this.allowed=allowed;this.factory=factory;}
 void prepare(){if(closed||pending)return;pending=true;int token=++generation;Prefs.get(context).edit().putString("satelliteStatus","Satélite: consultando a imagem do Sudeste").apply();
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
  try{if(current==null){FrameLayout host=new FrameLayout(context);WindowManager.LayoutParams p=new WindowManager.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|Gravity.RIGHT;p.x=p.y=dp(28);context.getSystemService(WindowManager.class).addView(host,p);current=host;}
   current.removeAllViews();if(frame!=null){card=new WeatherSatelliteCard(context,frame,false);current.addView(card,new FrameLayout.LayoutParams(-1,-2));rendered=true;main.postDelayed(()->{if(token==generation)cancel();},DURATION);}
   else if(failed){current.addView(message("Imagem indisponível nesta consulta. O boletim do tempo continua funcionando."),new FrameLayout.LayoutParams(-1,-2));main.postDelayed(()->{if(token==generation)cancel();},ERROR_DURATION);}
   else current.addView(message("Carregando a imagem de satélite…"),new FrameLayout.LayoutParams(-1,-2));
   context.getSystemService(WindowManager.class).updateViewLayout(current,current.getLayoutParams());
  }catch(RuntimeException error){Prefs.get(context).edit().putString("satelliteStatus","Satélite: o sistema impediu a exibição do cartão").apply();cancel();}
 }
 private View message(String text){LinearLayout box=new LinearLayout(context);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(12),dp(10),dp(12),dp(12));GradientDrawable bg=new GradientDrawable();bg.setColor(WeatherCardView.BODY);bg.setCornerRadius(dp(8));bg.setStroke(dp(1),WeatherCardView.CYAN);box.setBackground(bg);TextView title=new TextView(context);title.setText("SATÉLITE · SUDESTE");title.setTextSize(17);title.setTextColor(WeatherCardView.CYAN);box.addView(title);TextView body=new TextView(context);body.setText(text);body.setTextSize(16);body.setTextColor(Color.WHITE);body.setPadding(0,dp(8),0,0);box.addView(body);return box;}
 private int dp(int n){return Math.round(n*context.getResources().getDisplayMetrics().density);}
 private void closeReader(){if(reader!=null){reader.close();reader=null;}}
 boolean pending(){return pending;}
 void cancel(){generation++;pending=false;armed=false;failed=false;rendered=false;main.removeCallbacksAndMessages(null);if(current!=null){try{context.getSystemService(WindowManager.class).removeView(current);}catch(RuntimeException ignored){}current=null;}if(card!=null){card.clear();card=null;}if(frame!=null){frame.close();frame=null;}closeReader();}
 public void close(){closed=true;cancel();if(worker!=null)worker.shutdownNow();}
}

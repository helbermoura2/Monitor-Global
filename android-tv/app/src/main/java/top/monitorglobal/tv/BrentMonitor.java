package top.monitorglobal.tv;
import android.content.*;import android.os.*;import java.net.*;import java.io.*;
import java.util.concurrent.*;import java.util.function.BooleanSupplier;import org.json.*;

/** Hourly TV market card. Does not touch the 30-second seismic poll or alarm queue. */
final class BrentMonitor {
 private static final String URL="https://black-sky-9ba0.terrestre.workers.dev/tv-brent";
 private final Context context;private final BooleanSupplier allowed;private final Callable<JSONObject> reader;
 private final BrentOverlay overlay;private final Handler main=new Handler(Looper.getMainLooper());
 private ExecutorService io;private volatile HttpURLConnection connection;
 private boolean busy,closed;private long knownSlot=-1,nextRetry;private JSONObject quote;
 BrentMonitor(Context c,BooleanSupplier canShow){this(c,canShow,null);}
 BrentMonitor(Context c,BooleanSupplier canShow,Callable<JSONObject> source){
  context=c;allowed=canShow;overlay=new BrentOverlay(c);reader=source==null?this::read:source;
 }
 boolean showing(){return overlay.showing();}
 private boolean screen(){
  PowerManager power=context.getSystemService(PowerManager.class);return power==null||power.isInteractive();
 }
 void tick(){
  if(closed)return;
  boolean enabled=Prefs.get(context).getBoolean("brentHourly",true);
  long now=System.currentTimeMillis();
  if(!enabled||!BrentQuote.marketOpen(now)||!screen()){hide();return;}
  long slot=BrentQuote.slot(now);
  if(knownSlot!=slot){knownSlot=slot;quote=null;nextRetry=0;}
  if(!BrentQuote.due(Prefs.get(context).getLong("brentLastSlot",0),now))return;
  if(!allowed.getAsBoolean()||overlay.showing())return;
  BrentQuote valid=BrentQuote.parse(quote,now);
  if(valid!=null){
   if(overlay.show(valid,false)){
    Prefs.get(context).edit().putLong("brentLastSlot",slot).putString("brentStatus",
     "Brent "+String.format(java.util.Locale.forLanguageTag("pt-BR"),"%.2f",valid.price)+" US$ · "+BrentQuote.clock(valid.at)).apply();
   }
   return;
  }
  if(!busy&&SystemClock.elapsedRealtime()>=nextRetry)load();
 }
 private void load(){
  busy=true;nextRetry=SystemClock.elapsedRealtime()+5*60000L;
  if(io==null)io=Executors.newSingleThreadExecutor();
  final long requestSlot=knownSlot;
  io.execute(()->{
   JSONObject data=null;
   try{data=reader.call();}catch(Exception ignored){}
   final JSONObject result=data;
   main.post(()->{
    busy=false;
    if(closed||requestSlot!=knownSlot)return;
    quote=result;
    if(result==null||!result.optBoolean("ok"))Prefs.get(context).edit().putString("brentStatus",
      result!=null&&!result.optBoolean("marketOpen",true)?"Mercado Brent fechado":"Cotação Brent indisponível ou desatualizada").apply();
    tick();
   });
  });
 }
 private JSONObject read()throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(URL).openConnection();connection=c;
  c.setConnectTimeout(7000);c.setReadTimeout(10000);c.setInstanceFollowRedirects(false);
  c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MonitorGlobalTV-Brent/"+BuildConfig.VERSION_NAME);
  try{
   if(c.getResponseCode()!=200)throw new IOException("Unavailable");
   if(c.getContentLengthLong()>6000)throw new IOException("Oversized quote");
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   try(InputStream in=c.getInputStream()){
    byte[] buffer=new byte[1024];int n;
    while((n=in.read(buffer))!=-1){if(out.size()+n>6000)throw new IOException("Oversized quote");out.write(buffer,0,n);}
   }
   return new JSONObject(out.toString("UTF-8"));
  }finally{c.disconnect();if(connection==c)connection=null;}
 }
 void demo(){
  if(!closed&&screen()&&allowed.getAsBoolean())
   overlay.show(new BrentQuote(78.35,77.50,0.85,1.10,System.currentTimeMillis(),"DEMONSTRAÇÃO"),true);
 }
 void hide(){overlay.hide();}
 void close(){closed=true;hide();main.removeCallbacksAndMessages(null);if(connection!=null)connection.disconnect();if(io!=null)io.shutdownNow();quote=null;}
}

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
 private void status(String message){
  if(!message.equals(Prefs.get(context).getString("brentStatus","")))
   Prefs.get(context).edit().putString("brentStatus",message).apply();
 }
 private String problem(JSONObject response){
  if(response==null)return "Servidor Brent inacessível. Confira a conexão.";
  if(!response.optBoolean("marketOpen",true))return "Brent fechado ou em pausa de negociação.";
  String reason=response.optString("reason","");
  if(response.optBoolean("directAttempted")){
   if("source-stale-or-invalid".equals(reason))return "Worker sem preço; Yahoo consultado diretamente na TV, mas sem cotação recente válida.";
   return "Worker sem preço; tentativa direta da TV ao Yahoo também indisponível. Nova tentativa em até 5 min.";
  }
  if("source-stale-or-invalid".equals(reason))return "Yahoo sem negociação recente validada. Próxima tentativa automática em até 5 min.";
  if("source-unavailable".equals(reason))return "Worker sem cotação do Yahoo. Próxima tentativa automática em até 5 min.";
  return "Não foi possível confirmar uma cotação real recente.";
 }
 void checkNow(){
  if(closed)return;
  long now=System.currentTimeMillis();
  if(!BrentQuote.marketOpen(now)){status("Brent fechado ou em pausa: nenhum valor fictício será usado.");return;}
  if(!screen()){status("Tela da TV desligada: verificação adiada.");return;}
  if(!allowed.getAsBoolean()){status("Outro aviso tem prioridade sobre o Brent. Tente novamente.");return;}
  if(busy){status("Cotação real já em consulta.");return;}
  status("Consultando cotação REAL do Brent, sem simulação…");
  load(true);
 }
 private boolean screen(){
  PowerManager power=context.getSystemService(PowerManager.class);return power==null||power.isInteractive();
 }
 void tick(){
  if(closed)return;
  boolean enabled=Prefs.get(context).getBoolean("brentHourly",true);
  long now=System.currentTimeMillis();
  if(!enabled||!BrentQuote.marketOpen(now)||!screen()){
   hide();
   if(!enabled)status("Brent desativado nas preferências.");
   else if(!BrentQuote.marketOpen(now))status("Brent fechado ou em pausa de negociação.");
   return;
  }
  long slot=BrentQuote.slot(now);
  if(knownSlot!=slot){knownSlot=slot;quote=null;nextRetry=0;}
  if(!BrentQuote.due(Prefs.get(context).getLong("brentLastSlot",0),now))return;
  if(!allowed.getAsBoolean()||overlay.showing())return;
  BrentQuote valid=BrentQuote.parse(quote,now);
  if(valid!=null){
   if(overlay.show(valid,false)){
    Prefs.get(context).edit().putLong("brentLastSlot",slot).apply();
    status("REAL · US$ "+String.format(java.util.Locale.forLanguageTag("pt-BR"),"%.2f",valid.price)+" · "+BrentQuote.clock(valid.at)+" · Yahoo Finance"+(quote.optBoolean("directFromTv")?" (direto da TV)":" (Worker)"));
   }else status("Cotação real validada, mas a sobreposição foi bloqueada. Verifique a permissão.");
   return;
  }
  if(!busy&&SystemClock.elapsedRealtime()>=nextRetry)load(false);
 }
 private void load(boolean manual){
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
    if(result==null||!result.optBoolean("ok"))status(problem(result));
    else if(BrentQuote.parse(result,System.currentTimeMillis())==null)
     status("A fonte respondeu, mas o preço ou horário não passou pela validação da TV.");
    if(manual){
     BrentQuote valid=BrentQuote.parse(result,System.currentTimeMillis());
     if(valid==null){
      if(result!=null&&result.optBoolean("ok"))status("Cotação rejeitada: horário ou dados inconsistentes.");
      return;
     }
     if(!screen()||!allowed.getAsBoolean()){status("Cotação verificada, mas outro aviso tem prioridade.");return;}
     if(overlay.show(valid,false)){
      long now=System.currentTimeMillis(),slot=BrentQuote.slot(now);
      if(BrentQuote.due(Prefs.get(context).getLong("brentLastSlot",0),now))
       Prefs.get(context).edit().putLong("brentLastSlot",slot).apply();
      status("REAL · US$ "+String.format(java.util.Locale.forLanguageTag("pt-BR"),"%.2f",valid.price)+" · "+BrentQuote.clock(valid.at)+" · Yahoo Finance"+(result.optBoolean("directFromTv")?" (direto da TV)":" (Worker)"));
     }else status("Cotação real validada, porém falta permissão de sobreposição.");
     return;
    }
    tick();
   });
  });
 }
 private JSONObject read()throws Exception{
  // Prefer the reviewed Cloudflare service. Its real session check may return
  // source-unavailable when Yahoo blocks Cloudflare egress, even while Yahoo is
  // accessible from the device network.
  JSONObject worker=null;
  try{worker=readRemote(URL,6000,7000,10000);}
  catch(Exception ignored){ /* Attempt bounded, source-validated device fallback. */ }
  long now=System.currentTimeMillis();
  if(worker!=null&&BrentQuote.parse(worker,now)!=null)return worker;
  if(!BrentQuote.marketOpen(now))return worker;
  String[] yahoo={
   "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d",
   "https://query2.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d"
  };
  boolean invalid=false;
  for(String endpoint:yahoo){
   try{
    JSONObject raw=readRemote(endpoint,250000,5000,6500);
    JSONObject validated=BrentQuote.adaptYahooChart(raw,System.currentTimeMillis());
    if(validated!=null)return validated;
    invalid=true;
   }catch(Exception ignored){ /* Only a second fixed Yahoo address; never invent prices. */ }
  }
  return new JSONObject().put("ok",false).put("marketOpen",true)
   .put("reason",invalid?"source-stale-or-invalid":"source-unavailable")
   .put("directAttempted",true);
 }
 private JSONObject readRemote(String endpoint,int maxBytes,int connectMs,int readMs)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();connection=c;
  c.setConnectTimeout(connectMs);c.setReadTimeout(readMs);c.setInstanceFollowRedirects(false);
  c.setRequestProperty("Accept","application/json");
  c.setRequestProperty("User-Agent","MonitorGlobalTV-Brent/"+BuildConfig.VERSION_NAME);
  try{
   if(c.getResponseCode()!=200)throw new IOException("HTTP "+c.getResponseCode());
   if(c.getContentLengthLong()>maxBytes)throw new IOException("Oversized source");
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   try(InputStream in=c.getInputStream()){
    byte[] buffer=new byte[4096];int n;
    while((n=in.read(buffer))!=-1){
     if(out.size()+n>maxBytes)throw new IOException("Oversized source");
     out.write(buffer,0,n);
    }
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

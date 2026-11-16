package top.monitorglobal.tv;
import android.content.*;import android.os.*;import java.net.*;import java.io.*;
import java.util.concurrent.*;import java.util.function.BooleanSupplier;import org.json.*;

/** Hourly TV market card. Does not touch the 30-second seismic poll or alarm queue. */
final class BrentMonitor {
 private static final String URL="https://black-sky-9ba0.terrestre.workers.dev/tv-brent";
 private final Context context;private final BooleanSupplier allowed;private final Callable<JSONObject> reader;private final boolean externalReader;
 private final BrentOverlay overlay;private final Handler main=new Handler(Looper.getMainLooper());
 private ExecutorService io;private volatile HttpURLConnection connection;
 private java.util.function.Consumer<String> feedback;
 private Runnable onPresented;
 private boolean manualRequest;private long manualDisplayUntil;
 void setFeedback(java.util.function.Consumer<String> listener){feedback=listener;}
 void setOnPresented(Runnable listener){onPresented=listener;}
 private void presented(){
  if(onPresented!=null)onPresented.run();
  manualDisplayUntil=SystemClock.elapsedRealtime()+BrentQuote.DISPLAY+800;
 }
 private boolean busy,closed;private long knownSlot=-1,nextRetry;private JSONObject quote;private DollarQuote dollar,lastDollar;private BrentQuote lastBrent;private MarketState brentState=MarketState.unknown(),dollarState=MarketState.unknown();
 BrentMonitor(Context c,BooleanSupplier canShow){this(c,canShow,null);}
 BrentMonitor(Context c,BooleanSupplier canShow,Callable<JSONObject> source){
  context=c;allowed=canShow;overlay=new BrentOverlay(c);externalReader=source!=null;reader=source==null?this::read:source;
 }
 boolean showing(){return overlay.showing();}
 private void progress(String message){
  main.post(()->{if(manualRequest&&!closed)status(message);});
 }
 private void status(String message){
  if(manualRequest&&feedback!=null)feedback.accept(message);
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
  manualRequest=true;
  long now=System.currentTimeMillis();
  if(!screen()){status("Tela da TV desligada: verificação adiada.");manualRequest=false;return;}
  if(!allowed.getAsBoolean()){status("Outro aviso tem prioridade sobre o Brent. Tente novamente após ele terminar.");manualRequest=false;return;}
  // Open the official hourly Brent/Dollar lower-third NOW, not the obsolete
  // "Consulta por voz" corner card. Replace this very same view on result.
  if(!overlay.showPending()){
   status("Não foi possível abrir a tarja oficial. Verifique permissão para exibir sobre outros apps.");
   manualRequest=false;return;
  }
  if(busy){status("Cotação real já em consulta. Atualizando a tarja oficial.");return;}
  status(BrentQuote.marketOpen(now)?"Consultando cotação REAL do Brent, sem simulação…":"Consultando estado dos mercados. Brent fora da sessão regular; sem preço atual inventado.");
  knownSlot=BrentQuote.slot(now);
  load(true);
 }
 private boolean screen(){
  PowerManager power=context.getSystemService(PowerManager.class);return power==null||power.isInteractive();
 }
 void tick(){
  if(closed||manualRequest||SystemClock.elapsedRealtime()<manualDisplayUntil)return;
  boolean enabled=Prefs.get(context).getBoolean("brentHourly",true);
  long now=System.currentTimeMillis();
  boolean brentOpen=BrentQuote.marketOpen(now);
  boolean b3Open=MarketDOLWidget.shouldShow(now,false);
  if(!enabled||!screen()||!brentOpen&&!b3Open){
   hide();
   if(!enabled)status("Mercados desativados nas preferências.");
   else if(!brentOpen&&!b3Open)status("Brent e dólar B3 fora do horário regular.");
   return;
  }
  long slot=BrentQuote.slot(now);
  if(knownSlot!=slot){knownSlot=slot;quote=null;dollar=null;nextRetry=0;}
  boolean dueBrent=BrentQuote.due(Prefs.get(context).getLong("brentLastSlot",0),now);
  boolean dueDOL=b3Open&&now>=slot&&now<slot+45*BrentQuote.MINUTE
   &&Prefs.get(context).getLong("b3DolLastSlot",0)!=slot;
  if(!dueBrent&&!dueDOL)return;
  if(!allowed.getAsBoolean()||overlay.showing())return;
  BrentQuote valid=BrentQuote.parse(quote,now);
  if(valid!=null){
   if(overlay.showMarket(valid,dollar,valid.session,dollarState,false)){
    TvSounds.play(context,TvSoundPattern.MARKET);
    android.content.SharedPreferences.Editor e=Prefs.get(context).edit();
    if(dueBrent)e.putLong("brentLastSlot",slot);
    if(dueDOL)e.putLong("b3DolLastSlot",slot);
    e.apply();
    status("BRENT · US$ "+String.format(java.util.Locale.forLanguageTag("pt-BR"),"%.2f",valid.price)+
     " · "+BrentQuote.clock(valid.at)+" · Yahoo Finance"+
     (dueDOL?" · DOL futuro B3 no widget TradingView · atraso ~15 min":""));
   }else status("Tarja oficial bloqueada. Confira permissão de sobreposição.");
   return;
  }
  // DOL intraday must appear hourly, even when Brent's unrelated feed is unavailable.
  if(dueDOL&&(!brentOpen||SystemClock.elapsedRealtime()<nextRetry)){
   if(overlay.showMarket(null,null,MarketState.brentRegular(now),MarketState.brazilDOLRegular(now),false)){
    Prefs.get(context).edit().putLong("b3DolLastSlot",slot).apply();
    status("DOL futuro B3 · widget oficial TradingView · atraso ~15 min · Brent sem cotação recente.");
   }
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
   try{long now=System.currentTimeMillis();if(!BrentQuote.marketOpen(now))data=new JSONObject().put("version","tv-brent-v1").put("symbol","BZ=F").put("marketOpen",false).put("marketState",MarketState.brentRegular(now).value==MarketState.PAUSED?"PAUSED":"CLOSED").put("checkedAt",now);else data=reader.call();}catch(Exception ignored){}
   final JSONObject result=data;
   DollarResult fx=new DollarResult(null,MarketState.unknown());
   boolean brentValid=BrentQuote.parse(result,System.currentTimeMillis())!=null;
   boolean closedSession=!BrentQuote.marketOpen(System.currentTimeMillis());
   // Do not spend another 13 seconds looking up optional USD/BRL when the
   // requested Brent source already failed in an open session.
   if(!externalReader&&!MarketDOLWidget.shouldShow(System.currentTimeMillis(),false)&&(brentValid||manual&&closedSession)){
    if(manual||manualRequest)progress("Brent consultado. Verificando último fechamento DOL da B3…");
    fx=readDollar();
   }
   final DollarResult verifiedDollar=fx;
   main.post(()->{
    busy=false;
    boolean requested=manual||manualRequest;
    if(closed||!requested&&requestSlot!=knownSlot)return;
    quote=result;dollar=verifiedDollar.quote;dollarState=verifiedDollar.state;BrentQuote observed=BrentQuote.parse(result,System.currentTimeMillis());brentState=observed==null?MarketState.fromWorker(result,System.currentTimeMillis()):observed.session;if(observed!=null)lastBrent=observed;if(dollar!=null)lastDollar=dollar;
    if(result==null||!result.optBoolean("ok"))status(problem(result));
    else if(BrentQuote.parse(result,System.currentTimeMillis())==null)
     status("A fonte respondeu, mas o preço ou horário não passou pela validação da TV.");
    if(requested){
     BrentQuote valid=BrentQuote.parse(result,System.currentTimeMillis());
     if(!screen()||!allowed.getAsBoolean()){
      status("Consulta concluída, mas outro aviso tem prioridade ou a TV está desligada.");
      manualRequest=false;return;
     }
     if(valid==null){
      // A consulta por voz não pode terminar em "Consultando..." e sumir.
      // Sem preço confirmado: mostra a MESMA tarja do Brent, com US$ — e
      // estado real conhecido. Não transforma dados antigos em preço ao vivo.
      long current=System.currentTimeMillis();
      boolean closed=brentState.closed();
      BrentQuote previous=closed&&lastBrent!=null&&current-lastBrent.at<=7*86400000L?lastBrent:null;
      DollarQuote usd=dollar!=null?dollar:closed&&lastDollar!=null&&current-lastDollar.at<=7*86400000L?lastDollar:null;
      boolean shown=closed
       ?overlay.showMarket(previous,usd,brentState,dollarState,false)
       :overlay.showUnavailable(usd,brentState,dollarState);
      if(shown){
       presented();
       if(closed)status("BRENT · "+brentState.label()+" · DÓLAR · "+dollarState.label()+" · valores anteriores, quando disponíveis, identificados por data e hora.");
       else status("BRENT · sem cotação confirmada nesta consulta. A tarja mostra o estado do mercado, sem valor inventado.");
      }else status("Consulta do Brent sem cotação e sem permissão para exibir tarja. Confira sobreposição.");
      manualRequest=false;return;
     }
     if(overlay.showMarket(valid,dollar,valid.session,dollarState,false)){
      presented();TvSounds.play(context,TvSoundPattern.MARKET);
      long now=System.currentTimeMillis(),slot=BrentQuote.slot(now);
      android.content.SharedPreferences.Editor e=Prefs.get(context).edit();
      if(BrentQuote.due(Prefs.get(context).getLong("brentLastSlot",0),now))e.putLong("brentLastSlot",slot);
      if(MarketDOLWidget.shouldShow(now,false))e.putLong("b3DolLastSlot",slot);
      e.apply();
      status("REAL · US$ "+String.format(java.util.Locale.forLanguageTag("pt-BR"),"%.2f",valid.price)+" · "+BrentQuote.clock(valid.at)+" · Yahoo Finance"+(result.optBoolean("directFromTv")?" (direto da TV)":" (Worker)"));
     }else status("Cotação real validada, porém falta permissão de sobreposição.");
     manualRequest=false;return;
    }
    tick();
   });
  });
 }
 private JSONObject read()throws Exception{
  // Prefer the reviewed Cloudflare service. Its real session check may return
  // source-unavailable when Yahoo blocks Cloudflare egress, even while Yahoo is
  // accessible from the device network.
  long started=System.currentTimeMillis();if(!BrentQuote.marketOpen(started))return new JSONObject().put("version","tv-brent-v1").put("ok",false).put("marketOpen",false).put("symbol","BZ=F").put("marketState",MarketState.brentRegular(started).value==MarketState.PAUSED?"PAUSED":"CLOSED").put("checkedAt",started);
  JSONObject worker=null;
  try{worker=readRemote(URL,6000,7000,10000);}
  catch(Exception ignored){ /* Attempt bounded, source-validated device fallback. */ }
  long now=System.currentTimeMillis();
  if(worker!=null&&(BrentQuote.parse(worker,now)!=null||MarketState.fromWorker(worker,now).closed()))return worker;
  if(!BrentQuote.marketOpen(now))return worker;
  progress("Fonte principal sem cotação confirmada. Verificando diretamente no Yahoo Finance…");
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
 /** B3 DOL futures ONLY. The public source shows B3-attributed daily closes;
  * never request Yahoo BRL=X or present an overseas FX price as a Brazilian trade.
  * No licensed intraday source is configured, so label the close explicitly.
  */
 private static final String DOL_CLOSE_URL="https://www.noticiasagricolas.com.br/cotacoes/mercado-financeiro/dolar-b3";
 private static final class DollarResult {final DollarQuote quote;final MarketState state;DollarResult(DollarQuote q,MarketState s){quote=q;state=s;}}
 private DollarResult readDollar(){
  long now=System.currentTimeMillis();
  MarketState schedule=MarketState.brazilDOLRegular(now);
  try{
   String html=readB3ClosePage(DOL_CLOSE_URL);
   DollarQuote q=DollarQuote.fromB3CloseHtml(html,System.currentTimeMillis());
   if(q!=null)return new DollarResult(q,schedule);
  }catch(Exception ignored){ /* No B3 data: leave price missing, never substitute global FX. */ }
  return new DollarResult(null,schedule);
 }
 private String readB3ClosePage(String endpoint)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();connection=c;
  c.setConnectTimeout(5000);c.setReadTimeout(7000);c.setInstanceFollowRedirects(false);
  c.setRequestProperty("Accept","text/html");
  c.setRequestProperty("User-Agent","ArgosOrbisTV-B3Close/"+BuildConfig.VERSION_NAME);
  final int limit=800000;
  try{
   if(c.getResponseCode()!=200)throw new IOException("B3 close source HTTP "+c.getResponseCode());
   if(c.getContentLengthLong()>limit)throw new IOException("B3 close source too large");
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   try(InputStream in=c.getInputStream()){
    byte[] buffer=new byte[4096];int n;
    while((n=in.read(buffer))!=-1){
     if(out.size()+n>limit)throw new IOException("B3 close source too large");
     out.write(buffer,0,n);
    }
   }
   return out.toString("UTF-8");
  }finally{c.disconnect();if(connection==c)connection=null;}
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
   if(overlay.show(new BrentQuote(78.35,77.50,0.85,1.10,System.currentTimeMillis(),"DEMONSTRAÇÃO"),
    new DollarQuote(5.23,0.01,0.19,System.currentTimeMillis(),"SIMULAÇÃO"),true))TvSounds.play(context,TvSoundPattern.MARKET);
 }
 void hide(){manualDisplayUntil=0;overlay.hide();}
 void close(){closed=true;hide();main.removeCallbacksAndMessages(null);if(connection!=null)connection.disconnect();if(io!=null)io.shutdownNow();quote=null;}
}



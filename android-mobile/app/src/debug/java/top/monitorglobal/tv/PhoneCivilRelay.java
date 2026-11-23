package top.monitorglobal.tv;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Private opt-in diagnostic relay. No SMS permissions, no static credentials in the APK.
 * The detected message is PHONE-OBSERVED, never independently verified by CAP.
 */
final class PhoneCivilRelay {
 private static final String BASE="https://black-sky-9ba0.terrestre.workers.dev/civil-relay/v1/";
 private static final String PREF="argos-civil-tv-relay";
 private static final ExecutorService IO=Executors.newSingleThreadExecutor();
 private static final Handler MAIN=new Handler(Looper.getMainLooper());
 static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
 static boolean paired(Context c){return token(c).matches("[0-9a-f]{64}");}
 static boolean forwarding(Context c){return paired(c)&&prefs(c).getBoolean("forwarding",false);}
 static void disable(Context c){prefs(c).edit().putBoolean("forwarding",false).apply();}
 static void forget(Context c){prefs(c).edit().clear().apply();}
 // Voluntary display label only: no IMEI, serial, phone number or location.
 static String deviceLabel(Context c){
  String chosen=prefs(c).getString("deviceLabel","");
  if("Galaxy S25 Ultra".equals(chosen)||"Nothing Phone 1".equals(chosen))return chosen;
  String model=android.os.Build.MODEL==null?"":android.os.Build.MODEL.trim();
  String maker=android.os.Build.MANUFACTURER==null?"":android.os.Build.MANUFACTURER.toLowerCase(java.util.Locale.ROOT);
  if("SM-S938B".equalsIgnoreCase(model)||("samsung".equals(maker)&&model.toUpperCase(java.util.Locale.ROOT).startsWith("SM-S938")))return "Galaxy S25 Ultra";
  if("A063".equalsIgnoreCase(model)||("nothing".equals(maker)&&model.toLowerCase(java.util.Locale.ROOT).contains("phone (1)")))return "Nothing Phone 1";
  return "Celular Android";
 }
 static void setDeviceLabel(Context c,String label){
  if(!label.isEmpty()&&!"Galaxy S25 Ultra".equals(label)&&!"Nothing Phone 1".equals(label))
   throw new IllegalArgumentException("Identificação inválida");
  prefs(c).edit().putString("deviceLabel",label).apply();
 }
 private static String token(Context c){return prefs(c).getString("phoneToken","");}
 private static JSONObject request(String path,String authorization,JSONObject payload) throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL(BASE+path).openConnection();
  connection.setRequestMethod("POST");connection.setConnectTimeout(4500);connection.setReadTimeout(6500);
  connection.setInstanceFollowRedirects(false);
  connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
  connection.setRequestProperty("Cache-Control","no-store");
  if(!authorization.isEmpty())connection.setRequestProperty("Authorization","Bearer "+authorization);
  byte[] data=payload.toString().getBytes(StandardCharsets.UTF_8);
  if(data.length>1800)throw new IOException("Mensagem muito longa");
  connection.setDoOutput(true);connection.setFixedLengthStreamingMode(data.length);
  try{
   try(OutputStream output=connection.getOutputStream()){output.write(data);}
   int status=connection.getResponseCode();
   if(status!=200)throw new IOException("Worker HTTP "+status);
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream in=connection.getInputStream()){byte[] buf=new byte[1024];int count;
    while((count=in.read(buf))!=-1){if(bytes.size()+count>2048)throw new IOException("Resposta excedeu limite");bytes.write(buf,0,count);}
   }
   return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
  }finally{connection.disconnect();}
 }
 static void pair(Activity activity,String code,Consumer<String> done){
  if(code==null||!code.matches("[0-9]{8}")){done.accept("O código deve conter 8 dígitos.");return;}
  IO.execute(()->{
   String result;
   try{
    JSONObject response=request("phone/pair","",new JSONObject().put("code",code));
    String phoneToken=response.getString("phoneToken");
    if(!phoneToken.matches("[0-9a-f]{64}"))throw new IOException("Vínculo inválido");
    prefs(activity).edit().putString("phoneToken",phoneToken).putBoolean("forwarding",false)
     .putString("status","Vinculado à TV. Ative o envio quando desejar.").apply();
    result="Celular vinculado! Ative o envio automático à TV nesta tela.";
   }catch(Exception e){result="Não foi possível vincular. Confira o código e se ele ainda está válido ("+e.getClass().getSimpleName()+").";}
   final String text=result;MAIN.post(()->{if(!activity.isDestroyed())done.accept(text);});
  });
 }
 static void test(Context context,Consumer<String> done){
  String text="Alerta severo Defesa Civil: TESTE SIMULADO do Argos Orbis. Este aviso é fictício e não representa uma emergência.";
  send(context,text,true,"MANUAL_TEST",context.getPackageName(),System.currentTimeMillis(),done);
 }
 static void send(Context context,String raw,boolean simulation,String source,String packageName,long observedAt,Consumer<String> done){
  if(!forwarding(context)){if(done!=null)MAIN.post(()->done.accept("Vincule e ative o encaminhamento à TV."));return;}
  String credential=token(context);
  if(!credential.matches("[0-9a-f]{64}"))return;
  final JSONObject payload=new JSONObject();
  try{
   payload.put("text",raw.length()>500?raw.substring(0,500):raw);
   payload.put("test",simulation);
   payload.put("severity",AlertProbeDiagnostics.normalized(raw).contains("alerta extremo")?"Extreme":"Severe");
   payload.put("source",source);
   payload.put("packageName",packageName);
   payload.put("observedAt",observedAt);
   payload.put("deviceLabel",deviceLabel(context));
  }catch(Exception e){return;}
  Context app=context.getApplicationContext();
  IO.execute(()->{
   String result="Falha no envio para a TV.";
   int[] pauses={0,4000,12000,28000};
   for(int i=0;i<pauses.length;i++){
    if(!forwarding(app))break;
    if(System.currentTimeMillis()-observedAt>115000){result="Aviso expirado antes do envio.";break;}
    if(pauses[i]>0)try{Thread.sleep(pauses[i]);}catch(InterruptedException e){Thread.currentThread().interrupt();break;}
    try{
     JSONObject answer=request("phone/send",credential,payload);
     if(answer.optBoolean("accepted",false)){
      String first=answer.optString("firstDevice","Celular sem identificação");
      result=answer.optBoolean("duplicate",false)
       ?"Aviso já recebido pela ponte; duplicação evitada. Primeiro no Worker: "+first+"."
       :"Aviso aceito pelo Worker por "+deviceLabel(app)+"; aguardando apresentação na TV.";
      prefs(app).edit().putString("lastFirstDevice",first)
       .putLong("lastFirstWorkerAt",answer.optLong("firstReceivedAt",0L))
       .putString("lastRelayEventId",answer.optString("id","")).apply();
      break;
     }
    }catch(Exception e){result="Falha de transporte: "+e.getClass().getSimpleName()+" (não confirmado na TV).";}
   }
   prefs(app).edit().putString("status",result).putLong("lastSendAttempt",System.currentTimeMillis()).apply();
   if(done!=null){final String message=result;MAIN.post(()->done.accept(message));}
  });
 }
}

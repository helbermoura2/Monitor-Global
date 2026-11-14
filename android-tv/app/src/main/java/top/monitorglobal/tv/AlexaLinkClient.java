package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.os.*;
import org.json.*;
import java.io.*;import java.net.*;import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

/** Paired Alexa relay. No passwords, Alexa access tokens, or voice recordings in this APK. */
final class AlexaLinkClient {
 private static final String ROOT="https://black-sky-9ba0.terrestre.workers.dev";
 private static final String BASE=ROOT+"/alexa/v1";
 static final String TOKEN_PREF="alexaDeviceToken",LAST_COMMAND_PREF="alexaLastCommandId";
 private static final int LIMIT=4096;
 private AlexaLinkClient(){}
 static final class Command {
  final String id,type,source;
  Command(String id,String type,String source){this.id=id;this.type=type;this.source=source;}
 }
 private static JSONObject request(String path,String method,String token,JSONObject input) throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL((path.startsWith("/google-home/")?ROOT:BASE)+path).openConnection();
  connection.setConnectTimeout(4500);connection.setReadTimeout(6000);
  connection.setInstanceFollowRedirects(false);connection.setRequestMethod(method);
  connection.setRequestProperty("Accept","application/json");
  connection.setRequestProperty("Cache-Control","no-store");
  if(token!=null&&!token.isEmpty())connection.setRequestProperty("Authorization","Bearer "+token);
  if(input!=null){
   connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
   byte[] bytes=input.toString().getBytes(StandardCharsets.UTF_8);
   if(bytes.length>LIMIT)throw new IOException("Payload inválido");
   connection.setFixedLengthStreamingMode(bytes.length);
   try(OutputStream output=connection.getOutputStream()){output.write(bytes);}
  }
  try{
   int status=connection.getResponseCode();
   if(status!=200)throw new IOException("Bridge HTTP "+status);
   if(connection.getContentLengthLong()>LIMIT)throw new IOException("Resposta acima do limite");
   try(InputStream in=connection.getInputStream()){
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] part=new byte[1024];int n;
    while((n=in.read(part))!=-1){if(bytes.size()+n>LIMIT)throw new IOException("Resposta acima do limite");bytes.write(part,0,n);}
    return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
   }
  }finally{connection.disconnect();}
 }
 static void register(Activity activity,Consumer<String> callback){
  new Thread(()->{
   String result;
   try{
    JSONObject response=request("/register","POST","",new JSONObject());
    String token=response.getString("deviceToken"),pin=response.getString("code");
    if(!token.matches("[a-f0-9]{64}")||!pin.matches("[0-9]{6}"))throw new IOException("Vínculo inválido");
    Prefs.get(activity).edit().putString(TOKEN_PREF,token).putBoolean("alexaLinked",false).remove(LAST_COMMAND_PREF).apply();
    result="Código de vínculo: "+pin+"\n\nNa Echo ou no controle do Fire Stick, diga:\n"
     +"“Peça ao Monitor Global para vincular código "+pin+"”.\n\n"
     +"O código expira em 10 minutos. Use a mesma conta Amazon no dispositivo e no portal de desenvolvedor.\n\n"
     +"Ative o monitoramento nesta TV para receber os comandos mesmo com outros aplicativos abertos.";
   }catch(Exception e){result="Não foi possível gerar o código. Confira a internet e se a ponte Alexa já está publicada no Worker.";}
   final String message=result;
   activity.runOnUiThread(()->{if(!activity.isDestroyed()&&!activity.isFinishing())callback.accept(message);});
  },"monitor-alexa-pair").start();
 }
 /** Google Home uses the existing registered device token and command polling.
  * It never relinks, revokes, or replaces an already working Alexa account.
  * The temporary Google PIN must be entered only in Google's linking screen.
  */
 static void googlePair(Activity activity,Consumer<String> callback){
  new Thread(()->{
   String message;
   try{
    String deviceToken=token(activity);
    if(deviceToken.isEmpty()){
     JSONObject registration=request("/register","POST","",new JSONObject());
     deviceToken=registration.getString("deviceToken");
     if(!deviceToken.matches("[a-f0-9]{64}"))throw new IOException("Dispositivo inválido");
     Prefs.get(activity).edit().putString(TOKEN_PREF,deviceToken)
       .putBoolean("alexaLinked",false).remove(LAST_COMMAND_PREF).apply();
    }
    JSONObject linked=request("/google-home/v1/pair","POST",deviceToken,new JSONObject());
    String pin=linked.getString("code");
    if(!pin.matches("[0-9]{6}"))throw new IOException("Código inválido");
    message="Código Google Home: "+pin+"\n\n"
     +"No celular, abra o Google Home com a mesma conta usada na sua TCL P7K. "
     +"Em Dispositivos → Adicionar → Funciona com o Google Home, "
     +"escolha [test] Monitor Global e informe este código.\n\n"
     +"O código vence em 10 minutos. Esta é uma integração privada de testes. "
     +"Após vincular, você poderá pedir a temperatura sem abrir o aplicativo, "
     +"mantendo o monitoramento ativado.";
   }catch(Exception error){
    message="Não foi possível gerar o código Google Home. "
      +"Verifique a conexão e a publicação da ponte no Cloudflare Worker. "
      +"Detalhe: "+error.getClass().getSimpleName();
   }
   String result=message;
   activity.runOnUiThread(()->{if(!activity.isDestroyed()&&!activity.isFinishing())callback.accept(result);});
  },"monitor-google-home-pair").start();
 }
 static String token(Context context){
  String token=Prefs.get(context).getString(TOKEN_PREF,"");
  return token.matches("[a-f0-9]{64}")?token:"";
 }
 static Command next(Context context) throws Exception {
  String token=token(context);if(token.isEmpty())return null;
  JSONObject body=request("/next","GET",token,null);
  boolean linked=body.optBoolean("linked",false);
  if(Prefs.get(context).getBoolean("alexaLinked",false)!=linked)
   Prefs.get(context).edit().putBoolean("alexaLinked",linked).apply();
  JSONObject pending=body.optJSONObject("command");
  if(pending==null)return null;
  String id=pending.optString("id"),type=pending.optString("type");
  String source="google".equals(pending.optString("source"))?"google":"alexa";
  return id.matches("[0-9a-f-]{36}")&&(type.equals("brent")||type.equals("weather")||type.equals("brazil")||type.equals("recent-quake")||type.equals("last-summary")||type.equals("today"))?new Command(id,type,source):null;
 }
 static void acknowledge(Context context,String id) throws Exception {
  if(!id.matches("[0-9a-f-]{36}")||token(context).isEmpty())return;
  request("/ack","POST",token(context),new JSONObject().put("id",id));
 }
}

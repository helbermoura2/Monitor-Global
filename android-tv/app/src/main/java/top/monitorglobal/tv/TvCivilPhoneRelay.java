package top.monitorglobal.tv;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;

/** Independent, authenticated phone screen alert relay, NOT a CAP source. */
final class TvCivilPhoneRelay {
 private static final String BASE="https://black-sky-9ba0.terrestre.workers.dev/civil-relay/v1/";
 private static final String TOKEN_KEY="civilPhoneTvToken";
 static final class Event {
  final String id;
  final DefesaCivilSp.Notice notice;
  final boolean test;
  final long receivedAt, expiresAt;
  final String firstDevice, secondDevice;
  final long firstReceivedAt, secondReceivedAt, firstObservedAt, secondObservedAt;
  Event(String id,DefesaCivilSp.Notice notice,boolean test,long receivedAt,long expiresAt){
   this(id,notice,test,receivedAt,expiresAt,"Celular sem identificação","",
    receivedAt,0L,0L,0L);
  }
  Event(String id,DefesaCivilSp.Notice notice,boolean test,long receivedAt,long expiresAt,
        String firstDevice,String secondDevice,long firstReceivedAt,long secondReceivedAt,
        long firstObservedAt,long secondObservedAt){
   this.id=id;this.notice=notice;this.test=test;this.receivedAt=receivedAt;this.expiresAt=expiresAt;
   this.firstDevice=firstDevice;this.secondDevice=secondDevice;
   this.firstReceivedAt=firstReceivedAt;this.secondReceivedAt=secondReceivedAt;
   this.firstObservedAt=firstObservedAt;this.secondObservedAt=secondObservedAt;
  }
 }
 private TvCivilPhoneRelay(){}
 static String safeName(String name){
  if("Galaxy S25 Ultra".equals(name)||"Nothing Phone 1".equals(name))return name;
  return "Celular sem identificação";
 }
 static boolean paired(Context c){return token(c).matches("[0-9a-f]{64}");}
 static String token(Context c){return Prefs.get(c).getString(TOKEN_KEY,"");}
 static void forget(Context c){Prefs.get(c).edit().remove(TOKEN_KEY).remove("civilPhoneShown").apply();}
 private static JSONObject request(String route,String method,String auth,JSONObject body)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(BASE+route).openConnection();
  c.setConnectTimeout(4000);c.setReadTimeout(5500);c.setInstanceFollowRedirects(false);
  c.setRequestMethod(method);c.setRequestProperty("Accept","application/json");
  c.setRequestProperty("Cache-Control","no-store");
  if(!auth.isEmpty())c.setRequestProperty("Authorization","Bearer "+auth);
  if(body!=null){
   byte[] raw=body.toString().getBytes(StandardCharsets.UTF_8);
   if(raw.length>1800)throw new IOException("Pedido acima do limite");
   c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");
   c.setFixedLengthStreamingMode(raw.length);
   try(OutputStream stream=c.getOutputStream()){stream.write(raw);}
  }
  try{
   if(c.getResponseCode()!=200)throw new IOException("Ponte HTTP "+c.getResponseCode());
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream input=c.getInputStream()){byte[] buf=new byte[1024];int n;
    while((n=input.read(buf))!=-1){if(bytes.size()+n>16000)throw new IOException("Resposta acima do limite");bytes.write(buf,0,n);}
   }
   return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
  }finally{c.disconnect();}
 }
 static void code(Activity a,Consumer<String> callback){
  new Thread(()->{
   String result;
   try{
    String existing=token(a);
    JSONObject r;
    if(existing.matches("[0-9a-f]{64}")){
     try{r=request("tv/code","POST",existing,new JSONObject());}
     catch(IOException auth){
      // A revoked/expired pairing can be replaced from this TV, never silently reused.
      r=request("tv/register","POST","",new JSONObject());
      String fresh=r.getString("tvToken");
      if(!fresh.matches("[0-9a-f]{64}"))throw new IOException("Registro inválido");
      Prefs.get(a).edit().putString(TOKEN_KEY,fresh).remove("civilPhoneShown").apply();
     }
    }else{
     r=request("tv/register","POST","",new JSONObject());
     String fresh=r.getString("tvToken");
     if(!fresh.matches("[0-9a-f]{64}"))throw new IOException("Registro inválido");
     Prefs.get(a).edit().putString(TOKEN_KEY,fresh).remove("civilPhoneShown").apply();
    }
    String pin=r.getString("code");
    if(!pin.matches("[0-9]{8}"))throw new IOException("Código inválido");
    result="CÓDIGO DA TV: "+pin+"\n\nNo Argos Orbis do celular abra Mais → Informações técnicas → Teste de alertas Severos/Extremos → Vincular à TV.\n\nDigite estes 8 dígitos, ative o envio e toque Enviar TESTE para a TV.\n\nO código expira em 10 minutos. Você pode gerar outro para o segundo celular. O monitoramento da TV precisa estar ativado.";
   }catch(Exception e){result="Não foi possível gerar um código. Verifique a conexão e se a ponte do Cloudflare já está publicada. ("+e.getClass().getSimpleName()+")";}
   final String text=result;
   a.runOnUiThread(()->{if(!a.isFinishing()&&!a.isDestroyed())callback.accept(text);});
  },"argos-civil-tv-pair").start();
 }
 static List<Event> poll(Context c)throws Exception{
  String credential=token(c);
  if(!credential.matches("[0-9a-f]{64}"))return java.util.Collections.emptyList();
  JSONObject data=request("tv/poll","GET",credential,null);
  JSONArray arr=data.getJSONArray("events");
  if(arr.length()>10)throw new JSONException("Eventos excederam limite");
  long now=System.currentTimeMillis();
  List<Event> events=new ArrayList<>();
  for(int i=0;i<arr.length();i++){
   JSONObject item=arr.getJSONObject(i);
   String id=item.optString("id"),text=item.optString("text"),type=item.optString("type");
   String severity=item.optString("severity"),origin=item.optString("packageName");
   long time=item.optLong("receivedAt"),expiry=item.optLong("expiresAt");
   boolean demo="test".equals(type);
   if(!id.matches("[0-9a-f-]{36}")||!java.util.Arrays.asList("Severe","Extreme").contains(severity)||
      text.length()<28||text.length()>500||time<=0||time>now+15000||now-time>5*60000||
      expiry<=now||expiry>time+5*60000||(!demo&&!"phone".equals(type)))continue;
   if(!demo&&!(origin.equals("com.android.systemui")||origin.equals("com.samsung.android.cellbroadcastreceiver")||
      origin.equals("com.sec.android.cellbroadcastreceiver")||origin.equals("com.android.cellbroadcastreceiver")||
      origin.equals("com.google.android.cellbroadcastreceiver")||
      origin.startsWith("com.android.cellbroadcastreceiver.")||origin.startsWith("com.google.android.cellbroadcastreceiver.")))continue;
   // Never collapse a phone-observed message into an official IDAP/CAP record.
   DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(id, "Celular Argos Orbis (não verificado via CAP)",
     text,severity,time,expiry);
   String first=item.optString("firstDevice","Celular sem identificação");
   String second=item.optString("secondDevice","");
   // Only two owner-assigned names are expected; never display arbitrary text.
   first=safeName(first);
   second=second.isEmpty()?"":safeName(second);
   long firstAt=item.optLong("firstReceivedAt",time);
   long secondAt=item.optLong("secondReceivedAt",0L);
   long firstObserved=item.optLong("firstObservedAt",0L);
   long secondObserved=item.optLong("secondObservedAt",0L);
   if(firstAt<time||firstAt>now+15000)firstAt=time;
   if(secondAt<firstAt||secondAt>now+15000){secondAt=0;second="";}
   events.add(new Event(id,n,demo,time,expiry,first,second,
    firstAt,secondAt,firstObserved,secondObserved));
  }
  return events;
 }
}

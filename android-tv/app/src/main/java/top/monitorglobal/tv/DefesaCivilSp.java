package top.monitorglobal.tv;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class DefesaCivilSp {
 static final String SOURCE="https://idapfile.mdr.gov.br/idap/api/rss/cap";
 static final String PANEL="https://admin.defesacivil.sp.gov.br/previsaodotempo/sp/alertas";
 private static final String SNAPSHOT="https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/data/defesa-civil-sp.json";

 static final class Notice {
  final String id,issuer,message,severity;
  final long sent,expires;
  Notice(String id,String issuer,String message,String severity,long sent,long expires){
   this.id=id;this.issuer=issuer;this.message=message;this.severity=severity;this.sent=sent;this.expires=expires;
  }
  String level(){return "Extreme".equals(severity)?"Alerta extremo":"Alerta severo";}
 }

 final List<Notice> notices;
 final long checkedAt,updatedAt;
 private DefesaCivilSp(List<Notice> notices,long checkedAt,long updatedAt){
  this.notices=Collections.unmodifiableList(notices);this.checkedAt=checkedAt;this.updatedAt=updatedAt;
 }
 boolean fresh(long now){return updatedAt>0&&updatedAt<=checkedAt+60_000&&checkedAt<=now+60_000&&now-updatedAt<=20*60_000L;}

 static DefesaCivilSp read() throws IOException,JSONException {
  HttpURLConnection connection=(HttpURLConnection)new URL(SNAPSHOT+"?minute="+System.currentTimeMillis()/60_000).openConnection();
  connection.setConnectTimeout(4500);
  connection.setReadTimeout(4500);
  connection.setInstanceFollowRedirects(false);
  try{
   if(connection.getResponseCode()!=200)throw new IOException("Consulta IDAP indisponível");
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream input=connection.getInputStream()){
    byte[] buffer=new byte[4096];
    for(int length;(length=input.read(buffer))!=-1;){
     if(bytes.size()+length>64_000)throw new IOException("Resposta IDAP acima do limite");
     bytes.write(buffer,0,length);
    }
   }
   return parse(new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)),System.currentTimeMillis());
  }finally{connection.disconnect();}
 }

 static DefesaCivilSp parse(JSONObject data,long now) throws JSONException {
  if(data.getInt("version")!=1||!SOURCE.equals(data.getString("source"))||!"3550308".equals(data.getString("municipality")))
   throw new JSONException("Formato IDAP inesperado");
  long checkedAt=data.getLong("checkedAt");
  JSONArray list=data.getJSONArray("alerts");
  if(list.length()>20)throw new JSONException("Quantidade de avisos fora do limite");
  List<Notice> notices=new ArrayList<>();
  for(int i=0;i<list.length();i++){
   JSONObject item=list.getJSONObject(i);
   long sent=item.getLong("sent"),expires=item.getLong("expires");
   String id=item.getString("id"),message=item.getString("message"),issuer=item.getString("issuer"),severity=item.getString("severity");
   if(sent<=0||sent>now||expires<=now||id.isEmpty()||id.length()>80||message.isEmpty()||message.length()>500||
      !("Severe".equals(severity)||"Extreme".equals(severity))||
      !("Defesa Civil Estadual de São Paulo".equalsIgnoreCase(issuer)||"Defesa Civil de São Paulo (SP)".equalsIgnoreCase(issuer)))continue;
   notices.add(new Notice(id,issuer,message,severity,sent,expires));
  }
  DefesaCivilSp result=new DefesaCivilSp(notices,checkedAt,data.getLong("updatedAt"));
  if(!result.fresh(now))throw new JSONException("Consulta IDAP defasada");
  return result;
 }
}

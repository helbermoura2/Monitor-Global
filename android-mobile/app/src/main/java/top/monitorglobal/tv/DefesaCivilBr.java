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

/** Read-only national public CAP catalogue, distinct from Cell Broadcast and SP TV alerts. */
final class DefesaCivilBr {
 static final String SOURCE="https://idapfile.mdr.gov.br/idap/api/rss/cap";
 static final String SNAPSHOT="https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/data/defesa-civil-br.json";
 static final class Notice {
  final String id,issuer,message,area,severity;
  final long sent,expires;
  Notice(String id,String issuer,String message,String area,String severity,long sent,long expires){
   this.id=id;this.issuer=issuer;this.message=message;this.area=area;this.severity=severity;
   this.sent=sent;this.expires=expires;
  }
  String level(){return "Extreme".equals(severity)?"EXTREMO":"SEVERO";}
 }
 final List<Notice> alerts;
 final int total;
 final boolean truncated;
 final long checkedAt,updatedAt;
 private DefesaCivilBr(List<Notice> rows,int total,boolean truncated,long checked,long updated){
  alerts=Collections.unmodifiableList(rows);this.total=total;this.truncated=truncated;
  checkedAt=checked;updatedAt=updated;
 }
 boolean fresh(long now){
  return updatedAt>0&&updatedAt<=checkedAt+60000&&checkedAt<=now+60000
   &&now-updatedAt<=20*60000L&&now-checkedAt<=20*60000L;
 }
 static DefesaCivilBr read() throws IOException,JSONException {
  HttpURLConnection conn=(HttpURLConnection)new URL(SNAPSHOT+"?minute="+System.currentTimeMillis()/60000).openConnection();
  conn.setConnectTimeout(4500);conn.setReadTimeout(7000);
  conn.setInstanceFollowRedirects(false);
  try{
   if(conn.getResponseCode()!=200)throw new IOException("CAP nacional indisponível");
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream input=conn.getInputStream()){
    byte[] buf=new byte[8192];
    for(int size;(size=input.read(buf))!=-1;){
     if(bytes.size()+size>2500000)throw new IOException("CAP nacional muito grande");
     bytes.write(buf,0,size);
    }
   }
   return parse(new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)),System.currentTimeMillis());
  }finally{conn.disconnect();}
 }
 static DefesaCivilBr parse(JSONObject root,long now) throws JSONException {
  if(root.getInt("version")!=1||!SOURCE.equals(root.getString("source"))
      ||!"BRASIL".equals(root.getString("scope")))throw new JSONException("Fonte CAP nacional inválida");
  long checked=root.getLong("checkedAt"),updated=root.getLong("updatedAt");
  int total=root.getInt("total");
  JSONArray list=root.getJSONArray("alerts");
  if(total<0||total>100000||list.length()>1500||total<list.length())
   throw new JSONException("Catálogo nacional fora do limite");
  List<Notice> rows=new ArrayList<>();
  for(int i=0;i<list.length();i++){
   JSONObject a=list.getJSONObject(i);
   String id=a.getString("id"),issuer=a.getString("issuer"),message=a.getString("message"),
    area=a.getString("area"),severity=a.getString("severity");
   long sent=a.getLong("sent"),expires=a.getLong("expires");
   if(id.length()>80||id.isEmpty()||issuer.isEmpty()||issuer.length()>120
      ||area.isEmpty()||area.length()>350||message.isEmpty()||message.length()>500
      ||sent<=0||sent>now+60000||expires<=now
      ||!("Severe".equals(severity)||"Extreme".equals(severity)))continue;
   rows.add(new Notice(id,issuer,message,area,severity,sent,expires));
  }
  DefesaCivilBr result=new DefesaCivilBr(rows,total,root.optBoolean("truncated",false),checked,updated);
  if(!result.fresh(now))throw new JSONException("CAP nacional desatualizado");
  return result;
 }
}
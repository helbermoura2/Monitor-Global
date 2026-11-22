package top.monitorglobal.tv;
import org.json.*;
/** Separate bounded protocol: weather notices never masquerade as seismic events. */
final class PhoneNotice {
 final String kind,id,version,title,body;final long issuedAt,expiresAt;
 private PhoneNotice(JSONObject d)throws JSONException{kind=d.getString("kind");id=d.getString("id");version=d.getString("version");title=d.getString("title");body=d.getString("body");issuedAt=d.getLong("issuedAt");expiresAt=d.getLong("expiresAt");}
 static PhoneNotice parse(String raw,long now){
  if(raw==null||raw.length()>3000||raw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>3000)return null;
  try{
   JSONObject d=new JSONObject(raw);if(!"monitor-notice-v1".equals(d.optString("schema")))return null;
   PhoneNotice n=new PhoneNotice(d);
   boolean official="civil".equals(n.kind);
   if(!official&&!n.kind.equals("rain")&&!n.kind.equals("weather")&&!n.kind.equals("daily")||
      n.id.isEmpty()||n.id.length()>160||n.version.isEmpty()||n.version.length()>180||
      n.title.isEmpty()||n.title.length()>160||n.body.isEmpty()||n.body.length()>1200||
      n.issuedAt<=0||n.issuedAt>now+60000||n.expiresAt<=now||n.expiresAt<=n.issuedAt||
      n.expiresAt>n.issuedAt+(official?4*3600000L:3600000L))return null;
   // Civil notifications must be traceable to a verified active, public CAP notice.
   // A rain forecast or generic Firebase message cannot impersonate the Defesa Civil.
   if(official){
    String issuer=d.optString("issuer"),severity=d.optString("severity");
    if(!"https://idapfile.mdr.gov.br/idap/api/rss/cap".equals(d.optString("source"))||
       !("Defesa Civil Estadual de São Paulo".equalsIgnoreCase(issuer)||
         "Defesa Civil de São Paulo (SP)".equalsIgnoreCase(issuer))||
       !("Severe".equals(severity)||"Extreme".equals(severity))||
       now-n.issuedAt>30*60000L)return null;
   }
   return n;
  }catch(JSONException|RuntimeException ignored){return null;}
 }
}

package top.monitorglobal.tv;

import android.content.Context;
import org.json.JSONException;
import org.json.JSONObject;

/** Separate, bounded last-seen *official* CAP notices, for silent historical replay. */
final class CivilReplayStore {
 static final String SEVERE="Severe",EXTREME="Extreme";
 static final long MAX_REPLAY_AGE_MS=7L*24*60*60*1000;
 private static final String KEY_SEVERE="civilSpReplaySevereV1",KEY_EXTREME="civilSpReplayExtremeV1";
 private CivilReplayStore(){}
 private static String key(String severity){return EXTREME.equals(severity)?KEY_EXTREME:SEVERE.equals(severity)?KEY_SEVERE:null;}
 private static boolean issuerAllowed(String issuer){
  return "Defesa Civil Estadual de São Paulo".equalsIgnoreCase(issuer)
    ||"Defesa Civil de São Paulo (SP)".equalsIgnoreCase(issuer);
 }
 static boolean realOfficial(DefesaCivilSp.Notice n,long now){
  return n!=null&&key(n.severity)!=null&&issuerAllowed(n.issuer)
    &&n.id!=null&&!n.id.isEmpty()&&n.id.length()<=80
    &&n.message!=null&&!n.message.isEmpty()&&n.message.length()<=500
    &&n.sent>0&&n.sent<=now&&now-n.sent<=MAX_REPLAY_AGE_MS
    &&n.expires>now&&n.expires>n.sent;
 }
 static void remember(Context c,DefesaCivilSp.Notice n){
  long now=System.currentTimeMillis();
  if(!realOfficial(n,now))return;
  try{
   JSONObject data=new JSONObject();
   data.put("id",n.id);data.put("issuer",n.issuer);data.put("message",n.message);
   data.put("severity",n.severity);data.put("sent",n.sent);data.put("expires",n.expires);
   Prefs.get(c).edit().putString(key(n.severity),data.toString()).apply();
  }catch(JSONException ignored){}
 }
 static DefesaCivilSp.Notice last(Context c,String severity){
  String preference=key(severity);if(preference==null)return null;
  String raw=Prefs.get(c).getString(preference,"");
  if(raw.isEmpty()||raw.length()>1200)return null;
  try{
   JSONObject data=new JSONObject(raw);
   DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(data.getString("id"),data.getString("issuer"),
    data.getString("message"),data.getString("severity"),data.getLong("sent"),data.getLong("expires"));
   long now=System.currentTimeMillis();
   // No need for a current validUntil for historical replay. Never reactivate an
   // expired notice, and do not replay records older than seven days.
   if(!severity.equals(n.severity)||!issuerAllowed(n.issuer)||n.id.isEmpty()||n.id.length()>80||
      n.message.isEmpty()||n.message.length()>500||n.sent<=0||n.sent>now||
      now-n.sent>MAX_REPLAY_AGE_MS||n.expires<=n.sent)return null;
   return n;
  }catch(JSONException e){return null;}
 }
}

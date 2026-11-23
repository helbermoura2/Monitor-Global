package top.monitorglobal.tv;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import org.json.JSONException;

/**
 * Last genuine, phone-observed Cell Broadcast per severity, held only on this TV.
 * Never shares or masquerades as the separate CAP-verified CivilReplayStore.
 * Simulations are never recorded. Seven-day bound matches official history.
 */
final class CivilPhoneHistory {
 static final long MAX_AGE=7L*24*60*60*1000;
 private static final String SEVERE="civilPhoneSevereHistoryV1";
 private static final String EXTREME="civilPhoneExtremeHistoryV1";
 private CivilPhoneHistory(){}

 private static String key(String severity){
  return "Extreme".equals(severity)?EXTREME:"Severe".equals(severity)?SEVERE:null;
 }
 static boolean eligible(TvCivilPhoneRelay.Event e,long now){
  return e!=null&&!e.test&&e.notice!=null&&key(e.notice.severity)!=null
   &&e.id!=null&&e.id.matches("[0-9a-f-]{36}")&&e.notice.message!=null
   &&e.notice.message.length()>=28&&e.notice.message.length()<=500
   &&e.receivedAt>0&&e.receivedAt<=now+15_000L
   &&now-e.receivedAt<=5*60_000L&&e.expiresAt>e.receivedAt;
 }
 static void remember(Context context,TvCivilPhoneRelay.Event e){
  long now=System.currentTimeMillis();
  if(!eligible(e,now))return;
  String slot=key(e.notice.severity);
  DefesaCivilSp.Notice prior=last(context,e.notice.severity);
  if(prior!=null&&prior.sent>=e.receivedAt)return; // Replay does not overwrite a newer notice.
  try{
   JSONObject j=new JSONObject();
   j.put("id",e.id);j.put("message",e.notice.message);
   j.put("severity",e.notice.severity);j.put("at",e.receivedAt);
   j.put("expiresAt",e.expiresAt);
   SharedPreferences.Editor edit=Prefs.get(context).edit().putString(slot,j.toString());
   edit.putLong("civilPhoneLastReceivedAt",e.receivedAt);
   edit.putString("civilPhoneLastReceivedSeverity",e.notice.severity);
   edit.apply();
  }catch(JSONException ignored){}
 }
 static DefesaCivilSp.Notice last(Context context,String severity){
  String slot=key(severity);if(slot==null)return null;
  String raw=Prefs.get(context).getString(slot,"");
  if(raw.isEmpty()||raw.length()>1300)return null;
  try{
   JSONObject j=new JSONObject(raw);
   String id=j.getString("id"),level=j.getString("severity"),message=j.getString("message");
   long at=j.getLong("at"),expires=j.getLong("expiresAt"),now=System.currentTimeMillis();
   if(!level.equals(severity)||!id.matches("[0-9a-f-]{36}")||
      message.length()<28||message.length()>500||
      at<=0||at>now+15_000L||now-at>MAX_AGE||expires<=at)return null;
   // Preserve original time; expiration is historical, not a current alarm.
   return new DefesaCivilSp.Notice(id,"Capturado no celular · NÃO VERIFICADO VIA CAP",
     message,level,at,expires);
  }catch(JSONException e){return null;}
 }
}

package top.monitorglobal.tv;
import java.util.*;import org.json.*;
/** One bounded saved summary, preserving its original day, consultation time and order. */
final class SummaryRecord {
 static boolean completedFor(FeedClient.Snapshot snapshot,long now){return snapshot!=null&&snapshot.complete&&snapshot.quakeOk&&DailySummarySchedule.completedDay(now).equals(snapshot.day);}
 static String encode(List<Alert> alerts,String day,long asOf) throws JSONException {
  return encode(alerts,day,asOf,false);
 }
 static String encode(List<Alert> alerts,String day,long asOf,boolean complete) throws JSONException {
  if(alerts.isEmpty()||alerts.size()>5)throw new JSONException("Invalid summary count");
  JSONObject root=new JSONObject();root.put("day",day);root.put("asOf",asOf);root.put("complete",complete);JSONArray items=new JSONArray();
  for(Alert a:alerts)items.put(AlertCodec.write(a.copy()));root.put("alerts",items);
  String record=root.toString();decode(record);return record;
 }
 static FeedClient.Snapshot decode(String record) throws JSONException {
  if(record.length()>64000)throw new JSONException("Summary too large");JSONObject root=new JSONObject(record);
  FeedClient.Snapshot out=new FeedClient.Snapshot();out.day=root.getString("day");out.asOf=root.getLong("asOf");out.complete=root.optBoolean("complete",false);
  if(!out.day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")||out.asOf<=0)throw new JSONException("Invalid summary metadata");
  JSONArray items=root.getJSONArray("alerts");if(items.length()<1||items.length()>5)throw new JSONException("Invalid summary count");
  for(int i=0;i<items.length();i++){Alert a=AlertCodec.read(items.getJSONObject(i));if(!a.kind.equals("earthquake")||!Double.isFinite(a.magnitude)||(a.magnitude<.1&&!a.countryCode.equals("br"))||a.magnitude>10)throw new JSONException("Invalid summary quake");out.alerts.add(a.copy());}
  out.quakeOk=true;return out;
 }
}

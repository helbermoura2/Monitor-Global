package top.monitorglobal.tv;
import org.json.*;
/** Single bounded record, at most one companion. No recursive history. */
final class AlertCodec {
 static Alert read(JSONObject o) throws JSONException {return read(o,true);}
 private static Alert read(JSONObject o,boolean paired) throws JSONException {
  Alert a=new Alert(s(o,"id"),s(o,"kind"),s(o,"version"),s(o,"title"),s(o,"detail"),s(o,"state"),o.getLong("issuedAt"),o.getLong("eventTime"),o.optBoolean("eligible"));
  if(a.id.isEmpty()||!a.kind.equals("earthquake")&&!a.kind.equals("tsunami"))throw new JSONException("Invalid alert");
  a.source=s(o,"source");a.countryCode=s(o,"countryCode");a.tsunamiSummary=s(o,"tsunamiSummary");a.relatedQuakeId=s(o,"relatedQuakeId");a.revision=s(o,"revision");a.magnitude=o.optDouble("magnitude",Double.NaN);a.depth=o.optDouble("depth",Double.NaN);a.previousMagnitude=o.optDouble("previousMagnitude",Double.NaN);
  JSONObject other=o.optJSONObject("companion");if(paired&&other!=null){Alert b=read(other,false);if(AlertPairing.isPair(a,b))a.companion=b;}
  return a;
 }
 private static String s(JSONObject o,String key){String value=o.optString(key,"");return value.substring(0,Math.min(value.length(),1400));}
 static JSONObject write(Alert a) throws JSONException {return write(a,true);}
 private static JSONObject write(Alert a,boolean paired) throws JSONException {
  JSONObject o=new JSONObject();o.put("id",a.id);o.put("kind",a.kind);o.put("version",a.version);o.put("title",a.title);o.put("detail",a.detail);o.put("state",a.state);o.put("issuedAt",a.issuedAt);o.put("eventTime",a.eventTime);o.put("eligible",a.eligible);o.put("source",a.source);o.put("countryCode",a.countryCode);o.put("tsunamiSummary",a.tsunamiSummary);o.put("relatedQuakeId",a.relatedQuakeId);o.put("revision",a.revision);
  if(Double.isFinite(a.magnitude))o.put("magnitude",a.magnitude);if(Double.isFinite(a.depth))o.put("depth",a.depth);if(Double.isFinite(a.previousMagnitude))o.put("previousMagnitude",a.previousMagnitude);
  if(paired&&a.companion!=null&&AlertPairing.isPair(a,a.companion))o.put("companion",write(a.companion,false));return o;
 }
}

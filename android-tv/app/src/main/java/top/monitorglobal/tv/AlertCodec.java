package top.monitorglobal.tv;
import org.json.*;
/** Single bounded record, at most one companion. No recursive history. */
final class AlertCodec {
 static Alert read(JSONObject o) throws JSONException {return read(o,true);}
 private static Alert read(JSONObject o,boolean paired) throws JSONException {
  Alert a=new Alert(s(o,"id"),s(o,"kind"),semanticVersion(o),s(o,"title"),s(o,"detail"),s(o,"state"),o.getLong("issuedAt"),o.getLong("eventTime"),o.optBoolean("eligible"));
  if(a.id.isEmpty()||!a.kind.equals("earthquake")&&!a.kind.equals("tsunami"))throw new JSONException("Invalid alert");
  a.populationSummary=s(o,"populationSummary");a.nearbySummary=s(o,"nearbySummary");
  a.legacyVersion=o.has("legacyVersion")?s(o,"legacyVersion"):s(o,"version");a.bulletinProduct=s(o,"bulletinProduct");a.officialEventId=s(o,"officialEventId");a.originTime=o.optLong("originTime",0);a.originLongitude=o.optDouble("originLongitude",Double.NaN);a.originLatitude=o.optDouble("originLatitude",Double.NaN);a.provider=s(o,"provider");a.catalog=s(o,"catalog");JSONArray aliases=o.optJSONArray("aliases");if(aliases!=null)for(int i=0;i<Math.min(12,aliases.length());i++)a.aliases.add(aliases.optString(i,"").substring(0,Math.min(200,aliases.optString(i,"").length())));
  a.source=s(o,"source");a.countryCode=s(o,"countryCode");a.tsunamiSummary=s(o,"tsunamiSummary");a.relatedQuakeId=s(o,"relatedQuakeId");a.revision=s(o,"revision");a.magnitude=o.optDouble("magnitude",Double.NaN);a.depth=o.optDouble("depth",Double.NaN);a.previousMagnitude=o.optDouble("previousMagnitude",Double.NaN);
  JSONObject other=o.optJSONObject("companion");if(paired&&other!=null){Alert b=read(other,false);if(AlertPairing.isPair(a,b))a.companion=b;}
  return a;
 }
 private static String semanticVersion(JSONObject o){
  String value=o.optString("semanticVersion","");if(!o.optString("kind").equals("tsunami")||value.isEmpty())return s(o,"version");
  try{byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder out=new StringBuilder("ts:");for(byte b:hash)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException("SHA-256 unavailable",e);}
 }
 private static String s(JSONObject o,String key){String value=o.optString(key,"");return value.substring(0,Math.min(value.length(),1400));}
 static JSONObject write(Alert a) throws JSONException {return write(a,true);}
 private static JSONObject write(Alert a,boolean paired) throws JSONException {
  JSONObject o=new JSONObject();o.put("id",a.id);o.put("kind",a.kind);o.put("version",a.version);o.put("title",a.title);o.put("detail",a.detail);o.put("state",a.state);o.put("issuedAt",a.issuedAt);o.put("eventTime",a.eventTime);o.put("eligible",a.eligible);o.put("legacyVersion",a.legacyVersion);o.put("bulletinProduct",a.bulletinProduct);o.put("officialEventId",a.officialEventId);o.put("originTime",a.originTime);if(Double.isFinite(a.originLongitude))o.put("originLongitude",a.originLongitude);if(Double.isFinite(a.originLatitude))o.put("originLatitude",a.originLatitude);o.put("provider",a.provider);o.put("catalog",a.catalog);o.put("aliases",new JSONArray(a.aliases));o.put("source",a.source);o.put("countryCode",a.countryCode);o.put("tsunamiSummary",a.tsunamiSummary);o.put("relatedQuakeId",a.relatedQuakeId);o.put("revision",a.revision);
  o.put("populationSummary",a.populationSummary);o.put("nearbySummary",a.nearbySummary);
  if(Double.isFinite(a.magnitude))o.put("magnitude",a.magnitude);if(Double.isFinite(a.depth))o.put("depth",a.depth);if(Double.isFinite(a.previousMagnitude))o.put("previousMagnitude",a.previousMagnitude);
  if(paired&&a.companion!=null&&AlertPairing.isPair(a,a.companion))o.put("companion",write(a.companion,false));return o;
 }
}

package top.monitorglobal.tv;
import org.json.*;
/** A server-grounded AI bulletin can only accompany the matching, still-valid forecast. */
final class WeatherBriefing {
 static final String MODEL="@cf/meta/llama-3.1-8b-instruct-fp8-fast";
 // Backwards compatible while the public Worker and official TV APK deploy independently.
 static final String LEGACY_MODEL="@cf/meta/llama-3.1-8b-instruct-fp8";
 final String kind,text,state;final long dataAt,referenceAt,expiresAt;
 private WeatherBriefing(String k,String t,String s,long data,long ref,long expiry){kind=k;text=t;state=s;dataAt=data;referenceAt=ref;expiresAt=expiry;}
 static WeatherBriefing parse(String raw,long now){try{if(raw==null||raw.length()>6000)return null;JSONObject d=new JSONObject(raw);long generated=d.optLong("generatedAt",0),expiry=d.optLong("expiresAt",0);String kind=d.optString("kind"),text=d.optString("text");if(!"weather-briefing-v1".equals(d.optString("version"))||!"liberdade".equals(d.optString("area"))||!"ready".equals(d.optString("status"))||!(MODEL.equals(d.optString("model"))||LEGACY_MODEL.equals(d.optString("model")))||!(kind.equals("hourly")||kind.equals("rain"))||generated<=0||generated>now+60000||expiry<=now||expiry>generated+3600000||text.isEmpty()||text.length()>600||text.indexOf('<')>=0||text.indexOf('>')>=0)return null;return new WeatherBriefing(kind,text,d.optString("rainState"),d.optLong("dataAt"),d.optLong("referenceAt"),expiry);}catch(JSONException e){return null;}}
 String forForecast(WeatherForecast.Summary w,RainForecast.Summary r,long now){if(now>=expiresAt)return "";if(kind.equals("hourly"))return w!=null&&w.expiresAt>now&&w.generatedAt==dataAt&&w.referenceAt==referenceAt?text:"";return r!=null&&r.expiresAt>now&&r.at==dataAt&&r.state.equals(state)&&!r.state.equals("dry")?text:"";}
}

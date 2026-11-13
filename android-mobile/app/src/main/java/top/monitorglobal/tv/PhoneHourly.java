package top.monitorglobal.tv;
import org.json.*;
import java.util.*;

/** The existing normalized Rainbow route, restricted to the configured Liberdade point. */
final class PhoneHourly {
 static final class Hour {final long start;final double temperature,amount;final String condition;Hour(long at,double t,double mm,String key){start=at;temperature=t;amount=mm;condition=key;}}
 static List<Hour> parse(JSONObject data,long now){
  try{
   if(data==null||!data.optBoolean("ok")||!"Rainbow Weather".equals(data.optString("source")))return Collections.emptyList();
   JSONObject loc=data.getJSONObject("loc");double lat=loc.optDouble("lat",Double.NaN),lng=loc.optDouble("lng",Double.NaN);long at=data.getLong("at"),generated=data.getLong("generatedAt"),expiry=data.getLong("expiresAt");
   if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat-RainForecast.LATITUDE)>.002||Math.abs(lng-RainForecast.LONGITUDE)>.002||at<=0||at>now+60000||now-at>=3600000||generated<=0||generated>now+300000||now-generated>10800000||expiry<=now||expiry>at+3600000)return Collections.emptyList();
   JSONArray rows=data.getJSONArray("hourly");if(rows.length()<7||rows.length()>168)return Collections.emptyList();ArrayList<Hour> out=new ArrayList<>();long previous=0;boolean current=false;
   for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);long start=row.getLong("start");double t=row.getDouble("temperature"),mm=row.getDouble("amount");if(start<=0||previous>0&&start-previous!=3600000||!Double.isFinite(t)||t< -100||t>70||!Double.isFinite(mm)||mm<0||mm>1000)return Collections.emptyList();previous=start;if(start<=now&&start+3600000>now)current=true;if(start+3600000>now&&out.size()<24)out.add(new Hour(start,t,mm,row.optString("condition","")));}
   return current&&previous>=now+6*3600000?Collections.unmodifiableList(out):Collections.emptyList();
  }catch(JSONException|RuntimeException ignored){return Collections.emptyList();}
 }
}

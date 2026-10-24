package top.monitorglobal.tv;
import android.content.*;import org.json.*;import java.util.*;
final class Prefs {
 static android.content.SharedPreferences get(Context c){return c.getSharedPreferences("monitor-tv",Context.MODE_PRIVATE);}
 static AlertTracker tracker(Context c){AlertTracker t=new AlertTracker();t.earthquakeReady=get(c).getBoolean("quakeReady",false);t.tsunamiReady=get(c).getBoolean("tsunamiReady",false);try{JSONArray a=new JSONArray(get(c).getString("seen","[]"));for(int i=0;i<a.length()&&i<256;i++){JSONObject o=a.getJSONObject(i);t.seen.put(o.getString("id"),new AlertTracker.Seen(o.getString("v"),o.getLong("at"),o.optBoolean("tracked")));}}catch(JSONException e){t.seen.clear();t.earthquakeReady=false;t.tsunamiReady=false;}return t;}
 static void save(Context c,AlertTracker t){JSONArray a=new JSONArray();try{for(Map.Entry<String,AlertTracker.Seen> e:t.seen.entrySet()){JSONObject o=new JSONObject();o.put("id",e.getKey());o.put("v",e.getValue().version);o.put("at",e.getValue().at);o.put("tracked",e.getValue().tracked);a.put(o);}}catch(JSONException ignored){}get(c).edit().putString("seen",a.toString()).putBoolean("quakeReady",t.earthquakeReady).putBoolean("tsunamiReady",t.tsunamiReady).commit();}
 static void status(Context c,String s){get(c).edit().putString("status",s).apply();}
}

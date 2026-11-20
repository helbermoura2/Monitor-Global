package top.monitorglobal.tv;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PhoneSkyObservation {
 private static final long MAX_AGE=75*60000L;
 private static final Pattern CLOUD=Pattern.compile("(?:^|\\s)(FEW|SCT|BKN|OVC)\\d{3}(?:CB|TCU)?(?=\\s|$)");
 private static final Pattern CLEAR=Pattern.compile("(?:^|\\s)(?:SKC|CLR)(?=\\s|$)");
 final String label,key;
 final long at;
 private PhoneSkyObservation(String label,String key,long at){this.label=label;this.key=key;this.at=at;}

 static PhoneSkyObservation parse(JSONObject payload,long now){
  JSONArray stations=payload.optJSONArray("stations");
  if(stations==null)return null;
  PhoneSkyObservation latest=null;
  for(int i=0;i<stations.length();i++){
   JSONObject station=stations.optJSONObject(i);
   if(station==null||!"SBSP".equals(station.optString("icao")))continue;
   long at=station.optLong("updatedAt");
   if(at<=0||at>now||now-at>=MAX_AGE||(latest!=null&&latest.at>=at))continue;
   String raw=station.optString("raw").split("\\s+(?:RMK|TEMPO|BECMG|NOSIG)(?=\\s|$)",2)[0];
   Matcher layers=CLOUD.matcher(raw);
   int cover=0;
   while(layers.find()){
    String code=layers.group(1);
    cover=Math.max(cover,code.equals("OVC")?4:code.equals("BKN")?3:code.equals("SCT")?2:1);
   }
   if(cover==4)latest=new PhoneSkyObservation("Encoberto","Cloudy",at);
   else if(cover==3)latest=new PhoneSkyObservation("Nublado","Cloudy",at);
   else if(cover==2)latest=new PhoneSkyObservation("Parcialmente nublado","PartlyCloudy",at);
   else if(cover==1)latest=new PhoneSkyObservation("Poucas nuvens","MostlyClear",at);
   else if((" "+raw+" ").contains(" CAVOK "))latest=new PhoneSkyObservation("Sem nuvens significativas","",at);
   else if(CLEAR.matcher(raw).find())latest=new PhoneSkyObservation("Céu limpo","Clear",at);
  }
  return latest;
 }
 boolean fresh(long now){return at<=now&&now-at<MAX_AGE;}
 String condition(long now){
  if(PhoneDaylight.isDay(now)){
   if(key.equals("Clear"))return "Ensolarado";
   if(key.equals("PartlyCloudy"))return "Sol entre nuvens";
  }
  return label;
 }
}

package top.monitorglobal.tv;
import org.json.*;
/** Hourly modeled conditions; no missing value becomes zero or an invented condition. */
final class WeatherForecast {
 static final long HOUR=3600000;
 static boolean due(long last,long now){return last<=0||last>now+60000||now-last>=HOUR;}
 static final class Summary {
  final String temperature,condition,wind,humidity,timing;final long expiresAt;
  Summary(String t,String c,String w,String h,String time,long expiry){temperature=t;condition=c;wind=w;humidity=h;timing=time;expiresAt=expiry;}
 }
 static String metric(JSONObject p,String key,double min,double max,String unit){double n=p.optDouble(key,Double.NaN);return Double.isFinite(n)&&n>=min&&n<=max?Math.round(n)+unit:"—";}
 static String condition(String key){switch(key){case "Clear":return "Céu limpo";case "MostlyClear":return "Predomínio de céu limpo";case "PartlyCloudy":return "Parcialmente nublado";case "MostlyCloudy":case "Cloudy":return "Nublado";case "Foggy":return "Nevoeiro";case "Haze":return "Névoa";case "Drizzle":return "Garoa";case "Rain":return "Chuva";case "HeavyRain":return "Chuva forte";case "Thunderstorms":case "StrongStorms":case "ScatteredThunderstorms":case "IsolatedThunderstorms":return "Trovoadas";case "Snow":return "Neve";case "HeavySnow":return "Neve forte";default:return "Condição não informada pela fonte";}}
 static String time(long at){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static Summary summarize(JSONObject d,long now)throws JSONException{
  if(!d.optBoolean("ok")||!d.optString("version").equals("tv-weather-v1")||!d.optString("area").equals("liberdade"))return null;
  JSONObject loc=d.optJSONObject("loc"),p=d.optJSONObject("current");long generated=d.optLong("generatedAt",0),at=d.optLong("at",0),expires=d.optLong("expiresAt",0),start=p==null?0:p.optLong("start",0);
  if(loc==null||p==null||!Double.isFinite(loc.optDouble("lat",Double.NaN))||!Double.isFinite(loc.optDouble("lng",Double.NaN))||Math.abs(loc.optDouble("lat")-RainForecast.LATITUDE)>.002||Math.abs(loc.optDouble("lng")-RainForecast.LONGITUDE)>.002||at<=0||at>now+60000||now-at>HOUR||generated<=0||generated>now+60000||now-generated>90*60000L||expires<=now||expires>at+HOUR||start>now||start+HOUR<=now)return null;
  double temp=p.optDouble("temperature",Double.NaN);if(!Double.isFinite(temp)||temp< -100||temp>70)return null;
  return new Summary(metric(p,"temperature",-100,70,"°C")+" · sensação "+metric(p,"feels",-120,100,"°C"),condition(p.optString("condition","")),"Vento "+metric(p,"wind",0,540," km/h")+" · rajadas "+metric(p,"gust",0,540," km/h"),"Umidade "+metric(p,"humidity",0,100,"%"),"Modelo horário · ref. "+time(start)+" · gerado "+time(generated),Math.min(expires,start+HOUR));
 }
}

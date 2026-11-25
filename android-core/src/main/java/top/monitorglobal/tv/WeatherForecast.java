package top.monitorglobal.tv;
import org.json.*;
/** Hourly modeled conditions; no missing value becomes zero or an invented condition. */
final class WeatherForecast {
 static final long HOUR=3600000;
 static final java.time.ZoneId ZONE=java.time.ZoneId.of("America/Sao_Paulo");
 // Each civil hour is one slot; midnight is reserved for the daily summary.
 static long slot(long now){
  java.time.ZonedDateTime hour=java.time.Instant.ofEpochMilli(now).atZone(ZONE).truncatedTo(java.time.temporal.ChronoUnit.HOURS);
  return hour.withMinute(hour.getHour()==0?5:0).toInstant().toEpochMilli();
 }
 static boolean due(long last,long now){long scheduled=slot(now);return now>=scheduled&&(last<scheduled||last>now+60000);}
 static long delay(long now){
  java.time.ZonedDateTime next=java.time.Instant.ofEpochMilli(now).atZone(ZONE).truncatedTo(java.time.temporal.ChronoUnit.HOURS);
  if(slot(now)>now)return slot(now)-now;
  next=next.plusHours(1);
  return Math.max(1,next.withMinute(next.getHour()==0?5:0).toInstant().toEpochMilli()-now);
 }
 static final class Summary {
  final String temperature,condition,wind,humidity,timing;final long expiresAt;final boolean stormForecast;
  String windDirection="N/D";
  final String temperatureValue,feelsValue,humidityValue,windValue,gustValue,conditionKey;final long generatedAt,referenceAt;
  Summary(String t,String c,String w,String h,String time,long expiry){this(t,c,w,h,time,expiry,false);}
  Summary(String t,String c,String w,String h,String time,long expiry,boolean storm){this(t,c,w,h,time,expiry,storm,"—","—","—","—","—","");}
  Summary(String t,String c,String w,String h,String time,long expiry,boolean storm,String temp,String feels,String humid,String air,String gust,String key){this(t,c,w,h,time,expiry,storm,temp,feels,humid,air,gust,key,0,0);}
  Summary(String t,String c,String w,String h,String time,long expiry,boolean storm,String temp,String feels,String humid,String air,String gust,String key,long generated,long reference){generatedAt=generated;referenceAt=reference;temperature=t;condition=c;wind=w;humidity=h;timing=time;expiresAt=expiry;stormForecast=storm;temperatureValue=temp;feelsValue=feels;humidityValue=humid;windValue=air;gustValue=gust;conditionKey=key;}
 }
 static boolean storm(String key){return key.equals("Thunderstorms")||key.equals("StrongStorms")||key.equals("ScatteredThunderstorms")||key.equals("IsolatedThunderstorms");}
 static String metric(JSONObject p,String key,double min,double max,String unit){double n=p.optDouble(key,Double.NaN);return Double.isFinite(n)&&n>=min&&n<=max?Math.round(n)+unit:"—";}
 static String condition(String key){switch(key){case "Clear":return "Céu limpo";case "MostlyClear":return "Predomínio de céu limpo";case "PartlyCloudy":return "Parcialmente nublado";case "MostlyCloudy":case "Cloudy":return "Nublado";case "Foggy":return "Nevoeiro";case "Haze":return "Névoa";case "Drizzle":return "Garoa";case "Rain":return "Chuva";case "HeavyRain":return "Chuva forte";case "Thunderstorms":case "StrongStorms":case "ScatteredThunderstorms":case "IsolatedThunderstorms":return "Trovoadas";case "Snow":return "Neve";case "HeavySnow":return "Neve forte";default:return "Condição indisponível";}}
 /** Description from the hourly forecast; minute rain does not define cloud cover. */
 static String sky(Summary weather,long at){
  if(weather==null)return "Condição horária indisponível";
  boolean day=isDay(at);
  switch(weather.conditionKey){
   case "Clear":return day?"Ensolarado":"Céu limpo";
   case "MostlyClear":return day?"Predomínio de sol":"Céu quase limpo";
   case "PartlyCloudy":return day?"Sol entre nuvens":"Parcialmente nublado";
   case "MostlyCloudy":return "Muitas nuvens";
   case "Cloudy":return "Nublado";
   default:return weather.condition;
  }
 }
 /** Solar horizon for Liberdade, São Paulo, independent of device timezone. */
 static boolean isDay(long epochMillis){
  double d=epochMillis/86400000.0+2440587.5-2451545.0;
  double meanLongitude=280.460+0.9856474*d;
  double anomaly=Math.toRadians(357.528+0.9856003*d);
  double eclipticLongitude=Math.toRadians(meanLongitude+1.915*Math.sin(anomaly)+0.020*Math.sin(2*anomaly));
  double obliquity=Math.toRadians(23.439-0.0000004*d);
  double rightAscension=Math.toDegrees(Math.atan2(Math.cos(obliquity)*Math.sin(eclipticLongitude),Math.cos(eclipticLongitude)));
  double declination=Math.asin(Math.sin(obliquity)*Math.sin(eclipticLongitude));
  double siderealLongitude=280.46061837+360.98564736629*d-46.635;
  double hourAngle=Math.toRadians(Math.IEEEremainder(siderealLongitude-rightAscension,360.0));
  double latitude=Math.toRadians(-23.555);
  double sinElevation=Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle);
  return sinElevation>=Math.sin(Math.toRadians(-0.833));
 }
 static String time(long at){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);f.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new java.util.Date(at));}
 static Summary summarize(JSONObject d,long now)throws JSONException{
  if(!d.optBoolean("ok")||!d.optString("version").equals("tv-weather-v1")||!d.optString("area").equals("liberdade"))return null;
  JSONObject loc=d.optJSONObject("loc"),p=d.optJSONObject("current");long generated=d.optLong("generatedAt",0),at=d.optLong("at",0),expires=d.optLong("expiresAt",0),start=p==null?0:p.optLong("start",0);
  if(loc==null||p==null||!Double.isFinite(loc.optDouble("lat",Double.NaN))||!Double.isFinite(loc.optDouble("lng",Double.NaN))||Math.abs(loc.optDouble("lat")-RainForecast.LATITUDE)>.002||Math.abs(loc.optDouble("lng")-RainForecast.LONGITUDE)>.002||at<=0||at>now+60000||now-at>HOUR||generated<=0||generated>now+60000||now-generated>90*60000L||expires<=now||expires>at+HOUR||start>now||start+HOUR<=now)return null;
  double temp=p.optDouble("temperature",Double.NaN);if(!Double.isFinite(temp)||temp< -100||temp>70)return null;
  Summary result=new Summary(metric(p,"temperature",-100,70,"°C")+" · sensação "+metric(p,"feels",-120,100,"°C"),condition(p.optString("condition","")),"Vento "+metric(p,"wind",0,540," km/h")+" · rajadas "+metric(p,"gust",0,540," km/h"),"Umidade "+metric(p,"humidity",0,100,"%"),"Modelo horário · ref. "+time(start)+" · gerado "+time(generated),Math.min(expires,start+HOUR),storm(p.optString("condition","")),metric(p,"temperature",-100,70,"°C"),metric(p,"feels",-120,100,"°C"),metric(p,"humidity",0,100,"%"),metric(p,"wind",0,540," km/h"),metric(p,"gust",0,540," km/h"),p.optString("condition",""),generated,start);
  double direction=p.optDouble("windDirection",Double.NaN);
  if(Double.isFinite(direction)&&direction>=0&&direction<=360)result.windDirection=new String[]{"N","NE","L","SE","S","SO","O","NO"}[(int)Math.floor((direction+22.5)/45)%8];
  return result;
 }
}

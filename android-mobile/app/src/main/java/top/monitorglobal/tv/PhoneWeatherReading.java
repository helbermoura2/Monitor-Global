package top.monitorglobal.tv;
import java.text.Normalizer;
import java.util.Locale;

/** Presentation precedence only: minute rain and hourly sky are never observations. */
final class PhoneWeatherReading {
 static boolean hourlyPrecipitation(WeatherForecast.Summary w){if(w==null)return false;String k=w.conditionKey;return WeatherForecast.storm(k)||k.equals("Drizzle")||k.equals("Rain")||k.equals("HeavyRain")||k.equals("Snow")||k.equals("HeavySnow");}
 private static boolean dryMinuteOverridesHourlyRain(WeatherForecast.Summary w,RainForecast.Summary r){
  return r!=null&&r.state.equals("dry")&&hourlyPrecipitation(w);
 }
 static String skyLabel(WeatherForecast.Summary hourly,long now){
  if(skyArt(hourly).isEmpty())return "Condição do céu indisponível";
  return hourly.conditionKey.equals("MostlyClear")?"Poucas nuvens":WeatherForecast.sky(hourly,now);
 }
 static String skyArt(WeatherForecast.Summary hourly){
  if(hourly==null)return "";
  switch(hourly.conditionKey){
   case "Clear":case "MostlyClear":case "PartlyCloudy":case "Cloudy":case "Overcast":
    return hourly.conditionKey;
   default:return "";
  }
 }
 static String condition(WeatherForecast.Summary w,RainForecast.Summary r){
  if(r!=null&&(r.state.equals("now")||r.state.equals("soon")||r.state.equals("evidence")))return r.title;
  if(dryMinuteOverridesHourlyRain(w,r))return r.title;
  return WeatherForecast.sky(w,System.currentTimeMillis());
 }
 static String illustration(WeatherForecast.Summary w,RainForecast.Summary r){
  if(r!=null&&(r.state.equals("now")||r.state.equals("soon"))){
   if(r.state.equals("soon"))return "RainSoon";
   return r.title.startsWith("Neve")?"Snow":"Rain";
  }
  return w==null||dryMinuteOverridesHourlyRain(w,r)?"":w.conditionKey;
 }
 static String caption(WeatherForecast.Summary w,RainForecast.Summary r){
  if(r!=null&&r.state.equals("evidence"))return r.level.equals("gauge")?"Chuva: medição de estação próxima":"Chuva: consenso horário";
  if(dryMinuteOverridesHourlyRain(w,r))return "Chuva: estimativa por minuto";
  return r!=null&&(r.state.equals("now")||r.state.equals("soon"))?"Chuva: estimativa por minuto":"Condição: modelo horário";
 }
 // An optional cached hourly narrative cannot override the minute-derived rain timeline.
 static String complementaryAi(String value,WeatherForecast.Summary w,RainForecast.Summary r){if(w!=null&&r!=null&&r.state.equals("now")&&(w.conditionKey.equals("Clear")||w.conditionKey.equals("MostlyClear")))return "";return complementaryAi(value);}
 static String complementaryAi(String value){if(value==null)return "";String t=Normalizer.normalize(value,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);for(String term:new String[]{"chuva","garoa","precipit","trovoad","tempestad","neve","pancad","granizo","mm","tempo seco","tempo seca"})if(t.contains(term))return "";return value;}
}

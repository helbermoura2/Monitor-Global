package top.monitorglobal.tv;

import java.util.Locale;

/**
 * The Rainbow Weather condition belongs to a whole hourly MODEL interval, not
 * to an observed sky at the user's TV. A valid minute-by-minute rain forecast
 * takes priority for *rain timing* only; neither source confirms sunshine.
 */
final class WeatherConditionDisplay {
 private WeatherConditionDisplay(){}
 static boolean precipitation(String key){
  if(key==null)return false;
  switch(key){
   case "Drizzle":case "Rain":case "HeavyRain":
   case "Thunderstorms":case "StrongStorms":
   case "ScatteredThunderstorms":case "IsolatedThunderstorms":
   case "Snow":case "HeavySnow":return true;
   default:return false;
  }
 }
 static String headline(WeatherForecast.Summary hourly,RainForecast.Summary minute){
  if(minute!=null){
   if("now".equals(minute.state))return "Chuva estimada agora";
   if("soon".equals(minute.state)){
    if(minute.arrivalMinutes>=0)return "Chuva em ~"+minute.arrivalMinutes+" min";
    return "Chuva prevista";
   }
   if("dry".equals(minute.state)&&hourly!=null&&precipitation(hourly.conditionKey))
    return "Sem chuva estimada";
  }
  if(hourly==null)return minute==null?"Condição indisponível":minute.title;
  if(precipitation(hourly.conditionKey))
   return "Previsão: "+hourly.condition.toLowerCase(Locale.forLanguageTag("pt-BR"));
  return hourly.condition;
 }
 static String detail(WeatherForecast.Summary hourly,RainForecast.Summary minute){
  if(hourly==null)return "Condição observada não disponível";
  if(precipitation(hourly.conditionKey)){
   // Put the true, different source of the "Rain" text on screen rather than
   // silently turning an hourly prediction into an observed rain claim.
   return "Modelo horário: "+hourly.condition+" · sens. "+hourly.feelsValue;
  }
  return "Sensação "+hourly.feelsValue+" · previsão horária";
 }
 static String sourceNote(WeatherForecast.Summary hourly,RainForecast.Summary minute){
  if(hourly==null)return "Sem modelo horário válido";
  String ref=hourly.referenceAt>0?" · ref. "+WeatherForecast.time(hourly.referenceAt):"";
  if(minute!=null&&"dry".equals(minute.state)&&precipitation(hourly.conditionKey))
   return "Previsão horária: "+hourly.condition+"; estimativa por minuto sem chuva no momento"+ref;
  return "Condição do modelo horário: "+hourly.condition+ref;
 }
}

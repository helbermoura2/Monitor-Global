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
 static RainForecast.Summary current(RainForecast.Summary minute){
  long now=System.currentTimeMillis();
  return minute!=null&&minute.at>0&&minute.at<=now+60000&&now-minute.at<=20*60000L&&minute.expiresAt>now?minute:null;
 }
 static double rate(RainForecast.Summary minute){
  if(minute==null||!"now".equals(minute.state))return Double.NaN;
  double rate=Double.isFinite(minute.forecastRate)?minute.forecastRate:minute.rate;
  return Double.isFinite(rate)&&rate>=.1?rate:Double.NaN;
 }
 static String headline(WeatherForecast.Summary hourly,RainForecast.Summary minute){
  minute=current(minute);
  if(minute!=null){
   if("now".equals(minute.state)){double value=rate(minute);return Double.isFinite(value)?"Chuva "+RainForecast.intensity(value):"Chuva prevista";}
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
  minute=current(minute);
  String feels=hourly!=null&&hourly.expiresAt>System.currentTimeMillis()&&!hourly.feelsValue.equals("—")?"Sensação "+hourly.feelsValue:"Sensação —";
  double value=rate(minute);
  return feels+(Double.isFinite(value)?" · "+RainForecast.number(value)+" mm/h":"");
 }
 static String sourceNote(WeatherForecast.Summary hourly,RainForecast.Summary minute){
  minute=current(minute);
  if(hourly==null)return "Sem modelo horário válido";
  String ref=hourly.referenceAt>0?" · ref. "+WeatherForecast.time(hourly.referenceAt):"";
  if(minute!=null&&"dry".equals(minute.state)&&precipitation(hourly.conditionKey))
   return "Previsão horária: "+hourly.condition+"; estimativa por minuto sem chuva no momento"+ref;
  return "Condição do modelo horário: "+hourly.condition+ref;
 }
}

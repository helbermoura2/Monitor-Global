package top.monitorglobal.tv;
import java.text.Normalizer;
import java.util.Locale;

/** Presentation precedence only: minute rain and hourly sky are never observations. */
final class PhoneWeatherReading {
 static boolean hourlyPrecipitation(WeatherForecast.Summary w){if(w==null)return false;String k=w.conditionKey;return WeatherForecast.storm(k)||k.equals("Drizzle")||k.equals("Rain")||k.equals("HeavyRain")||k.equals("Snow")||k.equals("HeavySnow");}
 static String condition(WeatherForecast.Summary w,RainForecast.Summary r){if(r!=null&&(hourlyPrecipitation(w)||!r.state.equals("dry")))return r.title;return w==null?"Condição horária indisponível":w.condition;}
 static String illustration(WeatherForecast.Summary w,RainForecast.Summary r){if(r!=null&&(hourlyPrecipitation(w)||!r.state.equals("dry"))){if(r.state.equals("soon"))return "RainSoon";if(r.state.equals("now"))return r.title.startsWith("Neve")?"Snow":"Rain";return "MinuteDry";}return w==null?"":w.conditionKey;}
 static String caption(WeatherForecast.Summary w,RainForecast.Summary r){return r!=null&&(hourlyPrecipitation(w)||!r.state.equals("dry"))?"Chuva: estimativa por minuto":"Condição: modelo horário";}
 // An optional cached hourly narrative cannot override the minute-derived rain timeline.
 static String complementaryAi(String value,WeatherForecast.Summary w,RainForecast.Summary r){if(w!=null&&r!=null&&r.state.equals("now")&&(w.conditionKey.equals("Clear")||w.conditionKey.equals("MostlyClear")))return "";return complementaryAi(value);}
 static String complementaryAi(String value){if(value==null)return "";String t=Normalizer.normalize(value,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT);for(String term:new String[]{"chuva","garoa","precipit","trovoad","tempestad","neve","pancad","granizo","mm","tempo seco","tempo seca"})if(t.contains(term))return "";return value;}
}

package top.monitorglobal.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class WeatherConditionDisplayTest {
 private static WeatherForecast.Summary hourly(String key,String label){
  return new WeatherForecast.Summary("24°C · sensação 24°C",label,"Vento 9 km/h","Umidade 77%",
   "Previsão horária",1800000600000L,false,"24°C","24°C","77%","9 km/h","17 km/h",key,
   1800000000000L,1799998800000L);
 }
 private static RainForecast.Summary minute(String state,int arrival){
  return new RainForecast.Summary(state,"fraca","Chuva prevista em ~"+arrival+" min",
   0,0,"Término indefinido",1800000000000L,1800000600000L,false,
   arrival,-1,-1,Double.NaN,"Duração indefinida");
 }
 @Test public void photoSituationDoesNotClaimHourlyModelRainIsObservedNow(){
  WeatherForecast.Summary w=hourly("Rain","Chuva");
  assertEquals("Sem chuva estimada",WeatherConditionDisplay.headline(w,minute("dry",-1)));
  assertTrue(WeatherConditionDisplay.detail(w,minute("dry",-1)).contains("Modelo horário: Chuva"));
  assertTrue(WeatherConditionDisplay.sourceNote(w,minute("dry",-1)).contains("estimativa por minuto sem chuva"));
  assertEquals("Previsão: chuva",WeatherConditionDisplay.headline(w,null));
 }
 @Test public void minuteForecastCanIndicateRainTimingWithoutReplacingSkyObservations(){
  WeatherForecast.Summary cloudy=hourly("PartlyCloudy","Parcialmente nublado");
  assertEquals("Parcialmente nublado",WeatherConditionDisplay.headline(cloudy,minute("dry",-1)));
  assertEquals("Chuva em ~12 min",WeatherConditionDisplay.headline(cloudy,minute("soon",12)));
  assertEquals("Chuva estimada agora",WeatherConditionDisplay.headline(cloudy,minute("now",0)));
  assertEquals("Parcialmente nublado",WeatherConditionDisplay.headline(cloudy,null));
 }
 @Test public void missingForecastDoesNotInventSunshineOrDryConditions(){
  assertEquals("Condição indisponível",WeatherConditionDisplay.headline(null,null));
  assertEquals("Condição observada não disponível",WeatherConditionDisplay.detail(null,null));
  assertEquals("Previsão: trovoadas",WeatherConditionDisplay.headline(hourly("Thunderstorms","Trovoadas"),null));
  assertEquals("Previsão: garoa",WeatherConditionDisplay.headline(hourly("Drizzle","Garoa"),null));
  assertFalse(WeatherConditionDisplay.precipitation("PartlyCloudy"));
 }
}

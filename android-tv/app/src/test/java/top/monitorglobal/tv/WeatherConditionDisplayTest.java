package top.monitorglobal.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class WeatherConditionDisplayTest {
 private static final long NOW=System.currentTimeMillis();
 private static WeatherForecast.Summary hourly(String key,String label){
  return new WeatherForecast.Summary("24°C · sensação 24°C",label,"Vento 9 km/h","Umidade 77%",
   "Previsão horária",NOW+600000,false,"24°C","24°C","77%","9 km/h","17 km/h",key,
   NOW,NOW-1200000);
 }
 private static RainForecast.Summary minute(String state,int arrival){
  return new RainForecast.Summary(state,"fraca","Chuva prevista em ~"+arrival+" min",
   0,0,"Término indefinido",NOW,NOW+600000,false,
   arrival,-1,-1,Double.NaN,"Duração indefinida");
 }
 @Test public void photoSituationDoesNotClaimHourlyModelRainIsObservedNow(){
  WeatherForecast.Summary w=hourly("Rain","Chuva");
  assertEquals("Sem chuva estimada",WeatherConditionDisplay.headline(w,minute("dry",-1)));
  assertEquals("Sensação 24°C",WeatherConditionDisplay.detail(w,minute("dry",-1)));
  assertTrue(WeatherConditionDisplay.sourceNote(w,minute("dry",-1)).contains("estimativa por minuto sem chuva"));
  assertEquals("Previsão: chuva",WeatherConditionDisplay.headline(w,null));
 }
 @Test public void minuteForecastCanIndicateRainTimingWithoutReplacingSkyObservations(){
  WeatherForecast.Summary cloudy=hourly("PartlyCloudy","Parcialmente nublado");
  assertEquals("Parcialmente nublado",WeatherConditionDisplay.headline(cloudy,minute("dry",-1)));
  assertEquals("Chuva em ~12 min",WeatherConditionDisplay.headline(cloudy,minute("soon",12)));
  assertEquals("Chuva prevista",WeatherConditionDisplay.headline(cloudy,minute("now",0)));
  assertEquals("Parcialmente nublado",WeatherConditionDisplay.headline(cloudy,null));
 }
 @Test public void currentRainHasIntensityAndRateWithoutTechnicalLine(){
  RainForecast.Summary rain=new RainForecast.Summary("now","fraca","Chuva fraca estimada agora",1.2,1.2,"",NOW,NOW+600000,true,0,30,30,1.2,"Duração restante estimada: ~30 min");
  assertEquals("Chuva fraca",WeatherConditionDisplay.headline(hourly("Rain","Chuva"),rain));
  assertEquals("Sensação 24°C · 1,2 mm/h",WeatherConditionDisplay.detail(hourly("Rain","Chuva"),rain));
  assertFalse(WeatherConditionDisplay.detail(hourly("Rain","Chuva"),rain).contains("Modelo"));
 }
 @Test public void expiredRainDoesNotSupplyIntensity(){
  RainForecast.Summary expired=new RainForecast.Summary("now","forte","Chuva forte",12,2,"",NOW-700000,NOW-1,true);
  assertEquals("Previsão: chuva",WeatherConditionDisplay.headline(hourly("Rain","Chuva"),expired));
  assertEquals("Sensação 24°C",WeatherConditionDisplay.detail(hourly("Rain","Chuva"),expired));
 }
 @Test public void missingForecastDoesNotInventSunshineOrDryConditions(){
  assertEquals("Condição indisponível",WeatherConditionDisplay.headline(null,null));
  assertEquals("Sensação —",WeatherConditionDisplay.detail(null,null));
  assertEquals("Previsão: trovoadas",WeatherConditionDisplay.headline(hourly("Thunderstorms","Trovoadas"),null));
  assertEquals("Previsão: garoa",WeatherConditionDisplay.headline(hourly("Drizzle","Garoa"),null));
  assertFalse(WeatherConditionDisplay.precipitation("PartlyCloudy"));
 }
}

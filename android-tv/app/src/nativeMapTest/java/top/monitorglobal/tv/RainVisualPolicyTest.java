package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;

public class RainVisualPolicyTest {
 @Test public void windUsesOnlyFiniteNonnegativeModeledValuesAndIsCapped(){
  assertEquals(0f,RainVisualPolicy.windSpeedKmh(null),0.001f);
  WeatherForecast.Summary missing=new WeatherForecast.Summary("22°C","Nublado","Vento —","Umidade 70%","Modelo",1000);
  assertEquals(0f,RainVisualPolicy.windSpeedKmh(missing),0.001f);
  WeatherForecast.Summary breeze=new WeatherForecast.Summary("22°C","Nublado","Vento 24 km/h","Umidade 70%","Modelo",1000,false,"22°C","23°C","70%","24 km/h","38 km/h","Cloudy");
  assertEquals(24f,RainVisualPolicy.windSpeedKmh(breeze),0.001f);
  WeatherForecast.Summary extreme=new WeatherForecast.Summary("22°C","Nublado","Vento 540 km/h","Umidade 70%","Modelo",1000,false,"22°C","23°C","70%","540 km/h","540 km/h","Cloudy");
  assertEquals(80f,RainVisualPolicy.windSpeedKmh(extreme),0.001f);
 }
 @Test public void missingAndDryRatesNeverBecomeRainIntensity(){
  assertEquals(0,RainVisualPolicy.level(Double.NaN,false));
  assertEquals(0,RainVisualPolicy.level(0,false));
  assertEquals(0,RainVisualPolicy.level(-1,false));
  assertEquals(3,RainVisualPolicy.level(0.1,true));
 }
}

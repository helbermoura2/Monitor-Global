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
 @Test public void glassDepthSeparatesNearAndFarDroplets(){
  assertTrue(RainVisualPolicy.depthScale(1f)>RainVisualPolicy.depthScale(0f));
  assertEquals(.72f,RainVisualPolicy.depthScale(0f),0.001f);
  assertEquals(1.18f,RainVisualPolicy.depthScale(1f),0.001f);
  assertEquals(.72f,RainVisualPolicy.depthScale(Float.NaN),0.001f);
 }
 @Test public void runoffBuildsGraduallyAndNeverExceedsItsBound(){
  assertEquals(0f,RainVisualPolicy.runoffProgress(.4f),0.001f);
  assertEquals(0f,RainVisualPolicy.runoffProgress(Float.NaN),0.001f);
  assertTrue(RainVisualPolicy.runoffProgress(.8f)>RainVisualPolicy.runoffProgress(.55f));
  assertEquals(18f,RainVisualPolicy.runoffLength(1f,1f),0.001f);
  assertEquals(0f,RainVisualPolicy.runoffLength(1f,0f),0.001f);
 }
 @Test public void missingAndDryRatesNeverBecomeRainIntensity(){
  assertEquals(0,RainVisualPolicy.level(Double.NaN,false));
  assertEquals(0,RainVisualPolicy.level(0,false));
  assertEquals(0,RainVisualPolicy.level(-1,false));
  assertEquals(3,RainVisualPolicy.level(0.1,true));
 }
}

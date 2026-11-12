package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
public class RainBannerContentTest {
 RainForecast.Summary sample(String state,int arrival,int end,int duration,double amount,double rate,String label){return new RainForecast.Summary(state,"moderada","Chuva prevista em ~10 min",0,amount,"",1,999999,true,arrival,end,duration,rate,label);}
 @Test public void incomingRainHasArrivalAmountRateDurationAndEnd(){
  RainBannerContent c=new RainBannerContent(sample("soon",10,45,35,3.2,4.5,"Duração estimada: ~35 min"));
  assertEquals("EM APROX. 10 MIN",c.headline);assertEquals("3,2 mm",c.amount);assertEquals("4,5 mm/h",c.rate);assertEquals("~35 min",c.duration);assertEquals("Término em ~45 min",c.end);
  assertFalse(c.accessible.contains("temperatura"));assertTrue(c.accessible.contains("próximos 60 min"));
 }
 @Test public void unknownValuesNeverBecomeZeros(){
  RainBannerContent c=new RainBannerContent(sample("now",0,-1,-1,Double.NaN,Double.NaN,"Duração ainda indefinida"));
  assertEquals("INDISPONÍVEL",c.amount);assertEquals("INDISPONÍVEL",c.rate);assertEquals("INDEFINIDA",c.duration);assertEquals("Término ainda indefinido",c.end);assertFalse(c.accessible.contains("NaN"));
 }
 @Test public void intermittentForecastRetainsWindowMeaning(){
  RainBannerContent c=new RainBannerContent(sample("now",0,40,40,2,3,"Janela restante estimada: ~40 min"));assertTrue(c.durationLabel.contains("JANELA"));assertTrue(c.accessible.contains("Janela restante"));
 }
 @Test public void rainAiDoesNotReadTheDisplayedNumbersAgain(){
  assertEquals("A chuva pode se intensificar.",WeatherTicker.composeRain("São 3 mm previstos. A chuva deve durar 35 min. A chuva pode se intensificar."));
 }
}

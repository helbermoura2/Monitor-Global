package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;
public class WeatherTickerTest {
 @Test public void omitsRepeatedMetricsKeepsTrendAndRemovesDuplicateSentences(){
  String text=WeatherTicker.compose("A temperatura é de 22°C. O vento previsto é de 12 km/h. A chuva pode chegar nos próximos minutos.","A chuva pode chegar nos próximos minutos.");
  assertEquals("A chuva pode chegar nos próximos minutos.",text);
 }
 @Test public void retainsRelevantWindChangeAndDoesNotInventAnalysis(){
  assertEquals("O vento pode aumentar na próxima hora.",WeatherTicker.compose("O vento pode aumentar na próxima hora.",""));
  assertTrue(WeatherTicker.compose("A umidade é de 81%.","").startsWith("Sem análise complementar"));
 }
 @Test public void respectsReadingBudgetWithoutCuttingSentences(){
  StringBuilder longText=new StringBuilder();for(int i=0;i<100;i++)longText.append("Informação complementar muito extensa ");
  assertTrue(WeatherTicker.compose(longText.toString(),"").length()<=WeatherTicker.MAX_CHARS);
 }
 @Test public void sourceContextShowsAgeAndDoesNotInventConfidenceScore(){
  long now=1800000000000L;
  WeatherForecast.Summary weather=new WeatherForecast.Summary("22°C","Nublado","","","",now+3600000,false,
    "22°C","23°C","81%","12 km/h","19 km/h","Cloudy",now-5*60000,now-5*60000);
  RainForecast.Summary rain=new RainForecast.Summary("evidence","consensus","Consenso de modelos",Double.NaN,Double.NaN,
    "3/3 modelos concordam · não é probabilidade calibrada",now-2*60000,now+8*60000,false);
  String context=WeatherTicker.sourceContext(weather,rain,now);
  assertTrue(context.contains("atualizado há 5 min"));
  assertTrue(context.contains("DADO RECENTE"));
  assertTrue(context.contains("CONSENSO DE MODELOS"));
  assertTrue(context.contains("não é probabilidade calibrada"));
  assertTrue(context.contains("sem nota artificial"));
 }
 @Test public void reportsOnlyObservedChangeBetweenHourlyModelSnapshots(){
  long now=1800000000000L;
  WeatherForecast.Summary before=new WeatherForecast.Summary("22°C","Nublado","","","",now+3600000,false,
    "22°C","23°C","81%","12 km/h","19 km/h","Cloudy",now-3600000,now-3600000);
  WeatherForecast.Summary after=new WeatherForecast.Summary("24°C","Nublado","","","",now+7200000,false,
    "24°C","25°C","80%","10 km/h","16 km/h","Cloudy",now,now);
  assertEquals("Temperatura subiu 2,0°C desde a última atualização horária",WeatherTicker.trend(before,after));
  assertEquals("",WeatherTicker.trend(after,before));
 }
}

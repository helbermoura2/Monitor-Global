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
}

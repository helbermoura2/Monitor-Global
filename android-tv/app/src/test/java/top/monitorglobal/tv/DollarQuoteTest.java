package top.monitorglobal.tv;
import org.junit.Test;
import java.time.*;
import static org.junit.Assert.*;

public class DollarQuoteTest {
 private static final long MON_1115=Instant.parse("2026-11-16T14:15:00Z").toEpochMilli();
 private static String fixture(String date,String source,String row){
  return "<html><head><title>Dólar Comercial Futuro</title></head><body>"+
   "<h1>Dólar Comercial Futuro</h1><section><h2>Fechamento: "+date+"</h2>"+
   "<p>Fonte: "+source+"</p><table><tr><th>Contrato</th><th>Fechamento (R$/US$)</th>"+
   "<th>Variação (%)</th></tr><tr><td>"+row+"</td></tr></table></section></body></html>";
 }
 @Test public void onlyB3AttributedDOLFuturesClosesNeverSpotFX(){
  DollarQuote quote=DollarQuote.fromB3CloseHtml(fixture("13/11/2026","B3",
   "Dezembro/26</td><td>5.684,00</td><td>+0,26"),MON_1115);
  assertNotNull(quote);assertTrue(quote.b3Close);
  assertEquals(5.684,quote.price,.00001);
  assertEquals(.26,quote.percent,.001);
  assertEquals("Dezembro/26",quote.contract);
  assertTrue(quote.source.contains("B3"));
  assertEquals(MarketState.OPEN,quote.session.value);
  assertEquals(Instant.parse("2026-11-13T21:30:00Z").toEpochMilli(),quote.at);
 }
 @Test public void rejectGlobalFXOtherSourcesFakeWeekendAndStaleClose(){
  String row="Dezembro/26</td><td>5.684,00</td><td>+0,26";
  assertNull(DollarQuote.fromB3CloseHtml(fixture("13/11/2026","Yahoo Finance",row),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml(fixture("15/11/2026","B3",row),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml(fixture("05/11/2026","B3",row),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml(fixture("13/11/2026","B3","Dezembro/26</td><td>5,23</td><td>+0,26"),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml(fixture("13/11/2026","B3","Dezembro/26</td><td>7.000,00</td><td>+45,00"),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml(null,MON_1115));
 }
 @Test public void futureCloseAndUnknownPayloadAreNotMisrepresentedAsLive(){
  assertNull(DollarQuote.fromB3CloseHtml(fixture("16/11/2026","B3",
   "Dezembro/26</td><td>5.684,00</td><td>+0,26"),MON_1115));
  assertNull(DollarQuote.fromB3CloseHtml("BRL=X global spot quote",MON_1115));
 }
}

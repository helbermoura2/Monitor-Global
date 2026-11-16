package top.monitorglobal.tv;

import java.time.Instant;
import org.junit.Test;
import static org.junit.Assert.*;

/** Provider widget must show authentic B3 data directly, not return extracted prices. */
public class MarketDOLWidgetTest {
 @Test public void embedsActualB3DOLContinuousFutureAndPreservesOfficialProvider(){
  String html=MarketDOLWidget.html();
  assertTrue(html.contains("https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js"));
  assertTrue(html.contains("\"symbol\":\"BMFBOVESPA:DOL1!\""));
  assertTrue(html.contains("TradingView"));
  assertTrue(html.contains("~15 min"));
  assertFalse("No Yahoo/BRL spot rates may stand in for B3",html.contains("BRL=X"));
  assertFalse("No iframe extraction",html.contains("contentDocument"));
 }
 @Test public void embedsOnlyDuringRegularB3Session(){
  long monday=Instant.parse("2026-11-16T14:15:00Z").toEpochMilli();
  long sunday=Instant.parse("2026-11-15T23:15:00Z").toEpochMilli();
  long evening=Instant.parse("2026-11-16T22:45:00Z").toEpochMilli();
  assertTrue(MarketDOLWidget.shouldShow(monday,false));
  assertFalse(MarketDOLWidget.shouldShow(monday,true));
  assertFalse(MarketDOLWidget.shouldShow(sunday,false));
  assertFalse(MarketDOLWidget.shouldShow(evening,false));
 }
}
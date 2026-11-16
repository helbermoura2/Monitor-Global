package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import java.time.Instant;import static org.junit.Assert.*;
public class MarketStateTest {
 private long at(String s){return Instant.parse(s).toEpochMilli();}
 @Test public void independentStatesAndDailyPause()throws Exception{
  long now=at("2026-11-11T22:30:00Z");assertEquals(MarketState.PAUSED,MarketState.brentRegular(now).value);
  JSONObject fx=new JSONObject().put("symbol","BRL=X").put("marketState","REGULAR").put("regularMarketTime",now/1000);assertEquals(MarketState.OPEN,MarketState.fromMeta(fx,"BRL=X",now).value);
  assertEquals("FECHADO · PAUSA",MarketState.brentRegular(now).label());
 }
 @Test public void priceAgeDoesNotInventClosedState()throws Exception{
  long now=at("2026-11-11T15:00:00Z");JSONObject fx=new JSONObject().put("symbol","BRL=X").put("regularMarketTime",1);assertEquals(MarketState.UNKNOWN,MarketState.fromMeta(fx,"BRL=X",now).value);
  fx.put("marketState","CLOSED");assertEquals(MarketState.CLOSED,MarketState.fromMeta(fx,"BRL=X",now).value);
  assertEquals(MarketState.UNKNOWN,MarketState.fromMeta(fx,"BZ=F",now).value);
 }
 @Test public void sessionBoundariesFollowNewYorkDstAndRejectPreviousClose(){
  assertEquals(MarketState.OPEN,MarketState.brentRegular(at("2026-11-09T00:15:00Z")).value);
  assertEquals(MarketState.CLOSED,MarketState.brentRegular(at("2026-11-13T22:00:00Z")).value);
  assertEquals(MarketState.CLOSED,MarketState.brentRegular(at("2026-07-10T21:00:00Z")).value);
  assertFalse(MarketState.sameBrentSession(at("2026-11-11T21:59:00Z"),at("2026-11-11T23:05:00Z")));
 }
 @Test public void sundayGlobalForexIsNotMisidentifiedAsBrazilianExchangeTrading()throws Exception{
  long sunday=at("2026-11-16T00:15:00Z"); // Sunday, 21:15 BRT.
  assertTrue(MarketState.brazilWeekend(sunday));
  assertTrue(MarketState.brazilDollarContext(sunday).contains("YAHOO FINANCE"));
  assertEquals(MarketState.OPEN,MarketState.forexRegular(sunday).value);
  long friday=at("2026-11-13T23:30:00Z");
  JSONObject stale=new JSONObject().put("symbol","BRL=X").put("marketState","REGULAR").put("regularMarketTime",friday/1000);
  assertEquals("Old Yahoo REGULAR label cannot prove Sunday night OPEN",MarketState.UNKNOWN,MarketState.fromMeta(stale,"BRL=X",sunday).value);
  JSONObject current=new JSONObject().put("symbol","BRL=X").put("marketState","REGULAR").put("regularMarketTime",(sunday-60000)/1000);
  assertEquals("Fresh global quote can be OPEN even though Brazil has no trading",MarketState.OPEN,MarketState.fromMeta(current,"BRL=X",sunday).value);
  long monday=at("2026-11-16T13:00:00Z");
  assertFalse(MarketState.brazilWeekend(monday));
  assertTrue(MarketState.brazilDollarContext(monday).contains("CÂMBIO INTERNACIONAL"));
  assertEquals(MarketState.OPEN,MarketState.forexRegular(monday).value);
 }
 @Test public void yahooForexHoursAreIndependentFromB3Futures(){
  assertEquals("Just before Sunday FX open",MarketState.CLOSED,MarketState.forexRegular(at("2026-11-15T22:04:00Z")).value);
  assertEquals("Sunday after 17:05 New York",MarketState.OPEN,MarketState.forexRegular(at("2026-11-15T22:06:00Z")).value);
  assertEquals("Weekday session",MarketState.OPEN,MarketState.forexRegular(at("2026-11-16T14:15:00Z")).value);
  assertEquals("Daily rollover",MarketState.CLOSED,MarketState.forexRegular(at("2026-11-16T22:02:00Z")).value);
  assertEquals("Daily rollover resumes",MarketState.OPEN,MarketState.forexRegular(at("2026-11-16T22:06:00Z")).value);
  assertEquals("After Friday global forex close",MarketState.CLOSED,MarketState.forexRegular(at("2026-11-20T22:00:00Z")).value);
  assertEquals("Saturday",MarketState.CLOSED,MarketState.forexRegular(at("2026-11-21T15:00:00Z")).value);
 }
 @Test public void missingStateUsesOnlyAValidProviderPeriod()throws Exception{
  long now=at("2026-11-11T15:00:00Z");JSONObject fx=new JSONObject().put("symbol","BRL=X").put("currentTradingPeriod",new JSONObject().put("regular",new JSONObject().put("start",(now-3600000)/1000).put("end",(now+3600000)/1000)));
  assertEquals(MarketState.OPEN,MarketState.fromMeta(fx,"BRL=X",now).value);fx.put("marketState","UNRECOGNIZED");assertEquals(MarketState.UNKNOWN,MarketState.fromMeta(fx,"BRL=X",now).value);
 }
}

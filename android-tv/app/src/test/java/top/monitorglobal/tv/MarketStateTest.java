package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import java.time.Instant;import static org.junit.Assert.*;
public class MarketStateTest {
 private long at(String s){return Instant.parse(s).toEpochMilli();}
 @Test public void independentStatesAndDailyPause()throws Exception{
  long now=at("2026-11-11T22:30:00Z");assertEquals(MarketState.PAUSED,MarketState.brentRegular(now).value);
  JSONObject fx=new JSONObject().put("symbol","BRL=X").put("marketState","REGULAR");assertEquals(MarketState.OPEN,MarketState.fromMeta(fx,"BRL=X",now).value);
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
 @Test public void missingStateUsesOnlyAValidProviderPeriod()throws Exception{
  long now=at("2026-11-11T15:00:00Z");JSONObject fx=new JSONObject().put("symbol","BRL=X").put("currentTradingPeriod",new JSONObject().put("regular",new JSONObject().put("start",(now-3600000)/1000).put("end",(now+3600000)/1000)));
  assertEquals(MarketState.OPEN,MarketState.fromMeta(fx,"BRL=X",now).value);fx.put("marketState","UNRECOGNIZED");assertEquals(MarketState.UNKNOWN,MarketState.fromMeta(fx,"BRL=X",now).value);
 }
}

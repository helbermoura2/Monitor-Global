package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import java.time.*;import static org.junit.Assert.*;

public class BrentQuoteTest {
 static long time(String iso){return Instant.parse(iso).toEpochMilli();}
 static JSONObject quote(long now)throws Exception{
  return new JSONObject().put("version","tv-brent-v1").put("ok",true)
   .put("marketOpen",true).put("symbol","BZ=F").put("currency","USD")
   .put("source","Yahoo Finance").put("price",78.35).put("previousClose",77.5)
   .put("change",0.85).put("percent",1.10).put("asOf",now-4*60000);
 }
 @Test public void weekendsHaveNoCardAndSundayReturnsAtNewYork18() {
  assertFalse(BrentQuote.marketOpen(time("2026-11-13T23:00:00Z")));
  assertFalse(BrentQuote.marketOpen(time("2026-11-14T12:00:00Z")));
  assertFalse(BrentQuote.marketOpen(time("2026-11-15T22:59:00Z")));
  assertTrue(BrentQuote.marketOpen(time("2026-11-15T23:00:00Z")));
  assertFalse(BrentQuote.marketOpen(time("2026-11-08T22:59:00Z")));
  assertTrue(BrentQuote.marketOpen(time("2026-11-08T23:00:00Z")));
 }
 @Test public void daylightSavingAutomaticallyAdjustsMarketWithoutDeviceTimezone() {
  java.util.TimeZone old=java.util.TimeZone.getDefault();
  try{
   java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Tokyo"));
   assertFalse(BrentQuote.marketOpen(time("2026-07-05T21:59:00Z")));
   assertTrue(BrentQuote.marketOpen(time("2026-07-05T22:00:00Z")));
   assertTrue(BrentQuote.marketOpen(time("2026-07-10T20:59:00Z")));
   assertFalse(BrentQuote.marketOpen(time("2026-07-10T21:00:00Z")));
  }finally{java.util.TimeZone.setDefault(old);}
 }
 @Test public void hourlyFifteenMinuteWindowAppearsOnce() {
  long ten=time("2026-11-10T13:00:00Z"); // 10:00 BRT
  long start=ten+15*60000;
  assertEquals(start,BrentQuote.slot(ten));
  assertFalse(BrentQuote.due(0,start-1));
  assertTrue(BrentQuote.due(0,start));
  assertFalse(BrentQuote.due(start,start+60000));
  assertTrue(BrentQuote.due(0,start+29*60000));
  assertTrue(BrentQuote.due(0,start+44*60000));
  assertFalse(BrentQuote.due(0,start+45*60000));
  assertEquals(60000,BrentQuote.delay(start));
  assertEquals(15*60000,BrentQuote.delay(ten));
  assertEquals(60000,BrentQuote.delay(start+30*60000));
  assertEquals(15*60000,BrentQuote.delay(start+45*60000));
  // No 1-minute wakeups after showing a price in the current hour.
  assertEquals(59*60000,BrentQuote.delay(start+60000,start));
  // No minute-by-minute wakeups during the Friday/Saturday market closure.
  assertEquals(60*60000,BrentQuote.delay(time("2026-11-14T13:15:00Z"),0));
 }
 @Test public void staleMarketPriceAndWeekendCannotBePresented()throws Exception {
  long now=time("2026-11-10T13:15:00Z");
  BrentQuote value=BrentQuote.parse(quote(now),now);
  assertNotNull(value);assertEquals(78.35,value.price,.0001);assertEquals(0.85,value.change,.001);
  assertEquals(1.10,value.percent,.001);assertEquals("Yahoo Finance",value.source);
  assertNull(BrentQuote.parse(quote(now).put("asOf",now-80*60000),now));
  assertNull(BrentQuote.parse(quote(now).put("asOf",now+3*60000),now));
  assertNull(BrentQuote.parse(quote(now).put("symbol","CL=F"),now));
  assertNull(BrentQuote.parse(quote(now).put("marketOpen",false),now));
  assertNull(BrentQuote.parse(quote(now).put("source","other"),now));
  assertNull(BrentQuote.parse(quote(now).put("percent",60),now));
  assertNull(BrentQuote.parse(quote(now).put("change",10),now));
  assertNull(BrentQuote.parse(quote(now),time("2026-11-14T13:15:00Z")));
 }
 @Test public void unknownDailyVariationRemainsUnknownRatherThanZero()throws Exception{
  long now=time("2026-11-10T13:15:00Z");
  JSONObject d=quote(now).put("previousClose",JSONObject.NULL).put("change",JSONObject.NULL).put("percent",JSONObject.NULL);
  BrentQuote q=BrentQuote.parse(d,now);
  assertNotNull(q);assertNull(q.change);assertNull(q.percent);
 }

 @Test public void yahooDirectFallbackUsesRealHeadlineAndKeepsVariation()throws Exception{
  long now=time("2026-11-09T13:25:00Z");
  JSONObject meta=new JSONObject().put("symbol","BZ=F").put("currency","USD")
    .put("regularMarketPrice",96.99).put("regularMarketTime",(now-10*60000)/1000)
    .put("chartPreviousClose",98.32);
  JSONObject raw=new JSONObject().put("chart",new JSONObject().put("result",
    new JSONArray().put(new JSONObject().put("meta",meta))).put("error",JSONObject.NULL));
  JSONObject result=BrentQuote.adaptYahooChart(raw,now);
  assertNotNull(result);
  assertTrue(result.optBoolean("directFromTv"));
  assertEquals("regular-market",result.optString("quoteKind"));
  BrentQuote valid=BrentQuote.parse(result,now);
  assertNotNull(valid);assertEquals(96.99,valid.price,.0001);
  assertEquals(-1.33,valid.change,.001);
  assertEquals("Yahoo Finance",valid.source);
  meta.put("symbol","CL=F");
  assertNull(BrentQuote.adaptYahooChart(raw,now));
 }
 @Test public void yahooDirectFallbackOnlyAcceptsClosePairedToRecentCandle()throws Exception{
  long now=time("2026-11-09T13:25:00Z"),recent=(now-10*60000)/1000;
  JSONObject meta=new JSONObject().put("symbol","BZ=F").put("currency","USD")
    .put("regularMarketPrice",96.99).put("regularMarketTime",(now-4*3600000)/1000)
    .put("chartPreviousClose",98.32);
  JSONObject data=new JSONObject().put("meta",meta).put("timestamp",new JSONArray().put(recent));
  JSONObject raw=new JSONObject().put("chart",new JSONObject().put("result",new JSONArray().put(data))
   .put("error",JSONObject.NULL));
  assertNull("Timestamp alone is not a trade",BrentQuote.adaptYahooChart(raw,now));
  JSONObject quote=new JSONObject().put("close",new JSONArray().put(96.88));
  data.put("indicators",new JSONObject().put("quote",new JSONArray().put(quote)));
  JSONObject adapted=BrentQuote.adaptYahooChart(raw,now);
  assertNotNull(adapted);
  assertEquals("observed-minute-candle",adapted.optString("quoteKind"));
  assertNotNull(BrentQuote.parse(adapted,now));
  quote.put("close",new JSONArray().put(JSONObject.NULL));
  assertNull(BrentQuote.adaptYahooChart(raw,now));
  quote.put("close",new JSONArray().put(96.88));
  data.put("timestamp",new JSONArray().put((now-3*3600000)/1000));
  assertNull("Old candle cannot become current",BrentQuote.adaptYahooChart(raw,now));
  data.put("timestamp",new JSONArray().put(recent));
  meta.put("marketState","CLOSED");
  assertNull(BrentQuote.adaptYahooChart(raw,now));
  meta.remove("marketState");
  assertNull("No weekend refresh",BrentQuote.adaptYahooChart(raw,time("2026-11-14T14:00:00Z")));
 }
}


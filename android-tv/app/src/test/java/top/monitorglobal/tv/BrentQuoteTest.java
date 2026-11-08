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
 @Test public void weekendsHaveNoCardAndSundayReturnsAtLondon23() {
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
   assertTrue(BrentQuote.marketOpen(time("2026-07-10T21:59:00Z")));
   assertFalse(BrentQuote.marketOpen(time("2026-07-10T22:00:00Z")));
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
  assertFalse(BrentQuote.due(0,start+30*60000));
  assertEquals(60000,BrentQuote.delay(start));
  assertEquals(15*60000,BrentQuote.delay(ten));
  assertEquals(30*60000,BrentQuote.delay(start+30*60000));
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
}

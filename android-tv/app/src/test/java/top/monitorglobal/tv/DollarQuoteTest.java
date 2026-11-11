package top.monitorglobal.tv;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class DollarQuoteTest {
 private static JSONObject yahoo(double price,long at,String symbol,String currency)throws Exception{
  JSONObject meta=new JSONObject().put("symbol",symbol).put("currency",currency)
   .put("regularMarketPrice",price).put("regularMarketTime",at/1000L)
   .put("chartPreviousClose",price-.02);
  return new JSONObject().put("chart",new JSONObject().put("error",JSONObject.NULL)
   .put("result",new JSONArray().put(new JSONObject().put("meta",meta))));
 }
 @Test public void onlyAcceptsFreshRealBRLSpotQuotes()throws Exception{
  long now=1762502400000L;
  DollarQuote quote=DollarQuote.fromYahoo(yahoo(5.32,now-300000,"BRL=X","BRL"),now);
  assertNotNull(quote);assertEquals(5.32,quote.price,.0001);
  assertEquals("Yahoo Finance",quote.source);assertNotNull(quote.percent);
  assertNull(DollarQuote.fromYahoo(yahoo(5.32,now-90*60000L,"BRL=X","BRL"),now));
  assertNull(DollarQuote.fromYahoo(yahoo(5.32,now+180000,"BRL=X","BRL"),now));
  assertNull(DollarQuote.fromYahoo(yahoo(5.32,now-1000,"BZ=F","BRL"),now));
  assertNull(DollarQuote.fromYahoo(yahoo(5.32,now-1000,"BRL=X","USD"),now));
  assertNull(DollarQuote.fromYahoo(yahoo(555,now-1000,"BRL=X","BRL"),now));
  assertNull(DollarQuote.fromYahoo(null,now));
 }
 @Test public void noPreviousCloseStillShowsRealPriceWithoutInventingDelta()throws Exception{
  long now=1762502400000L;
  JSONObject result=yahoo(5.23,now-120000,"BRL=X","BRL");
  result.getJSONObject("chart").getJSONArray("result").getJSONObject(0)
   .getJSONObject("meta").remove("chartPreviousClose");
  DollarQuote quote=DollarQuote.fromYahoo(result,now);
  assertNotNull(quote);assertNull(quote.change);assertNull(quote.percent);
 }
}

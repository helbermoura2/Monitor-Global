package top.monitorglobal.tv;
import org.json.*;

/** Real USD/BRL spot quote from Yahoo Finance. Never synthesize a price or
 * substitute Brent dollars for a currency quotation. Availability is optional.
 */
final class DollarQuote {
 static final long MAX_AGE=75*60000L;
 final MarketState session;final double price;final Double change,percent;final long at;final String source;
 DollarQuote(double price,Double change,Double percent,long at,String source){
  this(price,change,percent,at,source,MarketState.unknown());
 }
 DollarQuote(double price,Double change,Double percent,long at,String source,MarketState state){
  this.price=price;this.change=change;this.percent=percent;this.at=at;this.source=source;session=state;
 }
 private static boolean valid(double price){return Double.isFinite(price)&&price>=1&&price<=15;}
 static DollarQuote fromYahoo(JSONObject raw,long now){
  if(raw==null||now<=0)return null;
  JSONObject chart=raw.optJSONObject("chart");
  if(chart==null||!chart.isNull("error"))return null;
  JSONArray result=chart.optJSONArray("result");
  if(result==null||result.length()!=1)return null;
  JSONObject row=result.optJSONObject(0),meta=row==null?null:row.optJSONObject("meta");
  if(meta==null||!"BRL=X".equals(meta.optString("symbol"))||!"BRL".equals(meta.optString("currency")))return null;
  Object rawPrice=meta.opt("regularMarketPrice"),rawTime=meta.opt("regularMarketTime");
  double price=rawPrice instanceof Number?((Number)rawPrice).doubleValue():Double.NaN;
  long at=rawTime instanceof Number?((Number)rawTime).longValue()*1000L:0;
  if(!valid(price)||at<=0||at>now+120000||now-at>MAX_AGE)return null;
  Double change=null,percent=null;
  Object rawPrevious=meta.opt("chartPreviousClose");
  if(!(rawPrevious instanceof Number))rawPrevious=meta.opt("previousClose");
  if(rawPrevious instanceof Number){
   double prev=((Number)rawPrevious).doubleValue();
   if(valid(prev)){
    double value=Math.round((price-prev)*10000d)/10000d;
    double pct=Math.round((price-prev)/prev*10000d)/100d;
    if(Double.isFinite(pct)&&Math.abs(pct)<25){change=value;percent=pct;}
   }
  }
  return new DollarQuote(price,change,percent,at,"Yahoo Finance",MarketState.fromMeta(meta,"BRL=X",now));
 }
}


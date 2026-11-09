package top.monitorglobal.tv;

import java.time.*;
import java.time.temporal.ChronoUnit;
import org.json.*;

/** Strict regular ICE Brent session and source-backed quote policy for TV. */
final class BrentQuote {
 static final long MINUTE=60000L,MAX_AGE=75*MINUTE,DISPLAY=12000L;
 private static final ZoneId LONDON=ZoneId.of("Europe/London"),BRASIL=ZoneId.of("America/Sao_Paulo");
 final double price;final Double previousClose,change,percent;final long at;final String source;
 BrentQuote(double value,Double previous,Double delta,Double pct,long time,String origin){
  price=value;previousClose=previous;change=delta;percent=pct;at=time;source=origin;
 }
 static boolean marketOpen(long now){
  if(now<=0)return false;
  ZonedDateTime t=Instant.ofEpochMilli(now).atZone(LONDON);int hour=t.getHour();
  switch(t.getDayOfWeek()){
   case SATURDAY:return false;
   case SUNDAY:return hour>=23;
   case MONDAY:case TUESDAY:case WEDNESDAY:case THURSDAY:case FRIDAY:return hour>=1&&hour<23;
   default:return false;
  }
 }
 static long slot(long now){
  return Instant.ofEpochMilli(now).atZone(BRASIL).truncatedTo(ChronoUnit.HOURS).withMinute(15).toInstant().toEpochMilli();
 }
 static boolean due(long lastSlot,long now){
  long start=slot(now);
  return marketOpen(now)&&now>=start&&now<start+45*MINUTE&&lastSlot!=start;
 }
 static long delay(long now){return delay(now,0);}
 static long delay(long now,long shownSlot){
  long start=slot(now);
  // Once delivered or market closed, skip the retry window entirely.
  if(!marketOpen(now)||shownSlot==start&&now>=start)
   return Math.max(1,Instant.ofEpochMilli(now).atZone(BRASIL).truncatedTo(ChronoUnit.HOURS).plusHours(1).withMinute(15).toInstant().toEpochMilli()-now);
  if(now<start)return Math.max(1,start-now);
  if(now<start+45*MINUTE)return 60000;
  return Math.max(1,Instant.ofEpochMilli(now).atZone(BRASIL).truncatedTo(ChronoUnit.HOURS).plusHours(1).withMinute(15).toInstant().toEpochMilli()-now);
 }
 private static boolean price(double n){return Double.isFinite(n)&&n>=5&&n<=400;}
 static BrentQuote parse(JSONObject root,long now){
  if(root==null||!"tv-brent-v1".equals(root.optString("version"))||
   !root.optBoolean("ok")||!root.optBoolean("marketOpen")||
   !marketOpen(now)||!"BZ=F".equals(root.optString("symbol"))||
   !"USD".equals(root.optString("currency"))||
   !"Yahoo Finance".equals(root.optString("source")))return null;
  double value=root.optDouble("price",Double.NaN);long at=root.optLong("asOf",0);
  if(!price(value)||at<=0||at>now+2*MINUTE||now-at>MAX_AGE)return null;
  Double previous=null,change=null,percent=null;
  if(!root.isNull("previousClose")){
   double prev=root.optDouble("previousClose",Double.NaN);
   if(!price(prev))return null;
   double delta=root.optDouble("change",Double.NaN);
   double pct=root.optDouble("percent",Double.NaN);
   if(!Double.isFinite(delta)||!Double.isFinite(pct)||Math.abs(pct)>50||
    Math.abs(delta-(Math.round((value-prev)*100)/100.0))>.011||
    Math.abs(pct-(Math.round((value-prev)/prev*10000)/100.0))>.011)return null;
   previous=prev;change=delta;percent=pct;
  }
  return new BrentQuote(value,previous,change,percent,at,"Yahoo Finance");
 }
 /** Adapt a genuine Yahoo chart for the strict, existing TV quote gate.
  * Used only as fallback when the Worker cannot obtain an intraday quote.
  * Chart timestamp alone is never proof of the value: close and time must match. */
 static JSONObject adaptYahooChart(JSONObject raw,long now) {
  if(raw==null||!marketOpen(now))return null;
  JSONObject chart=raw.optJSONObject("chart");
  if(chart==null||!chart.isNull("error"))return null;
  JSONArray series=chart.optJSONArray("result");
  if(series==null||series.length()!=1)return null;
  JSONObject data=series.optJSONObject(0),meta=data==null?null:data.optJSONObject("meta");
  if(meta==null||!"BZ=F".equals(meta.optString("symbol"))||!"USD".equals(meta.optString("currency")))return null;
  String state=meta.optString("marketState","");
  if(java.util.Arrays.asList("CLOSED","POST","PRE","PREPRE","POSTPOST").contains(state))return null;
  double value=Double.NaN;long at=0;String kind="";
  Object head=meta.opt("regularMarketPrice"),headTime=meta.opt("regularMarketTime");
  long marketAt=headTime instanceof Number?((Number)headTime).longValue()*1000L:0;
  if(head instanceof Number&&price(((Number)head).doubleValue())&&freshYahoo(marketAt,now)){
   value=((Number)head).doubleValue();at=marketAt;kind="regular-market";
  }else{
   JSONArray times=data.optJSONArray("timestamp");
   JSONObject indicators=data.optJSONObject("indicators");
   JSONArray quotes=indicators==null?null:indicators.optJSONArray("quote");
   JSONObject item=quotes==null?null:quotes.optJSONObject(0);
   JSONArray closes=item==null?null:item.optJSONArray("close");
   if(times==null||closes==null||times.length()!=closes.length()||times.length()==0||times.length()>2000)return null;
   for(int i=times.length()-1;i>=0;i--){
    Object time=times.opt(i),close=closes.opt(i);
    if(!(time instanceof Number)||!(close instanceof Number))continue;
    long candle=((Number)time).longValue()*1000L;
    double candidate=((Number)close).doubleValue();
    if(freshYahoo(candle,now)&&price(candidate)){
     value=candidate;at=candle;kind="observed-minute-candle";break;
    }
   }
  }
  if(!price(value)||at==0)return null;
  Double previous=null;
  for(String key:new String[]{"chartPreviousClose","previousClose"}){
   Object candidate=meta.opt(key);
   if(candidate instanceof Number&&price(((Number)candidate).doubleValue())){
    previous=((Number)candidate).doubleValue();break;
   }
  }
  Double change=null,percent=null;
  if(previous!=null){
   change=Math.round((value-previous)*100d)/100d;
   percent=Math.round((value-previous)/previous*10000d)/100d;
   if(!Double.isFinite(percent)||Math.abs(percent)>50)return null;
  }
  try{
   JSONObject result=new JSONObject();
   result.put("version","tv-brent-v1").put("ok",true).put("marketOpen",true)
    .put("symbol","BZ=F").put("currency","USD")
    .put("price",value).put("asOf",at)
    .put("source","Yahoo Finance").put("directFromTv",true).put("quoteKind",kind)
    .put("previousClose",previous==null?JSONObject.NULL:previous)
    .put("change",change==null?JSONObject.NULL:change)
    .put("percent",percent==null?JSONObject.NULL:percent);
   return parse(result,now)==null?null:result;
  }catch(JSONException ex){return null;}
 }
 private static boolean freshYahoo(long at,long now){
  return at>0&&at<=now+2*MINUTE&&now-at<=MAX_AGE&&marketOpen(at);
 }
 static String clock(long at){
  return java.time.format.DateTimeFormatter.ofPattern("HH:mm",java.util.Locale.forLanguageTag("pt-BR"))
   .format(Instant.ofEpochMilli(at).atZone(BRASIL))+" BRT";
 }
}

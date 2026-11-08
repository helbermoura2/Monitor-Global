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
  return marketOpen(now)&&now>=start&&now<start+30*MINUTE&&lastSlot!=start;
 }
 static long delay(long now){return delay(now,0);}
 static long delay(long now,long shownSlot){
  long start=slot(now);
  // Once delivered or market closed, skip the retry window entirely.
  if(!marketOpen(now)||shownSlot==start&&now>=start)
   return Math.max(1,Instant.ofEpochMilli(now).atZone(BRASIL).truncatedTo(ChronoUnit.HOURS).plusHours(1).withMinute(15).toInstant().toEpochMilli()-now);
  if(now<start)return Math.max(1,start-now);
  if(now<start+30*MINUTE)return 60000;
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
 static String clock(long at){
  return java.time.format.DateTimeFormatter.ofPattern("HH:mm",java.util.Locale.forLanguageTag("pt-BR"))
   .format(Instant.ofEpochMilli(at).atZone(BRASIL))+" BRT";
 }
}

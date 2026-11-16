package top.monitorglobal.tv;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.regex.*;

/** Verified B3 DOL futures close only, never USD/BRL global spot as a substitute.
 * Source is Noticias Agricolas' public historic close table explicitly credited
 * to B3. This is NOT an intraday quotation; label it as FECHAMENTO everywhere.
 */
final class DollarQuote {
 static final long MAX_CLOSE_AGE=7L*86400000L;
 private static final ZoneId BRASIL=ZoneId.of("America/Sao_Paulo");
 private static final DateTimeFormatter DATE=DateTimeFormatter.ofPattern("dd/MM/uuuu");
 private static final Pattern CLOSE=Pattern.compile("Fechamento\\s*:\\s*(\\d{2}/\\d{2}/\\d{4})\\s+Fonte\\s*:\\s*B3",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
 private static final Pattern ROW=Pattern.compile("([A-Za-zÀ-ÿ]+)/(\\d{2})\\s+([0-9]{1,2}(?:\\.[0-9]{3})?,[0-9]{2})\\s+([+-]?[0-9]{1,2},[0-9]{2})",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
 final MarketState session;final double price;final Double change,percent;final long at;final String source,contract;
 final boolean b3Close;
 DollarQuote(double price,Double change,Double percent,long at,String source){
  this(price,change,percent,at,source,MarketState.unknown());
 }
 DollarQuote(double price,Double change,Double percent,long at,String source,MarketState state){
  this(price,change,percent,at,source,state,"",false);
 }
 private DollarQuote(double price,Double change,Double percent,long at,String source,MarketState state,String contract,boolean b3Close){
  this.price=price;this.change=change;this.percent=percent;this.at=at;this.source=source;session=state;
  this.contract=contract;this.b3Close=b3Close;
 }
 static DollarQuote fromB3CloseHtml(String html,long now){
  if(html==null||html.length()<120||html.length()>850000||now<=0)return null;
  // Parse only a table explicitly marked as B3. No global FX ticker, fallbacks,
  // broker prices, inferred trades, or artificial exchange conversions.
  String text=html.replaceAll("(?is)<script\\b[^>]*>.*?</script>"," ")
   .replaceAll("(?is)<style\\b[^>]*>.*?</style>"," ")
   .replaceAll("(?s)<[^>]+>"," ")
   .replace("&nbsp;"," ").replace("&#160;"," ").replace("&amp;","&")
   .replaceAll("\\s+"," ").trim();
  if(!text.toLowerCase(Locale.ROOT).contains("dólar comercial futuro"))return null;
  Matcher head=CLOSE.matcher(text);
  while(head.find()){
   LocalDate day;
   try{day=LocalDate.parse(head.group(1),DATE);}catch(DateTimeException ignored){continue;}
   long close=day.atTime(18,30).atZone(BRASIL).toInstant().toEpochMilli();
   if(close>now+120000L||now-close>MAX_CLOSE_AGE)continue;
   String table=text.substring(head.end(),Math.min(text.length(),head.end()+1800));
   int next=table.indexOf("Fechamento:");
   if(next>=0)table=table.substring(0,next);
   if(!table.contains("Contrato")||!table.contains("Variação"))continue;
   Matcher row=ROW.matcher(table);
   if(!row.find())continue;
   String contract=row.group(1)+"/"+row.group(2);
   double points=parseBrazil(row.group(3)),percentage=parseBrazil(row.group(4));
   // B3 quotes DOL in BRL per US$1,000; the TV presents BRL per US$1.
   if(!Double.isFinite(points)||points<1000||points>15000||!Double.isFinite(percentage)||Math.abs(percentage)>30)continue;
   return new DollarQuote(points/1000d,null,percentage,close,
    "B3 · fechamento via Notícias Agrícolas",MarketState.brazilDOLRegular(now),contract,true);
  }
  return null;
 }
 private static double parseBrazil(String n){
  try{return Double.parseDouble(n.replace(".","").replace(',','.'));}catch(Exception ex){return Double.NaN;}
 }
}

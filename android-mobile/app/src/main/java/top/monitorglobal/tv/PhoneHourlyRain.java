package top.monitorglobal.tv;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/** Interprets hourly forecast amounts in the displayed intervals for one location. */
final class PhoneHourlyRain {
 static final long HOUR=3600000L;
 private static final ZoneId BRASILIA=ZoneId.of("America/Sao_Paulo");
 private static final DateTimeFormatter CLOCK=DateTimeFormatter.ofPattern("HH:mm",Locale.ROOT);
 private static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("dd/MM",Locale.ROOT);

 static final class Period {
  final long start,end;
  final double amount;
  final PhoneHourly.Hour peak;
  Period(long start,long end,double amount,PhoneHourly.Hour peak){
   this.start=start;this.end=end;this.amount=amount;this.peak=peak;
  }
  long hours(){return (end-start)/HOUR;}
  String impacts(){
   if(peak.amount>=30||amount>=50)
    return "Chuva concentrada pode reduzir bastante a visibilidade e causar enxurradas ou alagamentos em pontos vulneráveis, especialmente com solo já encharcado ou drenagem insuficiente.";
   if(peak.amount>=10||amount>=20)
    return "A chuva pode reduzir a visibilidade e formar poças. Em áreas baixas ou com drenagem lenta, pode haver acúmulo de água, especialmente se chover por várias horas.";
   return "Com o volume previsto, o efeito mais provável é piso e pista molhados. Poças podem se formar em trechos com drenagem lenta.";
  }
 }

 private PhoneHourlyRain(){}

 static Period mainPeriod(List<PhoneHourly.Hour> hours){
  Period main=null;
  long start=0,end=0;
  double amount=0;
  PhoneHourly.Hour peak=null;
  for(PhoneHourly.Hour hour:hours){
   boolean wet=Double.isFinite(hour.amount)&&hour.amount>0;
   if(peak!=null&&(!wet||hour.start!=end)){
    if(main==null||amount>main.amount)main=new Period(start,end,amount,peak);
    peak=null;amount=0;
   }
   if(!wet)continue;
   if(peak==null){start=hour.start;peak=hour;}
   else if(hour.amount>peak.amount)peak=hour;
   end=hour.start+HOUR;amount+=hour.amount;
  }
  if(peak!=null&&(main==null||amount>main.amount))main=new Period(start,end,amount,peak);
  return main;
 }

 static String interval(long start,long end){
  ZonedDateTime from=Instant.ofEpochMilli(start).atZone(BRASILIA);
  ZonedDateTime to=Instant.ofEpochMilli(end).atZone(BRASILIA);
  return DAY.format(from)+" · "+CLOCK.format(from)+"–"+
   (from.toLocalDate().equals(to.toLocalDate())?"":DAY.format(to)+" ")+CLOCK.format(to);
 }

 static String millimeters(double amount){
  return amount>0&&amount<.05?"< 0,1":RainForecast.number(amount);
 }
}

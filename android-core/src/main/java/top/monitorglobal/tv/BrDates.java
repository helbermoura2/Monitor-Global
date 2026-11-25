package top.monitorglobal.tv;
import java.time.*;
import java.time.format.*;
import java.util.Locale;
/** Presentation only. Feed and saved summary day keys remain ISO dates. */
final class BrDates {
 private static final Locale BR=Locale.forLanguageTag("pt-BR");
 private static final ZoneId ZONE=ZoneId.of("America/Sao_Paulo");
 private static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("dd/MM/uuuu",BR);
 private static final DateTimeFormatter DATE_TIME=DateTimeFormatter.ofPattern("dd/MM/uuuu HH:mm:ss 'BRT'",BR).withZone(ZONE);
 private static final DateTimeFormatter TIME=DateTimeFormatter.ofPattern("HH:mm:ss 'BRT'",BR).withZone(ZONE);
 static String day(String iso){
  if(iso==null||!iso.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))return "Data indisponível";
  try{return LocalDate.parse(iso).format(DAY);}catch(DateTimeException ignored){return "Data indisponível";}
 }
 static String dateTime(long at){return at>0?DATE_TIME.format(Instant.ofEpochMilli(at)):"Data indisponível";}
 static String time(long at){return at>0?TIME.format(Instant.ofEpochMilli(at)):"Horário indisponível";}
}

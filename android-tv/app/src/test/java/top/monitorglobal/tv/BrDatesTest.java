package top.monitorglobal.tv;
import java.time.Instant;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;
public class BrDatesTest {
 @Test public void summaryDayUsesDayMonthYearWithoutTimezoneConversion(){
  assertEquals("30/10/2026",BrDates.day("2026-10-30"));
  assertEquals("01/01/2027",BrDates.day("2027-01-01"));
  assertEquals("29/02/2028",BrDates.day("2028-02-29"));
 }
 @Test public void invalidOrMissingDatesDoNotLeakRawValuesOrInventADay(){
  for(String input:new String[]{null,"","2026-02-30","2026-10-32","10/30/2026","2026-1-2"})
   assertEquals("Data indisponível",BrDates.day(input));
  assertEquals("Data indisponível",BrDates.dateTime(0));
 }
 @Test public void englishDeviceAndForeignTimezoneDoNotChangeBrazilianDisplay(){
  Locale locale=Locale.getDefault();TimeZone timezone=TimeZone.getDefault();
  try{Locale.setDefault(Locale.US);TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
   assertEquals("30/10/2026",BrDates.day("2026-10-30"));
   long at=Instant.parse("2026-10-31T01:30:45Z").toEpochMilli();
   assertEquals("30/10/2026 22:30:45 BRT",BrDates.dateTime(at));
   assertEquals("22:30:45 BRT",BrDates.time(at));
  }finally{Locale.setDefault(locale);TimeZone.setDefault(timezone);}
 }
}

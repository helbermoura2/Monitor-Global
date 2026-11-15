package top.monitorglobal.tv;

import org.junit.Test;
import java.time.*;
import static org.junit.Assert.*;

/** Visual day/night at the fixed Liberdade forecast location. */
public class PhoneDaylightTest {
 private long brazil(int year,int month,int day,int hour,int minute){
  return ZonedDateTime.of(year,month,day,hour,minute,0,0,ZoneId.of("America/Sao_Paulo")).toInstant().toEpochMilli();
 }
 @Test public void at0329InSaoPauloItIsNightEvenWhenSkyIsPartlyCloudy(){
  long at=brazil(2026,11,15,3,29);
  assertFalse(PhoneDaylight.isDay(at));
  assertEquals(PhoneIcons.MOON,PhoneIcons.condition("PartlyCloudy",at));
  assertEquals(PhoneIcons.MOON,PhoneIcons.condition("Clear",at));
  assertEquals(PhoneIcons.MOON,PhoneIcons.condition("MostlyClear",at));
 }
 @Test public void noonInSaoPauloUsesSunWithoutChangingCondition(){
  long at=brazil(2026,11,15,12,0);
  assertTrue(PhoneDaylight.isDay(at));
  assertEquals(PhoneIcons.SUN,PhoneIcons.condition("Clear",at));
  assertEquals(PhoneIcons.SUN,PhoneIcons.condition("PartlyCloudy",at));
  assertEquals(PhoneIcons.CLOUD,PhoneIcons.condition("Cloudy",at));
 }
 @Test public void noSunWellAfterSunsetOrBeforeWinterSunrise(){
  assertFalse(PhoneDaylight.isDay(brazil(2026,11,15,20,0)));
  assertFalse(PhoneDaylight.isDay(brazil(2026,6,15,5,0)));
  assertTrue(PhoneDaylight.isDay(brazil(2026,6,15,13,0)));
 }
 @Test public void hourlySymbolsUseTheSpecificForecastHour(){
  long tomorrowNight=brazil(2026,11,16,2,0);
  long tomorrowDay=brazil(2026,11,16,14,0);
  assertEquals(PhoneIcons.MOON,PhoneIcons.condition("PartlyCloudy",tomorrowNight));
  assertEquals(PhoneIcons.SUN,PhoneIcons.condition("PartlyCloudy",tomorrowDay));
  assertEquals(PhoneIcons.CLOUD,PhoneIcons.condition("MostlyCloudy",tomorrowNight));
  assertEquals(PhoneIcons.RAIN,PhoneIcons.condition("Rain",tomorrowDay));
 }
}

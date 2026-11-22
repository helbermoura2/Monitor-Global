package top.monitorglobal.tv;

import org.junit.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.Assert.*;

public class PhoneHourlyRainTest {
 private final long at=Instant.parse("2026-11-22T22:00:00Z").toEpochMilli();
 private PhoneHourly.Hour hour(int offset,double mm){return new PhoneHourly.Hour(at+offset*PhoneHourlyRain.HOUR,21,mm,"");}

 @Test public void sumsConsecutiveIntervalsAndIdentifiesThePeak(){
  PhoneHourlyRain.Period rain=PhoneHourlyRain.mainPeriod(List.of(hour(0,12.1),hour(1,10.4),hour(2,8),hour(3,0),hour(4,19)));
  assertEquals(30.5,rain.amount,0.001);
  assertEquals(3,rain.hours());
  assertEquals(12.1,rain.peak.amount,0);
  assertEquals("22/11 · 19:00–22:00",PhoneHourlyRain.interval(rain.start,rain.end));
  assertTrue(rain.impacts().contains("poças"));
 }
 @Test public void dryAndMissingHoursDoNotMergeEpisodes(){
  assertNull(PhoneHourlyRain.mainPeriod(List.of(hour(0,0),hour(1,0))));
  PhoneHourlyRain.Period rain=PhoneHourlyRain.mainPeriod(List.of(hour(0,9),hour(2,11),hour(3,0),hour(4,9)));
  assertEquals(11,rain.amount,0);
  assertEquals(1,rain.hours());
  assertEquals("22/11 · 23:00–23/11 00:00",PhoneHourlyRain.interval(hour(4,0).start,hour(5,0).start));
 }
}

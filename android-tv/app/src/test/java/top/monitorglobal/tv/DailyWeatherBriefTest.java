package top.monitorglobal.tv;

import java.time.Instant;
import java.time.LocalDate;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class DailyWeatherBriefTest {
 @Test public void eveningTargetsTomorrowAcrossTheMonthBoundary(){
  long before=Instant.parse("2026-12-01T02:44:00Z").toEpochMilli();
  long evening=Instant.parse("2026-12-01T02:45:00Z").toEpochMilli();
  assertNull(DailyWeatherBrief.due(before));
  assertEquals(evening,DailyWeatherBrief.next(before));
  DailyWeatherBrief.Slot slot=DailyWeatherBrief.due(evening);
  assertEquals(LocalDate.of(2026,12,1),slot.date());
  assertEquals("Amanhã · Liberdade · 01/12",slot.title());
  assertNull(DailyWeatherBrief.due(Instant.parse("2026-12-01T03:00:00Z").toEpochMilli()));
 }
 @Test public void morningUsesTodayAndIgnoresPastStormHours()throws Exception{
  long now=Instant.parse("2026-12-01T14:30:00Z").toEpochMilli();
  DailyWeatherBrief.Slot slot=DailyWeatherBrief.due(now);
  JSONObject data=new JSONObject("{\"timezone\":\"America/Sao_Paulo\",\"daily\":{\"time\":[\"2026-12-01\"],"
   +"\"temperature_2m_min\":[19],\"temperature_2m_max\":[28]},\"hourly\":{\"time\":[\"2026-12-01T07:00\",\"2026-12-01T16:00\"],"
   +"\"precipitation_probability\":[90,55],\"weather_code\":[95,61]}}");
  assertEquals("Hoje · Liberdade · 01/12",slot.title());
  assertEquals("Mín. 19 °C · máx. 28 °C. Maior chance de chuva às 16h (55%).",DailyWeatherBrief.summarize(data,slot,now));
 }
}

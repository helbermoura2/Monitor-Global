package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
public class WeatherForecastTest {
 final long now=1800000000000L,start=now/3600000*3600000;
 JSONObject data()throws Exception{return new JSONObject().put("version","tv-weather-v1").put("area","liberdade").put("ok",true).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("at",now).put("generatedAt",now).put("expiresAt",Math.min(now+3600000,start+3600000)).put("current",new JSONObject().put("start",start).put("temperature",22).put("feels",23).put("humidity",81).put("wind",12).put("gust",19).put("condition","Cloudy"));}
 @Test public void displaysModelFieldsWithTheirUnitsAndMissingValuesStayUnknown()throws Exception{JSONObject d=data();WeatherForecast.Summary s=WeatherForecast.summarize(d,now);assertEquals("22°C · sensação 23°C",s.temperature);assertEquals("Nublado",s.condition);assertEquals("Vento 12 km/h · rajadas 19 km/h",s.wind);assertEquals("Umidade 81%",s.humidity);d.getJSONObject("current").put("gust",JSONObject.NULL).put("humidity",JSONObject.NULL).remove("condition");s=WeatherForecast.summarize(d,now);assertTrue(s.wind.endsWith("rajadas —"));assertEquals("Umidade —",s.humidity);assertTrue(s.condition.contains("não informada"));}
 @Test public void rejectsWrongPlaceExpiredFutureAndPreviousHour()throws Exception{JSONObject d=data();d.getJSONObject("loc").put("lat",-23.55);assertNull(WeatherForecast.summarize(d,now));d=data().put("expiresAt",now-1);assertNull(WeatherForecast.summarize(d,now));d=data().put("generatedAt",now+120000);assertNull(WeatherForecast.summarize(d,now));d=data();d.getJSONObject("current").put("start",start-3600000);assertNull(WeatherForecast.summarize(d,now));}
 long brt(String time){return java.time.LocalDateTime.parse(time).atZone(java.time.ZoneId.of("America/Sao_Paulo")).toInstant().toEpochMilli();}
 @Test public void fixedHoursDoNotDriftAfterLatePresentationOrRestart(){
  long nine=brt("2026-11-01T09:00:00"),ten=brt("2026-11-01T10:00:00");
  assertTrue(WeatherForecast.due(0,nine));assertFalse(WeatherForecast.due(nine,nine+30000));
  assertFalse(WeatherForecast.due(nine+35*60000,ten-1));
  assertTrue(WeatherForecast.due(nine+35*60000,ten));
  assertEquals(ten,WeatherForecast.slot(ten+35*60000));
  assertTrue(WeatherForecast.due(nine-5*3600000,ten+35*60000));
  assertFalse(WeatherForecast.due(ten+35*60000,ten+36*60000));
 }
 @Test public void midnightWaitsForFivePastAndNextHourRemainsOne(){
  long midnight=brt("2026-11-02T00:00:00"),five=midnight+5*60000,one=midnight+3600000;
  assertFalse(WeatherForecast.due(0,midnight));assertFalse(WeatherForecast.due(0,five-1));
  assertEquals(five,WeatherForecast.slot(midnight));assertTrue(WeatherForecast.due(midnight-3600000,five));
  assertFalse(WeatherForecast.due(five,five+60000));assertTrue(WeatherForecast.due(five,one));
  assertEquals(5*60000,WeatherForecast.delay(midnight));
  assertEquals(one-five,WeatherForecast.delay(five));
 }
 @Test public void scheduleUsesBrasiliaEvenIfDeviceTimezoneIsDifferent(){
  java.util.TimeZone original=java.util.TimeZone.getDefault();
  try{java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Tokyo"));
   long nine=brt("2026-11-01T09:00:00");assertEquals(nine,WeatherForecast.slot(nine+17*60000));
   assertEquals(43*60000,WeatherForecast.delay(nine+17*60000));
  }finally{java.util.TimeZone.setDefault(original);}
 }
 @Test public void previousVersionTimestampAndClockCorrectionDoNotBlockNextSlot(){
  long ten=brt("2026-11-01T10:00:00");
  assertTrue(WeatherForecast.due(ten-15*60000,ten));
  assertFalse(WeatherForecast.due(ten+60000,ten+2*60000));
  assertTrue(WeatherForecast.due(ten+2*3600000,ten));
 }
}

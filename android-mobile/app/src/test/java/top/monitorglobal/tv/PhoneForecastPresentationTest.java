package top.monitorglobal.tv;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class PhoneForecastPresentationTest {
 private final long now=1800000000000L;
 private JSONObject location()throws Exception{return new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE);}
 private JSONObject rain()throws Exception{JSONArray points=new JSONArray();for(int i=0;i<91;i++)points.put(new JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000).put("rate",i>=15&&i<40?6:0).put("type",i>=15&&i<40?"rain":"no_precipitation"));return new JSONObject().put("ok",true).put("version","tv-rain-v1").put("area","liberdade").put("loc",location()).put("at",now).put("expiresAt",now+600000).put("forecast",points);}
 private JSONObject hourly()throws Exception{JSONArray hours=new JSONArray();for(int i=0;i<25;i++)hours.put(new JSONObject().put("start",now+i*3600000).put("temperature",18+i*.2).put("amount",i==3?2.3:0).put("condition","Cloudy"));return new JSONObject().put("ok",true).put("source","Rainbow Weather").put("loc",location()).put("at",now).put("generatedAt",now).put("expiresAt",now+3600000).put("hourly",hours);}
 @Test public void minuteRatesBecomeFiveMinuteAmountsAndPreserveTotal()throws Exception{PhoneRainChart.Series s=PhoneRainChart.Series.parse(rain(),now);assertNotNull(s);double total=0;for(int i=0;i<12;i++)total+=s.amount(i);assertEquals(2.5,total,.000001);assertEquals(0,s.amount(0),0);assertEquals(.5,s.amount(3),.000001);}
 @Test public void partialMinuteUsesOverlapRatherThanCountingWholeMinute()throws Exception{PhoneRainChart.Series s=PhoneRainChart.Series.parse(rain(),now+30000);assertNotNull(s);assertEquals(.05,s.amount(2),.000001);assertEquals(.45,s.amount(7),.000001);}
 @Test public void missingOrExpiredMinuteDataDoesNotBecomeDryBars()throws Exception{assertNull(PhoneRainChart.Series.parse(null,now));assertNull(PhoneRainChart.Series.parse(rain(),now+600001));JSONObject bad=rain();bad.getJSONArray("forecast").getJSONObject(12).put("end",now+14*60000);assertNull(PhoneRainChart.Series.parse(bad,now));}
 @Test public void hourlyPreservesActualValuesAndCapsAtTwentyFour()throws Exception{java.util.List<PhoneHourly.Hour> rows=PhoneHourly.parse(hourly(),now);assertEquals(24,rows.size());assertEquals(18,rows.get(0).temperature,0);assertEquals(2.3,rows.get(3).amount,0);}
 @Test public void hourlyRejectsStaleWrongLocationAndGaps()throws Exception{assertTrue(PhoneHourly.parse(hourly(),now+3600000).isEmpty());JSONObject wrong=hourly();wrong.getJSONObject("loc").put("lat",0);assertTrue(PhoneHourly.parse(wrong,now).isEmpty());JSONObject gap=hourly();gap.getJSONArray("hourly").getJSONObject(3).put("start",now+4*3600000);assertTrue(PhoneHourly.parse(gap,now).isEmpty());}
}

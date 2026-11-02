package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
public class RainForecastTest {
 final long now=1800000000000L;
 JSONObject input(int first,int end,double rate)throws Exception{JSONArray p=new JSONArray();for(int i=0;i<120;i++)p.put(new JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000).put("rate",i>=first&&i<end?rate:0).put("type",i>=first&&i<end?"rain":"no_precipitation"));return new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("at",now).put("expiresAt",now+600000).put("loc",new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE)).put("forecast",p);}
 @Test public void intensityAndAmountAreDifferentQuantities()throws Exception{RainForecast.Summary s=RainForecast.summarize(input(0,30,8),now);assertEquals("now",s.state);assertEquals(8,s.rate,0);assertEquals(4,s.amount,.00001);assertTrue(s.rateText.contains("8,0 mm/h"));assertTrue(s.amountText.contains("4,0 mm previstos"));assertTrue(s.title.contains("forte"));assertTrue(s.stopText.contains("30 min"));assertTrue(s.rain);}
 @Test public void arrivalIsRecalculatedFromAbsoluteTimesInsteadOfInventingACountdown()throws Exception{JSONObject d=input(12,40,8);assertTrue(RainForecast.summarize(d,now).title.contains("~12 min"));assertTrue(RainForecast.summarize(d,now+2*60000).title.contains("~10 min"));assertFalse(RainForecast.summarize(d,now).rain);}
 @Test public void failuresWrongLocationGapsUnknownUnitsAndExpiredDataNeverMeanDry()throws Exception{JSONObject d=input(0,30,8);assertNull(RainForecast.summarize(d,now+600000));assertNull(RainForecast.summarize(new JSONObject().put("ok",false),now));d.getJSONObject("loc").put("lat",0);assertNull(RainForecast.summarize(d,now));d=input(0,30,8);d.getJSONArray("forecast").getJSONObject(20).put("end",now);assertNull(RainForecast.summarize(d,now));d=input(0,30,8);d.getJSONArray("forecast").getJSONObject(20).put("type","unknown");assertNull(RainForecast.summarize(d,now));}
 @Test public void shortDryGapsDoNotCreateAFakeEndingAndSnowDoesNotAnimateRain()throws Exception{JSONObject d=input(0,100,8);for(int i=20;i<24;i++)d.getJSONArray("forecast").getJSONObject(i).put("rate",0).put("type","no_precipitation");assertTrue(RainForecast.summarize(d,now).stopText.contains("100 min"));d=input(0,30,8);for(int i=0;i<30;i++)d.getJSONArray("forecast").getJSONObject(i).put("type","snow");RainForecast.Summary s=RainForecast.summarize(d,now);assertTrue(s.title.startsWith("Neve"));assertFalse(s.rain);}
 @Test public void noticesAreTransitionsNotEveryMinuteAndInitialDryIsSilent()throws Exception{RainForecast.Summary soon=RainForecast.summarize(input(12,40,8),now),wet=RainForecast.summarize(input(0,40,8),now),dry=RainForecast.summarize(input(200,210,8),now);assertFalse(RainNoticePolicy.shouldShow(dry,"",0,now));assertTrue(RainNoticePolicy.shouldShow(soon,"",0,now));assertFalse(RainNoticePolicy.shouldShow(soon,soon.key(),now-600000,now));assertTrue(RainNoticePolicy.shouldShow(wet,soon.key(),now-120000,now));assertFalse(RainNoticePolicy.shouldShow(wet,soon.key(),now-60000,now));assertTrue(RainNoticePolicy.shouldShow(dry,wet.key(),now-120000,now));}
 @Test public void aLongGapDoesNotSuppressTheSameRainConditionForeverAfterRestart(){assertEquals("now:forte",RainNoticePolicy.previousAfterGap("now:forte",now-2*60000,now));assertEquals("",RainNoticePolicy.previousAfterGap("now:forte",now-30*60000,now));assertEquals("",RainNoticePolicy.previousAfterGap("now:forte",0,now));}
 @Test public void oldCentroForecastCannotBeRelabeledAsLiberdade()throws Exception{JSONObject d=input(0,30,8);d.getJSONObject("loc").put("lat",-23.55).put("lng",-46.63);assertNull(RainForecast.summarize(d,now));d=input(0,30,8);d.remove("area");assertNull(RainForecast.summarize(d,now));}

 @Test public void arrivingRainUsesFutureIntensityAndSupportedEpisodeDuration()throws Exception{
  RainForecast.Summary s=RainForecast.summarize(input(15,40,6),now);
  assertEquals("soon",s.state);assertEquals(15,s.arrivalMinutes);assertEquals(40,s.endMinutes);assertEquals(25,s.durationMinutes);
  assertEquals(0,s.rate,0);assertEquals(6,s.forecastRate,0);assertEquals("moderada",s.forecastLevel);assertEquals(2.5,s.amount,.00001);
  assertTrue(s.forecastRateText.contains("6,0 mm/h no início previsto"));assertFalse(s.forecastRateText.contains("agora"));assertEquals("Duração estimada: ~25 min",s.durationText);assertFalse(s.rain);
 }
 @Test public void unknownEndingNeverInventsDurationAndDryHourHasNoFutureIntensity()throws Exception{
  RainForecast.Summary s=RainForecast.summarize(input(15,120,6),now);
  assertEquals(15,s.arrivalMinutes);assertEquals(-1,s.endMinutes);assertEquals(-1,s.durationMinutes);assertEquals("Duração ainda indefinida",s.durationText);assertEquals(6,s.forecastRate,0);
  s=RainForecast.summarize(input(75,100,6),now);assertEquals("dry",s.state);assertEquals(-1,s.arrivalMinutes);assertEquals(-1,s.endMinutes);assertEquals(-1,s.durationMinutes);assertTrue(Double.isNaN(s.forecastRate));assertEquals("",s.forecastLevel);assertTrue(s.forecastRateText.contains("indisponível"));
 }
 @Test public void partialMinuteKeepsExactWindowAndRemainingDurationIsExplicit()throws Exception{
  JSONObject d=input(15,40,6);RainForecast.Summary soon=RainForecast.summarize(d,now+30000);
  assertEquals(15,soon.arrivalMinutes);assertEquals(40,soon.endMinutes);assertEquals(25,soon.durationMinutes);assertEquals(2.5,soon.amount,.00001);
  RainForecast.Summary wet=RainForecast.summarize(d.put("at",now+16*60000).put("expiresAt",now+26*60000),now+16*60000+30000);
  assertEquals("now",wet.state);assertEquals(0,wet.arrivalMinutes);assertEquals(24,wet.endMinutes);assertEquals(24,wet.durationMinutes);assertEquals("Duração restante estimada: ~24 min",wet.durationText);assertTrue(wet.forecastRateText.contains("agora"));assertEquals(2.35,wet.amount,.00001);
 }
 @Test public void shortDryPauseIsOneWindowAndVaryingRateIsNotCalledEpisodeAverage()throws Exception{
  JSONObject d=input(15,40,6);for(int i=25;i<29;i++)d.getJSONArray("forecast").getJSONObject(i).put("rate",0).put("type","no_precipitation");
  d.getJSONArray("forecast").getJSONObject(16).put("rate",12);RainForecast.Summary s=RainForecast.summarize(d,now);
  assertEquals(25,s.durationMinutes);assertEquals(40,s.endMinutes);assertEquals("Janela de chuva prevista: ~25 min",s.durationText);assertEquals(6,s.forecastRate,0);assertEquals("moderada",s.forecastLevel);assertTrue(s.forecastRateText.contains("início previsto"));assertEquals(2.2,s.amount,.00001);
 }
 @Test public void endingRequiresTenDryPointsAndModelBoundsRemainProtected()throws Exception{
  JSONObject d=input(15,115,6);RainForecast.Summary s=RainForecast.summarize(d,now);
  assertEquals(-1,s.endMinutes);assertEquals(-1,s.durationMinutes);
  d=input(15,40,6);d.getJSONArray("forecast").getJSONObject(16).put("start",now+17*60000).put("end",now+18*60000);assertNull(RainForecast.summarize(d,now));
  d=input(15,40,6);d.getJSONArray("forecast").getJSONObject(16).put("rate",-1);assertNull(RainForecast.summarize(d,now));
  d=input(15,40,6);d.getJSONArray("forecast").getJSONObject(16).put("rate",1001);assertNull(RainForecast.summarize(d,now));
 }
 @Test public void legacySummaryConstructorPreservesCurrentFieldsWithoutInventingForecasts(){
  RainForecast.Summary s=new RainForecast.Summary("now","forte","Chuva forte",8,4,"Término indefinido",now,now+600000,true);
  assertEquals(8,s.rate,0);assertEquals(4,s.amount,0);assertEquals("now:forte",s.key());assertTrue(s.rain);
  assertEquals(-1,s.arrivalMinutes);assertEquals(-1,s.endMinutes);assertEquals(-1,s.durationMinutes);assertTrue(Double.isNaN(s.forecastRate));assertEquals("Duração ainda indefinida",s.durationText);
 }

 @Test public void durationLabelAndDemoPresentationRetainEveryStructuredFact()throws Exception{
  RainForecast.Summary original=RainForecast.summarize(input(15,40,6),now),demo=original.withPresentation("moderada","Cenário fictício");
  assertEquals("Duração estimada",original.durationLabel);assertEquals("Cenário fictício",demo.title);assertEquals(original.state,demo.state);assertEquals(original.arrivalMinutes,demo.arrivalMinutes);assertEquals(original.endMinutes,demo.endMinutes);assertEquals(original.durationMinutes,demo.durationMinutes);assertEquals(original.forecastRate,demo.forecastRate,0);assertEquals(original.forecastLevel,demo.forecastLevel);assertEquals(original.forecastRateText,demo.forecastRateText);assertEquals(original.durationText,demo.durationText);assertEquals(original.durationLabel,demo.durationLabel);assertEquals(original.amount,demo.amount,0);assertEquals(original.rate,demo.rate,0);assertEquals(original.rain,demo.rain);
 }
 @Test public void interruptedSnowWindowIsNotCalledRain()throws Exception{
  JSONObject d=input(15,40,6);for(int i=15;i<40;i++)d.getJSONArray("forecast").getJSONObject(i).put("type","snow");
  for(int i=25;i<29;i++)d.getJSONArray("forecast").getJSONObject(i).put("rate",0).put("type","no_precipitation");
  RainForecast.Summary s=RainForecast.summarize(d,now);assertTrue(s.title.startsWith("Neve"));assertFalse(s.rain);assertEquals("Janela de neve prevista",s.durationLabel);assertEquals("Janela de neve prevista: ~25 min",s.durationText);
 }
}

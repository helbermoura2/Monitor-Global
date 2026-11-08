package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
public class WeatherBriefingTest {
 final long now=1800000000000L;
 String payload(String kind)throws Exception{return new JSONObject().put("version","weather-briefing-v1").put("status","ready").put("area","liberdade").put("model",WeatherBriefing.MODEL).put("kind",kind).put("generatedAt",now).put("expiresAt",now+600000).put("dataAt",now-60000).put("referenceAt",now-120000).put("rainState","soon").put("text","A previsão indica céu nublado.").toString();}
 @Test public void expiredMalformedAndPendingResponsesNeverBecomeAiText()throws Exception{String raw=payload("hourly");assertNotNull(WeatherBriefing.parse(raw,now));assertNull(WeatherBriefing.parse(raw,now+600000));assertNull(WeatherBriefing.parse(raw.replace("ready","pending"),now));assertNull(WeatherBriefing.parse(raw.replace("liberdade","other"),now));assertNull(WeatherBriefing.parse("invalid",now));}
 @Test public void acceptsActiveAndLegacyModelsOnlyDuringSafeMigration()throws Exception{
  String current=payload("hourly");
  assertNotNull(WeatherBriefing.parse(current,now));
  JSONObject legacy=new JSONObject(current).put("model",WeatherBriefing.LEGACY_MODEL);
  assertNotNull(WeatherBriefing.parse(legacy.toString(),now));
  JSONObject invented=new JSONObject(current).put("model","@cf/unknown/model");
  assertNull(WeatherBriefing.parse(invented.toString(),now));
 }
 @Test public void aiMustMatchTheActualSourceAndNotAppearOnDemoOrChangedForecast()throws Exception{WeatherBriefing b=WeatherBriefing.parse(payload("hourly"),now);WeatherForecast.Summary w=new WeatherForecast.Summary("28°C","Nublado","9 km/h","70%","",now+600000,false,"28°C","30°C","70%","9 km/h","15 km/h","Cloudy",now-60000,now-120000);assertFalse(b.forForecast(w,null,now).isEmpty());WeatherForecast.Summary demo=new WeatherForecast.Summary("28°C","Nublado","9 km/h","70%","",now+600000);assertEquals("",b.forForecast(demo,null,now));assertEquals("",b.forForecast(w,null,now+600000));}
 @Test public void rainRequiresMatchingTimestampAndPhase()throws Exception{WeatherBriefing b=WeatherBriefing.parse(payload("rain"),now);RainForecast.Summary r=new RainForecast.Summary("soon","fraca","Chuva prevista",0,2,"",now-60000,now+600000,false);assertFalse(b.forForecast(null,r,now).isEmpty());RainForecast.Summary dry=new RainForecast.Summary("dry","fraca","Sem chuva",0,0,"",now-60000,now+600000,false);assertEquals("",b.forForecast(null,dry,now));}
}

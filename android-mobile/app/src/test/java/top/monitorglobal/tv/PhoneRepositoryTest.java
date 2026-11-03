package top.monitorglobal.tv;

import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.IOException;
import java.util.*;

public class PhoneRepositoryTest {
 private final long now=1800000000000L;
 private JSONObject feed(String id)throws Exception{
  JSONObject event=new JSONObject().put("id",id).put("kind","earthquake").put("version","v1").put("title","M6,2 · Vanuatu").put("detail","Profundidade: 12 km").put("state","earthquake").put("eventTime",now-60000).put("issuedAt",now).put("eligible",true).put("magnitude",6.2).put("depth",12).put("countryCode","VU").put("source","EXEMPLO");
  return new JSONObject().put("version","tv-alerts-v1").put("policy","telegram-v1").put("serverTime",now).put("sources",new JSONObject().put("earthquake",true).put("tsunami",true)).put("alerts",new JSONArray().put(event));
 }
 private JSONObject weather()throws Exception{return new JSONObject().put("version","tv-weather-v1").put("area","liberdade").put("ok",true).put("loc",location()).put("at",now).put("generatedAt",now).put("expiresAt",now+3600000).put("current",new JSONObject().put("start",now).put("temperature",18).put("feels",19).put("humidity",92).put("wind",9).put("gust",19).put("condition","Cloudy"));}
 private JSONObject location()throws Exception{return new JSONObject().put("lat",RainForecast.LATITUDE).put("lng",RainForecast.LONGITUDE);}
 private JSONObject rain()throws Exception{JSONArray points=new JSONArray();for(int i=0;i<90;i++){boolean wet=i>=15&&i<40;points.put(new JSONObject().put("start",now+i*60000).put("end",now+(i+1)*60000).put("rate",wet?6:0).put("type",wet?"rain":"no_precipitation"));}return new JSONObject().put("version","tv-rain-v1").put("area","liberdade").put("ok",true).put("loc",location()).put("at",now).put("expiresAt",now+600000).put("forecast",points);}
 private static final class Fake implements PhoneRepository.Transport {
  final Map<String,ArrayDeque<PhoneRepository.Response>> responses=new HashMap<>();final List<String> paths=new ArrayList<>(),tags=new ArrayList<>();Runnable hook;int cancelled;
  void put(String path,int status,String body,String tag){responses.computeIfAbsent(path,k->new ArrayDeque<>()).add(new PhoneRepository.Response(status,body,tag));}
  void put(String path,JSONObject body)throws Exception{put(path,200,body.toString(),"");}
  @Override public PhoneRepository.Response get(String path,String etag,int max)throws Exception{paths.add(path);tags.add(etag);if(hook!=null){Runnable run=hook;hook=null;run.run();}ArrayDeque<PhoneRepository.Response> queue=responses.get(path);return queue==null||queue.isEmpty()?new PhoneRepository.Response(503,"",""):queue.remove();}
  @Override public void cancel(){cancelled++;}
 }
 private Fake ready()throws Exception{Fake f=new Fake();f.put(PhoneRepository.FEED,200,feed("one").toString(),"\"first\"");f.put(PhoneRepository.WEATHER,weather());f.put(PhoneRepository.RAIN,rain());return f;}
 @Test public void realContractProducesEventsAndValidatedForecastsWithoutMockFallbacks()throws Exception{
  Fake fake=ready();PhoneRepository repository=new PhoneRepository(fake);PhoneRepository.Snapshot s=repository.refresh(now);
  assertEquals(1,s.events.size());assertEquals("one",s.events.get(0).id);assertEquals("18°C",s.weather.temperatureValue);assertEquals("92%",s.weather.humidityValue);assertEquals("soon",s.rain.state);assertEquals(15,s.rain.arrivalMinutes);assertEquals(25,s.rain.durationMinutes);assertEquals(2.5,s.rain.amount,.00001);assertEquals(6,s.rain.forecastRate,0);assertFalse(s.saved);assertTrue(s.quakeOk&&s.tsunamiOk);assertEquals(3,fake.paths.size());
 }
 @Test public void unchangedFeedKeepsEventsAndDoesNotRefetchValidForecasts()throws Exception{
  Fake fake=ready();PhoneRepository repository=new PhoneRepository(fake);repository.refresh(now);fake.put(PhoneRepository.FEED,304,"","");PhoneRepository.Snapshot same=repository.refresh(now+60000);
  assertEquals(1,same.events.size());assertEquals("one",same.events.get(0).id);assertEquals("\"first\"",fake.tags.get(3));assertEquals(4,fake.paths.size());assertEquals(now+60000,same.refreshedAt);assertFalse(same.saved);assertNotNull(same.weather);assertEquals(14,same.rain.arrivalMinutes);
 }
 @Test public void malformedFeedCannotPartiallyReplacePriorEventsOrEtag()throws Exception{
  Fake fake=ready();PhoneRepository repository=new PhoneRepository(fake);repository.refresh(now);JSONObject bad=feed("replacement");bad.getJSONArray("alerts").put(new JSONObject().put("id","bad").put("kind","unexpected").put("issuedAt",now).put("eventTime",now));fake.put(PhoneRepository.FEED,200,bad.toString(),"\"bad\"");PhoneRepository.Snapshot failed=repository.refresh(now+60000);
  assertEquals("one",failed.events.get(0).id);assertTrue(failed.saved);assertEquals(now,failed.refreshedAt);assertTrue(failed.feedStatus.contains("salvos"));fake.put(PhoneRepository.FEED,304,"","");repository.refresh(now+120000);assertEquals("\"first\"",fake.tags.get(4));
 }
 @Test public void savedEventsRestoreButExpiredForecastsNeverBecomeCurrentWeather()throws Exception{
  Fake fake=ready();PhoneRepository first=new PhoneRepository(fake);first.refresh(now);String cached=first.exportCache();PhoneRepository restored=new PhoneRepository(new Fake());restored.importCache(cached,now+2*3600000);
  PhoneRepository.Snapshot s=restored.snapshot(now+2*3600000);assertEquals("one",s.events.get(0).id);assertTrue(s.saved);assertNull(s.weather);assertNull(s.rain);assertFalse(s.weatherStatus.contains("atualizado"));assertTrue(s.feedStatus.contains("salvos"));
  PhoneRepository fresh=new PhoneRepository(new Fake());fresh.importCache(cached,now+60000);assertEquals("18°C",fresh.snapshot(now+60000).weather.temperatureValue);assertEquals(14,fresh.snapshot(now+60000).rain.arrivalMinutes);
 }
 @Test public void failureBackoffAvoidsRepeatedWeatherRequestsAndManualRefreshCanRetry()throws Exception{
  Fake fake=new Fake();fake.put(PhoneRepository.FEED,feed("one"));PhoneRepository repository=new PhoneRepository(fake);PhoneRepository.Snapshot s=repository.refresh(now);assertNull(s.weather);assertNull(s.rain);assertTrue(s.rainStatus.contains("indisponível"));assertEquals(3,fake.paths.size());
  fake.put(PhoneRepository.FEED,304,"","");repository.refresh(now+60000);assertEquals(4,fake.paths.size());fake.put(PhoneRepository.FEED,304,"","");fake.put(PhoneRepository.WEATHER,weather());fake.put(PhoneRepository.RAIN,rain());s=repository.refresh(now+120000,true);assertEquals(7,fake.paths.size());assertNotNull(s.weather);assertNotNull(s.rain);
 }
 @Test public void cancellationRejectsInFlightResponsesAndCloseNeverStartsAnotherRead()throws Exception{
  Fake fake=ready();PhoneRepository repository=new PhoneRepository(fake);fake.hook=repository::cancel;PhoneRepository.Snapshot s=repository.refresh(now);assertTrue(s.events.isEmpty());assertNull(s.weather);assertEquals(1,fake.paths.size());assertEquals(1,fake.cancelled);repository.close();repository.refresh(now+1000);assertEquals(1,fake.paths.size());assertEquals(2,fake.cancelled);
 }
 @Test public void unsupportedAndOversizedDataStayUnavailableInsteadOfInventingEmptySuccess()throws Exception{
  Fake fake=new Fake();fake.put(PhoneRepository.FEED,200,feed("bad").put("policy","unknown").toString(),"x");fake.put(PhoneRepository.WEATHER,weather().put("area","somewhere"));fake.put(PhoneRepository.RAIN,rain().put("expiresAt",now-1));PhoneRepository repository=new PhoneRepository(fake);PhoneRepository.Snapshot s=repository.refresh(now);assertTrue(s.events.isEmpty());assertNull(s.weather);assertNull(s.rain);assertTrue(s.feedStatus.contains("indisponíveis"));
  char[] large=new char[PhoneRepository.FEED_LIMIT+1];Arrays.fill(large,'x');fake.put(PhoneRepository.FEED,200,new String(large),"x");s=repository.refresh(now+60000);assertTrue(s.events.isEmpty());assertFalse(s.quakeOk);
 }
 @Test public void snapshotsAreIndependentAndFutureCacheTimestampIsRejected()throws Exception{
  Fake fake=ready();PhoneRepository repository=new PhoneRepository(fake);PhoneRepository.Snapshot s=repository.refresh(now);s.events.get(0).source="modified";assertEquals("EXEMPLO",repository.snapshot(now).events.get(0).source);
  try{s.events.clear();fail("immutable event list");}catch(UnsupportedOperationException expected){}
  JSONObject cache=new JSONObject(repository.exportCache()).put("refreshedAt",now+120000);PhoneRepository restored=new PhoneRepository(new Fake());restored.importCache(cache.toString(),now);assertTrue(restored.snapshot(now).events.isEmpty());
 }
 @Test public void notModifiedWithoutACacheIsAnErrorAndUnavailableCatalogsDoNotEraseSavedData()throws Exception{
  Fake fake=new Fake();fake.put(PhoneRepository.FEED,304,"","");PhoneRepository repository=new PhoneRepository(fake);assertTrue(repository.refresh(now).feedStatus.contains("indisponíveis"));
  fake.put(PhoneRepository.FEED,feed("one"));repository.refresh(now+60000);fake.put(PhoneRepository.FEED,feed("two").put("sources",new JSONObject().put("earthquake",false).put("tsunami",false)));PhoneRepository.Snapshot s=repository.refresh(now+120000);assertEquals("one",s.events.get(0).id);assertTrue(s.saved);
 }
 @Test public void etagHeaderRejectsNewlines()throws Exception{
  assertEquals("",new PhoneRepository.Response(200,"{}","bad\r\nvalue").etag);
  try{new PhoneRepository.HttpTransport().get("https://untrusted.example", "",100);fail("route restriction");}catch(IOException expected){}
 }
}

package top.monitorglobal.tv;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class PhoneSkyObservationTest {
 private final long now=java.time.Instant.parse("2026-11-20T18:45:00Z").toEpochMilli();

 private JSONObject report(String raw,long at)throws Exception{
  return new JSONObject().put("stations",new JSONArray().put(new JSONObject()
    .put("icao","SBSP").put("raw","METAR SBSP 201845Z "+raw).put("updatedAt",at)));
 }

 @Test public void skyComesFromReportedCloudLayers()throws Exception{
  assertEquals("Poucas nuvens",PhoneSkyObservation.parse(report("FEW030",now),now).condition(now));
  assertEquals("Sol entre nuvens",PhoneSkyObservation.parse(report("SCT040",now),now).condition(now));
  assertEquals("Nublado",PhoneSkyObservation.parse(report("FEW020 BKN050",now),now).condition(now));
  assertEquals("Encoberto",PhoneSkyObservation.parse(report("OVC025",now),now).condition(now));
 }

 @Test public void staleOrMissingCloudDataNeverBecomesSunny()throws Exception{
  assertNull(PhoneSkyObservation.parse(report("SCT040",now-75*60000L),now));
  assertNull(PhoneSkyObservation.parse(report("9999 TEMPO BKN010",now),now));
  assertEquals("Sem nuvens significativas",PhoneSkyObservation.parse(report("CAVOK",now),now).condition(now));
 }
}

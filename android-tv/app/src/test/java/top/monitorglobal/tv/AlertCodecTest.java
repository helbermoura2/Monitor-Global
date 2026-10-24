package top.monitorglobal.tv;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;
public class AlertCodecTest {
 @Test public void replayRoundTripPreservesRevisionAndPairedBulletin() throws Exception {
  Alert old=DemoAlerts.create("sequence",1800000000000L).get(0),revised=DemoAlerts.create("revision",1800000000000L).get(0);revised.companion=old.companion;
  Alert restored=AlertCodec.read(new JSONObject(AlertCodec.write(revised).toString()));
  assertEquals(7.2,restored.previousMagnitude,0);assertEquals(6.9,restored.magnitude,0);assertEquals("M7,2 → M6,9",restored.revision);assertEquals(revised.issuedAt,restored.issuedAt);assertEquals("VU",restored.countryCode);
  assertNotNull(restored.companion);assertEquals("PTWC",restored.companion.source);assertEquals("warning",restored.companion.state);assertEquals(restored.id,restored.companion.relatedQuakeId);
 }
 @Test public void recursivePointersCannotCreateUnboundedHistory() throws Exception {
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0);q.companion.companion=q;
  String stored=AlertCodec.write(q).toString();assertTrue(stored.length()<24000);Alert restored=AlertCodec.read(new JSONObject(stored));assertNotNull(restored.companion);assertNull(restored.companion.companion);
 }
 @Test public void unrelatedCompanionIsNeverReplayedAsLinkedTsunami() throws Exception {
  Alert q=DemoAlerts.create("quake",1800000000000L).get(0);JSONObject stored=AlertCodec.write(q);stored.getJSONObject("companion").put("relatedQuakeId","different-quake");assertNull(AlertCodec.read(stored).companion);
 }
 @Test public void optionalFieldsRemainCompatibleWithOldFeeds() throws Exception {
  Alert a=new Alert("known","earthquake","v","M6,0 · Local","Profundidade desconhecida","earthquake",1800000000000L,1800000000000L,true);
  JSONObject stored=AlertCodec.write(a);stored.remove("magnitude");stored.remove("revision");Alert restored=AlertCodec.read(stored);assertTrue(Double.isNaN(restored.previousMagnitude));assertTrue(restored.revision.isEmpty());assertNull(restored.companion);
 }
 @Test(expected=JSONException.class) public void invalidSavedRecordIsRejected() throws Exception {AlertCodec.read(new JSONObject("{\"id\":\"\",\"kind\":\"earthquake\",\"issuedAt\":1,\"eventTime\":1}"));}
}

package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import org.json.*;
public class PhonePushPayloadTest {
 private final long now=1800000000000L;
 private JSONObject event()throws Exception{return new JSONObject().put("id","USGS:one").put("kind","earthquake").put("title","M6,2 · Exemplo").put("detail","Fonte oficial").put("state","earthquake").put("version","v1").put("issuedAt",now-1000).put("eventTime",now-1000).put("eligible",true);}
 @Test public void acceptsFreshPublicEventAndRejectsStaleOrFuture()throws Exception {assertNotNull(PhonePushPayload.parse(event().toString(),now));assertNull(PhonePushPayload.parse(event().put("issuedAt",now-3600000).toString(),now));assertNull(PhonePushPayload.parse(event().put("issuedAt",now+3600000).toString(),now));}
 @Test public void rejectsMalformedOversizedAndIneligibleQuakes()throws Exception {assertNull(PhonePushPayload.parse("{",now));assertNull(PhonePushPayload.parse(event().put("title","x".repeat(4000)).toString(),now));assertNull(PhonePushPayload.parse(event().put("eligible",false).toString(),now));assertNull(PhonePushPayload.parse(event().put("kind","other").toString(),now));}
 @Test public void endedTsunamiMayUpdateItsExistingNotification()throws Exception {assertNotNull(PhonePushPayload.parse(event().put("kind","tsunami").put("state","ended").put("eligible",false).toString(),now));}
 @Test public void stableNotificationIdentityIsBounded(){assertEquals(PhonePushPayload.tag("one"),PhonePushPayload.tag("one"));assertNotEquals(PhonePushPayload.tag("one"),PhonePushPayload.tag("two"));assertTrue(PhonePushPayload.tag("one").length()<80);}
}

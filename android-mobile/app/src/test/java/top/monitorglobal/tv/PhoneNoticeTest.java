package top.monitorglobal.tv;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;
public class PhoneNoticeTest {
 private final long now=1800000000000L;
 private JSONObject sample(String kind)throws Exception{return new JSONObject().put("schema","monitor-notice-v1").put("kind",kind).put("id",kind+":1").put("version","1").put("title","Previsão de teste").put("body","Dados fictícios somente para teste").put("issuedAt",now).put("expiresAt",now+600000);}
 @Test public void knownKindsKeepTheirIdentityWithoutASeismicRecord()throws Exception{for(String kind:new String[]{"rain","weather","daily"})assertEquals(kind,PhoneNotice.parse(sample(kind).toString(),now).kind);}
 @Test public void invalidKindsExpiredFutureAndOversizedMessagesAreRejected()throws Exception{assertNull(PhoneNotice.parse(sample("url").toString(),now));assertNull(PhoneNotice.parse(sample("rain").toString(),now+600001));assertNull(PhoneNotice.parse(sample("rain").put("issuedAt",now+120000).toString(),now));assertNull(PhoneNotice.parse(sample("rain").put("body","x".repeat(1201)).toString(),now));assertNull(PhoneNotice.parse(sample("rain").put("expiresAt",now+7200000).toString(),now));}
}

package top.monitorglobal.tv;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** CAP feed updatedAt is time of last change, not a timestamp of the latest successful read. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class DefesaCivilCapFreshnessTest {
 @Test public void officialSevereAndExtremeRemainValidWhenFeedDidNotChangeRecently()throws Exception {
  long now=System.currentTimeMillis();
  JSONArray alerts=new JSONArray()
    .put(notice("Severe",now-2*3600000L,now+3600000L))
    .put(notice("Extreme",now-3600000L,now+1800000L));
  JSONObject body=new JSONObject().put("version",1).put("source",DefesaCivilSp.SOURCE)
   .put("municipality","3550308").put("checkedAt",now-60000L)
   .put("updatedAt",now-5*3600000L).put("alerts",alerts);
  DefesaCivilSp parsed=DefesaCivilSp.parse(body,now);
  assertEquals(2,parsed.notices.size());
  assertTrue(parsed.fresh(now));
  assertEquals("Severe",parsed.notices.get(0).severity);
  assertEquals("Extreme",parsed.notices.get(1).severity);
 }
 @Test public void oldCheckStillRefusedEvenWhenAlertValidityLooksFuture()throws Exception{
  long now=System.currentTimeMillis();
  JSONObject body=new JSONObject().put("version",1).put("source",DefesaCivilSp.SOURCE)
   .put("municipality","3550308").put("checkedAt",now-25*60000L)
   .put("updatedAt",now-3600000L).put("alerts",new JSONArray()
     .put(notice("Extreme",now-3600000L,now+3600000L)));
  try{DefesaCivilSp.parse(body,now);fail("Old checkedAt must be rejected");}
  catch(org.json.JSONException expected){assertTrue(expected.getMessage().contains("defasada"));}
 }
 private JSONObject notice(String severity,long sent,long expires)throws Exception{
  return new JSONObject().put("id","cap-"+severity).put("issuer","Defesa Civil Estadual De São Paulo")
   .put("message","Aviso oficial de chuva e risco significativo para a capital.")
   .put("severity",severity).put("sent",sent).put("expires",expires);
 }
}
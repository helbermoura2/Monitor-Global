package top.monitorglobal.tv;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class DefesaCivilBrTest {
 private static final long NOW=1795465000000L;
 private static JSONObject catalogue(long checked,long updated)throws Exception{
  return new JSONObject().put("version",1)
   .put("source",DefesaCivilBr.SOURCE).put("scope","BRASIL")
   .put("checkedAt",checked).put("updatedAt",updated)
   .put("total",2).put("truncated",false).put("alerts",new JSONArray()
    .put(record("Severe","SP",NOW+90000L))
    .put(record("Extreme","RJ",NOW+120000L)));
 }
 private static JSONObject record(String severity,String area,long expires)throws Exception{
  return new JSONObject().put("id","cap-"+area).put("issuer","Defesa Civil Estadual")
   .put("message","Chuva intensa na região; siga as orientações oficiais.")
   .put("area",area).put("severity",severity).put("sent",NOW-30000L)
   .put("expires",expires);
 }
 @Test public void preservesOfficialSevereAndExtremeWithoutReclassification()throws Exception{
  DefesaCivilBr b=DefesaCivilBr.parse(catalogue(NOW-60000,NOW-90000),NOW);
  assertTrue(b.fresh(NOW));
  assertEquals(2,b.alerts.size());
  assertEquals("SEVERO",b.alerts.get(0).level());
  assertEquals("EXTREMO",b.alerts.get(1).level());
  assertEquals("RJ",b.alerts.get(1).area);
 }
 @Test public void rejectsOutdatedSnapshotRatherThanClaimNoRisk()throws Exception{
  try{
   DefesaCivilBr.parse(catalogue(NOW-25*60000,NOW-26*60000),NOW);
   fail("Stale CAP must not be accepted");
  }catch(org.json.JSONException expected){assertTrue(expected.getMessage().contains("desatualizado"));}
 }
 @Test public void doesNotDisplayExpiredOrUnknownSeverity()throws Exception{
  JSONObject doc=catalogue(NOW,NOW);
  JSONArray a=doc.getJSONArray("alerts");
  a.put(record("Moderate","XX",NOW+90000));
  a.put(record("Extreme","RS",NOW-5000));
  doc.put("total",4);
  DefesaCivilBr value=DefesaCivilBr.parse(doc,NOW);
  assertEquals(2,value.alerts.size());
 }
}
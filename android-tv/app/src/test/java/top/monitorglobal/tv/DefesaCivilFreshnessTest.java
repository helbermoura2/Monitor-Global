package top.monitorglobal.tv;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Source clocks must not silently hide a newly issued, explicitly verified CAP notice. */
public class DefesaCivilFreshnessTest {
 private JSONObject snapshot(long now,long checked,long updated,boolean withAlert)throws Exception{
  JSONObject feed=new JSONObject().put("version",1)
   .put("source",DefesaCivilSp.SOURCE).put("municipality","3550308")
   .put("checkedAt",checked).put("updatedAt",updated);
  JSONArray list=new JSONArray();
  if(withAlert)list.put(new JSONObject().put("id","official-sp-1")
    .put("issuer","Defesa Civil Estadual de São Paulo")
    .put("severity","Severe").put("message","Chuva intensa. Busque abrigo.")
    .put("sent",now-120000).put("expires",now+1800000));
  return feed.put("alerts",list);
 }
 @Test public void recentOfficialCAPStillQualifiesWhenAtomUpdatedClockLags()throws Exception{
  long now=System.currentTimeMillis();
  DefesaCivilSp valid=DefesaCivilSp.parse(snapshot(now,now,now-3*3600000L,true),now);
  assertTrue(valid.fresh(now));assertEquals(1,valid.notices.size());
 }
 @Test public void oldFeedWithNoRecentCAPIsNotAnAllClear()throws Exception{
  long now=System.currentTimeMillis();
  try{
   DefesaCivilSp.parse(snapshot(now,now,now-3*3600000L,false),now);
   fail("Old empty Atom feed must remain unavailable, not a confirmed absence");
  }catch(org.json.JSONException expected){}
 }
 @Test public void oldGithubSnapshotCannotReviveEvenNewOriginalCAP()throws Exception{
  long now=System.currentTimeMillis();
  try{
   DefesaCivilSp.parse(snapshot(now,now-20*60000L,now-3*3600000L,true),now);
   fail("An unchecked snapshot is not timely official evidence");
  }catch(org.json.JSONException expected){}
 }
}

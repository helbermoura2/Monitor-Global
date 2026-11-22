package top.monitorglobal.tv;

import android.content.Context;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Replay is only of previously displayed official notices, never a fresh alert. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class CivilReplayStoreTest {
 Context context;
 @Before public void init(){context=RuntimeEnvironment.getApplication();Prefs.get(context).edit().clear().commit();}
 @Test public void severeAndExtremeRemainSeparateAndFakeDemosNeverPersist(){
  long now=System.currentTimeMillis();
  DefesaCivilSp.Notice severe=new DefesaCivilSp.Notice("severity-1",
   "Defesa Civil Estadual de São Paulo","Alerta real de chuva intensa recebido na TV",
   "Severe",now-15000,now+60000);
  CivilReplayStore.remember(context,severe);
  assertEquals("severity-1",CivilReplayStore.last(context,"Severe").id);
  assertNull(CivilReplayStore.last(context,"Extreme"));
  DefesaCivilSp.Notice fictitious=new DefesaCivilSp.Notice("SIMULACAO-CIVIL-SP",
   "ARGOS ORBIS · DADOS FICTÍCIOS","Este é apenas um teste","Extreme",now,now+60000);
  CivilReplayStore.remember(context,fictitious);
  assertNull("Fake simulation is not a historical official event",CivilReplayStore.last(context,"Extreme"));
  DefesaCivilSp.Notice extreme=new DefesaCivilSp.Notice("severity-2",
   "Defesa Civil Estadual de São Paulo","Aviso oficial extremo de exemplo de teste unitário",
   "Extreme",now-20000,now+30000);
  CivilReplayStore.remember(context,extreme);
  assertEquals("severity-2",CivilReplayStore.last(context,"Extreme").id);
  assertEquals("severity-1",CivilReplayStore.last(context,"Severe").id);
 }
 @Test public void expiredRecordCanReplayOnlyAsHistoryUpToSevenDays()throws Exception{
  long now=System.currentTimeMillis(),sent=now-3600_000;
  JSONObject old=new JSONObject().put("id","old-severe")
   .put("issuer","Defesa Civil Estadual de São Paulo")
   .put("message","Atenção às orientações oficiais registradas no horário")
   .put("severity","Severe").put("sent",sent).put("expires",sent+600_000);
  Prefs.get(context).edit().putString("civilSpReplaySevereV1",old.toString()).commit();
  DefesaCivilSp.Notice record=CivilReplayStore.last(context,"Severe");
  assertNotNull(record);assertEquals(sent,record.sent);
  old.put("sent",now-CivilReplayStore.MAX_REPLAY_AGE_MS-10_000);
  Prefs.get(context).edit().putString("civilSpReplaySevereV1",old.toString()).commit();
  assertNull("Expired archive must not survive beyond retention",CivilReplayStore.last(context,"Severe"));
 }
 @Test public void rejectsTamperedIssuerAndSeverity()throws Exception{
  long now=System.currentTimeMillis();
  JSONObject forged=new JSONObject().put("id","unsafe")
   .put("issuer","Argos Orbis").put("message","Notícia não verificada")
   .put("severity","Severe").put("sent",now-1000).put("expires",now+60000);
  Prefs.get(context).edit().putString("civilSpReplaySevereV1",forged.toString()).commit();
  assertNull(CivilReplayStore.last(context,"Severe"));
  forged.put("issuer","Defesa Civil Estadual de São Paulo").put("severity","Extreme");
  Prefs.get(context).edit().putString("civilSpReplaySevereV1",forged.toString()).commit();
  assertNull(CivilReplayStore.last(context,"Severe"));
 }
}

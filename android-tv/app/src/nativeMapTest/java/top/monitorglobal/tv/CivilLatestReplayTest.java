package top.monitorglobal.tv;

import android.content.Context;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** All replay sources remain separate while the single "last" shortcut picks newest. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class CivilLatestReplayTest {
 private Context context;
 private long now;

 @Before public void setup(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
  now=System.currentTimeMillis();
 }

 private DefesaCivilSp.Notice cap(String id,String severity,long sent){
  return new DefesaCivilSp.Notice(id,"Defesa Civil Estadual de São Paulo",
   "Alerta real sobre chuvas fortes e risco de enxurrada. Observe as instruções oficiais.",
   severity,sent,sent+3600000L);
 }
 private TvCivilPhoneRelay.Event phone(String id,String severity,long at){
  DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(id,"Celular · não CAP",
   "Alerta Defesa Civil real: chuva forte em São Paulo com raios e granizo. Procure abrigo.",
   severity,at,at+300000L);
  return new TvCivilPhoneRelay.Event(id,n,false,at,at+300000L);
 }

 @Test public void latestShortcutSelectsMostRecentAcrossSeverityAndOrigin(){
  CivilReplayStore.remember(context,cap("sp-cap-1","Extreme",now-70000));
  CivilPhoneHistory.remember(context,phone("01234567-89ab-cdef-0123-456789abcdef","Severe",now-35000));
  CivilLatestReplay.Record r=CivilLatestReplay.last(context);
  assertNotNull(r);
  assertTrue(r.phone);
  assertEquals("Severe",r.notice.severity);
  assertEquals("01234567-89ab-cdef-0123-456789abcdef",r.notice.id);
  assertTrue(r.origin().contains("NÃO VERIFICADO VIA CAP"));
  assertEquals("sp-cap-1",CivilReplayStore.last(context,"Extreme").id);
 }

 @Test public void officialIsMostRecentWhenNewerThanPhone(){
  CivilPhoneHistory.remember(context,phone("01234567-89ab-cdef-0123-456789abcdef","Extreme",now-120000));
  CivilReplayStore.remember(context,cap("sp-cap-new","Severe",now-50000));
  CivilLatestReplay.Record r=CivilLatestReplay.last(context);
  assertNotNull(r);assertFalse(r.phone);
  assertEquals("sp-cap-new",r.notice.id);
  assertEquals("Severe",r.notice.severity);
 }

 @Test public void noSavedAlertAndSimulationNeverProduceReplay(){
  assertNull(CivilLatestReplay.last(context));
  TvCivilPhoneRelay.Event mock=phone("01234567-89ab-cdef-0123-456789abcdef","Severe",now);
  DefesaCivilSp.Notice notice=mock.notice;
  TvCivilPhoneRelay.Event simulated=new TvCivilPhoneRelay.Event(mock.id,notice,true,now,now+300000);
  CivilPhoneHistory.remember(context,simulated);
  assertNull(CivilLatestReplay.last(context));
 }
 @Test public void phoneReplayHidesSenderWithoutBreakingOldHistory(){
  String id="01234567-89ab-cdef-0123-456789abcdef";
  DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(id,"Celular não CAP",
   "Alerta severo real: tempestade e ventos fortes em São Paulo. Abrigue-se.",
   "Severe",now,now+300000L);
  TvCivilPhoneRelay.Event e=new TvCivilPhoneRelay.Event(id,n,false,now,now+300000L,
    "Nothing Phone 1","Galaxy S25 Ultra",now,now+1500,now-400,now+700);
  CivilPhoneHistory.remember(context,e);
  assertEquals("Nothing Phone 1",CivilPhoneHistory.firstDevice(context,"Severe",id));
  DefesaCivilSp.Notice saved=CivilLatestReplay.last(context).notice;
  TvBroadcastInfoView replay=TvBroadcastInfoView.civilPhoneReplay(context,saved);
  assertFalse(String.valueOf(replay.getContentDescription()).contains("Nothing Phone 1"));
  assertTrue(replay.civilIsReplay());
  assertFalse(replay.civilIsSimulation());
 }
 @Test public void expiredOfficialStillReplayableForSevenDays(){
  CivilReplayStore.remember(context,cap("cap-short","Severe",now-35000));
  // Official can expire after being saved, but historical replay stays available.
  assertNotNull(CivilLatestReplay.last(context));
 }
}

package top.monitorglobal.tv;

import android.content.Context;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import static org.junit.Assert.*;

/** Emergency replay must NEVER turn phone-origin capture into CAP confirmation. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class CivilPhoneHistoryTest {
 private Context context;

 @Before public void setup(){
  context=RuntimeEnvironment.getApplication();
  Prefs.get(context).edit().clear().commit();
 }

 private TvCivilPhoneRelay.Event event(String id,String level,String text,boolean test,long at){
  DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(id,
    "Celular Argos Orbis (não verificado via CAP)",text,level,at,at+300000);
  return new TvCivilPhoneRelay.Event(id,n,test,at,at+300000);
 }

 @Test public void acceptsActualPhoneCapturedSevereButNotSimulation(){
  long now=System.currentTimeMillis();
  String id="01234567-89ab-cdef-0123-456789abcdef";
  String text="Alerta severo Defesa Civil: chuva e granizo em São Paulo. Busque abrigo.";
  assertFalse(CivilPhoneHistory.eligible(event(id,"Severe",text,true,now),now));
  CivilPhoneHistory.remember(context,event(id,"Severe",text,true,now));
  assertNull(CivilPhoneHistory.last(context,"Severe"));
  CivilPhoneHistory.remember(context,event(id,"Severe",text,false,now));
  DefesaCivilSp.Notice saved=CivilPhoneHistory.last(context,"Severe");
  assertNotNull(saved);
  assertEquals(id,saved.id);
  assertEquals(text,saved.message);
  assertTrue(saved.issuer.contains("NÃO VERIFICADO VIA CAP"));
  assertEquals(now,Prefs.get(context).getLong("civilPhoneLastReceivedAt",0));
  assertNull("Never mutate official replay store",CivilReplayStore.last(context,"Severe"));
 }

 @Test public void separateSevereAndExtremeAndRejectOldOrMalformed(){
  long now=System.currentTimeMillis();
  String severe="01234567-89ab-cdef-0123-456789abcde0";
  String extreme="01234567-89ab-cdef-0123-456789abcde1";
  String message="Alerta extremo Defesa Civil: chuva intensa. Busque abrigo imediato.";
  CivilPhoneHistory.remember(context,event(severe,"Severe",message,false,now));
  CivilPhoneHistory.remember(context,event(extreme,"Extreme",message,false,now));
  assertEquals(severe,CivilPhoneHistory.last(context,"Severe").id);
  assertEquals(extreme,CivilPhoneHistory.last(context,"Extreme").id);
  assertFalse(CivilPhoneHistory.eligible(event("bad-id","Extreme",message,false,now),now));
  assertFalse(CivilPhoneHistory.eligible(event(severe,"Severe",message,false,now-6*60000L),now));
  assertEquals(severe,CivilPhoneHistory.last(context,"Severe").id);
 }

 @Test public void phoneReplayShowsHistoricAndUnverifiedEvenWithOriginalText(){
  long now=System.currentTimeMillis(),until=now+300000;
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice(
    "01234567-89ab-cdef-0123-456789abcdef",
    "Capturado no celular · NÃO VERIFICADO VIA CAP",
    "Alerta severo Defesa Civil: chuva na Zona Leste de São Paulo. Busque abrigo.",
    "Severe",now,until);
  TvBroadcastInfoView view=TvBroadcastInfoView.civilPhoneReplay(context,notice);
  assertTrue(view.civilIsReplay());
  assertFalse(view.civilIsSimulation());
  String description=String.valueOf(view.getContentDescription());
  assertTrue(description,description.contains("REPLAY HISTÓRICO"));
  assertTrue(description,description.contains("NÃO VERIFICADO VIA CAP"));
  assertTrue(description,description.contains("NÃO É AVISO ATUAL"));
 }
}

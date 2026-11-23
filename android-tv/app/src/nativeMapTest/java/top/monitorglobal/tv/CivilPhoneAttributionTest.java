package top.monitorglobal.tv;

import android.content.Context;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Relay provenance is optional for older phones and never a CAP attestation. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class CivilPhoneAttributionTest {
 @Test public void validatesOnlyKnownLabelsAndRetainsServerOrder(){
  assertEquals("Galaxy S25 Ultra",TvCivilPhoneRelay.safeName("Galaxy S25 Ultra"));
  assertEquals("Nothing Phone 1",TvCivilPhoneRelay.safeName("Nothing Phone 1"));
  assertEquals("Celular sem identificação",TvCivilPhoneRelay.safeName("Samsung 123\nADMIN"));
  long now=System.currentTimeMillis();
  DefesaCivilSp.Notice n=new DefesaCivilSp.Notice(
   "01234567-89ab-cdef-0123-456789abcdef","CELULAR · NÃO VERIFICADO VIA CAP",
   "Alerta severo Defesa Civil: chuva intensa nas regiões da capital de São Paulo.",
   "Severe",now,now+300000);
  TvCivilPhoneRelay.Event event=new TvCivilPhoneRelay.Event(n.id,n,false,now,now+300000,
   "Nothing Phone 1","Galaxy S25 Ultra",now,now+1500,now-400,now+800);
  assertEquals("Nothing Phone 1",event.firstDevice);
  assertEquals("Galaxy S25 Ultra",event.secondDevice);
  assertEquals(1500L,event.secondReceivedAt-event.firstReceivedAt);
  assertFalse(event.test);
 }
 @Test public void bannerNamesTheFirstPhoneButRetainsNonCapWarning(){
  Context c=RuntimeEnvironment.getApplication();
  long now=System.currentTimeMillis();
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice(
   "01234567-89ab-cdef-0123-456789abcdef","Celular, não CAP",
   "Alerta severo Defesa Civil: chuva intensa nas regiões da capital de São Paulo.",
   "Severe",now,now+300000);
  TvBroadcastInfoView v=TvBroadcastInfoView.civilPhone(c,notice,false,"Nothing Phone 1");
  String label=String.valueOf(v.getContentDescription());
  assertTrue(label,label.contains("Nothing Phone 1"));
  assertTrue(label,label.contains("NÃO VERIFICADA VIA CAP"));
  assertFalse(v.civilIsReplay());
 }
}

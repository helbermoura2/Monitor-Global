package top.monitorglobal.tv;

import android.content.Context;
import java.lang.reflect.Field;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** TV factual ticker and tsunami status never duplicate the main strip. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class SeismicFooterTest {
 private static Object field(Object obj,String field)throws Exception{
  Field f=obj.getClass().getDeclaredField(field);f.setAccessible(true);return f.get(obj);
 }
 @Test public void quakeFooterContainsProvenanceNotHeadlineDepthOrSource(){
  Alert quake=new Alert("USGS:us0123","earthquake","v","M6,5 · Vanuatu região",
   "Profundidade: 598 km · USGS","earthquake",1800000000000L,1800000000000L,true);
  quake.source="USGS";quake.magnitude=6.5;quake.depth=598;
  quake.originLatitude=-17.30;quake.originLongitude=167.40;
  String footer=SeismicFooter.forEvent(quake,false,true,false,"",false);
  assertTrue(footer,footer.contains("17,30° S / 167,40° L"));
  assertTrue(footer,footer.contains("REGISTRO · USGS:us0123"));
  assertTrue(footer,footer.contains("REGISTRO HISTÓRICO"));
  assertFalse(footer,footer.contains("M6,5"));
  assertFalse(footer,footer.contains("598 km"));
  assertFalse(footer,footer.contains("Vanuatu região"));
  assertFalse(footer,footer.contains("SEM AMEAÇA"));
 }
 @Test public void unknownTsunamiStateIsNotInventedAsSafe(){
  Alert noBulletin=new Alert("USGS:quake","earthquake","","M6,1 · local",
   "Profundidade: 10 km · USGS","earthquake",1800000000000L,1800000000000L,true);
  String footer=SeismicFooter.forEvent(noBulletin,false,false,false,"",false);
  assertFalse(footer,footer.toUpperCase().contains("SEM AMEAÇA"));
  assertFalse(footer,footer.contains("BOLETIM ASSOCIADO"));
 }
 @Test public void officialNoThreatIsDisplayedOnceInMainPageOnly()throws Exception{
  Context c=RuntimeEnvironment.getApplication();
  Alert notice=new Alert("PTWC:brief1","tsunami","v","Costas de Vanuatu",
   "Sem ameaça segundo o boletim · PTWC","noThreat",
   1800000000000L,1800000000000L,true);
  notice.source="PTWC";notice.targetArea="Costas de Vanuatu";
  NewsBannerView view=new NewsBannerView(c,notice,false,false);
  Object page=((Object[])field(view,"pages"))[0];
  assertEquals("SEM AMEAÇA · COSTAS CITADAS",field(page,"first"));
  assertFalse(String.valueOf(field(page,"caption")).contains("SEM AMEAÇA"));
  String footer=String.valueOf(field(view,"ticker"));
  assertFalse(footer,footer.contains("SEM AMEAÇA"));
  assertTrue(footer,footer.contains("COSTAS CITADAS"));
  assertTrue(footer,footer.contains("OUTRAS COSTAS"));
  assertTrue(String.valueOf(view.getContentDescription()).contains(notice.detail));
 }
 @Test public void realWarningIsStillExplicitOnMainStrip()throws Exception{
  Alert notice=new Alert("PTWC:brief2","tsunami","v","Costas de Fiji",
   "Aviso oficial · PTWC","warning",1800000000000L,1800000000000L,true);
  NewsBannerView view=new NewsBannerView(RuntimeEnvironment.getApplication(),notice,false,false);
  Object page=((Object[])field(view,"pages"))[0];
  assertEquals("AVISO DE TSUNAMI",field(page,"first"));
  assertTrue(String.valueOf(field(view,"ticker")).contains("AUTORIDADE EMISSORA"));
 }
 @Test public void eachPairedPageGetsItsOwnUnrepeatedFooter()throws Exception{
  Context c=RuntimeEnvironment.getApplication();
  Alert quake=new Alert("USGS:quake","earthquake","v","M6,5 · Vanuatu",
   "Profundidade: 10 km · USGS","earthquake",1800000000000L,1800000000000L,true);
  quake.originLatitude=-17.1;quake.originLongitude=167.8;quake.magnitude=6.5;
  Alert tsunami=new Alert("PTWC:brief","tsunami","v","Costas de Vanuatu",
   "Aviso oficial · PTWC","warning",1800000000000L,1800000000000L,true);
  tsunami.source="PTWC";tsunami.relatedQuakeId=quake.id;quake.companion=tsunami;
  NewsBannerView view=new NewsBannerView(c,quake,false,false);
  String[] footers=(String[])field(view,"pageTickerDisplays");
  assertEquals(2,footers.length);
  assertNotEquals(footers[0],footers[1]);
  assertFalse(footers[0].contains("Profundidade"));
  assertTrue(footers[1].contains("AUTORIDADE EMISSORA"));
 }
}

package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;

/** Guard against restoring the old public footer during the rebrand. */
public final class TvBrandTest {
 @Test public void publicBrandUsesNewDomainWithoutInventingTelegramUsername() {
  assertEquals("ARGOS ORBIS", TvBrand.NAME);
  assertEquals("argosorbis.com.br", TvBrand.SITE);
  assertEquals("TELEGRAM · ARGOS ORBIS", TvBrand.TELEGRAM);
  assertFalse(TvBrand.TELEGRAM.contains("@"));
 }
}

package top.monitorglobal.tv;
import org.junit.Test;
import static org.junit.Assert.*;

/** Guard against restoring the old public footer during the rebrand. */
public final class TvBrandTest {
 @Test public void publicBrandUsesVerifiedTelegramUsername() {
  assertEquals("ARGOS ORBIS", TvBrand.NAME);
  assertEquals("argosorbis.com.br", TvBrand.SITE);
  assertEquals("@argosorbis", TvBrand.TELEGRAM);
  assertEquals("https://t.me/argosorbis", TvBrand.TELEGRAM_URL);
 }
}

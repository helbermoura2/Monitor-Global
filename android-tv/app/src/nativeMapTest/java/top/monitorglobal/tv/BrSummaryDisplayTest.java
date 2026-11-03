package top.monitorglobal.tv;
import java.time.Instant;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class BrSummaryDisplayTest {
 private Object field(Object object,String name)throws Exception{java.lang.reflect.Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 @Test public void automaticSummaryAndReplayBothFormatCaptionAndTickerInBrazilianOrder()throws Exception{
  Locale locale=Locale.getDefault();TimeZone timezone=TimeZone.getDefault();
  try{Locale.setDefault(Locale.US);TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
   long at=Instant.parse("2026-10-30T18:00:00Z").toEpochMilli();
   Alert alert=new Alert("date-test","earthquake","new","M5,1 · Balleny região das ilhas","Profundidade: 10 km · USGS","earthquake",at,at,false);
   for(boolean replay:new boolean[]{false,true}){
    NewsBannerView view=new NewsBannerView(RuntimeEnvironment.getApplication(),List.of(alert),"2026-10-30",replay,true);
    assertEquals(replay?"REPLAY":"AO VIVO",view.badgeLabel());
    Object page=((Object[])field(view,"pages"))[0];
    String caption=(String)field(page,"caption"),ticker=(String)field(view,"ticker");
    assertTrue(caption,caption.contains("30/10/2026"));assertFalse(caption,caption.contains("2026-10-30"));
    assertTrue(ticker,ticker.contains("30/10/2026"));assertFalse(ticker,ticker.contains("2026-10-30"));
    assertTrue(ticker,ticker.contains("HISTÓRICO · Não informa a situação atual de tsunami"));
    assertTrue(caption,caption.contains(replay?"REPLAY DO RESUMO":"RESUMO"));
   }
  }finally{Locale.setDefault(locale);TimeZone.setDefault(timezone);}
 }
}

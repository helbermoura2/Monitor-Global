package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import org.junit.*;import static org.junit.Assert.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class MarketBannerTest {
 @Test public void independentMarketLabelsAndNoInventedPricesRender()throws Exception{
  Context c=RuntimeEnvironment.getApplication();Prefs.get(c).edit().clear().commit();long now=System.currentTimeMillis();
  BrentQuote b=new BrentQuote(78.35,77.5,.85,1.1,now-60000,"Yahoo Finance");DollarQuote d=new DollarQuote(5.23,.01,.19,now-60000,"Yahoo Finance");
  for(boolean missing:new boolean[]{false,true}){
   TvBroadcastInfoView v=TvBroadcastInfoView.market(c,missing?null:b,missing?null:d,new MarketState(MarketState.CLOSED,"Fechado segundo a fonte"),new MarketState(MarketState.OPEN,"Estado informado pelo Yahoo Finance"),false);
   String text=v.getContentDescription().toString();assertTrue(text.contains("BRENT · FECHADO"));assertTrue(text.contains("DÓLAR USD/BRL · ABERTO"));if(missing)assertTrue(text.contains("sem cotação confirmada"));else assertTrue(text.contains("última conhecida"));
   v.layout(0,0,960,126);v.startPresentation(android.os.SystemClock.uptimeMillis()-1000,false);Bitmap image=Bitmap.createBitmap(960,126,Bitmap.Config.ARGB_8888);v.draw(new Canvas(image));try(java.io.FileOutputStream out=new java.io.FileOutputStream("/tmp/monitor-tv-banner-market-"+(missing?"missing":"states")+".png")){image.compress(Bitmap.CompressFormat.PNG,100,out);}image.recycle();
  }
 }
}

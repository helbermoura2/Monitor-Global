package top.monitorglobal.tv;

import android.content.Context;
import android.widget.TextView;
import android.view.View;
import android.view.ViewGroup;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.util.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w1280dp-h720dp-land-hdpi")
public class RadarLegendTest {
 @Test public void scaleAndRasterUseSameBand(){
  assertEquals(RadarIntensity.UNKNOWN,RadarIntensity.band(-99f));
  assertEquals(RadarIntensity.UNKNOWN,RadarIntensity.band(Float.NaN));
  assertEquals(RadarIntensity.BELOW_SCALE,RadarIntensity.band(4.99f));
  int[] edges={5,15,25,35,45,55,65};
  for(int i=0;i<edges.length;i++){
   assertEquals(i,RadarIntensity.band(edges[i]));
   assertEquals(RadarIntensity.color(i),RadarMapRender.color(edges[i],0,0));
   assertTrue(RadarIntensity.label(i).startsWith(String.valueOf(edges[i])));
  }
  assertNotEquals(RadarMapRender.color(Float.NaN,0,0),RadarMapRender.color(0f,0,0));
  assertEquals("mm/h indisponível",RadarIntensity.rainRate());
  assertEquals("Acumulado indisponível",RadarIntensity.accumulation());
  assertEquals(2.5,RadarIntensity.accumulate(10,900000),0.00001);
  assertTrue(Double.isNaN(RadarIntensity.accumulate(Double.NaN,900000)));
  assertTrue(Double.isNaN(RadarIntensity.accumulate(10,0)));
 }
 @Test public void legendShowsActualSourceAgeAndUnavailableNotDry(){
  Context c=RuntimeEnvironment.getApplication();
  RadarLegend legend=new RadarLegend(c);
  long now=1800000000000L;
  RadarMapClient.Frame f=new RadarMapClient.Frame(now-28*60000L,Collections.singletonList("São Roque"),Collections.emptyList());
  legend.update(f,now);String t=text(legend);
  assertTrue(t.contains("OBSERVADO"));assertTrue(t.contains("INPE / DECEA"));assertTrue(t.contains("São Roque"));
  assertTrue(t.contains("há 28 min"));assertTrue(t.contains("mm/h indisponível"));assertTrue(t.contains("sem dado confirmado"));
  legend.update(f,now+40*60000L);assertTrue(text(legend).contains("DADO VENCIDO"));
  legend.update(null,now);assertTrue(text(legend).contains("indisponível"));assertTrue(text(legend).contains("Não equivale a ausência de chuva"));
 }
 private String text(View v){
  if(v instanceof TextView)return ((TextView)v).getText().toString();
  StringBuilder b=new StringBuilder();if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)b.append(text(g.getChildAt(i))).append(' ');}return b.toString();
 }
}

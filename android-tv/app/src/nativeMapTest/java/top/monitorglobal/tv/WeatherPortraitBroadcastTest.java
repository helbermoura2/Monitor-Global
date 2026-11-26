package top.monitorglobal.tv;
import android.graphics.*;
import android.content.Context;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w960dp-h540dp-land-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WeatherPortraitBroadcastTest {
 @Test public void aspectRatioRemainsPhysicalAcrossTvScales(){
  for(float sx:new float[]{.8f,1f,1.8f,2f})for(float sy:new float[]{.8f,1f,1.2f,2f}){
   float h=226*sy,w=TvBroadcastInfoView.portraitWidth(h,sx)*sx;
   assertEquals(.8f,w/h,.0001f);
   assertEquals(OledNewsChrome.RIGHT,OledNewsChrome.RIGHT-TvBroadcastInfoView.portraitWidth(h,sx)+TvBroadcastInfoView.portraitWidth(h,sx),.001f);
  }
 }
 private WeatherSatelliteClient.Frame frame(long time,WeatherSatelliteClient.Source source){
  return new WeatherSatelliteClient.Frame(Bitmap.createBitmap(48,48,Bitmap.Config.ARGB_8888),null,time,WeatherSatelliteSequence.RADAR_REGION,Collections.singletonList(time),source);
 }
 @Test public void observationsAlternateChronologicallyAndNeverMixSources(){
  long now=System.currentTimeMillis();
  WeatherSatelliteClient.Frame older=frame(now-35*60000L,WeatherSatelliteClient.Source.REALEARTH),sat=frame(now-25*60000L,WeatherSatelliteClient.Source.REALEARTH);
  WeatherSatelliteClient.Frame radar=WeatherSatelliteClient.Frame.radar(Bitmap.createBitmap(48,48,Bitmap.Config.ARGB_8888),new RadarMapClient.Frame(now-20*60000L,Collections.singletonList("Pico do Couto"),Collections.emptyList()),WeatherSatelliteSequence.RADAR_REGION);
  sat.previousObserved=older;radar.alternate=sat;
  try{
   assertSame(radar,WeatherSatelliteSequence.displayFrame(radar,1000,now));
   assertSame(older,WeatherSatelliteSequence.displayFrame(radar,6000,now));
   assertSame(sat,WeatherSatelliteSequence.displayFrame(radar,9000,now));
   assertSame(older,WeatherSatelliteSequence.displayFrame(sat,1000,now));
   assertSame(sat,WeatherSatelliteSequence.displayFrame(sat,4000,now));
   assertNull(WeatherSatelliteSequence.displayFrame(radar,9000,now+180*60000L));
   older.close();sat.previousObserved=frame(now-35*60000L,WeatherSatelliteClient.Source.NASA);
   assertSame(sat,WeatherSatelliteSequence.displayFrame(radar,6000,now));
  }finally{radar.close();}
  assertTrue(radar.image.isRecycled());assertTrue(sat.image.isRecycled());assertTrue(older.image.isRecycled());
 }
 @Test public void stateGeometryUsesProjectAssetAndVisibleRegionalProjection(){
  Context c=RuntimeEnvironment.getApplication();assertNotNull(BrazilGeoStates.load(c));
  InfraredPlan.Scope scope=WeatherSatelliteSequence.RADAR_REGION;
  Bitmap b=Bitmap.createBitmap(InfraredPlan.WIDTH,scope.height,Bitmap.Config.ARGB_8888);
  try{WeatherBroadcastCartography.states(c,new Canvas(b),scope);int count=0;for(int y=0;y<b.getHeight();y+=2)for(int x=0;x<b.getWidth();x+=2)if(Color.alpha(b.getPixel(x,y))>0)count++;assertTrue(count>1000);}finally{b.recycle();}
 }
}

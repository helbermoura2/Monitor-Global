package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;import java.util.*;
public class SatellitePlanTest {
 @Test public void epicentersAreCoveredWithAtMostSixTiles(){for(double lon:new double[]{-179.9,-46,0,166,179.9})for(double lat:new double[]{-70,-15,0,35,70}){MapFrame f=MapFrame.epicenter(lon,lat);List<SatellitePlan.Tile> ts=SatellitePlan.tiles(f);assertFalse(ts.isEmpty());assertTrue(ts.size()<=6);double w=999,e=-999,n=-90,s=90;for(SatellitePlan.Tile t:ts){w=Math.min(w,t.west);e=Math.max(e,t.east);n=Math.max(n,t.north);s=Math.min(s,t.south);assertTrue(t.x>=0&&t.x<(1<<t.z));}assertTrue(w<=f.west);assertTrue(e>=f.east);assertTrue(n>=f.north);assertTrue(s<=f.south);}}
 @Test public void mercatorRowsRoundTrip(){for(int z=0;z<=7;z++)for(double lat:new double[]{-80,-15,0,30,80})assertEquals(lat,SatellitePlan.latitude(SatellitePlan.row(lat,1<<z),1<<z),1e-8);}
 @Test public void unsupportedPolarFramesUseOfflineMap(){assertTrue(SatellitePlan.tiles(MapFrame.epicenter(10,89)).isEmpty());assertTrue(SatellitePlan.tiles(new MapFrame(0,0,0,0)).isEmpty());}
 @Test public void regionalFrameStaysBounded(){assertTrue(SatellitePlan.tiles(new MapFrame(120,290,-60,60)).size()<=6);}
}

package top.monitorglobal.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class RegionalReplayDetailsTest {
 private Alert alert(){
  Alert a=new Alert("id1","earthquake","v1","M5,3 · Costa do Chile","",
    "active",1762600000000L,1762600000000L,true);
  a.compact=true;a.targetArea="Costa do Pacífico Sul";
  a.magnitude=5.3;a.depth=28;a.provider="USGS";
  return a;
 }
 @Test public void descriptionIsTruthfulAndDoesNotAdvertiseInAppVideo(){
  Alert a=alert();
  assertTrue(RegionalReplayDetails.eligible(a));
  assertTrue(RegionalReplayDetails.detail(a).contains("SOBRE o vídeo"));
  assertTrue(RegionalReplayDetails.detail(a).contains("10 segundos"));
  assertTrue(RegionalReplayDetails.detail(a).contains("USGS"));
  assertTrue(RegionalReplayDetails.summary(a).contains("M5,3"));
 }
 @Test public void missingOrIneligibleNeverClaimsReplay(){
  assertFalse(RegionalReplayDetails.eligible(null));
  assertTrue(RegionalReplayDetails.detail(null).contains("não busca sismos históricos"));
  Alert a=alert();a.depth=91;
  assertFalse(RegionalReplayDetails.eligible(a));
  a.depth=28;a.magnitude=6.2;
  assertFalse(RegionalReplayDetails.eligible(a));
  a.magnitude=5.5;a.targetArea="";
  assertFalse(RegionalReplayDetails.eligible(a));
 }
}

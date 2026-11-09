package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
public class ReplaySelectionTest {
 private Alert quake(String id,long origin,long update){return new Alert(id,"earthquake","v","M6,0 · Local","USGS","earthquake",update,origin,true);}
 @Test public void newerOriginWinsEvenIfOldEventWasRevisedLater(){Alert remote=quake("new",200,201),old=quake("old",100,300);assertSame(remote,ReplaySelection.latest(remote,old));}
 @Test public void newerRevisionWinsForSameOrigin(){Alert remote=quake("same",200,201),local=quake("same",200,220);assertSame(local,ReplaySelection.latest(remote,local));}
 @Test public void offlineAndFirstUseRemainExplicit(){Alert local=quake("saved",100,101);assertSame(local,ReplaySelection.latest(null,local));assertSame(local,ReplaySelection.latest(local,null));assertNull(ReplaySelection.latest(null,null));}

 @Test public void brazilReplayAcceptsMagnitudeUnderTwoAndExcludesGlobalOrStale(){
  long now=100L*3600000;
  Alert br=quake("lajedo",now-38*3600000,now-38*3600000);br.countryCode="br";br.magnitude=1.8;
  Alert world=quake("van",now-2000,now-2000);world.magnitude=7;world.countryCode="";
  Alert expired=quake("old",now-73*3600000,now-73*3600000);expired.countryCode="br";expired.magnitude=1.1;
  assertSame(br,ReplaySelection.scoped(br,"brazil-replay",now));
  assertNull(ReplaySelection.scoped(world,"brazil-replay",now));
  assertNull(ReplaySelection.scoped(expired,"brazil-replay",now));
  assertSame(world,ReplaySelection.scoped(world,"global-replay",now));
  assertNull(ReplaySelection.scoped(br,"global-replay",now));
 }
 @Test public void globalReplayRejectsLowMagnitudeAndNeverCrossesBrazilBoundary(){
  long now=100L*3600000;
  Alert low=quake("m5",now-2000,now-2000);low.magnitude=5.9;
  Alert brStrong=quake("br",now-2000,now-2000);brStrong.magnitude=6.8;brStrong.countryCode="br";
  assertNull(ReplaySelection.scoped(low,"global-replay",now));
  assertNull(ReplaySelection.scoped(brStrong,"global-replay",now));
 }
}

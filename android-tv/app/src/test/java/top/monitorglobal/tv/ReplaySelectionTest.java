package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
public class ReplaySelectionTest {
 private Alert quake(String id,long origin,long update){return new Alert(id,"earthquake","v","M6,0 · Local","USGS","earthquake",update,origin,true);}
 @Test public void newerOriginWinsEvenIfOldEventWasRevisedLater(){Alert remote=quake("new",200,201),old=quake("old",100,300);assertSame(remote,ReplaySelection.latest(remote,old));}
 @Test public void newerRevisionWinsForSameOrigin(){Alert remote=quake("same",200,201),local=quake("same",200,220);assertSame(local,ReplaySelection.latest(remote,local));}
 @Test public void offlineAndFirstUseRemainExplicit(){Alert local=quake("saved",100,101);assertSame(local,ReplaySelection.latest(null,local));assertSame(local,ReplaySelection.latest(local,null));assertNull(ReplaySelection.latest(null,null));}
}

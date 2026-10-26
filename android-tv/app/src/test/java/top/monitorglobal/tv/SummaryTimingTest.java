package top.monitorglobal.tv;
import org.junit.Test;import static org.junit.Assert.*;
public class SummaryTimingTest {
 @Test public void everyQuakeHasSixSecondsFullyVisibleOutsideTransitions(){
  for(int index=0;index<5;index++){
   long fullStart=index*(BannerTimeline.SUMMARY_PAGE_MS+BannerTimeline.PAGE_FADE_MS);
   assertEquals(index,BannerTimeline.summaryPage(fullStart,5,true));
   assertEquals(index,BannerTimeline.summaryPage(fullStart+5999,5,true));
   if(index>0)assertTrue(BannerTimeline.summaryFadeElapsed(fullStart,index)>=650);
   if(index<4){long next=fullStart+6000;assertEquals(index+1,BannerTimeline.summaryPage(next,5,true));assertEquals(0,BannerTimeline.summaryFadeElapsed(next,index+1));}
  }
 }
 @Test public void fifthGetsFullSixSecondsBeforeExitAndOpeningDoesNotEatFirstHold(){
  long lastStart=4*(6000+650),exitStart=BannerTimeline.summaryContentDuration(5,true);
  assertEquals(6000,exitStart-lastStart);assertEquals(32600,exitStart);
  assertEquals(0,BannerTimeline.summaryElapsed(699,true));assertEquals(6000,BannerTimeline.summaryElapsed(6700,true));
  assertEquals(34000,BannerTimeline.summaryTotalDuration(5,true));assertEquals(30000,BannerTimeline.summaryTotalDuration(5,false));
 }
 @Test public void oneItemAndReducedMotionHaveNoExtraPageTransition(){
  assertEquals(7400,BannerTimeline.summaryTotalDuration(1,true));assertEquals(0,BannerTimeline.summaryTotalDuration(0,true));
  for(int index=0;index<5;index++){assertEquals(index,BannerTimeline.summaryPage(index*6000,5,false));assertEquals(index,BannerTimeline.summaryPage(index*6000+5999,5,false));}
 }
}

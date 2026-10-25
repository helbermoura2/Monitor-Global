package top.monitorglobal.tv;
import java.util.*;
public class BannerTimelineCheck {
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);}
 public static void main(String[] args){
  List<Alert> demo=DemoAlerts.create("sequence",1800000000000L);Alert q=demo.get(0),t=q.companion;
  check(BannerTimeline.page(7999,2)==0&&BannerTimeline.page(8000,2)==1&&BannerTimeline.page(16000,2)==0&&BannerTimeline.page(24000,2)==1,"8-second pages must repeat deterministically");
  check(BannerTimeline.progress(0)==0&&BannerTimeline.progress(360)==1&&BannerTimeline.progress(180)>.49f&&BannerTimeline.progress(180)<.51f,"Transition must be smooth and bounded");
  check(BannerTimeline.durationMillis(q,20)==32000&&BannerTimeline.durationMillis(demo.get(1),20)==20000,"Combined presentation must complete two cycles");
  check(BannerTimeline.magnitudeChanged(demo.get(1)),"Revision must expose previous/current magnitude to drawing");
  check(AlertPairing.coalesce(List.of(q,t)).size()==1,"Paired bulletin must not be announced twice in the same batch");
  Alert other=t.copy();other=new Alert("other","tsunami","v","Other coast","PTWC","warning",t.issuedAt,t.eventTime,true);other.relatedQuakeId=q.id;
  check(AlertPairing.coalesce(List.of(q,t,other)).size()==2,"Another official product must remain independent");
  Alert ending=demo.get(2);check(AlertPairing.updates(q,ending),"An ending must replace a currently rotating warning immediately");
  Alert a=q.copy();AlertPairing.attach(List.of(a),List.of(q,t),true,true);check(a.companion!=null,"Precise ID association must pair");
  Alert offline=q.copy();AlertPairing.attach(List.of(offline),List.of(q,t),true,false);check(offline.companion==null,"Unavailable source must not create a pair");
  Alert cleared=q.copy();AlertPairing.attach(List.of(cleared),List.of(q,ending),true,true);check(cleared.companion==null,"An ended bulletin must not be paired as an active threat");
  Alert unrelated=t.copy();unrelated.relatedQuakeId="different";Alert missing=q.copy();AlertPairing.attach(List.of(missing),List.of(q,unrelated),true,true);check(missing.companion==null,"No geographic or textual guess may create a pair");
  Alert waiting=q.copy();waiting.companion=t.copy();AlertPairing.refreshQueuedCompanions(List.of(waiting),List.of(q,ending),true,true);check(waiting.companion.state.equals("ended")&&waiting.tsunamiSummary.isEmpty(),"Queued presentations must not revive a warning after cancellation");
  check(AlertPairing.replacesQueued(q,t),"A combined quake must replace an older pending copy of its same bulletin");
  check(!AlertPairing.replacesQueued(other,q),"A separate regional product must not discard the quake and its other bulletin");
  Alert noThreat=DemoAlerts.create("noThreat",1800000000000L).get(0);Alert target=q.copy();AlertPairing.attach(List.of(target),List.of(q,noThreat),true,true);check(target.companion!=null&&target.companion.state.equals("noThreat"),"Explicit no-threat bulletin must pair with its quake");
  Alert mixed=q.copy();AlertPairing.attach(List.of(mixed),List.of(q,t,noThreat),true,true);check(mixed.companion.state.equals("warning"),"A separate no-threat region must never hide a warning");
  check(BannerTimeline.pageProgress(0)==0&&BannerTimeline.pageProgress(650)==1&&BannerTimeline.pageProgress(325)>.49f&&BannerTimeline.pageProgress(325)<.51f,"Vertical transition must be smooth and finish in 650ms");
  check(noThreat.quietInformation()&&!q.quietInformation(),"Only the no-threat update suppresses its sound, not a real quake");
  check(BannerTimeline.summaryDuration(5)==30000&&BannerTimeline.summaryDuration(3)==18000&&BannerTimeline.summaryDuration(9)==30000&&BannerTimeline.summaryDuration(0)==0,"Daily summary must use six seconds per quake, independently of alert duration and bounded to five");
  System.out.println("PASS: 8/8 timing, smooth transition, complete cycles, pairing, coalescing, outage and cancellation replacement");
 }
}

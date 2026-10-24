package top.monitorglobal.tv;
import java.util.*;
public class AlertTrackerCheck {
 static final long NOW=1800000000000L;
 static Alert quake(String id,String version,boolean eligible){return new Alert(id,"earthquake",version,"Sismo","Profundidade: 10 km","earthquake",NOW,NOW-60000,eligible);}
 static Alert tsunami(String version,String state,boolean eligible){return new Alert("PTWC:event","tsunami",version,"Vanuatu","Somente costas citadas",state,NOW,NOW-60000,eligible);}
 static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
 public static void main(String[] args){
  AlertTracker t=new AlertTracker();check(t.accept(List.of(quake("old","6.3",true)),true,true,NOW).isEmpty(),"First connection must baseline old events");
  check(t.accept(List.of(quake("new","6.9",true)),true,true,NOW).size()==1,"New M6+ must notify");check(t.accept(List.of(quake("new","6.9",true)),true,true,NOW).isEmpty(),"Duplicate must stay silent");
  check(t.accept(List.of(quake("new","5.9",false)),true,true,NOW).size()==1,"Known above-threshold quake must receive revision below six");check(t.accept(List.of(quake("small","5.8",false)),true,true,NOW).isEmpty(),"New sub-six event must stay silent");
  check(t.accept(List.of(tsunami("warn","warning",true)),true,true,NOW).size()==1,"Active tsunami must notify");check(t.accept(List.of(tsunami("end","ended",false)),true,true,NOW).size()==1,"Cancellation of known warning must notify");
  check(t.accept(List.of(),false,false,NOW).isEmpty(),"Outage must never imply cancellation");
  AlertTracker restored=new AlertTracker();restored.seen.putAll(t.seen);restored.earthquakeReady=true;restored.tsunamiReady=true;check(restored.accept(List.of(tsunami("end","ended",false)),true,true,NOW).isEmpty(),"Restart must preserve deduplication");
  AlertTracker partial=new AlertTracker();partial.accept(List.of(),true,false,NOW);check(!partial.tsunamiReady,"Unavailable source must not initialize");check(partial.accept(List.of(tsunami("warn","warning",true)),true,true,NOW).isEmpty(),"First healthy response baselines independently");
  Alert old=new Alert("too-old","earthquake","v","old","old","earthquake",NOW-3600000,NOW-3600000,true);check(t.accept(List.of(old),true,true,NOW).isEmpty(),"Reconnect must not replay hour-old events");
  for(int i=0;i<1000;i++)t.accept(List.of(quake("q"+i,"v",false)),true,true,NOW);check(t.seen.size()<=256,"Seen state must remain bounded");
  System.out.println("PASS: baseline, M6 threshold, revision, tsunami ending, outage, restart and bounded state");
 }
}

package top.monitorglobal.tv;
import java.util.*;
/** Bounded, low priority queue; primary alerts replace rather than repeat target cards. */
final class TargetNoticeQueue {
 private final ArrayDeque<Alert> pending=new ArrayDeque<>();
 static boolean same(Alert a,Alert b){return a.id.equals(b.id)||a.aliases.contains(b.id)||b.aliases.contains(a.id)||a.aliases.stream().anyMatch(b.aliases::contains);}
 void add(Alert a){pending.removeIf(b->same(a,b));while(pending.size()>=4)pending.removeFirst();pending.addLast(a);}
 void primary(List<Alert> alerts){pending.removeIf(b->alerts.stream().anyMatch(a->same(a,b)));}
 Alert next(long now){while(!pending.isEmpty()){Alert a=pending.removeFirst();if(now-a.issuedAt<=30*60000&&a.issuedAt<=now+300000)return a;}return null;}
 void clear(){pending.clear();}
}

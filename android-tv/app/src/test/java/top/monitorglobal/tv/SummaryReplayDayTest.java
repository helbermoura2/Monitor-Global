package top.monitorglobal.tv;
import java.time.Instant;import java.util.TimeZone;import org.junit.Test;import static org.junit.Assert.*;
public class SummaryReplayDayTest {
 private final long now=Instant.parse("2026-10-27T05:27:00Z").toEpochMilli();
 private FeedClient.Snapshot summary(String day,boolean complete){FeedClient.Snapshot s=new FeedClient.Snapshot();s.day=day;s.complete=complete;s.quakeOk=true;s.alerts.add(DemoAlerts.create("quake",now).get(0));return s;}
 @Test public void atTwoAmReplayAcceptsYesterdayOnly(){assertTrue(SummaryRecord.completedFor(summary("2026-10-26",true),now));assertFalse(SummaryRecord.completedFor(summary("2026-10-27",false),now));assertFalse(SummaryRecord.completedFor(summary("2026-10-27",true),now));assertFalse(SummaryRecord.completedFor(summary("2026-10-25",true),now));}
 @Test public void partialCannotMasqueradeAsCompleted(){assertFalse(SummaryRecord.completedFor(summary("2026-10-26",false),now));assertFalse(SummaryRecord.completedFor(null,now));FeedClient.Snapshot s=summary("2026-10-26",true);s.quakeOk=false;assertFalse(SummaryRecord.completedFor(s,now));}
 @Test public void localTimezoneCannotChangeRequestedDay(){TimeZone old=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Auckland"));assertTrue(SummaryRecord.completedFor(summary("2026-10-26",true),now));}finally{TimeZone.setDefault(old);}}
 @Test public void midnightRollsReplayToNewCompletedDay(){FeedClient.Snapshot s=summary("2026-10-26",true);assertFalse(SummaryRecord.completedFor(s,Instant.parse("2026-10-27T02:59:59Z").toEpochMilli()));assertTrue(SummaryRecord.completedFor(s,Instant.parse("2026-10-27T03:00:00Z").toEpochMilli()));}
}

package top.monitorglobal.tv;
import java.time.Instant;import java.util.TimeZone;import org.junit.Test;import static org.junit.Assert.*;
public class DailySummaryScheduleTest {
 private long at(String value){return Instant.parse(value).toEpochMilli();}
 @Test public void boundaryIsBrasiliaMidnightIndependentlyOfDeviceTimezone(){
  TimeZone previous=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
   assertEquals("2026-10-24",DailySummarySchedule.completedDay(at("2026-10-26T02:59:59Z")));
   assertEquals("2026-10-25",DailySummarySchedule.completedDay(at("2026-10-26T03:00:00Z")));
   assertEquals(1000,DailySummarySchedule.delay(at("2026-10-26T02:59:59Z")));
  }finally{TimeZone.setDefault(previous);}
 }
 @Test public void missedMidnightRecoversOnlyLatestClosedDayAndDeliveredDaySurvivesRestart(){
  DailySummarySchedule schedule=new DailySummarySchedule("2026-10-20");long now=at("2026-10-26T12:00:00Z");
  assertEquals("2026-10-25",schedule.due(now));int attempt=schedule.start("2026-10-25");assertTrue(schedule.finish("2026-10-25",attempt));
  assertEquals("",new DailySummarySchedule(schedule.deliveredDay).due(now));
  assertEquals("",schedule.due(at("2026-10-25T12:00:00Z"))); // clock rollback cannot replay an older day
  assertEquals("2026-10-26",schedule.due(at("2026-10-27T03:00:00Z")));
 }
 @Test public void interruptionDoesNotAcknowledgeDeliveryAndStaleCallbackCannotCloseNewAttempt(){
  DailySummarySchedule schedule=new DailySummarySchedule("");long now=at("2026-10-26T03:00:00Z");String day=schedule.due(now);
  int old=schedule.start(day);assertTrue(schedule.interrupt());assertFalse(schedule.finish(day,old));assertEquals(day,schedule.due(now));
  int next=schedule.start(day);assertFalse(schedule.finish(day,old));assertTrue(schedule.displaying());assertTrue(schedule.finish(day,next));assertEquals("",schedule.due(now));
 }
}

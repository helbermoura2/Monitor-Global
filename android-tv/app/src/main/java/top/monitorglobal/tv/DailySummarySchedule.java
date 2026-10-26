package top.monitorglobal.tv;
import java.time.*;
/** A day is acknowledged only after a complete presentation; interruptions invalidate old callbacks. */
final class DailySummarySchedule {
 private static final ZoneId ZONE=ZoneId.of("America/Sao_Paulo");
 String deliveredDay;private String activeDay="";private int generation;
 DailySummarySchedule(String saved){deliveredDay=saved!=null&&saved.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")?saved:"";}
 static String completedDay(long now){return Instant.ofEpochMilli(now).atZone(ZONE).toLocalDate().minusDays(1).toString();}
 static long delay(long now){long next=Instant.ofEpochMilli(now).atZone(ZONE).toLocalDate().plusDays(1).atStartOfDay(ZONE).toInstant().toEpochMilli();return Math.max(1,Math.min(30000,next-now));}
 String due(long now){String day=completedDay(now);return day.compareTo(deliveredDay)>0?day:"";}
 boolean displaying(){return !activeDay.isEmpty();}
 int start(String day){activeDay=day;return ++generation;}
 boolean finish(String day,int attempt){if(generation!=attempt||!day.equals(activeDay))return false;deliveredDay=day;activeDay="";return true;}
 boolean interrupt(){boolean had=displaying();activeDay="";++generation;return had;}
}

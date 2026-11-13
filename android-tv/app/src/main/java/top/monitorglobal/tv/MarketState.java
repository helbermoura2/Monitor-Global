package top.monitorglobal.tv;
import java.time.*;
import org.json.*;

/** Session identity is independent of quote age and source availability. */
final class MarketState {
 static final int UNKNOWN=0,OPEN=1,CLOSED=2,PAUSED=3;
 static final ZoneId NEW_YORK=ZoneId.of("America/New_York");
 final int value;final String basis;final long endsAt;
 MarketState(int v,String why){this(v,why,0);}
 MarketState(int v,String why,long end){value=v;basis=why;endsAt=end;}
 String label(){return value==OPEN?"ABERTO":value==CLOSED?"FECHADO":value==PAUSED?"FECHADO · PAUSA":"STATUS N/D";}
 boolean closed(){return value==CLOSED||value==PAUSED;}
 static MarketState unknown(){return new MarketState(UNKNOWN,"Estado não confirmado pela fonte");}
 static MarketState brentRegular(long now){
  if(now<=0)return unknown();ZonedDateTime t=Instant.ofEpochMilli(now).atZone(NEW_YORK);DayOfWeek d=t.getDayOfWeek();int h=t.getHour();
  if(d==DayOfWeek.SATURDAY||d==DayOfWeek.SUNDAY&&h<18||d==DayOfWeek.FRIDAY&&h>=17)return new MarketState(CLOSED,"Sessão regular NYMEX/CME · fim de semana");
  if(d!=DayOfWeek.SUNDAY&&h>=17&&h<18)return new MarketState(PAUSED,"Pausa diária NYMEX/CME");
  return new MarketState(OPEN,"Sessão regular NYMEX/CME");
 }
 static long brentStart(long now){ZonedDateTime t=Instant.ofEpochMilli(now).atZone(NEW_YORK);ZonedDateTime start=t.toLocalDate().atTime(18,0).atZone(NEW_YORK);return (t.isBefore(start)?start.minusDays(1):start).toInstant().toEpochMilli();}
 static boolean sameBrentSession(long quoteAt,long now){return brentRegular(now).value==OPEN&&quoteAt>=brentStart(now)&&quoteAt<=now+120000;}
 static MarketState fromMeta(JSONObject meta,String symbol,long now){
  if(meta==null||!symbol.equals(meta.optString("symbol")))return unknown();
  String raw=meta.optString("marketState","").toUpperCase(java.util.Locale.ROOT);int value;
  switch(raw){case "REGULAR":case "OPEN":value=OPEN;break;case "CLOSED":case "PRE":case "POST":case "PREPRE":case "POSTPOST":value=CLOSED;break;case "HALTED":case "PAUSED":value=PAUSED;break;default:value=UNKNOWN;}
  JSONObject sessions=meta.optJSONObject("currentTradingPeriod"),period=sessions==null?null:sessions.optJSONObject("regular");long start=period==null?0:period.optLong("start",0)*1000L,end=period==null?0:period.optLong("end",0)*1000L;
  boolean valid=start>0&&end>start&&end-start<=48*3600000L&&Math.abs(now-start)<=5*86400000L;
  if(value!=UNKNOWN)return new MarketState(value,"Estado informado pelo Yahoo Finance",valid&&end>now?end:0);
  if(!raw.isEmpty()||!valid)return unknown();
  if(now>=start&&now<end)return new MarketState(OPEN,"Sessão informada pelo Yahoo Finance",end);
  long at=meta.optLong("regularMarketTime",0)*1000L;
  if(now>=end&&at>=start&&at<=end||now<start&&at>0&&at<start)return new MarketState(CLOSED,"Fora da sessão informada pelo Yahoo Finance",end);
  return unknown();
 }
 static MarketState fromWorker(JSONObject d,long now){
  MarketState regular=brentRegular(now);if(regular.closed())return regular;
  if(d==null||!"tv-brent-v1".equals(d.optString("version"))||!"BZ=F".equals(d.optString("symbol")))return unknown();
  String state=d.optString("marketState","");long checked=d.optLong("checkedAt",0);if(checked<=0||checked>now+120000||now-checked>5*60000L)return unknown();
  if(state.equals("CLOSED"))return new MarketState(CLOSED,"Fechado segundo a fonte");if(state.equals("PAUSED"))return new MarketState(PAUSED,"Pausa segundo a fonte");if(state.equals("OPEN")&&d.optBoolean("marketOpen"))return new MarketState(OPEN,d.optString("sessionBasis","Sessão informada pela fonte"),d.optLong("sessionEnd",0));return unknown();
 }
 MarketState current(long now,boolean brent){if(brent){MarketState regular=brentRegular(now);if(regular.closed()||basis.contains("NYMEX/CME"))return regular;}if(value==OPEN&&endsAt>0&&now>=endsAt)return new MarketState(CLOSED,"Fim da sessão informada pela fonte",endsAt);return this;}
}

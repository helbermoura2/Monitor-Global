package top.monitorglobal.tv;
import org.json.*;import java.util.*;
/** Same minute-rate meaning as the site. Missing/stale data never means dry weather. */
final class RainForecast {
 static final double LATITUDE=-23.555,LONGITUDE=-46.635;
 static final long MINUTE=60000;static final String[] TYPES={"no_precipitation","rain","mixed","snow"};
 static final class Summary {
  final String state,level,title,rateText,amountText,stopText;final long at,expiresAt;final double rate,amount;final boolean rain;
  // Additional presentation facts; unknown values never become invented zeroes.
  final int arrivalMinutes,endMinutes,durationMinutes;final double forecastRate;final String forecastLevel,forecastRateText,durationText,durationLabel;
  Summary(String s,String l,String t,double r,double mm,String stop,long a,long expiry,boolean liquid){this(s,l,t,r,mm,stop,a,expiry,liquid,-1,-1,-1,Double.NaN,"Duração ainda indefinida");}
  Summary(String s,String l,String t,double r,double mm,String stop,long a,long expiry,boolean liquid,int arrival,int end,int duration,double predictedRate,String durationDescription){
   state=s;level=l;title=t;rate=r;amount=mm;stopText=stop;at=a;expiresAt=expiry;rain=liquid;rateText=number(r)+" mm/h estimados agora";amountText=number(mm)+" mm previstos · próximos 60 min";
   arrivalMinutes=arrival;endMinutes=end;durationMinutes=duration;forecastRate=predictedRate;
   forecastLevel=Double.isFinite(predictedRate)&&predictedRate>=.1?intensity(predictedRate):"";
   forecastRateText=forecastLevel.isEmpty()?"Intensidade ainda indisponível":number(predictedRate)+(s.equals("soon")?" mm/h no início previsto":" mm/h estimados agora");
   durationText=durationDescription;int separator=durationDescription.indexOf(":");durationLabel=separator<0?durationDescription:durationDescription.substring(0,separator);
  }
  Summary withPresentation(String displayLevel,String displayTitle){return new Summary(state,displayLevel,displayTitle,rate,amount,stopText,at,expiresAt,rain,arrivalMinutes,endMinutes,durationMinutes,forecastRate,durationText);}
  String key(){return state+":"+((state.equals("now")||state.equals("evidence"))?level:"");}
 }
 static String number(double n){return String.format(Locale.forLanguageTag("pt-BR"),"%.1f",n);}
 static String intensity(double rate){return rate<2.5?"fraca":rate<7.5?"moderada":rate<50?"forte":"muito forte";}
 static boolean wet(double rate,String type){return rate>=.1&&!type.equals("no_precipitation");}
 static Summary summarize(JSONObject data,long now)throws JSONException {
  if(!data.optString("version").equals("tv-rain-v1")||!data.optString("area").equals("liberdade"))return null;
  Summary forecast=minuteForecast(data,now);
  if(forecast!=null&&forecast.state.equals("now"))return forecast;
  Summary evidence=independentEvidence(data.optJSONObject("evidence"),now);
  if(evidence!=null&&(evidence.level.equals("gauge")||forecast==null||forecast.state.equals("dry")))return evidence;
  return forecast;
 }
 private static Summary independentEvidence(JSONObject data,long now){
  if(data==null)return null;
  long at=data.optLong("at",0),expiry=data.optLong("expiresAt",0);
  if(at<=0||at>now||expiry<=now||expiry>at+20*MINUTE)return null;
  JSONObject consensus=data.optJSONObject("consensus");
  String consensusNote=consensus==null?"":consensusNote(consensus,now);
  String kind=data.optString("kind");
  if(kind.equals("consensus"))return consensusSummary(data,now);
  if(kind.equals("gauge")){
   String station=data.optString("station").trim();
   double amount=data.optDouble("amount",Double.NaN),distance=data.optDouble("distanceKm",Double.NaN);
   if(station.isEmpty()||station.length()>60||!Double.isFinite(amount)||amount<=0||amount>300||!Double.isFinite(distance)||distance<0||distance>3)return null;
   String detail="Cemaden · "+station+" · "+number(distance)+" km · "+number(amount)+" mm medidos"+(consensusNote.isEmpty()?"":" · "+consensusNote);
   return new Summary("evidence",kind,"Chuva medida nas proximidades",Double.NaN,Double.NaN,detail,at,expiry,false);
  }
  if(kind.equals("hourly")&&expiry<=at+10*MINUTE){
   if(consensus!=null)return consensusSummary(consensus,now);
   return new Summary("evidence",kind,"Modelos horários indicam chuva",Double.NaN,Double.NaN,"Open-Meteo · pelo menos dois modelos · início incerto",at,expiry,false);
  }
  return null;
 }
 private static Summary consensusSummary(JSONObject data,long now){
  String note=consensusNote(data,now);long at=data.optLong("at",0),expiry=data.optLong("expiresAt",0);
  if(note.isEmpty()||at<=0||at>now||expiry<=now||expiry>at+10*MINUTE)return null;
  return new Summary("evidence","consensus","Consenso de modelos: chuva possível",Double.NaN,Double.NaN,note,at,expiry,false);
 }
 private static String consensusNote(JSONObject data,long now){
  if(data.optInt("models")!=3||data.optInt("windowHours")!=6)return "";
  int votes=data.optInt("peakVotes",-1),wetHours=data.optInt("wetHours",-1),arrival=data.optInt("arrivalMinutes",-1);
  double accumulated=data.optDouble("accumulatedMedianMm",Double.NaN);
  if(votes<0||votes>3||wetHours<0||wetHours>6||!Double.isFinite(accumulated)||accumulated<0||accumulated>180)return "";
  StringBuilder note=new StringBuilder("Open-Meteo · ").append(votes).append("/3 modelos concordam");
  if(arrival>=0&&arrival<=360)note.append(" · início em ~").append(arrival).append(" min");
  else if(wetHours==0)note.append(" · sem consenso de chuva nas próximas 6 h");
  note.append(" · acumulado mediano entre horas chuvosas: ").append(number(accumulated)).append(" mm");
  note.append(" · consenso, não probabilidade calibrada");
  return note.toString();
 }
 private static Summary minuteForecast(JSONObject data,long now)throws JSONException {
  if(!data.optBoolean("ok"))return null;
  JSONObject loc=data.optJSONObject("loc");long at=data.optLong("at",0),expiry=data.optLong("expiresAt",0);
  if(loc==null||!Double.isFinite(loc.optDouble("lat",Double.NaN))||!Double.isFinite(loc.optDouble("lng",Double.NaN))||Math.abs(loc.optDouble("lat",999)-LATITUDE)>.002||Math.abs(loc.optDouble("lng",999)-LONGITUDE)>.002||at<=0||at>now+MINUTE||now-at>20*MINUTE||expiry<=now||expiry>at+10*MINUTE)return null;
  JSONArray points=data.optJSONArray("forecast");if(points==null||points.length()<60||points.length()>300)return null;
  int count=points.length(),current=-1;long[] starts=new long[count],ends=new long[count];double[] rates=new double[count];String[] types=new String[count];
  for(int i=0;i<count;i++){JSONObject p=points.getJSONObject(i);starts[i]=p.getLong("start");ends[i]=p.getLong("end");rates[i]=p.getDouble("rate");types[i]=p.getString("type");if(ends[i]-starts[i]!=MINUTE||i>0&&starts[i]!=ends[i-1]||!Double.isFinite(rates[i])||rates[i]<0||rates[i]>1000||!Arrays.asList(TYPES).contains(types[i]))return null;if(starts[i]<=now&&ends[i]>now)current=i;}
  if(current<0||ends[count-1]<now+60*MINUTE)return null;
  int first=-1,stop=-1,stopIndex=-1;for(int i=current;i<count;i++)if(wet(rates[i],types[i])){first=i;break;}
  if(first>=0)for(int i=first+1;i<=count-10;i++){boolean dry=true;for(int j=i;j<i+10;j++)if(wet(rates[j],types[j])){dry=false;break;}if(dry){stopIndex=i;stop=(int)Math.max(1,Math.ceil((starts[i]-now)/(double)MINUTE));break;}}
  int arrival=first<0?-1:(int)Math.max(0,Math.ceil((starts[first]-now)/(double)MINUTE));boolean nowWet=wet(rates[current],types[current]);String state=nowWet?"now":arrival>=0&&arrival<=60?"soon":"dry",noun=first>=0&&types[first].equals("snow")?"Neve":"Chuva";
  String level=intensity(rates[current]),title=state.equals("now")?noun+" "+level+" estimada agora":state.equals("soon")?noun+" prevista em ~"+arrival+" min":"Sem chuva estimada · próxima hora";
  double amount=0;for(int i=current;i<count&&starts[i]<now+60*MINUTE;i++)amount+=rates[i]*Math.max(0,Math.min(ends[i],now+60*MINUTE)-Math.max(starts[i],now))/3600000.0;
  boolean active=state.equals("now")||state.equals("soon"),pauses=false;int duration=-1;
  if(active&&stopIndex>=0){
   duration=(int)Math.max(1,Math.ceil((starts[stopIndex]-(nowWet?now:starts[first]))/(double)MINUTE));
   for(int i=first;i<stopIndex;i++)if(!wet(rates[i],types[i])){pauses=true;break;}
  }
  String durationText=duration<0?"Duração ainda indefinida":(pauses?(nowWet?"Janela restante estimada: ~":"Janela de "+noun.toLowerCase(Locale.ROOT)+" prevista: ~"):(nowWet?"Duração restante estimada: ~":"Duração estimada: ~"))+duration+" min";
  double predictedRate=active?rates[nowWet?current:first]:Double.NaN;
  return new Summary(state,level,title,rates[current],amount,stop<0?"Término sem estimativa disponível":"Pode terminar em ~"+stop+" min a partir de agora",at,expiry,nowWet&&!types[current].equals("snow"),active?arrival:-1,active?stop:-1,duration,predictedRate,durationText);
 }
}

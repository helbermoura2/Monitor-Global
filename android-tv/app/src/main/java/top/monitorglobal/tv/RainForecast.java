package top.monitorglobal.tv;
import org.json.*;import java.util.*;
/** Same minute-rate meaning as the site. Missing/stale data never means dry weather. */
final class RainForecast {
 static final double LATITUDE=-23.555,LONGITUDE=-46.635;
 static final long MINUTE=60000;static final String[] TYPES={"no_precipitation","rain","mixed","snow"};
 static final class Summary {
  final String state,level,title,rateText,amountText,stopText;final long at,expiresAt;final double rate,amount;final boolean rain;
  Summary(String s,String l,String t,double r,double mm,String stop,long a,long expiry,boolean liquid){state=s;level=l;title=t;rate=r;amount=mm;stopText=stop;at=a;expiresAt=expiry;rain=liquid;rateText=number(r)+" mm/h estimados agora";amountText=number(mm)+" mm previstos · próximos 60 min";}
  String key(){return state+":"+(state.equals("now")?level:"");}
 }
 static String number(double n){return String.format(Locale.forLanguageTag("pt-BR"),"%.1f",n);}
 static String intensity(double rate){return rate<2.5?"fraca":rate<7.5?"moderada":rate<50?"forte":"muito forte";}
 static boolean wet(double rate,String type){return rate>=.1&&!type.equals("no_precipitation");}
 static Summary summarize(JSONObject data,long now)throws JSONException {
  if(!data.optBoolean("ok")||!data.optString("version").equals("tv-rain-v1")||!data.optString("area").equals("liberdade"))return null;
  JSONObject loc=data.optJSONObject("loc");long at=data.optLong("at",0),expiry=data.optLong("expiresAt",0);
  if(loc==null||!Double.isFinite(loc.optDouble("lat",Double.NaN))||!Double.isFinite(loc.optDouble("lng",Double.NaN))||Math.abs(loc.optDouble("lat",999)-LATITUDE)>.002||Math.abs(loc.optDouble("lng",999)-LONGITUDE)>.002||at<=0||at>now+MINUTE||now-at>20*MINUTE||expiry<=now||expiry>at+10*MINUTE)return null;
  JSONArray points=data.optJSONArray("forecast");if(points==null||points.length()<60||points.length()>300)return null;
  int count=points.length(),current=-1;long[] starts=new long[count],ends=new long[count];double[] rates=new double[count];String[] types=new String[count];
  for(int i=0;i<count;i++){JSONObject p=points.getJSONObject(i);starts[i]=p.getLong("start");ends[i]=p.getLong("end");rates[i]=p.getDouble("rate");types[i]=p.getString("type");if(ends[i]-starts[i]!=MINUTE||i>0&&starts[i]!=ends[i-1]||!Double.isFinite(rates[i])||rates[i]<0||rates[i]>1000||!Arrays.asList(TYPES).contains(types[i]))return null;if(starts[i]<=now&&ends[i]>now)current=i;}
  if(current<0||ends[count-1]<now+60*MINUTE)return null;
  int first=-1,stop=-1;for(int i=current;i<count;i++)if(wet(rates[i],types[i])){first=i;break;}
  if(first>=0)for(int i=first+1;i<=count-10;i++){boolean dry=true;for(int j=i;j<i+10;j++)if(wet(rates[j],types[j])){dry=false;break;}if(dry){stop=(int)Math.max(1,Math.ceil((starts[i]-now)/(double)MINUTE));break;}}
  int arrival=first<0?-1:(int)Math.max(0,Math.ceil((starts[first]-now)/(double)MINUTE));boolean nowWet=wet(rates[current],types[current]);String state=nowWet?"now":arrival>=0&&arrival<=60?"soon":"dry",noun=first>=0&&types[first].equals("snow")?"Neve":"Chuva";
  String level=intensity(rates[current]),title=state.equals("now")?noun+" "+level+" estimada agora":state.equals("soon")?noun+" prevista em ~"+arrival+" min":"Sem chuva estimada · próxima hora";
  double amount=0;for(int i=current;i<count&&starts[i]<now+60*MINUTE;i++)amount+=rates[i]*Math.max(0,Math.min(ends[i],now+60*MINUTE)-Math.max(starts[i],now))/3600000.0;
  return new Summary(state,level,title,rates[current],amount,stop<0?"Término sem estimativa disponível":"Pode terminar em ~"+stop+" min a partir de agora",at,expiry,nowWet&&!types[current].equals("snow"));
 }
}

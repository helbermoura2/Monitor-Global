package top.monitorglobal.tv;
import org.json.JSONException;
import org.json.JSONObject;

/** Full-day totals only: these counts never come from the five televised events. */
final class DailySeismicTotals {
 final String day;
 final int total,m6,m5,m4,below4;
 final boolean partial;
 DailySeismicTotals(String day,int total,int m6,int m5,int m4,int below4,boolean partial) throws JSONException {
  if(day==null||!day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")||
   total<0||total>20000||m6<0||m5<0||m4<0||below4<0||
   (long)m6+m5+m4+below4!=total)throw new JSONException("Contagem diária inválida");
  this.day=day;this.total=total;this.m6=m6;this.m5=m5;this.m4=m4;this.below4=below4;this.partial=partial;
 }
 static DailySeismicTotals read(JSONObject json,String day) throws JSONException {
  if(json==null)return null;
  DailySeismicTotals result=new DailySeismicTotals(json.getString("day"),json.getInt("total"),json.getInt("m6"),
    json.getInt("m5"),json.getInt("m4"),json.getInt("below4"),json.optBoolean("partial",false));
  if(!result.day.equals(day))throw new JSONException("Dados diários de outra data");
  return result.partial?null:result; // Never show incomplete source counts as definitive totals.
 }
 JSONObject json() throws JSONException {
  return new JSONObject().put("day",day).put("total",total).put("m6",m6).put("m5",m5).put("m4",m4)
    .put("below4",below4).put("partial",partial);
 }
 int[] values(){return new int[]{total,m6,m5,m4,below4};}
 int[] countUpValues(float fraction){
  if(partial||fraction>=1f)return values();
  float progress=Math.max(0f,fraction);
  int a=(int)(m6*progress),b=(int)(m5*progress),c=(int)(m4*progress),d=(int)(below4*progress);
  return new int[]{a+b+c+d,a,b,c,d};
 }
 String accessibilityText(){return total+" eventos no dia, "+m6+" magnitude 6 ou mais, "+m5+
   " entre magnitude 5 e 5,9, "+m4+" entre magnitude 4 e 4,9, "+below4+" abaixo de magnitude 4.";}
}

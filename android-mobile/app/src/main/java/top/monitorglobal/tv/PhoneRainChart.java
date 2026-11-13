package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.json.*;

/** Five-minute accumulations integrated from valid minute rates, never interpolated missing data. */
final class PhoneRainChart extends View {
 static final class Series {
  private final double[] amounts;
  final long startsAt;
  Series(double[] values,long at){amounts=values.clone();startsAt=at;}
  double amount(int i){return amounts[i];}
  static Series parse(JSONObject data,long now){
   try{
    if(data==null||RainForecast.summarize(data,now)==null)return null;
    double[] values=new double[12];long[] coverage=new long[12];JSONArray points=data.getJSONArray("forecast");
    for(int i=0;i<points.length();i++){JSONObject p=points.getJSONObject(i);long start=p.getLong("start"),end=p.getLong("end");double rate=p.getDouble("rate");
     for(int b=0;b<12;b++){long left=now+b*300000L,right=left+300000L,span=Math.max(0,Math.min(right,end)-Math.max(left,start));coverage[b]+=span;values[b]+=rate*span/3600000d;}
    }
    for(long span:coverage)if(span!=300000L)return null;
    return new Series(values,now);
   }catch(JSONException|RuntimeException ignored){return null;}
  }
 }
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Series series;private final float density;
 PhoneRainChart(Context c,Series value){super(c);series=value;density=getResources().getDisplayMetrics().density;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);StringBuilder description=new StringBuilder("Precipitação prevista, acumulado por cinco minutos: ");for(int i=0;i<12;i++)description.append(i*5).append(" a ").append((i+1)*5).append(" minutos, ").append(RainForecast.number(series.amount(i))).append(" milímetros; ");setContentDescription(description.toString());}
 @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);float left=0,right=getWidth(),bottom=getHeight()-23*density,top=17*density;double max=.1;for(int i=0;i<12;i++)max=Math.max(max,series.amount(i));paint.setTextSize(11*density);paint.setColor(PhoneActivity.MUTED);canvas.drawText(RainForecast.number(max)+" mm",left,11*density,paint);paint.setColor(0xff245266);paint.setStrokeWidth(density);for(int j=0;j<3;j++){float y=top+(bottom-top)*j/2;canvas.drawLine(left,y,right,y,paint);}float step=(right-left)/12;for(int i=0;i<12;i++){float x=left+i*step+step*.16f,h=(float)(series.amount(i)/max*(bottom-top));if(h<=0)continue;paint.setShader(new LinearGradient(0,bottom-h,0,bottom,0xff31e5f1,0xff13708d,Shader.TileMode.CLAMP));canvas.drawRoundRect(x,bottom-h,x+step*.68f,bottom,3*density,3*density,paint);paint.setShader(null);}paint.setColor(PhoneActivity.MUTED);paint.setTextSize(11*density);canvas.drawText("Agora",left,getHeight()-3*density,paint);canvas.drawText("30 min",right/2-paint.measureText("30 min")/2,getHeight()-3*density,paint);canvas.drawText("60 min",right-paint.measureText("60 min"),getHeight()-3*density,paint);}
}

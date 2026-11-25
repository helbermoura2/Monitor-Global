package top.monitorglobal.tv;

import android.graphics.*;
import java.util.*;
import java.time.*;
import java.time.format.DateTimeFormatter;

/** Distinct prediction products; no forecast presented as a radar observation. */
final class WeatherPredictionMap {
 static final class Echo {
  final RadarCappi grid;final RadarNowcast.Motion motion;final String radar;
  Echo(RadarCappi g,RadarNowcast.Motion m,String r){grid=g;motion=m;radar=r;}
  float sample(double lat,double lon,int lead,long now){
   int y=RadarCappi.nearest(grid.lat,lat),x=RadarCappi.nearest(grid.lon,lon);
   return x<0||y<0?Float.NaN:RadarNowcast.extrapolate(grid,motion,y,x,lead,now);
  }
 }
 static List<Echo> derive(RadarMapClient.Frame a,RadarMapClient.Frame b){
  List<Echo> out=new ArrayList<>();if(a==null||b==null)return out;
  for(int i=0;i<b.radars.size();i++){
   int j=a.radars.indexOf(b.radars.get(i));if(j<0)continue;
   RadarNowcast.Motion m=RadarNowcast.estimate(a.grids.get(j),b.grids.get(i),a.at,b.at);
   if(m!=null)out.add(new Echo(b.grids.get(i),m,b.radars.get(i)));
  }
  return out;
 }
 static float sample(List<Echo> echoes,double lat,double lon,int lead,long now){
  float max=Float.NaN;
  for(Echo e:echoes){float v=e.sample(lat,lon,lead,now);if(Float.isFinite(v)&&(!Float.isFinite(max)||v>max))max=v;}
  return max;
 }
 static String hour(long at){return DateTimeFormatter.ofPattern("dd/MM HH:mm 'BRT'",Locale.ROOT).withZone(ZoneId.of("America/Sao_Paulo")).format(Instant.ofEpochMilli(at));}
 static Bitmap numerical(WeatherSatelliteClient geography,InfraredPlan.Scope scope,RegionalForecast.Data data,int h)throws Exception{
  long end=data.end(h);Bitmap out=Bitmap.createBitmap(InfraredPlan.WIDTH,scope.height,Bitmap.Config.ARGB_8888);
  try{
   Canvas c=new Canvas(out);c.drawColor(0xff101719);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
   Path outline=geography.outline(scope);p.setColor(0xff23353c);c.drawPath(outline,p);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor(0xff82959d);c.drawPath(outline,p);p.setStyle(Paint.Style.FILL);
   p.setTextSize(21);p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextAlign(Paint.Align.CENTER);
   for(RegionalForecast.Point point:data.points){
    float x=scope.x(point.lon),y=scope.y(point.lat);if(x<0||y<0||x>=out.getWidth()||y>=out.getHeight())continue;
    double v=point.value(end);p.setColor(!Double.isFinite(v)?0xff63676b:v==0?0xff3a4e59:v<1?0xff2a9fba:v<5?0xff2dbf74:v<10?0xffdeae38:0xffd74446);
    c.drawCircle(x,y,13,p);p.setColor(Color.WHITE);
    c.drawText(Double.isFinite(v)?String.format(Locale.forLanguageTag("pt-BR"),"%.1f",v):"—",x,y-20,p);
   }
   return out;
  }catch(Exception|OutOfMemoryError e){out.recycle();throw e;}
 }
 private WeatherPredictionMap(){}
}

package top.monitorglobal.tv;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Regional samples from a named numerical model, never interpolated into a fake radar field.
 * Hourly precipitation is accumulated over the preceding hour (mm). */
final class RegionalForecast {
 static final String SOURCE="Open-Meteo / ECMWF IFS";
 static final String MODEL="ecmwf_ifs025";
 static final String URL="https://api.open-meteo.com/v1/forecast?latitude=-24.5,-24.5,-24.5,-23.5,-23.5,-23.5,-22.5,-22.5,-22.5&longitude=-48,-46.5,-45,-48,-46.5,-45,-48,-46.5,-45&hourly=precipitation&models="+MODEL+"&timezone=GMT&timeformat=unixtime&forecast_hours=7";
 static final class Point {
  final double lat,lon;final NavigableMap<Long,Double> hourly;
  Point(double lat,double lon,NavigableMap<Long,Double> hourly){this.lat=lat;this.lon=lon;this.hourly=hourly;}
  double value(long end){return hourly.getOrDefault(end,Double.NaN);}
 }
 static final class Data {
  final long retrievedAt;final List<Point> points;
  Data(long retrievedAt,List<Point> points){this.retrievedAt=retrievedAt;this.points=Collections.unmodifiableList(points);}
  long firstEnd(){return (retrievedAt/3600000L+1)*3600000L;}
  long end(int hour){if(hour<1||hour>6)throw new IllegalArgumentException("1–6");return firstEnd()+(hour-1)*3600000L;}
  String attribution(){return SOURCE+" · previsão numérica · acumulado por hora (mm) · rodada não informada";}
 }
 static Data parse(String json,long now)throws JSONException{
  JSONArray list=new JSONArray(json);if(list.length()!=9)throw new JSONException("Expected 9 requested samples");
  List<Point> points=new ArrayList<>();
  for(int i=0;i<list.length();i++){
   JSONObject p=list.getJSONObject(i);
   double lat=p.getDouble("latitude"),lon=p.getDouble("longitude");
   double expectedLat=-24.5+(i/3),expectedLon=-48+(i%3)*1.5;
   if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat-expectedLat)>0.5||Math.abs(lon-expectedLon)>0.5)throw new JSONException("Unexpected grid coordinate");
   JSONObject h=p.getJSONObject("hourly"),units=p.getJSONObject("hourly_units");
   if(!"mm".equals(units.getString("precipitation"))||!"unixtime".equals(units.getString("time")))throw new JSONException("Unexpected forecast units");
   JSONArray times=h.getJSONArray("time"),values=h.getJSONArray("precipitation");
   if(times.length()!=values.length()||times.length()>24)throw new JSONException("Unexpected forecast length");
   NavigableMap<Long,Double> data=new TreeMap<>();
   for(int j=0;j<times.length();j++){
    long end=Math.multiplyExact(times.getLong(j),1000L);
    if(end%3600000L!=0||end<=now||end>now+6*3600000L||values.isNull(j))continue;
    double v=values.getDouble(j);if(Double.isFinite(v)&&v>=0)data.put(end,v);
   }
   points.add(new Point(lat,lon,data));
  }
  return new Data(now,points);
 }
 static Data fetch(long now)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(URL).openConnection();
  c.setInstanceFollowRedirects(false);c.setConnectTimeout(5000);c.setReadTimeout(8000);
  c.setRequestProperty("User-Agent","ArgosOrbisTV/"+BuildConfig.VERSION_NAME);
  try{
   if(c.getResponseCode()!=200||c.getContentLengthLong()>262144)throw new IOException("Forecast unavailable");
   ByteArrayOutputStream b=new ByteArrayOutputStream();long start=System.nanoTime();
   try(InputStream in=c.getInputStream()){byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){
    if(Thread.currentThread().isInterrupted()||System.nanoTime()-start>12_000_000_000L||b.size()+n>262144)throw new IOException("Forecast limit");
    b.write(buf,0,n);
   }}
   return parse(new String(b.toByteArray(),StandardCharsets.UTF_8),now);
  }finally{c.disconnect();}
 }
 private RegionalForecast(){}
}

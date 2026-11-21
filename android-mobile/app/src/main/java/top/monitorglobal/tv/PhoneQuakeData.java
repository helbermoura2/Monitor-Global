package top.monitorglobal.tv;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Public catalog and cartographic assets. Requests contain no saved places. */
final class PhoneQuakeData {
 static final String USGS="https://earthquake.usgs.gov";
 static double distance(double lat,double lon,double otherLat,double otherLon){
  double a=Math.pow(Math.sin(Math.toRadians(otherLat-lat)/2),2)+Math.cos(Math.toRadians(lat))*
   Math.cos(Math.toRadians(otherLat))*Math.pow(Math.sin(Math.toRadians(otherLon-lon)/2),2);
  return 12742*Math.asin(Math.sqrt(Math.min(1,a)));
 }
 static byte[] read(String url,int limit)throws IOException{
  HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();
  connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setInstanceFollowRedirects(false);
  try{
   if(connection.getResponseCode()!=200||connection.getContentLength()>limit)throw new IOException("Fonte indisponível");
   try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int count;
    while((count=input.read(buffer))!=-1){
     if(Thread.currentThread().isInterrupted()||output.size()+count>limit)throw new IOException("Consulta interrompida");
     output.write(buffer,0,count);
    }
    return output.toByteArray();
   }
  }finally{connection.disconnect();}
 }
 static JSONObject json(String url)throws IOException,JSONException{
  return new JSONObject(new String(read(url,1_500_000),StandardCharsets.UTF_8));
 }
 static List<Alert> catalog(String url)throws IOException,JSONException{
  JSONArray features=json(url).getJSONArray("features");List<Alert> events=new ArrayList<>();
  for(int i=0;i<features.length();i++){
   JSONObject feature=features.optJSONObject(i);
   if(feature==null)continue;
   JSONObject properties=feature.optJSONObject("properties"),geometry=feature.optJSONObject("geometry");
   if(properties==null||geometry==null||!"earthquake".equals(properties.optString("type")))continue;
   JSONArray coords=geometry.optJSONArray("coordinates");
   if(coords==null)continue;
   double lon=coords.optDouble(0),lat=coords.optDouble(1),mag=properties.optDouble("mag");
   long time=properties.optLong("time");
   String id=feature.optString("id");
   if(!id.matches("[a-zA-Z0-9]{3,40}")||!MapFrame.located(lon,lat)||!Double.isFinite(mag)||time<=0)continue;
   String place=properties.isNull("place")?"Localização do catálogo USGS":properties.optString("place");
   Alert event=new Alert(id,"earthquake",Long.toString(properties.optLong("updated",time)),place,"","earthquake",time,time,true);
   event.source="USGS";event.officialEventId=id;event.originLongitude=lon;event.originLatitude=lat;
   event.depth=coords.optDouble(2);event.magnitude=mag;events.add(event);
  }
  return events;
 }
 // ShakeMap rupture files encode depth in kilometres, positive down.
 static List<List<double[]>> rupture(Alert origin,List<Alert> matches)throws IOException,JSONException{
  String id=origin.officialEventId;
  if(!id.matches("[a-zA-Z0-9]{3,40}")||!"USGS".equalsIgnoreCase(origin.source)){
   id=matches.stream().filter(a->Math.abs(a.eventTime-origin.eventTime)<90000L&&
    Math.abs(a.magnitude-origin.magnitude)<.6&&distance(origin.originLatitude,origin.originLongitude,a.originLatitude,a.originLongitude)<80)
    .min(Comparator.comparingLong(a->Math.abs(a.eventTime-origin.eventTime))).map(a->a.id).orElse("");
  }
  if(id.isEmpty())return Collections.emptyList();
  JSONObject detail=json(USGS+"/fdsnws/event/1/query?format=geojson&eventid="+id);
  JSONArray point=detail.getJSONObject("geometry").getJSONArray("coordinates");
  JSONObject properties=detail.getJSONObject("properties");
  if(!detail.getString("id").equals(id)||Math.abs(properties.getLong("time")-origin.eventTime)>90000L||
    distance(origin.originLatitude,origin.originLongitude,point.getDouble(1),point.getDouble(0))>=80)return Collections.emptyList();
  JSONArray maps=properties.getJSONObject("products").optJSONArray("shakemap");
  if(maps==null)return Collections.emptyList();
  for(int i=0;i<maps.length();i++){
   JSONObject map=maps.getJSONObject(i);
   if("DELETE".equals(map.optString("status"))||!"us".equals(map.optString("source")))continue;
   JSONObject asset=map.getJSONObject("contents").optJSONObject("download/rupture.json");
   if(asset==null)continue;
   String url=asset.optString("url");
   if(!url.matches("https://earthquake\\.usgs\\.gov/product/shakemap/[a-zA-Z0-9_-]+/us/[0-9]+/download/rupture\\.json"))continue;
   List<List<double[]>> rings=new ArrayList<>();
   JSONArray features=json(url).getJSONArray("features");
   int vertices=0;
   for(int j=0;j<features.length();j++){
    JSONObject geometry=features.getJSONObject(j).getJSONObject("geometry");
    JSONArray polygons=geometry.getJSONArray("coordinates");
    if("Polygon".equals(geometry.optString("type")))polygons=new JSONArray().put(polygons);
    else if(!"MultiPolygon".equals(geometry.optString("type")))continue;
    for(int k=0;k<polygons.length();k++){
     JSONArray shell=polygons.getJSONArray(k).getJSONArray(0);
     List<double[]> points=new ArrayList<>();
     for(int n=0;n<shell.length();n++){
      JSONArray vertex=shell.getJSONArray(n);
      double lon=vertex.optDouble(0),lat=vertex.optDouble(1),depth=vertex.optDouble(2);
      if(++vertices>5000||!MapFrame.located(lon,lat)||!Double.isFinite(depth)||depth<0||depth>780||
       distance(origin.originLatitude,origin.originLongitude,lat,lon)>1100)return Collections.emptyList();
      points.add(new double[]{lon,lat,depth});
     }
     if(points.size()>=4&&points.stream().mapToDouble(v->v[2]).max().orElse(0)>points.stream().mapToDouble(v->v[2]).min().orElse(0))rings.add(points);
    }
   }
   return rings;
  }
  return Collections.emptyList();
 }
 static Bitmap terrain(MapFrame frame)throws IOException{
  byte[] bytes=read("https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/export?bbox="+
   frame.west+","+frame.south+","+frame.east+","+frame.north+"&bboxSR=4326&imageSR=4326&size=512,512&format=jpg&f=image",900_000);
  return BitmapFactory.decodeByteArray(bytes,0,bytes.length);
 }
}

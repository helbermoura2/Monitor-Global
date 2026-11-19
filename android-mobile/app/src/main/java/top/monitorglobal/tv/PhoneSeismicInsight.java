package top.monitorglobal.tv;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

final class PhoneSeismicInsight {
 private PhoneSeismicInsight(){}

 static final class Report {
  final List<String> topics;
  final boolean model;
  Report(List<String> topics,boolean model){this.topics=topics;this.model=model;}
 }
 private static final Report UNAVAILABLE=new Report(List.of(),false);

 static Report focus(Alert event)throws Exception{
  if(event.id==null||event.id.length()<2||event.id.length()>170)return UNAVAILABLE;
  for(int attempt=0;attempt<10;attempt++){
   JSONObject report=request(event.id);
   if(!"seismic-insight-v1".equals(report.optString("version"))||
     !event.id.equals(report.optString("id")))return UNAVAILABLE;
   if("pending".equals(report.optString("status"))){
    if(attempt<9)Thread.sleep(3000);
    continue;
   }
   if(!"ready".equals(report.optString("status"))||
     Math.abs(report.optDouble("eventAt",0)-event.eventTime)>60000||
     !Double.isFinite(report.optDouble("magnitude"))||
     Math.abs(report.optDouble("magnitude")-event.magnitude)>.051)
    return UNAVAILABLE;
   String model=report.optString("model");
   boolean generated=model.startsWith("gemini-")||model.startsWith("@cf/");
   if(!generated&&!"validated-facts-v1".equals(model)&&!"validated-science-v1".equals(model))return UNAVAILABLE;
   JSONArray sections=report.optJSONArray("sections");
   if(sections==null||sections.length()!=6)return UNAVAILABLE;
   List<String> topics=new ArrayList<>();
   for(int index=0;index<sections.length();index++){
    JSONObject section=sections.optJSONObject(index);
    if(section!=null&&section.optBoolean("focus"))topics.add(section.optString("id"));
   }
   return new Report(topics,generated);
  }
  return UNAVAILABLE;
 }

 private static JSONObject request(String eventId)throws Exception{
  URL url=new URL("https://black-sky-9ba0.terrestre.workers.dev/seismic-insight?id="+
   URLEncoder.encode(eventId,"UTF-8"));
  HttpURLConnection connection=(HttpURLConnection)url.openConnection();
  connection.setConnectTimeout(4000);
  connection.setReadTimeout(5000);
  connection.setInstanceFollowRedirects(false);
  connection.setRequestProperty("Accept","application/json");
  try{
   if(connection.getResponseCode()!=200)throw new IOException("Análise indisponível");
   try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
    byte[] buffer=new byte[1024];
    int count;
    while((count=input.read(buffer))!=-1){
     if(output.size()+count>12000)throw new IOException("Resposta muito grande");
     output.write(buffer,0,count);
    }
    return new JSONObject(output.toString("UTF-8"));
   }
  }finally{
   connection.disconnect();
  }
 }
}

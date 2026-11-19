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

 static List<String> focus(Alert event)throws Exception{
  if(event.id==null||event.id.length()<2||event.id.length()>170)return List.of();
  for(int attempt=0;attempt<4;attempt++){
   JSONObject report=request(event.id);
   if(!"seismic-insight-v1".equals(report.optString("version"))||
     !event.id.equals(report.optString("id")))return List.of();
   if("pending".equals(report.optString("status"))){
    if(attempt<3)Thread.sleep(3000);
    continue;
   }
   if(!"ready".equals(report.optString("status"))||
     report.optLong("eventAt",-1)!=event.eventTime||
     Math.abs(report.optDouble("magnitude",-99)-event.magnitude)>.051)
    return List.of();
   String model=report.optString("model");
   if(!(model.startsWith("gemini-")||model.startsWith("@cf/")))return List.of();
   JSONArray sections=report.optJSONArray("sections");
   if(sections==null||sections.length()!=6)return List.of();
   List<String> topics=new ArrayList<>();
   for(int index=0;index<sections.length();index++){
    JSONObject section=sections.optJSONObject(index);
    if(section!=null&&section.optBoolean("focus"))topics.add(section.optString("id"));
   }
   return topics;
  }
  return List.of();
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

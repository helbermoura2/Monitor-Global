package top.monitorglobal.tv;
import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.*;import org.json.*;
final class FeedClient {
 static final String ENDPOINT="https://black-sky-9ba0.terrestre.workers.dev/tv-alerts";
 static final class Snapshot {List<Alert> alerts=new ArrayList<>();boolean quakeOk,tsunamiOk,unchanged,complete;String day="";long asOf;}
 private String etag="";
 Snapshot read() throws IOException,JSONException {return read("");}
 Snapshot history(String view) throws IOException,JSONException {if(!view.equals("daily")&&!view.equals("replay")&&!view.equals("completed"))throw new IOException("Histórico inválido");return read(view);}
 private Snapshot read(String view) throws IOException,JSONException {
  HttpURLConnection c=(HttpURLConnection)new URL(ENDPOINT+(view.isEmpty()?"":"?view="+view)).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(45000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MonitorGlobalTV/"+BuildConfig.VERSION_NAME);if(view.isEmpty()&&!etag.isEmpty())c.setRequestProperty("If-None-Match",etag);
  try{int status=c.getResponseCode();Snapshot out=new Snapshot();if(status==304){out.unchanged=true;return out;}if(status!=200)throw new IOException("Serviço indisponível ("+status+")");
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(bytes.size()+n>256*1024)throw new IOException("Resposta acima do limite");bytes.write(buffer,0,n);}}
   JSONObject root=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));if(!"tv-alerts-v1".equals(root.optString("version")))throw new IOException("Versão do serviço incompatível");JSONObject sources=root.getJSONObject("sources");out.quakeOk=sources.optBoolean("earthquake");out.tsunamiOk=sources.optBoolean("tsunami");if(!view.isEmpty()&&(!view.equals(root.optString("view"))||!root.optString("day").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")||root.optLong("asOf",0)<=0))throw new IOException("Histórico incompatível");out.complete=root.optBoolean("complete",false);out.day=root.optString("day","");out.asOf=root.optLong("asOf",0);JSONArray alerts=root.getJSONArray("alerts");
   for(int i=0;i<Math.min(alerts.length(),(view.equals("daily")||view.equals("completed"))?5:view.equals("replay")?1:120);i++){out.alerts.add(AlertCodec.read(alerts.getJSONObject(i)));}
   if(view.isEmpty()){String next=c.getHeaderField("ETag");etag=next==null?"":next;}return out;
  }finally{c.disconnect();}
 }
}

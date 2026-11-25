package top.monitorglobal.tv;

import android.os.SystemClock;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.json.*;

/** On-demand public INPE pilot; no new Worker, credentials or background polling. */
final class RadarMapClient implements AutoCloseable {
 static final String ROOT="https://data.inpe.br/bdc/stac/v1/search";
 static final String COLLECTION="br-weather-radar-cappi-1";
 private static final Set<String> PILOT=new HashSet<>(Arrays.asList("saoroque","picocouto"));
 static final class Item {
  final String radar,href;final long at;
  Item(String radar,String href,long at){this.radar=radar;this.href=href;this.at=at;}
 }
 static final class Frame {
  final long at;final List<String> radars;final List<RadarCappi> grids;
  Frame(long at,List<String> radars,List<RadarCappi> grids){this.at=at;this.radars=radars;this.grids=grids;}
  float sample(double lat,double lon){
   float max=Float.NaN;
   for(RadarCappi g:grids){float v=g.sample(lat,lon);if(Float.isFinite(v)&&(!Float.isFinite(max)||v>max))max=v;}
   return max;
  }
  String credit(){return "INPE / DECEA · "+String.join(" + ",radars)+" · CAPPI 3 km";}
 }
 private volatile boolean closed;private volatile HttpURLConnection connection;
 private long queried;private Frame cached;
 static List<Item> parse(String json,long now)throws JSONException{
  JSONArray list=new JSONObject(json).getJSONArray("features");
  TreeMap<Long,Map<String,Item>> frames=new TreeMap<>(Collections.reverseOrder());
  for(int i=0;i<Math.min(60,list.length());i++){
   try{
    JSONObject f=list.getJSONObject(i),p=f.getJSONObject("properties");
    String radar=p.getString("radar"),owner=p.getString("owner");
    if(!PILOT.contains(radar)||!"decea".equals(owner)||!COLLECTION.equals(f.optString("collection",COLLECTION)))continue;
    long at=Instant.parse(p.getString("datetime")).toEpochMilli();
    if(at<=0||at>now||now-at>60*60000L)continue;
    String href=f.getJSONObject("assets").getJSONObject("cappi3km").getString("href");
    if(!allowedAsset(href,radar))continue;
    frames.computeIfAbsent(at,k->new TreeMap<>()).putIfAbsent(radar,new Item(radar,href,at));
   }catch(RuntimeException|JSONException ignored){}
  }
  if(frames.isEmpty())return Collections.emptyList();
  // Never combine different observation times. Prefer the most recent common time,
  // provided it is no more than one acquisition interval behind the latest.
  long newest=frames.firstKey();
  for(Map.Entry<Long,Map<String,Item>> entry:frames.entrySet()){
   if(newest-entry.getKey()>10*60000L)break;
   if(entry.getValue().size()==2)return new ArrayList<>(entry.getValue().values());
  }
  return new ArrayList<>(frames.firstEntry().getValue().values());
 }
 static boolean allowedAsset(String address,String radar){
  try{
   URI u=URI.create(address);
   return "https".equals(u.getScheme())&&"data.inpe.br".equals(u.getHost())&&u.getUserInfo()==null&&
    u.getPort()==-1&&u.getQuery()==null&&u.getFragment()==null&&PILOT.contains(radar)&&
    u.getRawPath().matches("/bdc/data/br-weather-radar-cappi/decea/"+radar+"/cappi/cappi3km_nc/[0-9]{4}/[0-9]{2}/cappi3km_[0-9]{12}\\.nc");
  }catch(RuntimeException e){return false;}
 }
 Frame latest(long now)throws Exception{
  if(closed)throw new IOException("Cancelado");
  if(queried>0&&now>=queried&&now-queried<10*60000L){
   if(cached!=null&&now-cached.at<=60*60000L)return cached;
   throw new IOException("Nova tentativa em até 10 minutos");
  }
  queried=now;cached=null;
  long deadline=SystemClock.elapsedRealtime()+25000;
  String period=URLEncoder.encode(Instant.ofEpochMilli(now-3*3600000L)+"/"+Instant.ofEpochMilli(now),"UTF-8");
  String url=ROOT+"?collections="+COLLECTION+"&bbox=-47.8,-24.5,-45.5,-22.8&datetime="+period+"&limit=30";
  List<Item> items=parse(new String(read(url,4*1024*1024,deadline),StandardCharsets.UTF_8),now);
  List<RadarCappi> grids=new ArrayList<>();List<String> radars=new ArrayList<>();
  long at=0;
  for(Item item:items){
   try{
    RadarCappi grid=RadarCappi.decode(read(item.href,12*1024*1024,deadline));
    if(closed)throw new IOException("Cancelado");
    grids.add(grid);radars.add(item.radar.equals("saoroque")?"São Roque":"Pico do Couto");at=item.at;
   }catch(IOException failure){if(closed)throw failure;}
  }
  if(grids.isEmpty()||closed)throw new IOException("Radar indisponível");
  return cached=new Frame(at,radars,grids);
 }
 private byte[] read(String address,int limit,long deadline)throws IOException{
  if(closed||Thread.currentThread().isInterrupted())throw new IOException("Cancelado");
  long left=deadline-SystemClock.elapsedRealtime();if(left<=0)throw new IOException("Tempo esgotado");
  HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();connection=c;
  c.setInstanceFollowRedirects(false);c.setConnectTimeout((int)Math.min(5000,left));c.setReadTimeout((int)Math.min(8000,left));
  c.setRequestProperty("User-Agent","ArgosOrbisTV/"+BuildConfig.VERSION_NAME);
  try{
   if(closed||c.getResponseCode()!=200||c.getContentLengthLong()>limit)throw new IOException("Fonte indisponível");
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   try(InputStream in=c.getInputStream()){
    byte[] buf=new byte[8192];int n;
    while((n=in.read(buf))!=-1){
     if(closed||Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>deadline||out.size()+n>limit)throw new IOException("Limite de leitura");
     out.write(buf,0,n);
    }
   }
   return out.toByteArray();
  }finally{connection=null;c.disconnect();}
 }
 public void close(){closed=true;HttpURLConnection c=connection;if(c!=null)c.disconnect();cached=null;}
}

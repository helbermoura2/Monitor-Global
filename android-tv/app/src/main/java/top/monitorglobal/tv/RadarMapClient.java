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
 private long queried;private NavigableMap<Long,List<Item>> catalog=new TreeMap<>();private final LinkedHashMap<Long,Frame> history=new LinkedHashMap<>(8,0.75f,true);
 static List<Item> parse(String json,long now)throws JSONException{
  NavigableMap<Long,List<Item>> all=parseHistory(json,now);
  if(all.isEmpty())return Collections.emptyList();
  long newest=all.lastKey();for(Long at:all.descendingKeySet()){if(newest-at>10*60000L)break;if(all.get(at).size()==2)return all.get(at);}
  return all.lastEntry().getValue();
 }
 static NavigableMap<Long,List<Item>> parseHistory(String json,long now)throws JSONException{
  JSONArray list=new JSONObject(json).getJSONArray("features");
  TreeMap<Long,Map<String,Item>> frames=new TreeMap<>(Collections.reverseOrder());
  for(int i=0;i<Math.min(60,list.length());i++){
   try{
    JSONObject f=list.getJSONObject(i),p=f.getJSONObject("properties");
    String radar=p.getString("radar"),owner=p.getString("owner");
    if(!PILOT.contains(radar)||!"decea".equals(owner)||!COLLECTION.equals(f.optString("collection",COLLECTION)))continue;
    long at=Instant.parse(p.getString("datetime")).toEpochMilli();
    if(at<=0||at>now||now-at>180*60000L)continue;
    String href=f.getJSONObject("assets").getJSONObject("cappi3km").getString("href");
    if(!allowedAsset(href,radar)||!href.endsWith("cappi3km_"+java.time.format.DateTimeFormatter.ofPattern("uuuuMMddHHmm",Locale.ROOT).withZone(java.time.ZoneOffset.UTC).format(Instant.ofEpochMilli(at))+".nc"))continue;
    frames.computeIfAbsent(at,k->new TreeMap<>()).putIfAbsent(radar,new Item(radar,href,at));
   }catch(RuntimeException|JSONException ignored){}
  }
  NavigableMap<Long,List<Item>> result=new TreeMap<>();
  for(Map.Entry<Long,Map<String,Item>> entry:frames.entrySet()){
   if(result.size()>=6)break;
   result.put(entry.getKey(),new ArrayList<>(entry.getValue().values()));
  }
  return result;
 }
 static boolean allowedAsset(String address,String radar){
  try{
   URI u=URI.create(address);
   return "https".equals(u.getScheme())&&"data.inpe.br".equals(u.getHost())&&u.getUserInfo()==null&&
    u.getPort()==-1&&u.getQuery()==null&&u.getFragment()==null&&PILOT.contains(radar)&&
    u.getRawPath().matches("/bdc/data/br-weather-radar-cappi/decea/"+radar+"/cappi/cappi3km_nc/[0-9]{4}/[0-9]{2}/cappi3km_[0-9]{12}\\.nc");
  }catch(RuntimeException e){return false;}
 }
 List<Long> times(long now)throws Exception{
  refresh(now);return new ArrayList<>(catalog.keySet());
 }
 private void refresh(long now)throws Exception{
  if(closed)throw new IOException("Cancelado");
  if(queried>0&&now>=queried&&now-queried<10*60000L){
   if(catalog.isEmpty())throw new IOException("Nova tentativa em até 10 minutos");
   return;
  }
  queried=now;
  long deadline=SystemClock.elapsedRealtime()+25000;
  String period=URLEncoder.encode(Instant.ofEpochMilli(now-3*3600000L)+"/"+Instant.ofEpochMilli(now),"UTF-8");
  String url=ROOT+"?collections="+COLLECTION+"&bbox=-47.8,-24.5,-45.5,-22.8&datetime="+period+"&limit=60";
  NavigableMap<Long,List<Item>> result=parseHistory(new String(read(url,4*1024*1024,deadline),StandardCharsets.UTF_8),now);
  if(result.isEmpty())throw new IOException("Histórico indisponível");
  catalog=result;
  history.keySet().retainAll(catalog.keySet());
 }
 Frame latest(long now)throws Exception{
  refresh(now);
  for(long at:catalog.descendingKeySet()){
   if(now-at>60*60000L||at>now)continue;
   Frame f=frame(at,now);if(f!=null)return f;
  }
  throw new IOException("Radar recente indisponível");
 }
 Frame frame(long at,long now)throws Exception{
  if(closed||at>now||now-at>180*60000L)throw new IOException("Quadro indisponível");
  Frame existing=history.get(at);if(existing!=null)return existing;
  List<Item> items=catalog.get(at);if(items==null)throw new IOException("Quadro não publicado");
  long deadline=SystemClock.elapsedRealtime()+25000;
  List<RadarCappi> grids=new ArrayList<>();List<String> radars=new ArrayList<>();
  for(Item item:items){
   try{
    RadarCappi grid=RadarCappi.decode(read(item.href,12*1024*1024,deadline));
    if(closed)throw new IOException("Cancelado");
    grids.add(grid);radars.add(item.radar.equals("saoroque")?"São Roque":"Pico do Couto");
   }catch(IOException failure){if(closed)throw failure;}
  }
  if(grids.isEmpty()||closed)throw new IOException("Radar indisponível");
  Frame result=new Frame(at,radars,grids);history.put(at,result);
  while(history.size()>2)history.remove(history.keySet().iterator().next());
  return result;
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
 public void close(){closed=true;HttpURLConnection c=connection;if(c!=null)c.disconnect();history.clear();catalog.clear();}
}

package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import android.os.SystemClock;import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.*;import org.json.*;
/** Bounded native snapshots. No WebView, background polling or retained decoded history. */
final class WeatherSatelliteClient implements AutoCloseable {
 interface Reader {byte[] read(String url,int limit,long deadline)throws Exception;default void close(){}}
 enum Source {NASA,REALEARTH}
 static final class Frame implements AutoCloseable {
  final Bitmap image,legend;final long at;final InfraredPlan.Scope scope;final List<Long> times;final Source source;
  Frame(Bitmap image,Bitmap legend,long at,InfraredPlan.Scope scope,List<Long> times){this(image,legend,at,scope,times,Source.NASA);}
  Frame(Bitmap image,Bitmap legend,long at,InfraredPlan.Scope scope,List<Long> times,Source source){this.image=image;this.legend=legend;this.at=at;this.scope=scope;this.times=new ArrayList<>(times);this.source=source;}
  String credit(){return source==Source.REALEARTH?"GOES-East · SSEC RealEarth / NOAA":"GOES-East · NASA GIBS / NOAA";}
  String legendDescription(){return source==Source.REALEARTH?"Legenda original infravermelha SSEC RealEarth":"Legenda original de temperatura infravermelha NASA";}
  public void close(){if(!image.isRecycled())image.recycle();if(legend!=null&&!legend.isRecycled())legend.recycle();}
 }
 private final Context context;private final Reader reader;private volatile boolean closed;private final LinkedHashMap<String,byte[]> cache=new LinkedHashMap<>();private int cacheBytes;private final Map<Source,byte[]> legends=new EnumMap<>(Source.class);private List<Long> times=new ArrayList<>(),nasaTimes=new ArrayList<>(),realTimes=new ArrayList<>();private long queried;private final Set<String> rejected=new HashSet<>();
 WeatherSatelliteClient(Context c){this(c,new Network());}WeatherSatelliteClient(Context c,Reader r){context=c.getApplicationContext();reader=r;}
 List<Long> available(long now,boolean force)throws Exception{
  if(closed)return Collections.emptyList();
  if(force||times.isEmpty()||now-queried>60000){
   // A slow provider cannot prevent consulting the alternative. No polling outside a presentation.
   long start=SystemClock.elapsedRealtime();List<Long> real=new ArrayList<>(),nasa=new ArrayList<>();
   try{real=RealEarthPlan.frames(new String(reader.read(RealEarthPlan.METADATA,131072,start+4000),StandardCharsets.UTF_8),now);}catch(Exception ignored){}
   if(!closed&&!Thread.currentThread().isInterrupted())try{nasa=InfraredPlan.frames(new String(reader.read(InfraredPlan.domains(now),131072,SystemClock.elapsedRealtime()+4000),StandardCharsets.UTF_8),now);}catch(Exception ignored){}
   if(closed)return Collections.emptyList();realTimes=real;nasaTimes=nasa;times=new ArrayList<>(newest(real)>=newest(nasa)?real:nasa);queried=now;rejected.clear();
  }
  return new ArrayList<>(times);
 }
 private long newest(List<Long> list){return list.isEmpty()?Long.MIN_VALUE:list.get(list.size()-1);}
 Frame latest(InfraredPlan.Scope scope,long now)throws Exception{
  long deadline=SystemClock.elapsedRealtime()+20000;available(now,false);TreeSet<Long> candidates=new TreeSet<>(nasaTimes);candidates.addAll(realTimes);int tried=0;
  for(Iterator<Long> it=candidates.descendingIterator();it.hasNext()&&!closed&&tried<6&&SystemClock.elapsedRealtime()<deadline;tried++){
   long at=it.next();try{Frame f=frame(scope,at,now,deadline);if(f!=null)return f;}catch(IOException error){if(closed||Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>=deadline)break;rejected.add(key(scope,at));}
  }return null;
 }
 private Source source(long at){return realTimes.contains(at)?Source.REALEARTH:Source.NASA;}
 private String key(InfraredPlan.Scope scope,long at){return source(at)+":"+scope.name+"@"+at;}
 Frame frame(InfraredPlan.Scope scope,long at,long now)throws Exception{return frame(scope,at,now,SystemClock.elapsedRealtime()+15000);}
 private Frame frame(InfraredPlan.Scope scope,long at,long now,long deadline)throws Exception{
  if(closed||!(nasaTimes.contains(at)||realTimes.contains(at))||now-at>InfraredPlan.MAX_AGE||at>now)return null;Source provider=source(at);String key=key(scope,at);if(rejected.contains(key))return null;byte[] bytes;synchronized(cache){bytes=cache.get(key);}boolean fresh=bytes==null;Bitmap decoded=null,output=null;
  try{if(fresh)bytes=reader.read(provider==Source.REALEARTH?RealEarthPlan.image(scope,at):InfraredPlan.image(scope,at),1800000,deadline);if(closed)return null;BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);if(bounds.outWidth!=InfraredPlan.WIDTH||bounds.outHeight!=scope.height)return null;decoded=BitmapFactory.decodeByteArray(bytes,0,bytes.length);if(decoded==null)return null;
   Path outline=outline(scope);output=Bitmap.createBitmap(InfraredPlan.WIDTH,scope.height,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(output);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);canvas.save();canvas.clipPath(outline);canvas.drawColor(Color.WHITE);canvas.restore();int[] pixels=new int[output.getWidth()*output.getHeight()];output.getPixels(pixels,0,output.getWidth(),0,0,output.getWidth(),output.getHeight());int expected=0;for(int i=0;i<pixels.length;i+=97)if(Color.alpha(pixels[i])>0)expected++;
   canvas.drawColor(Color.TRANSPARENT,PorterDuff.Mode.CLEAR);canvas.save();canvas.clipPath(outline);canvas.drawBitmap(decoded,0,0,paint);canvas.restore();output.getPixels(pixels,0,output.getWidth(),0,0,output.getWidth(),output.getHeight());int covered=0;for(int i=0;i<pixels.length;i+=97)if(Color.alpha(pixels[i])>0)covered++;if(expected<20||covered<expected*.98){rejected.add(key);output.recycle();output=null;return null;}
   // Keep the entire RealEarth product, including its attribution watermark, after coverage validation.
   if(provider==Source.REALEARTH){canvas.drawColor(Color.TRANSPARENT,PorterDuff.Mode.CLEAR);canvas.drawBitmap(decoded,0,0,paint);}
   canvas.drawColor(0xff102d40,PorterDuff.Mode.DST_OVER);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.1f*InfraredPlan.WIDTH/512f);paint.setColor(0xaae7f5ff);canvas.drawPath(outline,paint);paint.setStyle(Paint.Style.FILL);paint.setTypeface(Typeface.DEFAULT_BOLD);paint.setTextSize((scope==InfraredPlan.SOUTHEAST?18:15)*InfraredPlan.WIDTH/512f);paint.setShadowLayer(3,0,1,Color.BLACK);city(canvas,paint,scope,-46.63,-23.55,"São Paulo");if(scope==InfraredPlan.SOUTHEAST){city(canvas,paint,scope,-43.20,-22.90,"Rio de Janeiro");city(canvas,paint,scope,-43.94,-19.92,"Belo Horizonte");}
   if(fresh){synchronized(cache){if(!closed){cache.put(key,bytes);cacheBytes+=bytes.length;while(cache.size()>6||cacheBytes>4194304){String oldest=cache.keySet().iterator().next();cacheBytes-=cache.remove(oldest).length;}}}}
   String legendUrl=provider==Source.REALEARTH?RealEarthPlan.LEGEND:InfraredPlan.LEGEND;
   if(!legends.containsKey(provider)&&!closed)try{byte[] fetched=reader.read(legendUrl,150000,deadline);if(!closed)legends.put(provider,fetched);}catch(Exception ignored){}
   Bitmap scale=null;byte[] scaleBytes=legends.get(provider);if(scaleBytes!=null){BitmapFactory.Options b=new BitmapFactory.Options();b.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(scaleBytes,0,scaleBytes.length,b);boolean valid=provider==Source.REALEARTH?b.outWidth==320&&b.outHeight>0&&b.outHeight<=200:b.outWidth==420&&b.outHeight==95;if(valid)scale=BitmapFactory.decodeByteArray(scaleBytes,0,scaleBytes.length);}
   if(closed){if(scale!=null)scale.recycle();output.recycle();output=null;return null;}List<Long> usable=new ArrayList<>();for(long time:provider==Source.REALEARTH?realTimes:nasaTimes)if(!rejected.contains(key(scope,time)))usable.add(time);Frame result=new Frame(output,scale,at,scope,usable,provider);output=null;return result;
  }finally{if(decoded!=null)decoded.recycle();if(output!=null&&!output.isRecycled())output.recycle();}
 }
 private void city(Canvas canvas,Paint p,InfraredPlan.Scope scope,double lon,double lat,String name){float x=scope.x(lon),y=scope.y(lat);float scale=InfraredPlan.WIDTH/512f;if(x<8*scale||y<8*scale||x>InfraredPlan.WIDTH-8*scale||y>scope.height-8*scale)return;p.setColor(Color.WHITE);canvas.drawCircle(x,y,3*scale,p);float text=Math.min(InfraredPlan.WIDTH-p.measureText(name)-5*scale,x+7*scale);canvas.drawText(name,Math.max(5*scale,text),y-7*scale,p);}
 private Path outline(InfraredPlan.Scope scope)throws Exception{byte[] data;try(InputStream in=context.getAssets().open("data/brazil-satellite-border.json")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>100000)throw new IOException("Contorno inválido");out.write(b,0,n);}data=out.toByteArray();}JSONObject root=new JSONObject(new String(data,StandardCharsets.UTF_8));if(!root.optString("type").equals("MultiPolygon"))throw new IOException("Contorno ausente");JSONArray polys=root.getJSONArray("coordinates");Path path=new Path();path.setFillType(Path.FillType.EVEN_ODD);int count=0;for(int p=0;p<polys.length();p++){JSONArray rings=polys.getJSONArray(p);for(int r=0;r<rings.length();r++){JSONArray ring=rings.getJSONArray(r);for(int i=0;i<ring.length();i++){JSONArray point=ring.getJSONArray(i);double lon=point.getDouble(0),lat=point.getDouble(1);if(!Double.isFinite(lon)||!Double.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85||++count>15000)throw new IOException("Contorno inválido");float x=scope.x(lon),y=scope.y(lat);if(i==0)path.moveTo(x,y);else path.lineTo(x,y);}path.close();}}if(count<4)throw new IOException("Contorno vazio");return path;}
 int cacheBytes(){synchronized(cache){return cacheBytes;}}
 public void close(){closed=true;reader.close();synchronized(cache){cache.clear();cacheBytes=0;}legends.clear();}
 private static final class Network implements Reader {private volatile boolean closed;private volatile HttpURLConnection active;public byte[] read(String address,int limit,long deadline)throws Exception{if(closed||Thread.currentThread().isInterrupted())throw new IOException("Cancelado");URL url=new URL(address);if(!url.getProtocol().equals("https")||!(url.getHost().equals("gibs.earthdata.nasa.gov")||url.getHost().equals("realearth.ssec.wisc.edu")))throw new IOException("Fonte inválida");long remaining=deadline-SystemClock.elapsedRealtime();if(remaining<=0)throw new IOException("Tempo esgotado");HttpURLConnection c=(HttpURLConnection)url.openConnection();active=c;c.setInstanceFollowRedirects(false);c.setConnectTimeout((int)Math.min(4000,remaining));c.setReadTimeout((int)Math.min(8000,remaining));c.setUseCaches(false);c.setRequestProperty("User-Agent","MonitorGlobalTV/"+BuildConfig.VERSION_NAME);try{if(closed||c.getResponseCode()!=200||c.getContentLengthLong()>limit)throw new IOException("Fonte indisponível");ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(closed||Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>deadline||out.size()+n>limit)throw new IOException("Limite da fonte");out.write(buffer,0,n);}}return out.toByteArray();}finally{if(active==c)active=null;c.disconnect();}}public void close(){closed=true;HttpURLConnection c=active;if(c!=null)c.disconnect();}}
}

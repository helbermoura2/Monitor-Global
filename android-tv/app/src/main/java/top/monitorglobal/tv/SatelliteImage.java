package top.monitorglobal.tv;
import android.graphics.*;import android.os.SystemClock;import java.io.*;import java.net.*;import java.util.*;
/** Esri cartography matches the share-card basemap; fallback stays offline-safe. */
final class SatelliteImage {
 private static final String ROOT="https://server.arcgisonline.com/ArcGIS/rest/services/";
 static final String REFERENCE="Reference/World_Boundaries_and_Places";
 private volatile boolean closed;private volatile HttpURLConnection active;
 void close(){closed=true;HttpURLConnection c=active;if(c!=null)c.disconnect();}
 Bitmap load(MapFrame f){
  if(!f.valid()||closed)return null;
  long deadline=SystemClock.elapsedRealtime()+6500;
  // Telegram uses the Esri export basemap and the transparent city/boundary layer.
  // A single export keeps the same labels at 620x300, rather than stitching
  // low-resolution tiles that can land on different zoom or boundary edges.
  if(f.west>=-180&&f.east<=180&&f.south>-85&&f.north<85){
   Bitmap image=export("World_Imagery",f,false,deadline);
   if(image==null)image=export("World_Topo_Map",f,false,deadline);
   if(image!=null){
    Bitmap labels=export(REFERENCE,f,true,deadline);
    if(labels!=null){Canvas c=new Canvas(image);Paint p=new Paint(Paint.FILTER_BITMAP_FLAG);c.drawBitmap(labels,0,0,p);labels.recycle();}
    if(!closed)return image;image.recycle();return null;
   }
  }
  return tiles(f,deadline);
 }
 private Bitmap export(String layer,MapFrame f,boolean transparent,long deadline){
  String bbox=f.west+","+f.south+","+f.east+","+f.north;
  String url=ROOT+layer+"/MapServer/export?bbox="+URLEncoder.encode(bbox,java.nio.charset.StandardCharsets.UTF_8)
    +"&bboxSR=4326&imageSR=4326&size=620,300&dpi=144&format="+(transparent?"png32":"png")
    +"&transparent="+transparent+"&f=image";
  return download(url,deadline,620,300,1500000);
 }
 private Bitmap download(String url,long deadline,int width,int height,int limit){
  if(closed||Thread.currentThread().isInterrupted())return null;
  long remain=deadline-SystemClock.elapsedRealtime();if(remain<=0)return null;
  HttpURLConnection connection=null;
  try{
   connection=(HttpURLConnection)new URL(url).openConnection();active=connection;connection.setInstanceFollowRedirects(false);
   int timeout=(int)Math.min(2200,remain);connection.setConnectTimeout(timeout);connection.setReadTimeout(timeout);
   connection.setRequestProperty("User-Agent","ArgosOrbisTV/1.0");
   if(connection.getResponseCode()!=200||connection.getContentLengthLong()>limit)return null;
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   try(InputStream in=connection.getInputStream()){byte[] chunk=new byte[8192];int n;
    while((n=in.read(chunk))!=-1){if(closed||Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>deadline||bytes.size()+n>limit)return null;bytes.write(chunk,0,n);}}
   byte[] payload=bytes.toByteArray();BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;
   BitmapFactory.decodeByteArray(payload,0,payload.length,o);
   if(o.outWidth!=width||o.outHeight!=height)return null;
   return BitmapFactory.decodeByteArray(payload,0,payload.length);
  }catch(IOException|RuntimeException e){return null;}finally{active=null;if(connection!=null)connection.disconnect();}
 }
 private Bitmap tiles(MapFrame f,long deadline){
  List<SatellitePlan.Tile> tiles=SatellitePlan.tiles(f);if(tiles.isEmpty()||closed)return null;
  Bitmap result=Bitmap.createBitmap(620,300,Bitmap.Config.RGB_565);Canvas canvas=new Canvas(result);
  canvas.scale(2,2);Paint paint=new Paint(Paint.FILTER_BITMAP_FLAG);
  for(SatellitePlan.Tile tile:tiles){Bitmap b=fetch("World_Imagery",tile,deadline);if(b==null){result.recycle();return null;}project(canvas,b,tile,f,paint);b.recycle();}
  for(SatellitePlan.Tile tile:tiles){Bitmap b=fetch(REFERENCE,tile,deadline);if(b==null)break;project(canvas,b,tile,f,paint);b.recycle();}
  if(closed){result.recycle();return null;}return result;
 }
 private Bitmap fetch(String layer,SatellitePlan.Tile t,long deadline){
  return download(ROOT+layer+"/MapServer/tile/"+t.z+"/"+t.y+"/"+t.x,deadline,256,256,524288);
 }
 private static void project(Canvas c,Bitmap b,SatellitePlan.Tile tile,MapFrame f,Paint p){
  // Existing equirectangular strip reprojection, including the date line.
  double n=1<<tile.z;float left=(float)((tile.west-f.west)/(f.east-f.west)*310),right=(float)((tile.east-f.west)/(f.east-f.west)*310);
  for(int j=0;j<16;j++){int y0=j*16,y1=y0+16;float top=f.y(SatellitePlan.latitude(tile.y+y0/256.0,(int)n)),bottom=f.y(SatellitePlan.latitude(tile.y+y1/256.0,(int)n));c.drawBitmap(b,new Rect(0,y0,256,y1),new RectF(left,top,right,bottom),p);}
 }
}

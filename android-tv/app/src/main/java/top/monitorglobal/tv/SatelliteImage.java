package top.monitorglobal.tv;
import android.graphics.*;import android.os.SystemClock;import java.io.*;import java.net.*;import java.util.*;
/** Fixed official tile hosts, no polling, WebView or full-size imagery retained. */
final class SatelliteImage {
 private static final String ROOT="https://server.arcgisonline.com/ArcGIS/rest/services/";
 private volatile boolean closed;private volatile HttpURLConnection active;
 void close(){closed=true;HttpURLConnection c=active;if(c!=null)c.disconnect();}
 Bitmap load(MapFrame f){
  List<SatellitePlan.Tile> tiles=SatellitePlan.tiles(f);if(tiles.isEmpty()||closed)return null;
  long deadline=SystemClock.elapsedRealtime()+6000;Bitmap result=Bitmap.createBitmap(620,300,Bitmap.Config.RGB_565);Canvas canvas=new Canvas(result);canvas.scale(2,2);Paint paint=new Paint(Paint.FILTER_BITMAP_FLAG);boolean complete=true;
  for(SatellitePlan.Tile tile:tiles){Bitmap b=fetch("World_Imagery",tile,deadline);if(b==null){complete=false;break;}project(canvas,b,tile,f,paint);b.recycle();}
  if(!complete||closed){result.recycle();return null;}
  for(SatellitePlan.Tile tile:tiles){Bitmap b=fetch("Reference/World_Boundaries_and_Places",tile,deadline);if(b==null)break;project(canvas,b,tile,f,paint);b.recycle();}
  if(closed){result.recycle();return null;}return result;
 }
 private Bitmap fetch(String layer,SatellitePlan.Tile t,long deadline){
  if(closed||Thread.currentThread().isInterrupted())return null;long remain=deadline-SystemClock.elapsedRealtime();if(remain<=0)return null;
  HttpURLConnection c=null;try{
   c=(HttpURLConnection)new URL(ROOT+layer+"/MapServer/tile/"+t.z+"/"+t.y+"/"+t.x).openConnection();active=c;c.setInstanceFollowRedirects(false);int timeout=(int)Math.min(1500,remain);c.setConnectTimeout(timeout);c.setReadTimeout(timeout);c.setRequestProperty("User-Agent","MonitorGlobalTV/1.0.16");
   if(closed||c.getResponseCode()!=200||c.getContentLengthLong()>524288)return null;
   ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] chunk=new byte[8192];int n;while((n=in.read(chunk))!=-1){if(closed||Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>deadline||out.size()+n>524288)return null;out.write(chunk,0,n);}}
   byte[] bytes=out.toByteArray();BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);if(bounds.outWidth!=256||bounds.outHeight!=256)return null;
   return BitmapFactory.decodeByteArray(bytes,0,bytes.length);
  }catch(IOException|RuntimeException e){return null;}finally{active=null;if(c!=null)c.disconnect();}
 }
 private static void project(Canvas c,Bitmap b,SatellitePlan.Tile tile,MapFrame f,Paint p){
  // Strip reprojection keeps coast overlays aligned with latitude, including the date line.
  double n=1<<tile.z;float left=(float)((tile.west-f.west)/(f.east-f.west)*310),right=(float)((tile.east-f.west)/(f.east-f.west)*310);
  for(int j=0;j<16;j++){int y0=j*16,y1=y0+16;float top=f.y(SatellitePlan.latitude(tile.y+y0/256.0,(int)n)),bottom=f.y(SatellitePlan.latitude(tile.y+y1/256.0,(int)n));c.drawBitmap(b,new Rect(0,y0,256,y1),new RectF(left,top,right,bottom),p);}
 }
}

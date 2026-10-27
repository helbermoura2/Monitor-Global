package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import java.util.*;import java.util.concurrent.*;import java.io.*;import org.json.*;
/** Offline geographic inset. One bounded preparation worker per visible banner, no polling/DO/GPU maps. */
final class MapInset {
 private static float[][] land;
 private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final IdentityHashMap<Alert,Drawing> ready=new IdentityHashMap<>();
 private volatile boolean closed;
 private final Context context;private final Runnable invalidate;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path clip=new Path();
 private static final class Stroke {Path path;int color;Stroke(Path p,int c){path=p;color=c;}}
 private static final class Drawing {Path land;List<Stroke> shores=new ArrayList<>();Float x,y;boolean partial,tsunami,located;String heading,note;}
 MapInset(Context context,Runnable invalidate){this.context=context.getApplicationContext();this.invalidate=invalidate;clip.addRoundRect(0,0,310,176,8,8,Path.Direction.CW);}
 void prepare(Alert a){worker.execute(()->{Drawing drawing;try{drawing=build(a);}catch(Exception e){drawing=new Drawing();drawing.tsunami=a.kind.equals("tsunami");drawing.partial=true;}drawing.heading=a.kind.equals("tsunami")?NewsBannerView.tsunamiLabel(a.state).split(" · ")[0]:"LOCAL DO EPICENTRO";drawing.note=!drawing.located?"Localização indisponível":drawing.tsunami?(drawing.partial?"Referência parcial · consulte o boletim":"Costas citadas · não representa inundação"):"Referência geográfica · Natural Earth";if(closed)return;Drawing value=drawing;main.post(()->{if(!closed){ready.put(a,value);invalidate.run();}});});}
 private static synchronized float[][] land(Context context) throws Exception {
  if(land!=null)return land;
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=context.getAssets().open("maps/land.json")){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedException();bytes.write(b,0,n);}}
  JSONArray rings=new JSONArray(bytes.toString("UTF-8"));float[][] out=new float[rings.length()][];
  for(int i=0;i<out.length;i++){JSONArray pts=rings.getJSONArray(i);out[i]=new float[pts.length()*2];for(int j=0;j<pts.length();j++){out[i][j*2]=(float)pts.getJSONArray(j).getDouble(0);out[i][j*2+1]=(float)pts.getJSONArray(j).getDouble(1);}}
  land=out;return out;
 }
 private Drawing build(Alert a) throws Exception {
  Drawing d=new Drawing();d.tsunami=a.kind.equals("tsunami");MapFrame f=null;JSONObject map=null;
  if(d.tsunami&&!a.mapJson.isEmpty())map=new JSONObject(a.mapJson);
  else if(d.tsunami&&a.id.startsWith("demo-")){
   try(InputStream in=context.getAssets().open("maps/demo-vanuatu.json")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)bytes.write(b,0,n);map=new JSONObject(bytes.toString("UTF-8"));}
   String color=a.state.equals("ended")?"#94a3b8":a.state.equals("noThreat")?"#70c9b5":"#fb7148";JSONArray lines=map.getJSONArray("lines");for(int i=0;i<lines.length();i++)lines.getJSONObject(i).put("color",color);
  }
  if(map!=null){JSONObject b=map.getJSONObject("frame");f=new MapFrame(b.getDouble("minLon"),b.getDouble("maxLon"),b.getDouble("minLat"),b.getDouble("maxLat"));d.partial=map.optBoolean("partial");}
  if(f==null&&MapFrame.located(a.originLongitude,a.originLatitude))f=MapFrame.epicenter(a.originLongitude,a.originLatitude);
  if(f==null||!f.valid()){d.partial=true;return d;}d.located=true;
  d.land=new Path();d.land.setFillType(Path.FillType.EVEN_ODD);
  for(float[] ring:land(context)){
   if(Thread.currentThread().isInterrupted())throw new InterruptedException();
   float minX=Float.MAX_VALUE,maxX=-Float.MAX_VALUE,minY=Float.MAX_VALUE,maxY=-Float.MAX_VALUE;Path p=new Path();float previous=0;boolean split=false;
   for(int j=0;j<ring.length;j+=2){float x=f.x(ring[j]),y=f.y(ring[j+1]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(j==0)p.moveTo(x,y);else if(Math.abs(x-previous)>310*180/(f.east-f.west)){p.moveTo(x,y);split=true;}else p.lineTo(x,y);previous=x;}
   if(!split)p.close();if(maxX>=0&&minX<=310&&maxY>=0&&minY<=150)d.land.addPath(p);
  }
  if(MapFrame.located(a.originLongitude,a.originLatitude)){d.x=f.x(a.originLongitude);d.y=f.y(a.originLatitude);}
  if(map!=null){JSONArray lines=map.optJSONArray("lines");if(lines!=null)for(int i=0;i<Math.min(80,lines.length());i++){JSONObject line=lines.getJSONObject(i);JSONArray pts=line.getJSONArray("points");Path path=new Path();float prev=0;
   for(int j=0;j<Math.min(500,pts.length());j++){JSONArray xy=pts.getJSONArray(j);float x=f.x(xy.getDouble(0)),y=f.y(xy.getDouble(1));if(j==0||Math.abs(x-prev)>310*180/(f.east-f.west))path.moveTo(x,y);else path.lineTo(x,y);prev=x;}
   d.shores.add(new Stroke(path,Color.parseColor(line.getString("color"))));
  }}
  if(d.tsunami&&d.shores.isEmpty())d.partial=true;return d;
 }
 void draw(Canvas c,Alert a,Typeface font,int accent){
  c.save();c.clipPath(clip);paint.setStyle(Paint.Style.FILL);paint.setColor(0xff091f2c);c.drawRect(0,0,310,176,paint);
  Drawing d=ready.get(a);
  if(d!=null&&d.land!=null){paint.setColor(0xff234653);c.drawPath(d.land,paint);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(.65f);paint.setColor(0xff456776);c.drawPath(d.land,paint);}
  if(d!=null){for(Stroke s:d.shores){paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(4);paint.setColor(s.color);paint.setAlpha(55);c.drawPath(s.path,paint);paint.setStrokeWidth(1.8f);paint.setAlpha(255);c.drawPath(s.path,paint);}paint.setStyle(Paint.Style.FILL);
   if(d.x!=null&&d.y!=null){paint.setColor(Color.WHITE);c.drawCircle(d.x,d.y,4.5f,paint);paint.setColor(0xffef5350);c.drawCircle(d.x,d.y,3,paint);}
  }
  paint.setStyle(Paint.Style.FILL);paint.setColor(0xe6071724);c.drawRect(0,0,310,22,paint);c.drawRect(0,150,310,176,paint);paint.setColor(Color.WHITE);paint.setTypeface(font);paint.setTextSize(14);
  c.drawText(d==null?"MAPA REGIONAL":d.heading,10,16,paint);paint.setTextSize(10);paint.setColor(0xffb4c9ce);
  String note=d==null?"Preparando mapa…":d.note;
  c.drawText(note,10,167,paint);c.restore();paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1);paint.setColor(accent);c.drawRoundRect(0,0,310,176,8,8,paint);paint.setStyle(Paint.Style.FILL);
 }
 void close(){closed=true;worker.shutdownNow();main.removeCallbacksAndMessages(null);ready.clear();}
}

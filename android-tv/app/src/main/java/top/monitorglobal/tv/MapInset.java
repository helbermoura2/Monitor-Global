package top.monitorglobal.tv;
import android.content.Context;import android.graphics.*;import java.util.*;import java.util.concurrent.*;import java.io.*;import org.json.*;
/** Satellite inset with immediate offline fallback and one bounded preparation worker. */
final class MapInset {
 /** Shared TV map viewport: frame ends at the OLED lower-third's right edge.
  * M6+, Brasil, regional/replay and weather/infrared all use the same anchor.
  * Do not hardcode a left coordinate: 649 + 310 previously overshot the 925 right edge by 34.
  */
 static final float FRAME_WIDTH=200f, FRAME_HEIGHT=250f;
 static final float MAP_TOP=24f, MAP_HEIGHT=180f;
 static float portraitWidth(float physicalHeight,float xScale){return physicalHeight*.8f/xScale;}
 static int insetDp(Context c){android.util.DisplayMetrics m=c.getResources().getDisplayMetrics();int available=(int)(m.heightPixels/m.density)-126-64;return available<80?0:Math.min(230,available);}
 static int begin(Canvas c,float sx,float sy,float mapSpace,float bodyHeight,boolean below,float reveal,boolean full){
  float height=mapSpace-4f,width=portraitWidth(height*sy,sx),slide=(1-reveal)*(full?24:14);
  int save=c.save();c.clipRect(0,below?bodyHeight:0,960,below?bodyHeight+mapSpace:mapSpace);
  c.translate(OledNewsChrome.RIGHT-width,below?bodyHeight+4-slide:slide);c.scale(width/FRAME_WIDTH,height/FRAME_HEIGHT);c.clipRect(0,0,FRAME_WIDTH,FRAME_HEIGHT);return save;
 }
 static MapFrame portraitFrame(MapFrame f){
  double w=f.east-f.west,h=f.north-f.south,ratio=FRAME_WIDTH/MAP_HEIGHT;
  double halfW=Math.max(w,h*ratio)/2,halfH=halfW/ratio;
  if(halfW>180||halfH>90||f.south< -90||f.north>90)return f;
  double x=(f.west+f.east)/2,y=Math.max(-90+halfH,Math.min(90-halfH,(f.south+f.north)/2));
  return new MapFrame(x-halfW,x+halfW,y-halfH,y+halfH);
 }
 static RectF mapArea(MapFrame f){
  if(f==null)return new RectF(0,MAP_TOP,FRAME_WIDTH,MAP_TOP+MAP_HEIGHT);
  double ratio=(f.east-f.west)/(f.north-f.south);float w=(float)Math.min(FRAME_WIDTH,MAP_HEIGHT*ratio),h=(float)Math.min(MAP_HEIGHT,FRAME_WIDTH/ratio);
  return new RectF((FRAME_WIDTH-w)/2,MAP_TOP+(MAP_HEIGHT-h)/2,(FRAME_WIDTH+w)/2,MAP_TOP+(MAP_HEIGHT+h)/2);
 }
 static float mapX(MapFrame f,RectF area,double lon){return area.left+f.x(lon)*area.width()/310f;}
 static float mapY(MapFrame f,RectF area,double lat){return area.top+f.y(lat)*area.height()/150f;}
 static float slideY(boolean below,float slide){return below?4f-slide:slide;}
 private static float[][] land;
 private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final IdentityHashMap<Alert,Drawing> ready=new IdentityHashMap<>();
 private volatile boolean closed;private final SatelliteImage satellite=new SatelliteImage();
 private final Context context;private final Runnable invalidate;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path clip=new Path();
 private static final class Stroke {Path path;int color;Stroke(Path p,int c){path=p;color=c;}}
 private static final class Drawing {MapFrame frame;RectF area;Bitmap image;Path land;List<Stroke> shores=new ArrayList<>();Float x,y;boolean partial,tsunami,located;String heading,note;}
 MapInset(Context context,Runnable invalidate){this.context=context.getApplicationContext();this.invalidate=invalidate;clip.addRoundRect(0,0,FRAME_WIDTH,FRAME_HEIGHT,5,5,Path.Direction.CW);}
 private void submit(Runnable task){if(closed)return;try{worker.execute(task);}catch(RejectedExecutionException closedDuringSubmit){if(!closed)throw closedDuringSubmit;}}
 void prepare(Alert a){submit(()->{Drawing drawing;try{drawing=build(a);}catch(Exception e){drawing=new Drawing();drawing.tsunami=a.kind.equals("tsunami");drawing.partial=true;}drawing.heading=a.kind.equals("weather")?"MAPA · LIBERDADE / SP":a.kind.equals("tsunami")?NewsBannerView.tsunamiLabel(a.state).split(" · ")[0]:a.compact?"EPICENTRO · SISMO REGIONAL":"LOCAL DO EPICENTRO";drawing.note=!drawing.located?"Localização indisponível":a.kind.equals("weather")?"Local de referência · sem dados de radar":drawing.tsunami?(drawing.partial?"Referência parcial · consulte o boletim":"Costas citadas · não representa inundação"):"Referência geográfica · Natural Earth";if(closed)return;Drawing value=drawing;main.post(()->{if(!closed){ready.put(a,value);invalidate.run();}});if(value.frame!=null&&!closed)submit(()->{Bitmap image=satellite.load(value.frame);if(image==null)return;main.post(()->{if(closed){image.recycle();return;}value.image=image;value.note=a.kind.equals("weather")?"Mapa Esri · relevo e referências":value.tsunami?(value.partial?"Costas: referência parcial · Esri":"Costas citadas · não indica inundação · Esri"):"Mapa Esri · relevo e referências";invalidate.run();});});});}
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
  if(f==null||!f.valid()){d.partial=true;return d;}d.located=true;f=portraitFrame(f);d.frame=f;d.area=mapArea(f);
  d.land=new Path();d.land.setFillType(Path.FillType.EVEN_ODD);
  for(float[] ring:land(context)){
   if(Thread.currentThread().isInterrupted())throw new InterruptedException();
   float minX=Float.MAX_VALUE,maxX=-Float.MAX_VALUE,minY=Float.MAX_VALUE,maxY=-Float.MAX_VALUE;Path p=new Path();float previous=0;boolean split=false;
   for(int j=0;j<ring.length;j+=2){float x=mapX(f,d.area,ring[j]),y=mapY(f,d.area,ring[j+1]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(j==0)p.moveTo(x,y);else if(Math.abs(x-previous)>d.area.width()*180/(f.east-f.west)){p.moveTo(x,y);split=true;}else p.lineTo(x,y);previous=x;}
   if(!split)p.close();if(maxX>=d.area.left&&minX<=d.area.right&&maxY>=d.area.top&&minY<=d.area.bottom)d.land.addPath(p);
  }
  if(MapFrame.located(a.originLongitude,a.originLatitude)){d.x=mapX(f,d.area,a.originLongitude);d.y=mapY(f,d.area,a.originLatitude);}
  if(map!=null){JSONArray lines=map.optJSONArray("lines");if(lines!=null)for(int i=0;i<Math.min(80,lines.length());i++){JSONObject line=lines.getJSONObject(i);JSONArray pts=line.getJSONArray("points");Path path=new Path();float prev=0;
   for(int j=0;j<Math.min(500,pts.length());j++){JSONArray xy=pts.getJSONArray(j);float x=mapX(f,d.area,xy.getDouble(0)),y=mapY(f,d.area,xy.getDouble(1));if(j==0||Math.abs(x-prev)>d.area.width()*180/(f.east-f.west))path.moveTo(x,y);else path.lineTo(x,y);prev=x;}
   d.shores.add(new Stroke(path,Color.parseColor(line.getString("color"))));
  }}
  if(d.tsunami&&d.shores.isEmpty())d.partial=true;return d;
 }
 void draw(Canvas c,Alert a,Typeface font,int accent){draw(c,a,font,accent,1f);}
 void draw(Canvas c,Alert a,Typeface font,int accent,float markerProgress){
  c.save();c.clipPath(clip);paint.setStyle(Paint.Style.FILL);paint.setColor(Color.BLACK);c.drawRect(0,0,FRAME_WIDTH,FRAME_HEIGHT,paint);
  Drawing d=ready.get(a);RectF area=d==null||d.area==null?mapArea(null):d.area;
  int map=c.save();c.clipRect(area);paint.setColor(0xff091f2c);c.drawRect(area,paint);
  if(d!=null&&d.land!=null){paint.setColor(0xff234653);c.drawPath(d.land,paint);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(.65f);paint.setColor(0xff456776);c.drawPath(d.land,paint);}
  if(d!=null&&d.image!=null){paint.setColor(Color.WHITE);paint.setAlpha(255);paint.setFilterBitmap(true);c.drawBitmap(d.image,null,area,paint);}
  if(d!=null){for(Stroke s:d.shores){drawNeonCoast(c,s);}paint.setStyle(Paint.Style.FILL);
   if(d.x!=null&&d.y!=null){
    if(markerProgress<1f){
     paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.5f);
     paint.setColor(Color.argb(Math.round(150*(1-markerProgress)),255,112,134));
     c.drawCircle(d.x,d.y,6+12*markerProgress,paint);
     paint.setStyle(Paint.Style.FILL);
    }
    paint.setColor(Color.WHITE);c.drawCircle(d.x,d.y,4.5f,paint);paint.setColor(a.kind.equals("weather")?0xff38bdf8:0xffef5350);c.drawCircle(d.x,d.y,3,paint);}
  }
  c.restoreToCount(map);
  paint.setStyle(Paint.Style.FILL);paint.setColor(Color.BLACK);c.drawRect(0,0,FRAME_WIDTH,23,paint);c.drawRect(0,204,FRAME_WIDTH,FRAME_HEIGHT,paint);
  paint.setColor(OledNewsChrome.RED_DARK);c.drawRect(0,0,4,23,paint);c.drawRect(0,22,FRAME_WIDTH,23,paint);
  fit(c,d==null?"MAPA REGIONAL":d.heading,8,16,13,font,Color.WHITE,184);
  String note=d==null?"Preparando mapa…":d.note;
  fit(c,note,8,232,10,font,0xffd3d7da,184);
  c.restore();paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1);paint.setColor(0xff45484d);c.drawRoundRect(0,0,FRAME_WIDTH,FRAME_HEIGHT,5,5,paint);paint.setStyle(Paint.Style.FILL);
 }
 private void fit(Canvas c,String text,float x,float y,float size,Typeface font,int color,float width){paint.setTypeface(font);paint.setTextSize(size);paint.setColor(color);int n=paint.breakText(text,true,width,null);c.drawText(n<text.length()?text.substring(0,Math.max(0,n-1))+"…":text,x,y,paint);}
 // Layered strokes preserve the bulletin hue without blur bitmaps or animation.
 private void drawNeonCoast(Canvas c,Stroke s){
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeJoin(Paint.Join.ROUND);paint.setStrokeCap(Paint.Cap.ROUND);paint.setColor(s.color);
  paint.setStrokeWidth(8);paint.setAlpha(22);c.drawPath(s.path,paint);
  paint.setStrokeWidth(5.5f);paint.setAlpha(48);c.drawPath(s.path,paint);
  paint.setStrokeWidth(3.4f);paint.setAlpha(105);c.drawPath(s.path,paint);
  paint.setStrokeWidth(1.8f);paint.setAlpha(255);c.drawPath(s.path,paint);
  int core=Color.rgb((Color.red(s.color)*2+255)/3,(Color.green(s.color)*2+255)/3,(Color.blue(s.color)*2+255)/3);
  paint.setColor(core);paint.setStrokeWidth(.65f);c.drawPath(s.path,paint);
  paint.setAlpha(255);paint.setStrokeCap(Paint.Cap.BUTT);paint.setStrokeJoin(Paint.Join.MITER);
 }
 void close(){closed=true;satellite.close();worker.shutdownNow();main.removeCallbacksAndMessages(null);ready.clear();}
}

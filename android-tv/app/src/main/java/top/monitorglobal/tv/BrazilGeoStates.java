package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Offline Brazilian state outlines, shared data simplified from the app's GeoJSON.
 * No guessing a UF from a nearby city or a country flag. All 27 UFs are covered.
 */
final class BrazilGeoStates {
 static final class State {
  final String uf,name;
  final List<List<float[][]>> polygons=new ArrayList<>();
  float west=180,east=-180,south=90,north=-90;
  State(String uf,String name){this.uf=uf;this.name=name;}
 }
 private static volatile BrazilGeoStates singleton;
 final List<State> states=new ArrayList<>();
 private BrazilGeoStates(Context context) throws Exception {
  try(InputStream in=context.getAssets().open("maps/br-states-broadcast.json");ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))>=0)out.write(buffer,0,n);
   JSONArray all=new JSONObject(out.toString("UTF-8")).getJSONArray("features");
   for(int i=0;i<all.length();i++){
    JSONObject item=all.getJSONObject(i);
    State state=new State(item.getString("uf"),item.getString("name"));
    JSONArray polygons=item.getJSONArray("polys");
    for(int j=0;j<polygons.length();j++){
     JSONArray rings=polygons.getJSONArray(j);
     List<float[][]> outRings=new ArrayList<>();
     for(int k=0;k<rings.length();k++){
      JSONArray points=rings.getJSONArray(k);float[][] ring=new float[points.length()][2];
      for(int u=0;u<points.length();u++){
       JSONArray point=points.getJSONArray(u);
       float lon=(float)point.getDouble(0),lat=(float)point.getDouble(1);
       ring[u][0]=lon;ring[u][1]=lat;
       state.west=Math.min(state.west,lon);state.east=Math.max(state.east,lon);
       state.south=Math.min(state.south,lat);state.north=Math.max(state.north,lat);
      }
      if(ring.length>=4)outRings.add(ring);
     }
     if(!outRings.isEmpty())state.polygons.add(outRings);
    }
    if(!state.polygons.isEmpty())states.add(state);
   }
  }
 }
 static BrazilGeoStates load(Context c){
  if(singleton!=null)return singleton;
  synchronized(BrazilGeoStates.class){
   if(singleton==null){
    try{singleton=new BrazilGeoStates(c.getApplicationContext());}
    catch(Exception unavailable){return null;}
   }
  }
  return singleton;
 }
 private static boolean inRing(float[][] ring,double lon,double lat){
  boolean inside=false;
  for(int i=0,j=ring.length-1;i<ring.length;j=i++){
   float[] a=ring[i],b=ring[j];
   if((a[1]>lat)!=(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 }
 private static boolean contains(State state,double lon,double lat){
  if(lon<state.west||lon>state.east||lat<state.south||lat>state.north)return false;
  for(List<float[][]> polygon:state.polygons){
   if(!inRing(polygon.get(0),lon,lat))continue;
   boolean hole=false;for(int i=1;i<polygon.size();i++)if(inRing(polygon.get(i),lon,lat)){hole=true;break;}
   if(!hole)return true;
  }
  return false;
 }
 State fromCoordinates(double lon,double lat){
  if(!MapFrame.located(lon,lat))return null;
  for(State s:states)if(contains(s,lon,lat))return s;
  return null;
 }
 private static String fold(String input){
  return Normalizer.normalize(input,Normalizer.Form.NFD).replaceAll("\\p{M}","").toUpperCase(Locale.ROOT);
 }
 State fromTitle(String title){
  if(title==null)return null;
  String search=fold(title).replaceAll("[^A-Z0-9]+"," ");
  for(State s:states){
   String full=" "+fold(s.name)+" ";
   if((" "+search+" ").contains(full))return s;
  }
  for(State s:states){
   String uf=" "+s.uf+" ";
   if((" "+search+" ").contains(uf))return s;
  }
  return null;
 }
 State locate(Alert a){
  State located=fromCoordinates(a.originLongitude,a.originLatitude);
  return located==null?fromTitle(a.title):located;
 }
 private static Path toPath(State state,RectF bounds){
  float pad=5f,rangeX=Math.max(.001f,state.east-state.west),rangeY=Math.max(.001f,state.north-state.south);
  float scale=Math.min((bounds.width()-2*pad)/rangeX,(bounds.height()-2*pad)/rangeY);
  float cx=bounds.centerX(),cy=bounds.centerY(),mx=(state.east+state.west)/2f,my=(state.north+state.south)/2f;
  Path path=new Path();path.setFillType(Path.FillType.EVEN_ODD);
  for(List<float[][]> polygon:state.polygons)for(float[][] ring:polygon){
   for(int i=0;i<ring.length;i++){
    float x=cx+(ring[i][0]-mx)*scale,y=cy-(ring[i][1]-my)*scale;
    if(i==0)path.moveTo(x,y);else path.lineTo(x,y);
   }
   path.close();
  }
  return path;
 }
 /** Return epicenter point in view coordinates only if it is genuinely inside the UF. */
 float[] draw(Canvas c,Paint p,RectF area,State selected,Alert a,boolean model1){
  p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(model1?0xffd8e8eb:0xfff1f2f4);
  c.drawRect(area,p);
  if(selected==null){
   p.setColor(0xff5e707b);p.setTextSize(23f);p.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
   c.drawText("BR",area.centerX()-13,area.centerY()+7,p);
   return null;
  }
  Path shape=toPath(selected,area);p.setColor(model1?0xff065260:0xffb3b5b7);p.setStyle(Paint.Style.FILL);
  c.drawPath(shape,p);p.setStyle(Paint.Style.STROKE);p.setColor(model1?Color.WHITE:0xffebebeb);p.setStrokeWidth(1.2f);
  c.drawPath(shape,p);p.setStyle(Paint.Style.FILL);
  p.setTypeface(android.graphics.Typeface.create("sans-serif-condensed",android.graphics.Typeface.BOLD));
  p.setTextSize(18);p.setColor(model1?Color.WHITE:0xff585b5e);
  float labelWidth=p.measureText(selected.uf);
  c.drawText(selected.uf,area.centerX()-labelWidth/2f,area.centerY()+8,p);
  if(!MapFrame.located(a.originLongitude,a.originLatitude)||!contains(selected,a.originLongitude,a.originLatitude))return null;
  float pad=5f,rx=Math.max(.001f,selected.east-selected.west),ry=Math.max(.001f,selected.north-selected.south);
  float scale=Math.min((area.width()-2*pad)/rx,(area.height()-2*pad)/ry);
  float xx=area.centerX()+((float)a.originLongitude-(selected.east+selected.west)/2f)*scale;
  float yy=area.centerY()-((float)a.originLatitude-(selected.north+selected.south)/2f)*scale;
  return new float[]{xx,yy};
 }
}

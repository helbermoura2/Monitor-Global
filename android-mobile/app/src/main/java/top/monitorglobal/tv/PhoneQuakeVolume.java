package top.monitorglobal.tv;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.*;
import android.view.MotionEvent;
import android.view.View;
import java.util.*;

/** Rotatable geographic block. Vertical and horizontal axes use the same kilometre scale. */
final class PhoneQuakeVolume extends View {
 private static final int GOLD=0xffffce77;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
 private final Alert origin;
 private final double kmPerLat=111.2,kmPerLon;
 private double half;
 private MapFrame frame;
 private List<List<double[]>> rupture=Collections.emptyList();
 private final List<Alert> nearby=new ArrayList<>();
 private Bitmap terrain;
 private float yaw=-.58f,tilt=.59f,lastX,lastY,focus;
 private ValueAnimator tour;
 private boolean paused;
 private java.util.function.Consumer<String> tourListener=label->{};
 PhoneQuakeVolume(Context context,Alert event,List<Alert> candidates){
  super(context);origin=event;
  kmPerLon=kmPerLat*Math.max(.04,Math.cos(Math.toRadians(event.originLatitude)));
  half=Math.max(55,depth(event)*.64);
  updateFrame();
  addNearby(candidates);
  setContentDescription("Bloco sísmico 3D. Arraste para girar. Use os botões para mudar a vista.");
 }
 private void updateFrame(){
  double dy=half/kmPerLat,dx=Math.min(120,half/kmPerLon);
  frame=new MapFrame(origin.originLongitude-dx,origin.originLongitude+dx,
   Math.max(-90,origin.originLatitude-dy),Math.min(90,origin.originLatitude+dy));
 }
 void setRupture(List<List<double[]>> rings){
  rupture=rings;
  for(List<double[]> ring:rings)for(double[] v:ring)
   half=Math.max(half,1.16*Math.max(Math.abs(v[1]-origin.originLatitude)*kmPerLat,
    Math.abs(frame.longitude(v[0])-origin.originLongitude)*kmPerLon));
  updateFrame();terrain=null;invalidate();
 }
 boolean hasRupture(){return !rupture.isEmpty();}
 MapFrame frame(){return frame;}
 double radius(){return half;}
 void setTerrain(Bitmap bitmap){terrain=bitmap;invalidate();}
 List<Alert> nearby(){return new ArrayList<>(nearby);}
 void addNearby(List<Alert> candidates){
  for(Alert a:candidates){
   if(!"earthquake".equals(a.kind)||a.id.equals(origin.id)||!MapFrame.located(a.originLongitude,a.originLatitude)||!known(a))continue;
   double distance=PhoneQuakeData.distance(origin.originLatitude,origin.originLongitude,a.originLatitude,a.originLongitude);
   if(distance<=half&&Math.abs(a.eventTime-origin.eventTime)<=7*86400000L&&
    !(distance<25&&Math.abs(a.eventTime-origin.eventTime)<90000L)&&nearby.stream().noneMatch(b->b.id.equals(a.id)||
     Math.abs(a.eventTime-b.eventTime)<90000L&&PhoneQuakeData.distance(a.originLatitude,a.originLongitude,b.originLatitude,b.originLongitude)<25))nearby.add(a);
  }
  nearby.sort(Comparator.comparingDouble(a->PhoneQuakeData.distance(origin.originLatitude,origin.originLongitude,a.originLatitude,a.originLongitude)));
  if(nearby.size()>30)nearby.subList(30,nearby.size()).clear();
  invalidate();
 }
 private static boolean known(Alert a){return Double.isFinite(a.depth)&&a.depth>=0&&a.depth<=780;}
 private static double depth(Alert a){return known(a)?a.depth:0;}
 boolean canDescend(){return known(origin);}
 void view(boolean top){stop();focus=0;yaw=top?0:-.52f;tilt=top?1.57f:.08f;invalidate();}
 void setTourListener(java.util.function.Consumer<String> listener){tourListener=listener;}
 void stop(){if(tour!=null){tour.removeAllListeners();tour.cancel();tour=null;}paused=false;tourListener.accept("Iniciar tour");}
 boolean toggleTour(){
  if(tour!=null&&tour.isRunning()){
   if(paused)tour.resume();else tour.pause();
   paused=!paused;tourListener.accept(paused?"Retomar":"Pausar");return !paused;
  }
  yaw=0;tilt=1.56f;focus=0;
  if(!ValueAnimator.areAnimatorsEnabled()){tilt=.55f;focus=known(origin)?1:0;invalidate();return false;}
  tour=ValueAnimator.ofFloat(0,1);tour.setDuration(7000);
  tour.addUpdateListener(value->{float p=(float)value.getAnimatedValue();yaw=-.68f*p;tilt=1.56f-1.04f*p;focus=known(origin)?Math.max(0,(p-.30f)/.70f):0;invalidate();});
  tour.addListener(new android.animation.AnimatorListenerAdapter(){
   @Override public void onAnimationEnd(android.animation.Animator animation){tour=null;tourListener.accept("Repetir tour");}
  });
  tourListener.accept("Pausar");tour.start();return true;
 }
 @Override protected void onDetachedFromWindow(){stop();super.onDetachedFromWindow();}
 @Override public boolean onTouchEvent(MotionEvent e){
  switch(e.getActionMasked()){
   case MotionEvent.ACTION_DOWN:getParent().requestDisallowInterceptTouchEvent(true);stop();lastX=e.getX();lastY=e.getY();return true;
   case MotionEvent.ACTION_MOVE:yaw+=(e.getX()-lastX)*.012f;tilt=Math.max(.06f,Math.min(1.56f,tilt+(e.getY()-lastY)*.009f));
    lastX=e.getX();lastY=e.getY();invalidate();return true;
   case MotionEvent.ACTION_UP:getParent().requestDisallowInterceptTouchEvent(false);performClick();return true;
   case MotionEvent.ACTION_CANCEL:getParent().requestDisallowInterceptTouchEvent(false);return true;
   default:return true;
  }
 }
 @Override public boolean performClick(){super.performClick();return true;}
 PhoneQuakeVolume exportCopy(){
  PhoneQuakeVolume copy=new PhoneQuakeVolume(getContext(),origin,Collections.emptyList());
  copy.half=half;copy.frame=frame;copy.rupture=rupture;copy.terrain=terrain;
  copy.nearby.addAll(nearby);copy.yaw=yaw;copy.tilt=tilt;copy.focus=focus;
  copy.layout(0,0,600,560);
  return copy;
 }
 void exportTourPose(float progress){
  float p=(float)(.5-.5*Math.cos(Math.PI*Math.max(0,Math.min(1,progress))));
  yaw=-.68f*p;tilt=1.56f-1.04f*p;
  focus=known(origin)?Math.max(0,(p-.30f)/.70f):0;
 }
 private float[] vertex(double east,double south,double depth,double scale){
  double sin=Math.sin(yaw),cos=Math.cos(yaw);
  double x=east*cos-south*sin,y=east*sin+south*cos;
  return new float[]{getWidth()*.50f+(float)(x*scale),
   getHeight()*.47f+(float)((y*Math.sin(tilt)+(depth-depth(origin)*focus)*Math.cos(tilt))*scale)};
 }
 private void face(Canvas canvas,int fill,float[]... points){
  Path polygon=new Path();polygon.moveTo(points[0][0],points[0][1]);for(int i=1;i<points.length;i++)polygon.lineTo(points[i][0],points[i][1]);polygon.close();
  paint.setColor(fill);paint.setStyle(Paint.Style.FILL);canvas.drawPath(polygon,paint);
  paint.setStyle(Paint.Style.STROKE);paint.setColor(0xff987e52);paint.setStrokeWidth(1);canvas.drawPath(polygon,paint);paint.setStyle(Paint.Style.FILL);
 }
 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);
  drawExport(canvas);
 }
 void drawExport(Canvas canvas){
  canvas.drawColor(0xff0b1821);
  paint.setColor(0xff1b303b);paint.setStrokeWidth(1);
  for(int x=16;x<getWidth();x+=24)canvas.drawLine(x,0,x,getHeight(),paint);
  for(int y=16;y<getHeight();y+=24)canvas.drawLine(0,y,getWidth(),y,paint);
  double faultDepth=rupture.stream().flatMap(Collection::stream).mapToDouble(v->v[2]).max().orElse(0);
  double nearbyDepth=nearby.stream().mapToDouble(PhoneQuakeVolume::depth).max().orElse(0);
  double bottom=Math.max(half*.62,Math.max(faultDepth,Math.max(depth(origin),nearbyDepth))*1.15);
  double scale=Math.min(getWidth()/(half*3.15),getHeight()/(half*2.25+bottom*1.3))*(1+.18*focus);
  float[][] top=new float[4][],base=new float[4][];
  int[] xs={-1,1,1,-1},ys={-1,-1,1,1};
  for(int i=0;i<4;i++){top[i]=vertex(xs[i]*half,ys[i]*half,0,scale);base[i]=vertex(xs[i]*half,ys[i]*half,bottom,scale);}
  Integer[] order={0,1,2,3};Arrays.sort(order,Comparator.comparingDouble(i->top[i][1]+top[(i+1)%4][1]));
  for(int i:order){int next=(i+1)%4;face(canvas,i%2==0?0xaa34333c:0xaa1d3b47,top[i],top[next],base[next],base[i]);}
  face(canvas,0xff17424a,top);
  if(terrain!=null){
   Matrix matrix=new Matrix();matrix.setPolyToPoly(new float[]{0,0,terrain.getWidth(),0,0,terrain.getHeight()},0,
    new float[]{top[0][0],top[0][1],top[1][0],top[1][1],top[3][0],top[3][1]},0,3);
   paint.setColor(Color.WHITE);canvas.drawBitmap(terrain,matrix,paint);
  }
  for(int i=0;i<=3;i++){
   double level=bottom*i/3;float[] tick=vertex(half,half,level,scale);
   label(canvas,String.format(Locale.ROOT,"%.0f km",level),tick[0]+5,tick[1],0xffb9cad0,11);
  }
  float[] north=vertex(0,-half,0,scale);label(canvas,"N",north[0],north[1]-7,GOLD,13);
  for(List<double[]> ring:rupture){
   float[][] polygon=ring.stream().map(v->vertex((frame.longitude(v[0])-origin.originLongitude)*kmPerLon,
    (origin.originLatitude-v[1])*kmPerLat,v[2],scale)).toArray(float[][]::new);
   face(canvas,0x79ffa34d,polygon);
  }
  if(!rupture.isEmpty())label(canvas,"Ruptura publicada · USGS",14,getHeight()-34,GOLD,11);
  for(Alert a:nearby)drawEvent(canvas,a,scale,false);
  drawEvent(canvas,origin,scale,true);
  label(canvas,terrain==null?"Grade geográfica":"Relevo: Esri",14,getHeight()-14,0xffa6c3d3,11);
 }
 private void drawEvent(Canvas canvas,Alert event,double scale,boolean primary){
  double east=(frame.longitude(event.originLongitude)-origin.originLongitude)*kmPerLon;
  double south=(origin.originLatitude-event.originLatitude)*kmPerLat;
  float[] top=vertex(east,south,0,scale),point=vertex(east,south,depth(event),scale);
  paint.setColor(primary?GOLD:0xff63c9d5);paint.setStrokeWidth(primary?2:1);
  if(known(event))canvas.drawLine(top[0],top[1],point[0],point[1],paint);
  canvas.drawCircle(point[0],point[1],primary?7:4,paint);
  if(primary)
   label(canvas,PhoneActivity.magnitude(event)+(known(event)?String.format(Locale.ROOT," · %.1f km",event.depth):" · profundidade indisponível"),
    point[0]+10,point[1]-9,primary?GOLD:0xffa6e8e8,12);
 }
 private void label(Canvas canvas,String text,float x,float y,int color,float size){
  paint.setTextSize(size*getResources().getDisplayMetrics().scaledDensity);paint.setColor(color);
  canvas.drawText(text,Math.max(5,Math.min(x,getWidth()-paint.measureText(text)-6)),y,paint);
 }
}

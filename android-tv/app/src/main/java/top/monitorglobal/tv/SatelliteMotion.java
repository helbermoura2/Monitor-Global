package top.monitorglobal.tv;

import android.graphics.Bitmap;
import android.graphics.Color;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Conservative block matching between two GOES infrared frames.
 * Reports cloud-pattern displacement only; it is not a precipitation or wind estimate.
 */
final class SatelliteMotion {
 private static final int SCALE=4, PATCH=12, SEARCH=9, GRID_X=4, GRID_Y=3;
 static final class Result {
  final long olderAt,newerAt;
  final double speedKmh;
  final String direction;
  final int matched,total;
  final double confidence;
  Result(long a,long b,double speed,String dir,int count,int all,double trust){
   olderAt=a;newerAt=b;speedKmh=speed;direction=dir;matched=count;total=all;confidence=trust;
  }
  String description(){
   if(speedKmh<2.0)return "Padrões de nuvens quase estacionários";
   return "Nuvens deslocando-se para "+direction+" · "+String.format(java.util.Locale.ROOT,"%.0f km/h",speedKmh);
  }
  String coherence(){return "COERÊNCIA ESPACIAL "+matched+"/"+total+" BLOCOS";}
 }

 private static final class Vector {final int x,y;final double score;Vector(int x,int y,double s){this.x=x;this.y=y;score=s;}}

 static Result analyze(Bitmap older,Bitmap newer,long olderAt,long newerAt,InfraredPlan.Scope scope){
  if(older==null||newer==null||older.isRecycled()||newer.isRecycled()||
     older.getWidth()!=newer.getWidth()||older.getHeight()!=newer.getHeight()||
     olderAt<=0||newerAt<=olderAt||newerAt-olderAt>90*60000L)return null;
  int w=older.getWidth()/SCALE,h=older.getHeight()/SCALE;
  if(w<PATCH*3||h<PATCH*3)return null;
  int[] a=sample(older,w,h),b=sample(newer,w,h);
  List<Vector> vectors=new ArrayList<>();int total=0;
  for(int gy=0;gy<GRID_Y;gy++)for(int gx=0;gx<GRID_X;gx++){
   int cx=(gx+1)*w/(GRID_X+1),cy=(gy+1)*h/(GRID_Y+1),left=cx-PATCH/2,top=cy-PATCH/2;
   if(left<SEARCH||top<SEARCH||left+PATCH+SEARCH>=w||top+PATCH+SEARCH>=h)continue;
   total++;double mean=0;for(int y=0;y<PATCH;y++)for(int x=0;x<PATCH;x++)mean+=a[(top+y)*w+left+x];mean/=PATCH*PATCH;
   double variance=0;for(int y=0;y<PATCH;y++)for(int x=0;x<PATCH;x++){double d=a[(top+y)*w+left+x]-mean;variance+=d*d;}
   if(variance/(PATCH*PATCH)<18)continue;
   double best=Double.MAX_VALUE;int bestX=0,bestY=0;
   for(int dy=-SEARCH;dy<=SEARCH;dy++)for(int dx=-SEARCH;dx<=SEARCH;dx++){
    double otherMean=0;for(int y=0;y<PATCH;y++)for(int x=0;x<PATCH;x++)otherMean+=b[(top+dy+y)*w+left+dx+x];otherMean/=PATCH*PATCH;
    double error=0;for(int y=0;y<PATCH;y++)for(int x=0;x<PATCH;x++)
      error+=Math.abs((a[(top+y)*w+left+x]-mean)-(b[(top+dy+y)*w+left+dx+x]-otherMean));
    error/=PATCH*PATCH;
    if(error<best){best=error;bestX=dx;bestY=dy;}
   }
   if(best<=34&&Math.abs(bestX)<SEARCH&&Math.abs(bestY)<SEARCH)vectors.add(new Vector(bestX,bestY,best));
  }
  if(total==0||vectors.size()<4)return null;
  List<Integer> xs=new ArrayList<>(),ys=new ArrayList<>();for(Vector v:vectors){xs.add(v.x);ys.add(v.y);}
  Collections.sort(xs);Collections.sort(ys);int dx=xs.get(xs.size()/2),dy=ys.get(ys.size()/2),consistent=0;double error=0;
  
  for(Vector v:vectors)if(Math.abs(v.x-dx)<=2&&Math.abs(v.y-dy)<=2){consistent++;error+=v.score;}
  if(consistent<4||consistent<vectors.size()*.55)return null;
  double minutes=(newerAt-olderAt)/60000.0;
  double mid=(scope.north+scope.south)/2.0;
  double kmX=kmPerSampleX(scope,w);
  double kmY=kmPerSampleY(scope,h);
  double speed=Math.hypot(dx*kmX,dy*kmY)/(minutes/60.0);
  if(!Double.isFinite(speed)||speed>220)return null;
  String direction=direction(dx*kmX,-dy*kmY);
  double confidence=Math.min(1.0,consistent/(double)Math.max(4,total))*(1.0-Math.min(1.0,(error/consistent)/40.0));
  return new Result(olderAt,newerAt,speed,direction,consistent,total,confidence);
 }

 private static int[] sample(Bitmap bitmap,int w,int h){
  int sourceWidth=bitmap.getWidth();
  int[] row=new int[sourceWidth],out=new int[w*h];
  for(int y=0;y<h;y++){
   bitmap.getPixels(row,0,sourceWidth,0,y*SCALE,sourceWidth,1);
   for(int x=0;x<w;x++){
    int c=row[x*SCALE];
    out[y*w+x]=(Color.red(c)*3+Color.green(c)*6+Color.blue(c))/10;
   }
  }
  return out;
 }
 private static String direction(double east,double north){
  if(Math.abs(east)+Math.abs(north)<1e-9)return "sem direção definida";
  double angle=(Math.toDegrees(Math.atan2(east,north))+360)%360;
  String[] names={"N","NE","L","SE","S","SO","O","NO"};
  return names[(int)Math.round(angle/45.0)%8];
 }
 static double kmPerSampleX(InfraredPlan.Scope s,int w){return 6371.0088*Math.cos(Math.toRadians((s.north+s.south)/2))*Math.toRadians(s.east-s.west)/w;}
 static double kmPerSampleY(InfraredPlan.Scope s,int h){return 6371.0088*Math.cos(Math.toRadians((s.north+s.south)/2))*(InfraredPlan.merc(s.north)-InfraredPlan.merc(s.south))/h;}
 private SatelliteMotion(){}
}

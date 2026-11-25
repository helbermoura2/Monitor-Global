package top.monitorglobal.tv;

import java.util.*;

/** Experimental advection of observed reflectivity only, not quantitative rainfall.
 * Requires two grids from the same radar with identical geographic axes. */
final class RadarNowcast {
 static final class Motion {
  final int dx,dy,matched;final long olderAt,newerAt;
  Motion(int dx,int dy,int matched,long olderAt,long newerAt){this.dx=dx;this.dy=dy;this.matched=matched;this.olderAt=olderAt;this.newerAt=newerAt;}
  long validAt(int minutes){return newerAt+minutes*60000L;}
  boolean usable(int minutes,long now){return minutes>0&&minutes<=60&&newerAt<=now&&now-newerAt<=45*60000L&&validAt(minutes)>now;}
 }
 static Motion estimate(RadarCappi older,RadarCappi newer,long a,long b){
  if(older==null||newer==null||!Arrays.equals(older.lat,newer.lat)||!Arrays.equals(older.lon,newer.lon)||a<=0||b-a<5*60000L||b-a>20*60000L)return null;
  List<int[]> vectors=new ArrayList<>();
  for(int y=65;y<440;y+=75)for(int x=65;x<440;x+=75){
   int wet=0;for(int j=-12;j<=12;j+=3)for(int i=-12;i<=12;i+=3){float v=older.at(y+j,x+i);if(Float.isFinite(v)&&v>=20)wet++;}
   if(wet<18)continue;
   double best=Double.POSITIVE_INFINITY,second=Double.POSITIVE_INFINITY;int bx=0,by=0;
   for(int dy=-36;dy<=36;dy+=3)for(int dx=-36;dx<=36;dx+=3){
    double error=0;int n=0;
    for(int j=-12;j<=12;j+=3)for(int i=-12;i<=12;i+=3){
     float u=older.at(y+j,x+i),v=newer.at(y+j+dy,x+i+dx);
     if(!Float.isFinite(u)||!Float.isFinite(v))continue;error+=Math.abs(u-v);n++;
    }
    if(n<50)continue;double score=error/n;
    if(score<best){second=best;best=score;bx=dx;by=dy;}else if(score<second)second=score;
   }
   if(best<8&&second-best>0.35&&Math.abs(bx)<36&&Math.abs(by)<36)vectors.add(new int[]{bx,by});
  }
  if(vectors.size()<4)return null;
  List<Integer> xs=new ArrayList<>(),ys=new ArrayList<>();for(int[] v:vectors){xs.add(v[0]);ys.add(v[1]);}
  Collections.sort(xs);Collections.sort(ys);int dx=xs.get(xs.size()/2),dy=ys.get(ys.size()/2),n=0;
  for(int[] v:vectors)if(Math.abs(v[0]-dx)<=3&&Math.abs(v[1]-dy)<=3)n++;
  if(n<4||n*3<vectors.size()*2)return null;
  return new Motion(dx,dy,n,a,b);
 }
 static float extrapolate(RadarCappi newer,Motion m,int y,int x,int minutes,long now){
  if(newer==null||m==null||!m.usable(minutes,now))return Float.NaN;
  double factor=minutes*60000d/(m.newerAt-m.olderAt);
  int py=(int)Math.round(y-m.dy*factor),px=(int)Math.round(x-m.dx*factor);
  if(py<0||px<0||py>=500||px>=500)return Float.NaN;
  // Do not extend the estimate into a currently unconfirmed radar cell.
  if(!Float.isFinite(newer.at(y,x)))return Float.NaN;
  return newer.at(py,px);
 }
 private RadarNowcast(){}
}

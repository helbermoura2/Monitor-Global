package top.monitorglobal.tv;
import java.util.*;
/** Small, bounded Web Mercator tile plan projected into the existing geographic frame. */
final class SatellitePlan {
 static final class Tile {final int z,x,y;final double west,east,north,south;Tile(int z,int x,int y){this.z=z;int n=1<<z;this.x=Math.floorMod(x,n);this.y=y;west=x*360.0/n-180;east=(x+1)*360.0/n-180;north=latitude(y,n);south=latitude(y+1,n);}}
 static double latitude(double y,int n){return Math.toDegrees(Math.atan(Math.sinh(Math.PI*(1-2*y/n))));}
 static double row(double lat,int n){double r=Math.toRadians(Math.max(-85.05112878,Math.min(85.05112878,lat)));return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n;}
 static List<Tile> tiles(MapFrame f){
  if(!f.valid()||f.south < -85||f.north>85||f.east-f.west>360)return Collections.emptyList();
  for(int z=7;z>=0;z--){int n=1<<z;int left=(int)Math.floor((f.west+180)/360*n),right=(int)Math.floor((f.east+180)/360*n-1e-9),top=Math.max(0,(int)Math.floor(row(f.north,n))),bottom=Math.min(n-1,(int)Math.floor(row(f.south,n)-1e-9));
   if((right-left+1)*(bottom-top+1)>6)continue;List<Tile> out=new ArrayList<>();for(int y=top;y<=bottom;y++)for(int x=left;x<=right;x++)out.add(new Tile(z,x,y));return out;
  }return Collections.emptyList();
 }
}

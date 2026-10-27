package top.monitorglobal.tv;
/** Equirectangular frame matches the project's static sharing maps. Longitude wraps at the date line. */
final class MapFrame {
 final double west,east,south,north;
 MapFrame(double w,double e,double s,double n){west=w;east=e;south=s;north=n;}
 static boolean located(double lon,double lat){return Double.isFinite(lon)&&Double.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90;}
 static MapFrame epicenter(double lon,double lat){
  double halfX=Math.min(30,3.5/Math.max(.2,Math.cos(Math.toRadians(lat)))),halfY=halfX*150/310;
  double mid=Math.max(-90+halfY,Math.min(90-halfY,lat));return new MapFrame(lon-halfX,lon+halfX,mid-halfY,mid+halfY);
 }
 boolean valid(){return Double.isFinite(west)&&Double.isFinite(east)&&Double.isFinite(south)&&Double.isFinite(north)&&Math.abs(west)<=720&&Math.abs(east)<=720&&Math.abs(south)<=180&&Math.abs(north)<=180&&east>west&&east-west<=720&&north>south&&north-south<=360;}
 double longitude(double lon){return lon+360*Math.rint(((west+east)/2-lon)/360);}
 float x(double lon){return (float)((longitude(lon)-west)/(east-west)*310);}
 float y(double lat){return (float)((north-lat)/(north-south)*150);}
}

package top.monitorglobal.tv;

import java.util.*;

/** Named geographic points; radar cell values do not represent the whole city. */
final class RadarRegion {
 final String name;final double lat,lon;
 RadarRegion(String name,double lat,double lon){this.name=name;this.lat=lat;this.lon=lon;}
 static final RadarRegion[] POINTS={
  new RadarRegion("São Paulo · centro",-23.5505,-46.6333),
  new RadarRegion("Liberdade",-23.5606,-46.6389),
  new RadarRegion("São Roque",-23.5294,-47.1356),
  new RadarRegion("Campinas",-22.9056,-47.0608),
  new RadarRegion("Santos",-23.9608,-46.3336),
  new RadarRegion("Rio de Janeiro",-22.9068,-43.1729),
  new RadarRegion("Belo Horizonte",-19.9167,-43.9345)
 };
 static String describe(RadarMapClient.Frame frame,RadarRegion point,long now){
  if(frame==null)return point.name+" · Radar indisponível";
  float dbz=frame.sample(point.lat,point.lon);
  return point.name+" · "+RadarIntensity.reflectivity(dbz)+" · célula CAPPI, não chuva medida · "+RadarIntensity.rainRate()+" · "+RadarIntensity.accumulation()+" · "+frame.credit()+" · "+InfraredPlan.timing(frame.at,now);
 }
}

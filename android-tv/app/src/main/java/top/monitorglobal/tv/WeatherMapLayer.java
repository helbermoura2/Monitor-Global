package top.monitorglobal.tv;

import java.util.*;

/** Immutable metadata for real weather layers. No synthetic observations. */
final class WeatherMapLayer {
 enum Kind {
  RADAR("Radar observado","dBZ",60),
  CLOUD("Nuvens observadas","",60),
  RAIN_ESTIMATE("Precipitação estimada","mm/h",60),
  NOWCAST("Previsão imediata","mm/h",30),
  FORECAST("Previsão numérica","mm",360),
  CONSENSUS("Concordância entre modelos","modelos",360);
  final String label,unit; final int maxAgeMinutes;
  Kind(String label,String unit,int maxAgeMinutes){this.label=label;this.unit=unit;this.maxAgeMinutes=maxAgeMinutes;}
 }
 enum State { AVAILABLE, STALE, UNAVAILABLE }
 static final class Bounds {
  final double west,south,east,north;
  Bounds(double w,double s,double e,double n){
   if(!Double.isFinite(w)||!Double.isFinite(s)||!Double.isFinite(e)||!Double.isFinite(n)||w< -180||e>180||s< -90||n>90||w>=e||s>=n)throw new IllegalArgumentException("Invalid geographic bounds");
   west=w;south=s;east=e;north=n;
  }
  boolean contains(double lon,double lat){return lon>=west&&lon<=east&&lat>=south&&lat<=north;}
 }
 final Kind kind; final String source,detail; final long issuedAt,validAt; final Bounds bounds;
 WeatherMapLayer(Kind kind,String source,String detail,long issuedAt,long validAt,Bounds bounds){
  this.kind=Objects.requireNonNull(kind);
  this.source=source==null?"":source.trim();this.detail=detail==null?"":detail.trim();
  this.issuedAt=issuedAt;this.validAt=validAt;this.bounds=bounds;
 }
 static WeatherMapLayer unavailable(Kind kind,String source,String reason){return new WeatherMapLayer(kind,source,reason,0,0,null);}
 boolean observed(){return kind==Kind.RADAR||kind==Kind.CLOUD;}
 State state(long now){
  if(source.isEmpty()||bounds==null||issuedAt<=0||validAt<=0||issuedAt>now)return State.UNAVAILABLE;
  if(observed()&&validAt>now)return State.UNAVAILABLE;
  if(!observed()&&validAt<issuedAt&&kind!=Kind.RAIN_ESTIMATE)return State.UNAVAILABLE;
  return now-issuedAt>kind.maxAgeMinutes*60000L?State.STALE:State.AVAILABLE;
 }
 long ageMinutes(long now){return issuedAt>0&&issuedAt<=now?(now-issuedAt)/60000L:-1;}
 static String agreement(int wet,int available,int expected){
  if(expected<=0||available<=0||available>expected||wet<0||wet>available)return "Consenso indisponível";
  return wet+" de "+available+" modelos indicam chuva"+(available<expected?" · cobertura parcial ("+available+"/"+expected+")":"");
 }
 /** Distinct from observed dry cells: undocumented sentinel, fill and invalid values. */
 static boolean usableReflectivity(float value){return Float.isFinite(value)&&value!= -99f&&value> -100f&&value<=100f;}
}

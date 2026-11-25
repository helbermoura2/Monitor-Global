package top.monitorglobal.tv;

final class WeatherMapLayerCheck {
 private static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
 public static void main(String[] args){
  long now=1_800_000_000_000L;
  WeatherMapLayer.Bounds b=new WeatherMapLayer.Bounds(-50,-26,-44,-21);
  check(b.contains(-46.63,-23.55),"São Paulo inside bounding rectangle, not guaranteed radar coverage");
  check(!b.contains(-40,-23),"outside rectangle");
  WeatherMapLayer radar=new WeatherMapLayer(WeatherMapLayer.Kind.RADAR,"INPE / DECEA","CAPPI 3 km",now-28*60000,now-28*60000,b);
  check(radar.observed(),"radar observation");
  check("dBZ".equals(radar.kind.unit),"reflectivity not rain rate");
  check(radar.state(now)==WeatherMapLayer.State.AVAILABLE&&radar.ageMinutes(now)==28,"real timestamps");
  check(radar.state(now+33*60000)==WeatherMapLayer.State.STALE,"expired observation");
  check(new WeatherMapLayer(WeatherMapLayer.Kind.RADAR,"INPE","",now,now+60000,b).state(now)==WeatherMapLayer.State.UNAVAILABLE,"future observations rejected");
  WeatherMapLayer forecast=new WeatherMapLayer(WeatherMapLayer.Kind.FORECAST,"ECMWF","hourly accumulation",now-60000,now+3600000,b);
  check(!forecast.observed()&&forecast.state(now)==WeatherMapLayer.State.AVAILABLE&&"mm".equals(forecast.kind.unit),"forecast is not observation");
  check(WeatherMapLayer.Kind.NOWCAST!=WeatherMapLayer.Kind.FORECAST&&WeatherMapLayer.Kind.CLOUD!=WeatherMapLayer.Kind.RADAR,"separate weather layers");
  check(WeatherMapLayer.unavailable(WeatherMapLayer.Kind.CLOUD,"GOES","No frame").state(now)==WeatherMapLayer.State.UNAVAILABLE,"missing data");
  check(WeatherMapLayer.agreement(2,3,3).equals("2 de 3 modelos indicam chuva"),"consensus counts");
  check(WeatherMapLayer.agreement(1,2,3).contains("parcial"),"partial model coverage");
  check(WeatherMapLayer.agreement(2,1,3).equals("Consenso indisponível"),"invalid counts");
  for(float v:new float[]{-99f,-9999.9f,Float.NaN,Float.POSITIVE_INFINITY,101f})check(!WeatherMapLayer.usableReflectivity(v),"special or invalid: "+v);
  check(WeatherMapLayer.usableReflectivity(0f)&&WeatherMapLayer.usableReflectivity(55.84f),"valid reflectivity, not mm/h");
  try{new WeatherMapLayer.Bounds(-50,-26,-55,-21);throw new AssertionError("invalid bounds accepted");}catch(IllegalArgumentException expected){}
  System.out.println("STAGE_05_OK: units, timestamps, missing/stale data, coverage bounds, model agreement, special values");
 }
}

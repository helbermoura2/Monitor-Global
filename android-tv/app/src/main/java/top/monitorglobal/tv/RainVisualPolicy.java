package top.monitorglobal.tv;
/** Visual strength follows liquid precipitation; thunderstorm requires a source condition. */
final class RainVisualPolicy {
 static int level(double rate,boolean stormForecast){
  if(!Double.isFinite(rate)||rate<=0)return 0;
  if(stormForecast)return 3;
  return rate<2.5?0:rate<7.5?1:rate<50?2:3;
 }
 /** Uses only a valid modeled wind speed; unknown wind remains calm rather than invented. */
 static float windSpeedKmh(WeatherForecast.Summary weather){
  if(weather==null||weather.windValue==null)return 0f;
  try{
   String numeric=weather.windValue.trim().replaceAll("[^0-9,.-]","").replace(',','.');
   if(numeric.isEmpty())return 0f;
   float speed=Float.parseFloat(numeric);
   return Float.isFinite(speed)&&speed>=0?Math.min(80f,speed):0f;
  }catch(NumberFormatException ignored){return 0f;}
 }
}

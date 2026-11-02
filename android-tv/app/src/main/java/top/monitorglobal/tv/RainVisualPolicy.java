package top.monitorglobal.tv;
/** Visual strength follows liquid precipitation; thunderstorm requires a source condition. */
final class RainVisualPolicy {
 static int level(double rate,boolean stormForecast){
  if(!Double.isFinite(rate)||rate<=0)return 0;
  if(stormForecast)return 3;
  return rate<2.5?0:rate<7.5?1:rate<50?2:3;
 }
}

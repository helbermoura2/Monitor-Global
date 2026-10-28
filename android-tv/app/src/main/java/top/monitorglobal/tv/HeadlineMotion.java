package top.monitorglobal.tv;
/** One full round trip within the existing page duration; pause at both ends. */
final class HeadlineMotion {
 private HeadlineMotion(){}
 static float offset(float overflow,long elapsed,long duration){
  if(overflow<=0||duration<=0)return 0;
  double t=Math.max(0,Math.min(1,elapsed/(double)duration));
  if(t<=.1||t>=.95)return 0;
  if(t<.45)return (float)(overflow*ease((t-.1)/.35));
  if(t<=.6)return overflow;
  return (float)(overflow*(1-ease((t-.6)/.35)));
 }
 private static double ease(double t){return t*t*(3-2*t);}
}

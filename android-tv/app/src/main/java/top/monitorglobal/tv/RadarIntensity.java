package top.monitorglobal.tv;

import java.util.Locale;

/** One shared scale for the radar raster and its on-screen legend. */
final class RadarIntensity {
 private static final int[] LEVELS={5,15,25,35,45,55,65};
 private static final int[] COLORS={0x882264a3,0xaa3698d5,0xbb24b664,0xcce2d739,0xccf28d21,0xdcdc3036,0xdcad36b6};
 static final int UNKNOWN=-2, BELOW_SCALE=-1;
 static int count(){return LEVELS.length;}
 static int band(float dbz){
  if(!WeatherMapLayer.usableReflectivity(dbz))return UNKNOWN;
  if(dbz<LEVELS[0])return BELOW_SCALE;
  int i=LEVELS.length-1;while(i>0&&dbz<LEVELS[i])i--;return i;
 }
 static int color(int band){return COLORS[band];}
 static int pixel(float dbz,int x,int y){
  int i=band(dbz);
  if(i==UNKNOWN)return ((x+y)%12<2)?0xff42464a:0xff24272a;
  return i==BELOW_SCALE?0x00102024:color(i);
 }
 static String label(int band){
  if(band==UNKNOWN)return "Sem dado confirmado";
  if(band==BELOW_SCALE)return "Abaixo de 5 dBZ";
  return band==LEVELS.length-1?"65+":LEVELS[band]+"–<"+LEVELS[band+1];
 }
 static String reflectivity(float dbz){
  return band(dbz)==UNKNOWN?"Refletividade indisponível":String.format(Locale.forLanguageTag("pt-BR"),"%.1f dBZ",dbz);
 }
 /** No quantitative rainfall product is validated for the CAPPI radar layer yet. */
 static String rainRate(){return "mm/h indisponível";}
 static String accumulation(){return "Acumulado indisponível";}
 /** Integration only for a supplied quantitative rate and its actual interval. */
 static double accumulate(double rateMmHour,long durationMillis){
  if(!Double.isFinite(rateMmHour)||rateMmHour<0||durationMillis<=0||durationMillis>3600000L)return Double.NaN;
  double mm=rateMmHour*(durationMillis/3600000d);
  return Double.isFinite(mm)?mm:Double.NaN;
 }
}

package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;

/** Real GOES infrared image in the same compact native card as weather and Brent. */
final class WeatherSatelliteCard extends LinearLayout {
 private final ImageView map,legend;

 WeatherSatelliteCard(Context c,WeatherSatelliteClient.Frame frame,boolean large){
  super(c);setOrientation(VERTICAL);setBackground(TvCardStyle.panel(c,TvCardStyle.BODY));
  Typeface brand=TvCardStyle.brand(c);
  LinearLayout header=TvCardStyle.header(c);
  header.addView(TvCardStyle.label(c,"SATÉLITE  /  "+frame.scope.name.toUpperCase(java.util.Locale.ROOT),large?20:16,TvCardStyle.BODY,brand,2));
  addView(header,new LayoutParams(-1,-2));

  LinearLayout content=TvCardStyle.body(c);
  content.setPadding(dp(12),dp(9),dp(12),dp(8));
  map=new ImageView(c);map.setScaleType(ImageView.ScaleType.FIT_CENTER);
  map.setContentDescription("Imagem infravermelha do "+frame.scope.name+" com referência de São Paulo");
  map.setImageBitmap(frame.image);
  content.addView(map,new LayoutParams(-1,large?dp(280):dp(225)));
  addView(content,new LayoutParams(-1,-2));

  LinearLayout footer=TvCardStyle.footer(c);
  label(footer,"Temperatura de brilho · °C",large?16:13,TvCardStyle.WHITE,brand);
  legend=new ImageView(c);legend.setScaleType(ImageView.ScaleType.FIT_CENTER);
  legend.setContentDescription(frame.legendDescription());
  if(frame.legend!=null){legend.setImageBitmap(frame.legend);footer.addView(legend,new LayoutParams(-1,dp(55)));}
  else label(footer,"Legenda da fonte indisponível",12,TvCardStyle.MUTED,brand);
  label(footer,InfraredPlan.timing(frame.at,System.currentTimeMillis()),large?16:13,
   System.currentTimeMillis()-frame.at>InfraredPlan.FRESH_AGE?0xffffcf7e:TvCardStyle.WHITE,brand);
  label(footer,frame.credit(),large?14:12,TvCardStyle.MUTED,brand);
  label(footer,"Infravermelho · não mede intensidade da chuva",large?14:11,TvCardStyle.MUTED,Typeface.DEFAULT);
  addView(footer,new LayoutParams(-1,-2));
 }
 private void label(LinearLayout parent,String value,int size,int color,Typeface face){
  TextView t=TvCardStyle.label(getContext(),value,size,color,face,3);
  LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
  p.topMargin=dp(2);
  parent.addView(t,p);
 }
 private int dp(int v){return TvCardStyle.dp(getContext(),v);}
 void clear(){map.setImageDrawable(null);legend.setImageDrawable(null);}
}

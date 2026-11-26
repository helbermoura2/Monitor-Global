package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;

/** Real GOES infrared image in the same compact native card as weather and Brent. */
final class WeatherSatelliteCard extends LinearLayout {
 private final ImageView map,legend;

 WeatherSatelliteCard(Context c,WeatherSatelliteClient.Frame frame,boolean large){
  super(c);
  if(large){
   // Full-screen mode: map gets all available height, independent of sidebar text.
   setOrientation(HORIZONTAL);setBackgroundColor(android.graphics.Color.BLACK);
   map=new ImageView(c);map.setScaleType(ImageView.ScaleType.FIT_CENTER);
   map.setImageBitmap(frame.image);map.setContentDescription("Imagem infravermelha · "+frame.scope.name);
   addView(map,new LayoutParams(0,-1,4));
   LinearLayout side=new LinearLayout(c);side.setOrientation(VERTICAL);side.setBackgroundColor(0xff111316);
   side.setPadding(dp(10),dp(8),dp(10),dp(8));
   ScrollView scroll=new ScrollView(c);scroll.setFocusable(false);scroll.setFillViewport(false);scroll.addView(side,new ScrollView.LayoutParams(-1,-2));
   addView(scroll,new LayoutParams(0,-1,1));
   Typeface face=OledNewsChrome.regularFont();
   label(side,"INFRAVERMELHO",13,0xffff6d7f,OledNewsChrome.titleFont(null));
   label(side,"Temperatura de brilho (°C)",12,0xffe4e8ec,face);
   legend=new ImageView(c);legend.setScaleType(ImageView.ScaleType.FIT_CENTER);legend.setContentDescription(frame.legendDescription());
   if(frame.legend!=null){legend.setImageBitmap(frame.legend);side.addView(legend,new LayoutParams(-1,dp(38)));}
   else label(side,"Escala da fonte indisponível",11,0xffb9c2c8,face);
   label(side,"MOVIMENTO DAS NUVENS",12,0xffff6d7f,OledNewsChrome.titleFont(null));
   label(side,frame.motion==null?"Sem estimativa confiável":frame.motion.description(),13,0xffe4e8ec,face);
   if(frame.motion!=null)label(side,frame.motion.coherence(),11,0xffb9c2c8,face);
   label(side,"Não indica trajetória nem intensidade da chuva.",11,0xffb9c2c8,face);
   return;
  }
  setOrientation(VERTICAL);setBackground(TvCardStyle.panel(c,TvCardStyle.BODY));
  Typeface brand=TvCardStyle.brand(c);
  LinearLayout header=TvCardStyle.header(c);
  header.addView(TvCardStyle.label(c,"SATÉLITE  /  "+frame.scope.name.toUpperCase(java.util.Locale.ROOT),large?20:16,TvCardStyle.BODY,brand,2));
  addView(header,new LayoutParams(-1,-2));

  LinearLayout content=TvCardStyle.body(c);
  content.setPadding(dp(12),dp(9),dp(12),dp(8));
  map=new ImageView(c);map.setScaleType(ImageView.ScaleType.FIT_CENTER);
  map.setContentDescription("Imagem infravermelha do "+frame.scope.name+" com referência de São Paulo");
  map.setImageBitmap(frame.image);
  content.addView(map,new LayoutParams(-1,large?0:dp(225),large?1:0));
  addView(content,new LayoutParams(-1,large?0:-2,large?1:0));

  LinearLayout footer=TvCardStyle.footer(c);
  label(footer,"Temperatura de brilho · °C",large?16:13,TvCardStyle.WHITE,brand);
  legend=new ImageView(c);legend.setScaleType(ImageView.ScaleType.FIT_CENTER);
  legend.setContentDescription(frame.legendDescription());
  if(frame.legend!=null){legend.setImageBitmap(frame.legend);footer.addView(legend,new LayoutParams(-1,dp(55)));}
  else label(footer,"Legenda da fonte indisponível",12,TvCardStyle.MUTED,brand);
  label(footer,InfraredPlan.timing(frame.at,System.currentTimeMillis()),large?16:13,
   System.currentTimeMillis()-frame.at>InfraredPlan.FRESH_AGE?0xffffcf7e:TvCardStyle.WHITE,brand);
  label(footer,frame.credit(),large?14:12,TvCardStyle.MUTED,brand);
  if(frame.motion!=null){
   label(footer,frame.motion.description()+" · "+frame.motion.coherence(),
    large?16:13,TvCardStyle.CYAN,brand);
   label(footer,"Comparação de "+Math.max(1,(frame.motion.newerAt-frame.motion.olderAt)/60000)+" min entre quadros",
    large?13:11,TvCardStyle.MUTED,Typeface.DEFAULT);
  }else{
   label(footer,"Movimento das nuvens: sem estimativa confiável nesta consulta",
    large?14:12,TvCardStyle.MUTED,brand);
  }
  label(footer,"Deslocamento visual das nuvens · não representa trajetória da chuva",
   large?13:11,TvCardStyle.MUTED,Typeface.DEFAULT);
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

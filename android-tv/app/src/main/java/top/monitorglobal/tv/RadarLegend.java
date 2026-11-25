package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.view.*;
import android.widget.*;

/** Compact legend below the existing map, never covering geography. */
final class RadarLegend extends LinearLayout {
 private final TextView metadata;
 RadarLegend(Context c){this(c,false);}
 RadarLegend(Context c,boolean side){
  super(c);setOrientation(VERTICAL);setPadding(dp(8),dp(4),dp(8),dp(4));setBackgroundColor(0xff111316);
  LinearLayout scale=new LinearLayout(c);scale.setOrientation(side?VERTICAL:HORIZONTAL);scale.setGravity(Gravity.CENTER_VERTICAL);
  TextView unit=text("dBZ",13);scale.addView(unit,new LayoutParams(side?-1:dp(46),-2));
  for(int i=0;i<RadarIntensity.count();i++){
   LinearLayout cell=new LinearLayout(c);cell.setOrientation(side?HORIZONTAL:VERTICAL);cell.setGravity(Gravity.CENTER_VERTICAL);
   View swatch=new View(c);swatch.setBackgroundColor(RadarIntensity.color(i)|0xff000000);cell.addView(swatch,new LayoutParams(side?dp(24):-1,dp(side?8:7)));
   TextView value=text(RadarIntensity.label(i),11);value.setGravity(side?Gravity.CENTER_VERTICAL:Gravity.CENTER);if(side)value.setPadding(dp(6),0,0,0);cell.addView(value,new LayoutParams(-1,-2));
   scale.addView(cell,side?new LayoutParams(-1,-2):new LayoutParams(0,-2,1));
  }
  addView(scale,new LayoutParams(-1,-2));
  metadata=text("",13);metadata.setMaxLines(side?6:3);addView(metadata,new LayoutParams(-1,-2));
  setFocusable(false);setContentDescription("Legenda de refletividade observada, não taxa de chuva");
 }
 void update(RadarMapClient.Frame frame,long now){
  if(frame==null){metadata.setText("INPE / DECEA · Radar indisponível · Não equivale a ausência de chuva");return;}
  long age=Math.max(0,(now-frame.at)/60000L);
  String validity=now<frame.at?"HORÁRIO INVÁLIDO":age>=60?"DADO VENCIDO":age>30?"DEFASADO":"DISPONÍVEL";
  metadata.setText("OBSERVADO · "+frame.credit()+" · "+InfraredPlan.timing(frame.at,now)+" · "+validity+
    "\nCinza hachurado: sem dado confirmado · <5 dBZ: abaixo da escala · "+RadarIntensity.rainRate()+" · "+RadarIntensity.accumulation());
 }
 private TextView text(String value,int size){TextView v=new TextView(getContext());v.setText(value);v.setTextColor(Color.WHITE);v.setTextSize(size);return v;}
 private int dp(int n){return TvCardStyle.dp(getContext(),n);}
}

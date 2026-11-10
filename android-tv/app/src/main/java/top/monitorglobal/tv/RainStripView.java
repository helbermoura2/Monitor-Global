package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

/** Rain-only HUD in the same navy/cyan/Rajdhani visual system as Brent and temperature. */
final class RainStripView extends LinearLayout {
 private TextView ai;
 private LinearLayout aiHost;
 private RainForecast.Summary aiRain;

 RainStripView(Context context,RainForecast.Summary rain,boolean demo,boolean preview){
  super(context);
  setOrientation(VERTICAL);
  setBackground(TvCardStyle.panel(context,TvCardStyle.BODY));
  Typeface brand=TvCardStyle.brand(context);

  LinearLayout header=TvCardStyle.header(context);
  LinearLayout headRow=new LinearLayout(context);
  headRow.setGravity(Gravity.CENTER_VERTICAL);
  header.addView(headRow);
  TextView heading=TvCardStyle.label(context,"CHUVA  /  LIBERDADE, SP",16,TvCardStyle.BODY,brand,2);
  headRow.addView(heading,new LayoutParams(0,-2,1f));
  headRow.addView(TvCardStyle.label(context,demo?"SIMULAÇÃO":"PREVISÃO",12,TvCardStyle.BODY,brand,1));
  addView(header,new LayoutParams(-1,-2));

  LinearLayout body=TvCardStyle.body(context);
  LinearLayout hero=new LinearLayout(context);
  hero.setGravity(Gravity.CENTER_VERTICAL);
  body.addView(hero);
  boolean snow=rain.title.startsWith("Neve"),dry=rain.state.equals("dry");
  View icon=new WeatherCardView.Icon(context,dry?WeatherCardView.Icon.CLOUD:snow?WeatherCardView.Icon.SNOW:WeatherCardView.Icon.RAIN);
  LinearLayout.LayoutParams iconParams=new LayoutParams(dp(38),dp(38));
  iconParams.setMarginEnd(dp(12));hero.addView(icon,iconParams);
  LinearLayout copy=new LinearLayout(context);copy.setOrientation(VERTICAL);
  hero.addView(copy,new LayoutParams(0,-2,1f));
  label(copy,headline(rain),23,TvCardStyle.WHITE,brand,2);
  label(copy,details(rain),15,TvCardStyle.MUTED,brand,3);
  addView(body,new LayoutParams(-1,-2));

  LinearLayout footer=TvCardStyle.footer(context);
  if(!demo){aiRain=rain;ai=TvCardStyle.label(context,"",13,TvCardStyle.CYAN,brand,3);aiHost=footer;refreshBriefing();}
  String source=demo?"TESTE FICTÍCIO · dados de demonstração":"Rainbow Weather · estimativa"+(rain.at>0?" · "+WeatherForecast.time(rain.at):"");
  label(footer,source,12,TvCardStyle.MUTED,Typeface.DEFAULT,2);
  if(preview)label(footer,"Cenário fictício · "+WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(context)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(context)],12,TvCardStyle.CYAN,brand,2);
  addView(footer,new LayoutParams(-1,-2));
 }
 void refreshBriefing(){
  if(ai==null)return;
  String value=WeatherBriefingClient.text(getContext(),"rain",null,aiRain);
  if(value.isEmpty()){if(ai.getParent()!=null)aiHost.removeView(ai);return;}
  ai.setText("IA · "+value);
  if(ai.getParent()==null)aiHost.addView(ai,0,new LayoutParams(-1,-2));
 }
 static String headline(RainForecast.Summary rain){
  String noun=rain.title.startsWith("Neve")?"Neve":"Chuva";
  if(rain.state.equals("soon"))return rain.arrivalMinutes>=0?noun+" em ~"+rain.arrivalMinutes+" min":noun+" se aproximando";
  return rain.state.equals("now")?noun+" estimada agora":"Sem "+noun.toLowerCase(Locale.ROOT)+" estimada";
 }
 static String details(RainForecast.Summary rain){
  String amount=Double.isFinite(rain.amount)&&rain.amount>=0?RainForecast.number(rain.amount)+" mm nos próximos 60 min":"Acumulado indisponível";
  if(rain.state.equals("dry"))return amount;
  String level=rain.forecastLevel.isEmpty()?"Intensidade indisponível":rain.forecastLevel.substring(0,1).toUpperCase(Locale.ROOT)+rain.forecastLevel.substring(1);
  String duration="duração indefinida";
  if(rain.durationMinutes>0)duration=rain.durationLabel.startsWith("Janela")?"janela ~"+rain.durationMinutes+" min":rain.state.equals("now")?"~"+rain.durationMinutes+" min restantes":"duração ~"+rain.durationMinutes+" min";
  return level+" · "+duration+" · "+amount;
 }
 private void label(LinearLayout parent,String value,int size,int color,Typeface face,int lines){
  parent.addView(TvCardStyle.label(getContext(),value,size,color,face,lines),new LayoutParams(-1,-2));
 }
 private int dp(int n){return TvCardStyle.dp(getContext(),n);}
}

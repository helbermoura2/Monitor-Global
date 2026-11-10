package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
  // On compact displays, the original one-line broadcast strip stays below 30% of screen height.
  if(context.getResources().getConfiguration().screenHeightDp<650){shortScreen(context,rain,demo,preview);return;}
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
  if(preview)label(footer,"Chuva · exemplo fictício · "+WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(context)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(context)],12,TvCardStyle.CYAN,brand,2);
  addView(footer,new LayoutParams(-1,-2));
 }
 private void shortScreen(Context c,RainForecast.Summary rain,boolean demo,boolean preview){
  setOrientation(HORIZONTAL);setGravity(Gravity.CENTER_VERTICAL);setPadding(dp(12),dp(9),dp(12),dp(9));
  GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xff102a40,TvCardStyle.BODY});
  bg.setCornerRadius(dp(10));bg.setStroke(dp(1),0x8838bdf8);setBackground(bg);
  boolean snow=rain.title.startsWith("Neve"),dry=rain.state.equals("dry");
  View icon=new WeatherCardView.Icon(c,dry?WeatherCardView.Icon.CLOUD:snow?WeatherCardView.Icon.SNOW:WeatherCardView.Icon.RAIN);
  addView(icon,new LayoutParams(dp(30),dp(30)));
  View accent=new View(c);accent.setBackgroundColor(TvCardStyle.CYAN);
  LayoutParams divider=new LayoutParams(dp(2),dp(40));divider.setMargins(dp(10),0,dp(10),0);addView(accent,divider);
  LinearLayout words=new LinearLayout(c);words.setOrientation(VERTICAL);addView(words,new LayoutParams(0,-2,1f));
  Typeface brand=TvCardStyle.brand(c);
  boolean narrow=c.getResources().getDisplayMetrics().widthPixels/c.getResources().getDisplayMetrics().density<800;
  label(words,headline(rain)+" · Liberdade, SP",narrow?18:21,TvCardStyle.WHITE,brand,2);
  label(words,details(rain),narrow?13:15,TvCardStyle.MUTED,brand,c.getResources().getConfiguration().fontScale>1.1f?3:2);
  if(!demo){aiRain=rain;ai=TvCardStyle.label(c,"",narrow?12:13,TvCardStyle.CYAN,brand,3);aiHost=words;refreshBriefing();}
  View rule=new View(c);rule.setBackgroundColor(0x4438bdf8);
  LayoutParams line=new LayoutParams(-1,dp(1));line.topMargin=dp(5);line.bottomMargin=dp(4);words.addView(rule,line);
  String source=demo?"TESTE FICTÍCIO · dados de demonstração":"Rainbow Weather · estimativa"+(rain.at>0?" · "+WeatherForecast.time(rain.at):"");
  label(words,source,narrow?10:11,TvCardStyle.MUTED,Typeface.DEFAULT,2);
  if(preview)label(words,"Chuva · exemplo fictício · "+WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(c)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(c)],11,TvCardStyle.CYAN,brand,2);
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

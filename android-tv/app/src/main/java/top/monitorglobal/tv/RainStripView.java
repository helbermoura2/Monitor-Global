package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

/** Compact rain-only notice; all figures remain forecast estimates. */
final class RainStripView extends LinearLayout {
 RainStripView(Context context,RainForecast.Summary rain,boolean demo,boolean preview){
  super(context);setOrientation(HORIZONTAL);setGravity(Gravity.CENTER_VERTICAL);setPadding(dp(12),dp(9),dp(12),dp(9));
  GradientDrawable background=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xff102a40,WeatherCardView.BODY});
  background.setCornerRadius(dp(10));background.setStroke(dp(1),0x8838bdf8);setBackground(background);
  boolean snow=rain.title.startsWith("Neve"),dry=rain.state.equals("dry");
  View icon=new WeatherCardView.Icon(context,dry?WeatherCardView.Icon.CLOUD:snow?WeatherCardView.Icon.SNOW:WeatherCardView.Icon.RAIN);
  addView(icon,new LayoutParams(dp(30),dp(30)));
  View accent=new View(context);accent.setBackgroundColor(WeatherCardView.CYAN);LayoutParams divider=new LayoutParams(dp(2),dp(40));divider.setMargins(dp(10),0,dp(10),0);addView(accent,divider);
  LinearLayout words=new LinearLayout(context);words.setOrientation(VERTICAL);addView(words,new LayoutParams(0,LayoutParams.WRAP_CONTENT,1));
  Typeface brand=Typeface.createFromAsset(context.getAssets(),"fonts/Rajdhani-Bold.ttf");
  boolean narrow=context.getResources().getDisplayMetrics().widthPixels/context.getResources().getDisplayMetrics().density<800;
  label(words,headline(rain)+" · Liberdade, SP",narrow?18:21,Color.WHITE,brand,2);
  label(words,details(rain),narrow?13:15,WeatherCardView.MUTED,brand,context.getResources().getConfiguration().fontScale>1.1f?3:2);
  View rule=new View(context);rule.setBackgroundColor(0x4438bdf8);LayoutParams line=new LayoutParams(-1,dp(1));line.topMargin=dp(5);line.bottomMargin=dp(4);words.addView(rule,line);
  String source=demo?"TESTE FICTÍCIO · dados de demonstração":"Rainbow Weather · estimativa"+(rain.at>0?" · "+WeatherForecast.time(rain.at):"");
  label(words,source,narrow?10:11,WeatherCardView.MUTED,Typeface.DEFAULT,2);
  if(preview)label(words,"Chuva · exemplo fictício · "+WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(context)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(context)],11,WeatherCardView.CYAN,brand,2);
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
 private void label(LinearLayout parent,String value,int size,int color,Typeface face,int maxLines){TextView text=new TextView(getContext());text.setText(value);text.setTextSize(size);text.setTextColor(color);text.setTypeface(face);text.setIncludeFontPadding(false);text.setMaxLines(maxLines);parent.addView(text,new LayoutParams(-1,-2));}
 private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}

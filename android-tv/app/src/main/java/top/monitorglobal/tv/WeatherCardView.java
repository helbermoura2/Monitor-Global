package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;

/** Solid, accessible weather/rain card. Icons are local paths, not remote images. */
final class WeatherCardView extends LinearLayout {
 static final int BODY=0xff071724,FOOT=0xff020816,CYAN=0xff38bdf8,MUTED=0xffbfd1df;
 private final Typeface brand;private TextView ai;private WeatherForecast.Summary aiWeather;private RainForecast.Summary aiRain;
 WeatherCardView(Context c,RainForecast.Summary rain,WeatherForecast.Summary weather,boolean demo,boolean preview){
  super(c);setOrientation(VERTICAL);brand=Typeface.createFromAsset(c.getAssets(),"fonts/Rajdhani-Bold.ttf");setBackground(shape(BODY,true));
  boolean rainFocus=weather==null&&rain!=null&&!rain.state.equals("dry");
  String topic=rainFocus?(rain.title.startsWith("Neve")?"NEVE":"CHUVA"):"TEMPO";
  LinearLayout header=section(CYAN,10,5);line(header,topic+" · LIBERDADE, SP"+(demo?" · TESTE FICTÍCIO":""),15,BODY,brand,2);
  LinearLayout body=section(BODY,12,10);
  if(preview){line(body,"CHUVA · PRÉVIA VISUAL FICTÍCIA",15,CYAN,brand,2);line(body,WeatherPreviewOptions.STYLES[WeatherPreviewOptions.style(c)]+" · "+WeatherPreviewOptions.LEVELS[WeatherPreviewOptions.level(c)],13,MUTED,brand,2);}
  if(rainFocus)rainBody(body,rain,weather);else if(weather!=null)weatherBody(body,weather,rain);else if(rain!=null){hero(body,Icon.CLOUD,rain.title,25,"");line(body,rain.amountText,16,Color.WHITE,brand,2);}else line(body,"Meteorologia indisponível",23,Color.WHITE,brand,2);
  LinearLayout footer=new LinearLayout(c);footer.setOrientation(VERTICAL);footer.setPadding(dp(12),dp(7),dp(12),dp(8));footer.setBackground(shape(FOOT,true));addView(footer,new LayoutParams(-1,-2));
  if(!demo&&weather!=null){aiWeather=weather;aiRain=rain;ai=text("",13,CYAN,brand,3);footer.addView(ai,new LayoutParams(-1,-2));refreshBriefing();}
  if(demo)line(footer,"DEMONSTRAÇÃO LOCAL · DADOS FICTÍCIOS",12,CYAN,brand,2);
  if(weather!=null)line(footer,weather.timing,11,MUTED,Typeface.DEFAULT,2);
  line(footer,"Rainbow Weather"+(rain==null?" · previsão horária":" · chuva consultada "+WeatherForecast.time(rain.at)),12,MUTED,brand,2);
  line(footer,demo?"Demonstração · não informa o tempo atual":"Estimativa para um ponto da Liberdade · sujeita a mudanças",11,MUTED,Typeface.DEFAULT,2);
 }
 void refreshBriefing(){if(ai==null)return;String value=WeatherBriefingClient.text(getContext(),"hourly",aiWeather,aiRain);ai.setVisibility(value.isEmpty()?GONE:VISIBLE);ai.setText(value.isEmpty()?"":"RESUMO COM IA · "+value);}
 private void weatherBody(LinearLayout body,WeatherForecast.Summary w,RainForecast.Summary rain){
  boolean components=!w.temperatureValue.equals("—");
  if(components){
   LinearLayout hero=new LinearLayout(getContext());hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LayoutParams(-1,-2));
   TextView temperature=text(w.temperatureValue,36,Color.WHITE,brand,2);LayoutParams value=new LayoutParams(0,-2,1.05f);value.setMarginEnd(dp(8));hero.addView(temperature,value);
   Icon icon=new Icon(getContext(),conditionIcon(w.conditionKey));LayoutParams glyph=new LayoutParams(dp(38),dp(38));glyph.setMarginEnd(dp(8));hero.addView(icon,glyph);
   LinearLayout conditions=new LinearLayout(getContext());conditions.setOrientation(VERTICAL);hero.addView(conditions,new LayoutParams(0,-2,1.35f));line(conditions,w.condition,20,Color.WHITE,brand,3);line(conditions,"Sensação "+w.feelsValue,15,MUTED,brand,2);
   LinearLayout metrics=metrics(body);metric(metrics,Icon.DROP,w.humidityValue,"Umidade");metric(metrics,Icon.WIND,w.windValue,"Vento");metric(metrics,Icon.GUST,w.gustValue,"Rajadas");
  }else{
   hero(body,conditionIcon(w.conditionKey),w.temperature,25,w.condition);
   line(body,w.humidity,16,Color.WHITE,brand,2);line(body,w.wind,16,Color.WHITE,brand,2);
  }
  line(body,rain==null?"Chuva por minuto: indisponível":rain.title,14,MUTED,brand,2);
  if(rain!=null)line(body,rain.amountText,13,MUTED,brand,2);
 }
 private void rainBody(LinearLayout body,RainForecast.Summary r,WeatherForecast.Summary w){
  hero(body,r.title.startsWith("Neve")?Icon.SNOW:Icon.RAIN,r.title,27,r.forecastLevel.isEmpty()?"":r.forecastLevel+" · previsão por minuto");
  if(w!=null&&w.stormForecast&&r.rain)line(body,"Tempestade prevista pela fonte horária",14,CYAN,brand,2);
  LinearLayout row=metrics(body);metric(row,Icon.DROP,RainForecast.number(r.amount)+" mm","Acumulado previsto · próximos 60 min");metric(row,Icon.HOURGLASS,r.durationMinutes>0?"~"+r.durationMinutes+" min":"—",r.durationLabel);metric(row,Icon.RAIN,Double.isFinite(r.forecastRate)?RainForecast.number(r.forecastRate)+" mm/h":"—",r.state.equals("soon")?"Intensidade no início previsto":"Intensidade estimada agora");
  if(!Double.isFinite(r.forecastRate))line(body,"Intensidade ainda indisponível",12,MUTED,brand,2);
  detail(body,Icon.CLOCK,r.stopText,14);
  if(w!=null){line(body,w.temperature+" · "+w.humidity,13,MUTED,brand,2);line(body,w.condition+" · "+w.wind,13,MUTED,brand,3);}
 }
 private void hero(LinearLayout body,int kind,String title,int size,String subtitle){LinearLayout row=new LinearLayout(getContext());row.setGravity(Gravity.CENTER_VERTICAL);body.addView(row,new LayoutParams(-1,-2));Icon icon=new Icon(getContext(),kind);LayoutParams glyph=new LayoutParams(dp(42),dp(42));glyph.setMarginEnd(dp(10));row.addView(icon,glyph);LinearLayout words=new LinearLayout(getContext());words.setOrientation(VERTICAL);row.addView(words,new LayoutParams(0,-2,1));line(words,title,size,Color.WHITE,brand,3);if(!subtitle.isEmpty())line(words,subtitle,14,MUTED,brand,2);}
 private void detail(LinearLayout body,int kind,String value,int size){LinearLayout row=new LinearLayout(getContext());row.setGravity(Gravity.CENTER_VERTICAL);LayoutParams rp=new LayoutParams(-1,-2);rp.topMargin=dp(8);body.addView(row,rp);LayoutParams glyph=new LayoutParams(dp(20),dp(20));glyph.setMarginEnd(dp(7));row.addView(new Icon(getContext(),kind),glyph);row.addView(text(value,size,MUTED,brand,3),new LayoutParams(0,-2,1));}
 private LinearLayout metrics(LinearLayout body){LinearLayout row=new LinearLayout(getContext());row.setBaselineAligned(false);LayoutParams rp=new LayoutParams(-1,-2);rp.topMargin=dp(11);rp.bottomMargin=dp(3);body.addView(row,rp);return row;}
 private void metric(LinearLayout row,int kind,String value,String label){LinearLayout cell=new LinearLayout(getContext());cell.setOrientation(VERTICAL);cell.setPadding(0,0,dp(6),0);row.addView(cell,new LayoutParams(0,-2,1));LinearLayout top=new LinearLayout(getContext());top.setGravity(Gravity.CENTER_VERTICAL);cell.addView(top,new LayoutParams(-1,-2));LayoutParams glyph=new LayoutParams(dp(18),dp(18));glyph.setMarginEnd(dp(5));top.addView(new Icon(getContext(),kind),glyph);top.addView(text(value,20,Color.WHITE,brand,2),new LayoutParams(0,-2,1));line(cell,label,12,MUTED,brand,3);}
 private LinearLayout section(int color,int horizontal,int vertical){LinearLayout v=new LinearLayout(getContext());v.setOrientation(VERTICAL);v.setPadding(dp(horizontal),dp(vertical),dp(horizontal),dp(vertical));v.setBackgroundColor(color);addView(v,new LayoutParams(-1,-2));return v;}
 private GradientDrawable shape(int color,boolean bottom){GradientDrawable d=new GradientDrawable();d.setColor(color);float r=dp(8);d.setCornerRadii(new float[]{0,0,0,0,bottom?r:0,bottom?r:0,bottom?r:0,bottom?r:0});return d;}
 private TextView text(String value,int size,int color,Typeface font,int lines){TextView t=new TextView(getContext());t.setText(value);t.setTextColor(color);t.setTextSize(size);t.setTypeface(font);t.setIncludeFontPadding(false);t.setMaxLines(lines);return t;}
 private void line(LinearLayout parent,String value,int size,int color,Typeface font,int lines){TextView t=text(value,size,color,font,lines);LayoutParams p=new LayoutParams(-1,-2);p.topMargin=dp(2);parent.addView(t,p);}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 static int conditionIcon(String key){switch(key){case "Clear":case "MostlyClear":return Icon.SUN;case "PartlyCloudy":case "MostlyCloudy":case "Cloudy":return Icon.CLOUD;case "Drizzle":case "Rain":case "HeavyRain":case "Thunderstorms":case "StrongStorms":case "ScatteredThunderstorms":case "IsolatedThunderstorms":return Icon.RAIN;case "Snow":case "HeavySnow":return Icon.SNOW;case "Foggy":case "Haze":return Icon.FOG;default:return Icon.UNKNOWN;}}
 /** Path and paint are allocated once; no animation, bitmap or draw-time allocation. */
 static final class Icon extends View {
  static final int CLOUD=0,RAIN=1,DROP=2,WIND=3,GUST=4,CLOCK=5,HOURGLASS=6,SUN=7,SNOW=8,FOG=9,UNKNOWN=10;
  private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path path=new Path();
  Icon(Context c,int kind){super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);paint.setColor(Color.WHITE);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.5f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);
   if(kind==CLOUD||kind==RAIN||kind==SNOW||kind==FOG){path.moveTo(6,16);path.cubicTo(0,16,1,8,6,8);path.cubicTo(8,1,17,2,18,8);path.cubicTo(24,8,24,16,18,16);path.lineTo(6,16);if(kind==RAIN){line(7,19,5,22);line(13,19,11,22);line(19,19,17,22);}if(kind==SNOW){line(7,19,7,23);line(5,21,9,21);line(17,19,17,23);line(15,21,19,21);}if(kind==FOG){line(4,19,20,19);line(7,22,17,22);}}
   else if(kind==DROP){path.moveTo(12,2);path.cubicTo(10,6,4,12,5,17);path.cubicTo(7,25,19,23,19,16);path.cubicTo(19,12,14,5,12,2);path.close();}
   else if(kind==WIND||kind==GUST){line(2,8,16,8);path.moveTo(16,8);path.cubicTo(23,8,21,0,17,3);line(2,13,20,13);line(5,18,14,18);path.moveTo(14,18);path.cubicTo(20,18,19,24,15,21);if(kind==GUST)line(1,4,8,4);}
   else if(kind==CLOCK){path.addCircle(12,12,9,Path.Direction.CW);line(12,6,12,12);line(12,12,17,15);}
   else if(kind==HOURGLASS){line(5,3,19,3);line(5,21,19,21);path.moveTo(6,3);path.cubicTo(6,10,18,14,18,21);path.moveTo(18,3);path.cubicTo(18,10,6,14,6,21);}
   else if(kind==SUN){path.addCircle(12,12,5,Path.Direction.CW);line(12,1,12,4);line(12,20,12,23);line(1,12,4,12);line(20,12,23,12);line(4,4,6,6);line(18,18,20,20);line(4,20,6,18);line(18,6,20,4);}
   else{path.addCircle(12,12,9,Path.Direction.CW);path.moveTo(9,9);path.cubicTo(9,5,17,6,15,10);path.lineTo(12,13);line(12,13,12,15);line(12,18,12,18.2f);}
  }
  private void line(float x,float y,float xx,float yy){path.moveTo(x,y);path.lineTo(xx,yy);}
  @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);canvas.save();canvas.scale(getWidth()/24f,getHeight()/24f);canvas.drawPath(path,paint);canvas.restore();}
 }
}

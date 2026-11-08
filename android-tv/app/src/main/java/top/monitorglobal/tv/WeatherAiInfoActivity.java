package top.monitorglobal.tv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Remote-control friendly, opt-in access to the TV's real meteorological AI. */
public final class WeatherAiInfoActivity extends Activity {
 private static final int BG=0xff081724,WHITE=Color.WHITE,MUTED=0xffc0d2dc,CYAN=0xff38bdf8;
 private static final String ENDPOINT="https://black-sky-9ba0.terrestre.workers.dev/weather-briefing?kind=";
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private TextView result;
 private Button hourly,rain;
 private volatile HttpURLConnection current;
 private volatile boolean destroyed;
 private int generation;
 private boolean busy;

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BG);
  LinearLayout column=new LinearLayout(this);column.setOrientation(LinearLayout.VERTICAL);
  column.setPadding(dp(36),dp(20),dp(36),dp(36));scroll.addView(column);
  setContentView(scroll);

  // Same original Radar Scope geometry and 2.4 s rotating sweep as the
  // website; no replacement of logo assets, and no animation outside UI.
  LinearLayout heading=new LinearLayout(this);heading.setGravity(android.view.Gravity.CENTER_VERTICAL);
  RadarLogoView logo=new RadarLogoView(this);
  heading.addView(logo,new LinearLayout.LayoutParams(dp(70),dp(70)));
  LinearLayout brand=new LinearLayout(this);brand.setOrientation(LinearLayout.VERTICAL);
  LinearLayout.LayoutParams headingMargin=new LinearLayout.LayoutParams(0,-2,1f);
  brand.addView(titleText("MONITOR GLOBAL TV",31));
  brand.addView(titleText("IA METEOROLÓGICA · Liberdade, São Paulo",23));
  headingMargin.leftMargin=dp(18);heading.addView(brand,headingMargin);
  column.addView(heading);
  LinearLayout info=panel(column,dp(14));
  text(info,"O que a IA realmente faz",23,CYAN,true);
  text(info,"Ela interpreta previsões verificadas para a Liberdade, em São Paulo. O modelo escolhe quais observações merecem destaque, sem criar números nem alertas por conta própria.",19,MUTED,false);
  text(info,"Quando não existe algo útil para acrescentar, a IA não aparece no cartão. Isso não significa que o monitoramento de terremotos ou tsunami esteja desligado.",17,MUTED,false);
  text(info,"Não é um chat e não prevê terremotos, tsunamis ou danos. As fontes oficiais e os alertas funcionam mesmo quando a IA falha ou atinge seu limite.",17,CYAN,false);
  text(column,"CONSULTA MANUAL · SOMENTE SE VOCÊ PEDIR",20,CYAN,true);
  text(column,"A consulta usa o serviço meteorológico atual e pode consumir parte da franquia compartilhada de IA. Não ativa novos alertas, não muda configurações e não acompanha sua localização.",16,MUTED,false);
  LinearLayout actions=new LinearLayout(this);
  actions.setOrientation(getResources().getConfiguration().screenWidthDp>=900?
    LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);
  column.addView(actions,new LinearLayout.LayoutParams(-1,-2));
  hourly=button(actions,"Consultar análise de IA · tempo na Liberdade",v->query("hourly"));
  rain=button(actions,"Consultar análise de IA · chuva na Liberdade",v->query("rain"));
  button(actions,"Voltar às configurações",v->finish());
  LinearLayout report=panel(column,dp(14));
  text(report,"RESULTADO DA CONSULTA",20,CYAN,true);
  result=text(report,"Selecione uma consulta acima para ver o que a IA tem a acrescentar.",19,WHITE,false);
  LinearLayout cache=panel(column,dp(14));
  text(cache,"ÚLTIMO DESTAQUE GUARDADO NESTA TV",18,CYAN,true);
  text(cache,cached(),16,MUTED,false);
  text(column,"Os alertas sísmicos e de tsunami continuam independentes da IA meteorológica.",16,MUTED,false);
  hourly.requestFocus();
 }
 private String cached(){
  StringBuilder out=new StringBuilder();
  long now=System.currentTimeMillis();
  for(String kind:new String[]{"hourly","rain"}){
   String raw=getSharedPreferences("weather-ai",MODE_PRIVATE).getString(kind,"");
   WeatherBriefing briefing=WeatherBriefing.parse(raw,now);
   if(briefing==null||!kind.equals(briefing.kind))continue;
   if(out.length()>0)out.append("\n\n");
   out.append(kind.equals("rain")?"Chuva":"Tempo horário").append(": ").append(briefing.text);
  }
  return out.length()==0?"Sem destaque recente válido no armazenamento local.":out+"\n\nRegistro local: não equivale a uma previsão atual sem confirmar os dados da fonte.";
 }
 private void query(String kind){
  if(busy||destroyed)return;
  busy=true;hourly.setEnabled(false);rain.setEnabled(false);
  int token=++generation;
  result.setText("Consultando o serviço de IA… A previsão e os alertas da TV continuam funcionando normalmente.");
  io.execute(()->{
   String message="A consulta não pôde ser concluída. Confira a internet e tente novamente. Nenhum alerta é afetado.";
   try {
    for(int attempt=0;attempt<4&&!destroyed;attempt++){
     String raw=read(kind);
     message=WeatherAiStatus.describe(raw,kind,System.currentTimeMillis());
     if(!WeatherAiStatus.pending(raw)||attempt==3)break;
     Thread.sleep(2200);
    }
   }catch(InterruptedException e){Thread.currentThread().interrupt();return;}
    catch(Exception ignored){/* No raw provider errors, URLs or keys in the TV UI. */}
   String output=message;
   main.post(()->{
    if(destroyed||token!=generation)return;
    busy=false;hourly.setEnabled(true);rain.setEnabled(true);
    result.setText(output);
    if(kind.equals("hourly"))hourly.requestFocus();else rain.requestFocus();
   });
  });
 }
 private String read(String kind)throws IOException{
  HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT+(kind.equals("rain")?"rain":"hourly")).openConnection();
  current=connection;connection.setInstanceFollowRedirects(false);
  connection.setConnectTimeout(4000);connection.setReadTimeout(6000);
  connection.setRequestProperty("Accept","application/json");
  connection.setRequestProperty("User-Agent","MonitorGlobalTV-AiInspection/"+BuildConfig.VERSION_NAME);
  try {
   if(connection.getResponseCode()!=200)throw new IOException("AI status unavailable");
   ByteArrayOutputStream body=new ByteArrayOutputStream(1024);
   try(InputStream stream=connection.getInputStream()){
    byte[] buffer=new byte[1024];int n;
    while((n=stream.read(buffer))!=-1){
     if(body.size()+n>6000)throw new IOException("AI response oversized");
     body.write(buffer,0,n);
    }
   }
   return new String(body.toByteArray(),StandardCharsets.UTF_8);
  }finally{
   connection.disconnect();if(current==connection)current=null;
  }
 }
 private TextView titleText(String value,int size){
  TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
  t.setTextColor(WHITE);
  try{t.setTypeface(Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf"));}
  catch(RuntimeException ignored){t.setTypeface(null,Typeface.BOLD);}
  return t;
 }
 private LinearLayout panel(LinearLayout parent,int marginTop){
  LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);
  card.setPadding(dp(19),dp(13),dp(19),dp(13));
  GradientDrawable bg=new GradientDrawable();bg.setColor(0xff112b40);
  bg.setCornerRadius(dp(14));bg.setStroke(dp(1),0xff2c647f);
  card.setBackground(bg);
  LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);
  params.topMargin=marginTop;parent.addView(card,params);
  return card;
 }
 private TextView text(LinearLayout host,String value,int size,int color,boolean bold){
  TextView view=new TextView(this);view.setText(value);view.setTextSize(size);
  view.setTextColor(color);view.setPadding(0,dp(8),0,dp(8));
  if(bold)view.setTypeface(null,Typeface.BOLD);
  host.addView(view,new LinearLayout.LayoutParams(-1,-2));return view;
 }
 private Button button(LinearLayout host,String value,View.OnClickListener action){
  Button b=new Button(this);b.setText(value);b.setTextSize(19);b.setTextColor(WHITE);
  b.setAllCaps(false);b.setMinHeight(dp(74));b.setPadding(dp(17),dp(10),dp(17),dp(10));
  b.setOnClickListener(action);
  b.setOnFocusChangeListener((v,focused)->styleButton(b,focused));
  styleButton(b,false);
  boolean horizontal=host.getOrientation()==LinearLayout.HORIZONTAL;
  LinearLayout.LayoutParams p=horizontal?
    new LinearLayout.LayoutParams(0,-2,1f):new LinearLayout.LayoutParams(-1,-2);
  p.setMargins(dp(4),dp(6),dp(4),dp(6));host.addView(b,p);return b;
 }
 private void styleButton(Button b,boolean focused){
  GradientDrawable bg=new GradientDrawable();bg.setColor(focused?0xff084656:0xff162f45);
  bg.setCornerRadius(dp(12));bg.setStroke(dp(focused?3:1),
    focused?0xff00f0f4:0xff42647a);b.setBackground(bg);
 }
 private int dp(int size){return Math.round(size*getResources().getDisplayMetrics().density);}
 @Override protected void onDestroy(){
  destroyed=true;generation++;main.removeCallbacksAndMessages(null);
  HttpURLConnection connection=current;if(connection!=null)connection.disconnect();
  io.shutdownNow();super.onDestroy();
 }
}

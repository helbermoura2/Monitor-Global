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
 private static final int BG=Color.BLACK,WHITE=Color.WHITE,MUTED=0xffc0c4ca,CYAN=0xffff6d7f;
 private static final String ENDPOINT="https://black-sky-9ba0.terrestre.workers.dev/weather-briefing?kind=";
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private TextView result,cachedResult;
 private Button hourly,rain,seismic;
 private volatile HttpURLConnection current;
 private volatile boolean destroyed;
 private int generation;
 private boolean busy;

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BG);
  root.setPadding(dp(20),dp(10),dp(20),dp(10));setContentView(root);
  LinearLayout heading=new LinearLayout(this);heading.setGravity(android.view.Gravity.CENTER_VERTICAL);
  RadarLogoView logo=new RadarLogoView(this);heading.addView(logo,new LinearLayout.LayoutParams(dp(58),dp(58)));
  LinearLayout brand=new LinearLayout(this);brand.setOrientation(LinearLayout.VERTICAL);
  LinearLayout.LayoutParams hm=new LinearLayout.LayoutParams(0,-2,1f);hm.leftMargin=dp(12);
  brand.addView(titleText("ARGOS ORBIS TV",25));brand.addView(titleText("CENTRAL DE ANÁLISES · METEOROLOGIA E SISMOS",15));heading.addView(brand,hm);
  root.addView(heading,new LinearLayout.LayoutParams(-1,-2));
  View rule=new View(this);rule.setBackgroundColor(OledNewsChrome.RED_DARK);root.addView(rule,new LinearLayout.LayoutParams(-1,dp(2)));
  LinearLayout actions=new LinearLayout(this);actions.setOrientation(LinearLayout.HORIZONTAL);root.addView(actions,new LinearLayout.LayoutParams(-1,-2));
  hourly=button(actions,"Tempo · Liberdade",v->query("hourly"));
  rain=button(actions,"Chuva · Liberdade",v->query("rain"));
  seismic=button(actions,"Último sismo",v->query("seismic"));
  Button back=button(actions,"Voltar",v->finish());
  LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.HORIZONTAL);root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout report=scrollPanel(body,2.15f);
  text(report,"RESULTADO DA CONSULTA",18,CYAN,true);
  result=text(report,"Selecione Tempo, Chuva ou Último sismo para consultar uma análise.",17,WHITE,false);
  LinearLayout info=scrollPanel(body,1f);
  text(info,"SOBRE A ANÁLISE",16,CYAN,true);
  text(info,"Não é um chat. A IA interpreta dados meteorológicos e registros sísmicos publicados. Não cria alertas, não prevê terremotos ou tsunamis e não acompanha sua localização.",14,MUTED,false);
  text(info,"ÚLTIMO DESTAQUE SALVO",15,CYAN,true);
  cachedResult=text(info,cached(),14,WHITE,false);
  text(info,"Consulta manual: pode consumir a franquia compartilhada de IA.",12,MUTED,false);
  TextView footer=titleText("ARGOS ORBIS  ·  ALERTAS INDEPENDENTES DA IA",12);footer.setTextColor(MUTED);footer.setPadding(0,dp(6),0,0);root.addView(footer);
  hourly.setNextFocusRightId(rain.getId());rain.setNextFocusLeftId(hourly.getId());rain.setNextFocusRightId(seismic.getId());seismic.setNextFocusLeftId(rain.getId());seismic.setNextFocusRightId(back.getId());back.setNextFocusLeftId(seismic.getId());
  hourly.requestFocus();
 }
 private LinearLayout scrollPanel(LinearLayout body,float weight){
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setFocusable(true);scroll.setId(View.generateViewId());
  LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-1,weight);p.setMargins(dp(4),dp(3),dp(4),0);body.addView(scroll,p);
  LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(12),dp(8),dp(12),dp(8));
  GradientDrawable bg=new GradientDrawable();bg.setColor(0xff101113);bg.setCornerRadius(dp(7));bg.setStroke(dp(1),0xff36383f);card.setBackground(bg);
  scroll.addView(card,new ScrollView.LayoutParams(-1,-2));return card;
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
  busy=true;hourly.setEnabled(false);rain.setEnabled(false);seismic.setEnabled(false);
  int token=++generation;
  result.setText("Consultando o serviço de IA… A previsão e os alertas da TV continuam funcionando normalmente.");
  io.execute(()->{
   String message="O serviço de IA não respondeu à consulta. A conexão ou o servidor pode estar temporariamente indisponível; os avisos da TV continuam independentes.";
   String lastResponse=null;
   try {
    // A model may legitimately need up to 12 seconds, while the endpoint
    // returns PENDING immediately. Poll the same server-side task only, never
    // start simultaneous model requests or an automatic background timer.
    for(int attempt=0;attempt<12&&!destroyed;attempt++){
     lastResponse=read(kind);
     message=kind.equals("seismic")?seismicDescription(lastResponse):WeatherAiStatus.describe(lastResponse,kind,System.currentTimeMillis());
     if(!(kind.equals("seismic")?isSeismicPending(lastResponse):WeatherAiStatus.pending(lastResponse))||attempt==11)break;
     final int poll=attempt+1;
     main.post(()->{
      if(!destroyed&&token==generation)
       result.setText("O modelo está preparando a análise… Verificação "+poll+" de 12. Os alertas seguem funcionando.");
     });
     Thread.sleep(2400);
    }
    if(lastResponse!=null&&(kind.equals("seismic")?isSeismicPending(lastResponse):WeatherAiStatus.pending(lastResponse)))
     message+="\nO serviço continua processando. Você pode consultar novamente mais tarde, sem ativar alertas extras.";
   }catch(InterruptedException e){Thread.currentThread().interrupt();return;}
    catch(Exception ignored){/* Do not expose raw provider details or arbitrary errors. */}
   String output=message;
   // Unlike the previous screen, an opt-in successful result is now saved
   // in the SAME validated, bounded cache used by the existing weather card.
   WeatherBriefing parsed=kind.equals("seismic")?null:WeatherBriefing.parse(lastResponse,System.currentTimeMillis());
   String validReady=parsed!=null&&kind.equals(parsed.kind)?lastResponse:null;
   main.post(()->{
    if(destroyed||token!=generation)return;
    busy=false;hourly.setEnabled(true);rain.setEnabled(true);seismic.setEnabled(true);
    result.setText(output);
    if(validReady!=null){
     getSharedPreferences("weather-ai",MODE_PRIVATE).edit().putString(kind,validReady).apply();
     cachedResult.setText(cached());
    }
    if(kind.equals("hourly"))hourly.requestFocus();else if(kind.equals("rain"))rain.requestFocus();else seismic.requestFocus();
   });
  });
 }

 private boolean isSeismicPending(String raw){
  try{
   if(raw==null||raw.length()>9000)return false;
   org.json.JSONObject d=new org.json.JSONObject(raw);
   return "seismic-insight-v1".equals(d.optString("version"))&&"pending".equals(d.optString("status"));
  }catch(org.json.JSONException ignored){return false;}
 }
 private String seismicDescription(String raw){
  try{
   if(raw==null||raw.length()>9000)return "Sem resposta científica válida.";
   org.json.JSONObject d=new org.json.JSONObject(raw);
   if(!"seismic-insight-v1".equals(d.optString("version")))return "Resposta científica não reconhecida.";
   String status=d.optString("status");
   if(status.equals("pending"))return "O servidor está selecionando os destaques da análise. Nenhum alerta depende desta operação.";
   if(!status.equals("ready"))return "Sem sismo recente verificável para esta análise, ou catálogo temporariamente indisponível.";
   org.json.JSONArray sections=d.optJSONArray("sections");
   if(sections==null||sections.length()!=6)return "Análise científica incompleta. Nada será apresentado.";
   StringBuilder out=new StringBuilder("ANÁLISE SÍSMICA · ").append(d.optString("title")).append("\n");
   out.append("Fonte: ").append(d.optString("source")).append("\n");
   String model=d.optString("model");
   out.append(model.equals(WeatherBriefing.GEMINI_MODEL)?"Destaques priorizados pela Gemini.":model.equals(WeatherBriefing.MODEL)?"Destaques priorizados pela Cloudflare (reserva).":"Relatório científico por regras verificáveis.").append("\n");
   for(int i=0;i<sections.length();i++){
    org.json.JSONObject section=sections.optJSONObject(i);
    if(section==null)return "Estrutura científica inválida.";
    String title=section.optString("title"),content=section.optString("text");
    if(title.length()>70||content.length()>550||content.contains("<")||content.contains(">")||content.isEmpty())
     return "Texto científico não validado; apresentação bloqueada.";
    out.append("\n").append(title).append("\n").append(content).append("\n");
   }
   out.append("\nSomente dados publicados. Não é previsão de sismos, avaliação de danos ou aviso oficial de tsunami.");
   return out.toString();
  }catch(org.json.JSONException ignored){return "Análise científica não reconhecida.";}
 }

 private String read(String kind)throws IOException{
  HttpURLConnection connection=(HttpURLConnection)new URL(kind.equals("seismic")?"https://black-sky-9ba0.terrestre.workers.dev/seismic-insight":ENDPOINT+(kind.equals("rain")?"rain":"hourly")).openConnection();
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
  t.setTypeface(OledNewsChrome.titleFont(null));
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
  view.setTextColor(color);view.setPadding(0,dp(4),0,dp(4));
  if(bold)view.setTypeface(null,Typeface.BOLD);
  host.addView(view,new LinearLayout.LayoutParams(-1,-2));return view;
 }
 private Button button(LinearLayout host,String value,View.OnClickListener action){
  Button b=new Button(this);b.setText(value);b.setTextSize(15);b.setId(View.generateViewId());b.setFocusable(true);b.setTypeface(OledNewsChrome.titleFont(null));b.setTextColor(WHITE);
  b.setAllCaps(false);b.setMinHeight(0);b.setMinimumHeight(0);b.setMinWidth(0);b.setMinimumWidth(0);b.setSingleLine(true);b.setEllipsize(android.text.TextUtils.TruncateAt.END);b.setPadding(dp(6),0,dp(6),0);
  b.setOnClickListener(action);
  b.setOnFocusChangeListener((v,focused)->styleButton(b,focused));
  styleButton(b,false);
  boolean horizontal=host.getOrientation()==LinearLayout.HORIZONTAL;
  LinearLayout.LayoutParams p=horizontal?
    new LinearLayout.LayoutParams(0,dp(44),1f):new LinearLayout.LayoutParams(-1,dp(44));
  p.setMargins(dp(4),dp(6),dp(4),dp(6));host.addView(b,p);return b;
 }
 private void styleButton(Button b,boolean focused){
  GradientDrawable bg=new GradientDrawable();bg.setColor(focused?0xff391219:0xff15171a);
  bg.setCornerRadius(dp(6));bg.setStroke(dp(focused?3:1),
    focused?0xffed1231:0xff51545a);b.setBackground(bg);
 }
 private int dp(int size){return Math.round(size*getResources().getDisplayMetrics().density);}
 @Override protected void onDestroy(){
  destroyed=true;generation++;main.removeCallbacksAndMessages(null);
  HttpURLConnection connection=current;if(connection!=null)connection.disconnect();
  io.shutdownNow();super.onDestroy();
 }
}

package top.monitorglobal.tv;
import android.Manifest;import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.graphics.Color;import android.graphics.Typeface;import android.graphics.drawable.GradientDrawable;import android.net.Uri;import android.os.*;import android.provider.Settings;import android.speech.RecognizerIntent;import android.speech.SpeechRecognizer;import android.speech.RecognitionListener;import android.view.*;import android.widget.*;import java.text.*;import java.util.*;
public final class MainActivity extends Activity {
 private OfficialUpdater updater;
 private LinearLayout content,actionRow;
 private TextView status,weatherStatus,replayStatus,voiceStatus;
 private SpeechRecognizer speechRecognizer;
 private static final int VOICE_REQUEST=74,VOICE_AUDIO_PERMISSION=75;
 private Button start;
 private String currentSection="Informações";
 private boolean wideLayout;
 private String lastTargetEncoded="__unseen__";
 private Alert cachedTarget;
 private final Handler handler=new Handler(Looper.getMainLooper());
 // UI status does not need to reparse preferences every three seconds.
 // The service/feed/safety schedules are NOT changed by this UI timer.
 private final Runnable refresh=new Runnable(){public void run(){update();handler.postDelayed(this,9000);}};
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  wideLayout=getResources().getConfiguration().screenWidthDp>=900;
  ScrollView scroll=new ScrollView(this);
  scroll.setFillViewport(true);
  scroll.setBackgroundColor(Color.rgb(2,12,26));
  scroll.setClipToPadding(false);
  content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);
  content.setPadding(dp(32),dp(22),dp(32),dp(36));
  scroll.addView(content);setContentView(scroll);
  addBrandedHeader();
  addStatusPanel();
  section("ALEXA · CONTROLE DO FIRE STICK");
  button("Vincular Alexa · mostrar código de 6 dígitos",v->{
   new AlertDialog.Builder(this).setTitle("Vincular Monitor Global à Alexa")
    .setMessage("O código é temporário. Ele permite que sua skill Alexa envie comandos somente para esta TV.\n\nNão use a barra de pesquisa do Google: depois de vincular, segure o botão físico de microfone do controle e fale com a Alexa.")
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Gerar código",(d,w)->{
     AlexaLinkClient.register(this,message->{
      if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
      new AlertDialog.Builder(this).setTitle("Código da Alexa · Monitor Global").setMessage(message)
       .setPositiveButton("Entendi",null).show();
     });
    }).show();
  });
  label("Depois de vincular a skill: segure o microfone do controle e diga “Peça ao Monitor Global para mostrar o Brent”. O card aparece sobre o vídeo. É preciso ativar o monitoramento e publicar a ponte Alexa no Worker.",15,false);
  section("RECONHECIMENTO LOCAL · OPCIONAL");
  button("🎙 Testar reconhecimento local do Android (pode abrir pesquisa)",v->startVoiceInput());
  voiceStatus=label("Teste separado da Alexa. O Fire OS pode reservar o microfone do controle ao assistente do sistema.",15,false);
  section("INÍCIO RÁPIDO");
  button("1 · Autorizar sobreposição / ajuda para Fire Stick",v->OverlayPermissionHelp.show(this));
  start=button("2 · Ativar monitoramento",v->{if(Prefs.get(this).getBoolean("enabled",false)){stopService(new Intent(this,MonitorService.class));Prefs.get(this).edit().putBoolean("enabled",false).apply();update();return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},7);}Prefs.get(this).edit().putBoolean("enabled",true).apply();launch(MonitorService.START);update();});
  section("REPLAY E RESUMOS SÍSMICOS");
  button("Replay · Último sismo M6+ mundial (72 h)",v->launch(MonitorService.REPLAY_M6));
  button("Replay · Último sismo no Brasil, qualquer magnitude (72 h)",v->launch(MonitorService.REPLAY_BRAZIL));
  button("Maiores de hoje · parcial até agora",v->launch(MonitorService.SUMMARY_TODAY));
  button("Replay · Resumo de ontem completo (6 s por sismo)",v->launch(MonitorService.SUMMARY_REPLAY));
  button("3 · Testar sismo com indicação de tsunami (fictício)",v->launch(MonitorService.TEST));
  button("4 · Testar revisão M7,2 → M6,9 (fictícia)",v->launch(MonitorService.TEST_REVISION));
  button("5 · Testar aviso de tsunami (fictício)",v->launch(MonitorService.TEST_TSUNAMI));
  button("6 · Testar encerramento de tsunami (fictício)",v->launch(MonitorService.TEST_END));
  button("Testar tsunami sem ameaça (dados fictícios)",v->launch(MonitorService.TEST_NO_THREAT));
  button("7 · Testar sequência completa em 10 segundos (fictícia)",v->launch(MonitorService.TEST_SEQUENCE));
  button("Diagnóstico local · memória e desenho da tarja",v->startActivity(new Intent(this,DiagnosticsActivity.class)));
  updater=new OfficialUpdater(this,s->{Prefs.get(this).edit().putString("updateStatus",s).apply();update();});button("Verificar atualização oficial",v->updater.check());
  section("AVISOS REGIONAIS · M5+");
  Switch targets=new Switch(this);targets.setText("Aviso menor · M5,0–5,9 raso nas áreas monitoradas");targets.setTextColor(Color.WHITE);targets.setTextSize(17);targets.setPadding(12,10,12,10);targets.setChecked(Prefs.get(this).getBoolean("targetAlerts",true));targets.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("targetAlerts",checked).putBoolean("targetsReady",false).putLong("targetSettingsRevision",System.currentTimeMillis()).apply();});addSwitch(targets);
  button("Escolher áreas monitoradas para M5+",v->{Set<String> disabled=new HashSet<>(Prefs.get(this).getStringSet("disabledTargetAreas",Collections.emptySet()));boolean[] checked=new boolean[TargetAreaNames.ALL.length];for(int i=0;i<checked.length;i++)checked[i]=!disabled.contains(TargetAreaNames.ALL[i]);new AlertDialog.Builder(this).setTitle("Áreas M5+ · escolha as regiões").setMultiChoiceItems(TargetAreaNames.ALL,checked,(dialog,index,on)->{if(on)disabled.remove(TargetAreaNames.ALL[index]);else disabled.add(TargetAreaNames.ALL[index]);}).setPositiveButton("Salvar",(dialog,which)->Prefs.get(this).edit().putStringSet("disabledTargetAreas",disabled).putBoolean("targetsReady",false).putLong("targetSettingsRevision",System.currentTimeMillis()).apply()).setNegativeButton("Cancelar",null).show();});
  label("Aviso menor por 15 segundos: M5,0–5,9, até 70 km de profundidade, em raios de 160 a 230 km das áreas escolhidas. Não é previsão de danos nem lista mundial completa. Profundidade desconhecida não dispara o aviso menor. M6+, Brasil e tsunami mantêm suas regras.",15,false);
  replayStatus=label("Último replay regional: conferindo registro local…",16,false);
  button("Replay · Último aviso regional M5,0–5,9 (15 s)",v->showRegionalReplay());
  button("Consultar os dados do último aviso regional",v->
    new AlertDialog.Builder(this).setTitle("Aviso regional salvo na TV")
      .setMessage(RegionalReplayDetails.detail(Prefs.lastTarget(this)))
      .setPositiveButton("Entendi",null).show());
  label("Replay do último aviso regional real salvo no aparelho. Começa em 10 segundos para você voltar à TV; mostra REPLAY e a data original, sem som ou nova consulta. Alertas prioritários interrompem o replay.",14,false);
  button("Testar aviso menor M5+ (fictício, em 10 s)",v->launch(MonitorService.TEST+"_TARGET"));
  section("METEOROLOGIA, IA E SATÉLITE");
  button("IA meteorológica · entender e consultar agora",v->startActivity(new Intent(this,WeatherAiInfoActivity.class)));
  label("A IA só interpreta observações validadas: consulte manualmente o tempo ou a chuva, ou descubra por que não existe destaque.",15,false);
  Switch hourly=new Switch(this);hourly.setText("Resumo do tempo na Liberdade · horas cheias; 00h05 à meia-noite");hourly.setTextColor(Color.WHITE);hourly.setTextSize(17);hourly.setPadding(12,10,12,10);hourly.setChecked(Prefs.get(this).getBoolean("weatherHourly",true));hourly.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("weatherHourly",checked).apply();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);});addSwitch(hourly);
  button("Ver tempo · Liberdade · em 10 segundos",v->launch(MonitorService.WEATHER_NOW));
  Switch satellite=new Switch(this);satellite.setText("Satélite do Sudeste após o boletim do tempo");satellite.setTextColor(Color.WHITE);satellite.setTextSize(17);satellite.setPadding(12,10,12,10);satellite.setChecked(Prefs.get(this).getBoolean("weatherSatellite",true));satellite.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("weatherSatellite",checked).apply();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);});addSwitch(satellite);
  button("Mapa do satélite em tela cheia · consulta manual",v->startActivity(new Intent(this,WeatherSatelliteActivity.class)));
  label("Após o boletim horário: imagem estática do Sudeste por 15 segundos. O vídeo continua visível. No visualizador, escolha Brasil ou Sudeste e use Animar para consultar os horários disponíveis. Horários e idade da imagem são informados em Brasília. Infravermelho mostra temperatura de brilho, não milímetros de chuva. A fonte pode apresentar defasagem ou indisponibilidade. Avisos reais têm prioridade.",15,false);

  label("Resumo por 12 segundos nas horas cheias de Brasília; à meia-noite, aparece às 00h05 depois do resumo sísmico. Se a TV estiver desligada, recupera apenas o resumo atual ao retomar. Sismos, tsunami e resumos sísmicos têm prioridade. Valores horários são estimativas do modelo; campos ausentes não viram zero. Chuva por minuto e condições horárias aparecem juntas quando disponíveis.",15,false);
  section("CHUVA E APRESENTAÇÃO");
  button("Avisos de chuva na Liberdade: "+rainModeLabel(),v->{int next=(Prefs.get(this).getInt("rainMode",2)+1)%3;Prefs.get(this).edit().putInt("rainMode",next).apply();((Button)v).setText("Avisos de chuva na Liberdade: "+rainModeLabel());if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);});
  button("Testar chuva em tela inteira · fictícia",v->WeatherPreviewOptions.show(this,()->launch(MonitorService.TEST+"_STORM")));
  button("Testar cartão e chuva (fictício, em 10 s)",v->launch(MonitorService.TEST+"_RAIN"));
  label("Chuva opcional · Liberdade, São Paulo: desligado, só cartão ou cartão com chuva. Usa estimativas por minuto do Rainbow Weather para um ponto da Liberdade, junto à Praça da Liberdade-Japão. Cartão por 12 segundos quando a chuva se aproxima, começa, muda de intensidade ou deixa de ser prevista. mm/h é intensidade estimada; mm nos próximos 60 minutos é acumulado previsto. Início e término só aparecem quando a fonte permite estimar. Sismos e tsunami têm prioridade. Não acompanha sua localização.",15,false);
  section("MERCADO FINANCEIRO · BRENT");
  Switch brentSwitch=new Switch(this);
  brentSwitch.setText("Mostrar cotação do Brent de hora em hora · só durante o mercado aberto");
  brentSwitch.setTextColor(Color.WHITE);brentSwitch.setTextSize(17);brentSwitch.setPadding(12,10,12,10);
  brentSwitch.setChecked(Prefs.get(this).getBoolean("brentHourly",true));
  brentSwitch.setOnCheckedChangeListener((v,enabled)->{
   Prefs.get(this).edit().putBoolean("brentHourly",enabled).apply();
   if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
  });addSwitch(brentSwitch);
  label("Card silencioso de 12 s aos 15 minutos de cada hora, sobre o vídeo. Preço indicativo Brent (BZ=F) em US$/barril, variação e horário da fonte Yahoo Finance. Sem cotação válida, não aparece. Horários de Londres com ajuste de verão: de sexta após o fechamento até domingo às 23h de Londres, não exibe. Alertas sísmicos, tsunami, chuva, satélite e replays têm prioridade.",15,false);
  button("Testar visual do card Brent (valores fictícios · 10 s)",v->launch(MonitorService.TEST+"_BRENT"));
  label("O teste é uma simulação manual, identificada como fictícia. Não consulta o mercado e pode ser visto também quando a bolsa está fechada.",13,false);
  button("Conferir cotação REAL do Brent agora",v->launch(MonitorService.CHECK_BRENT));
  label("Com monitoramento ativo e pregão aberto: consulta Yahoo em 10 s. Volte ao vídeo. Se a cotação estiver indisponível, a seção FONTES explica o motivo; nenhum preço será inventado.",13,false);
  section("PREFERÊNCIAS E ROTINA");
  Switch sound=new Switch(this);sound.setText("Sons diferentes por aviso · volume de mídia da TV");sound.setTextColor(Color.WHITE);sound.setTextSize(17);sound.setPadding(12,10,12,10);sound.setChecked(Prefs.get(this).getBoolean("sound",true));sound.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("sound",checked).apply();if(!checked)TvSounds.stop();});addSwitch(sound);
  button("Configurar e ouvir os sons de cada aviso",v->TvSoundSettings.show(this));
  label("Sismos, tsunami, avisos regionais, chuva, tempo, cotações e resumo diário têm sinais próprios. Ajuste a intensidade e teste cada categoria. Depende do volume de mídia da TV; não toca com a tela desligada. Replays permanecem silenciosos.",15,false);
  Switch daily=new Switch(this);daily.setText("Resumo automático à meia-noite · horário de Brasília");daily.setTextColor(Color.WHITE);daily.setTextSize(17);daily.setPadding(12,10,12,10);daily.setChecked(Prefs.get(this).getBoolean("dailyAuto",true));daily.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("dailyAuto",checked).apply();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);});addSwitch(daily);
  label("À meia-noite: resumo do dia encerrado. Se a TV estiver desligada ou sem internet, tenta recuperar o último dia encerrado ao retomar o monitoramento. Alertas reais têm prioridade; o resumo interrompido volta depois.",15,false);
  button("Duração: "+Prefs.get(this).getInt("seconds",20)+" segundos",v->{int current=Prefs.get(this).getInt("seconds",20),next=current==15?20:current==20?30:current==30?60:current==60?90:current==90?120:15;Prefs.get(this).edit().putInt("seconds",next).apply();((Button)v).setText("Duração: "+next+" segundos");});
  label("Depois de ativar, volte ao conteúdo que deseja assistir. A faixa não captura os botões do controle e fecha automaticamente.",16,false);
  label("Sismo com tsunami: alterna a cada 8 segundos por pelo menos 32 segundos. Replay busca o último sismo M6+ ou no Brasil das últimas 72 horas, inclusive enquanto a TV estava desligada. Sem internet, tenta o último registro local.",15,false);
  label("Replay do resumo de ontem: até cinco maiores sismos do dia anterior completo, de 00h a 23h59 de Brasília. Maiores de hoje mostra apenas o parcial do dia atual e não substitui o replay de ontem. Sem internet, o replay usa o resumo completo de ontem salvo no aparelho; nunca troca por um parcial ou por outro dia. Cada sismo tem seis segundos completos de leitura, mais animações. Alertas reais têm prioridade.",15,false);
  label("Cobertura equivalente às regras sísmicas do Telegram: USGS, EMSC e GEOFON para M6+ globais; USP/RSBR, USGS, EMSC e GEOFON para sismos no Brasil, sem magnitude mínima. Estimativas de agências diferentes são identificadas separadamente de revisões da mesma fonte. Revisões importantes e boletins oficiais de tsunami por região, incluindo SEM AMEAÇA e encerramentos. Falha de uma fonte não interrompe as outras.",15,false);
  section("COMO FUNCIONA O MONITORAMENTO");
  label("Primeira conexão: os eventos existentes viram referência, sem disparar avisos antigos. Consultas a cada 30 segundos. O aparelho precisa continuar ligado e com acesso à internet.",15,false);
  label("A exibição sobre outros aplicativos e a permanência em segundo plano ainda precisam ser testadas nesta TV/Fire Stick. O teste demonstrativo não confirma a chegada de um alerta real.",15,false);
  label("Setas: navegar · OK: selecionar · Voltar: sair da configuração",14,false);
 }
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private GradientDrawable card(int base,int stroke,int radius){
  GradientDrawable bg=new GradientDrawable();
  bg.setColor(base);bg.setCornerRadius(dp(radius));bg.setStroke(dp(1),stroke);return bg;
 }
 private TextView display(String text,int size,int color,boolean bold){
  TextView t=new TextView(this);t.setText(text);t.setTextSize(size);t.setTextColor(color);
  t.setIncludeFontPadding(true);
  if(bold)t.setTypeface(null,Typeface.BOLD);
  return t;
 }
 private void addBrandedHeader(){
  LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);
  RadarLogoView radar=new RadarLogoView(this);
  // SAME 128px Radar Scope geometry and 2.4s sweep as the live website logo.
  // The existing drawable/logo files are untouched; there is NO new brand.
  header.addView(radar,new LinearLayout.LayoutParams(dp(76),dp(76)));
  LinearLayout titles=new LinearLayout(this);titles.setOrientation(LinearLayout.VERTICAL);
  LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,-2,1f);tp.leftMargin=dp(16);
  header.addView(titles,tp);
  TextView name=display("MONITOR GLOBAL TV",wideLayout?36:29,Color.WHITE,true);
  try{name.setTypeface(Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf"));}catch(RuntimeException ignored){}
  titles.addView(name);
  TextView tagline=display("M6+ no mundo · Sismos no Brasil · Tsunami",wideLayout?19:16,0xffc0d2dc,false);
  titles.addView(tagline);
  content.addView(header);
  TextView version=display("VERSÃO "+BuildConfig.VERSION_NAME+"  ·  CONFIGURAÇÕES",14,0xff6be9f4,true);
  LinearLayout.LayoutParams vp=new LinearLayout.LayoutParams(-1,-2);vp.topMargin=dp(10);
  content.addView(version,vp);
 }
 private void addStatusPanel(){
  LinearLayout panel=new LinearLayout(this);
  panel.setOrientation(wideLayout?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);
  panel.setPadding(dp(20),dp(12),dp(20),dp(12));
  panel.setBackground(card(0xff102a40,0xff2a627e,16));
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.topMargin=dp(16);lp.bottomMargin=dp(10);content.addView(panel,lp);
  status=display("Verificando permissões e monitoramento…",17,Color.WHITE,false);
  weatherStatus=display("Verificando fontes e meteorologia…",17,0xffd6e7ec,false);
  if(wideLayout){
   LinearLayout.LayoutParams a=new LinearLayout.LayoutParams(0,-2,1f);a.rightMargin=dp(22);
   panel.addView(status,a);
   View divider=new View(this);divider.setBackgroundColor(0xff27607c);
   panel.addView(divider,new LinearLayout.LayoutParams(dp(1),-1));
   LinearLayout.LayoutParams b=new LinearLayout.LayoutParams(0,-2,1f);b.leftMargin=dp(22);
   panel.addView(weatherStatus,b);
  }else{
   panel.addView(status);
   panel.addView(weatherStatus);
  }
 }
 private void section(String title){
  actionRow=null;currentSection=title;
  TextView t=display(title,21,0xff56e9f4,true);
  t.setPadding(dp(16),dp(14),dp(16),dp(14));
  t.setBackground(card(0xff0b2437,0xff22516b,12));
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.topMargin=dp(18);lp.bottomMargin=dp(8);content.addView(t,lp);
 }
 private void addSwitch(Switch toggle){
  actionRow=null;toggle.setFocusable(true);
  toggle.setPadding(dp(18),dp(10),dp(18),dp(10));
  toggle.setBackground(card(0xff142b43,0xff426276,12));
  toggle.setMinHeight(dp(64));
  toggle.setOnFocusChangeListener((v,focused)->
    v.setBackground(card(focused?0xff124456:0xff142b43,
      focused?0xff00ecf4:0xff426276,12)));
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.setMargins(0,dp(5),0,dp(5));content.addView(toggle,lp);
 }
 private void showRegionalReplay(){
  Alert saved=Prefs.lastTarget(this);
  String details=RegionalReplayDetails.detail(saved);
  if(!RegionalReplayDetails.eligible(saved)){
   new AlertDialog.Builder(this).setTitle("Replay regional indisponível")
      .setMessage(details).setPositiveButton("Entendi",null).show();
   return;
  }
  new AlertDialog.Builder(this).setTitle("Reproduzir aviso regional na programação?")
    .setMessage(details)
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Reproduzir sobre o vídeo",(dialog,which)->{
      launch(MonitorService.REPLAY_TARGET);
      Toast.makeText(this,"Replay solicitado. Volte ao vídeo: início em 10 segundos, se permitido.",Toast.LENGTH_LONG).show();
    }).show();
 }
 private String rainModeLabel(){int mode=Prefs.get(this).getInt("rainMode",2);return mode==0?"desligado":mode==1?"só cartão":"cartão com chuva";}
 private void startVoiceInput(){
  if(speechRecognizer!=null)return;
  voiceMessage("Abrindo o reconhecimento de voz em português…");
  Intent speech=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
  speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
  speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR");
  speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,"pt-BR");
  speech.putExtra(RecognizerIntent.EXTRA_PROMPT,"Fale com o Monitor Global");
  speech.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,3);
  try{startActivityForResult(speech,VOICE_REQUEST);}
  catch(android.content.ActivityNotFoundException|SecurityException e){startDirectVoice();}
 }
 private void startDirectVoice(){
  if(!SpeechRecognizer.isRecognitionAvailable(this)){
   voiceMessage("Reconhecimento de voz indisponível nesta TV. Verifique o serviço de fala do Android.");
   return;
  }
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
   requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},VOICE_AUDIO_PERMISSION);
   return;
  }
  try{
   speechRecognizer=SpeechRecognizer.createSpeechRecognizer(this);
   speechRecognizer.setRecognitionListener(new RecognitionListener(){
    @Override public void onReadyForSpeech(Bundle params){voiceMessage("Ouvindo… fale próximo do controle remoto.");}
    @Override public void onBeginningOfSpeech(){voiceMessage("Reconhecendo sua pergunta…");}
    @Override public void onRmsChanged(float rms){}
    @Override public void onBufferReceived(byte[] buffer){}
    @Override public void onEndOfSpeech(){voiceMessage("Processando a pergunta…");}
    @Override public void onError(int error){endDirectVoice();voiceMessage("Não consegui ouvir sua pergunta (código "+error+"). Tente novamente.");}
    @Override public void onResults(Bundle results){
     ArrayList<String> phrases=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
     endDirectVoice();processVoice(phrases);
    }
    @Override public void onPartialResults(Bundle results){}
    @Override public void onEvent(int eventType,Bundle params){}
   });
   Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
   intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
   intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR");
   intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,3);
   speechRecognizer.startListening(intent);
  }catch(RuntimeException e){endDirectVoice();voiceMessage("Microfone indisponível para o aplicativo nesta TV.");}
 }
 private void endDirectVoice(){
  if(speechRecognizer!=null){speechRecognizer.destroy();speechRecognizer=null;}
 }
 private void voiceMessage(String message){
  if(voiceStatus!=null)voiceStatus.setText(message);
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(requestCode!=VOICE_REQUEST)return;
  if(resultCode!=RESULT_OK||data==null){voiceMessage("Comando de voz cancelado. Selecione Falar para tentar novamente.");return;}
  processVoice(data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS));
 }
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
  super.onRequestPermissionsResult(requestCode,permissions,results);
  if(requestCode==VOICE_AUDIO_PERMISSION){
   if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startDirectVoice();
   else voiceMessage("A TV não concedeu permissão de microfone ao Monitor Global.");
  }
 }
 @Override public boolean onKeyDown(int keyCode,KeyEvent event){
  // Only keys actually forwarded to the Activity can start listening.
  // The system may reserve the voice-assistant button for Google/Gemini.
  if(keyCode==KeyEvent.KEYCODE_SEARCH||keyCode==KeyEvent.KEYCODE_VOICE_ASSIST){
   if(event.getRepeatCount()==0)startVoiceInput();
   return true;
  }
  return super.onKeyDown(keyCode,event);
 }
 private void processVoice(ArrayList<String> phrases){
  if(phrases==null||phrases.isEmpty()){voiceMessage("Nenhuma frase reconhecida. Tente falar novamente.");return;}
  String spoken=phrases.get(0);
  String command=TvVoiceCommands.UNKNOWN;
  for(String phrase:phrases){
   String routed=TvVoiceCommands.route(phrase);
   if(!TvVoiceCommands.UNKNOWN.equals(routed)){command=routed;spoken=phrase;break;}
  }
  voiceMessage("Você disse: "+spoken);
  switch(command){
   case TvVoiceCommands.WEATHER: launchVoiceCard(MonitorService.WEATHER_NOW,"Exibindo o card real do tempo, se a fonte estiver disponível.");return;
   case TvVoiceCommands.BRENT:
    if(!Prefs.get(this).getBoolean("enabled",false)){voiceMessage("Ative o monitoramento para consultar a cotação real do Brent.");return;}
    launchVoiceCard(MonitorService.CHECK_BRENT,"Consultando o Brent real. Sem preço válido não haverá card.");return;
   case TvVoiceCommands.BRAZIL:launchVoiceCard(MonitorService.VOICE_BRAZIL,"Buscando o último sismo no Brasil das últimas 72 horas.");return;
   case TvVoiceCommands.TODAY:launchVoiceCard(MonitorService.SUMMARY_TODAY,"Consultando os maiores sismos de hoje.");return;
   case TvVoiceCommands.YESTERDAY:launchVoiceCard(MonitorService.SUMMARY_REPLAY,"Consultando o resumo sísmico de ontem.");return;
   case TvVoiceCommands.RECENT_QUAKE:launchVoiceCard(MonitorService.REPLAY,"Consultando o último sismo do monitoramento.");return;
   case TvVoiceCommands.SATELLITE:startActivity(new Intent(this,WeatherSatelliteActivity.class));return;
   case TvVoiceCommands.WEATHER_AI:startActivity(new Intent(this,WeatherAiInfoActivity.class));return;
   default:voiceMessage("Ainda não reconheço esse pedido. Experimente: tempo, Brent, sismos no Brasil ou satélite.");
  }
 }
 private void launchVoiceCard(String action,String message){
  launch(action);
  voiceMessage(message);
  Toast.makeText(this,message,Toast.LENGTH_LONG).show();
  // Return to the programme behind the app; existing non-touchable TV cards appear over it.
  moveTaskToBack(true);
 }
 private void launch(String action){try{startForegroundService(new Intent(this,MonitorService.class).setAction(action));}catch(RuntimeException e){Prefs.status(this,"Não foi possível iniciar. Verifique as permissões do aparelho.");}}
 private TextView label(String s,int size,boolean bold){
  actionRow=null;
  TextView t=display(s,size,bold?Color.WHITE:0xffbdcfd8,bold);
  if(!bold&&s.length()>145){
   // Long manuals stay accessible, but no longer fill the TV's first screen.
   t.setVisibility(View.GONE);t.setPadding(dp(14),dp(8),dp(14),dp(12));
   Button more=new Button(this);more.setAllCaps(false);more.setTextSize(15);
   more.setTextColor(0xffb2e8f3);more.setText("ⓘ  Detalhes · "+currentSection);
   more.setBackground(card(0xff10263a,0xff224c64,10));
   final String title=currentSection;
   more.setOnClickListener(v->{
    boolean open=t.getVisibility()!=View.VISIBLE;
    t.setVisibility(open?View.VISIBLE:View.GONE);
    more.setText((open?"Ocultar":"ⓘ  Detalhes")+" · "+title);
   });
   LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-1,-2);mp.topMargin=dp(4);
   content.addView(more,mp);
  }
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.setMargins(0,dp(5),0,dp(7));content.addView(t,lp);
  return t;
 }
 private void styleButton(Button b,boolean focus){
  b.setBackground(card(focus?0xff064656:0xff1c344b,
    focus?0xff00f0f4:0xff4b7084,12));
 }
 private Button button(String s,View.OnClickListener listener){
  Button b=new Button(this);
  b.setText(s);b.setTextSize(wideLayout?18:17);
  b.setTextColor(Color.WHITE);b.setAllCaps(false);
  b.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
  b.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
  b.setMinHeight(dp(72));b.setPadding(dp(18),dp(11),dp(18),dp(11));
  b.setOnClickListener(listener);
  b.setOnFocusChangeListener((v,focused)->styleButton(b,focused));
  styleButton(b,false);
  if(!wideLayout){
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
   lp.setMargins(0,dp(5),0,dp(5));content.addView(b,lp);
  }else{
   if(actionRow==null||actionRow.getChildCount()>=2){
    actionRow=new LinearLayout(this);actionRow.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);
    rp.setMargins(0,dp(5),0,dp(5));content.addView(actionRow,rp);
   }
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1f);
   lp.setMargins(dp(3),0,dp(3),0);actionRow.addView(b,lp);
  }
  return b;
 }
 private void setIfChanged(TextView view,String value){
  if(view!=null&&!value.contentEquals(view.getText()))view.setText(value);
 }
 private void update(){
  if(status==null)return;
  android.content.SharedPreferences p=Prefs.get(this);
  boolean overlay=Settings.canDrawOverlays(this),enabled=p.getBoolean("enabled",false);
  long now=System.currentTimeMillis(),last=p.getLong("lastCheck",0);
  String when=last==0?"nenhuma consulta confirmada":Math.max(0,(now-last)/1000)+" s atrás";
  String state=(overlay?"✓ Permissão de sobreposição ativa":"! Sobreposição bloqueada · use Autorizar");
  state+="\n"+(enabled?"✓ Monitoramento ativado":"• Monitoramento desativado");
  state+="\nÚltima consulta: "+when;
  state+="\n"+p.getString("status","Aguardando configuração");
  if(!AlexaLinkClient.token(this).isEmpty())state+="\nAlexa: "+(p.getBoolean("alexaLinked",false)?"vinculada":"código gerado · aguardando vínculo")+(enabled?"":" · ative o monitoramento");
  setIfChanged(status,state);
  String source=p.getString("sourceHealth","Fontes ainda não verificadas");
  String weather=p.getBoolean("weatherHourly",true)?
    p.getString("weatherStatus","Liberdade: previsão aguardando consulta"):
    "Resumo do tempo desativado";
  String rain=p.getInt("rainMode",2)==0?"Chuva desativada":
    p.getString("rainStatus","Chuva: aguardando consulta");
  String satellite=p.getBoolean("weatherSatellite",true)?
    p.getString("satelliteStatus","Satélite: aguardando atualização"):
    "Satélite desativado";
  String brent=p.getString("brentStatus","Aguardando cotação real");
  setIfChanged(weatherStatus,"FONTES: "+source+"\n"+weather+"\n"+rain+"\n"+satellite+"\nBRENT: "+brent);
  // Replay JSON is decoded only when the saved event changes, not every tick.
  String record=p.getString("lastTarget","");
  if(!record.equals(lastTargetEncoded)){
   lastTargetEncoded=record;
   cachedTarget=Prefs.lastTarget(this);
  }
  if(replayStatus!=null)setIfChanged(replayStatus,
    "Último replay regional salvo: "+RegionalReplayDetails.summary(cachedTarget)
    +" · aparece SOBRE o vídeo, após 10 s");
  if(start!=null)setIfChanged(start,enabled?"Parar monitoramento":"2 · Ativar monitoramento");
 }
 @Override protected void onDestroy(){TvSounds.stopPreview();endDirectVoice();if(updater!=null)updater.close();super.onDestroy();}
 @Override protected void onResume(){super.onResume();if(updater!=null)updater.resume();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);handler.removeCallbacks(refresh);update();handler.postDelayed(refresh,9000);}
 @Override protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
}


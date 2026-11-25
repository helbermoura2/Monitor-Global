package top.monitorglobal.tv;
import android.Manifest;import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.graphics.Color;import android.graphics.Typeface;import android.graphics.drawable.GradientDrawable;import android.net.Uri;import android.os.*;import android.provider.Settings;import android.speech.RecognizerIntent;import android.speech.SpeechRecognizer;import android.speech.RecognitionListener;import android.view.*;import android.widget.*;import java.text.*;import java.util.*;
public final class MainActivity extends Activity {
 private OfficialUpdater updater;
 private LinearLayout content,actionRow,sidebar;
 private FrameLayout pageHost;
 private final Map<String,ScrollView> pages=new LinkedHashMap<>();
 private final Map<String,Button> navigation=new LinkedHashMap<>();
 private final Map<String,View> rememberedFocus=new HashMap<>();
 private static final String[] CATEGORIES={"Visão geral","Defesa Civil","Sismologia","Meteorologia","Mercado","Aparência","Áudio","Dispositivos","Laboratório","Sistema"};
 private static final String[] SYMBOLS={"⌂","!","∿","☁","↗","◈","♪","⌘","◇","⚙"};
 private static final int OLED=0xff000000,SURFACE=0xff111113,EDGE=0xff292729,GOLD=0xffc4a16a,INK=0xfff2eee8,MUTED=0xffaaa8a5;
 private final Button[] overviewCards=new Button[4];
 private static final String[] OVERVIEW_HINTS={"Alertas reais e histórico","Fontes e último aviso regional","Tempo na Liberdade","Cotação real do Brent"};
 private String buildingPage=CATEGORIES[0],selectedPage=CATEGORIES[0];
 private boolean sidebarCollapsed;
 private TextView updateStatus,monitorBadge,marketDetail;
 private static final int MENU_TOGGLE_DP=34;
 private Button sidebarToggle;
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
  buildOperationsShell();
  route(CATEGORIES[0]);
  TextView liveCaption=display("CENTRAL DE OPERAÇÕES  /  DADOS DO MONITORAMENTO",12,GOLD,true);
  liveCaption.setLetterSpacing(.08f);content.addView(liveCaption);
  for(int i=1;i<=4;i++){
   final int index=i;
   final String category=CATEGORIES[i];
   Button tile=button(category,v->selectPage(category,true));
   tile.setTag("overview-"+category);
   tile.setMinHeight(dp(82));tile.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
   tile.setIncludeFontPadding(false);tile.setPadding(dp(14),dp(8),dp(14),dp(8));
   tile.setMaxLines(3);tile.setEllipsize(android.text.TextUtils.TruncateAt.END);
   iconFor(tile,index,false);overviewCards[i-1]=tile;
   setTile(tile,category,OVERVIEW_HINTS[i-1]);
  }
  actionRow=null;
  Button quickReplay=button("Último alerta real · Defesa Civil",v->selectPage(CATEGORIES[1],true));
  iconFor(quickReplay,1,false);
  Button quickUpdate=button("Atualização oficial · Sistema",v->selectPage(CATEGORIES[9],true));
  iconFor(quickUpdate,9,false);
  section("ALEXA · CONTROLE DO FIRE STICK");
  button("Vincular Alexa · mostrar código de 6 dígitos",v->{
   new AlertDialog.Builder(this).setTitle("Vincular Argos Orbis à Alexa")
    .setMessage("O código é temporário. Ele permite que sua skill Alexa envie comandos somente para esta TV.\n\nNão use a barra de pesquisa do Google: depois de vincular, segure o botão físico de microfone do controle e fale com a Alexa.")
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Gerar código",(d,w)->{
     AlexaLinkClient.register(this,message->{
      if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
      new AlertDialog.Builder(this).setTitle("Código da Alexa · Argos Orbis").setMessage(message)
       .setPositiveButton("Entendi",null).show();
     });
    }).show();
  });
  label("Depois de vincular a skill: segure o microfone do controle e diga “Peça ao Monitor Global para mostrar o Brent”. O card aparece sobre o vídeo. É preciso ativar o monitoramento e publicar a ponte Alexa no Worker.",15,false);
  section("GOOGLE HOME · TCL P7K · CONTROLE SEM ABRIR O APP");
  button("Vincular Google Home · gerar código de 6 dígitos",v->{
   new AlertDialog.Builder(this).setTitle("Vincular Argos Orbis ao Google Home")
    .setMessage("A integração Google Cloud-to-cloud precisa estar configurada primeiro no Google Home Developer Console e publicada no Worker.\n\nA vinculação mantém a Alexa funcionando e autoriza somente comandos para esta TV. Não é necessário abrir o aplicativo para consultar a temperatura após vincular.")
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Gerar código",(dialog,which)->{
     AlexaLinkClient.googlePair(this,message->{
      if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
      new AlertDialog.Builder(this).setTitle("Google Home · Argos Orbis").setMessage(message)
       .setPositiveButton("Entendi",null).show();
     });
    }).show();
  });
  button("Verificar se o Google Home está vinculado",v->{
   AlexaLinkClient.googleLinkStatus(this,message->new AlertDialog.Builder(this)
    .setTitle("Estado do Google Home · Argos Orbis")
    .setMessage(message).setPositiveButton("Entendi",null).show());
  });
  label("Teste privado: no Google Home, vincule [test] Monitor Global e experimente “Ativar Temperatura Monitor Global”. Se funcionar, uma rotina poderá reconhecer “Mostrar temperatura do Monitor Global”. Nenhum app precisa estar aberto: apenas o monitoramento em segundo plano deve permanecer ativo.",15,false);
  section("RECONHECIMENTO LOCAL · OPCIONAL");
  button("🎙 Testar reconhecimento local do Android (pode abrir pesquisa)",v->startVoiceInput());
  voiceStatus=label("Teste separado da Alexa. O Fire OS pode reservar o microfone do controle ao assistente do sistema.",15,false);
  section("INÍCIO RÁPIDO");
  button("Autorizar sobreposição / ajuda para Fire Stick",v->OverlayPermissionHelp.show(this));
  start=button("Ativar monitoramento",v->{if(Prefs.get(this).getBoolean("enabled",false)){stopService(new Intent(this,MonitorService.class));Prefs.get(this).edit().putBoolean("enabled",false).apply();update();return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},7);}Prefs.get(this).edit().putBoolean("enabled",true).apply();launch(MonitorService.START);update();});
  section("ESTADO DO SISTEMA E DAS FONTES");
  addStatusPanel();
  section("DEFESA CIVIL · ÚLTIMO ALERTA REAL RECEBIDO");
  Button latestReplay=button("Ver e reproduzir o ÚLTIMO ALERTA (celular ou CAP)",v->{
   CivilLatestReplay.Record latest=CivilLatestReplay.last(this);
   if(latest==null){
    new AlertDialog.Builder(this).setTitle("Nenhum alerta real gravado")
     .setMessage("Esta TV não tem um alerta SEVERO ou EXTREMO de CAP oficial ou celular salvo nos últimos sete dias.\n\n"
      +"Avisos CAP nacionais consultados apenas pelo site/celular não entram automaticamente no replay local da TV. "
      +"A TV não consegue recuperar um Cell Broadcast antigo que nunca recebeu.")
     .setPositiveButton("Entendi",null).show();
    return;
   }
   String details=latest.label()+"\n\nEmitido/recebido: "+BrDates.dateTime(latest.notice.sent)
    +"\nFonte: "+latest.notice.issuer
    +"\n\n"+latest.notice.message
    +"\n\nReprodução histórica: 20 segundos, sem som, a começar 10 segundos após confirmar. "
    +"Volte ao vídeo da TV. Não é aviso atual.";
   new AlertDialog.Builder(this).setTitle("Último aviso salvo na TV")
    .setMessage(details)
    .setNegativeButton("Cancelar",null)
    .setPositiveButton("Reproduzir em 10 s",(dialog,which)->launch(MonitorService.REPLAY_CIVIL_LAST))
    .show();
  });
  label("Busca o registro mais recente entre os avisos CAP da capital e os alertas reais encaminhados por celular. "
   +"Confirme para rever a tarja; o nível e a origem continuam identificados. Não recupera avisos não recebidos pela TV.",14,false);
  section("DEFESA CIVIL · REPLAY DOS AVISOS POR ORIGEM");
  button("Replay · último aviso SEVERO oficial (histórico)",v->replayCivilReal(false,false));
  button("Replay · último aviso EXTREMO oficial (histórico)",v->replayCivilReal(false,true));
  label("Reproduz o último aviso oficial recebido nesta TV nos últimos sete dias. Abre em 10 s para você voltar ao vídeo, fica 20 s e mostra REPLAY HISTÓRICO com a data da emissão. Não toca som e não dispara notificações. Se não houver registro, informa isso; não inventa avisos.",14,false);
  section("DEFESA CIVIL · HISTÓRICO RECEBIDO DO CELULAR");
  button("Replay · último SEVERO recebido do celular",v->replayCivilReal(true,false));
  button("Replay · último EXTREMO recebido do celular",v->replayCivilReal(true,true));
  label("Guarda por até sete dias o último aviso real de cada nível recebido pela TV via celular. NÃO é boletim CAP verificado. Replays são históricos, silenciosos e não mostram uma ameaça atual. Simulações não entram no histórico.",14,false);
  section("DIAGNÓSTICO · DEFESA CIVIL");
  button("Diagnóstico · celular → Worker → TV",v->{
   android.content.SharedPreferences p=Prefs.get(this);
   long poll=p.getLong("civilPhoneLastPollAt",0);
   long received=p.getLong("civilPhoneLastReceivedAt",0);
   long shown=p.getLong("civilPhoneLastDisplayedAt",0);
   long first=p.getLong("civilPhoneFirstWorkerAt",0);
   long second=p.getLong("civilPhoneSecondWorkerAt",0);
   String firstDevice=p.getString("civilPhoneFirstDevice","NÃO IDENTIFICADO");
   String secondDevice=p.getString("civilPhoneSecondDevice","");
   String shownId=p.getString("civilPhoneLastDisplayedEvent","");
   String priorShownId=p.getString("civilPhonePreviousDisplayedEvent","");
   String shownDevice=p.getString("civilPhoneLastDisplayedDevice","NÃO IDENTIFICADO");
   String priorDevice=p.getString("civilPhonePreviousDisplayedDevice","NÃO IDENTIFICADO");
   String shownCode=shownId.isEmpty()?"N/D":shownId.substring(0,Math.min(8,shownId.length()));
   String priorCode=priorShownId.isEmpty()?"N/D":priorShownId.substring(0,Math.min(8,priorShownId.length()));
   String report="Receptor: "+(TvCivilPhoneRelay.paired(this)?"VINCULADO":"NÃO VINCULADO")
    +"\nMonitoramento: "+(p.getBoolean("enabled",false)?"ATIVO":"DESATIVADO")
    +"\nÚltima consulta: "+(poll>0?BrDates.dateTime(poll):"NENHUMA")
    +"\nResultado: "+p.getString("civilPhoneLastPollStatus","Ainda não consultado")
    +"\nÚltimo aviso recebido: "+(received>0?BrDates.dateTime(received):"NENHUM")
    +"\nNível recebido: "+p.getString("civilPhoneLastReceivedSeverity","N/D")
    +"\nPrimeiro no Worker: "+(first>0?firstDevice+" · "+BrDates.dateTime(first):"AINDA NÃO IDENTIFICADO")
    +"\nTambém enviou: "+(second>0&&!secondDevice.isEmpty()?secondDevice+" · "+BrDates.dateTime(second):"NÃO REGISTRADO")
    +"\nOrdem baseada no recebimento pelo Worker, não no horário dos telefones."
    +"\nÚltima tarja exibida: "+(shown>0?BrDates.dateTime(shown):"NENHUMA")
    +"\nTipo exibido: "+p.getString("civilPhoneLastType","N/D")
    +"\nEstado da exibição: "+p.getString("civilPhoneLastDisplayStatus","Não há confirmação local")
    +"\n--- ÚLTIMAS TARJAS REAIS DISTINTAS ---"
    +"\nÚltima: "+shownCode+" · "+shownDevice
    +"\nAnterior: "+priorCode+" · "+priorDevice
    +"\nIDs distintos podem representar textos diferentes do mesmo alerta. O histórico é diagnóstico, não boletim CAP."
    +"\nO aceite pelo Worker NÃO significa exibição na TV.";
   new AlertDialog.Builder(this).setTitle("Defesa Civil · Diagnóstico da ponte")
    .setMessage(report).setPositiveButton("Entendi",null).show();
  });
  section("DEFESA CIVIL · VINCULAR CELULARES");
  button("Gerar código de 8 dígitos para o Argos Orbis do celular",v->
   TvCivilPhoneRelay.code(this,message->{
    if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
    new AlertDialog.Builder(this).setTitle("Argos Orbis · Vínculo da TV com celular")
     .setMessage(message).setPositiveButton("Entendi",null).show();
   }));
  label("Um código por celular. Samsung S25 Ultra e Nothing Phone 1 podem usar a mesma TV. Depois de vincular, no celular ative o envio e toque Enviar TESTE para a TV. A TV precisa ter o monitoramento e sobreposição ativados. Avisos encaminhados são CAPTURADOS NO CELULAR e não confirmados via CAP.",14,false);
  button("Desvincular o receptor desta TV",v->new AlertDialog.Builder(this)
   .setTitle("Apagar vínculo do receptor da TV?")
   .setMessage("A TV deixará de consultar alertas dos celulares. Alertas oficiais via CAP continuarão separados. Será preciso gerar novos códigos depois.")
   .setNegativeButton("Cancelar",null)
   .setPositiveButton("Desvincular",(dialog,which)->TvCivilPhoneRelay.forget(this)).show());
  section("DEFESA CIVIL · SIMULAÇÃO NA TV");
  button("Testar aviso SEVERO · fictício (em 10 s)",v->launch(MonitorService.TEST_CIVIL_SEVERE));
  button("Testar aviso EXTREMO · fictício (em 10 s)",v->launch(MonitorService.TEST_CIVIL_EXTREME));
  label("Simulações locais de 20 segundos: volte ao vídeo após apertar OK. A faixa mostra SIMULAÇÃO e TESTE FICTÍCIO, sem som, sem notificação e sem enviar dados. Não é aviso oficial. Alertas reais têm prioridade.",14,false);
  section("EFEITOS VISUAIS DAS TARJAS");
  button("Efeitos das tarjas: "+TvEffectsController.label(this),v->{
   TvEffectsController.EffectsMode[] modes=TvEffectsController.EffectsMode.values();
   TvEffectsController.select(this,modes[(TvEffectsController.selected(this).ordinal()+1)%modes.length]);
   ((Button)v).setText("Efeitos das tarjas: "+TvEffectsController.label(this));
  });
  label("Completo, Suave ou Sem efeitos. A redução de movimento do Android/Fire TV tem prioridade. Alertas, sons e duração permanecem iguais.",14,false);
  section("TESTES · EFEITOS DAS TARJAS");
  button("Testar todos os efeitos (simulações em 10 s)",v->launch(MonitorService.TEST+"_EFFECTS"));
  button("Cancelar teste de efeitos",v->launch(MonitorService.TEST+"_EFFECTS_CANCEL"));
  section("REPLAY E RESUMOS SÍSMICOS");
  button("Replay · Último sismo M6+ mundial (72 h)",v->launch(MonitorService.REPLAY_M6));
   button("Abertura animada M6+: "+(Prefs.get(this).getBoolean(GlobalM6Intro.PREF_ENABLED,true)?"ativada (vídeo 2)":"desativada · tarja clássica"),v->{
    boolean next=!Prefs.get(this).getBoolean(GlobalM6Intro.PREF_ENABLED,true);
    Prefs.get(this).edit().putBoolean(GlobalM6Intro.PREF_ENABLED,next).apply();
    ((Button)v).setText("Abertura animada M6+: "+(next?"ativada (vídeo 2)":"desativada · tarja clássica"));
   });
   section("TESTES · SISMO E TSUNAMI");
  button("Testar abertura M6+ · vídeo 2 (fictício, em 10 s)",v->launch(MonitorService.TEST+"_M6_INTRO"));
  section("BRASIL · REPLAY E MAPA");
  button("Replay · Último sismo no Brasil, qualquer magnitude (72 h)",v->launch(MonitorService.REPLAY_BRAZIL));
   button("Mapa da tarja Brasil: "+(Prefs.get(this).getInt(BrazilNationalBannerView.PREF_MODEL,BrazilNationalBannerView.MODEL_APPROVED)==BrazilNationalBannerView.MODEL_BACKUP?"Ampliado":"Compacto"),v->{
    int current=Prefs.get(this).getInt(BrazilNationalBannerView.PREF_MODEL,BrazilNationalBannerView.MODEL_APPROVED);
    int next=current==BrazilNationalBannerView.MODEL_APPROVED?BrazilNationalBannerView.MODEL_BACKUP:BrazilNationalBannerView.MODEL_APPROVED;
    Prefs.get(this).edit().putInt(BrazilNationalBannerView.PREF_MODEL,next).apply();
    ((Button)v).setText("Mapa da tarja Brasil: "+(next==BrazilNationalBannerView.MODEL_BACKUP?"Ampliado":"Compacto"));
   });
   section("TESTES · TARJA DO BRASIL");
  button("Testar tarja do Brasil (simulação, 10 s)",v->launch(MonitorService.TEST+"_BRAZIL"));
  section("RESUMOS SÍSMICOS");
  button("Maiores de hoje · parcial até agora",v->launch(MonitorService.SUMMARY_TODAY));
  button("Replay · Resumo de ontem completo (6 s por sismo)",v->launch(MonitorService.SUMMARY_REPLAY));
  section("TESTES · SEQUÊNCIAS E TSUNAMI");
  button("3 · Testar sismo com indicação de tsunami (fictício)",v->launch(MonitorService.TEST));
  button("4 · Testar revisão M7,2 → M6,9 (fictícia)",v->launch(MonitorService.TEST_REVISION));
  button("5 · Testar aviso de tsunami (fictício)",v->launch(MonitorService.TEST_TSUNAMI));
  button("6 · Testar encerramento de tsunami (fictício)",v->launch(MonitorService.TEST_END));
  button("Testar tsunami sem ameaça (dados fictícios)",v->launch(MonitorService.TEST_NO_THREAT));
  button("7 · Testar sequência completa em 10 segundos (fictícia)",v->launch(MonitorService.TEST_SEQUENCE));
  section("DIAGNÓSTICO LOCAL");
  button("Diagnóstico local · memória e desenho da tarja",v->startActivity(new Intent(this,DiagnosticsActivity.class)));
  section("ATUALIZAÇÃO DO APK");
  updater=new OfficialUpdater(this,s->{Prefs.get(this).edit().putString("updateStatus",s).apply();update();});Button officialUpdate=button("Verificar atualização oficial",v->updater.check());
  updateStatus=label("Aguardando verificação de atualização",16,false);
  quickReplay.setOnClickListener(v->latestReplay.performClick());
  quickUpdate.setOnClickListener(v->{selectPage(CATEGORIES[9],true);officialUpdate.requestFocus();});
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
  section("TESTES · AVISO REGIONAL");
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
  section("TESTES · CHUVA E TEMPO");
  button("Testar chuva em tela inteira · fictícia",v->WeatherPreviewOptions.show(this,()->launch(MonitorService.TEST+"_STORM")));
  button("Testar cartão e chuva (fictício, em 10 s)",v->launch(MonitorService.TEST+"_RAIN"));
  section("CHUVA · COMO FUNCIONA");
  label("Chuva opcional · Liberdade, São Paulo: desligado, só cartão ou cartão com chuva. Usa estimativas por minuto do Rainbow Weather para um ponto da Liberdade, junto à Praça da Liberdade-Japão. Cartão por 12 segundos quando a chuva se aproxima, começa, muda de intensidade ou deixa de ser prevista. mm/h é intensidade estimada; mm nos próximos 60 minutos é acumulado previsto. Início e término só aparecem quando a fonte permite estimar. Sismos e tsunami têm prioridade. Não acompanha sua localização.",15,false);
  section("MERCADO FINANCEIRO · BRENT E DÓLAR");
  marketDetail=label("Aguardando cotação real",17,false);
  marketDetail.setTag("market-full-status");
  Switch brentSwitch=new Switch(this);
  brentSwitch.setText("Mostrar cotação do Brent de hora em hora · só durante o mercado aberto");
  brentSwitch.setTextColor(Color.WHITE);brentSwitch.setTextSize(17);brentSwitch.setPadding(12,10,12,10);
  brentSwitch.setChecked(Prefs.get(this).getBoolean("brentHourly",true));
  brentSwitch.setOnCheckedChangeListener((v,enabled)->{
   Prefs.get(this).edit().putBoolean("brentHourly",enabled).apply();
   if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);
  });addSwitch(brentSwitch);
  label("Card silencioso de 12 s aos 15 minutos de cada hora, sobre o vídeo. Preço indicativo Brent (BZ=F) em US$/barril, variação e horário da fonte Yahoo Finance. Sem cotação válida, não aparece. Horários de Londres com ajuste de verão: de sexta após o fechamento até domingo às 23h de Londres, não exibe. Alertas sísmicos, tsunami, chuva, satélite e replays têm prioridade.",15,false);
  section("TESTES · MERCADO");
  button("Testar visual do card Brent (valores fictícios · 10 s)",v->launch(MonitorService.TEST+"_BRENT"));
  label("O teste é uma simulação manual, identificada como fictícia. Não consulta o mercado e pode ser visto também quando a bolsa está fechada.",13,false);
  section("MERCADO · CONSULTA REAL");
  button("Conferir cotação REAL do Brent agora",v->launch(MonitorService.CHECK_BRENT));
  label("Com monitoramento ativo e pregão aberto: consulta Yahoo em 10 s. Volte ao vídeo. Se a cotação estiver indisponível, a seção FONTES explica o motivo; nenhum preço será inventado.",13,false);
  section("PREFERÊNCIAS E ROTINA");
  Switch sound=new Switch(this);sound.setText("Sons diferentes por aviso · volume de mídia da TV");sound.setTextColor(Color.WHITE);sound.setTextSize(17);sound.setPadding(12,10,12,10);sound.setChecked(Prefs.get(this).getBoolean("sound",true));sound.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("sound",checked).apply();if(!checked)TvSounds.stop();});addSwitch(sound);
  button("Configurar e ouvir os sons de cada aviso",v->TvSoundSettings.show(this,()->sound.setChecked(Prefs.get(this).getBoolean("sound",true))));
  label("Defesa Civil (Severo e Extremo), sismos, tsunami, avisos regionais, chuva, tempo, cotações e resumo diário têm sinais próprios. Ajuste a intensidade e teste cada categoria. Depende do volume de mídia da TV; não toca com a tela desligada. Replays permanecem silenciosos.",15,false);
  section("RESUMO AUTOMÁTICO");
  Switch daily=new Switch(this);daily.setText("Resumo automático à meia-noite · horário de Brasília");daily.setTextColor(Color.WHITE);daily.setTextSize(17);daily.setPadding(12,10,12,10);daily.setChecked(Prefs.get(this).getBoolean("dailyAuto",true));daily.setOnCheckedChangeListener((v,checked)->{Prefs.get(this).edit().putBoolean("dailyAuto",checked).apply();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);});addSwitch(daily);
  label("À meia-noite: resumo do dia encerrado. Se a TV estiver desligada ou sem internet, tenta recuperar o último dia encerrado ao retomar o monitoramento. Alertas reais têm prioridade; o resumo interrompido volta depois.",15,false);
  section("DURAÇÃO E APRESENTAÇÃO");
  button("Duração: "+Prefs.get(this).getInt("seconds",20)+" segundos",v->{int current=Prefs.get(this).getInt("seconds",20),next=current==15?20:current==20?30:current==30?60:current==60?90:current==90?120:15;Prefs.get(this).edit().putInt("seconds",next).apply();((Button)v).setText("Duração: "+next+" segundos");});
  label("Depois de ativar, volte ao conteúdo que deseja assistir. A faixa não captura os botões do controle e fecha automaticamente.",16,false);
  section("REGRAS SÍSMICAS");
  label("Sismo com tsunami: alterna a cada 8 segundos por pelo menos 32 segundos. Replay busca o último sismo M6+ ou no Brasil das últimas 72 horas, inclusive enquanto a TV estava desligada. Sem internet, tenta o último registro local.",15,false);
  label("Replay do resumo de ontem: até cinco maiores sismos do dia anterior completo, de 00h a 23h59 de Brasília. Maiores de hoje mostra apenas o parcial do dia atual e não substitui o replay de ontem. Sem internet, o replay usa o resumo completo de ontem salvo no aparelho; nunca troca por um parcial ou por outro dia. Cada sismo tem seis segundos completos de leitura, mais animações. Alertas reais têm prioridade.",15,false);
  label("Cobertura equivalente às regras sísmicas do Telegram: USGS, EMSC e GEOFON para M6+ globais; USP/RSBR, USGS, EMSC e GEOFON para sismos no Brasil, sem magnitude mínima. Estimativas de agências diferentes são identificadas separadamente de revisões da mesma fonte. Revisões importantes e boletins oficiais de tsunami por região, incluindo SEM AMEAÇA e encerramentos. Falha de uma fonte não interrompe as outras.",15,false);
  section("COMO FUNCIONA O MONITORAMENTO");
  label("Primeira conexão: os eventos existentes viram referência, sem disparar avisos antigos. Consultas a cada 30 segundos. O aparelho precisa continuar ligado e com acesso à internet.",15,false);
  label("A exibição sobre outros aplicativos e a permanência em segundo plano ainda precisam ser testadas nesta TV/Fire Stick. O teste demonstrativo não confirma a chegada de um alerta real.",15,false);
  label("Setas: navegar · OK: selecionar · Voltar: sair da configuração",14,false);
  String restored=state==null?CATEGORIES[0]:state.getString("operations_page",CATEGORIES[0]);
  sidebarCollapsed=state!=null&&state.getBoolean("operations_collapsed",false);
  applySidebarWidth();
  selectPage(pages.containsKey(restored)?restored:CATEGORIES[0],false);
  navigation.get(selectedPage).requestFocus();
 }
 @Override protected void onSaveInstanceState(Bundle out){
  out.putString("operations_page",selectedPage);
  out.putBoolean("operations_collapsed",sidebarCollapsed);
  super.onSaveInstanceState(out);
 }
 private void buildOperationsShell(){
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  root.setBackgroundColor(OLED);getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(OLED));root.setPadding(dp(18),dp(5),dp(18),dp(5));
  content=root;addBrandedHeader();
  LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.HORIZONTAL);
  root.addView(body,new LinearLayout.LayoutParams(-1,0,1f));
  ScrollView menu=new ScrollView(this);menu.setFillViewport(true);menu.setVerticalScrollBarEnabled(false);
  menu.setTag("operations-sidebar");body.addView(menu,new LinearLayout.LayoutParams(dp(wideLayout?218:178),-1));
  sidebar=new LinearLayout(this);sidebar.setOrientation(LinearLayout.VERTICAL);
  sidebar.setPadding(dp(2),dp(3),dp(8),dp(3));menu.addView(sidebar);
  sidebarToggle=new Button(this);sidebarToggle.setText("‹  Recolher");sidebarToggle.setAllCaps(false);
  sidebarToggle.setId(View.generateViewId());sidebarToggle.setTextColor(GOLD);sidebarToggle.setTextSize(14);
  sidebarToggle.setMinHeight(0);sidebarToggle.setMinimumHeight(0);sidebarToggle.setMinWidth(0);
  sidebarToggle.setIncludeFontPadding(false);sidebarToggle.setSingleLine(true);sidebarToggle.setGravity(Gravity.CENTER);
  sidebarToggle.setPadding(0,0,0,0);
  sidebarToggle.setContentDescription("Recolher ou expandir menu");sidebarToggle.setTag("sidebar-toggle");
  sidebarToggle.setOnClickListener(v->{sidebarCollapsed=!sidebarCollapsed;applySidebarWidth();});
  sidebarToggle.setOnFocusChangeListener((v,focused)->styleButton(sidebarToggle,focused));
  styleButton(sidebarToggle,false);
  sidebar.addView(sidebarToggle,new LinearLayout.LayoutParams(-1,dp(MENU_TOGGLE_DP)));
  Button previous=sidebarToggle;
  for(int i=0;i<CATEGORIES.length;i++){
   final String category=CATEGORIES[i];
   Button nav=new Button(this);nav.setId(View.generateViewId());nav.setTag("nav-"+category);
   nav.setAllCaps(false);nav.setTextSize(16);nav.setIncludeFontPadding(false);nav.setSingleLine(true);nav.setMinHeight(0);nav.setMinimumHeight(0);nav.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
   nav.setPadding(dp(12),0,dp(8),0);nav.setContentDescription(category);
   nav.setText(category);iconFor(nav,i,false);
   nav.setOnClickListener(v->selectPage(category,true));
   nav.setOnFocusChangeListener((v,focused)->styleNavigation(nav,category));
   LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-1,dp(35));np.topMargin=dp(1);
   sidebar.addView(nav,np);navigation.put(category,nav);
   previous.setNextFocusDownId(nav.getId());nav.setNextFocusUpId(previous.getId());previous=nav;
  }
  previous.setNextFocusDownId(previous.getId());sidebarToggle.setNextFocusUpId(sidebarToggle.getId());
  menu.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->fitSidebar(b-t));
  View divider=new View(this);divider.setBackgroundColor(EDGE);
  body.addView(divider,new LinearLayout.LayoutParams(dp(1),-1));
  pageHost=new FrameLayout(this);body.addView(pageHost,new LinearLayout.LayoutParams(0,-1,1f));
  TextView footer=display("← → ↑ ↓  Navegar     OK  Selecionar     Voltar  Menu / sair",13,MUTED,false);
  footer.setGravity(Gravity.CENTER);footer.setPadding(0,dp(5),0,0);root.addView(footer);
  setContentView(root);
 }
 private void applySidebarWidth(){
  View menu=(View)sidebar.getParent();ViewGroup.LayoutParams lp=menu.getLayoutParams();
  lp.width=dp(sidebarCollapsed?66:(wideLayout?218:178));menu.setLayoutParams(lp);
  sidebarToggle.setText(sidebarCollapsed?"›":"‹  Recolher");
  for(int i=0;i<CATEGORIES.length;i++){
   Button nav=navigation.get(CATEGORIES[i]);
   nav.setText(sidebarCollapsed?"":CATEGORIES[i]);iconFor(nav,i,sidebarCollapsed);
   nav.setGravity(sidebarCollapsed?Gravity.CENTER:Gravity.CENTER_VERTICAL|Gravity.START);
   nav.setPadding(sidebarCollapsed?0:dp(10),0,sidebarCollapsed?0:dp(6),0);
  }
 }
 private void fitSidebar(int height){
  if(height<=0)return;
  int row=Math.max(dp(28),Math.min(dp(40),(height-dp(MENU_TOGGLE_DP)-sidebar.getPaddingTop()-sidebar.getPaddingBottom()-CATEGORIES.length*dp(1))/CATEGORIES.length));
  for(Button nav:navigation.values()){
   ViewGroup.LayoutParams p=nav.getLayoutParams();
   if(p.height!=row){p.height=row;nav.setLayoutParams(p);}
  }
 }
 private void route(String category){
  buildingPage=category;actionRow=null;
  ScrollView scroll=pages.get(category);
  if(scroll==null){
   scroll=new ScrollView(this);scroll.setTag("page-"+category);
   scroll.setFillViewport(true);scroll.setClipToPadding(false);scroll.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
   LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);
   panel.setPadding(dp(18),dp(5),dp(10),dp(18));
   TextView title=display(category,wideLayout?29:25,INK,false);title.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));panel.addView(title);
   scroll.addView(panel,new ScrollView.LayoutParams(-1,-2));
   pageHost.addView(scroll,new FrameLayout.LayoutParams(-1,-1));
   scroll.setVisibility(View.GONE);pages.put(category,scroll);
  }
  content=(LinearLayout)scroll.getChildAt(0);
 }
 private void selectPage(String category,boolean focusContent){
  ScrollView next=pages.get(category);if(next==null)return;
  boolean changed=!category.equals(selectedPage)||next.getVisibility()!=View.VISIBLE;
  selectedPage=category;
  for(Map.Entry<String,ScrollView> entry:pages.entrySet())
   entry.getValue().setVisibility(entry.getKey().equals(category)?View.VISIBLE:View.GONE);
  for(Map.Entry<String,Button> entry:navigation.entrySet())styleNavigation(entry.getValue(),entry.getKey());
  if(changed&&android.animation.ValueAnimator.areAnimatorsEnabled()){
   next.animate().cancel();next.setAlpha(.72f);next.animate().alpha(1f).setDuration(150).start();
  }else{next.animate().cancel();next.setAlpha(1f);}
  if(focusContent)focusPage();
 }
 private void styleNavigation(Button nav,String category){
  boolean selected=category.equals(selectedPage),focused=nav.hasFocus();
  nav.setTextColor(selected||focused?INK:MUTED);
  nativeButton(nav);
  nav.setBackground(glass(focused,selected,9));
  nav.setPadding(sidebarCollapsed?0:dp(10),0,sidebarCollapsed?0:dp(6),0);
  nav.setSelected(selected);
 }
 private void focusPage(){
  ScrollView page=pages.get(selectedPage);if(page==null)return;
  View last=rememberedFocus.get(selectedPage);
  if(last!=null&&last.isShown()&&last.requestFocus())return;
  for(View view:page.getFocusables(View.FOCUS_FORWARD))
   if(view!=page&&view.isShown()&&view.requestFocus())return;
 }
 private void trackFocus(View view,boolean leftmost){
  final String page=buildingPage;
  if(view.getId()==View.NO_ID)view.setId(View.generateViewId());
  if(leftmost)view.setNextFocusLeftId(navigation.get(page).getId());
  View.OnFocusChangeListener original=view.getOnFocusChangeListener();
  view.setOnFocusChangeListener((v,focused)->{
   if(original!=null)original.onFocusChange(v,focused);
   if(focused)rememberedFocus.put(page,v);
  });
 }
 @Override public boolean dispatchKeyEvent(KeyEvent event){
  if(event.getAction()==KeyEvent.ACTION_DOWN&&event.getKeyCode()==KeyEvent.KEYCODE_DPAD_RIGHT){
   View focused=getCurrentFocus();
   for(Map.Entry<String,Button> item:navigation.entrySet())if(focused==item.getValue()){
    selectPage(item.getKey(),true);return true;
   }
  }
  return super.dispatchKeyEvent(event);
 }
 @Override public void onBackPressed(){
  if(getCurrentFocus()!=null&&rememberedFocus.get(selectedPage)==getCurrentFocus()){
   navigation.get(selectedPage).requestFocus();return;
  }
  if(!CATEGORIES[0].equals(selectedPage)){
   selectPage(CATEGORIES[0],false);navigation.get(selectedPage).requestFocus();return;
  }
  super.onBackPressed();
 }
 private String categoryFor(String title){
  if(title.startsWith("TESTES")||title.startsWith("DIAGNÓSTICO")||title.contains("SIMULAÇÃO NA TV")||title.startsWith("RECONHECIMENTO LOCAL"))return CATEGORIES[8];
  if(title.startsWith("DEFESA CIVIL")&&title.contains("VINCULAR"))return CATEGORIES[7];
  if(title.startsWith("DEFESA CIVIL"))return CATEGORIES[1];
  if(title.startsWith("ALEXA")||title.startsWith("GOOGLE HOME"))return CATEGORIES[7];
  if(title.startsWith("EFEITOS")||title.startsWith("DURAÇÃO"))return CATEGORIES[5];
  if(title.startsWith("PREFERÊNCIAS"))return CATEGORIES[6];
  if(title.startsWith("REPLAY E")||title.startsWith("AVISOS REGIONAIS")||title.startsWith("BRASIL")||title.startsWith("RESUMO")||title.startsWith("REGRAS SÍSMICAS"))return CATEGORIES[2];
  if(title.startsWith("METEOROLOGIA")||title.startsWith("CHUVA"))return CATEGORIES[3];
  if(title.startsWith("MERCADO"))return CATEGORIES[4];
  if(title.startsWith("ATUALIZAÇÃO")||title.startsWith("COMO FUNCIONA"))return CATEGORIES[9];
  return CATEGORIES[0];
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
  // Animated eye and radar reproduce the Argos Orbis compact brand.
  // Keep the accessibility-friendly native view used by Android TV.
  header.addView(radar,new LinearLayout.LayoutParams(dp(68),dp(68)));
  LinearLayout titles=new LinearLayout(this);titles.setOrientation(LinearLayout.VERTICAL);
  LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,-2,1f);tp.leftMargin=dp(12);
  header.addView(titles,tp);
  TextView name=display("ARGOS ORBIS",wideLayout?29:25,GOLD,true);
  try{name.setTypeface(Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf"));}catch(RuntimeException ignored){}
  titles.addView(name);
  TextView tagline=display("INTELIGÊNCIA PLANETÁRIA · SISMOS · METEOROLOGIA",wideLayout?13:12,MUTED,false);
  titles.addView(tagline);
  TextView links=display("argosorbis.com.br  •  t.me/argosorbis",wideLayout?12:11,GOLD,false);
  titles.addView(links);
  LinearLayout meta=new LinearLayout(this);meta.setOrientation(LinearLayout.VERTICAL);
  monitorBadge=display("Monitoramento: verificando",15,INK,true);meta.addView(monitorBadge);
  meta.addView(display("VERSÃO "+BuildConfig.VERSION_NAME,13,MUTED,false));header.addView(meta);
  content.addView(header);
 }
 private void addStatusPanel(){
  LinearLayout panel=new LinearLayout(this);
  panel.setOrientation(wideLayout?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);
  panel.setPadding(dp(20),dp(12),dp(20),dp(12));
  panel.setBackground(card(SURFACE,EDGE,16));
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.topMargin=dp(16);lp.bottomMargin=dp(10);content.addView(panel,lp);
  status=display("Verificando permissões e monitoramento…",17,Color.WHITE,false);
  weatherStatus=display("Verificando fontes e meteorologia…",17,MUTED,false);
  if(wideLayout){
   LinearLayout.LayoutParams a=new LinearLayout.LayoutParams(0,-2,1f);a.rightMargin=dp(22);
   panel.addView(status,a);
   View divider=new View(this);divider.setBackgroundColor(EDGE);
   panel.addView(divider,new LinearLayout.LayoutParams(dp(1),-1));
   LinearLayout.LayoutParams b=new LinearLayout.LayoutParams(0,-2,1f);b.leftMargin=dp(22);
   panel.addView(weatherStatus,b);
  }else{
   panel.addView(status);
   panel.addView(weatherStatus);
  }
 }
 private void section(String title){
  route(categoryFor(title));currentSection=title;
  TextView t=display(title,18,GOLD,true);
  t.setPadding(dp(2),dp(5),dp(2),dp(4));
  t.setBackgroundColor(OLED);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.topMargin=dp(12);lp.bottomMargin=dp(5);content.addView(t,lp);
 }
 private void addSwitch(Switch toggle){
  actionRow=null;toggle.setFocusable(true);
  toggle.setPadding(dp(18),dp(10),dp(18),dp(10));
  toggle.setBackground(card(SURFACE,EDGE,12));
  toggle.setThumbTintList(android.content.res.ColorStateList.valueOf(GOLD));
  toggle.setMinHeight(dp(64));
  toggle.setOnFocusChangeListener((v,focused)->
    v.setBackground(card(focused?0xff392e23:SURFACE,
      focused?GOLD:EDGE,12)));
  trackFocus(toggle,true);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.setMargins(0,dp(5),0,dp(5));content.addView(toggle,lp);
 }
 private void replayCivilReal(boolean phone,boolean extreme){
  String level=extreme?CivilReplayStore.EXTREME:CivilReplayStore.SEVERE;
  DefesaCivilSp.Notice notice=phone?CivilPhoneHistory.last(this,level):CivilReplayStore.last(this,level);
  String origin=phone?"recebido do celular":"CAP oficial recebido nesta TV";
  if(notice==null){
   new AlertDialog.Builder(this).setTitle("Nenhum alerta real "+(extreme?"EXTREMO":"SEVERO")+" salvo")
    .setMessage("Não existe alerta real "+origin+" disponível no histórico local dos últimos sete dias. "
     +"A TV não recupera alertas que não recebeu. Simulações nunca são usadas para replay.")
    .setPositiveButton("Entendi",null).show();
   return;
  }
  if(!Settings.canDrawOverlays(this)){
   new AlertDialog.Builder(this).setTitle("Sobreposição desativada")
    .setMessage("Autorize a sobreposição do Argos Orbis para mostrar o replay sobre o vídeo.")
    .setPositiveButton("Entendi",null).show();
   return;
  }
  String action=phone?(extreme?MonitorService.REPLAY_PHONE_EXTREME:MonitorService.REPLAY_PHONE_SEVERE)
   :(extreme?MonitorService.REPLAY_CIVIL_EXTREME:MonitorService.REPLAY_CIVIL_SEVERE);
  new AlertDialog.Builder(this).setTitle("Reproduzir alerta real "+(extreme?"EXTREMO":"SEVERO"))
   .setMessage("Origem: "+origin+"\nEmitido: "+BrDates.dateTime(notice.sent)
    +"\n\n"+notice.message+"\n\nReplay histórico, sem som, por 20 segundos. "
    +"Começa 10 segundos depois da confirmação. Não é um alerta atual.")
   .setNegativeButton("Cancelar",null)
   .setPositiveButton("Reproduzir em 10 s",(d,w)->launch(action)).show();
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
  speech.putExtra(RecognizerIntent.EXTRA_PROMPT,"Fale com o Argos Orbis");
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
   else voiceMessage("A TV não concedeu permissão de microfone ao Argos Orbis.");
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
  TextView t=display(s,size,bold?INK:MUTED,bold);
  if(!bold&&s.length()>145){
   // Long manuals stay accessible, but no longer fill the TV's first screen.
   t.setVisibility(View.GONE);t.setPadding(dp(14),dp(8),dp(14),dp(12));
   Button more=new Button(this);more.setAllCaps(false);more.setTextSize(15);
   more.setTextColor(GOLD);more.setText("ⓘ  Informações e detalhes");
   more.setContentDescription("Informações e detalhes · "+currentSection);
   more.setMinHeight(dp(44));more.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);more.setPadding(dp(12),0,dp(12),0);
   styleButton(more,false);
   more.setOnFocusChangeListener((v,focused)->styleButton(more,focused));
   trackFocus(more,true);
      more.setOnClickListener(v->{
    boolean open=t.getVisibility()!=View.VISIBLE;
    t.setVisibility(open?View.VISIBLE:View.GONE);
    more.setText(open?"Ocultar informações":"ⓘ  Informações e detalhes");
    more.setContentDescription((open?"Ocultar informações · ":"Informações e detalhes · ")+t.getText().toString().substring(0,Math.min(65,t.length())));
   });
   LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-1,-2);mp.topMargin=dp(4);
   content.addView(more,mp);
  }
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.setMargins(0,dp(5),0,dp(7));content.addView(t,lp);
  return t;
 }
 private void nativeButton(Button b){
  b.setBackgroundTintList(null);b.setStateListAnimator(null);
  b.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
 }
 private GradientDrawable glass(boolean focus,boolean selected,int radius){
  int top=focus?0xff2b2117:selected?0xff1c1711:0xff131415;
  int middle=focus?0xff17130f:selected?0xff100d09:0xff08090a;
  int bottom=focus?0xff0a0806:0xff030304;
  GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{top,middle,bottom});
  d.setCornerRadius(dp(radius));d.setStroke(dp(focus?2:1),focus?GOLD:selected?0xff705638:0xff333031);return d;
 }
 private void styleButton(Button b,boolean focus){
  int left=b.getPaddingLeft(),top=b.getPaddingTop(),right=b.getPaddingRight(),bottom=b.getPaddingBottom();
  nativeButton(b);b.setBackground(glass(focus,false,12));b.setPadding(left,top,right,bottom);
 }
 private void setTile(Button tile,String title,String detail){
  if(tile==null)return;
  String cleaned=detail==null?"Aguardando consulta":detail.replaceAll("\\s+"," ").trim();
  if(cleaned.isEmpty())cleaned="Aguardando consulta";
  tile.setContentDescription(title+" · "+cleaned);
  if(!CATEGORIES[4].equals(title)&&cleaned.length()>86)cleaned=cleaned.substring(0,83)+"…";
  String text=title+"\n"+(CATEGORIES[4].equals(title)?marketSummary(cleaned):cleaned);
  if(text.contentEquals(tile.getText()))return;
  android.text.SpannableString styled=new android.text.SpannableString(text);
  styled.setSpan(new android.text.style.ForegroundColorSpan(GOLD),0,title.length(),33);
  styled.setSpan(new android.text.style.RelativeSizeSpan(.76f),title.length()+1,text.length(),33);
  styled.setSpan(new android.text.style.ForegroundColorSpan(MUTED),title.length()+1,text.length(),33);
  tile.setText(styled);
 }
 // Compact only the known status formats, preserving values and explicit missing/closed states.
 static String marketSummary(String status){
  if(status==null||status.trim().isEmpty())return "Aguardando cotação real";
  String[] parts=status.split(" · ");
  if(parts.length>=3&&"COTAÇÕES".equals(parts[0])){
   String brent=parts[1],fx=parts[2].replace("Yahoo USD/BRL","Dólar (Yahoo)");
   return brent+"\n"+fx;
  }
  if(parts.length>=4&&"BRENT".equals(parts[0])&&"DÓLAR".equals(parts[2]))
   return "Brent · "+parts[1]+"\nDólar · "+parts[3];
  if(parts.length>=3&&"REAL".equals(parts[0]))
   return "Brent "+parts[1]+"\n"+parts[2];
  return status;
 }
 private void iconFor(Button b,int index,boolean compact){
  android.graphics.drawable.Drawable icon=new DashboardIcon(index);
  int size=dp(compact?20:23);icon.setBounds(0,0,size,size);
  if(compact)b.setCompoundDrawables(null,icon,null,null);
  else b.setCompoundDrawables(icon,null,null,null);
  b.setCompoundDrawablePadding(compact?0:dp(9));
 }
 private static final class DashboardIcon extends android.graphics.drawable.Drawable{
  private final int index;private final android.graphics.Paint p=new android.graphics.Paint(3);
  DashboardIcon(int index){this.index=index;}
  private void line(android.graphics.Canvas c,float a,float b,float x,float y){c.drawLine(a,b,x,y,p);}
  private void path(android.graphics.Canvas c,float... points){
   android.graphics.Path path=new android.graphics.Path();path.moveTo(points[0],points[1]);
   for(int i=2;i<points.length;i+=2)path.lineTo(points[i],points[i+1]);c.drawPath(path,p);
  }
  @Override public void draw(android.graphics.Canvas c){
   android.graphics.Rect b=getBounds();int save=c.save();c.translate(b.left,b.top);c.scale(b.width()/24f,b.height()/24f);
   p.setColor(GOLD);p.setStyle(android.graphics.Paint.Style.STROKE);p.setStrokeWidth(1.65f);
   p.setStrokeCap(android.graphics.Paint.Cap.ROUND);p.setStrokeJoin(android.graphics.Paint.Join.ROUND);
   switch(index){
    case 0:path(c,3,11,12,3,21,11,19,11,19,21,5,21,5,11,3,11);path(c,10,21,10,15,14,15,14,21);break;
    case 1:path(c,12,2,21,6,20,14,17,19,12,22,7,19,4,14,3,6,12,2);line(c,12,7,12,13);c.drawCircle(12,17,.55f,p);break;
    case 2:path(c,2,12,6,12,8,5,12,20,15,8,18,12,22,12);break;
    case 3:c.drawCircle(8,7,3.5f,p);path(c,1,7,2,7);line(c,8,1,8,2);line(c,3,2,4,3);c.drawRoundRect(4,11,22,20,4,4,p);break;
    case 4:path(c,3,3,3,21,22,21);path(c,6,16,11,11,15,14,21,6,21,11);line(c,16,6,21,6);break;
    case 5:c.drawRoundRect(3,3,21,21,4,4,p);path(c,12,5,19,12,12,19,5,12,12,5);break;
    case 6:path(c,3,9,7,9,12,5,12,19,7,15,3,15,3,9);c.drawArc(8,5,20,19,-62,124,false,p);c.drawArc(7,2,24,22,-62,124,false,p);break;
    case 7:c.drawRoundRect(6,2,18,22,3,3,p);line(c,10,18,14,18);break;
    case 8:path(c,9,3,15,3,15,9,21,19,20,21,4,21,3,19,9,9,9,3);line(c,6,15,18,15);break;
    default:c.drawCircle(12,12,7,p);c.drawCircle(12,12,2.6f,p);for(int i=0;i<8;i++){c.save();c.rotate(i*45,12,12);line(c,12,2,12,5);c.restore();}break;
   }c.restoreToCount(save);
  }
  @Override public void setAlpha(int alpha){p.setAlpha(alpha);}
  @Override public void setColorFilter(android.graphics.ColorFilter f){p.setColorFilter(f);}
  @Override public int getOpacity(){return android.graphics.PixelFormat.TRANSLUCENT;}
 }
 private Button button(String s,View.OnClickListener listener){
  Button b=new Button(this);
  b.setText(s);b.setTextSize(wideLayout?18:17);
  b.setTextColor(INK);b.setAllCaps(false);
  b.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
  b.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
  b.setMinHeight(dp(60));b.setPadding(dp(15),dp(9),dp(15),dp(9));
  b.setOnClickListener(listener);
  b.setOnFocusChangeListener((v,focused)->styleButton(b,focused));
  styleButton(b,false);
  if(!wideLayout){
   trackFocus(b,true);
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
   lp.setMargins(0,dp(5),0,dp(5));content.addView(b,lp);
  }else{
   if(actionRow==null||actionRow.getChildCount()>=2){
    actionRow=new LinearLayout(this);actionRow.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);
    rp.setMargins(0,dp(5),0,dp(5));content.addView(actionRow,rp);
   }
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1f);
   trackFocus(b,actionRow.getChildCount()==0);
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
  long civil=p.getLong("civilPhoneLastDisplayedAt",0);
  setTile(overviewCards[0],CATEGORIES[1],civil>0?"Última exibição via celular: "+BrDates.dateTime(civil):"Histórico real · consultar CAP e celular");
  setTile(overviewCards[1],CATEGORIES[2],cachedTarget!=null?RegionalReplayDetails.summary(cachedTarget):source);
  setTile(overviewCards[2],CATEGORIES[3],weather);
  setTile(overviewCards[3],CATEGORIES[4],brent);
  setIfChanged(marketDetail,brent);
  if(replayStatus!=null)setIfChanged(replayStatus,
    "Último replay regional salvo: "+RegionalReplayDetails.summary(cachedTarget)
    +" · aparece SOBRE o vídeo, após 10 s");
  if(start!=null)setIfChanged(start,enabled?"Parar monitoramento":"Ativar monitoramento");
  setIfChanged(updateStatus,p.getString("updateStatus","Aguardando verificação de atualização"));
  setIfChanged(monitorBadge,enabled?(overlay?"● Monitoramento ativo":"! Sobreposição bloqueada"):"○ Monitoramento inativo");
  if(monitorBadge!=null)monitorBadge.setTextColor(enabled&&overlay?0xff75caa0:GOLD);
 }
 @Override protected void onDestroy(){TvSounds.stopPreview();endDirectVoice();if(updater!=null)updater.close();super.onDestroy();}
 @Override protected void onResume(){super.onResume();if(updater!=null)updater.resume();if(Prefs.get(this).getBoolean("enabled",false))launch(MonitorService.START);handler.removeCallbacks(refresh);update();handler.postDelayed(refresh,9000);}
 @Override protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
}


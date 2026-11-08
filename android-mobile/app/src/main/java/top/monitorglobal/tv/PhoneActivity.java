package top.monitorglobal.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.*;
import android.text.TextUtils;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;

/** First phone client: touch navigation and foreground-only updates. */
public class PhoneActivity extends Activity {
 static final int BACK=0xff020816,BODY=0xff071724,CYAN=0xff38bdf8,TEXT=0xfff2f7fc,MUTED=0xffb7c7d8,AMBER=0xffffc04d;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final List<Bitmap> flagImages=new ArrayList<>();private final List<ImageView> flagViews=new ArrayList<>();
 private final LinkedHashMap<String,Integer> scrollPositions=new LinkedHashMap<>(16,.75f,true);private ScrollView visibleScroll;private String displayedRoute="";
 private LinearLayout root,header,navigation;private FrameLayout content;private TextView status;
 private Typeface brand;private PhoneRepository repository;private PhoneRepository.Snapshot snapshot;
 private WeatherBriefingClient briefing;private PhoneMapView map,rainMap;private ExecutorService worker;private SharedPreferences cache;
 private String tab="home",returnTab="home",mapFilter="all";private Alert selected;
 private boolean active,destroyed,refreshing;private int generation;
 private final Runnable pulse=new Runnable(){public void run(){if(!active||destroyed)return;refresh(false);main.postDelayed(this,60000);}};

 protected PhoneRepository createRepository(){return new PhoneRepository();}
 protected boolean automaticRefresh(){return true;}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);if(automaticRefresh())briefing=new WeatherBriefingClient(this,()->{if(active&&!destroyed)render();});brand=loadBrand();cache=getSharedPreferences("monitor-phone",MODE_PRIVATE);repository=createRepository();
  try{repository.importCache(cache.getString("snapshot",""),System.currentTimeMillis());}catch(RuntimeException ignored){}
  snapshot=repository.snapshot(System.currentTimeMillis());
  if(saved!=null){tab=saved.getString("tab","home");returnTab=saved.getString("returnTab","home");mapFilter=saved.getString("mapFilter","all");ArrayList<String> keys=saved.getStringArrayList("scrollKeys");ArrayList<Integer> positions=saved.getIntegerArrayList("scrollPositions");if(keys!=null&&positions!=null)for(int i=0;i<Math.min(64,Math.min(keys.size(),positions.size()));i++)scrollPositions.put(keys.get(i),Math.max(0,positions.get(i)));try{String record=saved.getString("selected","");if(!record.isEmpty())selected=AlertCodec.read(new org.json.JSONObject(record));}catch(org.json.JSONException ignored){}}
  getWindow().setStatusBarColor(BACK);getWindow().setNavigationBarColor(BACK);getWindow().getDecorView().setSystemUiVisibility(0);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BACK);
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(14),dp(7),dp(8),dp(7));header.setBackgroundColor(BODY);root.addView(header,new LinearLayout.LayoutParams(-1,dp(60)));
  header.addView(new PhoneIcons(this,PhoneIcons.RADAR,CYAN),new LinearLayout.LayoutParams(dp(26),dp(26)));
  TextView title=text("MONITOR GLOBAL",22,TEXT,1);LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(0,-2,1);titleParams.setMarginStart(dp(8));header.addView(title,titleParams);
  FrameLayout reload=new FrameLayout(this);reload.setTag("refresh");reload.setContentDescription("Atualizar dados");reload.setBackground(ripple(BODY));PhoneIcons refreshIcon=new PhoneIcons(this,PhoneIcons.REFRESH,CYAN);FrameLayout.LayoutParams iconParams=new FrameLayout.LayoutParams(dp(24),dp(24),Gravity.CENTER);reload.addView(refreshIcon,iconParams);header.addView(reload,new LinearLayout.LayoutParams(dp(48),dp(48)));reload.setOnClickListener(v->refresh(true));
  status=text("Aguardando consulta",12,MUTED,3);status.setPadding(dp(14),dp(6),dp(14),dp(6));root.addView(status,new LinearLayout.LayoutParams(-1,-2));
  content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  navigation=new LinearLayout(this);navigation.setGravity(Gravity.CENTER);navigation.setBackgroundColor(BODY);root.addView(navigation,new LinearLayout.LayoutParams(-1,dp(66)));
  readPush(getIntent());setContentView(root);render();
 }
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPush(intent);render();}
 private void readPush(Intent intent){String raw=intent.getStringExtra(PhonePush.EXTRA);intent.removeExtra(PhonePush.EXTRA);if(raw==null||raw.length()>3000)return;try{selected=AlertCodec.read(new org.json.JSONObject(raw));tab="notices";returnTab="notices";}catch(org.json.JSONException ignored){}}
 private void activatePush(){if(!PhonePush.configured()){render();return;}if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},77);return;}PhonePush.enable(this,()->{if(!destroyed)render();});}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==77){if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)PhonePush.enable(this,()->{if(!destroyed)render();});else{PhonePush.disable(this);render();}}}
 private Typeface loadBrand(){try{return Typeface.createFromAsset(getAssets(),"fonts/Rajdhani-Bold.ttf");}catch(RuntimeException ignored){return Typeface.DEFAULT_BOLD;}}
 @Override protected void onStart(){super.onStart();active=true;generation++;if(map!=null&&selected==null&&tab.equals("map"))map.resume();if(rainMap!=null&&selected==null&&tab.equals("rain"))rainMap.resume();if(automaticRefresh())main.post(pulse);}
 @Override protected void onStop(){rememberScroll();active=false;generation++;refreshing=false;main.removeCallbacks(pulse);if(repository!=null)repository.cancel();if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();if(briefing!=null)briefing.pause();super.onStop();}
 @Override protected void onDestroy(){destroyed=true;active=false;if(briefing!=null)briefing.close();generation++;main.removeCallbacksAndMessages(null);if(repository!=null)repository.close();if(worker!=null)worker.shutdownNow();if(map!=null){map.close();map=null;}if(rainMap!=null){rainMap.close();rainMap=null;}clearFlags();super.onDestroy();}
 @Override protected void onSaveInstanceState(Bundle out){rememberScroll();out.putString("tab",tab);out.putString("returnTab",returnTab);out.putString("mapFilter",mapFilter);out.putStringArrayList("scrollKeys",new ArrayList<>(scrollPositions.keySet()));out.putIntegerArrayList("scrollPositions",new ArrayList<>(scrollPositions.values()));if(selected!=null)try{out.putString("selected",AlertCodec.write(selected).toString());}catch(org.json.JSONException ignored){}super.onSaveInstanceState(out);}
 private void refresh(boolean force){
  if(!active||destroyed||refreshing)return;refreshing=true;status.setText("Atualizando dados…");final int token=generation;
  if(worker==null)worker=Executors.newSingleThreadExecutor();worker.execute(()->{
   try{PhoneRepository.Snapshot next=force?repository.refresh(System.currentTimeMillis(),true):repository.refresh(System.currentTimeMillis());String raw=repository.exportCache();main.post(()->{if(!active||destroyed||generation!=token)return;refreshing=false;cache.edit().putString("snapshot",raw).apply();applySnapshot(next);});}
   catch(RuntimeException e){main.post(()->{if(!active||destroyed||generation!=token)return;refreshing=false;applySnapshot(repository.snapshot(System.currentTimeMillis()));status.setText("Não foi possível atualizar agora. Tente novamente.");});}
  });
 }
 void applySnapshot(PhoneRepository.Snapshot next){snapshot=next;if(briefing!=null&&active){briefing.prefetch("hourly",next.weather,next.rain);briefing.prefetch("rain",next.weather,next.rain);}if(selected!=null)for(Alert latest:next.events)if(latest.id.equals(selected.id)){selected=latest.copy();break;}render();}
 private void rememberScroll(){if(visibleScroll==null||displayedRoute.isEmpty())return;scrollPositions.put(displayedRoute,visibleScroll.getScrollY());while(scrollPositions.size()>64)scrollPositions.remove(scrollPositions.keySet().iterator().next());}
 private void render(){
  if(content==null||destroyed)return;rememberScroll();visibleScroll=null;displayedRoute=selected==null?"tab:"+tab:"event:"+selected.id;if(map!=null)map.pause();if(rainMap!=null)rainMap.pause();content.removeAllViews();clearFlags();updateStatus();renderNavigation();
  if(selected!=null){LinearLayout page=page();eventPage(page,selected);return;}
  if(tab.equals("map")){mapPage();return;}
  if(tab.equals("rain")){rainPage();return;}
  LinearLayout page=page();if(tab.equals("weather"))weatherPage(page);else if(tab.equals("notices"))noticesPage(page);else homePage(page);
 }
 private void updateStatus(){status.setVisibility(selected==null&&tab.equals("rain")?View.GONE:View.VISIBLE);if(snapshot==null){status.setText("Aguardando consulta");return;}String time=snapshot.refreshedAt>0?" · "+BrDates.dateTime(snapshot.refreshedAt):"";status.setText(snapshot.feedStatus+time);}
 private void renderNavigation(){
  navigation.removeAllViews();String shown=selected==null?(tab.equals("rain")?"weather":tab):returnTab;String[] ids={"home","map","weather","notices"},labels={"Início","Mapa","Tempo","Avisos"};int[] icons={PhoneIcons.HOME,PhoneIcons.MAP,PhoneIcons.CLOUD,PhoneIcons.BELL};
  for(int i=0;i<ids.length;i++){final String target=ids[i];boolean current=target.equals(shown);int color=current?CYAN:MUTED;LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setGravity(Gravity.CENTER);item.setMinimumHeight(dp(56));item.setTag("tab-"+target);item.setContentDescription(labels[i]);item.setSelected(current);item.setBackground(ripple(BODY));item.addView(new PhoneIcons(this,icons[i],color),new LinearLayout.LayoutParams(dp(23),dp(23)));TextView label=text(labels[i],14,color,1);label.setGravity(Gravity.CENTER);item.addView(label,new LinearLayout.LayoutParams(-1,-2));navigation.addView(item,new LinearLayout.LayoutParams(0,-1,1));item.setOnClickListener(v->{selected=null;tab=target;render();});}
 }
 private LinearLayout page(){ScrollView scroll=new ScrollView(this);visibleScroll=scroll;scroll.setFillViewport(false);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(16),dp(12),dp(16),dp(20));scroll.addView(page,new ScrollView.LayoutParams(-1,-2));content.addView(scroll,new FrameLayout.LayoutParams(-1,-1));final int restored=scrollPositions.getOrDefault(displayedRoute,0);scroll.addOnLayoutChangeListener(new View.OnLayoutChangeListener(){public void onLayoutChange(View v,int l,int t,int r,int b,int ol,int ot,int or,int ob){if(scroll.getHeight()<=0)return;scroll.removeOnLayoutChangeListener(this);scroll.post(()->{if(visibleScroll==scroll)scroll.scrollTo(0,restored);});}});return page;}
 private void heading(LinearLayout page,String title){TextView t=text(title,27,TEXT,3);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(t,p);}
 private void copy(LinearLayout page,String value){TextView t=text(value,15,MUTED,60);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(t,p);}
 private LinearLayout card(LinearLayout page,String caption){Panel panel=new Panel(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackgroundColor(BODY);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(16);page.addView(panel,lp);TextView h=text(caption,15,BODY,3);h.setBackgroundColor(CYAN);h.setPadding(dp(12),dp(7),dp(12),dp(7));panel.addView(h,new LinearLayout.LayoutParams(-1,-2));return panel;}
 private LinearLayout section(LinearLayout card){LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(12),dp(12),dp(12),dp(12));card.addView(body,new LinearLayout.LayoutParams(-1,-2));return body;}
 private void footer(LinearLayout card,String value){TextView t=text(value,13,MUTED,10);t.setBackgroundColor(BACK);t.setPadding(dp(12),dp(9),dp(12),dp(10));card.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 private void homePage(LinearLayout page){
  heading(page,"Seu monitor, em um só lugar");copy(page,"Clima: Liberdade, São Paulo");weatherCard(page,false);if(snapshot!=null&&snapshot.rain!=null&&!snapshot.rain.state.equals("dry"))rainCard(page,false);
  heading(page,"Eventos monitorados");copy(page,"M6+ globais, Brasil e áreas monitoradas. A lista depende da cobertura das fontes.");eventList(page,8);Button more=button("Ver avisos e fontes",()->{tab="notices";render();});page.addView(more,new LinearLayout.LayoutParams(-1,-2));
 }
 private void weatherPage(LinearLayout page){Button explore=button("Explorar mapa de chuva · prévia",()->{tab="rain";render();});explore.setTag("open-rain");page.addView(explore,new LinearLayout.LayoutParams(-1,-2));heading(page,"Tempo na Liberdade");copy(page,"Cobertura meteorológica desta versão: um ponto da Liberdade, em São Paulo.");weatherCard(page,true);rainCard(page,true);}
 private void weatherCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"TEMPO · LIBERDADE, SP"),body=section(card);WeatherForecast.Summary w=snapshot==null?null:snapshot.weather;
  if(w==null){String state=snapshot==null?"Aguardando consulta":snapshot.weatherStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando previsão horária…":"Previsão horária indisponível",22,TEXT,4));footer(card,state);return;}
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LinearLayout.LayoutParams(-1,-2));TextView value=text(w.temperatureValue,43,TEXT,2);hero.addView(value,new LinearLayout.LayoutParams(0,-2,1));hero.addView(new PhoneIcons(this,PhoneIcons.condition(w.conditionKey),TEXT),new LinearLayout.LayoutParams(dp(43),dp(43)));
  TextView conditions=text(w.condition,23,TEXT,4);space(body,conditions,8);space(body,text("Sensação "+w.feelsValue,17,MUTED,3),3);
  LinearLayout metrics=metricRow(body);metric(metrics,PhoneIcons.DROP,w.humidityValue,"Umidade");metric(metrics,PhoneIcons.WIND,w.windValue,"Vento");metric(metrics,PhoneIcons.WIND,w.gustValue,"Rajadas");
  String provenance="Rainbow Weather · Modelo horário\n"+w.timing;
  briefingCard(body,"hourly",w,snapshot==null?null:snapshot.rain);
  if(detail)provenance+="\nEstimativa para um ponto da Liberdade · sujeita a mudanças";footer(card,provenance);
 }
 private void rainCard(LinearLayout page,boolean detail){
  LinearLayout card=card(page,"CHUVA · LIBERDADE, SP"),body=section(card);RainForecast.Summary r=snapshot==null?null:snapshot.rain;
  if(r==null){String state=snapshot==null?"Aguardando consulta":snapshot.rainStatus;body.addView(text(state.startsWith("Aguardando")?"Consultando chuva por minuto…":"Chuva por minuto: indisponível",22,TEXT,4));footer(card,state);return;}
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);body.addView(hero,new LinearLayout.LayoutParams(-1,-2));hero.addView(new PhoneIcons(this,r.title.startsWith("Neve")?PhoneIcons.SNOW:r.state.equals("dry")?PhoneIcons.CLOUD:PhoneIcons.RAIN,TEXT),new LinearLayout.LayoutParams(dp(36),dp(36)));TextView title=text(r.title,25,TEXT,4);LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(0,-2,1);hp.setMarginStart(dp(10));hero.addView(title,hp);
  if(!r.state.equals("dry")){LinearLayout row=metricRow(body);metric(row,PhoneIcons.DROP,RainForecast.number(r.amount)+" mm","Próximos 60 min");metric(row,PhoneIcons.CLOCK,r.durationMinutes>0?"~"+r.durationMinutes+" min":"—",r.durationLabel);if(detail){space(body,text(r.forecastRateText,16,MUTED,3),8);space(body,text(r.stopText,16,MUTED,4),5);}}
  else space(body,text(r.amountText,17,MUTED,3),8);
  briefingCard(body,"rain",snapshot==null?null:snapshot.weather,r);
  footer(card,"Rainbow Weather · chuva consultada "+WeatherForecast.time(r.at)+(detail?"\nEstimativa para um ponto da Liberdade · sujeita a mudanças":""));
 }
 private void briefingCard(LinearLayout page,String kind,WeatherForecast.Summary w,RainForecast.Summary r){
  String value=WeatherBriefingClient.text(this,kind,w,r);
  String next30=kind.equals("hourly")?WeatherBriefingClient.outlookText(this,r):"";
  if(!next30.isEmpty()){
   space(page,text("PROJEÇÃO · PRÓXIMOS 30 MIN",12,CYAN,1),10);
   space(page,text(next30,16,TEXT,8),4);
  }
  if(value.isEmpty())return;
  TextView caption=text("RESUMO COM IA",12,CYAN,1);
  space(page,caption,10);space(page,text(value,17,TEXT,8),4);
 }
 private LinearLayout metricRow(LinearLayout body){LinearLayout row=new LinearLayout(this);row.setBaselineAligned(false);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=dp(14);body.addView(row,rp);return row;}
 private void metric(LinearLayout row,int kind,String value,String caption){LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setPadding(0,0,dp(6),0);row.addView(cell,new LinearLayout.LayoutParams(0,-2,1));cell.addView(new PhoneIcons(this,kind,MUTED),new LinearLayout.LayoutParams(dp(20),dp(20)));cell.addView(text(value,20,TEXT,3),new LinearLayout.LayoutParams(-1,-2));cell.addView(text(caption,13,MUTED,4),new LinearLayout.LayoutParams(-1,-2));}
 private List<Alert> events(){List<Alert> out=new ArrayList<>();if(snapshot!=null)out.addAll(snapshot.events);out.sort((a,b)->Long.compare(eventTime(b),eventTime(a)));return out;}
 private static long eventTime(Alert a){return a.kind.equals("tsunami")?a.issuedAt:a.eventTime;}
 private void eventList(LinearLayout page,int maximum){List<Alert> events=events();if(events.isEmpty()){copy(page,snapshot==null||snapshot.feedStatus.startsWith("Aguardando")?"Aguardando consulta dos eventos.":"Nenhum evento disponível nesta consulta. Confira as fontes e tente atualizar.");return;}for(int i=0;i<Math.min(maximum,events.size());i++)eventCard(page,events.get(i));if(events.size()>maximum)copy(page,"Mostrando "+maximum+" de "+events.size()+" eventos da consulta.");}
 private void eventCard(LinearLayout page,Alert a){
  Panel card=new Panel(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(12),dp(12),dp(12),dp(12));card.setBackground(ripple(BODY));card.setTag("event-"+a.id);card.setContentDescription(a.title+". "+source(a)+". Abrir detalhes");LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);page.addView(card,p);
  LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);card.addView(row,new LinearLayout.LayoutParams(-1,-2));if(a.kind.equals("earthquake")){TextView magnitude=text(magnitude(a),30,AMBER,1);LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(-2,-2);mp.setMarginEnd(dp(10));row.addView(magnitude,mp);addFlag(row,a,30);}
  TextView location=text(a.kind.equals("earthquake")?location(a):tsunamiState(a.state),21,TEXT,4);row.addView(location,new LinearLayout.LayoutParams(0,-2,1));space(card,text(a.kind.equals("earthquake")?depth(a):a.title,15,MUTED,4),7);space(card,text(BrDates.dateTime(eventTime(a)),13,MUTED,3),4);space(card,text(source(a),13,MUTED,3),3);card.setOnClickListener(v->showEvent(a));
 }
 private void addFlag(LinearLayout row,Alert a,int size){Bitmap flag=CountryFlag.load(this,a);if(flag==null)return;flagImages.add(flag);ImageView image=new ImageView(this);image.setImageBitmap(flag);flagViews.add(image);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(dp(size),dp(size));fp.setMarginEnd(dp(9));row.addView(image,fp);}
 private void clearFlags(){for(ImageView image:flagViews)image.setImageDrawable(null);flagViews.clear();for(Bitmap b:flagImages)if(!b.isRecycled())b.recycle();flagImages.clear();}
 private void showEvent(Alert a){if(destroyed)return;returnTab=tab;selected=a.copy();render();}
 private void eventPage(LinearLayout page,Alert a){
  page.addView(button("‹ Voltar",()->{selected=null;tab=returnTab;render();}),new LinearLayout.LayoutParams(-1,-2));heading(page,"Detalhes do evento");
  if(a.kind.equals("earthquake")){TextView mag=text(magnitude(a),54,AMBER,1);space(page,mag,6);LinearLayout locationRow=new LinearLayout(this);locationRow.setGravity(Gravity.CENTER_VERTICAL);addFlag(locationRow,a,42);locationRow.addView(text(location(a),28,TEXT,5),new LinearLayout.LayoutParams(0,-2,1));space(page,locationRow,6);}
  else{heading(page,tsunamiState(a.state));copy(page,a.title);}
  LinearLayout info=card(page,a.kind.equals("earthquake")?"REGISTRO SÍSMICO":"BOLETIM OFICIAL");LinearLayout body=section(info);if(a.kind.equals("earthquake"))detail(body,PhoneIcons.DEPTH,depth(a));detail(body,PhoneIcons.CLOCK,BrDates.dateTime(eventTime(a)));space(body,text(source(a),17,TEXT,5),8);if(!a.detail.isEmpty())space(body,text(a.detail,16,MUTED,60),8);footer(info,a.kind.equals("earthquake")?"Danos: sem informação":"Consulte o boletim e siga as orientações das autoridades locais.");
  if(!a.revision.isEmpty())copy(page,"Atualização: "+a.revision);
  if(!a.tsunamiSummary.isEmpty())copy(page,"Boletim de tsunami: "+a.tsunamiSummary);
  if(!a.populationSummary.isEmpty())copy(page,a.populationSummary);if(!a.nearbySummary.isEmpty())copy(page,a.nearbySummary);
  Button mapButton=button("Ver localização no mapa",()->{tab="map";selected=null;showMapEvent(a);});mapButton.setEnabled(MapFrame.located(a.originLongitude,a.originLatitude));page.addView(mapButton,new LinearLayout.LayoutParams(-1,-2));if(!mapButton.isEnabled())copy(page,"Localização no mapa indisponível para este registro.");
  space(page,button("Compartilhar evento",()->share(a)),10);
 }
 private void detail(LinearLayout parent,int kind,String value){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=dp(8);parent.addView(row,rp);row.addView(new PhoneIcons(this,kind,MUTED),new LinearLayout.LayoutParams(dp(24),dp(24)));TextView t=text(value,18,TEXT,5);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMarginStart(dp(10));row.addView(t,lp);}
 private void noticesPage(LinearLayout page){
  heading(page,"Avisos e fontes");copy(page,"Monitor Global · versão "+top.monitorglobal.mobile.BuildConfig.VERSION_NAME);copy(page,PhonePush.status(this));Button enable=button("Ativar notificações",this::activatePush);enable.setEnabled(PhonePush.configured());page.addView(enable,new LinearLayout.LayoutParams(-1,-2));if(PhonePush.enabled(this))page.addView(button("Desativar notificações",()->{PhonePush.disable(this);render();}),new LinearLayout.LayoutParams(-1,-2));page.addView(button("Testar notificação neste aparelho",()->{boolean ok=PhonePush.testLocal(this);Toast.makeText(this,ok?"Teste local criado; isso não confirma entrega pelo Firebase.":"Ative a permissão de notificações do Android primeiro.",Toast.LENGTH_LONG).show();}),new LinearLayout.LayoutParams(-1,-2));if(top.monitorglobal.mobile.BuildConfig.DEBUG&&PhonePush.configured())page.addView(button("Copiar código para teste push",()->PhonePush.copyTestToken(this)),new LinearLayout.LayoutParams(-1,-2));copy(page,"Push depende da conexão e das permissões do Android. O aplicativo não garante entrega instantânea; forçar a parada pode impedir avisos até abri-lo novamente.");page.addView(button("Abrir canal oficial no Telegram",()->openUrl("https://t.me/monitor_global")),new LinearLayout.LayoutParams(-1,-2));
  LinearLayout sources=card(page,"COBERTURA DA CONSULTA"),body=section(sources);body.addView(text("M6+ globais, Brasil e áreas monitoradas",20,TEXT,4));space(body,text(snapshot==null?"Aguardando consulta":snapshot.feedStatus,15,MUTED,5),8);space(body,text(snapshot==null?"Meteorologia aguardando consulta":snapshot.weatherStatus,15,MUTED,5),5);space(body,text(snapshot==null?"Chuva aguardando consulta":snapshot.rainStatus,15,MUTED,5),5);footer(sources,"Ausência de dados não significa ausência de risco. Para orientações de proteção, acompanhe as autoridades responsáveis.");
  heading(page,"Eventos da consulta");eventList(page,40);page.addView(button("Abrir Monitor Global no navegador",()->openUrl("https://monitorglobal.top/")),new LinearLayout.LayoutParams(-1,-2));
 }
 private void mapPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));TextView title=text("Mapa de eventos",25,TEXT,2);title.setPadding(dp(14),dp(10),dp(14),dp(8));box.addView(title,new LinearLayout.LayoutParams(-1,-2));LinearLayout filters=new LinearLayout(this);filters.setPadding(dp(10),0,dp(10),dp(8));box.addView(filters,new LinearLayout.LayoutParams(-1,-2));String[] names={"Todos","Sismos","Tsunami"},ids={"all","earthquake","tsunami"};for(int i=0;i<ids.length;i++){final String id=ids[i];Button b=button(names[i],()->{mapFilter=id;render();});b.setSelected(mapFilter.equals(id));b.setTextColor(mapFilter.equals(id)?CYAN:MUTED);filters.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
  if(map==null)map=new PhoneMapView(this,this::showEvent);if(map.getParent()!=null)((ViewGroup)map.getParent()).removeView(map);box.addView(map,new LinearLayout.LayoutParams(-1,0,1));List<Alert> visible=new ArrayList<>();for(Alert a:events())if(mapFilter.equals("all")||mapFilter.equals(a.kind))visible.add(a);map.setEvents(visible);if(active)map.resume();else map.pause();
 }
 private void rainPage(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);content.addView(box,new FrameLayout.LayoutParams(-1,-1));Button back=button("‹ Tempo na Liberdade",()->{tab="weather";render();});back.setTag("close-rain");box.addView(back,new LinearLayout.LayoutParams(-1,-2));
  if(snapshot!=null)briefingCard(box,"rain",snapshot.weather,snapshot.rain);
  if(rainMap==null)rainMap=new PhoneMapView(this,null,true);if(rainMap.getParent()!=null)((ViewGroup)rainMap.getParent()).removeView(rainMap);box.addView(rainMap,new LinearLayout.LayoutParams(-1,0,1));if(active)rainMap.resume();else rainMap.pause();
 }
 private void showMapEvent(Alert a){tab="map";mapFilter="all";render();List<Alert> visible=events();if(visible.stream().noneMatch(v->v.id.equals(a.id)))visible.add(0,a);map.setEvents(visible);map.focus(a);}
 private void share(Alert a){String value=a.title+"\n"+(a.kind.equals("earthquake")?depth(a)+"\n":"")+BrDates.dateTime(eventTime(a))+"\n"+source(a)+"\nhttps://monitorglobal.top/";try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,value),"Compartilhar evento"));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Nenhum aplicativo disponível para compartilhar.",Toast.LENGTH_LONG).show();}}
 private void openUrl(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Não foi possível abrir o navegador.",Toast.LENGTH_LONG).show();}}
 @Override public void onBackPressed(){if(selected!=null){selected=null;tab=returnTab;render();}else if(tab.equals("rain")){tab="weather";render();}else if(!tab.equals("home")){tab="home";render();}else super.onBackPressed();}
 static String magnitude(Alert a){return Double.isFinite(a.magnitude)?String.format(Locale.forLanguageTag("pt-BR"),"M%.1f",a.magnitude):"M—";}
 static String location(Alert a){return a.title.replaceFirst("^M[0-9]+[,.][0-9]+\\s*·\\s*","");}
 static String depth(Alert a){return Double.isFinite(a.depth)&&a.depth>=0?String.format(Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km",a.depth):"Profundidade não informada";}
 static String source(Alert a){return a.source.isEmpty()?"Fonte não informada":"Fonte: "+a.source;}
 static String tsunamiState(String state){switch(state){case "noThreat":return "Sem ameaça segundo o boletim";case "warning":return "Aviso de tsunami";case "watch":return "Vigilância de tsunami";case "advisory":return "Atenção para tsunami";case "ended":return "Aviso de tsunami encerrado";case "information":return "Boletim informativo de tsunami";default:return "Situação de tsunami não confirmada";}}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private TextView text(String value,int size,int color,int maxLines){TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);v.setTypeface(brand);v.setMaxLines(maxLines);v.setEllipsize(TextUtils.TruncateAt.END);v.setIncludeFontPadding(false);return v;}
 private Button button(String value,Runnable action){Button b=new Button(this);b.setText(value);b.setAllCaps(false);b.setTextSize(16);b.setTypeface(brand);b.setTextColor(CYAN);b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setPadding(dp(12),dp(8),dp(12),dp(8));b.setBackground(ripple(BODY));b.setOnClickListener(v->action.run());return b;}
 private android.graphics.drawable.Drawable ripple(int color){GradientDrawable shape=new GradientDrawable();shape.setColor(color);shape.setCornerRadius(dp(7));shape.setStroke(dp(1),0xff244a62);return new RippleDrawable(ColorStateList.valueOf(0x4038bdf8),shape,null);}
 private void space(LinearLayout parent,View child,int margin){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(margin);parent.addView(child,p);}
 private final class Panel extends LinearLayout {private final Path clip=new Path();Panel(android.content.Context c){super(c);}@Override protected void onSizeChanged(int w,int h,int ow,int oh){super.onSizeChanged(w,h,ow,oh);clip.reset();float r=dp(8);clip.addRoundRect(0,0,w,h,r,r,Path.Direction.CW);}@Override public void draw(Canvas c){int save=c.save();c.clipPath(clip);super.draw(c);c.restoreToCount(save);}}
}
